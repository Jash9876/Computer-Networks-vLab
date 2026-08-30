// Milestone Verification & Event Logging Endpoint (POST /api/events/log)
const { getUserFromRequest } = require('../auth-utils');
const db = require('../db');

// Allowed meaningful educational event types
const VALID_EVENT_TYPES = [
    'EXPERIMENT_OPENED',
    'ADDRESSING_MATCHED',
    'SUBNET_IDENTIFIED',
    'HARDWARE_INSTALLED',
    'TOPOLOGY_VALIDATED',
    'STATIC_ROUTE_CONFIGURED',
    'DEFAULT_ROUTE_CONFIGURED',
    'CLI_COMMAND_EXECUTED',
    'PING_ATTEMPTED',
    'PING_FAILED',
    'PING_SUCCESS',
    'TRACEROUTE_EXECUTED',
    'QUIZ_SUBMITTED',
    'EXPERIMENT_COMPLETED'
];

// Authoritative Catalog of Verified Milestones per Experiment
const AUTHORITATIVE_MILESTONES = {
    1: ['CABLES_STUDIED', 'COMMANDS_EXECUTED', 'PT_UI_EXPLORED'],
    2: ['IPV4_CONFIGURED', 'SUBNET_CALCULATED', 'PINOUT_CRIMPED', 'CABLE_TESTED'],
    3: ['CONSOLE_CONNECTED', 'TERMINAL_CONFIGURED', 'HOSTNAME_SET', 'INTERFACES_CONFIGURED'],
    4: ['SUBNET_DESIGNED', 'TOPOLOGY_WIRED', 'ROUTER_CONFIGURED', 'PING_VERIFIED'],
    5: ['TOPOLOGY_CONFIGURED', 'STATIC_ROUTE_R0', 'STATIC_ROUTE_R1', 'DEFAULT_ROUTE_SET', 'CONNECTIVITY_VERIFIED'],
    6: ['6A_TOPOLOGY_IP', '6A_STATIC_NAT', '6A_NAT_VERIFY', '6B_DYN_NAT_CFG', '6B_DYN_NAT_VERIFY']
};

// Evidence-based Milestone Evaluator
function verifyMilestoneEvidence(expId, milestoneId, payload) {
    if (!payload || typeof payload !== 'object') return false;
    const evidence = payload.evidence || payload;

    switch (`${expId}:${milestoneId}`) {
        // Experiment 6 Evidence Rules
        case '6:6A_TOPOLOGY_IP':
            return Boolean(
                evidence.pc0Ip === '20.20.20.1' &&
                evidence.pc1Ip === '20.20.20.2' &&
                evidence.pc2Ip === '10.10.10.1' &&
                evidence.r0G0 === '20.20.20.254' &&
                evidence.r1G0 === '10.10.10.254' &&
                evidence.r0S0 === '30.30.30.2' &&
                evidence.r1S0 === '30.30.30.3'
            );
        case '6:6A_STATIC_NAT':
            return Boolean(
                evidence.hasInsideG0 === true &&
                evidence.hasOutsideS0 === true &&
                evidence.mapping1 === '10.10.10.1->30.30.30.10' &&
                evidence.mapping2 === '10.10.10.2->30.30.30.20' &&
                evidence.hasRoute === true
            );
        case '6:6A_NAT_VERIFY':
            return Boolean(
                evidence.pingSuccess === true &&
                (evidence.targetIp === '30.30.30.10' || evidence.targetIp === '30.30.30.20') &&
                (evidence.translatedLocal === '10.10.10.1' || evidence.translatedLocal === '10.10.10.2')
            );
        case '6:6B_DYN_NAT_CFG':
            return Boolean(
                evidence.hasInsideG0 === true &&
                evidence.hasOutsideS0 === true &&
                evidence.clockRate === 64000 &&
                evidence.acl1Permit === '10.0.0.0 0.255.255.255' &&
                evidence.poolName === 'DYNAT' &&
                evidence.poolRange === '2.0.0.10-2.0.0.20' &&
                evidence.hasBinding === true
            );
        case '6:6B_DYN_NAT_VERIFY':
            return Boolean(
                evidence.pingSuccess === true &&
                evidence.targetIp === '3.0.0.2' &&
                evidence.dynamicAllocatedGlobal >= '2.0.0.10' &&
                evidence.dynamicAllocatedGlobal <= '2.0.0.20'
            );

        // Experiments 1–5 Evidence Fallbacks
        case '1:CABLES_STUDIED':
        case '1:COMMANDS_EXECUTED':
        case '1:PT_UI_EXPLORED':
        case '2:IPV4_CONFIGURED':
        case '2:SUBNET_CALCULATED':
        case '2:PINOUT_CRIMPED':
        case '2:CABLE_TESTED':
        case '3:CONSOLE_CONNECTED':
        case '3:TERMINAL_CONFIGURED':
        case '3:HOSTNAME_SET':
        case '3:INTERFACES_CONFIGURED':
        case '4:SUBNET_DESIGNED':
        case '4:TOPOLOGY_WIRED':
        case '4:ROUTER_CONFIGURED':
        case '4:PING_VERIFIED':
        case '5:TOPOLOGY_CONFIGURED':
        case '5:STATIC_ROUTE_R0':
        case '5:STATIC_ROUTE_R1':
        case '5:DEFAULT_ROUTE_SET':
        case '5:CONNECTIVITY_VERIFIED':
            return Boolean(evidence.verified === true || payload.result?.includes('success') || payload.result?.includes('passed') || payload.result?.includes('Verified'));

        default:
            return false;
    }
}

// In-memory throttle cache for non-milestone telemetry (TTL: 2000ms)
const telemetryThrottleCache = new Map();
const THROTTLE_WINDOW_MS = 2000;

// Periodic cleanup of expired throttle keys every 60s
setInterval(() => {
    const now = Date.now();
    for (const [key, timestamp] of telemetryThrottleCache.entries()) {
        if (now - timestamp > THROTTLE_WINDOW_MS) {
            telemetryThrottleCache.delete(key);
        }
    }
}, 60000).unref();

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
        if (!user) {
            return res.status(200).json({ status: 'guest_untracked' });
        }

        const { experimentId, stage, eventType, payload } = req.body || {};
        const expId = parseInt(experimentId, 10);

        if (!expId || !stage || !eventType) {
            return res.status(400).json({ error: 'Missing required event fields: experimentId, stage, eventType.' });
        }

        if (!VALID_EVENT_TYPES.includes(eventType)) {
            return res.status(400).json({ error: `Event type "${eventType}" is not a recognized milestone event.` });
        }

        // 1. Authoritative Evidence Verification (Evaluated FIRST to classify Milestone vs Telemetry)
        const validMilestoneCatalog = AUTHORITATIVE_MILESTONES[expId] || [];
        let extractedMilestoneId = null;

        // Check if candidate stage matches catalog AND satisfies evidence verification
        if (validMilestoneCatalog.includes(stage) && verifyMilestoneEvidence(expId, stage, payload)) {
            extractedMilestoneId = stage;
        } else if (payload && payload.action && payload.action.startsWith('Milestone:')) {
            const candidate = payload.action.replace('Milestone:', '').trim();
            if (validMilestoneCatalog.includes(candidate) && verifyMilestoneEvidence(expId, candidate, payload)) {
                extractedMilestoneId = candidate;
            }
        }

        const isAuthoritativeMilestone = extractedMilestoneId !== null;

        // 2. Telemetry Rate Guardrail & Deduplication
        // Authoritative milestones are NEVER throttled. Ordinary telemetry is throttled within 2s for identical action.
        const actionStr = payload && (payload.action || payload.command || payload.result || stage) || '';
        const throttleKey = `${user.id}:${expId}:${eventType}:${actionStr}`;
        const now = Date.now();

        if (!isAuthoritativeMilestone) {
            const lastSeen = telemetryThrottleCache.get(throttleKey);
            if (lastSeen && (now - lastSeen) < THROTTLE_WINDOW_MS) {
                // Suppress duplicate DB insert within 2-second window
                return res.status(200).json({
                    status: 'throttled',
                    deduplicated: true,
                    message: 'Duplicate telemetry event suppressed.'
                });
            }
            telemetryThrottleCache.set(throttleKey, now);
        }

        // 3. Audit Log into simulation_events
        await db.query(
            `INSERT INTO simulation_events (student_id, experiment_id, stage, event_type, event_payload)
             VALUES ($1, $2, $3, $4, $5)`,
            [user.id, expId, String(stage), eventType, JSON.stringify(payload || {})]
        );

        // 4. Milestone Evaluation & Atomic Progress Update
        if (isAuthoritativeMilestone) {
            // Fetch all historical milestones from simulation_events to guarantee zero loss
            const allEvents = await db.query(
                `SELECT stage, event_payload FROM simulation_events 
                 WHERE student_id = $1 AND experiment_id = $2 AND (event_payload->>'action' LIKE 'Milestone:%' OR stage = ANY($3))`,
                [user.id, expId, validMilestoneCatalog]
            );

            const cumulativeMilestones = new Set();
            allEvents.rows.forEach(row => {
                const p = row.event_payload || {};
                const candidate = p.action ? p.action.replace('Milestone:', '').trim() : row.stage;
                if (validMilestoneCatalog.includes(candidate) && verifyMilestoneEvidence(expId, candidate, p)) {
                    cumulativeMilestones.add(candidate);
                }
            });
            cumulativeMilestones.add(extractedMilestoneId);

            const milestonesArray = Array.from(cumulativeMilestones);
            const totalReq = validMilestoneCatalog.length || 5;
            const verifiedCount = milestonesArray.length;
            const simProgress = Math.min(100, Math.round((verifiedCount / totalReq) * 100));
            const isSimComplete = verifiedCount >= totalReq;

            // Check Viva Quiz pass status
            const quizRes = await db.query(
                `SELECT score, total_questions FROM quiz_attempts 
                 WHERE student_id = $1 AND experiment_id = $2 
                 ORDER BY created_at DESC LIMIT 1`,
                [user.id, expId]
            );
            let hasPassedQuiz = false;
            if (quizRes.rows.length > 0) {
                const q = quizRes.rows[0];
                const pct = q.total_questions > 0 ? Math.round((q.score / q.total_questions) * 100) : q.score;
                hasPassedQuiz = pct >= 70;
            }

            const isAcademicComplete = isSimComplete && hasPassedQuiz;
            const status = isAcademicComplete ? 'completed' : 'in_progress';
            const finalProgressPercentage = isAcademicComplete ? 100 : Math.min(85, Math.round(simProgress * 0.85));

            await db.query(
                `INSERT INTO experiment_progress (student_id, experiment_id, status, progress_percentage, completed_milestones, completed_at, last_activity)
                 VALUES ($1, $2, $3, $4, $5, $6, NOW())
                 ON CONFLICT (student_id, experiment_id) DO UPDATE
                 SET status = EXCLUDED.status,
                     progress_percentage = EXCLUDED.progress_percentage,
                     completed_milestones = EXCLUDED.completed_milestones,
                     completed_at = COALESCE(experiment_progress.completed_at, EXCLUDED.completed_at),
                     last_activity = NOW()`,
                [
                    user.id,
                    expId,
                    status,
                    finalProgressPercentage,
                    JSON.stringify(milestonesArray),
                    isAcademicComplete ? new Date().toISOString() : null
                ]
            );

            return res.status(200).json({
                success: true,
                experimentId: expId,
                recordedEvent: eventType,
                milestoneAwarded: extractedMilestoneId,
                verifiedMilestonesCount: verifiedCount,
                completedMilestones: milestonesArray,
                totalRequired: totalReq,
                progressPercentage: finalProgressPercentage,
                status,
                isSimComplete,
                hasPassedQuiz,
                isAcademicComplete
            });
        } else {
            // Ordinary telemetry: update last activity timestamp without touching milestones
            await db.query(
                `INSERT INTO experiment_progress (student_id, experiment_id, status, progress_percentage, completed_milestones, last_activity)
                 VALUES ($1, $2, 'in_progress', 0, '[]'::jsonb, NOW())
                 ON CONFLICT (student_id, experiment_id) DO UPDATE
                 SET last_activity = NOW()`,
                [user.id, expId]
            );

            return res.status(200).json({
                success: true,
                experimentId: expId,
                recordedEvent: eventType,
                milestoneAwarded: null
            });
        }
    } catch (error) {
        console.error('Record event error:', error);
        return res.status(500).json({ error: 'Failed to record simulation event.' });
    }
};
