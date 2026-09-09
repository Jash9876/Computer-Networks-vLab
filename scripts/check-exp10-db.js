const fs = require('fs');
const envLines = fs.readFileSync('.env.local', 'utf8').split(/\r?\n/);
for (const line of envLines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const separator = trimmed.indexOf('=');
    if (separator === -1) continue;
    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim().replace(/^['"]|['"]$/g, '');
    if (!process.env[key]) process.env[key] = value;
}
const db = require('../lib/db.js');
async function run() {
    try {
        const users = await db.query('SELECT id, full_name, email, register_number FROM users');
        console.log('Registered users count:', users.rows.length);
        console.log('Users:', users.rows);

        const expEvents = await db.query('SELECT experiment_id, student_id, count(*) FROM simulation_events GROUP BY experiment_id, student_id');
        console.log('Events by experiment & student:', expEvents.rows);

        const expProg = await db.query('SELECT experiment_id, student_id, status, progress_percentage, completed_milestones FROM experiment_progress');
        console.log('All experiment progress rows:', expProg.rows);

        const quizzes = await db.query('SELECT experiment_id, student_id, score, total_questions, attempt_number FROM quiz_attempts');
        console.log('All quiz attempts:', quizzes.rows);

        const certs = await db.query('SELECT experiment_id, student_id, certificate_code, final_score FROM certificates');
        console.log('All certificates:', certs.rows);
    } catch(e) {
        console.error(e);
    }
    process.exit(0);
}
run();

