// Progress Retrieval Endpoint (GET /api/progress/get)
const { getUserFromRequest } = require('../auth-utils');
const { query } = require('../db');

module.exports = async function handler(req, res) {
    res.setHeader('Content-Type', 'application/json');

    const allowedOrigin = process.env.ALLOWED_ORIGIN || '*';
    res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Credentials', 'true');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const user = getUserFromRequest(req);
        if (!user) {
            return res.status(401).json({ error: 'Unauthorized. Please sign in.' });
        }

        // Fetch student profile, experiment records, and latest quiz scores
        const studentRes = await query(
            `SELECT full_name, register_number, department, section FROM users WHERE id = $1`,
            [user.id]
        );
        const studentInfo = studentRes.rows[0] || {};

        const progressRes = await query(
            `SELECT ep.experiment_id, ep.status, ep.progress_percentage, ep.completed_milestones, ep.completed_at,
                    COALESCE(c.final_score, qa.max_percent, 0) AS score,
                    c.certificate_code,
                    COALESCE(se.event_count, 0) AS event_count
             FROM experiment_progress ep
             LEFT JOIN certificates c ON c.student_id = ep.student_id AND c.experiment_id = ep.experiment_id
             LEFT JOIN (
                 SELECT experiment_id, 
                        MAX(CASE WHEN total_questions > 0 THEN ROUND((score::numeric / total_questions) * 100) ELSE score END) AS max_percent
                 FROM quiz_attempts
                 WHERE student_id = $1
                 GROUP BY experiment_id
             ) qa ON qa.experiment_id = ep.experiment_id
             LEFT JOIN (
                 SELECT experiment_id, COUNT(DISTINCT stage)::int AS event_count
                 FROM simulation_events
                 WHERE student_id = $1 AND event_type NOT IN ('EXPERIMENT_OPENED', 'PING_FAILED')
                 GROUP BY experiment_id
             ) se ON se.experiment_id = ep.experiment_id
             WHERE ep.student_id = $1
             ORDER BY ep.experiment_id ASC`,
            [user.id]
        );

        const expTotalMilestones = { 1: 3, 2: 4, 3: 4, 4: 4, 5: 5 };

        // Normalize every experiment row against the strict dual-condition invariant:
        // Completed ONLY when (Simulations Complete AND Best Viva Quiz >= 70%)
        const sanitizedExperiments = progressRes.rows.map(r => {
            const expId = r.experiment_id;
            const reqMilestones = expTotalMilestones[expId] || 5;
            const milestones = Array.isArray(r.completed_milestones) ? r.completed_milestones : [];
            const isSimComplete = milestones.length >= reqMilestones || Number(r.event_count) >= reqMilestones;
            const vivaScore = Number(r.score) || 0;
            const isVivaPassed = vivaScore >= 70;

            const isAcademicComplete = isSimComplete && isVivaPassed;

            const status = isAcademicComplete ? 'completed' : 'in_progress';
            const progress_percentage = isAcademicComplete 
                ? 100 
                : Math.min(85, Math.round((milestones.length / reqMilestones) * 85));

            return {
                ...r,
                status,
                progress_percentage,
                isSimComplete,
                isVivaPassed,
                isAcademicComplete,
                score: vivaScore,
                certificate_code: isAcademicComplete ? r.certificate_code : null
            };
        });

        const completedExperiments = sanitizedExperiments
            .filter(r => r.isAcademicComplete)
            .map(r => r.experiment_id);

        const totalExperiments = 5;
        const completedCount = completedExperiments.length;
        const overallPercentage = Math.round((completedCount / totalExperiments) * 100);

        return res.status(200).json({
            student: {
                id: user.id,
                name: studentInfo.full_name || user.fullName,
                registerNumber: studentInfo.register_number || user.registerNumber,
                department: studentInfo.department || user.department,
                section: studentInfo.section || user.section
            },
            completedExperiments,
            experiments: sanitizedExperiments,
            detailedProgress: sanitizedExperiments,
            overall: {
                completed: completedCount,
                total: totalExperiments,
                percentage: overallPercentage
            }
        });
    } catch (error) {
        console.error('Fetch progress error:', error);
        return res.status(500).json({ error: 'Failed to retrieve progress from database.' });
    }
};
