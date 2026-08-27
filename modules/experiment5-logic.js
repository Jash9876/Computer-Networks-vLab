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
                fbAddr.textContent = '💡 Hint: Each PC host IP must belong to its respective LAN subnet range, and its Default Gateway must match the local GigabitEthernet interface of its connected router.';
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
                fbSubDet.textContent = '💡 Hint: A /27 mask creates blocks of 32 (0, 32, 64, 96, 128...). Where does .98 fall? Also check if that LAN is directly connected to Router0 or separated by the WAN link.';
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
                fbStaticRoutes.textContent = '💡 Hint: The Next-Hop IP must always be the neighboring router interface on the WAN serial link (Router1 S0/1/0 is .66, Router0 S0/1/0 is .65).';
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
                        rState.staticRoutes = [];
                        rState.defaultRoute = { nextHop: hop };
                        if (exp5State.routerStates.R0.defaultRoute && exp5State.routerStates.R1.defaultRoute) {
                            exp5State.defaultRoutesConfigured = true;
                        }
                        printCliLine('');
                        obs('CLI Default Route', `ip route 0.0.0.0 0.0.0.0 ${hop}`, 'Success (Replaced Static Routes)');
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

    // Helper to extract /27 subnet base IP
    function getSubnet27(ip) {
        if (!ip) return null;
        const parts = ip.trim().split('.').map(Number);
        if (parts.length !== 4 || parts.some(isNaN)) return null;
        const last = parts[3] & 224;
        return `${parts[0]}.${parts[1]}.${parts[2]}.${last}`;
    }

    // Strict Layer 3 route lookup function for a given router
    function lookupRoute(routerKey, destIp) {
        const rState = exp5State.routerStates[routerKey];
        if (!rState) return null;
        const targetSubnet = getSubnet27(destIp);
        if (!targetSubnet) return null;

        // 1. Check directly connected interfaces
        for (const ifName in rState.interfaces) {
            const iface = rState.interfaces[ifName];
            if (iface.state === 'up' && getSubnet27(iface.ip) === targetSubnet) {
                return { type: 'connected', ifName, nextHop: 'direct' };
            }
        }

        // 2. Check specific static routes
        const matchedStatic = rState.staticRoutes.find(r => r.network === targetSubnet);
        if (matchedStatic) {
            // Check next-hop validity (must point to valid serial neighbor)
            const validNextHop = (routerKey === 'R0') ? '192.168.10.66' : '192.168.10.65';
            if (matchedStatic.nextHop === validNextHop) {
                return { type: 'static', nextHop: matchedStatic.nextHop, ifName: 'Serial0/1/0' };
            }
        }

        // 3. Check candidate default route (Gateway of Last Resort)
        if (rState.defaultRoute) {
            const validNextHop = (routerKey === 'R0') ? '192.168.10.66' : '192.168.10.65';
            if (rState.defaultRoute.nextHop === validNextHop) {
                return { type: 'default', nextHop: rState.defaultRoute.nextHop, ifName: 'Serial0/1/0' };
            }
        }

        return null; // No route to destination (unreachable)
    }

    if (validateRouterBtn) {
        validateRouterBtn.addEventListener('click', () => {
            const rKey = exp5State.activeRouterKey;
            const rState = exp5State.routerStates[rKey];

            routerValidationOutput.style.display = 'block';
            routerValidationOutput.style.padding = '0.75rem';
            routerValidationOutput.style.borderRadius = '6px';

            const expectedStatic = (rKey === 'R0')
                ? [{ net: '192.168.10.96', hop: '192.168.10.66' }, { net: '192.168.10.128', hop: '192.168.10.66' }]
                : [{ net: '192.168.10.0', hop: '192.168.10.65' }, { net: '192.168.10.32', hop: '192.168.10.65' }];

            const validStaticCount = expectedStatic.filter(exp => 
                rState.staticRoutes.some(r => r.network === exp.net && r.nextHop === exp.hop)
            ).length;

            const hasValidDef = (rState.defaultRoute && rState.defaultRoute.nextHop === ((rKey === 'R0') ? '192.168.10.66' : '192.168.10.65'));

            if (validStaticCount === 2 || hasValidDef) {
                routerValidationOutput.style.background = '#D1FAE5';
                routerValidationOutput.style.color = '#065F46';
                routerValidationOutput.style.border = '1px solid #34D399';
                routerValidationOutput.innerHTML = `<strong>${rState.hostname} Routing Validation Passed ✔</strong><br>` +
                    (hasValidDef 
                        ? `Default Route Active: <code>0.0.0.0/0 &rarr; ${rState.defaultRoute.nextHop}</code>`
                        : `Static Routes Active: 2 /27 remote networks mapped via <code>${expectedStatic[0].hop}</code>`);
            } else {
                routerValidationOutput.style.background = '#FEF3C7';
                routerValidationOutput.style.color = '#92400E';
                routerValidationOutput.style.border = '1px solid #FCD34D';
                routerValidationOutput.innerHTML = `<strong>${rState.hostname} Configuration Incomplete ⚠</strong><br>` +
                    `Missing routes to remote LANs. Ensure you run: <code>ip route &lt;remote-net&gt; 255.255.255.224 ${(rKey === 'R0') ? '192.168.10.66' : '192.168.10.65'}</code> or a default route.`;
            }
        });
    }

    // ── PART D: Packet Journey & ICMP Verification ────────────────
    const journeySrc = document.getElementById('journey-src');
    const journeyDest = document.getElementById('journey-dest');
    const startJourneyBtn = document.getElementById('start-journey-btn');
    const journeyStepsBox = document.getElementById('journey-steps-box');

    const hostIpMap = {
        'pc0': '192.168.10.2',
        'pc1': '192.168.10.34',
        'pc2': '192.168.10.98',
        'pc3': '192.168.10.130'
    };

    const hostGwMap = {
        'pc0': { gw: '192.168.10.1', ifName: 'GigabitEthernet0/0 (Router0)', router: 'R0' },
        'pc1': { gw: '192.168.10.33', ifName: 'GigabitEthernet0/1 (Router0)', router: 'R0' },
        'pc2': { gw: '192.168.10.97', ifName: 'GigabitEthernet0/0 (Router1)', router: 'R1' },
        'pc3': { gw: '192.168.10.129', ifName: 'GigabitEthernet0/1 (Router1)', router: 'R1' }
    };

    const subnetRouter = {
        '192.168.10.0': 'R0',
        '192.168.10.32': 'R0',
        '192.168.10.96': 'R1',
        '192.168.10.128': 'R1'
    };

    if (startJourneyBtn) {
        startJourneyBtn.addEventListener('click', () => {
            const src = journeySrc.value;
            const dest = journeyDest.value;
            const srcIp = hostIpMap[src] || '192.168.10.2';
            const destIp = hostIpMap[dest] || '192.168.10.98';
            const srcGwInfo = hostGwMap[src] || hostGwMap['pc0'];
            const destGwInfo = hostGwMap[dest] || hostGwMap['pc2'];

            const srcSubnet = getSubnet27(srcIp);
            const destSubnet = getSubnet27(destIp);
            const srcRouter = srcGwInfo.router;
            const destRouter = destGwInfo.router;
            const isSameRouter = (srcRouter === destRouter);

            const fwdLookup = lookupRoute(srcRouter, destIp);
            const retLookup = lookupRoute(destRouter, srcIp);

            journeyStepsBox.innerHTML = '';
            const steps = [];

            steps.push(`[1] SOURCE HOST (${src.toUpperCase()} - ${srcIp}): Generates ICMP Echo Request for Destination ${destIp} (${dest.toUpperCase()})`);
            steps.push(`[2] DEFAULT GATEWAY: Packet forwarded to Local Gateway ${srcGwInfo.gw} on ${srcGwInfo.ifName}`);
            steps.push(`[3] ${srcRouter === 'R0' ? 'ROUTER0' : 'ROUTER1'} TABLE LOOKUP: Searching route table for destination subnet ${destSubnet}/27...`);

            if (isSameRouter) {
                // Same Router Local Switching
                steps.push(`[4] ✔ DIRECTLY CONNECTED: ${srcRouter === 'R0' ? 'Router0' : 'Router1'} recognizes ${destSubnet}/27 on local interface ${destGwInfo.ifName}`);
                steps.push(`[5] LOCAL DELIVERY: Packet switched directly to ${dest.toUpperCase()} (${destIp}) without traversing WAN link`);
                steps.push(`[6] RETURN PATH: ${dest.toUpperCase()} replies via Gateway ${destGwInfo.gw} &rarr; local interface &rarr; ${src.toUpperCase()} (ROUND TRIP COMPLETE ✔)`);
            } else {
                // Inter-Router WAN Routing
                const expectedFwdNextHop = (srcRouter === 'R0') ? '192.168.10.66' : '192.168.10.65';
                const expectedRetNextHop = (destRouter === 'R0') ? '192.168.10.66' : '192.168.10.65';

                if (!fwdLookup || fwdLookup.nextHop !== expectedFwdNextHop) {
                    steps.push(`[4] ❌ FORWARD ROUTE FAILED AT ${srcRouter === 'R0' ? 'ROUTER0' : 'ROUTER1'}: No static or default route matching remote subnet ${destSubnet}/27. Packet dropped (ICMP Destination Network Unreachable).`);
                } else {
                    steps.push(`[4] ✔ ${srcRouter === 'R0' ? 'ROUTER0' : 'ROUTER1'} MATCH: Found ${fwdLookup.type.toUpperCase()} route via Next-Hop ${fwdLookup.nextHop} (Serial0/1/0)`);
                    steps.push(`[5] WAN SERIAL TRANSIT: Packet traverses V.35 Serial Link (DCE clock 64000) &rarr; ${destRouter === 'R0' ? 'Router0' : 'Router1'} Serial0/1/0`);
                    steps.push(`[6] ${destRouter === 'R0' ? 'ROUTER0' : 'ROUTER1'} DELIVERY: Router recognizes ${destSubnet}/27 as directly connected on ${destGwInfo.ifName} &rarr; delivers packet to ${dest.toUpperCase()} (${destIp})`);
                    
                    steps.push(`[7] DESTINATION HOST (${dest.toUpperCase()}): Generates ICMP Echo Reply for ${srcIp}`);
                    steps.push(`[8] ${destRouter === 'R0' ? 'ROUTER0' : 'ROUTER1'} RETURN LOOKUP: Searching route table for return subnet ${srcSubnet}/27...`);

                    if (!retLookup || retLookup.nextHop !== expectedRetNextHop) {
                        steps.push(`[9] ❌ RETURN ROUTE FAILED AT ${destRouter === 'R0' ? 'ROUTER0' : 'ROUTER1'}: No static or default route to return to LAN ${srcSubnet}/27. Echo Reply dropped at ${destRouter === 'R0' ? 'Router0' : 'Router1'}.`);
                    } else {
                        steps.push(`[9] ✔ ${destRouter === 'R0' ? 'ROUTER0' : 'ROUTER1'} RETURN MATCH: Found ${retLookup.type.toUpperCase()} return route via Next-Hop ${retLookup.nextHop} (Serial0/1/0)`);
                        steps.push(`[10] WAN RETURN TRANSIT: Reply traverses Serial link &rarr; ${srcRouter === 'R0' ? 'Router0' : 'Router1'} &rarr; delivered to ${src.toUpperCase()} (ROUND TRIP COMPLETE ✔)`);
                    }
                }
            }

            let i = 0;
            const interval = setInterval(() => {
                if (i >= steps.length) {
                    clearInterval(interval);
                    const fullySuccess = isSameRouter || (fwdLookup && fwdLookup.nextHop && retLookup && retLookup.nextHop);
                    obs('Packet Journey Inspector', `Traced ${src.toUpperCase()} (${srcIp}) to ${dest.toUpperCase()} (${destIp})`, fullySuccess ? 'Success' : 'Dropped at Router');
                    return;
                }
                journeyStepsBox.innerHTML += `<div>${steps[i]}</div>`;
                i++;
            }, 550);
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
        pingSource.innerHTML = '';
        const defaultOptions = [
            { id: 'pc0', label: 'PC0 (192.168.10.2 /27)' },
            { id: 'pc1', label: 'PC1 (192.168.10.34 /27)' },
            { id: 'pc2', label: 'PC2 (192.168.10.98 /27)' },
            { id: 'pc3', label: 'PC3 (192.168.10.130 /27)' }
        ];

        defaultOptions.forEach(opt => {
            const el = document.createElement('option');
            el.value = opt.id;
            el.textContent = opt.label;
            pingSource.appendChild(el);
        });
    }

    if (sendPingBtn) {
        sendPingBtn.addEventListener('click', () => {
            const destIp = (pingDest ? pingDest.value.trim() : '');
            if (!destIp) {
                pingOutput.innerHTML = '<span style="color:#F87171">Enter destination IP (e.g. 192.168.10.98 or 192.168.10.130).</span>';
                return;
            }

            const srcId = pingSource.value || 'pc0';
            const srcIp = hostIpMap[srcId] || '192.168.10.2';
            const srcSubnet = getSubnet27(srcIp);
            const destSubnet = getSubnet27(destIp);

            const srcRouter = subnetRouter[srcSubnet] || 'R0';
            const destRouter = destSubnet ? subnetRouter[destSubnet] : null;

            pingOutput.innerHTML = `Pinging ${destIp} from ${srcIp} with 32 bytes of data:<br><br>`;
            troubleshooterOutput.style.display = 'none';

            if (!destSubnet || !destRouter) {
                // Unknown / out-of-topology subnet
                const fwdLookup = lookupRoute(srcRouter, destIp);
                let count = 0;
                const interval = setInterval(() => {
                    if (count >= 4) {
                        clearInterval(interval);
                        pingOutput.innerHTML += `<br>Ping statistics for ${destIp}:<br>&nbsp;&nbsp;&nbsp;&nbsp;Packets: Sent = 4, Received = 0, Lost = 4 (100% loss)<br>`;
                        troubleshooterOutput.style.display = 'block';
                        troubleshooterOutput.style.background = '#FEE2E2';
                        troubleshooterOutput.style.color = '#991B1B';
                        troubleshooterOutput.style.border = '1px solid #F87171';
                        troubleshooterOutput.innerHTML = `<strong>✘ Ping Failed (Destination Host Unreachable):</strong> IP ${destIp} does not belong to any active /27 subnet in the lab topology.`;
                        return;
                    }
                    pingOutput.innerHTML += `Request timed out.<br>`;
                    count++;
                }, 400);
                return;
            }

            const fwdLookup = lookupRoute(srcRouter, destIp);
            const retLookup = lookupRoute(destRouter, srcIp);

            let count = 0;
            const total = 4;
            const success = (fwdLookup && retLookup && (srcRouter === destRouter || (fwdLookup.nextHop && retLookup.nextHop)));

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
                        troubleshooterOutput.innerHTML = `<strong>✔ Ping Successful!</strong> Layer 3 reachability validated between ${srcIp} and ${destIp} across the WAN link.`;
                        updateExp5Result();
                    } else {
                        troubleshooterOutput.style.background = '#FEE2E2';
                        troubleshooterOutput.style.color = '#991B1B';
                        troubleshooterOutput.style.border = '1px solid #F87171';
                        
                        let failureDetail = '';
                        if (!fwdLookup) {
                            failureDetail = `Forward route missing on ${srcRouter} for target subnet ${destSubnet}/27.`;
                        } else if (!retLookup) {
                            failureDetail = `Return route missing on ${destRouter} to return packets back to ${srcSubnet}/27.`;
                        } else {
                            failureDetail = `Next-hop misconfigured on serial link.`;
                        }
                        troubleshooterOutput.innerHTML = `<strong>✘ Ping Failed (Destination Host Unreachable):</strong> ${failureDetail}`;
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
                fbDef.textContent = '✔ Default routes verified & applied! Individual static routes replaced with Gateway of Last Resort.';
                
                // Genuine replacement: clear individual static routes and set default route
                exp5State.routerStates.R0.staticRoutes = [];
                exp5State.routerStates.R1.staticRoutes = [];
                exp5State.routerStates.R0.defaultRoute = { nextHop: '192.168.10.66' };
                exp5State.routerStates.R1.defaultRoute = { nextHop: '192.168.10.65' };
                exp5State.defaultRoutesConfigured = true;
                
                obs('Default Routing', 'Replaced individual static routes with quad-zero (0.0.0.0/0)', 'Active on R0 (.66) & R1 (.65)');
            } else {
                fbDef.style.color = '#DC2626';
                fbDef.textContent = '💡 Hint: A quad-zero default route specifies Network "0.0.0.0" and Mask "0.0.0.0". Ensure Next-Hop points to the neighboring router serial IP (R0->.66, R1->.65).';
            }
        });
    }

    // Traceroute Challenge (strictly requires defaultRoute to be configured)
    const runTracertBtn = document.getElementById('run-tracert-btn');
    const tracertOutput = document.getElementById('tracert-output');

    if (runTracertBtn) {
        runTracertBtn.addEventListener('click', () => {
            // Strict check: Must have genuine default route on R0 and return path on R1
            const r0Def = (exp5State.routerStates.R0.defaultRoute && exp5State.routerStates.R0.defaultRoute.nextHop === '192.168.10.66');
            const r1Def = (exp5State.routerStates.R1.defaultRoute && exp5State.routerStates.R1.defaultRoute.nextHop === '192.168.10.65');
            const hasDefaultRouteActive = (r0Def && r1Def);

            tracertOutput.innerHTML = 'Tracing route to 192.168.10.130 over a maximum of 30 hops:<br><br>';

            const traceSteps = [
                '  1    &lt;1 ms    &lt;1 ms    &lt;1 ms  192.168.10.1  (Router0 GigabitEthernet0/0 - Gateway)',
                hasDefaultRouteActive 
                    ? '  2     1 ms     1 ms     1 ms  192.168.10.66 (Router1 Serial0/1/0 - Default Route Next-Hop)' 
                    : '  2     *        *        *     Request timed out. (Default route 0.0.0.0/0 not active on Router0)',
                hasDefaultRouteActive 
                    ? '  3    &lt;1 ms    &lt;1 ms    &lt;1 ms  192.168.10.130 (PC3 - LAN 4 Destination Host)' 
                    : null,
                hasDefaultRouteActive 
                    ? '<br>Trace complete. (Successfully routed using Gateway of Last Resort 0.0.0.0/0)' 
                    : '<br>Trace halted. Configure and apply the quad-zero default routes in Stage 2 to complete traceroute.'
            ].filter(Boolean);

            let i = 0;
            const interval = setInterval(() => {
                if (i >= traceSteps.length) {
                    clearInterval(interval);
                    obs('Traceroute (tracert)', 'tracert 192.168.10.130 from PC0', hasDefaultRouteActive ? '3 Hops Resolved via 0.0.0.0/0' : 'Halted at Hop 2 (Default Route Missing)');
                    if (hasDefaultRouteActive) {
                        updateExp5Result();
                    }
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
