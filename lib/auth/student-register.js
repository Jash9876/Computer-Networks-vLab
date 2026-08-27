// Student Dedicated Registration Handler (POST /api/auth/student/register)
// Invariant: This endpoint strictly and unconditionally assigns role = 'student'
const { query } = require('../db');
const { hashPassword, generateToken, createSessionCookie } = require('../auth-utils');

module.exports = async function handler(req, res) {
    res.setHeader('Content-Type', 'application/json');

    const allowedOrigin = process.env.ALLOWED_ORIGIN || '*';
    res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Credentials', 'true');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    try {
        const { registerNumber, fullName, email, password, department, section } = req.body || {};

        if (!registerNumber || !fullName || !email || !password) {
            return res.status(400).json({ error: 'Please provide Register Number, Full Name, Email, and Password.' });
        }

        const cleanRegNo = registerNumber.trim().toUpperCase();
        const cleanEmail = email.trim().toLowerCase();
        const cleanName = fullName.trim();
        const cleanDept = (department || 'CSE').trim();
        const cleanSection = (section || 'A').trim().toUpperCase();

        if (password.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters.' });
        }

        // Check for existing user
        const existingCheck = await query(
            'SELECT id FROM users WHERE register_number = $1 OR email = $2',
            [cleanRegNo, cleanEmail]
        );

        if (existingCheck.rows.length > 0) {
            return res.status(409).json({ error: 'A student with this Register Number or Email already exists.' });
        }

        const passwordHash = await hashPassword(password);

        // Security Invariant: Public Student Registration ALWAYS forces role = 'student'
        const insertRes = await query(
            `INSERT INTO users (register_number, full_name, email, password_hash, role, department, section)
             VALUES ($1, $2, $3, $4, 'student', $5, $6)
             RETURNING id, register_number, full_name, email, role, department, section, created_at`,
            [cleanRegNo, cleanName, cleanEmail, passwordHash, cleanDept, cleanSection]
        );

        const newUser = insertRes.rows[0];
        const token = generateToken(newUser);

        res.setHeader('Set-Cookie', createSessionCookie(token));

        return res.status(201).json({
            success: true,
            message: 'Student account registered successfully.',
            user: {
                id: newUser.id,
                registerNumber: newUser.register_number,
                fullName: newUser.full_name,
                email: newUser.email,
                role: newUser.role,
                department: newUser.department,
                section: newUser.section
            },
            token
        });
    } catch (error) {
        console.error('Student registration error:', error);
        return res.status(500).json({ error: 'Failed to complete student registration.' });
    }
};
