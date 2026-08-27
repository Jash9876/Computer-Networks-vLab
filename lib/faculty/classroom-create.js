// Faculty Classroom Creation Handler (POST /api/faculty/classroom/create)
const { query } = require('../db');
const { extractUserFromRequest } = require('../auth-utils');

function generateClassroomCode(section) {
    const cleanSec = (section || 'CN').replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 4);
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let rand = '';
    for (let i = 0; i < 4; i++) {
        rand += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `${cleanSec || 'CN'}-${rand}`;
}

module.exports = async function handler(req, res) {
    res.setHeader('Content-Type', 'application/json');

    const allowedOrigin = process.env.ALLOWED_ORIGIN || '*';
    res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    const user = extractUserFromRequest(req);
    if (!user || user.role !== 'faculty') {
        return res.status(403).json({ error: 'Unauthorized: Faculty access required.' });
    }

    try {
        const { name, section, academicYear } = req.body || {};
        if (!name || !section) {
            return res.status(400).json({ error: 'Classroom Name and Section are required.' });
        }

        let classroomCode = generateClassroomCode(section);
        let isUnique = false;
        let attempts = 0;

        while (!isUnique && attempts < 5) {
            const check = await query('SELECT id FROM classrooms WHERE classroom_code = $1', [classroomCode]);
            if (check.rows.length === 0) {
                isUnique = true;
            } else {
                classroomCode = generateClassroomCode(section);
                attempts++;
            }
        }

        const insertRes = await query(
            `INSERT INTO classrooms (faculty_id, classroom_code, name, section, academic_year, status)
             VALUES ($1, $2, $3, $4, $5, 'active')
             RETURNING id, faculty_id, classroom_code, name, section, academic_year, status, created_at`,
            [user.id, classroomCode, name.trim(), section.trim().toUpperCase(), (academicYear || '2025-2026').trim()]
        );

        return res.status(201).json({
            success: true,
            classroom: insertRes.rows[0]
        });
    } catch (error) {
        console.error('Create classroom error:', error);
        return res.status(500).json({ error: 'Failed to create classroom in database.' });
    }
};
