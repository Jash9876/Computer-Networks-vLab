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

        // Fetch student profile, experiment records, latest quiz scores, certificates, and simulation events in ONE consolidated query
        const sqlQuery = `
            WITH student_info AS (
                SELECT full_name, register_number, department, section 
                FROM users 
                WHERE id = $1
            ),
            exp_progress AS (
                SELECT exp_nums.exp_id AS experiment_id, 
                       ep.status, 
                       ep.progress_percentage, 
                       ep.completed_milestones, 
                       ep.completed_at, 
                       ep.started_at,
                       COALESCE(c.final_score, qa.max_percent, 0) AS score,
                       c.certificate_code
                FROM generate_series(1, 10) AS exp_nums(exp_id)
                LEFT JOIN experiment_progress ep ON ep.student_id = $1 AND ep.experiment_id = exp_nums.exp_id
                LEFT JOIN certificates c ON c.student_id = $1 AND c.experiment_id = exp_nums.exp_id
                LEFT JOIN (
                    SELECT experiment_id, 
                           MAX(CASE WHEN total_questions > 0 THEN ROUND((score::numeric / total_questions) * 100) ELSE score END) AS max_percent
                    FROM quiz_attempts
                    WHERE student_id = $1
                    GROUP BY experiment_id
                ) qa ON qa.experiment_id = exp_nums.exp_id
                ORDER BY exp_nums.exp_id ASC
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

        const apiStart = Date.now();
        const combinedRes = await query(sqlQuery, [user.id]);
        const dbTime = Date.now() - apiStart;
        const apiProcStart = Date.now();

        const row = combinedRes.rows[0] || {};
        
        const studentRes = { rows: row.student ? [row.student] : [] };
        const progressRes = { rows: row.progress || [] };
        const rawEvents = row.events || [];
        
        const studentInfo = studentRes.rows[0] || {};

        const AUTHORITATIVE_MILESTONES = {
            1: ['CABLES_STUDIED', 'COMMANDS_EXECUTED', 'PT_UI_EXPLORED'],
            2: ['IPV4_CONFIGURED', 'SUBNET_CALCULATED', 'PINOUT_CRIMPED', 'CABLE_TESTED'],
            3: ['CONSOLE_CONNECTED', 'TERMINAL_CONFIGURED', 'HOSTNAME_SET', 'INTERFACES_CONFIGURED'],
            4: [
                '4A_TOPOLOGY_COMPLETE', '4A_ROUTER_CONFIGURED', '4A_CONNECTIVITY_VERIFIED',
                '4B_TOPOLOGY_COMPLETE', '4B_SERIAL_CONFIGURED', '4B_ROUTER0_CONFIGURED',
                '4B_ROUTER1_CONFIGURED', '4B_STATIC_ROUTES_CONFIGURED', '4B_CONNECTIVITY_VERIFIED'
            ],
            5: ['TOPOLOGY_CONFIGURED', 'STATIC_ROUTE_R0', 'STATIC_ROUTE_R1', 'DEFAULT_ROUTE_SET', 'CONNECTIVITY_VERIFIED'],
            6: ['6A_TOPOLOGY_IP', '6A_STATIC_NAT', '6A_NAT_VERIFY', '6B_DYN_NAT_CFG', '6B_DYN_NAT_VERIFY'],
            7: ['7A_TOPOLOGY', '7A_ROUTER0_RIP', '7A_ROUTER1_RIP', '7A_CONVERGED', '7A_CONNECTIVITY', '7B_TOPOLOGY', '7B_ROUTER0_RIPV2', '7B_ROUTER1_RIPV2', '7B_CONVERGED', '7B_CONNECTIVITY'],
            8: [
                '8A_TOPOLOGY_COMPLETE', '8A_IP_CONFIGURED', '8A_OSPF_CONFIGURED', '8A_CONNECTIVITY_VERIFIED',
                '8B_TOPOLOGY_COMPLETE', '8B_IP_CONFIGURED', '8B_OSPF_CONFIGURED', '8B_CONNECTIVITY_VERIFIED'
            ],
            9: [
                '9A_TOPOLOGY_COMPLETE', '9A_IP_CONFIGURED', '9A_OSPF_CONFIGURED', '9A_PPP_CHAP_CONFIGURED', '9A_CONNECTIVITY_VERIFIED',
                '9B_TOPOLOGY_COMPLETE', '9B_HDLC_CONFIGURED', '9B_CONNECTIVITY_VERIFIED'
            ],
            10: [
                '10_TOPOLOGY_COMPLETE', '10_IP_CONFIGURED', '10_BGP_PEERING_ESTABLISHED', '10_BGP_PREFIX_ADVERTISED', '10_BGP_WITHDRAWAL_TESTED', '10_CONNECTIVITY_VERIFIED'
            ]
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
                    if (stg.includes('4A_TOPOLOGY') || stg.includes('Topology Builder (4-A)')) res.push('4A_TOPOLOGY_COMPLETE');
                    if (stg.includes('4A_ROUTER') || act.includes('4A Router Config')) res.push('4A_ROUTER_CONFIGURED');
                    if (stg.includes('4A_CONNECTIVITY') || act.includes('Ping Simulation (4A)')) res.push('4A_CONNECTIVITY_VERIFIED');
                    if (stg.includes('4B_TOPOLOGY') || stg.includes('Topology Builder (4-B)')) res.push('4B_TOPOLOGY_COMPLETE');
                    if (stg.includes('4B_SERIAL') || act.includes('HWIC-2T') || act.includes('DCE Clock')) res.push('4B_SERIAL_CONFIGURED');
                    if (stg.includes('4B_ROUTER0') || act.includes('Router0 4B Config')) res.push('4B_ROUTER0_CONFIGURED');
                    if (stg.includes('4B_ROUTER1') || act.includes('Router1 4B Config')) res.push('4B_ROUTER1_CONFIGURED');
                    if (stg.includes('4B_STATIC_ROUTES') || act.includes('Static Routes Configured')) res.push('4B_STATIC_ROUTES_CONFIGURED');
                    if (stg.includes('4B_CONNECTIVITY') || act.includes('Ping Simulation (4B)')) res.push('4B_CONNECTIVITY_VERIFIED');
                    // Legacy fallbacks
                    if (stg.includes('Subnet') || stg.includes('Addressing') || eventType === 'SUBNET_IDENTIFIED') res.push('4B_STATIC_ROUTES_CONFIGURED');
                    if (stg.includes('Topology') || eventType === 'TOPOLOGY_VALIDATED') { res.push('4A_TOPOLOGY_COMPLETE'); res.push('4B_TOPOLOGY_COMPLETE'); }
                    if (stg.includes('Ping') || eventType === 'PING_SUCCESS') { res.push('4A_CONNECTIVITY_VERIFIED'); res.push('4B_CONNECTIVITY_VERIFIED'); }
                    break;
                case 5:
                    if (stg.includes('Addressing Match') || stg.includes('Hardware Module') || stg.includes('Topology Builder')) res.push('TOPOLOGY_CONFIGURED');
                    if (stg.includes('Static Routing') || stg.includes('STATIC_ROUTE')) {
                        res.push('STATIC_ROUTE_R0');
                        res.push('STATIC_ROUTE_R1');
                    }
                    if (stg.includes('Default Routing') || eventType === 'DEFAULT_ROUTE_CONFIGURED') res.push('DEFAULT_ROUTE_SET');
                    if (stg.includes('Traceroute') || stg.includes('Packet Journey') || eventType === 'TRACEROUTE_EXECUTED') res.push('CONNECTIVITY_VERIFIED');
                    break;
                case 6:
                    if (stg.includes('6A_TOPOLOGY') || stg.includes('Topology')) res.push('6A_TOPOLOGY_IP');
                    if (stg.includes('STATIC_NAT') || stg.includes('Static NAT')) res.push('6A_STATIC_NAT');
                    if (stg.includes('NAT_VERIFY') || stg.includes('Ping')) res.push('6A_NAT_VERIFY');
                    if (stg.includes('DYN_NAT_CFG') || stg.includes('Dynamic NAT')) res.push('6B_DYN_NAT_CFG');
                    if (stg.includes('DYN_NAT_VERIFY') || stg.includes('Translation')) res.push('6B_DYN_NAT_VERIFY');
                    break;
                case 7:
                    if (stg.includes('7A_TOPOLOGY') || stg.includes('Topology')) { res.push('7A_TOPOLOGY'); res.push('7B_TOPOLOGY'); }
                    if (stg.includes('7A_ROUTER0_RIP') || (stg.includes('RIP') && stg.includes('Router0'))) res.push('7A_ROUTER0_RIP');
                    if (stg.includes('7A_ROUTER1_RIP') || (stg.includes('RIP') && stg.includes('Router1'))) res.push('7A_ROUTER1_RIP');
                    if (stg.includes('7B_ROUTER0_RIPV2') || (stg.includes('RIPv2') && stg.includes('Router0'))) res.push('7B_ROUTER0_RIPV2');
                    if (stg.includes('7B_ROUTER1_RIPV2') || (stg.includes('RIPv2') && stg.includes('Router1'))) res.push('7B_ROUTER1_RIPV2');
                    if (stg.includes('Converged') || stg.includes('CONVERGED')) { res.push('7A_CONVERGED'); res.push('7B_CONVERGED'); }
                    if (stg.includes('Connectivity') || eventType === 'PING_SUCCESS') { res.push('7A_CONNECTIVITY'); res.push('7B_CONNECTIVITY'); }
                    break;
                case 8:
                    if (stg.includes('8A_TOPOLOGY') || (stg.includes('Topology') && stg.includes('8A'))) res.push('8A_TOPOLOGY_COMPLETE');
                    if (stg.includes('8A_IP') || (stg.includes('Addressing') && stg.includes('8A'))) res.push('8A_IP_CONFIGURED');
                    if (stg.includes('8A_OSPF') || (stg.includes('OSPF') && stg.includes('8A'))) res.push('8A_OSPF_CONFIGURED');
                    if (stg.includes('8A_CONNECTIVITY') || (eventType === 'PING_SUCCESS' && stg.includes('8A'))) res.push('8A_CONNECTIVITY_VERIFIED');
                    if (stg.includes('8B_TOPOLOGY') || (stg.includes('Topology') && stg.includes('8B'))) res.push('8B_TOPOLOGY_COMPLETE');
                    if (stg.includes('8B_IP') || (stg.includes('Addressing') && stg.includes('8B'))) res.push('8B_IP_CONFIGURED');
                    if (stg.includes('8B_OSPF') || (stg.includes('OSPF') && stg.includes('8B'))) res.push('8B_OSPF_CONFIGURED');
                    if (stg.includes('8B_CONNECTIVITY') || (eventType === 'PING_SUCCESS' && stg.includes('8B'))) res.push('8B_CONNECTIVITY_VERIFIED');
                    break;
                case 9: {
                    const actLower = act.toLowerCase();
                    const stgLower = stg.toLowerCase();
                    if (stgLower.includes('9a_topology') || (stgLower.includes('topology') && stgLower.includes('9a')) || (eventType === 'TOPOLOGY_VALIDATED' && stgLower.includes('9a'))) res.push('9A_TOPOLOGY_COMPLETE');
                    if (stgLower.includes('9a_ip') || (stgLower.includes('addressing') && stgLower.includes('9a')) || (eventType === 'ADDRESSING_MATCHED' && stgLower.includes('9a'))) res.push('9A_IP_CONFIGURED');
                    if (stgLower.includes('9a_ospf') || (stgLower.includes('ospf') && stgLower.includes('9a')) || (actLower.includes('router ospf') && stgLower.includes('9a'))) res.push('9A_OSPF_CONFIGURED');
                    if (stgLower.includes('9a_ppp') || actLower.includes('encapsulation ppp') || actLower.includes('ppp authentication chap') || actLower.includes('lcp open')) res.push('9A_PPP_CHAP_CONFIGURED');
                    if (stgLower.includes('9a_connectivity') || (eventType === 'PING_SUCCESS' && stgLower.includes('9a')) || (actLower.includes('ping') && stgLower.includes('9a')) || actLower.includes('packet journey') && stgLower.includes('9a')) res.push('9A_CONNECTIVITY_VERIFIED');

                    if (stgLower.includes('9b_topology') || (stgLower.includes('topology') && stgLower.includes('9b')) || (eventType === 'TOPOLOGY_VALIDATED' && stgLower.includes('9b'))) res.push('9B_TOPOLOGY_COMPLETE');
                    if (stgLower.includes('9b_hdlc') || actLower.includes('encapsulation hdlc') || actLower.includes('show controllers') || actLower.includes('dce v.35')) res.push('9B_HDLC_CONFIGURED');
                    if (stgLower.includes('9b_connectivity') || (eventType === 'PING_SUCCESS' && stgLower.includes('9b')) || (actLower.includes('ping') && stgLower.includes('9b'))) res.push('9B_CONNECTIVITY_VERIFIED');
                    break;
                }
                case 10: {
                    const actLower = act.toLowerCase();
                    const stgLower = stg.toLowerCase();
                    if (stgLower.includes('10_topology') || (stgLower.includes('topology') && stgLower.includes('10')) || (eventType === 'TOPOLOGY_VALIDATED' && stgLower.includes('10')) || actLower.includes('topology builder') || actLower.includes('verified connections') || actLower.includes('exercise 10')) res.push('10_TOPOLOGY_COMPLETE');
                    if (stgLower.includes('10_ip') || (stgLower.includes('addressing') && stgLower.includes('10')) || (eventType === 'ADDRESSING_MATCHED' && stgLower.includes('10')) || actLower.includes('all ip addresses verified') || actLower.includes('configured pc')) res.push('10_IP_CONFIGURED');
                    if (stgLower.includes('10_bgp_peering') || (actLower.includes('neighbor') && actLower.includes('remote-as')) || actLower.includes('bgp-5-adjchange') || actLower.includes('peering established') || actLower.includes('adjacency established')) res.push('10_BGP_PEERING_ESTABLISHED');
                    if (stgLower.includes('10_bgp_prefix') || (actLower.includes('network') && actLower.includes('mask')) || actLower.includes('advertised') || actLower.includes('prefix advertisement') || actLower.includes('installed in bgp table')) res.push('10_BGP_PREFIX_ADVERTISED');
                    if (stgLower.includes('10_bgp_withdrawal') || actLower.includes('withdrawal') || actLower.includes('flap') || actLower.includes('link down') || actLower.includes('fault injection') || actLower.includes('simulated link cut')) res.push('10_BGP_WITHDRAWAL_TESTED');
                    if (stgLower.includes('10_connectivity') || (eventType === 'PING_SUCCESS' && stgLower.includes('10')) || (actLower.includes('ping') && (stgLower.includes('10') || actLower.includes('192.168.20.3') || actLower.includes('192.168.10.2') || actLower.includes('cross-as')))) res.push('10_CONNECTIVITY_VERIFIED');
                    break;
                }
            }
            const validList = AUTHORITATIVE_MILESTONES[expId] || [];
            return res.filter(m => validList.includes(m));
        }

        const sanitizedExperiments = progressRes.rows.map(r => {
            const expId = Number(r.experiment_id);
            const validList = AUTHORITATIVE_MILESTONES[expId] || [];
            const reqMilestones = validList.length || 5;

            const cumulative = new Set();
            
            // Handle completed_milestones safely whether it's array or string
            let rawMilestones = r.completed_milestones;
            if (typeof rawMilestones === 'string') {
                try { rawMilestones = JSON.parse(rawMilestones); } catch (e) { rawMilestones = []; }
            }
            (Array.isArray(rawMilestones) ? rawMilestones : []).forEach(m => {
                if (validList.includes(m)) {
                    cumulative.add(m);
                } else if (typeof m === 'string') {
                    const resolved = resolveMilestone(expId, m.split(':')[0], m.split(':')[1], {});
                    resolved.forEach(x => cumulative.add(x));
                    if (validList.includes(m)) cumulative.add(m);
                }
            });

            // Also dynamically reconcile with recorded simulation_events for this user & experiment
            const expEvents = rawEvents.filter(ev => Number(ev.experiment_id) === expId);
            expEvents.forEach(ev => {
                const resolved = resolveMilestone(expId, ev.stage, ev.event_type, ev.event_payload);
                resolved.forEach(x => cumulative.add(x));
            });

            const milestones = Array.from(cumulative).filter(m => validList.includes(m));
            const isSimComplete = milestones.length >= reqMilestones || (r.status === 'completed');
            const vivaScore = Number(r.score) || 0;
            const isVivaPassed = vivaScore >= 70 || (r.status === 'completed');

            // Academic completion requires passing both simulation and viva, OR already marked completed/certified
            const hasCertificate = Boolean(r.certificate_code);
            const isAcademicComplete = (r.status === 'completed') || hasCertificate || (isSimComplete && isVivaPassed);

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

        const totalExperiments = 10;
        const completedCount = completedExperiments.length;
        const overallPercentage = Math.round((completedCount / totalExperiments) * 100);

        const apiProcTime = Date.now() - apiProcStart;
        res.setHeader('X-DB-Time', dbTime.toString());
        res.setHeader('X-API-Time', apiProcTime.toString());

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
