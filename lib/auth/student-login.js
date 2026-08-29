// Student Dedicated Login Handler (POST /api/auth/student/login)
// Invariant: This endpoint only authenticates users with role = 'student'
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
            return res.status(400).json({ error: 'Please provide Register Number/Email and Password.' });
        }

        const cleanId = identifier.trim();

        // Query user with student role strictly
        const userRes = await db.query(
            `SELECT id, register_number, full_name, email, password_hash, role, department, section
             FROM users
             WHERE (LOWER(register_number) = LOWER($1) OR LOWER(email) = LOWER($1))`,
            [cleanId]
        );

        if (userRes.rows.length === 0) {
            return res.status(401).json({ error: 'Invalid student credentials.' });
        }

        const user = userRes.rows[0];

        // Security check: Bar faculty accounts from student login portal
        if (user.role === 'faculty') {
            return res.status(403).json({ error: 'Faculty account detected. Please use the dedicated Faculty Portal to sign in.' });
        }

        const isMatch = await verifyPassword(password, user.password_hash);
        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid student credentials.' });
        }

        const token = generateToken(user);
        res.setHeader('Set-Cookie', createSessionCookie(token));

        return res.status(200).json({
            success: true,
            message: 'Student login successful.',
            user: {
                id: user.id,
                registerNumber: user.register_number,
                fullName: user.full_name,
                email: user.email,
                role: user.role,
                department: user.department,
                section: user.section
            },
            token
        });
    } catch (error) {
        console.error('Student login error:', error);
        if (error.isDatabaseUnavailable || error.code === 'ECONNREFUSED' || error.message.includes('timeout') || error.message.includes('Connection terminated')) {
            return res.status(503).json({ error: 'Database service is temporarily unavailable. Please retry in a few seconds.' });
        }
        return res.status(500).json({ error: 'Internal server error during login.' });
    }
};
