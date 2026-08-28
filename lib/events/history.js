// Observation & Simulation Event History Retrieval Endpoint (GET /api/events/history?experimentId=X)
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

        const experimentId = parseInt(req.query.experimentId || '1', 10);

        // Fetch observations/events recorded for this user and experiment
        const countRes = await query(
            `SELECT 
                COUNT(*)::int AS total_count,
                COUNT(DISTINCT stage) FILTER (WHERE event_type NOT IN ('EXPERIMENT_OPENED', 'PING_FAILED'))::int AS distinct_count
             FROM simulation_events
             WHERE student_id = $1 AND experiment_id = $2`,
            [user.id, experimentId]
        );

        const eventsRes = await query(
            `SELECT stage, event_type, event_payload, created_at
             FROM simulation_events
             WHERE student_id = $1 AND experiment_id = $2
             ORDER BY created_at ASC`,
            [user.id, experimentId]
        );

        const totalDbEvents = countRes.rows[0]?.total_count || 0;
        const distinctStages = countRes.rows[0]?.distinct_count || 0;

        // Map events into structured observation rows
        const observations = eventsRes.rows.map(row => {
            const payload = row.event_payload || {};
            const timeStr = new Date(row.created_at).toLocaleTimeString();
            return {
                time: timeStr,
                moduleName: row.stage || 'Simulation',
                action: payload.action || row.event_type.replace(/_/g, ' '),
                result: payload.result || 'Logged'
            };
        });

        // Fetch latest quiz score and certificate if any
        const certRes = await query(
            `SELECT final_score, certificate_code, issued_at
             FROM certificates
             WHERE student_id = $1 AND experiment_id = $2`,
            [user.id, experimentId]
        );

        const quizRes = await query(
            `SELECT score, total_questions, attempt_number, created_at,
                    ROUND((score::numeric / total_questions) * 100) AS percent
             FROM quiz_attempts
             WHERE student_id = $1 AND experiment_id = $2
             ORDER BY created_at DESC
             LIMIT 1`,
            [user.id, experimentId]
        );

        const progressRes = await query(
            `SELECT status, progress_percentage, completed_milestones, completed_at
             FROM experiment_progress
             WHERE student_id = $1 AND experiment_id = $2`,
            [user.id, experimentId]
        );

        const expTotalReq = { 1: 3, 2: 4, 3: 4, 4: 4, 5: 5, 6: 5 };
        const rawProg = progressRes.rows[0] || { status: 'not_started', progress_percentage: 0, completed_milestones: [] };
        const milestones = Array.isArray(rawProg.completed_milestones) ? rawProg.completed_milestones : [];
        const reqCount = expTotalReq[experimentId] || 5;

        // Pure simulation verification invariant: distinct milestones / stages satisfied
        const isSimComplete = milestones.length >= reqCount || distinctStages >= reqCount;
        const quizPct = quizRes.rows[0] ? (Number(quizRes.rows[0].percent) || 0) : 0;
        const vivaScore = quizPct;
        const isVivaPassed = vivaScore >= 70;
        const isAcademicComplete = isSimComplete && isVivaPassed;

        return res.status(200).json({
            experimentId,
            observations,
            observationCount: totalDbEvents,
            distinctStageCount: distinctStages,
            certificate: certRes.rows[0] || null,
            latestQuiz: quizRes.rows[0] || null,
            isSimComplete,
            isVivaPassed,
            isAcademicComplete,
            progress: {
                ...rawProg,
                status: isAcademicComplete ? 'completed' : 'in_progress',
                progress_percentage: isAcademicComplete ? 100 : (isSimComplete ? 85 : Math.min(85, Math.round((Math.max(milestones.length, distinctStages) / reqCount) * 85))),
                completed_milestones: milestones,
                isSimComplete,
                isVivaPassed,
                isAcademicComplete,
                viva_score: vivaScore
            }
        });
    } catch (error) {
        console.error('Fetch event history error:', error);
        return res.status(500).json({ error: 'Failed to retrieve event history from database.' });
    }
};
