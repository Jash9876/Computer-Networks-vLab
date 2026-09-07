// test-db.js - Validate local database connection using lib/db.js
const fs = require('fs');
const path = require('path');

// Auto-load .env.local if present
const envLocalPath = path.join(__dirname, '.env.local');
if (fs.existsSync(envLocalPath)) {
    const envContent = fs.readFileSync(envLocalPath, 'utf8');
    for (const line of envContent.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx > 0) {
            const key = trimmed.slice(0, eqIdx).trim();
            let val = trimmed.slice(eqIdx + 1).trim();
            if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
                val = val.slice(1, -1);
            }
            if (!process.env[key]) process.env[key] = val;
        }
    }
}

const { query } = require('./lib/db');

async function testConnection() {
    try {
        const res = await query('SELECT NOW() as current_time, version() as pg_version');
        console.log('✅ Database connected successfully:');
        console.log('Timestamp:', res.rows[0].current_time);
        console.log('PG Version:', res.rows[0].pg_version.split(',')[0]);
        process.exit(0);
    } catch (err) {
        console.error('❌ Database connection failed:', err.message);
        process.exit(1);
    }
}

testConnection();
