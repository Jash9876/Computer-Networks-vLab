// Logout Endpoint (POST /api/auth/logout)
const { clearSessionCookie } = require('../auth-utils');

module.exports = async function handler(req, res) {
    res.setHeader('Content-Type', 'application/json');

    const allowedOrigin = process.env.ALLOWED_ORIGIN || '*';
    res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Credentials', 'true');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Clear session cookie
    res.setHeader('Set-Cookie', clearSessionCookie());

    return res.status(200).json({
        success: true,
        message: 'Logged out successfully.'
    });
};
