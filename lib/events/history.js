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
             WHERE student_id = $1 AND experiment_id = $2 AND stage != 'Lab Start'
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
                    if (stg.includes('Static Routing')) {
                        res.push('STATIC_ROUTE_R0');
                        res.push('STATIC_ROUTE_R1');
                    }
                    if (stg.includes('Default Routing') || eventType === 'DEFAULT_ROUTE_CONFIGURED') res.push('DEFAULT_ROUTE_SET');
                    if (stg.includes('Traceroute') || stg.includes('Packet Journey') || eventType === 'TRACEROUTE_EXECUTED') res.push('CONNECTIVITY_VERIFIED');
                    break;
                case 6:
                    if (stg.includes('6A_TOPOLOGY_IP') || act.includes('6A_TOPOLOGY_IP') || act.includes('Addressing Match') || eventType === 'ADDRESSING_MATCHED') res.push('6A_TOPOLOGY_IP');
                    if (stg.includes('6A_STATIC_NAT') || act.includes('6A_STATIC_NAT') || act.includes('Static NAT') || act.includes('ip nat inside source static')) res.push('6A_STATIC_NAT');
                    if (stg.includes('6A_NAT_VERIFY') || act.includes('6A_NAT_VERIFY') || act.includes('Ping Server') || (eventType === 'PING_SUCCESS' && act.includes('6A'))) res.push('6A_NAT_VERIFY');
                    if (stg.includes('6B_DYN_NAT_CFG') || act.includes('6B_DYN_NAT_CFG') || act.includes('Dynamic NAT') || act.includes('ip nat pool')) res.push('6B_DYN_NAT_CFG');
                    if (stg.includes('6B_DYN_NAT_VERIFY') || act.includes('6B_DYN_NAT_VERIFY') || (eventType === 'PING_SUCCESS' && act.includes('6B'))) res.push('6B_DYN_NAT_VERIFY');
                    break;
                case 7: {
                    const actLower = act.toLowerCase();
                    const stgLower = stg.toLowerCase();
                    if (stgLower.includes('topology') || actLower.includes('topology') || eventType === 'TOPOLOGY_VALIDATED') {
                        res.push('7A_TOPOLOGY');
                        res.push('7B_TOPOLOGY');
                    }
                    if (actLower.includes('router rip') || actLower.includes('network') || act.includes('Router0') || act.includes('RIP v1') || act.includes('RIP Configuration')) {
                        res.push('7A_ROUTER0_RIP');
                        res.push('7A_ROUTER1_RIP');
                    }
                    if (actLower.includes('version 2') || actLower.includes('no auto-summary') || act.includes('RIP v2') || act.includes('WAN Serial Link Restored')) {
                        res.push('7B_ROUTER0_RIPV2');
                        res.push('7B_ROUTER1_RIPV2');
                    }
                    if (actLower.includes('converge') || act.includes('Route learned') || act.includes('Routing table verified') || act.includes('reconverged')) {
                        res.push('7A_CONVERGED');
                        res.push('7B_CONVERGED');
                    }
                    if (actLower.includes('packet journey') || eventType === 'PING_SUCCESS' || actLower.includes('ping') || act.includes('Delivered')) {
                        res.push('7A_CONNECTIVITY');
                        res.push('7B_CONNECTIVITY');
                    }
                    break;
                }
                case 8: {
                    const actLower = act.toLowerCase();
                    const stgLower = stg.toLowerCase();
                    if (stgLower.includes('8a_topology') || (stgLower.includes('topology') && stgLower.includes('8a')) || (eventType === 'TOPOLOGY_VALIDATED' && stgLower.includes('8a'))) res.push('8A_TOPOLOGY_COMPLETE');
                    if (stgLower.includes('8a_ip') || (stgLower.includes('addressing') && stgLower.includes('8a')) || (eventType === 'ADDRESSING_MATCHED' && stgLower.includes('8a'))) res.push('8A_IP_CONFIGURED');
                    if (stgLower.includes('8a_ospf') || (stgLower.includes('ospf') && stgLower.includes('8a')) || actLower.includes('router ospf') && stgLower.includes('8a')) res.push('8A_OSPF_CONFIGURED');
                    if (stgLower.includes('8a_connectivity') || (eventType === 'PING_SUCCESS' && stgLower.includes('8a')) || (actLower.includes('ping') && stgLower.includes('8a'))) res.push('8A_CONNECTIVITY_VERIFIED');
                    if (stgLower.includes('8b_topology') || (stgLower.includes('topology') && stgLower.includes('8b')) || (eventType === 'TOPOLOGY_VALIDATED' && stgLower.includes('8b'))) res.push('8B_TOPOLOGY_COMPLETE');
                    if (stgLower.includes('8b_ip') || (stgLower.includes('addressing') && stgLower.includes('8b')) || (eventType === 'ADDRESSING_MATCHED' && stgLower.includes('8b'))) res.push('8B_IP_CONFIGURED');
                    if (stgLower.includes('8b_ospf') || (stgLower.includes('ospf') && stgLower.includes('8b')) || actLower.includes('router ospf') && stgLower.includes('8b')) res.push('8B_OSPF_CONFIGURED');
                    if (stgLower.includes('8b_connectivity') || (eventType === 'PING_SUCCESS' && stgLower.includes('8b')) || (actLower.includes('ping') && stgLower.includes('8b'))) res.push('8B_CONNECTIVITY_VERIFIED');
                    break;
                }
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

        const expTotalReq = { 1: 3, 2: 4, 3: 4, 4: 9, 5: 5, 6: 5, 7: 10, 8: 8 };
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

        // Automatically issue certificate and synchronize progress if requirements are fully met
        let certificateData = certRes.rows[0] || null;
        if (isAcademicComplete && !certificateData) {
            const regSuffix = (user.registerNumber || user.register_number || 'USER').slice(-4);
            const certCode = `CNVL-2026-${String(experimentId).padStart(2, '0')}-${regSuffix}-${Math.floor(1000 + Math.random() * 9000)}`;
            const finalScore = vivaScore || 100;
            const newCert = await query(
                `INSERT INTO certificates (certificate_code, student_id, experiment_id, final_score)
                 VALUES ($1, $2, $3, $4)
                 ON CONFLICT (student_id, experiment_id) DO UPDATE
                 SET final_score = GREATEST(certificates.final_score, EXCLUDED.final_score)
                 RETURNING final_score, certificate_code, issued_at`,
                [certCode, user.id, experimentId, finalScore]
            );
            certificateData = newCert.rows[0] || null;

            await query(
                `INSERT INTO experiment_progress (student_id, experiment_id, status, progress_percentage, completed_milestones, completed_at, last_activity)
                 VALUES ($1, $2, 'completed', 100, $3, NOW(), NOW())
                 ON CONFLICT (student_id, experiment_id) DO UPDATE
                 SET status = 'completed', 
                     progress_percentage = 100, 
                     completed_milestones = $3,
                     completed_at = COALESCE(experiment_progress.completed_at, NOW()), 
                     last_activity = NOW()`,
                [user.id, experimentId, JSON.stringify(milestones)]
            );
        } else if (milestones.length > (Array.isArray(rawProg.completed_milestones) ? rawProg.completed_milestones.length : 0)) {
            // Update progress if newly resolved milestones exceed raw progress
            await query(
                `INSERT INTO experiment_progress (student_id, experiment_id, status, progress_percentage, completed_milestones, last_activity)
                 VALUES ($1, $2, $3, $4, $5, NOW())
                 ON CONFLICT (student_id, experiment_id) DO UPDATE
                 SET completed_milestones = $5,
                     progress_percentage = GREATEST(experiment_progress.progress_percentage, EXCLUDED.progress_percentage),
                     last_activity = NOW()`,
                [
                    user.id,
                    experimentId,
                    isAcademicComplete ? 'completed' : 'in_progress',
                    isAcademicComplete ? 100 : (isSimComplete ? 85 : Math.min(85, Math.round((milestones.length / reqCount) * 85))),
                    JSON.stringify(milestones)
                ]
            );
        }

        return res.status(200).json({
            experimentId,
            observations,
            observationCount: totalDbEvents,
            distinctStageCount: distinctStages,
            certificate: certificateData,
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
