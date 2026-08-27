// Local Development Server bridging static HTML and Serverless APIs in /api/*
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = process.env.PORT || 3000;
const ROOT_DIR = path.resolve(__dirname);

// MIME types lookup
const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.pdf': 'application/pdf'
};

const server = http.createServer(async (req, res) => {
    const parsedUrl = url.parse(req.url, true);
    let pathname = parsedUrl.pathname;

    // 1. API Route Handler (Emulates Vercel Serverless Functions)
    if (pathname.startsWith('/api/')) {
        const apiRelativePath = pathname.replace(/^\/api\//, '');
        const apiFilePath = path.join(ROOT_DIR, 'api', `${apiRelativePath}.js`);
        const apiIndexPath = path.join(ROOT_DIR, 'api', apiRelativePath, 'index.js');

        let targetModule = null;
        if (fs.existsSync(apiFilePath)) {
            targetModule = apiFilePath;
        } else if (fs.existsSync(apiIndexPath)) {
            targetModule = apiIndexPath;
        }

        if (targetModule) {
            try {
                // Collect request body
                let bodyData = '';
                for await (const chunk of req) {
                    bodyData += chunk;
                }

                req.body = bodyData ? JSON.parse(bodyData) : {};
                req.query = parsedUrl.query;

                // Polyfill status helper for Vercel functions
                res.status = function (code) {
                    res.statusCode = code;
                    return res;
                };
                res.json = function (obj) {
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify(obj));
                };

                // Clear require cache for live reload
                delete require.cache[require.resolve(targetModule)];
                const handler = require(targetModule);
                return await handler(req, res);
            } catch (err) {
                console.error(`[API Error] ${pathname}:`, err);
                res.statusCode = 500;
                res.setHeader('Content-Type', 'application/json');
                return res.end(JSON.stringify({ error: err.message || 'Internal Server Error' }));
            }
        } else {
            res.statusCode = 404;
            res.setHeader('Content-Type', 'application/json');
            return res.end(JSON.stringify({ error: `API endpoint not found: ${pathname}` }));
        }
    }

    // 2. Static File Serving
    if (pathname === '/' || pathname === '') {
        pathname = '/index.html';
    }

    const filePath = path.join(ROOT_DIR, pathname);

    fs.stat(filePath, (err, stats) => {
        if (err || !stats.isFile()) {
            res.statusCode = 404;
            res.setHeader('Content-Type', 'text/html');
            return res.end(`<h1>404 Not Found</h1><p>The requested path <code>${pathname}</code> was not found.</p>`);
        }

        const ext = path.extname(filePath).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';

        res.statusCode = 200;
        res.setHeader('Content-Type', contentType);

        const stream = fs.createReadStream(filePath);
        stream.pipe(res);
    });
});

server.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(`🚀 Computer Networks Virtual Lab (SRMIST) is running!`);
    console.log(`🌐 URL: http://localhost:${PORT}`);
    console.log(`🔑 Landing Portal:  http://localhost:${PORT}/index.html`);
    console.log(`📊 Student Hub:     http://localhost:${PORT}/dashboard.html`);
    console.log(`👩‍🏫 Faculty Hub:     http://localhost:${PORT}/faculty.html`);
    console.log(`🩺 Health API:      http://localhost:${PORT}/api/health`);
    console.log(`====================================================`);
});
