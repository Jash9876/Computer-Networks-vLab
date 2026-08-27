// Student Join Classroom Handler (POST /api/classroom/join)
const { query } = require('../db');
const { extractUserFromRequest } = require('../auth-utils');

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
    if (!user) {
        return res.status(401).json({ error: 'Please log in to join a classroom.' });
    }

    try {
        const { classroomCode } = req.body || {};
        if (!classroomCode) {
            return res.status(400).json({ error: 'Please enter a valid classroom code.' });
        }

        const cleanCode = classroomCode.trim().toUpperCase();

        // 1. Verify Classroom Exists and is Active
        const classRes = await query(
            `SELECT c.id, c.classroom_code, c.name, c.section, c.status, u.full_name AS faculty_name
             FROM classrooms c
             JOIN users u ON c.faculty_id = u.id
             WHERE c.classroom_code = $1`,
            [cleanCode]
        );

        if (classRes.rows.length === 0) {
            return res.status(404).json({ error: 'Classroom code not found. Please verify the code with your faculty.' });
        }

        const classroom = classRes.rows[0];
        if (classroom.status !== 'active') {
            return res.status(403).json({ error: 'This classroom is archived or no longer accepting new enrollments.' });
        }

        // 2. Enforce Exactly One Active Classroom per Student
        // Archive previous active memberships before activating new one
        await query(
            `UPDATE classroom_members 
             SET status = 'transferred', left_at = NOW() 
             WHERE student_id = $1 AND classroom_id != $2 AND status = 'active'`,
            [user.id, classroom.id]
        );

        // 3. Enroll Student into Target Classroom (Lifecycle upsert preserving history)
        await query(
            `INSERT INTO classroom_members (classroom_id, student_id, status, joined_at, last_active)
             VALUES ($1, $2, 'active', NOW(), NOW())
             ON CONFLICT (classroom_id, student_id) DO UPDATE
             SET status = 'active', left_at = NULL, last_active = NOW()`,
            [classroom.id, user.id]
        );

        return res.status(200).json({
            success: true,
            message: `Successfully joined ${classroom.name} (${classroom.section})!`,
            classroom: {
                id: classroom.id,
                code: classroom.classroom_code,
                name: classroom.name,
                section: classroom.section,
                facultyName: classroom.faculty_name
            }
        });
    } catch (error) {
        console.error('Join classroom error:', error);
        return res.status(500).json({ error: 'Failed to join classroom in database.' });
    }
};
