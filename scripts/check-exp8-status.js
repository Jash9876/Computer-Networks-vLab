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
const { AUTHORITATIVE_MILESTONES } = require('../lib/events/log.js');

async function test() {
    try {
        const eventsRes = await db.query('SELECT stage, event_type, event_payload, created_at FROM simulation_events WHERE experiment_id = 8 ORDER BY created_at ASC');
        console.log('Total exp 8 events in DB:', eventsRes.rows.length);

        const historyHandler = require('../lib/events/history.js');
        // Let's test with history handler or test resolveMilestone directly
        const logModule = require('../lib/events/log.js');

        // Check students
        const students = await db.query('SELECT DISTINCT student_id FROM simulation_events WHERE experiment_id = 8');
        console.log('Students who ran exp 8:', students.rows);

        for (const s of students.rows) {
            const studentId = s.student_id;
            const events = await db.query('SELECT stage, event_type, event_payload FROM simulation_events WHERE student_id = $1 AND experiment_id = 8', [studentId]);
            
            const cumulativeMilestones = new Set();
            events.rows.forEach(row => {
                const resolved = logModule.resolveMilestoneFromEvent ? 
                    logModule.resolveMilestoneFromEvent(8, row.stage, row.event_type, row.event_payload) : [];
                resolved.forEach(r => cumulativeMilestones.add(r));
            });

            const milestoneList = Array.from(cumulativeMilestones).sort();
            console.log(`Student ${studentId} resolved milestones (${milestoneList.length}/8):`, milestoneList);

            if (milestoneList.length >= 8) {
                // Check quiz
                const quizRes = await db.query(
                    `SELECT score, total_questions FROM quiz_attempts WHERE student_id = $1 AND experiment_id = 8 ORDER BY created_at DESC LIMIT 1`,
                    [studentId]
                );
                let quizPct = 100;
                if (quizRes.rows.length > 0) {
                    const q = quizRes.rows[0];
                    quizPct = q.total_questions > 0 ? Math.round((q.score / q.total_questions) * 100) : q.score;
                }
                const isPassed = quizPct >= 70;

                // Update experiment_progress
                await db.query(
                    `INSERT INTO experiment_progress (student_id, experiment_id, status, progress_percentage, completed_milestones, completed_at, last_activity)
                     VALUES ($1, 8, $2, $3, $4, $5, NOW())
                     ON CONFLICT (student_id, experiment_id) DO UPDATE
                     SET status = EXCLUDED.status,
                         progress_percentage = EXCLUDED.progress_percentage,
                         completed_milestones = EXCLUDED.completed_milestones,
                         completed_at = COALESCE(experiment_progress.completed_at, EXCLUDED.completed_at),
                         last_activity = NOW()`,
                    [
                        studentId,
                        isPassed ? 'completed' : 'in_progress',
                        isPassed ? 100 : 85,
                        JSON.stringify(milestoneList),
                        isPassed ? new Date().toISOString() : null
                    ]
                );
                console.log(`Updated experiment_progress for student ${studentId}: completed = ${isPassed}`);

                // Issue certificate if passed
                if (isPassed) {
                    const existingCert = await db.query(
                        `SELECT certificate_code FROM certificates WHERE student_id = $1 AND experiment_id = 8`,
                        [studentId]
                    );
                    if (existingCert.rows.length === 0) {
                        const studentUser = await db.query(`SELECT register_number FROM users WHERE id = $1`, [studentId]);
                        const regNum = (studentUser.rows[0] && studentUser.rows[0].register_number) || 'USER';
                        const regSuffix = regNum.slice(-4);
                        const certCode = `CNVL-2026-08-${regSuffix}-${Math.floor(1000 + Math.random() * 9000)}`;

                        await db.query(
                            `INSERT INTO certificates (certificate_code, student_id, experiment_id, final_score, issued_at)
                             VALUES ($1, $2, 8, $3, NOW())
                             ON CONFLICT (student_id, experiment_id) DO UPDATE
                             SET final_score = GREATEST(certificates.final_score, EXCLUDED.final_score)`,
                            [certCode, studentId, quizPct]
                        );
                        console.log(`Issued certificate: ${certCode}`);
                    } else {
                        console.log(`Certificate already exists: ${existingCert.rows[0].certificate_code}`);
                    }
                }
            }
        }
    } catch(e) {
        console.error(e);
    } finally {
        process.exit();
    }
}
test();
