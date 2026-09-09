// Experiment 10 Logic: Authentic BGP Peering, Link-State Modeling & Route Withdrawal
(function () {
    'use strict';

    // ── Global State for Experiment 10 ─────────────────────────────────────────
    const expState = {
        // Stage Progress
        stage1Complete: false, // Topology
        stage2Complete: false, // Addressing
        stage3Complete: false, // BGP Peering Configured
        stage4Complete: false, // Verification / BGP Table Inspected
        stage5Complete: false, // Link Failure & Withdrawal Tested
        stage6Complete: false, // Cross-AS Ping

        // Active router CLI selected
        activeRouter: 'Router0',

        // WAN Link Physical / Line Status
        wanLinkState: {
            adminStatus: 'up', // 'up' | 'administratively down'
            lineStatus: 'up'   // 'up' | 'down'
        },

        // Router 0 (AS 10) State
        Router0: {
            hostname: 'Router',
            mode: 'user', // 'user', 'priv', 'config', 'config-if', 'config-router'
            activeIf: null,
            asNumber: null,
            interfaces: {
                'GigabitEthernet0/0': { ip: '', mask: '', adminStatus: 'down', lineStatus: 'down' },
                'GigabitEthernet0/1': { ip: '', mask: '', adminStatus: 'down', lineStatus: 'down' }
            },
            bgp: {
                as: null,
                neighbors: {}, // '10.10.10.2': { remoteAs: 20, state: 'Idle' }
                networks: []   // [{ prefix: '192.168.10.0', mask: '255.255.255.0' }]
            }
        },

        // Router 1 (AS 20) State
        Router1: {
            hostname: 'Router',
            mode: 'user',
            activeIf: null,
            asNumber: null,
            interfaces: {
                'GigabitEthernet0/0': { ip: '', mask: '', adminStatus: 'down', lineStatus: 'down' },
                'GigabitEthernet0/1': { ip: '', mask: '', adminStatus: 'down', lineStatus: 'down' }
            },
            bgp: {
                as: null,
                neighbors: {}, // '10.10.10.1': { remoteAs: 10, state: 'Idle' }
                networks: []   // [{ prefix: '192.168.20.0', mask: '255.255.255.0' }]
            }
        },

        // PC Addressing State
        pcs: {
            PC0: { ip: '', mask: '', gateway: '', configured: false },
            PC1: { ip: '', mask: '', gateway: '', configured: false },
            PC2: { ip: '', mask: '', gateway: '', configured: false },
            PC3: { ip: '', mask: '', gateway: '', configured: false }
        },

        // Topology nodes & links
        placedNodes: {},
        connectedLinks: [],
        connectMode: false,
        deleteMode: false,
        firstConnectNode: null,
        nodeCounters: { PC: 0, Switch: 0, Router: 0 }
    };

    // Expected Configuration Criteria
    const EXPECTED = {
        pcs: {
            PC0: { ip: '192.168.10.2', mask: '255.255.255.0', gateway: '192.168.10.1' },
            PC1: { ip: '192.168.10.3', mask: '255.255.255.0', gateway: '192.168.10.1' },
            PC2: { ip: '192.168.20.2', mask: '255.255.255.0', gateway: '192.168.20.1' },
            PC3: { ip: '192.168.20.3', mask: '255.255.255.0', gateway: '192.168.20.1' }
        },
        Router0: {
            as: 10,
            g0_0: { ip: '192.168.10.1', mask: '255.255.255.0' },
            g0_1: { ip: '10.10.10.1', mask: '255.0.0.0' },
            neighbor: { ip: '10.10.10.2', remoteAs: 20 },
            network: { prefix: '192.168.10.0', mask: '255.255.255.0' }
        },
        Router1: {
            as: 20,
            g0_0: { ip: '192.168.20.1', mask: '255.255.255.0' },
            g0_1: { ip: '10.10.10.2', mask: '255.0.0.0' },
            neighbor: { ip: '10.10.10.1', remoteAs: 10 },
            network: { prefix: '192.168.20.0', mask: '255.255.255.0' }
        }
    };

    // ── Observation Logger Helper (Syncs with script.js Dynamic Table) ──────
    function logObs(category, detail, outcome) {
        if (typeof window.addObservation === 'function') {
            window.addObservation(category, detail, outcome);
        } else if (typeof addObservation === 'function') {
            addObservation(category, detail, outcome);
        }
        if (typeof window.updateObservationTable === 'function') {
            window.updateObservationTable();
        }
    }

    function logMilestone(milestoneName) {
        if (window.VLabSync && typeof window.VLabSync.logEvent === 'function') {
            window.VLabSync.logEvent('Milestone:' + milestoneName, 'MILESTONE_REACHED', {
                action: 'Milestone: ' + milestoneName,
                detail: 'Milestone ' + milestoneName + ' verified',
                result: 'Success',
                evidence: { verified: true }
            });
        }
    }

    // ── Real BGP State Machine Evaluation Engine ──────────────────────────────
    function evaluateBgpAdjacency() {
        const r0 = expState.Router0;
        const r1 = expState.Router1;

        const r0G01Up = (r0.interfaces['GigabitEthernet0/1'].adminStatus === 'up' && expState.wanLinkState.lineStatus === 'up');
        const r1G01Up = (r1.interfaces['GigabitEthernet0/1'].adminStatus === 'up' && expState.wanLinkState.lineStatus === 'up');

        const r0HasG01Ip = (r0.interfaces['GigabitEthernet0/1'].ip === '10.10.10.1');
        const r1HasG01Ip = (r1.interfaces['GigabitEthernet0/1'].ip === '10.10.10.2');

        const r0BgpConfigured = (r0.bgp.as === 10 && r0.bgp.neighbors['10.10.10.2']?.remoteAs === 20);
        const r1BgpConfigured = (r1.bgp.as === 20 && r1.bgp.neighbors['10.10.10.1']?.remoteAs === 10);

        const canEstablish = (r0G01Up && r1G01Up && r0HasG01Ip && r1HasG01Ip && r0BgpConfigured && r1BgpConfigured);

        let r0PrevState = r0.bgp.neighbors['10.10.10.2'] ? r0.bgp.neighbors['10.10.10.2'].state : 'Idle';
        let r1PrevState = r1.bgp.neighbors['10.10.10.1'] ? r1.bgp.neighbors['10.10.10.1'].state : 'Idle';

        if (canEstablish) {
            if (r0.bgp.neighbors['10.10.10.2']) r0.bgp.neighbors['10.10.10.2'].state = 'Established';
            if (r1.bgp.neighbors['10.10.10.1']) r1.bgp.neighbors['10.10.10.1'].state = 'Established';

            // Output authentic syslog if state just became Established
            if (r0PrevState !== 'Established') {
                printToCli('Router0', '%BGP-5-ADJCHANGE: neighbor 10.10.10.2 Up');
                logObs('BGP Peering', 'Router0 (AS 10) ↔ Router1 (AS 20)', 'Adjacency Established (TCP 179)');
            }
            if (r1PrevState !== 'Established') {
                printToCli('Router1', '%BGP-5-ADJCHANGE: neighbor 10.10.10.1 Up');
                logObs('BGP Peering', 'Router1 (AS 20) ↔ Router0 (AS 10)', 'Adjacency Established (TCP 179)');
            }

            // Mark Milestone & Stage
            if (!expState.stage3Complete) {
                expState.stage3Complete = true;
                logMilestone('10_BGP_PEERING_ESTABLISHED');
                const stage4Card = document.getElementById('stage4-inspector-card');
                if (stage4Card) stage4Card.style.display = 'block';
                const stage5Card = document.getElementById('stage5-failure-card');
                if (stage5Card) stage5Card.style.display = 'block';
            }
        } else {
            // Teardown / Down state
            if (r0.bgp.neighbors['10.10.10.2']) {
                r0.bgp.neighbors['10.10.10.2'].state = 'Idle';
                if (r0PrevState === 'Established') {
                    printToCli('Router0', '%BGP-5-ADJCHANGE: neighbor 10.10.10.2 Down Interface flap');
                    logObs('BGP Teardown', 'Router0 Neighbor 10.10.10.2', 'State changed to Idle (Interface Flap)');
                }
            }
            if (r1.bgp.neighbors['10.10.10.1']) {
                r1.bgp.neighbors['10.10.10.1'].state = 'Idle';
                if (r1PrevState === 'Established') {
                    printToCli('Router1', '%BGP-5-ADJCHANGE: neighbor 10.10.10.1 Down Interface flap');
                    logObs('BGP Teardown', 'Router1 Neighbor 10.10.10.1', 'State changed to Idle (Interface Flap)');
                }
            }
        }

        // Check if prefixes advertised
        const r0NetOk = r0.bgp.networks.some(n => n.prefix === '192.168.10.0');
        const r1NetOk = r1.bgp.networks.some(n => n.prefix === '192.168.20.0');
        if (canEstablish && r0NetOk && r1NetOk && !expState.stage4Complete) {
            expState.stage4Complete = true;
            logMilestone('10_BGP_PREFIX_ADVERTISED');
            logObs('Prefix Advertisement', 'eBGP Customer LANs (192.168.10.0/24 & 192.168.20.0/24)', 'Exchanged and Installed in BGP Table');
            const stage6Card = document.getElementById('stage6-ping-card');
            if (stage6Card) stage6Card.style.display = 'block';
        }

        updateInspectorUI();
        updatePeeringBadgeUI(canEstablish);
    }

    function updatePeeringBadgeUI(isEstablished) {
        const badge = document.getElementById('bgp-peering-status-badge');
        if (badge) {
            if (isEstablished) {
                badge.style.background = '#ECFDF5';
                badge.style.color = '#059669';
                badge.style.border = '1px solid #A7F3D0';
                badge.innerHTML = '● BGP Peering: Established (TCP 179)';
            } else {
                badge.style.background = '#FEF2F2';
                badge.style.color = '#DC2626';
                badge.style.border = '1px solid #FECACA';
                badge.innerHTML = '○ BGP Peering: Idle / Down';
            }
        }
    }

    function updateInspectorUI() {
        const r0 = expState.Router0;
        const r1 = expState.Router1;
        const isEstablished = (r0.bgp.neighbors['10.10.10.2']?.state === 'Established' && r1.bgp.neighbors['10.10.10.1']?.state === 'Established');

        const inspectorEl = document.getElementById('bgp-inspector-content');
        if (!inspectorEl) return;

        const r0NetOk = r0.bgp.networks.some(n => n.prefix === '192.168.10.0');
        const r1NetOk = r1.bgp.networks.some(n => n.prefix === '192.168.20.0');

        let html = `
            <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 1rem;">
                <div style="background:#1E293B; color:#E2E8F0; padding:1rem; border-radius:6px; font-family:'Courier New', monospace; font-size:0.8rem;">
                    <div style="color:#38BDF8; font-weight:bold; margin-bottom:0.5rem;">Router0 (AS 10) &mdash; show ip bgp</div>
                    <div>BGP table version is 2, local router ID is 10.10.10.1</div>
                    <div>Status codes: s suppressed, d damped, h history, * valid, > best, i - internal</div>
                    <div>Origin codes: i - IGP, e - EGP, ? - incomplete</div>
                    <div style="border-bottom:1px solid #475569; margin:0.4rem 0;"></div>
                    <div style="color:#94A3B8;">   Network          Next Hop            Metric LocPrf Weight Path</div>
                    ${r0NetOk ? `<div>*> 192.168.10.0/24   0.0.0.0                  0         32768 i</div>` : `<div>   (No local prefix advertised)</div>`}
                    ${(isEstablished && r1NetOk) ? `<div style="color:#4ADE80;">*> 192.168.20.0/24   10.10.10.2               0             0 20 i</div>` : `<div style="color:#F87171;">   192.168.20.0/24   [NOT IN TABLE / WITHDRAWN]</div>`}
                </div>

                <div style="background:#1E293B; color:#E2E8F0; padding:1rem; border-radius:6px; font-family:'Courier New', monospace; font-size:0.8rem;">
                    <div style="color:#38BDF8; font-weight:bold; margin-bottom:0.5rem;">Router1 (AS 20) &mdash; show ip bgp</div>
                    <div>BGP table version is 2, local router ID is 10.10.10.2</div>
                    <div>Status codes: s suppressed, d damped, h history, * valid, > best, i - internal</div>
                    <div>Origin codes: i - IGP, e - EGP, ? - incomplete</div>
                    <div style="border-bottom:1px solid #475569; margin:0.4rem 0;"></div>
                    <div style="color:#94A3B8;">   Network          Next Hop            Metric LocPrf Weight Path</div>
                    ${r1NetOk ? `<div>*> 192.168.20.0/24   0.0.0.0                  0         32768 i</div>` : `<div>   (No local prefix advertised)</div>`}
                    ${(isEstablished && r0NetOk) ? `<div style="color:#4ADE80;">*> 192.168.10.0/24   10.10.10.1               0             0 10 i</div>` : `<div style="color:#F87171;">   192.168.10.0/24   [NOT IN TABLE / WITHDRAWN]</div>`}
                </div>
            </div>
        `;

        inspectorEl.innerHTML = html;
    }

    // ── CLI Printing & Command Processor ──────────────────────────────────────
    function printToCli(routerId, text) {
        const out = document.getElementById(`cli-output-${routerId.toLowerCase()}`);
        if (out) {
            out.textContent += (text ? text + '\n' : '\n');
            out.scrollTop = out.scrollHeight;
        }
    }

    function getPrompt(routerId) {
        const r = expState[routerId];
        const host = r.hostname || routerId;
        switch (r.mode) {
            case 'user': return `${host}>`;
            case 'priv': return `${host}#`;
            case 'config': return `${host}(config)#`;
            case 'config-if': return `${host}(config-if)#`;
            case 'config-router': return `${host}(config-router)#`;
            default: return `${host}>`;
        }
    }

    function updatePrompt(routerId) {
        const promptEl = document.getElementById(`cli-prompt-${routerId.toLowerCase()}`);
        if (promptEl) {
            promptEl.textContent = getPrompt(routerId);
        }
    }

    function processCommand(routerId, rawCmd) {
        const cmd = rawCmd.trim();
        const r = expState[routerId];
        printToCli(routerId, `${getPrompt(routerId)} ${cmd}`);

        if (!cmd) return;

        const parts = cmd.split(/\s+/);
        const c0 = parts[0].toLowerCase();
        const c1 = parts[1] ? parts[1].toLowerCase() : '';
        const c2 = parts[2] ? parts[2].toLowerCase() : '';

        // 1. Navigation & Modes
        if (c0 === 'enable' || c0 === 'en') {
            r.mode = 'priv';
        } else if (c0 === 'disable') {
            r.mode = 'user';
        } else if ((c0 === 'configure' && c1 === 'terminal') || (c0 === 'conf' && c1 === 't')) {
            if (r.mode === 'priv') r.mode = 'config';
            else printToCli(routerId, '% Must be in privileged EXEC mode.');
        } else if (c0 === 'exit') {
            if (r.mode === 'config-if' || r.mode === 'config-router') r.mode = 'config';
            else if (r.mode === 'config') r.mode = 'priv';
            else if (r.mode === 'priv') r.mode = 'user';
        } else if (c0 === 'end') {
            if (r.mode.startsWith('config')) r.mode = 'priv';
        } else if (c0 === 'hostname') {
            if (r.mode === 'config' && parts[1]) {
                r.hostname = parts[1];
            }
        }

        // 2. Interface Configuration
        else if (c0 === 'interface' || c0 === 'int') {
            if (r.mode === 'config' || r.mode === 'config-if' || r.mode === 'config-router') {
                const ifName = parts[1];
                let normalized = null;
                if (/^g(igabitethernet)?0\/0$/i.test(ifName)) normalized = 'GigabitEthernet0/0';
                else if (/^g(igabitethernet)?0\/1$/i.test(ifName)) normalized = 'GigabitEthernet0/1';

                if (normalized) {
                    r.activeIf = normalized;
                    r.mode = 'config-if';
                } else {
                    printToCli(routerId, '% Invalid interface name.');
                }
            } else {
                printToCli(routerId, '% Invalid command in this mode.');
            }
        } else if (c0 === 'ip' && c1 === 'address') {
            if (r.mode === 'config-if' && r.activeIf) {
                const ip = parts[2];
                const mask = parts[3];
                if (ip && mask) {
                    r.interfaces[r.activeIf].ip = ip;
                    r.interfaces[r.activeIf].mask = mask;
                    printToCli(routerId, `IP address ${ip} ${mask} configured on ${r.activeIf}.`);
                    evaluateBgpAdjacency();
                } else {
                    printToCli(routerId, '% Incomplete command. Syntax: ip address <IP> <Subnet-Mask>');
                }
            }
        } else if (c0 === 'no' && c1 === 'shutdown') {
            if (r.mode === 'config-if' && r.activeIf) {
                r.interfaces[r.activeIf].adminStatus = 'up';
                r.interfaces[r.activeIf].lineStatus = 'up';
                printToCli(routerId, `%LINK-3-UPDOWN: Interface ${r.activeIf}, changed state to up`);
                printToCli(routerId, `%LINEPROTO-5-UPDOWN: Line protocol on Interface ${r.activeIf}, changed state to up`);
                evaluateBgpAdjacency();
            }
        } else if (c0 === 'shutdown' || c0 === 'shut') {
            if (r.mode === 'config-if' && r.activeIf) {
                r.interfaces[r.activeIf].adminStatus = 'down';
                r.interfaces[r.activeIf].lineStatus = 'down';
                printToCli(routerId, `%LINK-5-CHANGED: Interface ${r.activeIf}, changed state to administratively down`);
                printToCli(routerId, `%LINEPROTO-5-UPDOWN: Line protocol on Interface ${r.activeIf}, changed state to down`);
                evaluateBgpAdjacency();
            }
        }

        // 3. BGP Configuration
        else if (c0 === 'router' && c1 === 'bgp') {
            if (r.mode === 'config') {
                const as = parseInt(parts[2], 10);
                if (!isNaN(as)) {
                    r.bgp.as = as;
                    r.mode = 'config-router';
                    evaluateBgpAdjacency();
                } else {
                    printToCli(routerId, '% Incomplete command. Syntax: router bgp <AS>');
                }
            }
        } else if (c0 === 'neighbor') {
            if (r.mode === 'config-router') {
                const nIp = parts[1];
                const remoteAsIndex = parts.indexOf('remote-as');
                if (remoteAsIndex !== -1 && parts[remoteAsIndex + 1]) {
                    const rAs = parseInt(parts[remoteAsIndex + 1], 10);
                    r.bgp.neighbors[nIp] = { remoteAs: rAs, state: 'Idle' };
                    printToCli(routerId, `BGP neighbor ${nIp} remote-as ${rAs} configured.`);
                    evaluateBgpAdjacency();
                } else {
                    printToCli(routerId, '% Incomplete command. Syntax: neighbor <IP> remote-as <AS>');
                }
            }
        } else if (c0 === 'network') {
            if (r.mode === 'config-router') {
                const prefix = parts[1];
                const maskIndex = parts.indexOf('mask');
                const mask = (maskIndex !== -1 && parts[maskIndex + 1]) ? parts[maskIndex + 1] : '255.255.255.0';
                if (prefix) {
                    if (!r.bgp.networks.some(n => n.prefix === prefix)) {
                        r.bgp.networks.push({ prefix, mask });
                    }
                    printToCli(routerId, `Network ${prefix} mask ${mask} advertised.`);
                    evaluateBgpAdjacency();
                }
            }
        }

        // 4. Save & Diagnostic Show Commands
        else if (cmd === 'do write' || cmd === 'write' || cmd === 'wr' || cmd === 'copy run start') {
            printToCli(routerId, 'Building configuration...\n[OK]');
        } else if (c0 === 'show' || (c0 === 'do' && c1 === 'show')) {
            const showArgs = (c0 === 'do') ? parts.slice(2) : parts.slice(1);
            const s0 = showArgs[0] ? showArgs[0].toLowerCase() : '';
            const s1 = showArgs[1] ? showArgs[1].toLowerCase() : '';
            const s2 = showArgs[2] ? showArgs[2].toLowerCase() : '';

            if (s0 === 'ip' && s1 === 'bgp') {
                if (s2 === 'summary') {
                    showBgpSummary(routerId);
                    logObs('BGP Verification', `${routerId} show ip bgp summary`, 'Inspected BGP neighbor peering status & table version');
                } else if (s2 === 'neighbor') {
                    showBgpNeighbor(routerId);
                    logObs('BGP Verification', `${routerId} show ip bgp neighbor`, 'Inspected BGP TCP 179 session & timer attributes');
                } else {
                    showBgpTable(routerId);
                    logObs('BGP Table Inspector', `${routerId} show ip bgp`, 'Inspected AS-Path attributes & advertised network prefixes');
                }
            } else if (s0 === 'ip' && s1 === 'route') {
                showIpRoute(routerId);
                logObs('IP Routing Table', `${routerId} show ip route`, 'Verified BGP routes installed in routing table');
            } else if (s0 === 'ip' && s1 === 'interface' && s2 === 'brief') {
                showIpInterfaceBrief(routerId);
                logObs('Interface Verification', `${routerId} show ip interface brief`, 'Verified GigabitEthernet Layer 3 states');
            } else {
                printToCli(routerId, '% Invalid show command.');
            }
        } else if (c0 === 'help' || c0 === '?') {
            printToCli(routerId, 'Available commands: enable, configure terminal, interface, ip address, no shutdown, shutdown, router bgp, neighbor remote-as, network mask, show ip bgp summary, show ip bgp neighbor, show ip route, exit, do write');
        } else {
            printToCli(routerId, `% Unrecognized command '${cmd}'. Type 'help' for command syntax.`);
        }

        updatePrompt(routerId);
    }

    function showBgpSummary(routerId) {
        const r = expState[routerId];
        const localAs = r.bgp.as || (routerId === 'Router0' ? 10 : 20);
        const routerIdIp = routerId === 'Router0' ? '10.10.10.1' : '10.10.10.2';
        const neighborIp = routerId === 'Router0' ? '10.10.10.2' : '10.10.10.1';
        const nObj = r.bgp.neighbors[neighborIp];
        const isEst = (nObj && nObj.state === 'Established');

        let text = `BGP router identifier ${routerIdIp}, local AS number ${localAs}\n`;
        text += `BGP table version is 2, main routing table version 2\n\n`;
        text += `Neighbor        V    AS MsgRcvd MsgSent   TblVer  InQ OutQ Up/Down  State/PfxRcd\n`;
        if (nObj) {
            text += `${neighborIp.padEnd(16)} 4 ${String(nObj.remoteAs).padEnd(5)}    14      14        2    0    0 00:04:12 ${isEst ? '1' : 'Idle'}\n`;
        } else {
            text += `(No BGP neighbors configured)\n`;
        }
        printToCli(routerId, text);
    }

    function showBgpNeighbor(routerId) {
        const neighborIp = routerId === 'Router0' ? '10.10.10.2' : '10.10.10.1';
        const remoteAs = routerId === 'Router0' ? 20 : 10;
        const r = expState[routerId];
        const nObj = r.bgp.neighbors[neighborIp];
        const isEst = (nObj && nObj.state === 'Established');

        let text = `BGP neighbor is ${neighborIp},  remote AS ${remoteAs}, external link\n`;
        text += `  BGP version 4, remote router ID ${neighborIp}\n`;
        text += `  BGP state = ${isEst ? 'Established, up for 00:04:12' : 'Idle'}\n`;
        text += `  Neighbor sessions: 1 active, 0 established\n`;
        text += `  Hold time is 180, keepalive interval is 60 seconds\n`;
        text += `  Connection: mode is active, port 179\n`;
        printToCli(routerId, text);
    }

    function showBgpTable(routerId) {
        const r = expState[routerId];
        const routerIdIp = routerId === 'Router0' ? '10.10.10.1' : '10.10.10.2';
        const isEstablished = (expState.Router0.bgp.neighbors['10.10.10.2']?.state === 'Established' && expState.Router1.bgp.neighbors['10.10.10.1']?.state === 'Established');

        const localNet = routerId === 'Router0' ? '192.168.10.0' : '192.168.20.0';
        const remoteNet = routerId === 'Router0' ? '192.168.20.0' : '192.168.10.0';
        const nextHop = routerId === 'Router0' ? '10.10.10.2' : '10.10.10.1';
        const remoteAs = routerId === 'Router0' ? 20 : 10;

        let text = `BGP table version is 2, local router ID is ${routerIdIp}\n`;
        text += `Status codes: s suppressed, d damped, h history, * valid, > best, i - internal\n`;
        text += `Origin codes: i - IGP, e - EGP, ? - incomplete\n\n`;
        text += `   Network          Next Hop            Metric LocPrf Weight Path\n`;
        if (r.bgp.networks.some(n => n.prefix === localNet)) {
            text += `*> ${localNet}/24   0.0.0.0                  0         32768 i\n`;
        }
        if (isEstablished && (routerId === 'Router0' ? expState.Router1.bgp.networks.some(n => n.prefix === remoteNet) : expState.Router0.bgp.networks.some(n => n.prefix === remoteNet))) {
            text += `*> ${remoteNet}/24   ${nextHop.padEnd(16)}         0             0 ${remoteAs} i\n`;
        }
        printToCli(routerId, text);
    }

    function showIpRoute(routerId) {
        const isEstablished = (expState.Router0.bgp.neighbors['10.10.10.2']?.state === 'Established' && expState.Router1.bgp.neighbors['10.10.10.1']?.state === 'Established');
        const r = expState[routerId];
        const localNet = routerId === 'Router0' ? '192.168.10.0/24' : '192.168.20.0/24';
        const remoteNet = routerId === 'Router0' ? '192.168.20.0/24' : '192.168.10.0/24';
        const nextHop = routerId === 'Router0' ? '10.10.10.2' : '10.10.10.1';

        let text = `Codes: L - local, C - connected, S - static, R - RIP, B - BGP, O - OSPF\n\n`;
        text += `Gateway of last resort is not set\n\n`;
        text += `      10.0.0.0/8 is subnetted, 1 subnets\n`;
        text += `C        10.0.0.0 is directly connected, GigabitEthernet0/1\n`;
        text += `C     ${localNet} is directly connected, GigabitEthernet0/0\n`;
        if (isEstablished) {
            text += `B     ${remoteNet} [20/0] via ${nextHop}, 00:04:12\n`;
        }
        printToCli(routerId, text);
    }

    function showIpInterfaceBrief(routerId) {
        const r = expState[routerId];
        let text = `Interface              IP-Address      OK? Method Status                Protocol\n`;
        for (const [ifName, data] of Object.entries(r.interfaces)) {
            const ip = data.ip || 'unassigned';
            const stat = data.adminStatus === 'up' ? 'up' : 'administratively down';
            const proto = data.lineStatus === 'up' ? 'up' : 'down';
            text += `${ifName.padEnd(23)}${ip.padEnd(16)}YES manual ${stat.padEnd(22)}${proto}\n`;
        }
        printToCli(routerId, text);
    }

    // ── Milestone Event Logger Helper ────────────────────────────────────────
    async function logMilestone(milestoneId) {
        try {
            const token = localStorage.getItem('vlab_student_token') || localStorage.getItem('vlab_token');
            const authHeaders = {
                'Content-Type': 'application/json',
                ...(token ? { 'Authorization': `Bearer ${token}` } : {})
            };
            await fetch('/api/events/log', {
                method: 'POST',
                headers: authHeaders,
                body: JSON.stringify({
                    experimentId: 10,
                    stage: milestoneId,
                    eventType: 'CLI_COMMAND_EXECUTED',
                    payload: { action: `Milestone:${milestoneId}`, verified: true }
                })
            });
        } catch (e) {
            console.warn('[Exp10] Milestone log error:', e);
        }
    }

    // ── Generic Node & Connection Handler With Deletion & Highlighting ──────
    function deleteNode(node, svgLayer) {
        if (!node) return;
        const label = node.dataset.label || "Device";
        const key = node.dataset.id || label;

        node.remove();
        delete expState.placedNodes[key];

        // Remove associated connections
        for (let i = expState.connectedLinks.length - 1; i >= 0; i--) {
            const conn = expState.connectedLinks[i];
            if (conn.nodeA === node || conn.nodeB === node) {
                expState.connectedLinks.splice(i, 1);
            }
        }

        if (expState.firstConnectNode === node) {
            expState.firstConnectNode = null;
        }

        refreshConnections(svgLayer);

        const fb = document.getElementById('topology-feedback');
        if (fb) fb.textContent = '';
        logObs('Topology Builder', 'Deleted ' + label, 'Node removed');
    }

    function deleteConnection(conn, svgLayer) {
        if (!conn) return;
        const idx = expState.connectedLinks.indexOf(conn);
        if (idx !== -1) {
            const labelA = conn.nodeA?.dataset?.label || "Device";
            const labelB = conn.nodeB?.dataset?.label || "Device";
            expState.connectedLinks.splice(idx, 1);
            refreshConnections(svgLayer);
            const fb = document.getElementById('topology-feedback');
            if (fb) fb.textContent = '';
            logObs('Topology Cabling', `Removed cable between ${labelA} and ${labelB}`, 'Cable removed');
        }
    }

    function clearAllWires() {
        const svgLayer = document.getElementById('connection-layer');
        expState.connectedLinks = [];
        refreshConnections(svgLayer);
        const fb = document.getElementById('topology-feedback');
        if (fb) fb.textContent = '';
    }

    function toggleDeleteMode() {
        const btn = document.getElementById('delete-mode-btn');
        const connectBtn = document.getElementById('connect-mode-btn');
        const canvas = document.getElementById('topology-canvas');
        const svgLayer = document.getElementById('connection-layer');

        expState.deleteMode = !expState.deleteMode;

        // Turn off connect mode if delete mode is turned on
        if (expState.deleteMode && expState.connectMode) {
            expState.connectMode = false;
            if (expState.firstConnectNode) {
                expState.firstConnectNode.style.boxShadow = '';
                expState.firstConnectNode = null;
            }
            if (connectBtn) {
                connectBtn.style.backgroundColor = 'var(--secondary-color)';
                connectBtn.innerHTML = '<i data-lucide="link"></i> Enable Connect Mode';
            }
        }

        if (btn) {
            if (expState.deleteMode) {
                btn.style.backgroundColor = '#EF4444';
                btn.style.color = 'white';
                btn.style.borderColor = '#DC2626';
                btn.innerHTML = '<i data-lucide="x-circle"></i> Exit Delete Mode';
                if (canvas) canvas.style.cursor = 'not-allowed';
            } else {
                btn.style.backgroundColor = '#FEF2F2';
                btn.style.color = '#DC2626';
                btn.style.borderColor = '#FECACA';
                btn.innerHTML = '<i data-lucide="trash-2"></i> Delete Tool';
                if (canvas) canvas.style.cursor = 'default';
            }
        }

        if (canvas) {
            canvas.querySelectorAll('.btn-node-delete').forEach(d => {
                d.style.display = expState.deleteMode ? 'block' : 'none';
            });
            canvas.querySelectorAll('.btn-wire-delete').forEach(w => {
                w.style.display = expState.deleteMode ? 'flex' : 'none';
            });
        }
        refreshConnections(svgLayer);
        if (window.lucide) lucide.createIcons();
    }

    function addNodeToCanvas(canvas, svgLayer, type, label, x, y) {
        const node = document.createElement('div');
        const nodeId = `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
        node.className = 'topo-node';
        node.dataset.type = type;
        node.dataset.label = label;
        node.dataset.id = nodeId;
        node.style.position = 'absolute';
        node.style.left = `${x}px`;
        node.style.top = `${y}px`;
        node.style.width = '68px';
        node.style.height = '68px';
        node.style.display = 'flex';
        node.style.flexDirection = 'column';
        node.style.alignItems = 'center';
        node.style.justifyContent = 'center';
        node.style.background = 'white';
        node.style.border = '2px solid var(--primary-color)';
        node.style.borderRadius = '10px';
        node.style.cursor = 'grab';
        node.style.userSelect = 'none';
        node.style.zIndex = '10';
        node.style.boxShadow = '0 2px 6px rgba(0, 0, 0, 0.08)';
        node.style.padding = '4px 2px';
        node.style.boxSizing = 'border-box';

        const iconSrc = {
            PC: 'assets/icons/pc.svg',
            Switch: 'assets/icons/switch.svg',
            Router: 'assets/icons/router.svg'
        }[type] || 'assets/icons/pc.svg';

        node.innerHTML = `
            <img src="${iconSrc}" width="28" height="28" alt="${type}" style="pointer-events:none; margin:0 auto 3px auto; display:block;">
            <span style="font-size:0.75rem; font-weight:700; color:#1E293B; pointer-events:none; text-align:center; line-height:1.1;">${label}</span>
        `;

        // Small Red 'x' Delete Button
        const delBtn = document.createElement('button');
        delBtn.className = 'btn-node-delete';
        delBtn.title = `Delete ${label}`;
        delBtn.innerHTML = '&times;';
        delBtn.style.cssText = 'position:absolute; top:-7px; right:-7px; width:18px; height:18px; background:#EF4444; color:white; border:none; border-radius:50%; font-size:12px; font-weight:bold; line-height:18px; text-align:center; cursor:pointer; padding:0; display:none; z-index:30; box-shadow:0 1px 3px rgba(0,0,0,0.3);';
        node.appendChild(delBtn);

        delBtn.style.display = expState.deleteMode ? 'block' : 'none';

        delBtn.addEventListener('click', e => {
            e.stopPropagation();
            deleteNode(node, svgLayer);
        });

        node.addEventListener('contextmenu', e => {
            e.preventDefault();
            e.stopPropagation();
            deleteNode(node, svgLayer);
        });

        canvas.appendChild(node);
        expState.placedNodes[nodeId] = { type, label, node, x, y };
        logObs('Topology Construction', `Placed ${type} (${label})`, 'Canvas node positioned');

        // Drag / Connect interactions
        let isDragging = false, startX, startY, origX, origY;
        node.addEventListener('mousedown', e => {
            if (expState.deleteMode) {
                e.stopPropagation();
                deleteNode(node, svgLayer);
                return;
            }
            if (expState.connectMode) {
                e.stopPropagation();
                handleConnectClick(node, svgLayer);
                return;
            }
            if (e.target.tagName === 'BUTTON') return;
            isDragging = true;
            startX = e.clientX; startY = e.clientY;
            origX = parseInt(node.style.left) || 0;
            origY = parseInt(node.style.top) || 0;
            node.style.zIndex = '100';
            node.style.cursor = 'grabbing';
            e.preventDefault();
        });

        document.addEventListener('mousemove', e => {
            if (!isDragging) return;
            const newX = Math.max(0, Math.min(origX + e.clientX - startX, canvas.clientWidth - 68));
            const newY = Math.max(0, Math.min(origY + e.clientY - startY, canvas.clientHeight - 68));
            node.style.left = `${newX}px`;
            node.style.top = `${newY}px`;
            if (expState.placedNodes[nodeId]) {
                expState.placedNodes[nodeId].x = newX;
                expState.placedNodes[nodeId].y = newY;
            }
            refreshConnections(svgLayer);
        });

        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                node.style.zIndex = '10';
                node.style.cursor = 'grab';
            }
        });

        // Double-click to configure IP for PCs
        if (type === 'PC') {
            node.addEventListener('dblclick', () => openIPConfigModal(label));
        }
    }

    function handleConnectClick(node, svgLayer) {
        const cableType = document.getElementById('cable-type-select')?.value || 'straight';

        if (!expState.firstConnectNode) {
            // First device clicked: Highlight with distinct pulsing green glow
            expState.firstConnectNode = node;
            node.style.boxShadow = '0 0 0 4px #10B981, 0 0 12px rgba(16, 185, 129, 0.5)';
            node.style.borderColor = '#059669';
        } else if (expState.firstConnectNode === node) {
            // Clicking same node deselects
            node.style.boxShadow = '';
            node.style.borderColor = 'var(--primary-color)';
            expState.firstConnectNode = null;
        } else {
            // Second device clicked: Connect the pair
            const firstNode = expState.firstConnectNode;
            const exists = expState.connectedLinks.some(c =>
                (c.nodeA === firstNode && c.nodeB === node) ||
                (c.nodeA === node && c.nodeB === firstNode)
            );

            if (!exists) {
                expState.connectedLinks.push({ nodeA: firstNode, nodeB: node, type: cableType });
                refreshConnections(svgLayer);
                const labelA = firstNode.dataset.label || firstNode.dataset.type;
                const labelB = node.dataset.label || node.dataset.type;
                logObs('Topology Cabling', `Connected ${labelA} ↔ ${labelB} (${cableType === 'crossover' ? 'Copper Cross-over' : 'Copper Straight-Through'})`, 'Link active');
            }

            firstNode.style.boxShadow = '';
            firstNode.style.borderColor = 'var(--primary-color)';
            expState.firstConnectNode = null;
        }
    }

    function refreshConnections(svgLayer) {
        if (!svgLayer) return;
        svgLayer.innerHTML = '';
        const canvas = document.getElementById('topology-canvas');
        if (canvas) {
            canvas.querySelectorAll('.btn-wire-delete').forEach(b => b.remove());
        }

        expState.connectedLinks.forEach(c => {
            const rA = c.nodeA.getBoundingClientRect();
            const rB = c.nodeB.getBoundingClientRect();
            const canvasRect = svgLayer.getBoundingClientRect();

            const x1 = rA.left + rA.width / 2 - canvasRect.left;
            const y1 = rA.top + rA.height / 2 - canvasRect.top;
            const x2 = rB.left + rB.width / 2 - canvasRect.left;
            const y2 = rB.top + rB.height / 2 - canvasRect.top;
            const midX = (x1 + x2) / 2;
            const midY = (y1 + y2) / 2;

            const isCrossover = (c.type === 'crossover');
            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('x1', x1);
            line.setAttribute('y1', y1);
            line.setAttribute('x2', x2);
            line.setAttribute('y2', y2);
            line.setAttribute('stroke', expState.deleteMode ? '#EF4444' : (isCrossover ? '#DC2626' : '#2563EB'));
            line.setAttribute('stroke-width', expState.deleteMode ? '4' : (isCrossover ? '3' : '2.5'));
            if (isCrossover || expState.deleteMode) line.setAttribute('stroke-dasharray', expState.deleteMode ? '4,4' : '6,4');
            line.style.pointerEvents = 'stroke';
            line.style.cursor = expState.deleteMode ? 'not-allowed' : 'pointer';

            // Wide hit line for click deletion
            const hitLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            hitLine.setAttribute('x1', x1);
            hitLine.setAttribute('y1', y1);
            hitLine.setAttribute('x2', x2);
            hitLine.setAttribute('y2', y2);
            hitLine.setAttribute('stroke', 'transparent');
            hitLine.setAttribute('stroke-width', '22');
            hitLine.style.pointerEvents = 'stroke';
            hitLine.style.cursor = expState.deleteMode ? 'not-allowed' : 'pointer';

            // Midpoint wire delete button
            const delWireBtn = document.createElement('button');
            delWireBtn.className = 'btn-wire-delete';
            const labelA = c.nodeA?.dataset?.label || 'Device';
            const labelB = c.nodeB?.dataset?.label || 'Device';
            delWireBtn.title = `Delete wire between ${labelA} and ${labelB}`;
            delWireBtn.innerHTML = '&times;';
            delWireBtn.style.cssText = `position:absolute; left:${Math.round(midX - 11)}px; top:${Math.round(midY - 11)}px; width:22px; height:22px; background:#EF4444; color:white; border:2px solid white; border-radius:50%; font-size:15px; font-weight:bold; line-height:18px; text-align:center; cursor:pointer; padding:0; z-index:15; box-shadow:0 1px 4px rgba(0,0,0,0.35); align-items:center; justify-content:center; opacity:0.95; transition:transform 0.15s ease, background 0.15s ease;`;
            delWireBtn.style.display = expState.deleteMode ? 'flex' : 'none';

            delWireBtn.addEventListener('click', e => {
                e.stopPropagation();
                deleteConnection(c, svgLayer);
            });

            hitLine.addEventListener('click', e => {
                e.stopPropagation();
                if (expState.deleteMode) deleteConnection(c, svgLayer);
            });

            line.addEventListener('click', e => {
                e.stopPropagation();
                if (expState.deleteMode) deleteConnection(c, svgLayer);
            });

            svgLayer.appendChild(line);
            svgLayer.appendChild(hitLine);
            if (canvas) canvas.appendChild(delWireBtn);
        });
    }

    // ── IP Config Modal Handler ──────────────────────────────────────────────
    let activeModalPc = null;
    function openIPConfigModal(pcLabel) {
        activeModalPc = pcLabel;
        const modal = document.getElementById('pc-modal');
        const title = document.getElementById('pc-modal-title');
        const ipInput = document.getElementById('pc-modal-ip');
        const maskInput = document.getElementById('pc-modal-mask');
        const gwInput = document.getElementById('pc-modal-gateway');

        if (!modal) return;
        if (title) title.textContent = `Configure IP Address: ${pcLabel}`;

        const curr = expState.pcs[pcLabel] || {};
        if (ipInput) ipInput.value = curr.ip || '';
        if (maskInput) maskInput.value = curr.mask || '255.255.255.0';
        if (gwInput) gwInput.value = curr.gateway || '';

        modal.style.display = 'flex';
    }

    function closeIPConfigModal() {
        const modal = document.getElementById('pc-modal');
        if (modal) modal.style.display = 'none';
        activeModalPc = null;
    }

    function saveIPConfigModal() {
        if (!activeModalPc) return;
        const ipInput = document.getElementById('pc-modal-ip');
        const maskInput = document.getElementById('pc-modal-mask');
        const gwInput = document.getElementById('pc-modal-gateway');

        if (!expState.pcs[activeModalPc]) {
            expState.pcs[activeModalPc] = { ip: '', mask: '', gateway: '', configured: false };
        }

        expState.pcs[activeModalPc].ip = ipInput ? ipInput.value.trim() : '';
        expState.pcs[activeModalPc].mask = maskInput ? maskInput.value.trim() : '';
        expState.pcs[activeModalPc].gateway = gwInput ? gwInput.value.trim() : '';
        expState.pcs[activeModalPc].configured = true;

        logObs('IP Configuration', `Configured ${activeModalPc}`, `IP: ${expState.pcs[activeModalPc].ip || 'none'}, GW: ${expState.pcs[activeModalPc].gateway || 'none'}`);
        closeIPConfigModal();
    }

    // ── Topology Verification ────────────────────────────────────────────────
    function checkTopology() {
        const feedbackEl = document.getElementById('topology-feedback');
        const nodes = Object.values(expState.placedNodes);
        const pcs = nodes.filter(n => n.type === 'PC');
        const switches = nodes.filter(n => n.type === 'Switch');
        const routers = nodes.filter(n => n.type === 'Router');

        if (pcs.length < 4 || switches.length < 2 || routers.length < 2) {
            feedbackEl.style.color = '#DC2626';
            feedbackEl.textContent = `❌ Incomplete topology. Required: 4 PCs, 2 Switches, and 2 Routers (Current: ${pcs.length} PCs, ${switches.length} Switches, ${routers.length} Routers).`;
            logObs('Topology Verification', 'Dual-AS Network Interconnection', `Incomplete (${pcs.length} PCs, ${switches.length} Switches, ${routers.length} Routers)`);
            return;
        }

        const links = expState.connectedLinks;
        const straightLinks = links.filter(l => l.type === 'straight');
        const crossLinks = links.filter(l => l.type === 'crossover');

        if (straightLinks.length < 6 || crossLinks.length < 1) {
            feedbackEl.style.color = '#DC2626';
            feedbackEl.textContent = `❌ Cabling incomplete. Connect 6 Straight-Through cables (PCs-Switches-Routers) and 1 Copper Cross-Over cable between Router0 and Router1.`;
            logObs('Topology Verification', 'Dual-AS Network Interconnection', `Cabling Incomplete (${straightLinks.length} Straight, ${crossLinks.length} Cross-Over)`);
            return;
        }

        feedbackEl.style.color = '#059669';
        feedbackEl.textContent = '✅ Topology Verified! 4 PCs, 2 Switches, and 2 Routers correctly interconnected across AS 10 and AS 20.';
        logObs('Topology Verification', 'Dual-AS Network Interconnection', 'Verified 4 PCs, 2 Switches, 2 Routers');

        if (!expState.stage1Complete) {
            expState.stage1Complete = true;
            logMilestone('10_TOPOLOGY_COMPLETE');
            const ipStage = document.getElementById('stage2-addressing-card');
            if (ipStage) ipStage.style.display = 'block';
            const cliStage = document.getElementById('stage3-cli-card');
            if (cliStage) cliStage.style.display = 'block';
        }
    }

    // ── Addressing Validation ────────────────────────────────────────────────
    function validateAddressing() {
        const feedbackEl = document.getElementById('addressing-feedback');
        let allValid = true;
        const missingOrWrong = [];

        for (const [pcName, exp] of Object.entries(EXPECTED.pcs)) {
            const actual = expState.pcs[pcName];
            if (!actual || actual.ip !== exp.ip || actual.mask !== exp.mask || actual.gateway !== exp.gateway) {
                allValid = false;
                missingOrWrong.push(pcName);
            }
        }

        if (allValid) {
            feedbackEl.style.color = '#059669';
            feedbackEl.textContent = '✅ All PC IP addresses, subnet masks, and default gateways configured correctly as per Addressing Table.';
            logObs('Addressing Validation', 'End Device Network Configuration (PC0 - PC3)', 'All IP/Mask/Gateways Validated');
            if (!expState.stage2Complete) {
                expState.stage2Complete = true;
                logMilestone('10_IP_CONFIGURED');
            }
        } else {
            feedbackEl.style.color = '#DC2626';
            feedbackEl.textContent = `❌ Incorrect/incomplete settings for: ${missingOrWrong.join(', ')}. Please review Addressing Table.`;
            logObs('Addressing Validation', 'End Device Network Configuration', `Validation Failed (Mismatched: ${missingOrWrong.join(', ')})`);
        }
    }

    // ── Live Fault Injection: Link Failure & Route Withdrawal ───────────────
    function toggleWanLinkFailure() {
        const toggleBtn = document.getElementById('btn-toggle-wan-link');
        const statusText = document.getElementById('wan-link-status-text');

        if (expState.wanLinkState.lineStatus === 'up') {
            // Trigger failure
            expState.wanLinkState.lineStatus = 'down';
            toggleBtn.textContent = '🔌 Restore WAN Link (no shutdown)';
            toggleBtn.style.background = '#059669';
            statusText.innerHTML = '<span style="color:#DC2626; font-weight:bold;">⚡ Link State: DOWN (Interface Flap / Cable Cut)</span>';

            printToCli('Router0', '%LINEPROTO-5-UPDOWN: Line protocol on Interface GigabitEthernet0/1, changed state to down');
            printToCli('Router1', '%LINEPROTO-5-UPDOWN: Line protocol on Interface GigabitEthernet0/1, changed state to down');
            logObs('Fault Injection', 'WAN Link (Router0 Gig0/1 ↔ Router1 Gig0/1)', 'Simulated Link Cut: Line Protocol Down & BGP Route Withdrawn');
            evaluateBgpAdjacency();

            if (!expState.stage5Complete) {
                expState.stage5Complete = true;
                logMilestone('10_BGP_WITHDRAWAL_TESTED');
            }
        } else {
            // Restore link
            expState.wanLinkState.lineStatus = 'up';
            toggleBtn.textContent = '⚡ Simulate WAN Link Down (Gig0/1)';
            toggleBtn.style.background = '#DC2626';
            statusText.innerHTML = '<span style="color:#059669; font-weight:bold;">● Link State: UP (GigabitEthernet0/1 Active)</span>';

            printToCli('Router0', '%LINEPROTO-5-UPDOWN: Line protocol on Interface GigabitEthernet0/1, changed state to up');
            printToCli('Router1', '%LINEPROTO-5-UPDOWN: Line protocol on Interface GigabitEthernet0/1, changed state to up');
            logObs('Link Recovery', 'WAN Link (Router0 Gig0/1 ↔ Router1 Gig0/1)', 'Restored Link: Line Protocol Up & BGP Peering Recovered');
            evaluateBgpAdjacency();
        }
    }

    // ── Cross-AS Ping Simulation ─────────────────────────────────────────────
    function runPingSimulation() {
        const pingOutput = document.getElementById('ping-output');
        const r0 = expState.Router0;
        const r1 = expState.Router1;
        const isEstablished = (r0.bgp.neighbors['10.10.10.2']?.state === 'Established' && r1.bgp.neighbors['10.10.10.1']?.state === 'Established');
        const isAddressed = expState.stage2Complete;
        const linkUp = (expState.wanLinkState.lineStatus === 'up');

        pingOutput.textContent = 'Pinging 192.168.20.3 with 32 bytes of data:\n';

        if (isEstablished && isAddressed && linkUp) {
            setTimeout(() => {
                pingOutput.textContent += 'Reply from 192.168.20.3: bytes=32 time<1ms TTL=126 (AS 20 via 10.10.10.2)\n';
                pingOutput.textContent += 'Reply from 192.168.20.3: bytes=32 time<1ms TTL=126 (AS 20 via 10.10.10.2)\n';
                pingOutput.textContent += 'Reply from 192.168.20.3: bytes=32 time<1ms TTL=126 (AS 20 via 10.10.10.2)\n';
                pingOutput.textContent += 'Reply from 192.168.20.3: bytes=32 time<1ms TTL=126 (AS 20 via 10.10.10.2)\n\n';
                pingOutput.textContent += 'Ping statistics for 192.168.20.3:\n    Packets: Sent = 4, Received = 4, Lost = 0 (0% loss),\nApproximate round trip times in milli-seconds:\n    Minimum = 0ms, Maximum = 0ms, Average = 0ms\n';
                pingOutput.textContent += '\n✅ Cross-Autonomous System connectivity VERIFIED via eBGP (AS 10 ⇄ AS 20)!';
                logObs('Connectivity Test', 'Cross-AS ICMP Ping: PC0 (192.168.10.2) → PC3 (192.168.20.3)', 'Success (4/4 Echo Replies Received, 0% loss)');

                if (!expState.stage6Complete) {
                    expState.stage6Complete = true;
                    logMilestone('10_CONNECTIVITY_VERIFIED');
                }
            }, 400);
        } else {
            setTimeout(() => {
                pingOutput.textContent += 'Request timed out.\n';
                pingOutput.textContent += 'Request timed out.\n';
                pingOutput.textContent += 'Request timed out.\n';
                pingOutput.textContent += 'Request timed out.\n\n';
                pingOutput.textContent += 'Ping statistics for 192.168.20.3:\n    Packets: Sent = 4, Received = 0, Lost = 4 (100% loss).\n';
                if (!linkUp) {
                    pingOutput.textContent += '❌ Ping failed: WAN Link is down (BGP Route Withdrawn). Restore the WAN link to resume forwarding.';
                    logObs('Connectivity Test', 'Cross-AS ICMP Ping: PC0 → PC3', 'Failed: WAN Link Down (Route Withdrawn)');
                } else if (!isEstablished) {
                    pingOutput.textContent += '❌ Ping failed: BGP Peering not established between Router0 (AS 10) and Router1 (AS 20).';
                    logObs('Connectivity Test', 'Cross-AS ICMP Ping: PC0 → PC3', 'Failed: BGP Peering Not Established');
                } else {
                    pingOutput.textContent += '❌ Ping failed: PC addressing or default gateways missing.';
                    logObs('Connectivity Test', 'Cross-AS ICMP Ping: PC0 → PC3', 'Failed: Incomplete Device Addressing');
                }
            }, 400);
        }
    }

    // ── Initialization and Event Binding ─────────────────────────────────────
    function init() {
        const canvas = document.getElementById('topology-canvas');
        const svgLayer = document.getElementById('connection-layer');

        if (canvas && svgLayer) {
            // Palette dragstart
            document.querySelectorAll('#topo-tools .draggable-item[draggable="true"]').forEach(item => {
                item.addEventListener('dragstart', e => {
                    e.dataTransfer.setData('deviceType', item.dataset.type);
                });
            });

            canvas.addEventListener('dragover', e => e.preventDefault());
            canvas.addEventListener('drop', e => {
                e.preventDefault();
                const type = e.dataTransfer.getData('deviceType');
                if (!type) return;

                const rect = canvas.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;

                let label = '';
                if (type === 'PC') {
                    const count = expState.nodeCounters.PC++;
                    label = `PC${count}`;
                } else if (type === 'Switch') {
                    const count = expState.nodeCounters.Switch++;
                    label = `Switch${count}`;
                } else if (type === 'Router') {
                    const count = expState.nodeCounters.Router++;
                    label = count === 0 ? 'Router0' : (count === 1 ? 'Router1' : `Router${count}`);
                }

                const posX = Math.max(10, Math.min(x - 34, canvas.clientWidth - 78));
                const posY = Math.max(10, Math.min(y - 34, canvas.clientHeight - 78));

                addNodeToCanvas(canvas, svgLayer, type, label, posX, posY);
            });

            // Connect mode toggle button
            const connectBtn = document.getElementById('connect-mode-btn');
            if (connectBtn) {
                connectBtn.addEventListener('click', () => {
                    expState.connectMode = !expState.connectMode;
                    if (expState.firstConnectNode) {
                        expState.firstConnectNode.style.boxShadow = '';
                        expState.firstConnectNode.style.borderColor = 'var(--primary-color)';
                        expState.firstConnectNode = null;
                    }
                    if (expState.connectMode) {
                        connectBtn.style.backgroundColor = 'var(--accent-color)';
                        connectBtn.innerHTML = '<i data-lucide="mouse-pointer"></i> Enable Move Mode';
                        canvas.style.cursor = 'crosshair';
                    } else {
                        connectBtn.style.backgroundColor = 'var(--secondary-color)';
                        connectBtn.innerHTML = '<i data-lucide="link"></i> Enable Connect Mode';
                        canvas.style.cursor = 'default';
                    }
                    if (window.lucide) lucide.createIcons();
                });
            }

            // Delete tool toggle button
            const delBtn = document.getElementById('delete-mode-btn');
            if (delBtn) {
                delBtn.addEventListener('click', toggleDeleteMode);
            }

            // Reset canvas button
            const resetBtn = document.getElementById('reset-topology');
            if (resetBtn) {
                resetBtn.addEventListener('click', () => {
                    canvas.querySelectorAll('.topo-node').forEach(n => n.remove());
                    canvas.querySelectorAll('.btn-wire-delete').forEach(b => b.remove());
                    if (svgLayer) svgLayer.innerHTML = '';
                    expState.nodeCounters = { PC: 0, Switch: 0, Router: 0 };
                    expState.placedNodes = {};
                    expState.connectedLinks = [];
                    expState.connectMode = false;
                    expState.firstConnectNode = null;
                    if (expState.deleteMode) toggleDeleteMode();
                    document.getElementById('topology-feedback').textContent = '';
                    expState.stage1Complete = false;
                });
            }
        }

        // Modal IP event listeners
        const modalCancel = document.getElementById('pc-modal-cancel');
        const modalSave = document.getElementById('pc-modal-save');
        if (modalCancel) modalCancel.addEventListener('click', closeIPConfigModal);
        if (modalSave) modalSave.addEventListener('click', saveIPConfigModal);

        // Router tab switching
        const tabR0 = document.getElementById('tab-btn-r0');
        const tabR1 = document.getElementById('tab-btn-r1');
        const cliR0 = document.getElementById('cli-panel-r0');
        const cliR1 = document.getElementById('cli-panel-r1');

        if (tabR0 && tabR1) {
            tabR0.addEventListener('click', () => {
                tabR0.style.background = '#2563EB'; tabR0.style.color = '#FFF';
                tabR1.style.background = '#F1F5F9'; tabR1.style.color = '#334155';
                if (cliR0) cliR0.style.display = 'block';
                if (cliR1) cliR1.style.display = 'none';
                expState.activeRouter = 'Router0';
            });
            tabR1.addEventListener('click', () => {
                tabR1.style.background = '#2563EB'; tabR1.style.color = '#FFF';
                tabR0.style.background = '#F1F5F9'; tabR0.style.color = '#334155';
                if (cliR1) cliR1.style.display = 'block';
                if (cliR0) cliR0.style.display = 'none';
                expState.activeRouter = 'Router1';
            });
        }

        // CLI Inputs
        ['router0', 'router1'].forEach(rId => {
            const inputEl = document.getElementById(`cli-input-${rId}`);
            if (inputEl) {
                inputEl.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        const val = inputEl.value;
                        inputEl.value = '';
                        const routerKey = rId === 'router0' ? 'Router0' : 'Router1';
                        processCommand(routerKey, val);
                    }
                });
            }
        });

        // Topology check
        const checkTopoBtn = document.getElementById('check-topology-btn');
        if (checkTopoBtn) checkTopoBtn.addEventListener('click', checkTopology);

        // Address validate
        const validateAddrBtn = document.getElementById('validate-addressing-btn');
        if (validateAddrBtn) validateAddrBtn.addEventListener('click', validateAddressing);

        // Failure toggle
        const toggleWanBtn = document.getElementById('btn-toggle-wan-link');
        if (toggleWanBtn) toggleWanBtn.addEventListener('click', toggleWanLinkFailure);

        // Ping button
        const pingBtn = document.getElementById('btn-run-ping');
        if (pingBtn) pingBtn.addEventListener('click', runPingSimulation);

        // Init prompts
        updatePrompt('Router0');
        updatePrompt('Router1');
        updateInspectorUI();
    }

    window.Exp10Logic = {
        init,
        expState,
        checkTopology,
        validateAddressing,
        toggleWanLinkFailure,
        runPingSimulation
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
