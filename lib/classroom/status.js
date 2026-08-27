// Student Classroom Status Check (GET /api/classroom/status)
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
    if (!user) {
        return res.status(401).json({ error: 'Unauthorized.' });
    }

    try {
        const memberRes = await query(
            `SELECT cm.classroom_id, cm.status, cm.joined_at,
                    c.classroom_code, c.name, c.section, c.academic_year,
                    u.full_name AS faculty_name
             FROM classroom_members cm
             JOIN classrooms c ON cm.classroom_id = c.id
             JOIN users u ON c.faculty_id = u.id
             WHERE cm.student_id = $1 AND cm.status = 'active'
             ORDER BY cm.joined_at DESC
             LIMIT 1`,
            [user.id]
        );

        if (memberRes.rows.length === 0) {
            return res.status(200).json({
                enrolled: false,
                classroom: null
            });
        }

        return res.status(200).json({
            enrolled: true,
            classroom: memberRes.rows[0]
        });
    } catch (error) {
        console.error('Classroom status error:', error);
        return res.status(500).json({ error: 'Failed to check classroom status.' });
    }
};
