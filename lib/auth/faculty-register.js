// Faculty Dedicated Registration Handler (POST /api/auth/faculty/register)
// Invariant: This endpoint requires a valid FACULTY_SECRET to create an institutional faculty account
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
        const { facultyId, fullName, email, password, department, facultySecretKey } = req.body || {};

        if (!facultyId || !fullName || !email || !password || !facultySecretKey) {
            return res.status(400).json({ error: 'Please provide Faculty ID, Full Name, Email, Password, and Faculty Secret Key.' });
        }

        const expectedSecret = process.env.FACULTY_SECRET;
        if (!expectedSecret) {
            return res.status(503).json({ error: 'Faculty registration is currently disabled (FACULTY_SECRET environment variable is not configured).' });
        }

        if (facultySecretKey.trim() !== expectedSecret.trim()) {
            return res.status(403).json({ error: 'Invalid Faculty Authorization Secret Key.' });
        }

        const cleanFacultyId = facultyId.trim().toUpperCase();
        const cleanEmail = email.trim().toLowerCase();
        const cleanName = fullName.trim();
        const cleanDept = (department || 'CSE').trim();

        if (password.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters.' });
        }

        // Check if faculty already exists
        const existingCheck = await query(
            'SELECT id FROM users WHERE register_number = $1 OR email = $2',
            [cleanFacultyId, cleanEmail]
        );

        if (existingCheck.rows.length > 0) {
            return res.status(409).json({ error: 'A faculty account with this ID or Email already exists.' });
        }

        const passwordHash = await hashPassword(password);

        // Insert faculty account
        const insertRes = await query(
            `INSERT INTO users (register_number, full_name, email, password_hash, role, department, section)
             VALUES ($1, $2, $3, $4, 'faculty', $5, 'FACULTY')
             RETURNING id, register_number, full_name, email, role, department, section, created_at`,
            [cleanFacultyId, cleanName, cleanEmail, passwordHash, cleanDept]
        );

        const newFaculty = insertRes.rows[0];
        const token = generateToken(newFaculty);

        res.setHeader('Set-Cookie', createSessionCookie(token));

        return res.status(201).json({
            success: true,
            message: 'Faculty account registered successfully.',
            user: {
                id: newFaculty.id,
                registerNumber: newFaculty.register_number,
                fullName: newFaculty.full_name,
                email: newFaculty.email,
                role: newFaculty.role,
                department: newFaculty.department
            },
            token
        });
    } catch (error) {
        console.error('Faculty registration error:', error);
        return res.status(500).json({ error: 'Failed to complete faculty registration.' });
    }
};
