// Faculty Classroom Detail & Student Academic Matrix (GET /api/faculty/classroom/detail?id=...)
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

    const classroomId = req.query.id;
    if (!classroomId) {
        return res.status(400).json({ error: 'Classroom ID parameter is required.' });
    }

    try {
        // Enforce Server-Side Ownership Check: Faculty can only see classrooms they own
        const classroomRes = await query(
            `SELECT id, classroom_code, name, section, academic_year, status, created_at
             FROM classrooms
             WHERE id = $1 AND faculty_id = $2`,
            [classroomId, user.id]
        );

        if (classroomRes.rows.length === 0) {
            return res.status(404).json({ error: 'Classroom not found or access denied.' });
        }

        const classroom = classroomRes.rows[0];

        // Fetch Enrolled Students with Experiment Progress Matrix
        const studentsRes = await query(
            `SELECT 
                u.id AS student_id,
                u.register_number,
                u.full_name,
                u.email,
                u.section,
                cm.joined_at,
                cm.last_active,
                -- Aggregate Experiments 1-5 Status, Milestones, and Scores
                COALESCE(
                    json_agg(
                        json_build_object(
                            'experiment_id', ep.experiment_id,
                            'status', ep.status,
                            'progress_percentage', ep.progress_percentage,
                            'completed_milestones', ep.completed_milestones,
                            'completed_at', ep.completed_at,
                            'certificate_code', cert.certificate_code,
                            'final_score', COALESCE(cert.final_score, qa.max_percent)
                        )
                    ) FILTER (WHERE ep.experiment_id IS NOT NULL),
                    '[]'
                ) AS experiments_progress
             FROM classroom_members cm
             JOIN users u ON cm.student_id = u.id
             LEFT JOIN experiment_progress ep ON u.id = ep.student_id
             LEFT JOIN certificates cert ON u.id = cert.student_id AND ep.experiment_id = cert.experiment_id
             LEFT JOIN (
                 SELECT student_id, experiment_id, 
                        MAX(CASE WHEN total_questions > 0 THEN ROUND((score::numeric / total_questions) * 100) ELSE score END) AS max_percent
                 FROM quiz_attempts
                 GROUP BY student_id, experiment_id
             ) qa ON qa.student_id = u.id AND qa.experiment_id = ep.experiment_id
             WHERE cm.classroom_id = $1 AND cm.status = 'active'
             GROUP BY u.id, u.register_number, u.full_name, u.email, u.section, cm.joined_at, cm.last_active
             ORDER BY u.register_number ASC`,
            [classroomId]
        );

        const expTotalReq = { 1: 3, 2: 4, 3: 4, 4: 4, 5: 5 };

        // Overall Classroom Stats & Dynamic Progress Sanitization
        const totalStudents = studentsRes.rows.length;
        let totalCompletedExps = 0;

        const sanitizedStudents = studentsRes.rows.map(s => {
            let userCompExps = 0;
            const sanitizedExps = (Array.isArray(s.experiments_progress) ? s.experiments_progress : []).map(ep => {
                const expId = ep.experiment_id;
                const reqCount = expTotalReq[expId] || 5;
                const mCount = Array.isArray(ep.completed_milestones) ? ep.completed_milestones.length : 0;
                const isSimComplete = mCount >= reqCount;
                const vivaScore = typeof ep.final_score === 'number' ? ep.final_score : 0;
                const isVivaPassed = vivaScore >= 70;

                const isAcademicComplete = isSimComplete && isVivaPassed;

                if (isAcademicComplete) {
                    totalCompletedExps++;
                    userCompExps++;
                }

                return {
                    ...ep,
                    status: isAcademicComplete ? 'completed' : 'in_progress',
                    progress_percentage: isAcademicComplete ? 100 : Math.min(85, Math.round((mCount / reqCount) * 85)),
                    isSimComplete,
                    isVivaPassed,
                    isAcademicComplete,
                    certificate_code: isAcademicComplete ? ep.certificate_code : null
                };
            });

            return {
                ...s,
                experiments_progress: sanitizedExps,
                completed_count: userCompExps
            };
        });

        const maxPossibleExps = totalStudents * 5;
        const classCompletionRate = maxPossibleExps > 0 ? Math.round((totalCompletedExps / maxPossibleExps) * 100) : 0;

        return res.status(200).json({
            success: true,
            classroom,
            stats: {
                totalStudents,
                totalCompletedExps,
                classCompletionRate
            },
            students: sanitizedStudents
        });
    } catch (error) {
        console.error('Classroom detail error:', error);
        return res.status(500).json({ error: 'Failed to retrieve classroom details from database.' });
    }
};
