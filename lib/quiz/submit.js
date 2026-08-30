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
        // 2. Check simulation progress to enforce dual completion invariant: (Simulations Complete && Quiz Passed >= 70%)
        const AUTHORITATIVE_MILESTONES = {
            1: ['CABLES_STUDIED', 'COMMANDS_EXECUTED', 'PT_UI_EXPLORED'],
            2: ['IPV4_CONFIGURED', 'SUBNET_CALCULATED', 'PINOUT_CRIMPED', 'CABLE_TESTED'],
            3: ['CONSOLE_CONNECTED', 'TERMINAL_CONFIGURED', 'HOSTNAME_SET', 'INTERFACES_CONFIGURED'],
            4: ['SUBNET_DESIGNED', 'TOPOLOGY_WIRED', 'ROUTER_CONFIGURED', 'PING_VERIFIED'],
            5: ['TOPOLOGY_CONFIGURED', 'STATIC_ROUTE_R0', 'STATIC_ROUTE_R1', 'DEFAULT_ROUTE_SET', 'CONNECTIVITY_VERIFIED'],
            6: ['6A_TOPOLOGY_IP', '6A_STATIC_NAT', '6A_NAT_VERIFY', '6B_DYN_NAT_CFG', '6B_DYN_NAT_VERIFY']
        };
        const validMilestones = AUTHORITATIVE_MILESTONES[expNum] || [];

        const progRes = await query(
            `SELECT completed_milestones FROM experiment_progress WHERE student_id = $1 AND experiment_id = $2`,
            [user.id, expNum]
        );
        const eventsRes = await query(
            `SELECT stage, event_payload FROM simulation_events WHERE student_id = $1 AND experiment_id = $2`,
            [user.id, expNum]
        );

        const cumulativeMilestones = new Set(
            (progRes.rows.length > 0 && Array.isArray(progRes.rows[0].completed_milestones)) 
                ? progRes.rows[0].completed_milestones 
                : []
        );

        eventsRes.rows.forEach(row => {
            const p = row.event_payload || {};
            const candidate = p.action ? p.action.replace('Milestone:', '').trim() : row.stage;
            if (validMilestones.includes(candidate)) {
                cumulativeMilestones.add(candidate);
            }
        });

        const milestones = Array.from(cumulativeMilestones).filter(m => validMilestones.includes(m));
        const totalReq = validMilestones.length || 5;
        const isSimComplete = milestones.length >= totalReq;
        const isAcademicComplete = isSimComplete && passed;

        let certificateCode = null;
        let certificateScore = null;

        // Issue certificate ONLY when dual academic requirements are completely satisfied
        if (isAcademicComplete) {
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

            await query(
                `INSERT INTO experiment_progress (student_id, experiment_id, status, progress_percentage, completed_milestones, completed_at, last_activity)
                 VALUES ($1, $2, 'completed', 100, $3, NOW(), NOW())
                 ON CONFLICT (student_id, experiment_id) DO UPDATE
                 SET status = 'completed', 
                     progress_percentage = 100, 
                     completed_milestones = $3,
                     completed_at = COALESCE(experiment_progress.completed_at, NOW()), 
                     last_activity = NOW()`,
                [user.id, expNum, JSON.stringify(milestones)]
            );
        } else {
            // Either simulation is incomplete, or quiz failed: calculate weighted progress up to 85%
            const simRatio = Math.min(1, milestones.length / totalReq);
            const weightedProgress = Math.round(simRatio * 85);

            await query(
                `INSERT INTO experiment_progress (student_id, experiment_id, status, progress_percentage, completed_milestones, last_activity)
                 VALUES ($1, $2, 'in_progress', $3, $4, NOW())
                 ON CONFLICT (student_id, experiment_id) DO UPDATE
                 SET status = 'in_progress', 
                     progress_percentage = $3, 
                     completed_milestones = $4,
                     last_activity = NOW()`,
                [user.id, expNum, weightedProgress, JSON.stringify(milestones)]
            );
        }

        return res.status(200).json({
            success: true,
            experimentId: expNum,
            score: earnedScore,
            totalQuestions,
            percentage,
            passed,
            isSimComplete,
            isAcademicComplete,
            details: evalResult.details,
            certificateCode,
            certificateScore: typeof certificateScore === 'number' ? certificateScore : null
        });
    } catch (error) {
        console.error('Quiz submit error:', error);
        return res.status(500).json({ error: error.message || 'Failed to record quiz submission.' });
    }
};
