// Faculty Classroom List Handler (GET /api/faculty/classroom/list)
const { query } = require('../db');
const { extractUserFromRequest } = require('../auth-utils');

module.exports = async function handler(req, res) {
    res.setHeader('Content-Type', 'application/json');

    const allowedOrigin = process.env.ALLOWED_ORIGIN || '*';
    res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method Not Allowed' });

    const user = extractUserFromRequest(req);
    if (!user || user.role !== 'faculty') {
        return res.status(403).json({ error: 'Unauthorized: Faculty access required.' });
    }

    try {
        const classroomsRes = await query(
            `SELECT c.id, c.classroom_code, c.name, c.section, c.academic_year, c.status, c.created_at,
                    COUNT(cm.id)::int AS student_count
             FROM classrooms c
             LEFT JOIN classroom_members cm ON c.id = cm.classroom_id AND cm.status = 'active'
             WHERE c.faculty_id = $1
             GROUP BY c.id
             ORDER BY c.created_at DESC`,
            [user.id]
        );

        return res.status(200).json({
            success: true,
            classrooms: classroomsRes.rows
        });
    } catch (error) {
        console.error('List classrooms error:', error);
        return res.status(500).json({ error: 'Failed to retrieve classrooms from database.' });
    }
};
