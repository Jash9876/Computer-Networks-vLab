// Experiment 5: Demonstration of Static and Default Routing
// State Machine & Logic Controller

document.addEventListener('DOMContentLoaded', function () {
    'use strict';

    // ── Experiment 5 State Machine ────────────────────────────────
    const exp5State = {
        currentPart: 'A',
        addressingComplete: false,
        subnetDetectiveComplete: false,
        hardwareComplete: false,
        topologyComplete: false,
        staticRoutesConfigured: false,
        defaultRoutesConfigured: false,
        
        // Router Interfaces & State
        routerStates: {
            R0: {
                hostname: 'Router0',
                interfaces: {
                    'GigabitEthernet0/0': { ip: '192.168.10.1', mask: '255.255.255.224', state: 'up' },
                    'GigabitEthernet0/1': { ip: '192.168.10.33', mask: '255.255.255.224', state: 'up' },
                    'Serial0/1/0':        { ip: '192.168.10.65', mask: '255.255.255.224', state: 'up', clockRate: 64000, role: 'DCE' }
                },
                staticRoutes: [],
                defaultRoute: null
            },
            R1: {
                hostname: 'Router1',
                interfaces: {
                    'GigabitEthernet0/0': { ip: '192.168.10.97', mask: '255.255.255.224', state: 'up' },
                    'GigabitEthernet0/1': { ip: '192.168.10.129', mask: '255.255.255.224', state: 'up' },
                    'Serial0/1/0':        { ip: '192.168.10.66', mask: '255.255.255.224', state: 'up', clockRate: 0, role: 'DTE' }
                },
                staticRoutes: [],
                defaultRoute: null
            }
        },

        activeRouterKey: 'R0',
        cliMode: 'user_exec',
        cliInterface: null,
        cliHistory: [],
        historyIndex: -1
    };

    // ── Observation Logger ────────────────────────────────────────
    function obs(component, action, result) {
        if (typeof addObservation === 'function') {
            addObservation(component, action, result);
        }
    }

    function nodes() {
        return (window.Topology && window.Topology.nodes) ? window.Topology.nodes : {};
    }

    function edges() {
        return (window.Topology && window.Topology.edges) ? window.Topology.edges : [];
    }

    // ── Part Tab Switching ────────────────────────────────────────
    const navButtons = document.querySelectorAll('.exp5-nav-btn');
    const partContainers = {
        'A': document.getElementById('part-a-container'),
        'B': document.getElementById('part-b-container'),
        'C': document.getElementById('part-c-container'),
        'D': document.getElementById('part-d-container'),
        'E': document.getElementById('part-e-container')
    };

    function setPart(partKey) {
        exp5State.currentPart = partKey;
        navButtons.forEach(btn => {
            if (btn.dataset.part === partKey) {
                btn.style.backgroundColor = 'var(--primary-color)';
                btn.style.color = 'white';
            } else {
                btn.style.backgroundColor = 'var(--secondary-color)';
                btn.style.color = '#E5E7EB';
            }
        });

        Object.keys(partContainers).forEach(key => {
            if (partContainers[key]) {
                partContainers[key].style.display = (key === partKey) ? 'block' : 'none';
            }
        });

        if (partKey === 'D') {
            populatePingSources();
        }
    }

    navButtons.forEach(btn => {
        btn.addEventListener('click', () => setPart(btn.dataset.part));
    });

    // ── PART A: Addressing & Subnet Detective ─────────────────────
    const checkAddrBtn = document.getElementById('check-exp5-addressing');
    const fbAddr = document.getElementById('feedback-exp5-addressing');

    if (checkAddrBtn) {
        checkAddrBtn.addEventListener('click', () => {
            const p0ip = document.getElementById('match-pc0-ip').value;
            const p0gw = document.getElementById('match-pc0-gw').value;
            const p1ip = document.getElementById('match-pc1-ip').value;
            const p1gw = document.getElementById('match-pc1-gw').value;
            const p2ip = document.getElementById('match-pc2-ip').value;
            const p2gw = document.getElementById('match-pc2-gw').value;
            const p3ip = document.getElementById('match-pc3-ip').value;
            const p3gw = document.getElementById('match-pc3-gw').value;

            const isCorrect = (
                p0ip === '192.168.10.2' && p0gw === '192.168.10.1' &&
                p1ip === '192.168.10.34' && p1gw === '192.168.10.33' &&
                p2ip === '192.168.10.98' && p2gw === '192.168.10.97' &&
                p3ip === '192.168.10.130' && p3gw === '192.168.10.129'
            );

            if (isCorrect) {
                fbAddr.style.color = '#059669';
                fbAddr.textContent = '✔ Addressing Match Verified! All 4 PCs configured with correct /27 IP & Gateway.';
                exp5State.addressingComplete = true;
                obs('Addressing Match', 'Matched 4 PCs to /27 subnets', 'Passed');
            } else {
                fbAddr.style.color = '#DC2626';
                fbAddr.textContent = '✘ Incorrect mapping. Check: PC0(.2/GW.1), PC1(.34/GW.33), PC2(.98/GW.97), PC3(.130/GW.129).';
            }
        });
    }

    const checkSubDetBtn = document.getElementById('check-exp5-subnet-detective');
    const fbSubDet = document.getElementById('feedback-exp5-subnet-detective');

    if (checkSubDetBtn) {
        checkSubDetBtn.addEventListener('click', () => {
            const subChoice = document.getElementById('detect-subnet-choice').value;
            const locChoice = document.getElementById('detect-locality-choice').value;

            if (subChoice === '96' && locChoice === 'remote') {
                fbSubDet.style.color = '#059669';
                fbSubDet.textContent = '✔ Correct! 192.168.10.98 is on 192.168.10.96/27, which is a Remote Network behind Router1.';
                exp5State.subnetDetectiveComplete = true;
                obs('Subnet Detective', 'Classified 192.168.10.98/27', 'Remote Network behind Router1');
            } else {
                fbSubDet.style.color = '#DC2626';
                fbSubDet.textContent = '✘ Incorrect. 192.168.10.98 belongs to 192.168.10.96/27 (Subnet 4) and is REMOTE to Router0.';
            }
        });
    }

    // ── PART B: Hardware Preparation & Topology Builder ───────────
    const checkHwBtn = document.getElementById('check-exp5-hardware');
    const fbHw = document.getElementById('feedback-exp5-hardware');

    if (checkHwBtn) {
        checkHwBtn.addEventListener('click', () => {
            const modR0 = document.getElementById('hw-module-r0').value;
            const modR1 = document.getElementById('hw-module-r1').value;

            if (modR0 === 'serial' && modR1 === 'serial') {
                fbHw.style.color = '#059669';
                fbHw.textContent = '✔ Hardware Installed! WIC-2T Serial Module active in Slot 0 on Router0 and Router1 (Serial0/1/0 available).';
                exp5State.hardwareComplete = true;
                obs('Hardware Module', 'Installed WIC-2T Serial in R0 & R1', 'Serial0/1/0 Enabled');
            } else {
                fbHw.style.color = '#DC2626';
                fbHw.textContent = '✘ Please install the "2-Port Serial WAN Interface Card (WIC-2T)" on both Router0 and Router1.';
            }
        });
    }

    // Topology Checker
    const checkTopoBtn = document.getElementById('check-topology');
    const resetTopoBtn = document.getElementById('reset-topology');
    const topoFeedback = document.getElementById('topology-feedback');

    function isConnected(id1, id2, cableReq) {
        return edges().some(e => 
            ((e.sourceId === id1 && e.targetId === id2) || (e.sourceId === id2 && e.targetId === id1)) &&
            (!cableReq || e.cableType === cableReq)
        );
    }

    if (checkTopoBtn) {
        checkTopoBtn.addEventListener('click', () => {
            const allNodes = nodes();
            let pcList = [], routerList = [];

            for (let id in allNodes) {
                const n = allNodes[id];
                if (n.type === 'PC') pcList.push({ id, label: n.label || '' });
                if (n.type === 'Router') routerList.push({ id, label: n.label || '' });
            }

            if (pcList.length !== 4 || routerList.length !== 2) {
                topoFeedback.style.color = '#DC2626';
                topoFeedback.textContent = `✘ Need 4 PCs (PC0..PC3) and 2 Routers (Router0, Router1). (Found ${pcList.length} PCs, ${routerList.length} Routers)`;
                return;
            }

            const r0 = routerList.find(r => r.label === 'Router0') || routerList[0];
            const r1 = routerList.find(r => r.label === 'Router1') || routerList[1];

            const pc0 = pcList.find(p => p.label === 'PC0');
            const pc1 = pcList.find(p => p.label === 'PC1');
            const pc2 = pcList.find(p => p.label === 'PC2');
            const pc3 = pcList.find(p => p.label === 'PC3');

            const serialConn = isConnected(r0.id, r1.id, 'serial');
            if (!serialConn) {
                topoFeedback.style.color = '#DC2626';
                topoFeedback.textContent = '✘ Router0 and Router1 must be connected with a Serial DCE cable.';
                return;
            }

            if (pc0 && !isConnected(pc0.id, r0.id, 'crossover')) {
                topoFeedback.style.color = '#DC2626';
                topoFeedback.textContent = '✘ PC0 must be connected to Router0 via Crossover cable.';
                return;
            }
            if (pc1 && !isConnected(pc1.id, r0.id, 'crossover')) {
                topoFeedback.style.color = '#DC2626';
                topoFeedback.textContent = '✘ PC1 must be connected to Router0 via Crossover cable.';
                return;
            }
            if (pc2 && !isConnected(pc2.id, r1.id, 'crossover')) {
                topoFeedback.style.color = '#DC2626';
                topoFeedback.textContent = '✘ PC2 must be connected to Router1 via Crossover cable.';
                return;
            }
            if (pc3 && !isConnected(pc3.id, r1.id, 'crossover')) {
                topoFeedback.style.color = '#DC2626';
                topoFeedback.textContent = '✘ PC3 must be connected to Router1 via Crossover cable.';
                return;
            }

            topoFeedback.style.color = '#059669';
            topoFeedback.innerHTML = '✔ WAN Topology Verified!<br>✓ PC0 &amp; PC1 &harr; Router0 (LAN 1 &amp; 2)<br>✓ Router0 &harr; Router1 (Serial WAN Link)<br>✓ PC2 &amp; PC3 &harr; Router1 (LAN 3 &amp; 4)';
            exp5State.topologyComplete = true;
            obs('Topology Builder', 'Constructed 4-PC 2-Router WAN Topology', 'Verified');
        });
    }

    if (resetTopoBtn) {
        resetTopoBtn.addEventListener('click', () => {
            topoFeedback.textContent = '';
        });
    }

    // ── PART C: Static Routing Lab ────────────────────────────────
    const checkStaticRoutesBtn = document.getElementById('check-exp5-static-routes');
    const fbStaticRoutes = document.getElementById('feedback-exp5-static-routes');

    if (checkStaticRoutesBtn) {
        checkStaticRoutesBtn.addEventListener('click', () => {
            const r0h1 = document.getElementById('route-r0-hop1').value;
            const r0h2 = document.getElementById('route-r0-hop2').value;
            const r1h1 = document.getElementById('route-r1-hop1').value;
            const r1h2 = document.getElementById('route-r1-hop2').value;

            const isCorrect = (
                r0h1 === '192.168.10.66' && r0h2 === '192.168.10.66' &&
                r1h1 === '192.168.10.65' && r1h2 === '192.168.10.65'
            );

            if (isCorrect) {
                fbStaticRoutes.style.color = '#059669';
                fbStaticRoutes.textContent = '✔ Correct! Static routes formulated. Applied to router routing tables.';
                
                // Add to internal state
                exp5State.routerStates.R0.staticRoutes = [
                    { network: '192.168.10.96', mask: '255.255.255.224', nextHop: '192.168.10.66' },
                    { network: '192.168.10.128', mask: '255.255.255.224', nextHop: '192.168.10.66' }
                ];
                exp5State.routerStates.R1.staticRoutes = [
                    { network: '192.168.10.0', mask: '255.255.255.224', nextHop: '192.168.10.65' },
                    { network: '192.168.10.32', mask: '255.255.255.224', nextHop: '192.168.10.65' }
                ];
                exp5State.staticRoutesConfigured = true;
                obs('Static Routing', 'Formulated bi-directional static routes', 'Applied via .66 and .65');
            } else {
                fbStaticRoutes.style.color = '#DC2626';
                fbStaticRoutes.textContent = '✘ Incorrect next-hop. Router0 forwards via 192.168.10.66; Router1 returns via 192.168.10.65.';
            }
        });
    }

    // Dual Router CLI
    const terminalOutput = document.getElementById('terminal-output');
    const terminalInput = document.getElementById('terminal-input');
    const terminalPrompt = document.getElementById('terminal-prompt');
    const swR0 = document.getElementById('sw-r0');
    const swR1 = document.getElementById('sw-r1');
    const validateRouterBtn = document.getElementById('validate-router-btn');
    const routerValidationOutput = document.getElementById('router-validation-output');

    function updateCliPrompt() {
        const h = exp5State.routerStates[exp5State.activeRouterKey].hostname;
        if (terminalPrompt) {
            switch (exp5State.cliMode) {
                case 'user_exec':    terminalPrompt.textContent = `${h}> `; break;
                case 'priv_exec':    terminalPrompt.textContent = `${h}# `; break;
                case 'global_config':terminalPrompt.textContent = `${h}(config)# `; break;
                case 'if_config':    terminalPrompt.textContent = `${h}(config-if)# `; break;
                default:             terminalPrompt.textContent = `${h}> `;
            }
        }
    }

    function printCliLine(text) {
        if (!terminalOutput) return;
        terminalOutput.textContent += text + '\n';
        const terminal = document.getElementById('terminal');
        if (terminal) terminal.scrollTop = terminal.scrollHeight;
    }

    function switchCliRouter(key) {
        exp5State.activeRouterKey = key;
        exp5State.cliMode = 'user_exec';
        exp5State.cliInterface = null;
        if (terminalOutput) terminalOutput.textContent = '';
        printCliLine(`Connected to ${exp5State.routerStates[key].hostname}. Type ? for help.`);
        printCliLine('');
        updateCliPrompt();

        if (swR0 && swR1) {
            swR0.style.backgroundColor = (key === 'R0') ? 'var(--primary-color)' : 'var(--secondary-color)';
            swR1.style.backgroundColor = (key === 'R1') ? 'var(--primary-color)' : 'var(--secondary-color)';
        }
    }

    if (swR0) swR0.addEventListener('click', () => switchCliRouter('R0'));
    if (swR1) swR1.addEventListener('click', () => switchCliRouter('R1'));

    if (terminalInput) {
        terminalInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const raw = terminalInput.value;
                const cmd = raw.trim();
                terminalInput.value = '';

                printCliLine(terminalPrompt.textContent + raw);

                if (cmd !== '') {
                    exp5State.cliHistory.unshift(cmd);
                    if (exp5State.cliHistory.length > 50) exp5State.cliHistory.pop();
                    processCliCommand(cmd);
                }
                exp5State.historyIndex = -1;
                updateCliPrompt();
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                if (exp5State.historyIndex < exp5State.cliHistory.length - 1) exp5State.historyIndex++;
                terminalInput.value = exp5State.cliHistory[exp5State.historyIndex] || '';
            } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                if (exp5State.historyIndex > 0) exp5State.historyIndex--;
                else exp5State.historyIndex = -1;
                terminalInput.value = exp5State.historyIndex >= 0 ? exp5State.cliHistory[exp5State.historyIndex] : '';
            }
        });
    }

    function processCliCommand(raw) {
        const lower = raw.toLowerCase().trim();
        const parts = lower.split(/\s+/);
        const cmd = parts[0];
        const rState = exp5State.routerStates[exp5State.activeRouterKey];

        if (cmd === '?') {
            if (exp5State.cliMode === 'user_exec') {
                printCliLine('Available commands:');
                printCliLine('  enable                    - Enter privileged EXEC mode');
            } else if (exp5State.cliMode === 'priv_exec') {
                printCliLine('Available commands:');
                printCliLine('  configure terminal        - Enter global configuration mode');
                printCliLine('  show ip route             - Display IP routing table');
                printCliLine('  show ip interface brief   - Display summary of interfaces');
                printCliLine('  show controllers serial 0/1/0 - Display DCE/DTE status and clock rate');
                printCliLine('  disable                   - Return to user EXEC');
            } else if (exp5State.cliMode === 'global_config') {
                printCliLine('Available commands:');
                printCliLine('  ip route <net> <mask> <nexthop> - Add static or default route');
                printCliLine('  no ip route <net> <mask> <nexthop> - Remove route');
                printCliLine('  interface <ifname>        - Select interface to configure');
                printCliLine('  exit                      - Return to priv EXEC');
            }
            return;
        }

        if (exp5State.cliMode === 'user_exec') {
            if (cmd === 'enable' || cmd === 'en') {
                exp5State.cliMode = 'priv_exec';
            } else {
                printCliLine(`% Unknown command: "${raw}". Type ? for help.`);
            }
        } else if (exp5State.cliMode === 'priv_exec') {
            if (cmd === 'configure' && (parts[1] === 'terminal' || parts[1] === 't' || !parts[1])) {
                exp5State.cliMode = 'global_config';
                printCliLine('Enter configuration commands, one per line. End with CNTL/Z.');
            } else if (cmd === 'show' && parts[1] === 'ip' && parts[2] === 'route') {
                printRoutingTable(rState);
            } else if (cmd === 'show' && parts[1] === 'ip' && parts[2] === 'interface' && parts[3] === 'brief') {
                printInterfaceBrief(rState);
            } else if (cmd === 'show' && parts[1] === 'controllers' && parts[2] === 'serial') {
                printControllers(rState);
            } else if (cmd === 'disable' || cmd === 'exit') {
                exp5State.cliMode = 'user_exec';
            } else {
                printCliLine(`% Unknown command: "${raw}". Type ? for help.`);
            }
        } else if (exp5State.cliMode === 'global_config') {
            if (cmd === 'ip' && parts[1] === 'route') {
                const orig = raw.trim().split(/\s+/);
                if (orig.length >= 5) {
                    const net = orig[2];
                    const mask = orig[3];
                    const hop = orig[4];

                    if (net === '0.0.0.0' && mask === '0.0.0.0') {
                        rState.defaultRoute = { nextHop: hop };
                        printCliLine('');
                        obs('CLI Default Route', `ip route 0.0.0.0 0.0.0.0 ${hop}`, 'Success');
                    } else {
                        rState.staticRoutes = rState.staticRoutes.filter(r => !(r.network === net && r.mask === mask));
                        rState.staticRoutes.push({ network: net, mask: mask, nextHop: hop });
                        printCliLine('');
                        obs('CLI Static Route', `ip route ${net} ${mask} ${hop}`, 'Success');
                    }
                } else {
                    printCliLine('% Incomplete command. Syntax: ip route <network> <mask|0.0.0.0> <next-hop>');
                }
            } else if (cmd === 'no' && parts[1] === 'ip' && parts[2] === 'route') {
                rState.staticRoutes = [];
                rState.defaultRoute = null;
                printCliLine('');
            } else if (cmd === 'exit' || cmd === 'end') {
                exp5State.cliMode = 'priv_exec';
            } else {
                printCliLine(`% Unknown command: "${raw}". Type ? for help.`);
            }
        }
    }

    function printRoutingTable(rState) {
        printCliLine('Codes: C - connected, S - static, S* - candidate default');
        printCliLine('');
        if (rState.defaultRoute) {
            printCliLine(`Gateway of last resort is ${rState.defaultRoute.nextHop} to network 0.0.0.0`);
        } else {
            printCliLine('Gateway of last resort is not set');
        }
        printCliLine('');

        for (const ifName in rState.interfaces) {
            const iface = rState.interfaces[ifName];
            if (iface.state === 'up' && iface.ip) {
                const parts = iface.ip.split('.').map(Number);
                const maskParts = iface.mask.split('.').map(Number);
                const net = parts.map((p, i) => p & maskParts[i]).join('.');
                printCliLine(`C    ${net}/27 is directly connected, ${ifName}`);
            }
        }

        rState.staticRoutes.forEach(r => {
            printCliLine(`S    ${r.network}/27 [1/0] via ${r.nextHop}`);
        });

        if (rState.defaultRoute) {
            printCliLine(`S*   0.0.0.0/0 [1/0] via ${rState.defaultRoute.nextHop}`);
        }
    }

    function printInterfaceBrief(rState) {
        printCliLine('Interface                  IP-Address      OK? Method Status                Protocol');
        for (const ifName in rState.interfaces) {
            const iface = rState.interfaces[ifName];
            const ip = iface.ip.padEnd(16);
            printCliLine(`${ifName.padEnd(27)}${ip}YES manual up                    up`);
        }
    }

    function printControllers(rState) {
        printCliLine('Interface Serial0/1/0');
        const role = rState.interfaces['Serial0/1/0'].role;
        printCliLine(`Hardware is PowerQUICC MPC860`);
        printCliLine(`Cable type: ${role === 'DCE' ? 'V.35 DCE cable (clock rate 64000)' : 'V.35 DTE cable'}`);
    }

    if (validateRouterBtn) {
        validateRouterBtn.addEventListener('click', () => {
            const rState = exp5State.routerStates[exp5State.activeRouterKey];
            const hasStatic = rState.staticRoutes.length > 0;
            const hasDef = rState.defaultRoute !== null;

            routerValidationOutput.style.display = 'block';
            routerValidationOutput.style.padding = '0.75rem';
            routerValidationOutput.style.borderRadius = '6px';

            if (hasStatic || hasDef) {
                routerValidationOutput.style.background = '#D1FAE5';
                routerValidationOutput.style.color = '#065F46';
                routerValidationOutput.style.border = '1px solid #34D399';
                routerValidationOutput.innerHTML = `<strong>${rState.hostname} Validation Passed ✔</strong><br>Routing entries active: ${hasStatic ? `${rState.staticRoutes.length} static route(s)` : ''} ${hasDef ? '1 default route (0.0.0.0/0)' : ''}`;
            } else {
                routerValidationOutput.style.background = '#FEF3C7';
                routerValidationOutput.style.color = '#92400E';
                routerValidationOutput.style.border = '1px solid #FCD34D';
                routerValidationOutput.innerHTML = `<strong>${rState.hostname} Notice ⚠</strong><br>No static or default routes configured yet. Add routes via "ip route ...".`;
            }
        });
    }

    // ── PART D: Packet Journey & ICMP Verification ────────────────
    const journeySrc = document.getElementById('journey-src');
    const journeyDest = document.getElementById('journey-dest');
    const startJourneyBtn = document.getElementById('start-journey-btn');
    const journeyStepsBox = document.getElementById('journey-steps-box');

    if (startJourneyBtn) {
        startJourneyBtn.addEventListener('click', () => {
            const src = journeySrc.value;
            const dest = journeyDest.value;

            const r0HasRoute = (exp5State.routerStates.R0.staticRoutes.length > 0 || exp5State.routerStates.R0.defaultRoute !== null || exp5State.staticRoutesConfigured || exp5State.defaultRoutesConfigured);
            const r1HasReturn = (exp5State.routerStates.R1.staticRoutes.length > 0 || exp5State.routerStates.R1.defaultRoute !== null || exp5State.staticRoutesConfigured || exp5State.defaultRoutesConfigured);

            journeyStepsBox.innerHTML = '';

            const steps = [
                `[1] SOURCE HOST: ${src.toUpperCase()} generates ICMP Echo Request for Destination ${dest === 'pc2' ? '192.168.10.98 (PC2)' : '192.168.10.130 (PC3)'}`,
                `[2] DEFAULT GATEWAY: Packet sent to Local Gateway 192.168.10.1 (Router0 GigabitEthernet0/0)`,
                `[3] ROUTER0 LOOKUP: Destination ${dest === 'pc2' ? '192.168.10.98' : '192.168.10.130'} is a Remote Subnet (/27)`,
                r0HasRoute 
                    ? `[4] ROUTE MATCH: Matched Static/Default Route -> Next Hop 192.168.10.66 via Serial0/1/0` 
                    : `[4] ROUTE FAILED: No route to remote network. Router0 drops packet (ICMP Destination Unreachable)`,
                r0HasRoute ? `[5] WAN TRANSIT: Packet traverses Serial WAN link (V.35 DCE clock 64000) -> Router1` : null,
                r0HasRoute ? `[6] ROUTER1 FORWARD: Router1 delivers packet to directly connected interface -> ${dest.toUpperCase()}` : null,
                (r0HasRoute && r1HasReturn)
                    ? `[7] RETURN PATH: ${dest.toUpperCase()} replies via Gateway -> Router1 -> Next Hop 192.168.10.65 -> Router0 -> ${src.toUpperCase()} (ROUND TRIP COMPLETE ✔)`
                    : (r0HasRoute ? `[7] RETURN FAILED: Router1 has no return route back to source subnet. Echo Reply dropped at Router1 ✘` : null)
            ].filter(Boolean);

            let i = 0;
            const interval = setInterval(() => {
                if (i >= steps.length) {
                    clearInterval(interval);
                    obs('Packet Journey Inspector', `Traced ${src.toUpperCase()} to ${dest.toUpperCase()}`, (r0HasRoute && r1HasReturn) ? 'Success' : 'Route Missing');
                    return;
                }
                journeyStepsBox.innerHTML += `<div>${steps[i]}</div>`;
                i++;
            }, 600);
        });
    }

    // Ping Tool
    const pingSource = document.getElementById('ping-source');
    const pingDest = document.getElementById('ping-dest');
    const sendPingBtn = document.getElementById('send-ping-btn');
    const pingOutput = document.getElementById('ping-output');
    const troubleshooterOutput = document.getElementById('troubleshooter-output');

    function populatePingSources() {
        if (!pingSource) return;
        pingSource.innerHTML = '<option value="">-- Select Source PC --</option>';
        for (const id in nodes()) {
            const n = nodes()[id];
            if (n.type === 'PC') {
                const opt = document.createElement('option');
                opt.value = id;
                opt.textContent = `${n.label || id} (IP: ${n.ip || 'not set'})`;
                pingSource.appendChild(opt);
            }
        }
        if (pingSource.options.length <= 1) {
            // Default choices if canvas not yet built
            pingSource.innerHTML += '<option value="pc0">PC0 (192.168.10.2 /27)</option>';
            pingSource.innerHTML += '<option value="pc1">PC1 (192.168.10.34 /27)</option>';
        }
    }

    if (sendPingBtn) {
        sendPingBtn.addEventListener('click', () => {
            const destIp = (pingDest ? pingDest.value.trim() : '');
            if (!destIp) {
                pingOutput.innerHTML = '<span style="color:#F87171">Enter destination IP (e.g. 192.168.10.98).</span>';
                return;
            }

            const r0HasRoute = (exp5State.routerStates.R0.staticRoutes.length > 0 || exp5State.routerStates.R0.defaultRoute !== null || exp5State.staticRoutesConfigured || exp5State.defaultRoutesConfigured);
            const r1HasReturn = (exp5State.routerStates.R1.staticRoutes.length > 0 || exp5State.routerStates.R1.defaultRoute !== null || exp5State.staticRoutesConfigured || exp5State.defaultRoutesConfigured);

            pingOutput.innerHTML = `Pinging ${destIp} with 32 bytes of data:<br><br>`;
            troubleshooterOutput.style.display = 'none';

            let count = 0;
            const total = 4;
            const success = (r0HasRoute && r1HasReturn);

            const interval = setInterval(() => {
                if (count >= total) {
                    clearInterval(interval);
                    pingOutput.innerHTML += `<br>Ping statistics for ${destIp}:<br>`;
                    pingOutput.innerHTML += `&nbsp;&nbsp;&nbsp;&nbsp;Packets: Sent = 4, Received = ${success ? 4 : 0}, Lost = ${success ? 0 : 4} (${success ? 0 : 100}% loss)<br>`;
                    
                    troubleshooterOutput.style.display = 'block';
                    if (success) {
                        troubleshooterOutput.style.background = '#D1FAE5';
                        troubleshooterOutput.style.color = '#065F46';
                        troubleshooterOutput.style.border = '1px solid #34D399';
                        troubleshooterOutput.innerHTML = '<strong>✔ Ping Successful!</strong> End-to-end Layer 3 reachability verified across WAN serial link.';
                        updateExp5Result();
                    } else {
                        troubleshooterOutput.style.background = '#FEE2E2';
                        troubleshooterOutput.style.color = '#991B1B';
                        troubleshooterOutput.style.border = '1px solid #F87171';
                        troubleshooterOutput.innerHTML = '<strong>✘ Ping Failed (Destination Host Unreachable):</strong> Missing forward static route on Router0 (via 192.168.10.66) or return route on Router1 (via 192.168.10.65).';
                    }
                    return;
                }

                if (success) {
                    pingOutput.innerHTML += `Reply from ${destIp}: bytes=32 time&lt;1ms TTL=128<br>`;
                } else {
                    pingOutput.innerHTML += `Request timed out.<br>`;
                }
                count++;
            }, 400);
        });
    }

    // ── PART E: Default Routing & Traceroute Challenge ────────────
    const checkDefBtn = document.getElementById('check-exp5-default-routes');
    const fbDef = document.getElementById('feedback-exp5-default-routes');

    if (checkDefBtn) {
        checkDefBtn.addEventListener('click', () => {
            const r0net = (document.getElementById('def-r0-net').value || '').trim();
            const r0mask = (document.getElementById('def-r0-mask').value || '').trim();
            const r0hop = document.getElementById('def-r0-hop').value;

            const r1net = (document.getElementById('def-r1-net').value || '').trim();
            const r1mask = (document.getElementById('def-r1-mask').value || '').trim();
            const r1hop = document.getElementById('def-r1-hop').value;

            const isCorrect = (
                r0net === '0.0.0.0' && r0mask === '0.0.0.0' && r0hop === '192.168.10.66' &&
                r1net === '0.0.0.0' && r1mask === '0.0.0.0' && r1hop === '192.168.10.65'
            );

            if (isCorrect) {
                fbDef.style.color = '#059669';
                fbDef.textContent = '✔ Default routes verified & applied! Gateway of last resort active on both routers.';
                
                exp5State.routerStates.R0.defaultRoute = { nextHop: '192.168.10.66' };
                exp5State.routerStates.R1.defaultRoute = { nextHop: '192.168.10.65' };
                exp5State.defaultRoutesConfigured = true;
                obs('Default Routing', 'Configured quad-zero routes (0.0.0.0/0)', 'Active via .66 and .65');
            } else {
                fbDef.style.color = '#DC2626';
                fbDef.textContent = '✘ Check syntax: Network=0.0.0.0, Mask=0.0.0.0, R0 next-hop=192.168.10.66, R1 next-hop=192.168.10.65.';
            }
        });
    }

    // Traceroute Challenge
    const runTracertBtn = document.getElementById('run-tracert-btn');
    const tracertOutput = document.getElementById('tracert-output');

    if (runTracertBtn) {
        runTracertBtn.addEventListener('click', () => {
            const hasDefault = (exp5State.routerStates.R0.defaultRoute !== null || exp5State.defaultRoutesConfigured || exp5State.staticRoutesConfigured);

            tracertOutput.innerHTML = 'Tracing route to 192.168.10.130 over a maximum of 30 hops:<br><br>';

            const traceSteps = [
                '  1    &lt;1 ms    &lt;1 ms    &lt;1 ms  192.168.10.1  (Router0 GigabitEthernet0/0 - Gateway)',
                hasDefault 
                    ? '  2     1 ms     1 ms     1 ms  192.168.10.66 (Router1 Serial0/1/0 - WAN Link)' 
                    : '  2     *        *        *     Request timed out. (No route to destination)',
                hasDefault 
                    ? '  3    &lt;1 ms    &lt;1 ms    &lt;1 ms  192.168.10.130 (PC3 - LAN 4 Destination)' 
                    : null,
                hasDefault ? '<br>Trace complete.' : '<br>Trace stopped.'
            ].filter(Boolean);

            let i = 0;
            const interval = setInterval(() => {
                if (i >= traceSteps.length) {
                    clearInterval(interval);
                    obs('Traceroute (tracert)', 'tracert 192.168.10.130 from PC0', hasDefault ? '3 Hops Resolved' : 'Halted at Hop 2');
                    updateExp5Result();
                    return;
                }
                tracertOutput.innerHTML += `<div>${traceSteps[i]}</div>`;
                i++;
            }, 600);
        });
    }

    // ── Update Result Tab ─────────────────────────────────────────
    function updateExp5Result() {
        const resultText = document.getElementById('result-text');
        if (resultText) {
            resultText.innerHTML = '<strong>Exercise 5 Completed Successfully:</strong><br><br>' +
                '1. Static routing entries configured and verified on dual routers using next-hop addresses <code>192.168.10.66</code> and <code>192.168.10.65</code>.<br>' +
                '2. Default routing (<code>0.0.0.0 0.0.0.0</code>) applied and tested as an efficient quad-zero routing strategy for stub networks.<br>' +
                '3. End-to-end hop-by-hop packet traversal and return path validated with <code>ping</code> and <code>tracert</code>.';
        }
        if (typeof PlatformManager !== 'undefined') {
            PlatformManager.markCompleted(5, 100);
        }
    }

    // Initialize Default State
    setPart('A');
    switchCliRouter('R0');
});
