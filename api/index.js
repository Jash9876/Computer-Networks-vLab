// Unified Single Serverless API Gateway for Vercel Hobby Plan (1 Serverless Function)
const url = require('url');

// Handlers
const healthHandler = require('./health');
const registerHandler = require('./auth/register');
const loginHandler = require('./auth/login');
const meHandler = require('./auth/me');
const logoutHandler = require('./auth/logout');
const progressGetHandler = require('./progress/get');
const eventsLogHandler = require('./events/log');
const quizSubmitHandler = require('./quiz/submit');
const certificateVerifyHandler = require('./certificate/verify');
const facultyStatsHandler = require('./faculty/stats');
const facultyStudentsHandler = require('./faculty/students');
const facultyStudentDetailHandler = require('./faculty/student-detail');

module.exports = async function handler(req, res) {
    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname.replace(/\/$/, ''); // strip trailing slash

    // Polyfill query and body if not present
    req.query = req.query || parsedUrl.query;

    if (req.method === 'POST' && typeof req.body === 'string') {
        try {
            req.body = req.body ? JSON.parse(req.body) : {};
        } catch (e) {
            req.body = {};
        }
    }

    try {
        switch (pathname) {
            case '/api/health':
                return await healthHandler(req, res);

            // Auth
            case '/api/auth/register':
                return await registerHandler(req, res);
            case '/api/auth/login':
                return await loginHandler(req, res);
            case '/api/auth/me':
                return await meHandler(req, res);
            case '/api/auth/logout':
                return await logoutHandler(req, res);

            // Progress & Events
            case '/api/progress/get':
                return await progressGetHandler(req, res);
            case '/api/events/log':
                return await eventsLogHandler(req, res);

            // Quiz & Certificates
            case '/api/quiz/submit':
                return await quizSubmitHandler(req, res);
            case '/api/certificate/verify':
                return await certificateVerifyHandler(req, res);

            // Faculty
            case '/api/faculty/stats':
                return await facultyStatsHandler(req, res);
            case '/api/faculty/students':
                return await facultyStudentsHandler(req, res);
            case '/api/faculty/student-detail':
                return await facultyStudentDetailHandler(req, res);

            default:
                res.status(404).json({ error: `API route not found: ${pathname}` });
        }
    } catch (error) {
        console.error(`[Gateway Error] ${pathname}:`, error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
};
