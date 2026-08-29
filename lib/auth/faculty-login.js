// Faculty Dedicated Login Handler (POST /api/auth/faculty/login)
// Invariant: This endpoint strictly only authenticates users with role = 'faculty' or 'admin'
const db = require('../db');
const { verifyPassword, generateToken, createSessionCookie } = require('../auth-utils');

module.exports = async function handler(req, res) {
    res.setHeader('Content-Type', 'application/json');

    const allowedOrigin = process.env.ALLOWED_ORIGIN || '*';
    res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Credentials', 'true');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    try {
        const { identifier, password } = req.body || {};

        if (!identifier || !password) {
            return res.status(400).json({ error: 'Please provide Faculty ID / Email and Password.' });
        }

        const cleanId = identifier.trim();

        // Query user with faculty or admin role strictly
        const userRes = await db.query(
            `SELECT id, register_number, full_name, email, password_hash, role, department
             FROM users
             WHERE (LOWER(register_number) = LOWER($1) OR LOWER(email) = LOWER($1))`,
            [cleanId]
        );

        if (userRes.rows.length === 0) {
            return res.status(401).json({ error: 'Invalid faculty credentials.' });
        }

        const user = userRes.rows[0];

        // Security check: Bar student accounts from faculty portal
        if (user.role !== 'faculty' && user.role !== 'admin') {
            return res.status(403).json({ error: 'Access Denied: Student accounts cannot access the Faculty Portal. Please use the Student Portal.' });
        }

        const isMatch = await verifyPassword(password, user.password_hash);
        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid faculty credentials.' });
        }

        const token = generateToken(user);
        res.setHeader('Set-Cookie', createSessionCookie(token));

        return res.status(200).json({
            success: true,
            message: 'Faculty login successful.',
            user: {
                id: user.id,
                registerNumber: user.register_number,
                fullName: user.full_name,
                email: user.email,
                role: user.role,
                department: user.department
            },
            token
        });
    } catch (error) {
        console.error('Faculty login error:', error);
        if (error.isDatabaseUnavailable || error.code === 'ECONNREFUSED' || error.message.includes('timeout') || error.message.includes('Connection terminated')) {
            return res.status(503).json({ error: 'Database service is temporarily unavailable. Please retry in a few seconds.' });
        }
        return res.status(500).json({ error: 'Internal server error during faculty login.' });
    }
};
