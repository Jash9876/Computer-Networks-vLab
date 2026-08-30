// Observation & Simulation Event History Retrieval Endpoint (GET /api/events/history?experimentId=X)
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

        const experimentId = parseInt(req.query.experimentId || '1', 10);

        // Fetch observations/events recorded for this user and experiment
        const countRes = await query(
            `SELECT 
                COUNT(*)::int AS total_count,
                COUNT(DISTINCT stage) FILTER (WHERE event_type NOT IN ('EXPERIMENT_OPENED', 'PING_FAILED'))::int AS distinct_count
             FROM simulation_events
             WHERE student_id = $1 AND experiment_id = $2`,
            [user.id, experimentId]
        );

        const eventsRes = await query(
            `SELECT stage, event_type, event_payload, created_at
             FROM simulation_events
             WHERE student_id = $1 AND experiment_id = $2
             ORDER BY created_at ASC`,
            [user.id, experimentId]
        );

        const totalDbEvents = countRes.rows[0]?.total_count || 0;
        const distinctStages = countRes.rows[0]?.distinct_count || 0;

        // Map events into structured observation rows
        const observations = eventsRes.rows.map(row => {
            const payload = row.event_payload || {};
            const timeStr = new Date(row.created_at).toLocaleTimeString();
            return {
                time: timeStr,
                moduleName: row.stage || 'Simulation',
                action: payload.action || row.event_type.replace(/_/g, ' '),
                result: payload.result || 'Logged'
            };
        });

        // Fetch latest quiz score and certificate if any
        const certRes = await query(
            `SELECT final_score, certificate_code, issued_at
             FROM certificates
             WHERE student_id = $1 AND experiment_id = $2`,
            [user.id, experimentId]
        );

        const quizRes = await query(
            `SELECT score, total_questions, attempt_number, created_at,
                    ROUND((score::numeric / total_questions) * 100) AS percent
             FROM quiz_attempts
             WHERE student_id = $1 AND experiment_id = $2
             ORDER BY created_at DESC
             LIMIT 1`,
            [user.id, experimentId]
        );

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

        const progressRes = await query(
            `SELECT status, progress_percentage, completed_milestones, completed_at
             FROM experiment_progress
             WHERE student_id = $1 AND experiment_id = $2`,
            [user.id, experimentId]
        );

        const expTotalReq = { 1: 3, 2: 4, 3: 4, 4: 4, 5: 5, 6: 5 };
        const rawProg = progressRes.rows[0] || { status: 'not_started', progress_percentage: 0, completed_milestones: [] };
        const validMilestoneCatalog = AUTHORITATIVE_MILESTONES[experimentId] || [];
        
        const cumulativeMilestones = new Set();
        (Array.isArray(rawProg.completed_milestones) ? rawProg.completed_milestones : []).forEach(m => {
            const resolved = resolveMilestone(experimentId, m.split(':')[0], m.split(':')[1], {});
            resolved.forEach(r => cumulativeMilestones.add(r));
            if (validMilestoneCatalog.includes(m)) cumulativeMilestones.add(m);
        });

        eventsRes.rows.forEach(row => {
            const p = row.event_payload || {};
            const resolved = resolveMilestone(experimentId, row.stage, row.event_type, p);
            resolved.forEach(r => cumulativeMilestones.add(r));
        });

        const milestones = Array.from(cumulativeMilestones).filter(m => validMilestoneCatalog.includes(m));
        const reqCount = expTotalReq[experimentId] || 5;

        // Pure simulation verification invariant: verified milestones satisfied
        const isSimComplete = milestones.length >= reqCount;
        const quizPct = quizRes.rows[0] ? (Number(quizRes.rows[0].percent) || 0) : 0;
        const vivaScore = quizPct;
        const isVivaPassed = vivaScore >= 70;
        const isAcademicComplete = isSimComplete && isVivaPassed;

        return res.status(200).json({
            experimentId,
            observations,
            observationCount: totalDbEvents,
            distinctStageCount: distinctStages,
            certificate: certRes.rows[0] || null,
            latestQuiz: quizRes.rows[0] || null,
            isSimComplete,
            isVivaPassed,
            isAcademicComplete,
            progress: {
                ...rawProg,
                status: isAcademicComplete ? 'completed' : 'in_progress',
                progress_percentage: isAcademicComplete ? 100 : (isSimComplete ? 85 : Math.min(85, Math.round((Math.max(milestones.length, distinctStages) / reqCount) * 85))),
                completed_milestones: milestones,
                isSimComplete,
                isVivaPassed,
                isAcademicComplete,
                viva_score: vivaScore
            }
        });
    } catch (error) {
        console.error('Fetch event history error:', error);
        return res.status(500).json({ error: 'Failed to retrieve event history from database.' });
    }
};
