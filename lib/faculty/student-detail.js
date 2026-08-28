// Faculty Single Student Detail & Educational Activity Timeline (GET /api/faculty/student-detail?id=UUID)
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

        // Strict Server-Side Role Guard
        if (!user || (user.role !== 'faculty' && user.role !== 'admin')) {
            return res.status(403).json({ error: 'Access Denied. Faculty privileges required.' });
        }

        const studentId = req.query.id;
        if (!studentId) {
            return res.status(400).json({ error: 'Student ID query parameter (?id=...) is required.' });
        }

        // 1. Fetch Student Profile
        const studentRes = await query(
            `SELECT id, register_number, full_name, email, department, section, created_at
             FROM users WHERE id = $1 AND role = 'student'`,
            [studentId]
        );

        if (studentRes.rows.length === 0) {
            return res.status(404).json({ error: 'Student not found.' });
        }

        const student = studentRes.rows[0];

        // 2. Fetch Detailed Progress across all 5 experiments
        // 2. Fetch Detailed Progress across all 5 experiments (with event counts and certificates)
        const progRes = await query(
            `SELECT 
                e.id as experiment_id,
                e.title,
                COALESCE(ep.status, 'not_started') as status,
                COALESCE(ep.progress_percentage, 0) as progress_percentage,
                ep.completed_milestones,
                ep.started_at,
                ep.last_activity,
                ep.completed_at,
                c.certificate_code,
                c.final_score as cert_score,
                COALESCE(se.event_count, 0) AS event_count
             FROM experiments e
             LEFT JOIN experiment_progress ep ON e.id = ep.experiment_id AND ep.student_id = $1
             LEFT JOIN certificates c ON c.student_id = $1 AND c.experiment_id = e.id
             LEFT JOIN (
                 SELECT experiment_id, COUNT(DISTINCT stage)::int AS event_count
                 FROM simulation_events
                 WHERE student_id = $1 AND event_type NOT IN ('EXPERIMENT_OPENED', 'PING_FAILED')
                 GROUP BY experiment_id
             ) se ON se.experiment_id = e.id
             ORDER BY e.id ASC`,
            [studentId]
        );

        // 3. Fetch Educational Activity Timeline
        const eventsRes = await query(
            `SELECT stage, event_type, event_payload, created_at, experiment_id
             FROM simulation_events
             WHERE student_id = $1
             ORDER BY created_at DESC
             LIMIT 50`,
            [studentId]
        );

        // 4. Fetch Quiz Records & Compute Best Scores
        const quizRes = await query(
            `SELECT experiment_id, attempt_number, score, total_questions, created_at,
                    ROUND((score::numeric / total_questions) * 100) AS percent
             FROM quiz_attempts
             WHERE student_id = $1
             ORDER BY created_at DESC`,
            [studentId]
        );

        const bestQuizMap = {};
        quizRes.rows.forEach(q => {
            const expId = q.experiment_id;
            const pct = Number(q.percent) || 0;
            if (!bestQuizMap[expId] || pct > bestQuizMap[expId]) {
                bestQuizMap[expId] = pct;
            }
        });

        const expTotalReq = { 1: 3, 2: 4, 3: 4, 4: 4, 5: 5, 6: 5 };
        const sanitizedProgress = progRes.rows.map(p => {
            const expId = p.experiment_id;
            const reqCount = expTotalReq[expId] || 5;
            const mCount = Array.isArray(p.completed_milestones) ? p.completed_milestones.length : 0;
            const eventCount = Number(p.event_count) || 0;
            const isSimComplete = mCount >= reqCount;
            const vivaScore = p.cert_score !== null && p.cert_score !== undefined ? Number(p.cert_score) : (bestQuizMap[expId] || 0);
            const isVivaPassed = vivaScore >= 70;

            const isAcademicComplete = isSimComplete && isVivaPassed;

            return {
                ...p,
                status: isAcademicComplete ? 'completed' : 'in_progress',
                progress_percentage: isAcademicComplete ? 100 : (isSimComplete ? 85 : Math.min(85, Math.round((mCount / reqCount) * 85))),
                isSimComplete,
                isVivaPassed,
                isAcademicComplete,
                viva_score: vivaScore,
                event_count: eventCount
            };
        });

        return res.status(200).json({
            student,
            progress: sanitizedProgress,
            activityTimeline: eventsRes.rows,
            quizHistory: quizRes.rows
        });
    } catch (error) {
        console.error('Faculty student detail error:', error);
        return res.status(500).json({ error: 'Failed to retrieve student details.' });
    }
};
