// Health check and database connectivity endpoint for Vercel
const { query, initSchema } = require('./db');

module.exports = async function handler(req, res) {
    res.setHeader('Content-Type', 'application/json');

    const allowedOrigin = process.env.ALLOWED_ORIGIN || '*';
    res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Credentials', 'true');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const timestamp = new Date().toISOString();

    try {
        // Check if database URL is configured
        const hasDbUrl = Boolean(process.env.DATABASE_URL || process.env.POSTGRES_URL);

        if (!hasDbUrl) {
            return res.status(200).json({
                status: 'operational_offline',
                message: 'Vercel serverless API is online. DATABASE_URL environment variable is pending configuration.',
                timestamp,
                database: 'disconnected',
                experiments: [1, 2, 3, 4, 5]
            });
        }

        // Test database query
        const dbRes = await query('SELECT NOW() as current_time, version() as pg_version');
        
        // Schema initialization guarded by ADMIN_SECRET header or query
        let schemaStatus = 'unchanged';
        const adminSecret = process.env.ADMIN_SECRET || 'vlab_admin_secret_2026';
        if (req.query && req.query.init === 'true' && req.headers['x-admin-secret'] === adminSecret) {
            await initSchema();
            schemaStatus = 'initialized_or_verified';
        }

        return res.status(200).json({
            status: 'operational_online',
            message: 'Virtual Laboratory backend is operational.',
            timestamp,
            database: {
                connected: true,
                currentTime: dbRes.rows[0].current_time,
                pgVersion: dbRes.rows[0].pg_version.split(',')[0],
                schema: schemaStatus
            },
            institution: 'SRM Institute of Science and Technology',
            experimentsAvailable: 6
        });
    } catch (error) {
        // Log detailed error internally on the server, never leak stack/details publicly
        console.error('Health check database error:', error);
        return res.status(500).json({
            status: 'degraded',
            message: 'Serverless API is online, but database connection encountered an issue.',
            timestamp
        });
    }
};
