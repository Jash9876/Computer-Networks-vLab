// Faculty Student List & Progress Tracker (GET /api/faculty/students)
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

        // Fetch students with aggregate experiment progress
        const studentsRes = await query(
            `SELECT 
                u.id, 
                u.register_number, 
                u.full_name, 
                u.email, 
                u.department, 
                u.section,
                u.created_at,
                COUNT(ep.id) FILTER (WHERE ep.status = 'completed' OR ep.progress_percentage = 100) as completed_experiments_count,
                MAX(ep.last_activity) as last_lab_activity
             FROM users u
             LEFT JOIN experiment_progress ep ON u.id = ep.student_id
             WHERE u.role = 'student'
             GROUP BY u.id, u.register_number, u.full_name, u.email, u.department, u.section, u.created_at
             ORDER BY u.register_number ASC`
        );

        return res.status(200).json({
            students: studentsRes.rows
        });
    } catch (error) {
        console.error('Faculty students error:', error);
        return res.status(500).json({ error: 'Failed to retrieve students list.' });
    }
};
