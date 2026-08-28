// Milestone Verification & Event Logging Endpoint (POST /api/events/log)
const { getUserFromRequest } = require('../auth-utils');
const { query } = require('../db');

// Allowed meaningful educational event types
const VALID_EVENT_TYPES = [
    'EXPERIMENT_OPENED',
    'ADDRESSING_MATCHED',
    'SUBNET_IDENTIFIED',
    'HARDWARE_INSTALLED',
    'TOPOLOGY_VALIDATED',
    'STATIC_ROUTE_CONFIGURED',
    'DEFAULT_ROUTE_CONFIGURED',
    'CLI_COMMAND_EXECUTED',
    'PING_ATTEMPTED',
    'PING_FAILED',
    'PING_SUCCESS',
    'TRACEROUTE_EXECUTED',
    'QUIZ_SUBMITTED',
    'EXPERIMENT_COMPLETED'
];

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
            // Unauthenticated guest events are discarded cleanly without crashing
            return res.status(200).json({ status: 'guest_untracked' });
        }

        const { experimentId, stage, eventType, payload } = req.body || {};

        if (!experimentId || !stage || !eventType) {
            return res.status(400).json({ error: 'Missing required event fields: experimentId, stage, eventType.' });
        }

        // Validate event against whitelist to reject noisy / spam events
        if (!VALID_EVENT_TYPES.includes(eventType)) {
            return res.status(400).json({ error: `Event type "${eventType}" is not a recognized milestone event.` });
        }

        // 1. Insert into simulation_events
        await query(
            `INSERT INTO simulation_events (student_id, experiment_id, stage, event_type, event_payload)
             VALUES ($1, $2, $3, $4, $5)`,
            [user.id, parseInt(experimentId), String(stage), eventType, JSON.stringify(payload || {})]
        );

        // 2. Fetch or initialize experiment_progress
        const progRes = await query(
            `SELECT progress_percentage, completed_milestones
             FROM experiment_progress
             WHERE student_id = $1 AND experiment_id = $2`,
            [user.id, parseInt(experimentId)]
        );

        let milestones = [];
        if (progRes.rows.length > 0 && progRes.rows[0].completed_milestones) {
            milestones = progRes.rows[0].completed_milestones;
        }

        const milestoneKey = `${stage}:${eventType}`;
        if (!milestones.includes(milestoneKey)) {
            milestones.push(milestoneKey);
        }

        // Recalculate simulation progress based on verified milestones
        // Exp 1: 3 milestones, Exp 2: 4, Exp 3: 4, Exp 4: 4, Exp 5: 5, Exp 6: 5
        const expTotalMilestones = { 1: 3, 2: 4, 3: 4, 4: 4, 5: 5, 6: 5 };
        const totalReq = expTotalMilestones[experimentId] || 5;
        const simProgress = Math.min(100, Math.round((milestones.length / totalReq) * 100));

        // Check if student has already passed the viva quiz with >= 70%
        const quizRes = await query(
            `SELECT certificate_code, final_score FROM certificates WHERE student_id = $1 AND experiment_id = $2`,
            [user.id, parseInt(experimentId)]
        );
        const hasPassedQuiz = quizRes.rows.length > 0 && quizRes.rows[0].final_score >= 70;
        const isSimComplete = milestones.length >= totalReq;

        // Authoritative Academic Invariant: Completed ONLY when (Simulations Complete AND Quiz Passed >= 70%)
        const isAcademicComplete = isSimComplete && hasPassedQuiz;
        const status = isAcademicComplete ? 'completed' : 'in_progress';
        const finalProgressPercentage = isAcademicComplete ? 100 : Math.min(85, Math.round(simProgress * 0.85));

        await query(
            `INSERT INTO experiment_progress (student_id, experiment_id, status, progress_percentage, completed_milestones, completed_at, last_activity)
             VALUES ($1, $2, $3, $4, $5, $6, NOW())
             ON CONFLICT (student_id, experiment_id) DO UPDATE
             SET status = $3,
                 progress_percentage = $4,
                 completed_milestones = $5,
                 completed_at = CASE WHEN $3 = 'completed' THEN COALESCE(experiment_progress.completed_at, NOW()) ELSE NULL END,
                 last_activity = NOW()`,
            [user.id, parseInt(experimentId), status, finalProgressPercentage, JSON.stringify(milestones), isAcademicComplete ? new Date() : null]
        );

        return res.status(200).json({
            success: true,
            experimentId: parseInt(experimentId),
            recordedEvent: eventType,
            progressPercentage: finalProgressPercentage,
            status,
            isSimComplete,
            hasPassedQuiz,
            isAcademicComplete
        });
    } catch (error) {
        console.error('Record event error:', error);
        return res.status(500).json({ error: 'Failed to record simulation event.' });
    }
};
