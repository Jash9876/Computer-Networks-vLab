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
        console.log('Connecting to database and seeding Experiment 8...');
        const insertSql = `
            INSERT INTO experiments (id, title, aim, total_stages, is_active)
            VALUES (8, 'Single Area & Multi-Area OSPF Configuration', 'Configuration of Single Area and Multi-Area OSPF in Cisco Packet Tracer', 8, true)
            ON CONFLICT (id) DO UPDATE
            SET title = EXCLUDED.title, aim = EXCLUDED.aim, total_stages = EXCLUDED.total_stages, is_active = EXCLUDED.is_active;
        `;
        await query(insertSql);
        const res = await query('SELECT id, title FROM experiments ORDER BY id;');
        console.log('Experiments successfully verified in DB:');
        console.log(JSON.stringify(res.rows, null, 2));
    } catch (err) {
        console.error('DB Seed Error:', err);
    }
}

seed();
