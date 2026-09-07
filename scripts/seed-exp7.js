const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
    const envLines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
    for (const line of envLines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const separator = trimmed.indexOf('=');
        if (separator === -1) continue;
        const key = trimmed.slice(0, separator).trim();
        let value = trimmed.slice(separator + 1).trim();
        value = value.replace(/^['"]|['"]$/g, '');
        process.env[key] = value;
    }
}

const { query } = require(path.join(__dirname, '..', 'lib', 'db'));

async function seed() {
    try {
        console.log('Connecting to database...');
        const insertSql = `
            INSERT INTO experiments (id, title, aim, total_stages) VALUES
            (7, 'Demonstration of Routing Information Protocol (RIP v1 & RIP v2)', 'To configure and verify classful RIP v1 and classless RIP v2 dynamic routing with VLSM subnets across dual routers.', 5)
            ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, aim = EXCLUDED.aim;
        `;
        await query(insertSql);
        const res = await query('SELECT id, title FROM experiments ORDER BY id;');
        console.log('Experiments successfully verified in DB:');
        console.log(JSON.stringify(res.rows, null, 2));
    } catch(err) {
        console.error('DB Seed Error:', err);
    }
}

seed();
