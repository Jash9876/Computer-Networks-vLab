// Current Session Hydration Endpoint (GET /api/auth/me)
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
        const decodedUser = getUserFromRequest(req);

        if (!decodedUser) {
            return res.status(401).json({ authenticated: false, message: 'No active session.' });
        }

        // Fetch fresh details from DB
        const userRes = await query(
            `SELECT id, register_number, full_name, email, role, department, section, created_at
             FROM users WHERE id = $1`,
            [decodedUser.id]
        );

        if (userRes.rows.length === 0) {
            return res.status(401).json({ authenticated: false, message: 'User account no longer exists.' });
        }

        const user = userRes.rows[0];

        return res.status(200).json({
            authenticated: true,
            user: {
                id: user.id,
                registerNumber: user.register_number,
                fullName: user.full_name,
                email: user.email,
                role: user.role,
                department: user.department,
                section: user.section,
                createdAt: user.created_at
            }
        });
    } catch (error) {
        console.error('Auth verification error:', error);
        return res.status(500).json({ error: 'Session verification failed.' });
    }
};
