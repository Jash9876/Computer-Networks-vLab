// Student and Faculty Login Endpoint (POST /api/auth/login)
const { query } = require('../db');
const { comparePassword, generateToken, createSessionCookie } = require('../auth-utils');

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
        const { identifier, password } = req.body || {};

        if (!identifier || !password) {
            return res.status(400).json({ error: 'Please provide your Register Number / Email and Password.' });
        }

        const cleanIdentifier = identifier.trim();

        // Search by either register number or email
        const userRes = await query(
            `SELECT id, register_number, full_name, email, password_hash, role, department, section
             FROM users 
             WHERE register_number ILIKE $1 OR email ILIKE $1`,
            [cleanIdentifier]
        );

        if (userRes.rows.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials. User not found.' });
        }

        const user = userRes.rows[0];

        // Verify password
        const isMatch = await comparePassword(password, user.password_hash);
        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid credentials. Password incorrect.' });
        }

        // Issue JWT token and HTTP-only cookie
        const token = generateToken(user);
        res.setHeader('Set-Cookie', createSessionCookie(token));

        return res.status(200).json({
            success: true,
            message: 'Login successful.',
            user: {
                id: user.id,
                registerNumber: user.register_number,
                fullName: user.full_name,
                email: user.email,
                role: user.role,
                department: user.department,
                section: user.section
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        return res.status(500).json({ error: 'Login failed due to a server error.' });
    }
};
