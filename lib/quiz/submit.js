// Quiz Score Recording and Certificate Generation API (POST /api/quiz/submit)
const { getUserFromRequest } = require('../auth-utils');
const { evaluateServerQuiz } = require('../quiz-keys');
const { query } = require('../db');

module.exports = async function handler(req, res) {
    res.setHeader('Content-Type', 'application/json');

    const allowedOrigin = process.env.ALLOWED_ORIGIN || '*';
    res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Credentials', 'true');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const user = getUserFromRequest(req);
        const { experimentId, userAnswers, attemptNumber } = req.body || {};

        if (!experimentId || !userAnswers) {
            return res.status(400).json({ error: 'Missing required quiz fields: experimentId, userAnswers.' });
        }

        const expNum = parseInt(experimentId);

        // Authoritative Server-Side Evaluation
        const evalResult = evaluateServerQuiz(expNum, userAnswers);
        const { earnedScore, totalQuestions, percentage, passed } = evalResult;

        if (!user) {
            // Guest / demo mode: return full evaluation results and allow quiz feedback to render
            return res.status(200).json({
                success: true,
                status: 'guest_untracked',
                experimentId: expNum,
                score: earnedScore,
                totalQuestions,
                percentage,
                passed,
                isSimComplete: false,
                isAcademicComplete: false,
                details: evalResult.details,
                certificateCode: null,
                certificateScore: null
            });
        }

        // 1. Insert quiz attempt record
        await query(
            `INSERT INTO quiz_attempts (student_id, experiment_id, attempt_number, score, total_questions, answers_summary)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [user.id, expNum, parseInt(attemptNumber || 1), earnedScore, totalQuestions, JSON.stringify(userAnswers || [])]
        );
        // 2. Check simulation progress to enforce dual completion invariant: (Simulations Complete && Quiz Passed >= 70%)
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
                    if (eventType === 'TOPOLOGY_VALIDATED') { res.push('4A_TOPOLOGY_COMPLETE'); res.push('4B_TOPOLOGY_COMPLETE'); }
                    if (eventType === 'PING_SUCCESS') { res.push('4A_CONNECTIVITY_VERIFIED'); res.push('4B_CONNECTIVITY_VERIFIED'); }
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
            }
            const validList = AUTHORITATIVE_MILESTONES[expId] || [];
            return res.filter(m => validList.includes(m));
        }

        const validMilestones = AUTHORITATIVE_MILESTONES[expNum] || [];

        const progRes = await query(
            `SELECT completed_milestones FROM experiment_progress WHERE student_id = $1 AND experiment_id = $2`,
            [user.id, expNum]
        );
        const eventsRes = await query(
            `SELECT stage, event_type, event_payload FROM simulation_events WHERE student_id = $1 AND experiment_id = $2`,
            [user.id, expNum]
        );

        const cumulativeMilestones = new Set();
        (Array.isArray(progRes.rows[0]?.completed_milestones) ? progRes.rows[0].completed_milestones : []).forEach(m => {
            const resolved = resolveMilestone(expNum, m.split(':')[0], m.split(':')[1], {});
            resolved.forEach(r => cumulativeMilestones.add(r));
            if (validMilestones.includes(m)) cumulativeMilestones.add(m);
        });

        eventsRes.rows.forEach(row => {
            const p = row.event_payload || {};
            const resolved = resolveMilestone(expNum, row.stage, row.event_type, p);
            resolved.forEach(r => cumulativeMilestones.add(r));
        });

        const milestones = Array.from(cumulativeMilestones).filter(m => validMilestones.includes(m));
        const totalReq = validMilestones.length || 5;
        const isSimComplete = milestones.length >= totalReq;
        const isAcademicComplete = isSimComplete && passed;

        let certificateCode = null;
        let certificateScore = null;

        // Issue certificate ONLY when dual academic requirements are completely satisfied
        if (isAcademicComplete) {
            const certCode = `CNVL-2026-${String(expNum).padStart(2, '0')}-${user.registerNumber.slice(-4)}-${Math.floor(1000 + Math.random() * 9000)}`;

            const certRes = await query(
                `INSERT INTO certificates (certificate_code, student_id, experiment_id, final_score)
                 VALUES ($1, $2, $3, $4)
                 ON CONFLICT (student_id, experiment_id) DO UPDATE
                 SET final_score = GREATEST(certificates.final_score, EXCLUDED.final_score)
                 RETURNING certificate_code, final_score`,
                [certCode, user.id, expNum, percentage]
            );

            certificateCode = certRes.rows[0].certificate_code;
            certificateScore = certRes.rows[0].final_score;

            await query(
                `INSERT INTO experiment_progress (student_id, experiment_id, status, progress_percentage, completed_milestones, completed_at, last_activity)
                 VALUES ($1, $2, 'completed', 100, $3, NOW(), NOW())
                 ON CONFLICT (student_id, experiment_id) DO UPDATE
                 SET status = 'completed', 
                     progress_percentage = 100, 
                     completed_milestones = $3,
                     completed_at = COALESCE(experiment_progress.completed_at, NOW()), 
                     last_activity = NOW()`,
                [user.id, expNum, JSON.stringify(milestones)]
            );
        } else {
            // Either simulation is incomplete, or quiz failed: calculate weighted progress up to 85%
            const simRatio = Math.min(1, milestones.length / totalReq);
            const weightedProgress = Math.round(simRatio * 85);

            await query(
                `INSERT INTO experiment_progress (student_id, experiment_id, status, progress_percentage, completed_milestones, last_activity)
                 VALUES ($1, $2, 'in_progress', $3, $4, NOW())
                 ON CONFLICT (student_id, experiment_id) DO UPDATE
                 SET status = 'in_progress', 
                     progress_percentage = $3, 
                     completed_milestones = $4,
                     last_activity = NOW()`,
                [user.id, expNum, weightedProgress, JSON.stringify(milestones)]
            );
        }

        return res.status(200).json({
            success: true,
            experimentId: expNum,
            score: earnedScore,
            totalQuestions,
            percentage,
            passed,
            isSimComplete,
            isAcademicComplete,
            details: evalResult.details,
            certificateCode,
            certificateScore: typeof certificateScore === 'number' ? certificateScore : null
        });
    } catch (error) {
        console.error('Quiz submit error:', error);
        return res.status(500).json({ error: error.message || 'Failed to record quiz submission.' });
    }
};
