const { neon } = require('@neondatabase/serverless');
const fs = require('fs');

const env = fs.readFileSync('.env', 'utf8');
env.split('\n').forEach(line => {
    if(line.includes('=')) {
        let [k, ...vArr] = line.split('=');
        let v = vArr.join('=').replace(/"/g, '').trim();
        if(k === 'DATABASE_URL') process.env[k] = v;
    }
});

const sql = neon(process.env.DATABASE_URL);

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

async function reconcile() {
    console.log("Starting DB historical milestone reconciliation...");
    try {
        // Fetch all experiment progress rows
        const progressRows = await sql.query('SELECT student_id, experiment_id, completed_milestones FROM experiment_progress');
        
        // Fetch all simulation events 
        const allEvents = await sql.query("SELECT student_id, experiment_id, stage, event_type, event_payload FROM simulation_events WHERE event_type NOT IN ('EXPERIMENT_OPENED', 'PING_FAILED')");
        
        // Organize events by student+experiment
        const eventsByRef = {};
        allEvents.forEach(e => {
            const key = `${e.student_id}_${e.experiment_id}`;
            if (!eventsByRef[key]) eventsByRef[key] = [];
            eventsByRef[key].push(e);
        });

        let discrepanciesFixed = 0;
        
        for (const row of progressRows) {
            const expId = row.experiment_id;
            const validList = AUTHORITATIVE_MILESTONES[expId] || [];
            
            const existingCumulative = new Set();
            (Array.isArray(row.completed_milestones) ? row.completed_milestones : []).forEach(m => {
                const resolved = resolveMilestone(expId, m.split(':')[0], m.split(':')[1], {});
                resolved.forEach(item => existingCumulative.add(item));
                if (validList.includes(m)) existingCumulative.add(m);
            });
            const oldMilestones = Array.from(existingCumulative).filter(m => validList.includes(m)).sort();

            const newCumulative = new Set([...existingCumulative]);
            const key = `${row.student_id}_${row.experiment_id}`;
            const studentEvents = eventsByRef[key] || [];
            
            studentEvents.forEach(e => {
                const resolved = resolveMilestone(expId, e.stage, e.event_type, e.event_payload);
                resolved.forEach(item => newCumulative.add(item));
            });
            
            const newMilestones = Array.from(newCumulative).filter(m => validList.includes(m)).sort();
            
            if (JSON.stringify(oldMilestones) !== JSON.stringify(newMilestones)) {
                console.log(`Discrepancy found for Student ${row.student_id}, Exp ${expId}:`);
                console.log(`   Old: ${JSON.stringify(oldMilestones)}`);
                console.log(`   New: ${JSON.stringify(newMilestones)}`);
                
                await sql.query(
                    'UPDATE experiment_progress SET completed_milestones = $1 WHERE student_id = $2 AND experiment_id = $3',
                    [JSON.stringify(newMilestones), row.student_id, expId]
                );
                discrepanciesFixed++;
            }
        }
        
        console.log(`Reconciliation Complete. Fixed ${discrepanciesFixed} discrepancies.`);
        
    } catch (e) {
        console.error("Reconciliation Error:", e);
    }
}

reconcile();
