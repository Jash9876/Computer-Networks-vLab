// Faculty Statistics & Class Analytics Endpoint (GET /api/faculty/stats)
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
        const user = getUserFromRequest(req);

        // Strict Server-Side Role Guard: Must be faculty or admin
        if (!user || (user.role !== 'faculty' && user.role !== 'admin')) {
            return res.status(403).json({ error: 'Access Denied. Faculty privileges required.' });
        }

        // 1. Total Registered Students Count
        const studentsCountRes = await query(
            `SELECT COUNT(*) as total_students FROM users WHERE role = 'student'`
        );
        const totalStudents = parseInt(studentsCountRes.rows[0].total_students) || 0;

        // 2. Experiment Completion Stats
        const expStatsRes = await query(
            `SELECT 
                e.id as experiment_id, 
                e.title,
                COUNT(ep.id) FILTER (WHERE ep.status = 'completed' OR ep.progress_percentage = 100) as completed_count,
                COUNT(ep.id) FILTER (WHERE ep.status = 'in_progress' AND ep.progress_percentage < 100) as in_progress_count
             FROM experiments e
             LEFT JOIN experiment_progress ep ON e.id = ep.experiment_id
             GROUP BY e.id, e.title
             ORDER BY e.id ASC`
        );

        // 3. Quiz Score Averages
        const quizStatsRes = await query(
            `SELECT 
                experiment_id, 
                ROUND(AVG(score * 100.0 / total_questions), 1) as avg_score,
                COUNT(id) as total_attempts
             FROM quiz_attempts
             GROUP BY experiment_id
             ORDER BY experiment_id ASC`
        );

        // 4. Common Error Distribution from simulation_events
        const errorStatsRes = await query(
            `SELECT 
                experiment_id, 
                event_type, 
                COUNT(*) as error_count
             FROM simulation_events
             WHERE event_type IN ('PING_FAILED', 'ROUTING_MISCONFIGURED', 'SUBNET_MISMATCH')
             GROUP BY experiment_id, event_type
             ORDER BY error_count DESC
             LIMIT 10`
        );

        return res.status(200).json({
            facultyUser: {
                fullName: user.fullName,
                email: user.email,
                role: user.role
            },
            overview: {
                totalStudents,
                totalExperiments: 5,
                timestamp: new Date().toISOString()
            },
            experimentCompletions: expStatsRes.rows,
            quizAverages: quizStatsRes.rows,
            commonErrors: errorStatsRes.rows
        });
    } catch (error) {
        console.error('Faculty stats error:', error);
        return res.status(500).json({ error: 'Failed to retrieve faculty analytics.' });
    }
};
