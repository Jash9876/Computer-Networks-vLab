// Progress Retrieval Endpoint (GET /api/progress/get)
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
        if (!user) {
            return res.status(401).json({ error: 'Unauthorized. Please sign in.' });
        }

        // Fetch student profile, experiment records, and latest quiz scores in ONE consolidated query
        const sqlQuery = `
            WITH student_info AS (
                SELECT full_name, register_number, department, section 
                FROM users 
                WHERE id = $1
            ),
            exp_progress AS (
                SELECT ep.experiment_id, ep.status, ep.progress_percentage, ep.completed_milestones, ep.completed_at,
                        COALESCE(c.final_score, qa.max_percent, 0) AS score,
                        c.certificate_code,
                        COALESCE(se.event_count, 0) AS event_count
                FROM experiment_progress ep
                LEFT JOIN certificates c ON c.student_id = ep.student_id AND c.experiment_id = ep.experiment_id
                LEFT JOIN (
                    SELECT experiment_id, 
                           MAX(CASE WHEN total_questions > 0 THEN ROUND((score::numeric / total_questions) * 100) ELSE score END) AS max_percent
                    FROM quiz_attempts
                    WHERE student_id = $1
                    GROUP BY experiment_id
                ) qa ON qa.experiment_id = ep.experiment_id
                LEFT JOIN (
                    SELECT experiment_id, COUNT(DISTINCT stage)::int AS event_count
                    FROM simulation_events
                    WHERE student_id = $1 AND event_type NOT IN ('EXPERIMENT_OPENED', 'PING_FAILED')
                    GROUP BY experiment_id
                ) se ON se.experiment_id = ep.experiment_id
                WHERE ep.student_id = $1
                ORDER BY ep.experiment_id ASC
            ),
            sim_events AS (
                SELECT experiment_id, stage, event_type, event_payload 
                FROM simulation_events 
                WHERE student_id = $1
            )
            SELECT 
                (SELECT row_to_json(student_info.*) FROM student_info) AS student,
                (SELECT COALESCE(json_agg(row_to_json(exp_progress.*)), '[]'::json) FROM exp_progress) AS progress,
                (SELECT COALESCE(json_agg(row_to_json(sim_events.*)), '[]'::json) FROM sim_events) AS events;
        `;

        const combinedRes = await query(sqlQuery, [user.id]);
        const row = combinedRes.rows[0] || {};
        
        const studentRes = { rows: row.student ? [row.student] : [] };
        const progressRes = { rows: row.progress || [] };
        const allSimEvents = { rows: row.events || [] };
        
        const studentInfo = studentRes.rows[0] || {};

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

        // Organize the concurrently fetched simulation events by experiment_id
        const eventsByExp = {};
        allSimEvents.rows.forEach(e => {
            if (!eventsByExp[e.experiment_id]) eventsByExp[e.experiment_id] = [];
            eventsByExp[e.experiment_id].push(e);
        });

        // Normalize every experiment row against the strict dual-condition invariant:
        // Completed ONLY when (All Authoritative Milestones Verified AND Best Viva Quiz >= 70%)
        const sanitizedExperiments = progressRes.rows.map(r => {
            const expId = r.experiment_id;
            const validList = AUTHORITATIVE_MILESTONES[expId] || [];
            const reqMilestones = validList.length || 5;

            const cumulative = new Set();
            (Array.isArray(r.completed_milestones) ? r.completed_milestones : []).forEach(m => {
                const resolved = resolveMilestone(expId, m.split(':')[0], m.split(':')[1], {});
                resolved.forEach(item => cumulative.add(item));
                if (validList.includes(m)) cumulative.add(m);
            });

            (eventsByExp[expId] || []).forEach(e => {
                const resolved = resolveMilestone(expId, e.stage, e.event_type, e.event_payload);
                resolved.forEach(item => cumulative.add(item));
            });

            const milestones = Array.from(cumulative).filter(m => validList.includes(m));
            const isSimComplete = milestones.length >= reqMilestones;
            const vivaScore = Number(r.score) || 0;
            const isVivaPassed = vivaScore >= 70;

            const isAcademicComplete = isSimComplete && isVivaPassed;

            const verifiedProgress = milestones.length;
            const status = isAcademicComplete ? 'completed' : (verifiedProgress > 0 || r.started_at ? 'in_progress' : 'not_started');
            const progress_percentage = isAcademicComplete 
                ? 100 
                : Math.min(85, Math.round((verifiedProgress / reqMilestones) * 85));

            return {
                ...r,
                status,
                progress_percentage,
                completed_milestones: milestones,
                isSimComplete,
                isVivaPassed,
                isAcademicComplete,
                score: vivaScore,
                certificate_code: isAcademicComplete ? r.certificate_code : null
            };
        });

        const completedExperiments = sanitizedExperiments
            .filter(r => r.isAcademicComplete)
            .map(r => r.experiment_id);

        const totalExperiments = 6;
        const completedCount = completedExperiments.length;
        const overallPercentage = Math.round((completedCount / totalExperiments) * 100);

        return res.status(200).json({
            student: {
                id: user.id,
                name: studentInfo.full_name || user.fullName,
                registerNumber: studentInfo.register_number || user.registerNumber,
                department: studentInfo.department || user.department,
                section: studentInfo.section || user.section
            },
            completedExperiments,
            experiments: sanitizedExperiments,
            detailedProgress: sanitizedExperiments,
            overall: {
                completed: completedCount,
                total: totalExperiments,
                percentage: overallPercentage
            }
        });
    } catch (error) {
        console.error('Fetch progress error:', error);
        return res.status(500).json({ error: 'Failed to retrieve progress from database.' });
    }
};
