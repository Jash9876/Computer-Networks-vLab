// Progress Retrieval Endpoint (GET /api/progress/get)
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
        if (!user) {
            return res.status(401).json({ error: 'Unauthorized. Please sign in.' });
        }

        const progressRes = await query(
            `SELECT experiment_id, status, progress_percentage, completed_milestones, completed_at
             FROM experiment_progress
             WHERE student_id = $1
             ORDER BY experiment_id ASC`,
            [user.id]
        );

        const completedExperiments = progressRes.rows
            .filter(r => r.status === 'completed' || r.progress_percentage === 100)
            .map(r => r.experiment_id);

        return res.status(200).json({
            studentId: user.id,
            completedExperiments,
            detailedProgress: progressRes.rows
        });
    } catch (error) {
        console.error('Fetch progress error:', error);
        return res.status(500).json({ error: 'Failed to retrieve progress from database.' });
    }
};
