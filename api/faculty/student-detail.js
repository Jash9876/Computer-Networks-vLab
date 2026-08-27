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
        const progRes = await query(
            `SELECT 
                e.id as experiment_id,
                e.title,
                COALESCE(ep.status, 'not_started') as status,
                COALESCE(ep.progress_percentage, 0) as progress_percentage,
                ep.completed_milestones,
                ep.started_at,
                ep.last_activity,
                ep.completed_at
             FROM experiments e
             LEFT JOIN experiment_progress ep ON e.id = ep.experiment_id AND ep.student_id = $1
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

        // 4. Fetch Quiz Records
        const quizRes = await query(
            `SELECT experiment_id, attempt_number, score, total_questions, created_at
             FROM quiz_attempts
             WHERE student_id = $1
             ORDER BY created_at DESC`,
            [studentId]
        );

        return res.status(200).json({
            student,
            progress: progRes.rows,
            activityTimeline: eventsRes.rows,
            quizHistory: quizRes.rows
        });
    } catch (error) {
        console.error('Faculty student detail error:', error);
        return res.status(500).json({ error: 'Failed to retrieve student details.' });
    }
};
