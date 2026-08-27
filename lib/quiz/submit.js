// Quiz Score Recording and Certificate Generation API (POST /api/quiz/submit)
const { getUserFromRequest } = require('../auth-utils');
const { evaluateServerQuiz } = require('../quiz-keys');
const { query } = require('../db');

module.exports = async function handler(req, res) {
    res.setHeader('Content-Type', 'application/json');

    const allowedOrigin = process.env.ALLOWED_ORIGIN || '*';
    res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Credentials', 'true');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const user = getUserFromRequest(req);
        if (!user) {
            return res.status(200).json({ status: 'guest_untracked' });
        }

        const { experimentId, userAnswers, attemptNumber } = req.body || {};

        if (!experimentId || !userAnswers) {
            return res.status(400).json({ error: 'Missing required quiz fields: experimentId, userAnswers.' });
        }

        const expNum = parseInt(experimentId);

        // Authoritative Server-Side Evaluation
        const evalResult = evaluateServerQuiz(expNum, userAnswers);
        const { earnedScore, totalQuestions, percentage, passed } = evalResult;

        // 1. Insert quiz attempt record
        await query(
            `INSERT INTO quiz_attempts (student_id, experiment_id, attempt_number, score, total_questions, answers_summary)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [user.id, expNum, parseInt(attemptNumber || 1), earnedScore, totalQuestions, JSON.stringify(userAnswers || [])]
        );

        // 2. If passing score (>= 70%), generate/ensure unique Certificate record & mark experiment completed in DB
        let certificateCode = null;
        let certificateScore = null;
        if (passed) {
            const certCode = `CNVL-2026-${String(expNum).padStart(2, '0')}-${user.registerNumber.slice(-4)}-${Math.floor(1000 + Math.random() * 9000)}`;

            const certRes = await query(
                `INSERT INTO certificates (certificate_code, student_id, experiment_id, final_score)
                 VALUES ($1, $2, $3, $4)
                 ON CONFLICT (student_id, experiment_id) DO UPDATE
                 SET final_score = GREATEST(certificates.final_score, EXCLUDED.final_score)
                 RETURNING certificate_code, final_score`,
                [certCode, user.id, expNum, percentage]
            );

            certificateCode = certRes.rows[0].certificate_code;
            certificateScore = certRes.rows[0].final_score;

            // Check simulation progress to enforce dual completion invariant: (Simulations Complete && Quiz Passed >= 70%)
            const progRes = await query(
                `SELECT completed_milestones FROM experiment_progress WHERE student_id = $1 AND experiment_id = $2`,
                [user.id, expNum]
            );
            const expTotalMilestones = { 1: 3, 2: 4, 3: 4, 4: 4, 5: 5 };
            const totalReq = expTotalMilestones[expNum] || 5;
            const milestones = (progRes.rows.length > 0 && Array.isArray(progRes.rows[0].completed_milestones)) 
                ? progRes.rows[0].completed_milestones 
                : [];
            const isSimComplete = milestones.length >= totalReq;
            const isAcademicComplete = isSimComplete && passed;

            const finalStatus = isAcademicComplete ? 'completed' : 'in_progress';
            const finalPercentage = isAcademicComplete ? 100 : Math.min(85, Math.round((milestones.length / totalReq) * 85));

            await query(
                `INSERT INTO experiment_progress (student_id, experiment_id, status, progress_percentage, completed_at, last_activity)
                 VALUES ($1, $2, $3, $4, $5, NOW())
                 ON CONFLICT (student_id, experiment_id) DO UPDATE
                 SET status = $3, 
                     progress_percentage = $4, 
                     completed_at = CASE WHEN $3 = 'completed' THEN COALESCE(experiment_progress.completed_at, NOW()) ELSE NULL END, 
                     last_activity = NOW()`,
                [user.id, expNum, finalStatus, finalPercentage, isAcademicComplete ? new Date() : null]
            );
        }

        return res.status(200).json({
            success: true,
            experimentId: expNum,
            score: earnedScore,
            totalQuestions,
            percentage,
            passed,
            details: evalResult.details,
            certificateCode,
            certificateScore: typeof certificateScore === 'number' ? certificateScore : null
        });
    } catch (error) {
        console.error('Quiz submit error:', error);
        return res.status(500).json({ error: error.message || 'Failed to record quiz submission.' });
    }
};
