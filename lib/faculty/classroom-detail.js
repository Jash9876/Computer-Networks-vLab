// Faculty Classroom Detail & Student Academic Matrix (GET /api/faculty/classroom/detail?id=...)
const { query } = require('../db');
const { extractUserFromRequest } = require('../auth-utils');

module.exports = async function handler(req, res) {
    res.setHeader('Content-Type', 'application/json');

    const allowedOrigin = process.env.ALLOWED_ORIGIN || '*';
    res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method Not Allowed' });

    const user = extractUserFromRequest(req);
    if (!user || user.role !== 'faculty') {
        return res.status(403).json({ error: 'Unauthorized: Faculty access required.' });
    }

    const classroomId = req.query.id;
    if (!classroomId) {
        return res.status(400).json({ error: 'Classroom ID parameter is required.' });
    }

    try {
        // Enforce Server-Side Ownership Check: Faculty can only see classrooms they own
        const classroomRes = await query(
            `SELECT id, classroom_code, name, section, academic_year, status, created_at
             FROM classrooms
             WHERE id = $1 AND faculty_id = $2`,
            [classroomId, user.id]
        );

        if (classroomRes.rows.length === 0) {
            return res.status(404).json({ error: 'Classroom not found or access denied.' });
        }

        const classroom = classroomRes.rows[0];

        // Fetch Enrolled Students with Experiment Progress Matrix
        const studentsRes = await query(
            `SELECT 
                u.id AS student_id,
                u.register_number,
                u.full_name,
                u.email,
                u.section,
                cm.joined_at,
                cm.last_active,
                -- Aggregate Experiments 1-5 Status, Milestones, and Scores
                COALESCE(
                    json_agg(
                        json_build_object(
                            'experiment_id', ep.experiment_id,
                            'status', ep.status,
                            'progress_percentage', ep.progress_percentage,
                            'completed_milestones', ep.completed_milestones,
                            'completed_at', ep.completed_at,
                            'certificate_code', cert.certificate_code,
                            'final_score', COALESCE(cert.final_score, qa.max_percent),
                            'event_count', COALESCE(se.event_count, 0)
                        )
                    ) FILTER (WHERE ep.experiment_id IS NOT NULL),
                    '[]'
                ) AS experiments_progress
             FROM classroom_members cm
             JOIN users u ON cm.student_id = u.id
             LEFT JOIN experiment_progress ep ON u.id = ep.student_id
             LEFT JOIN certificates cert ON u.id = cert.student_id AND ep.experiment_id = cert.experiment_id
             LEFT JOIN (
                 SELECT student_id, experiment_id, 
                        MAX(CASE WHEN total_questions > 0 THEN ROUND((score::numeric / total_questions) * 100) ELSE score END) AS max_percent
                 FROM quiz_attempts
                 GROUP BY student_id, experiment_id
             ) qa ON qa.student_id = u.id AND qa.experiment_id = ep.experiment_id
             LEFT JOIN (
                 SELECT student_id, experiment_id, COUNT(DISTINCT stage)::int AS event_count
                 FROM simulation_events
                 WHERE event_type NOT IN ('EXPERIMENT_OPENED', 'PING_FAILED')
                 GROUP BY student_id, experiment_id
             ) se ON se.student_id = u.id AND se.experiment_id = ep.experiment_id
             WHERE cm.classroom_id = $1 AND cm.status = 'active'
             GROUP BY u.id, u.register_number, u.full_name, u.email, u.section, cm.joined_at, cm.last_active
             ORDER BY u.register_number ASC`,
            [classroomId]
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

        // Fetch simulation events for all students in this classroom
        const simEventsRes = await query(
            `SELECT se.student_id, se.experiment_id, se.stage, se.event_type, se.event_payload
             FROM simulation_events se
             JOIN classroom_members cm ON cm.student_id = se.student_id
             WHERE cm.classroom_id = $1`,
            [classroomId]
        );
        const eventsByStudentAndExp = {};
        simEventsRes.rows.forEach(e => {
            const key = `${e.student_id}_${e.experiment_id}`;
            if (!eventsByStudentAndExp[key]) eventsByStudentAndExp[key] = [];
            eventsByStudentAndExp[key].push(e);
        });

        // Overall Classroom Stats & Dynamic Progress Sanitization
        const totalStudents = studentsRes.rows.length;
        let totalCompletedExps = 0;

        const sanitizedStudents = studentsRes.rows.map(s => {
            let userCompExps = 0;
            const sanitizedExps = (Array.isArray(s.experiments_progress) ? s.experiments_progress : []).map(ep => {
                const expId = ep.experiment_id;
                const validList = AUTHORITATIVE_MILESTONES[expId] || [];
                const reqCount = validList.length || 5;

                const cumulative = new Set();
                (Array.isArray(ep.completed_milestones) ? ep.completed_milestones : []).forEach(m => {
                    const resolved = resolveMilestone(expId, m.split(':')[0], m.split(':')[1], {});
                    resolved.forEach(item => cumulative.add(item));
                    if (validList.includes(m)) cumulative.add(m);
                });

                const studentKey = `${s.student_id}_${expId}`;
                (eventsByStudentAndExp[studentKey] || []).forEach(e => {
                    const resolved = resolveMilestone(expId, e.stage, e.event_type, e.event_payload);
                    resolved.forEach(item => cumulative.add(item));
                });

                const milestones = Array.from(cumulative).filter(m => validList.includes(m));
                const mCount = milestones.length;
                const isSimComplete = mCount >= reqCount;
                const vivaScore = Number(ep.final_score) || 0;
                const isVivaPassed = vivaScore >= 70;

                const isAcademicComplete = isSimComplete && isVivaPassed;

                if (isAcademicComplete) {
                    totalCompletedExps++;
                    userCompExps++;
                }

                return {
                    ...ep,
                    status: isAcademicComplete ? 'completed' : (mCount > 0 ? 'in_progress' : 'not_started'),
                    progress_percentage: isAcademicComplete ? 100 : Math.min(85, Math.round((mCount / reqCount) * 85)),
                    completed_milestones: milestones,
                    isSimComplete,
                    isVivaPassed,
                    isAcademicComplete,
                    certificate_code: isAcademicComplete ? ep.certificate_code : null
                };
            });

            return {
                ...s,
                experiments_progress: sanitizedExps,
                completed_count: userCompExps
            };
        });

        const maxPossibleExps = totalStudents * 6;
        const classCompletionRate = maxPossibleExps > 0 ? Math.round((totalCompletedExps / maxPossibleExps) * 100) : 0;

        return res.status(200).json({
            success: true,
            classroom,
            stats: {
                totalStudents,
                totalCompletedExps,
                classCompletionRate
            },
            students: sanitizedStudents
        });
    } catch (error) {
        console.error('Classroom detail error:', error);
        return res.status(500).json({ error: 'Failed to retrieve classroom details from database.' });
    }
};
