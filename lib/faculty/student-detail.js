// Faculty Single Student Detail & Educational Activity Timeline (GET /api/faculty/student-detail?id=UUID)
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

        // Strict Server-Side Role Guard
        if (!user || (user.role !== 'faculty' && user.role !== 'admin')) {
            return res.status(403).json({ error: 'Access Denied. Faculty privileges required.' });
        }

        const studentId = req.query.id;
        if (!studentId) {
            return res.status(400).json({ error: 'Student ID query parameter (?id=...) is required.' });
        }

        // 1. Fetch Student Profile
        const studentRes = await query(
            `SELECT id, register_number, full_name, email, department, section, created_at
             FROM users WHERE id = $1 AND role = 'student'`,
            [studentId]
        );

        if (studentRes.rows.length === 0) {
            return res.status(404).json({ error: 'Student not found.' });
        }

        const student = studentRes.rows[0];

        // 2. Fetch Detailed Progress across all 5 experiments
        // 2. Fetch Detailed Progress across all 5 experiments (with event counts and certificates)
        const progRes = await query(
            `SELECT 
                e.id as experiment_id,
                e.title,
                COALESCE(ep.status, 'not_started') as status,
                COALESCE(ep.progress_percentage, 0) as progress_percentage,
                ep.completed_milestones,
                ep.started_at,
                ep.last_activity,
                ep.completed_at,
                c.certificate_code,
                c.final_score as cert_score,
                COALESCE(se.event_count, 0) AS event_count
             FROM experiments e
             LEFT JOIN experiment_progress ep ON e.id = ep.experiment_id AND ep.student_id = $1
             LEFT JOIN certificates c ON c.student_id = $1 AND c.experiment_id = e.id
             LEFT JOIN (
                 SELECT experiment_id, COUNT(DISTINCT stage)::int AS event_count
                 FROM simulation_events
                 WHERE student_id = $1 AND event_type NOT IN ('EXPERIMENT_OPENED', 'PING_FAILED')
                 GROUP BY experiment_id
             ) se ON se.experiment_id = e.id
             ORDER BY e.id ASC`,
            [studentId]
        );

        // 3. Fetch Educational Activity Timeline
        const eventsRes = await query(
            `SELECT stage, event_type, event_payload, created_at, experiment_id
             FROM simulation_events
             WHERE student_id = $1
             ORDER BY created_at DESC
             LIMIT 50`,
            [studentId]
        );

        // 4. Fetch Quiz Records & Compute Best Scores
        const quizRes = await query(
            `SELECT experiment_id, attempt_number, score, total_questions, created_at,
                    ROUND((score::numeric / total_questions) * 100) AS percent
             FROM quiz_attempts
             WHERE student_id = $1
             ORDER BY created_at DESC`,
            [studentId]
        );

        const bestQuizMap = {};
        quizRes.rows.forEach(q => {
            const expId = q.experiment_id;
            const pct = Number(q.percent) || 0;
            if (!bestQuizMap[expId] || pct > bestQuizMap[expId]) {
                bestQuizMap[expId] = pct;
            }
        });

        const AUTHORITATIVE_MILESTONES = {
            1: ['CABLES_STUDIED', 'COMMANDS_EXECUTED', 'PT_UI_EXPLORED'],
            2: ['IPV4_CONFIGURED', 'SUBNET_CALCULATED', 'PINOUT_CRIMPED', 'CABLE_TESTED'],
            3: ['CONSOLE_CONNECTED', 'TERMINAL_CONFIGURED', 'HOSTNAME_SET', 'INTERFACES_CONFIGURED'],
            4: ['SUBNET_DESIGNED', 'TOPOLOGY_WIRED', 'ROUTER_CONFIGURED', 'PING_VERIFIED'],
            5: ['TOPOLOGY_CONFIGURED', 'STATIC_ROUTE_R0', 'STATIC_ROUTE_R1', 'DEFAULT_ROUTE_SET', 'CONNECTIVITY_VERIFIED'],
            6: ['6A_TOPOLOGY_IP', '6A_STATIC_NAT', '6A_NAT_VERIFY', '6B_DYN_NAT_CFG', '6B_DYN_NAT_VERIFY']
        };

        function resolveMilestone(expId, stage, eventType, payload) {
            if (!payload || typeof payload !== 'object') payload = {};
            const act = String(payload.action || '');
            const stg = String(stage || '');
            const res = [];

            if (act.startsWith('Milestone:')) {
                const id = act.replace('Milestone:', '').trim();
                if (AUTHORITATIVE_MILESTONES[expId]?.includes(id)) return [id];
            }
            if (AUTHORITATIVE_MILESTONES[expId]?.includes(stg)) return [stg];

            switch (expId) {
                case 1:
                    if (stg.includes('Cable') || eventType === 'ADDRESSING_MATCHED') res.push('CABLES_STUDIED');
                    if (stg.includes('Command Simulator') || eventType === 'PING_SUCCESS' || eventType === 'TRACEROUTE_EXECUTED') res.push('COMMANDS_EXECUTED');
                    if (stg.includes('Packet Tracer Explorer')) res.push('PT_UI_EXPLORED');
                    break;
                case 2:
                    if (stg.includes('IP Config') || eventType === 'ADDRESSING_MATCHED') res.push('IPV4_CONFIGURED');
                    if (stg.includes('Subnet') || stg.includes('Addressing Match') || stg.includes('IP Config')) res.push('SUBNET_CALCULATED');
                    if (stg.includes('Pinout Builder')) res.push('PINOUT_CRIMPED');
                    if (stg.includes('Pinout Checker') || stg.includes('Cable Connectivity') || (stg.includes('Ping') && eventType === 'PING_SUCCESS')) res.push('CABLE_TESTED');
                    break;
                case 3:
                    if (stg.includes('Topology Builder') || stg.includes('Console Connection')) res.push('CONSOLE_CONNECTED');
                    if (stg.includes('Terminal Setup') || act.toLowerCase().includes('terminal') || stg.includes('Router CLI')) res.push('TERMINAL_CONFIGURED');
                    if (stg.includes('Hostname') || act.toLowerCase().includes('hostname') || stg.includes('Router CLI')) res.push('HOSTNAME_SET');
                    if (stg.includes('Router CLI') || stg.includes('Interface') || eventType === 'ADDRESSING_MATCHED') res.push('INTERFACES_CONFIGURED');
                    break;
                case 4:
                    if (stg.includes('Subnet') || stg.includes('Addressing') || stg.includes('IP Config')) res.push('SUBNET_DESIGNED');
                    if (stg.includes('Topology') || stg.includes('Cabling')) res.push('TOPOLOGY_WIRED');
                    if (stg.includes('Router CLI') || stg.includes('IP Config')) res.push('ROUTER_CONFIGURED');
                    if (stg.includes('Ping') || eventType === 'PING_SUCCESS') res.push('PING_VERIFIED');
                    break;
                case 5:
                    if (stg.includes('Addressing Match') || stg.includes('Hardware Module') || stg.includes('Topology Builder')) res.push('TOPOLOGY_CONFIGURED');
                    if (stg.includes('Static Routing')) {
                        res.push('STATIC_ROUTE_R0');
                        res.push('STATIC_ROUTE_R1');
                    }
                    if (stg.includes('Default Routing') || eventType === 'DEFAULT_ROUTE_CONFIGURED') res.push('DEFAULT_ROUTE_SET');
                    if (stg.includes('Traceroute') || stg.includes('Packet Journey') || eventType === 'TRACEROUTE_EXECUTED') res.push('CONNECTIVITY_VERIFIED');
                    break;
            }
            const validList = AUTHORITATIVE_MILESTONES[expId] || [];
            return res.filter(m => validList.includes(m));
        }

        // Fetch all simulation events for this student
        const allSimEvents = await query(
            `SELECT experiment_id, stage, event_type, event_payload FROM simulation_events WHERE student_id = $1`,
            [studentId]
        );
        const eventsByExp = {};
        allSimEvents.rows.forEach(e => {
            if (!eventsByExp[e.experiment_id]) eventsByExp[e.experiment_id] = [];
            eventsByExp[e.experiment_id].push(e);
        });

        const sanitizedProgress = progRes.rows.map(p => {
            const expId = p.experiment_id;
            const validList = AUTHORITATIVE_MILESTONES[expId] || [];
            const reqCount = validList.length || 5;

            const cumulative = new Set();
            (Array.isArray(p.completed_milestones) ? p.completed_milestones : []).forEach(m => {
                const resolved = resolveMilestone(expId, m.split(':')[0], m.split(':')[1], {});
                resolved.forEach(item => cumulative.add(item));
                if (validList.includes(m)) cumulative.add(m);
            });

            (eventsByExp[expId] || []).forEach(e => {
                const resolved = resolveMilestone(expId, e.stage, e.event_type, e.event_payload);
                resolved.forEach(item => cumulative.add(item));
            });

            const milestones = Array.from(cumulative).filter(m => validList.includes(m));
            const mCount = milestones.length;
            const eventCount = Number(p.event_count) || 0;
            const isSimComplete = mCount >= reqCount;
            const vivaScore = p.cert_score !== null && p.cert_score !== undefined ? Number(p.cert_score) : (bestQuizMap[expId] || 0);
            const isVivaPassed = vivaScore >= 70;

            const isAcademicComplete = isSimComplete && isVivaPassed;

            return {
                ...p,
                status: isAcademicComplete ? 'completed' : (mCount > 0 || p.started_at ? 'in_progress' : 'not_started'),
                progress_percentage: isAcademicComplete ? 100 : (isSimComplete ? 85 : Math.min(85, Math.round((mCount / reqCount) * 85))),
                completed_milestones: milestones,
                isSimComplete,
                isVivaPassed,
                isAcademicComplete,
                viva_score: vivaScore,
                event_count: eventCount,
                certificate_code: isAcademicComplete ? p.certificate_code : null
            };
        });

        return res.status(200).json({
            student,
            progress: sanitizedProgress,
            activityTimeline: eventsRes.rows,
            quizHistory: quizRes.rows
        });
    } catch (error) {
        console.error('Faculty student detail error:', error);
        return res.status(500).json({ error: 'Failed to retrieve student details.' });
    }
};
