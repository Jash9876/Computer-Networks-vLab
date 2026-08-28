// Experiment 4: Router IP Configuration & WAN Subnetting
// Logic for both Part 4-A and Part 4-B

document.addEventListener('DOMContentLoaded', function () {
    'use strict';

    // ── State ─────────────────────────────────────────────────────
    let currentMode = '4A';
    let cliMode = 'user_exec';
    let cliInterface = null;
    let activeRouterKey = 'R0'; // 'R0' or 'R1' — keys into routerStates
    let cliHistory = [];
    let historyIndex = -1;

    // Two independent router state objects
    const routerStates = {
        R0: {
            hostname: 'Router0',
            interfaces: {
                'GigabitEthernet0/0': { ip: '', mask: '', state: 'down' },
                'GigabitEthernet0/1': { ip: '', mask: '', state: 'down' },
                'Serial0/1/0':        { ip: '', mask: '', state: 'down', clockRate: 0, role: 'DCE' }
            },
            routes: []
        },
        R1: {
            hostname: 'Router1',
            interfaces: {
                'GigabitEthernet0/0': { ip: '', mask: '', state: 'down' },
                'GigabitEthernet0/1': { ip: '', mask: '', state: 'down' },
                'Serial0/1/0':        { ip: '', mask: '', state: 'down', clockRate: 0, role: 'DTE' }
            },
            routes: []
        }
    };

    // ── DOM refs ──────────────────────────────────────────────────
    const mode4ABtn        = document.getElementById('mode-4a-btn');
    const mode4BBtn        = document.getElementById('mode-4b-btn');
    const part4AStages     = document.getElementById('part-4a-stages');
    const part4BStages     = document.getElementById('part-4b-stages');
    const topoInstructions = document.getElementById('topo-instructions');
    const cableSelect      = document.getElementById('cable-type-select');
    const checkTopoBtn     = document.getElementById('check-topology');
    const resetTopoBtn     = document.getElementById('reset-topology');
    const topoFeedback     = document.getElementById('topology-feedback');
    const openTerminalBtn  = document.getElementById('open-terminal-btn');
    const openPingBtn      = document.getElementById('open-ping-btn');
    const openSubnetBtn    = document.getElementById('open-subnet-btn');

    const subnetSection  = document.getElementById('subnet-section');
    const closeSubnetBtn = document.getElementById('close-subnet-btn');
    const subnetDetails  = document.getElementById('subnet-details');
    const subnetTitle    = document.getElementById('subnet-title');
    const subnetNetwork  = document.getElementById('subnet-network');
    const subnetBroadcast= document.getElementById('subnet-broadcast');
    const subnetFirst    = document.getElementById('subnet-first');
    const subnetLast     = document.getElementById('subnet-last');
    const subnetBlocks   = document.querySelectorAll('.subnet-block-btn');

    const cliSection            = document.getElementById('cli-section');
    const cliTitle              = document.getElementById('cli-title');
    const closeCliBtn           = document.getElementById('close-cli-btn');
    const terminalContainer     = document.getElementById('terminal');
    const terminalOutput        = document.getElementById('terminal-output');
    const terminalInput         = document.getElementById('terminal-input');
    const terminalPrompt        = document.getElementById('terminal-prompt');
    const validateRouterBtn     = document.getElementById('validate-router-btn');
    const routerValidationOutput= document.getElementById('router-validation-output');

    // Router selector (4B - to switch between R0 and R1)
    let routerSwitcher = null;

    const pingSection           = document.getElementById('ping-section');
    const closePingBtn          = document.getElementById('close-ping-btn');
    const pingSource            = document.getElementById('ping-source');
    const pingDest              = document.getElementById('ping-dest');
    const sendPingBtn           = document.getElementById('send-ping-btn');
    const pingOutput            = document.getElementById('ping-output');
    const troubleshooterOutput  = document.getElementById('troubleshooter-output');
    const resultText            = document.getElementById('result-text');

    // ── Helpers ───────────────────────────────────────────────────
    function nodes() {
        return (window.Topology && window.Topology.nodes) ? window.Topology.nodes : {};
    }

    function edges() {
        return (window.Topology && window.Topology.edges) ? window.Topology.edges : [];
    }

    function getPrompt() {
        const h = routerStates[activeRouterKey].hostname;
        switch (cliMode) {
            case 'user_exec':    return `${h}>`;
            case 'priv_exec':    return `${h}#`;
            case 'global_config':return `${h}(config)#`;
            case 'if_config':    return `${h}(config-if)#`;
            default:             return `${h}>`;
        }
    }

    function updatePrompt() {
        if (terminalPrompt) terminalPrompt.textContent = getPrompt() + ' ';
    }

    function printLine(text) {
        if (!terminalOutput) return;
        terminalOutput.textContent += text + '\n';
        if (terminalContainer) terminalContainer.scrollTop = terminalContainer.scrollHeight;
    }

    function clearTerminal() {
        if (terminalOutput) terminalOutput.textContent = '';
    }

    function obs(action, result) {
        if (typeof addObservation === 'function') addObservation('Router CLI', action, result);
    }

    function normaliseIf(raw) {
        if (!raw) return null;
        const str = String(raw).trim().toLowerCase();
        
        // Match Serial 0/1/0 variations:
        // '0/1/0', 's0/1/0', 'se0/1/0', 'serial 0/1/0', 'serial s0/1/0', 'serial0/1/0', 'se 0/1/0'
        if (str.includes('0/1/0') || str.includes('0/1/1')) {
            return 'Serial0/1/0';
        }

        // Match GigabitEthernet 0/0 variations:
        // '0/0', 'g0/0', 'gi0/0', 'gigabitethernet 0/0', 'gigabitethernet g0/0', 'gigabitethernet0/0', 'gi 0/0'
        if (str.includes('0/0') || str.includes('0/0/0')) {
            return 'GigabitEthernet0/0';
        }

        // Match GigabitEthernet 0/1 variations:
        // '0/1', 'g0/1', 'gi0/1', 'gigabitethernet 0/1', 'gigabitethernet g0/1', 'gigabitethernet0/1', 'gi 0/1'
        if (str.includes('0/1') || str.includes('0/0/1')) {
            return 'GigabitEthernet0/1';
        }

        return null;
    }

    // Convert IP and Mask to Network Address
    function calculateNetwork(ipStr, maskStr) {
        if (!ipStr || !maskStr) return '';
        const ipParts = ipStr.split('.').map(Number);
        const maskParts = maskStr.split('.').map(Number);
        if (ipParts.length !== 4 || maskParts.length !== 4) return '';
        const netParts = ipParts.map((p, i) => p & maskParts[i]);
        return netParts.join('.');
    }

    function updateDynamicTopologyLabels() {
        for (let id in nodes()) {
            const n = nodes()[id];
            if (n.type === 'Router') {
                const rKey = (n.label === 'Router1') ? 'R1' : 'R0';
                const rState = routerStates[rKey];
                let infoHtml = `<img src="assets/icons/router.svg" width="24" height="24" style="margin-bottom: 2px; pointer-events: none;"><br><span style="pointer-events: none; font-weight:bold;">${n.label}</span>`;
                
                for (let ifName in rState.interfaces) {
                    const iface = rState.interfaces[ifName];
                    if (iface.ip) {
                        const shortName = ifName.replace('GigabitEthernet', 'G').replace('Serial', 'S');
                        const isUp = iface.state === 'up';
                        const dotColor = isUp ? '#10B981' : '#EF4444';
                        infoHtml += `<div style="font-size:0.65rem; line-height:1.1; margin-top:2px;"><span style="color:${dotColor}">●</span> ${shortName}: ${iface.ip}</div>`;
                    }
                }
                n.element.innerHTML = infoHtml;
            }
        }
    }

    // ── Interactive Preparation Stages Listeners ─────────────────
    // 4-A Stage 1: IP & Gateway Matching
    const check4aIpBtn = document.getElementById('check-4a-ip-matching');
    const fb4aIp = document.getElementById('feedback-4a-ip-matching');
    if (check4aIpBtn) {
        check4aIpBtn.addEventListener('click', () => {
            const p0ip = document.getElementById('match-pc0-ip').value;
            const p0gw = document.getElementById('match-pc0-gw').value;
            const p1ip = document.getElementById('match-pc1-ip').value;
            const p1gw = document.getElementById('match-pc1-gw').value;
            const r0g0 = document.getElementById('match-r0-g00').value;
            const r0g1 = document.getElementById('match-r0-g01').value;

            if (p0ip === '192.168.10.2' && p0gw === '192.168.10.1' &&
                p1ip === '192.168.11.2' && p1gw === '192.168.11.1' &&
                r0g0 === '192.168.10.1' && r0g1 === '192.168.11.1') {
                fb4aIp.style.color = '#059669';
                fb4aIp.textContent = '✔ Correct! Addressing plan for 4-A verified.';
            } else {
                fb4aIp.style.color = '#DC2626';
                fb4aIp.textContent = '✘ Incorrect mapping. Check subnet groupings for LAN 1 (192.168.10.0) and LAN 2 (192.168.11.0).';
            }
        });
    }

    // 4-A Stage 2: CLI Command Fill-in
    const check4aCliBtn = document.getElementById('check-4a-cli-fill');
    const fb4aCli = document.getElementById('feedback-4a-cli-fill');
    if (check4aCliBtn) {
        check4aCliBtn.addEventListener('click', () => {
            const f1 = (document.getElementById('cmd-fill-1').value || '').trim().toLowerCase();
            const f2 = (document.getElementById('cmd-fill-2').value || '').trim().toLowerCase();
            const f3 = (document.getElementById('cmd-fill-3').value || '').trim();
            const f4 = (document.getElementById('cmd-fill-4').value || '').trim();
            const f5 = (document.getElementById('cmd-fill-5').value || '').trim().toLowerCase();

            const c1 = (f1 === 'enable' || f1 === 'en');
            const c2 = (f2 === 'configure terminal' || f2 === 'conf t' || f2 === 'config t');
            const c3 = (f3 === '192.168.10.1');
            const c4 = (f4 === '255.255.255.0');
            const c5 = (f5 === 'no shutdown' || f5 === 'no shut');

            if (c1 && c2 && c3 && c4 && c5) {
                fb4aCli.style.color = '#059669';
                fb4aCli.textContent = '✔ Excellent! Command syntax verified. Now apply this in the Router CLI.';
            } else {
                fb4aCli.style.color = '#DC2626';
                fb4aCli.textContent = '✘ Please check syntax: enable -> configure terminal -> ip address 192.168.10.1 255.255.255.0 -> no shutdown.';
            }
        });
    }

    // 4-B Stage 1: Subnet Matching
    const check4bSubBtn = document.getElementById('check-4b-subnet-matching');
    const fb4bSub = document.getElementById('feedback-4b-subnet-matching');
    if (check4bSubBtn) {
        check4bSubBtn.addEventListener('click', () => {
            const s0 = document.getElementById('match-sub-0').value;
            const s32 = document.getElementById('match-sub-32').value;
            const s64 = document.getElementById('match-sub-64').value;
            const s96 = document.getElementById('match-sub-96').value;
            const s128 = document.getElementById('match-sub-128').value;

            if (s0 === 'lan1' && s32 === 'lan2' && s64 === 'wan' && s96 === 'lan3' && s128 === 'lan4') {
                fb4bSub.style.color = '#059669';
                fb4bSub.textContent = '✔ Correct! All 5 subnets matched to their devices.';
            } else {
                fb4bSub.style.color = '#DC2626';
                fb4bSub.textContent = '✘ Mismatch in subnet assignment. Remember: .0=LAN1, .32=LAN2, .64=WAN, .96=LAN3, .128=LAN4.';
            }
        });
    }

    // 4-B Stage 2: Subnet Calculation Challenge
    const check4bCalcBtn = document.getElementById('check-4b-calc');
    const fb4bCalc = document.getElementById('feedback-4b-calc');
    if (check4bCalcBtn) {
        check4bCalcBtn.addEventListener('click', () => {
            const net = (document.getElementById('calc-net').value || '').trim();
            const first = (document.getElementById('calc-first').value || '').trim();
            const last = (document.getElementById('calc-last').value || '').trim();
            const bcast = (document.getElementById('calc-bcast').value || '').trim();

            if (net === '192.168.10.96' && first === '192.168.10.97' && last === '192.168.10.126' && bcast === '192.168.10.127') {
                fb4bCalc.style.color = '#059669';
                fb4bCalc.textContent = '✔ Accurate! Subnet boundaries for 192.168.10.96/27 verified.';
            } else {
                fb4bCalc.style.color = '#DC2626';
                fb4bCalc.textContent = '✘ Expected: Network=192.168.10.96, First=192.168.10.97, Last=192.168.10.126, Broadcast=192.168.10.127.';
            }
        });
    }

    // 4-B Stage 3: DTE/DCE Setup
    const check4bDceBtn = document.getElementById('check-4b-dce');
    const fb4bDce = document.getElementById('feedback-4b-dce');
    if (check4bDceBtn) {
        check4bDceBtn.addEventListener('click', () => {
            const r0role = document.getElementById('match-r0-role').value;
            const r0clock = document.getElementById('match-r0-clock').value;
            const r1role = document.getElementById('match-r1-role').value;
            const r1clock = document.getElementById('match-r1-clock').value;

            if (r0role === 'DCE' && r0clock === '64000' && r1role === 'DTE' && r1clock === 'none') {
                fb4bDce.style.color = '#059669';
                fb4bDce.textContent = '✔ Correct! Router0 is DCE providing 64000 bps clock rate; Router1 is DTE.';
            } else {
                fb4bDce.style.color = '#DC2626';
                fb4bDce.textContent = '✘ Incorrect setup. Router0 requires DCE + 64000; Router1 requires DTE + None.';
            }
        });
    }

    // 4-B Stage 4: Static Routes (Forward and Return)
    const check4bRoutesBtn = document.getElementById('check-4b-routes');
    const fb4bRoutes = document.getElementById('feedback-4b-routes');
    if (check4bRoutesBtn) {
        check4bRoutesBtn.addEventListener('click', () => {
            const h1 = document.getElementById('route-r0-hop1').value;
            const h2 = document.getElementById('route-r0-hop2').value;
            const r1h1 = document.getElementById('route-r1-hop1').value;
            const r1h2 = document.getElementById('route-r1-hop2').value;

            if (h1 === '192.168.10.66' && h2 === '192.168.10.66' &&
                r1h1 === '192.168.10.65' && r1h2 === '192.168.10.65') {
                fb4bRoutes.style.color = '#059669';
                fb4bRoutes.textContent = '✔ Correct! Forward routes configured via 192.168.10.66 (R1) and return routes via 192.168.10.65 (R0).';
            } else {
                fb4bRoutes.style.color = '#DC2626';
                fb4bRoutes.textContent = '✘ Check next hops: Router0 forwards via 192.168.10.66; Router1 returns via 192.168.10.65.';
            }
        });
    }

    // ── Mode switching ────────────────────────────────────────────
    function setMode(mode) {
        if (currentMode !== mode) {
            currentMode = mode;
            resetExperimentState();
        }

        if (mode === '4A') {
            mode4ABtn.style.cssText = 'padding:.25rem .75rem;font-size:.875rem;background-color:var(--primary-color);color:white;';
            mode4BBtn.style.cssText = 'padding:.25rem .75rem;font-size:.875rem;background-color:var(--secondary-color);color:#E5E7EB;';
            if (part4AStages) part4AStages.style.display = 'block';
            if (part4BStages) part4BStages.style.display = 'none';
            topoInstructions.innerHTML = 'Drag <strong>2 PCs (PC0, PC1)</strong> and <strong>1 Router (Router0)</strong> onto the canvas, then connect them with <strong>Crossover</strong> cables.';
            cableSelect.innerHTML = '<option value="crossover">Crossover</option>';
            if (openSubnetBtn) openSubnetBtn.style.display = 'none';
            if (subnetSection) subnetSection.style.display = 'none';
        } else {
            mode4BBtn.style.cssText = 'padding:.25rem .75rem;font-size:.875rem;background-color:var(--primary-color);color:white;';
            mode4ABtn.style.cssText = 'padding:.25rem .75rem;font-size:.875rem;background-color:var(--secondary-color);color:#E5E7EB;';
            if (part4AStages) part4AStages.style.display = 'none';
            if (part4BStages) part4BStages.style.display = 'block';
            topoInstructions.innerHTML = 'Drag <strong>4 PCs (PC0..PC3)</strong> and <strong>2 Routers (Router0, Router1)</strong> onto the canvas. Connect PCs → Routers with <strong>Crossover</strong>, and Router0 ↔ Router1 with <strong>Serial DCE</strong>.';
            cableSelect.innerHTML = '<option value="crossover">Crossover</option><option value="serial">Serial DCE</option>';
            if (openSubnetBtn) openSubnetBtn.style.display = 'inline-block';
        }
        clearPanels();
    }

    function resetExperimentState() {
        const resetBtn = document.getElementById('reset-topology');
        if (resetBtn) resetBtn.click();
        
        routerStates.R0 = {
            hostname: 'Router0',
            interfaces: {
                'GigabitEthernet0/0': { ip: '', mask: '', state: 'down' },
                'GigabitEthernet0/1': { ip: '', mask: '', state: 'down' },
                'Serial0/1/0':        { ip: '', mask: '', state: 'down', clockRate: 0, role: 'DCE' }
            },
            routes: []
        };
        routerStates.R1 = {
            hostname: 'Router1',
            interfaces: {
                'GigabitEthernet0/0': { ip: '', mask: '', state: 'down' },
                'GigabitEthernet0/1': { ip: '', mask: '', state: 'down' },
                'Serial0/1/0':        { ip: '', mask: '', state: 'down', clockRate: 0, role: 'DTE' }
            },
            routes: []
        };

        cliMode = 'user_exec';
        cliInterface = null;
        activeRouterKey = 'R0';
        cliHistory = [];
        historyIndex = -1;
        
        const termOutput = document.getElementById('terminal-output');
        if (termOutput) {
            termOutput.innerHTML = '<div>Router con0 is now available</div><div><br></div><div>Press RETURN to get started.</div>';
        }

        // Clear Stage 1 & 2 inputs/feedback in 4A & 4B
        const allSelects = document.querySelectorAll('.ip-match-select, .subnet-match-select, #match-r0-role, #match-r0-clock, #match-r1-role, #match-r1-clock, #route-r0-hop1, #route-r0-hop2');
        allSelects.forEach(s => s.value = '');
        
        const allFillInputs = document.querySelectorAll('#cmd-fill-1, #cmd-fill-2, #cmd-fill-3, #cmd-fill-4, #cmd-fill-5, #calc-net, #calc-first, #calc-last, #calc-bcast, #ping-dest');
        allFillInputs.forEach(inp => inp.value = '');
        
        const allFeedbackSpans = document.querySelectorAll('#feedback-4a-ip-matching, #feedback-4a-cli-fill, #feedback-4b-subnet-matching, #feedback-4b-calc, #feedback-4b-dce, #feedback-4b-routes, #router-validation-output, #troubleshooter-output');
        allFeedbackSpans.forEach(sp => {
            sp.textContent = '';
            sp.style.display = 'none';
        });

        if (resultText) {
            resultText.innerHTML = 'Part 4-A: Pending.<br><br>Part 4-B: Pending.';
        }
    }

    function clearPanels() {
        topoFeedback.textContent = '';
        if (openTerminalBtn)  openTerminalBtn.style.display  = 'none';
        if (openPingBtn)      openPingBtn.style.display      = 'none';
        if (openSubnetBtn && currentMode === '4A') openSubnetBtn.style.display = 'none';
        if (cliSection)       cliSection.style.display       = 'none';
        if (pingSection)      pingSection.style.display      = 'none';
        if (subnetSection)    subnetSection.style.display    = 'none';
    }

    mode4ABtn.addEventListener('click', () => setMode('4A'));
    mode4BBtn.addEventListener('click', () => setMode('4B'));

    // ── Topology check with strict Graph & Cable Validation ───────
    checkTopoBtn.addEventListener('click', () => {
        const allNodes = nodes();
        const allEdges = edges();

        let pcList = [], routerList = [];
        for (let id in allNodes) {
            const n = allNodes[id];
            if (n.type === 'PC') pcList.push({ id, label: n.label || '' });
            if (n.type === 'Router') routerList.push({ id, label: n.label || '' });
        }

        function isConnected(id1, id2, cableReq) {
            return allEdges.some(e => 
                ((e.sourceId === id1 && e.targetId === id2) || (e.sourceId === id2 && e.targetId === id1)) &&
                (!cableReq || e.cableType === cableReq)
            );
        }

        if (currentMode === '4A') {
            if (pcList.length !== 2 || routerList.length !== 1) {
                topoFeedback.style.color = '#DC2626';
                topoFeedback.textContent = `✘ Need exactly 2 PCs and 1 Router on canvas. (Found ${pcList.length} PC(s), ${routerList.length} Router(s))`;
                return;
            }

            const r0 = routerList[0];
            const pc0 = pcList.find(p => p.label === 'PC0') || pcList[0];
            const pc1 = pcList.find(p => p.label === 'PC1') || pcList[1];

            const p0Conn = isConnected(pc0.id, r0.id, 'crossover');
            const p1Conn = isConnected(pc1.id, r0.id, 'crossover');

            if (!p0Conn) {
                topoFeedback.style.color = '#DC2626';
                topoFeedback.textContent = '✘ PC0 is not connected to Router0 with a Crossover cable.';
                return;
            }
            if (!p1Conn) {
                topoFeedback.style.color = '#DC2626';
                topoFeedback.textContent = '✘ PC1 is not connected to Router0 with a Crossover cable.';
                return;
            }

            topoFeedback.style.color = '#059669';
            topoFeedback.innerHTML = '✔ Topology 4-A Verified!<br>✓ PC0 ↔ Router0 (Crossover)<br>✓ PC1 ↔ Router0 (Crossover)<br>Double-click PCs to configure IP parameters, then launch the Router CLI.';
            if (openTerminalBtn) openTerminalBtn.style.display = 'inline-block';
            if (openPingBtn)     openPingBtn.style.display     = 'inline-block';

        } else {
            // Part 4-B: 4 PCs and 2 Routers
            if (pcList.length !== 4 || routerList.length !== 2) {
                topoFeedback.style.color = '#DC2626';
                topoFeedback.textContent = `✘ Need exactly 4 PCs (PC0..PC3) and 2 Routers (Router0, Router1). (Found ${pcList.length} PC(s), ${routerList.length} Router(s))`;
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
                topoFeedback.textContent = '✘ Router0 and Router1 must be connected using a Serial DCE cable.';
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
            topoFeedback.innerHTML = '✔ WAN Topology 4-B Verified!<br>✓ PC0 & PC1 ↔ Router0 (LAN 1 & 2)<br>✓ Router0 ↔ Router1 (Serial WAN Link)<br>✓ PC2 & PC3 ↔ Router1 (LAN 3 & 4)<br>Ready for Subnet Analyzer & Dual Router CLI Configuration.';
            if (openTerminalBtn) openTerminalBtn.style.display = 'inline-block';
            if (openPingBtn)     openPingBtn.style.display     = 'inline-block';
            if (openSubnetBtn)   openSubnetBtn.style.display   = 'inline-block';
        }
    });

    // ── Subnet Analyzer ───────────────────────────────────────────
    if (openSubnetBtn)  openSubnetBtn.addEventListener('click',  () => { subnetSection.style.display = 'block'; });
    if (closeSubnetBtn) closeSubnetBtn.addEventListener('click', () => { subnetSection.style.display = 'none';  });

    subnetBlocks.forEach(btn => {
        btn.addEventListener('click', (e) => {
            subnetBlocks.forEach(b => {
                b.style.backgroundColor = 'var(--secondary-color)';
                b.style.color = '#E5E7EB';
            });
            e.target.style.backgroundColor = 'var(--primary-color)';
            e.target.style.color = 'white';

            const base = parseInt(e.target.dataset.subnet);
            subnetDetails.style.display = 'block';
            subnetTitle.textContent     = `Subnet: 192.168.10.${base}/27`;
            subnetNetwork.textContent   = `192.168.10.${base}`;
            subnetBroadcast.textContent = `192.168.10.${base + 31}`;
            subnetFirst.textContent     = `192.168.10.${base + 1}`;
            subnetLast.textContent      = `192.168.10.${base + 30}`;
        });
    });

    // ── Router CLI ────────────────────────────────────────────────
    function buildRouterSwitcher() {
        const existing = document.getElementById('exp4-router-switcher');
        if (existing) { existing.remove(); }

        if (currentMode === '4B') {
            const sw = document.createElement('div');
            sw.id = 'exp4-router-switcher';
            sw.style.cssText = 'margin-bottom:.75rem; display:flex; align-items:center; gap:.5rem; font-size:.875rem;';
            sw.innerHTML = `
                <strong>Active Router:</strong>
                <button class="btn" id="sw-r0" style="padding:.2rem .6rem;font-size:.8rem;background-color:var(--primary-color);">Router0</button>
                <button class="btn" id="sw-r1" style="padding:.2rem .6rem;font-size:.8rem;background-color:var(--secondary-color);">Router1</button>
            `;
            cliSection.insertBefore(sw, cliSection.querySelector('p'));
            routerSwitcher = sw;

            sw.querySelector('#sw-r0').addEventListener('click', () => switchRouter('R0'));
            sw.querySelector('#sw-r1').addEventListener('click', () => switchRouter('R1'));
        }
    }

    function switchRouter(key) {
        activeRouterKey = key;
        cliMode = 'user_exec';
        cliInterface = null;
        clearTerminal();
        cliTitle.textContent = routerStates[key].hostname + ' CLI';
        updatePrompt();
        printLine(`Connected to ${routerStates[key].hostname}.`);
        printLine('');

        const r0Btn = document.getElementById('sw-r0');
        const r1Btn = document.getElementById('sw-r1');
        if (r0Btn && r1Btn) {
            r0Btn.style.backgroundColor = key === 'R0' ? 'var(--primary-color)' : 'var(--secondary-color)';
            r1Btn.style.backgroundColor = key === 'R1' ? 'var(--primary-color)' : 'var(--secondary-color)';
        }
    }

    if (openTerminalBtn) {
        openTerminalBtn.addEventListener('click', () => {
            cliSection.style.display = 'block';
            activeRouterKey = 'R0';
            cliMode = 'user_exec';
            cliInterface = null;
            clearTerminal();
            buildRouterSwitcher();
            cliTitle.textContent = routerStates['R0'].hostname + ' CLI';
            printLine('Connected to Router0. Type ? for help.');
            printLine('');
            updatePrompt();
            terminalInput.focus();
        });
    }

    if (closeCliBtn) closeCliBtn.addEventListener('click', () => { cliSection.style.display = 'none'; });

    if (terminalInput) {
        terminalInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const raw = terminalInput.value;
                const cmd = raw.trim();
                terminalInput.value = '';

                printLine(getPrompt() + ' ' + raw);

                if (cmd !== '') {
                    cliHistory.unshift(cmd);
                    if (cliHistory.length > 50) cliHistory.pop();
                }
                historyIndex = -1;

                if (cmd) processCommand(cmd);
                updatePrompt();
                terminalInput.focus();
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                if (historyIndex < cliHistory.length - 1) historyIndex++;
                terminalInput.value = cliHistory[historyIndex] || '';
            } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                if (historyIndex > 0) historyIndex--;
                else historyIndex = -1;
                terminalInput.value = historyIndex >= 0 ? cliHistory[historyIndex] : '';
            }
        });

        terminalContainer && terminalContainer.addEventListener('click', () => terminalInput.focus());
    }

    // ── Command processor ─────────────────────────────────────────
    function processCommand(raw) {
        const lower = raw.toLowerCase().trim();
        const parts = lower.split(/\s+/);
        const cmd   = parts[0];
        const rState = routerStates[activeRouterKey];

        if (cmd === '?') {
            if (cliMode === 'user_exec') {
                printLine('Available commands:');
                printLine('  enable       - Enter privileged EXEC mode');
            } else if (cliMode === 'priv_exec') {
                printLine('Available commands:');
                printLine('  configure terminal       - Enter global config mode');
                printLine('  show ip route            - Show routing table');
                printLine('  show ip interface brief  - Show interface summary');
                printLine('  show controllers serial 0/1/0 - Show DCE/DTE and clock rate');
                printLine('  disable                  - Return to user EXEC');
            } else if (cliMode === 'global_config') {
                printLine('Available commands:');
                printLine('  interface <g0/0|g0/1|s0/1/0>    - Enter interface config');
                printLine('  ip route <net> <mask> <nexthop> - Add static route');
                printLine('  hostname <name>                  - Set hostname');
                printLine('  exit                             - Return to priv EXEC');
            } else if (cliMode === 'if_config') {
                printLine('Available commands:');
                printLine('  ip address <ip> <mask>  - Set IP address');
                printLine('  clock rate <rate>       - Set clock rate (DCE only, e.g. 64000)');
                printLine('  no shutdown             - Bring interface up');
                printLine('  shutdown                - Bring interface down');
                printLine('  exit                    - Return to global config');
            }
            return;
        }

        if (cliMode === 'user_exec') {
            if (cmd === 'enable' || cmd === 'en') {
                cliMode = 'priv_exec';
                obs('enable', 'Entered privileged EXEC');
            } else {
                printLine(`% Unknown command: "${raw}". Type ? for help.`);
            }

        } else if (cliMode === 'priv_exec') {
            if ((cmd === 'configure' && (parts[1] === 'terminal' || parts[1] === 't' || !parts[1])) || cmd === 'conf') {
                cliMode = 'global_config';
                printLine('Enter configuration commands, one per line. End with CNTL/Z.');
            } else if (cmd === 'show' && parts[1] === 'ip' && parts[2] === 'route') {
                printRoutingTable(rState);
            } else if (cmd === 'show' && parts[1] === 'ip' && parts[2] === 'interface' && parts[3] === 'brief') {
                printInterfaceBrief(rState);
            } else if (cmd === 'show' && parts[1] === 'controllers' && parts[2] === 'serial') {
                printControllers(rState);
            } else if (cmd === 'show' && parts[1] === 'running-config') {
                printRunningConfig(rState);
            } else if (cmd === 'disable') {
                cliMode = 'user_exec';
            } else if (cmd === 'exit') {
                cliMode = 'user_exec';
            } else {
                printLine(`% Unknown command: "${raw}". Type ? for help.`);
            }

        } else if (cliMode === 'global_config') {
            if (cmd === 'interface' || cmd === 'int') {
                const ifKey = normaliseIf(parts.slice(1).join(' '));
                if (!ifKey) {
                    printLine('% Invalid input. Valid interfaces: GigabitEthernet0/0 (g0/0), GigabitEthernet0/1 (g0/1), Serial0/1/0 (s0/1/0)');
                    return;
                }
                cliInterface = ifKey;
                cliMode = 'if_config';
                obs(`interface ${ifKey}`, 'Entered IF config');
            } else if (cmd === 'ip' && parts[1] === 'route') {
                const originalParts = raw.trim().split(/\s+/);
                if (originalParts.length >= 5) {
                    const network = originalParts[2];
                    const mask    = originalParts[3];
                    const nexthop = originalParts[4];
                    
                    rState.routes = rState.routes.filter(r => !(r.network === network && r.mask === mask));
                    rState.routes.push({ network, mask, nextHop: nexthop, type: 'static' });
                    printLine('');
                    obs(`ip route ${network} ${mask} ${nexthop}`, 'Static route added');
                } else {
                    printLine('% Incomplete command. Syntax: ip route <network> <mask> <next-hop>');
                }
            } else if (cmd === 'hostname') {
                if (parts[1]) {
                    rState.hostname = raw.trim().split(/\s+/)[1];
                    printLine('');
                } else {
                    printLine('% Incomplete command.');
                }
            } else if (cmd === 'exit') {
                cliMode = 'priv_exec';
            } else if (cmd === 'end') {
                cliMode = 'priv_exec';
                printLine('');
            } else {
                printLine(`% Unknown command: "${raw}". Type ? for help.`);
            }

        } else if (cliMode === 'if_config') {
            if (cmd === 'ip' && parts[1] === 'address') {
                const originalParts = raw.trim().split(/\s+/);
                if (originalParts.length >= 4) {
                    rState.interfaces[cliInterface].ip   = originalParts[2];
                    rState.interfaces[cliInterface].mask = originalParts[3];
                    printLine('');
                    updateDynamicTopologyLabels();
                    obs(`ip address on ${cliInterface}`, `Set to ${originalParts[2]}`);
                } else {
                    printLine('% Incomplete command. Syntax: ip address <ip> <mask>');
                }
            } else if (cmd === 'clock' && parts[1] === 'rate') {
                if (cliInterface !== 'Serial0/1/0') {
                    printLine('% Error: Clock rate can only be configured on Serial interfaces.');
                } else if (rState.interfaces['Serial0/1/0'].role !== 'DCE') {
                    printLine('% Error: Clock rate can only be applied to DCE cable ends.');
                } else {
                    const rate = parseInt(parts[2]);
                    if (rate > 0) {
                        rState.interfaces['Serial0/1/0'].clockRate = rate;
                        printLine('');
                        obs('clock rate', `Configured ${rate} on DCE`);
                    } else {
                        printLine('% Syntax: clock rate <speed> (e.g. 64000)');
                    }
                }
            } else if (cmd === 'no' && parts[1] === 'shutdown') {
                rState.interfaces[cliInterface].state = 'up';
                printLine(`%LINK-5-CHANGED: Interface ${cliInterface}, changed state to up`);
                if (cliInterface === 'Serial0/1/0' && rState.interfaces['Serial0/1/0'].role === 'DCE' && rState.interfaces['Serial0/1/0'].clockRate !== 64000) {
                    printLine(`%LINEPROTO-5-UPDOWN: Line protocol on Interface ${cliInterface}, changed state to down (DCE clock missing)`);
                } else {
                    printLine(`%LINEPROTO-5-UPDOWN: Line protocol on Interface ${cliInterface}, changed state to up`);
                }
                updateDynamicTopologyLabels();
                obs(`no shutdown on ${cliInterface}`, 'Interface up');
            } else if (cmd === 'shutdown') {
                rState.interfaces[cliInterface].state = 'down';
                printLine(`%LINK-5-CHANGED: Interface ${cliInterface}, changed state to administratively down`);
                updateDynamicTopologyLabels();
            } else if (cmd === 'exit') {
                cliMode = 'global_config';
                cliInterface = null;
            } else if (cmd === 'end') {
                cliMode = 'priv_exec';
                cliInterface = null;
                printLine('');
            } else {
                printLine(`% Unknown command: "${raw}". Type ? for help.`);
            }
        }
    }

    // ── Accurate Show Commands ────────────────────────────────────
    function printRoutingTable(rState) {
        printLine('Codes: C - connected, S - static, R - RIP, M - mobile');
        printLine('       * - candidate default');
        printLine('');
        printLine('Gateway of last resort is not set');
        printLine('');
        let hasAny = false;
        for (const ifName in rState.interfaces) {
            const iface = rState.interfaces[ifName];
            if (iface.state === 'up' && iface.ip && iface.mask) {
                const net = calculateNetwork(iface.ip, iface.mask);
                const cidr = iface.mask === '255.255.255.224' ? '27' : '24';
                printLine(`C    ${net}/${cidr} is directly connected, ${ifName}`);
                hasAny = true;
            }
        }
        rState.routes.forEach(route => {
            const cidr = route.mask === '255.255.255.224' ? '27' : '24';
            printLine(`S    ${route.network}/${cidr} [1/0] via ${route.nextHop}`);
            hasAny = true;
        });
        if (!hasAny) printLine('     (no active routes in table)');
    }

    function printInterfaceBrief(rState) {
        printLine('Interface                  IP-Address      OK? Method Status                Protocol');
        for (const ifName in rState.interfaces) {
            const iface = rState.interfaces[ifName];
            const ip    = iface.ip || 'unassigned    ';
            let isLineUp = iface.state === 'up';
            // In 4B Serial DCE requires clock rate
            if (ifName === 'Serial0/1/0' && iface.role === 'DCE' && iface.clockRate !== 64000) {
                isLineUp = false;
            }
            const proto = isLineUp ? 'up' : 'down';
            const status= iface.state === 'up' ? 'up                   ' : 'administratively down';
            printLine(`${ifName.padEnd(27)}${ip.padEnd(16)}YES manual ${status} ${proto}`);
        }
    }

    function printControllers(rState) {
        printLine('Interface Serial0/1/0');
        const role = rState.interfaces['Serial0/1/0'].role;
        const clock = rState.interfaces['Serial0/1/0'].clockRate;
        printLine(`Hardware is PowerQUICC MPC860`);
        printLine(`Cable type: ${role === 'DCE' ? 'V.35 DCE cable' : 'V.35 DTE cable'}`);
        if (role === 'DCE') {
            printLine(`Clock rate: ${clock > 0 ? clock : 'none configured'}`);
        } else {
            printLine(`Clock rate: (provided by remote DCE)`);
        }
    }

    function printRunningConfig(rState) {
        printLine('Building configuration...');
        printLine('Current configuration:');
        printLine(`hostname ${rState.hostname}`);
        printLine('!');
        for (const ifName in rState.interfaces) {
            const iface = rState.interfaces[ifName];
            printLine(`interface ${ifName}`);
            if (iface.ip) printLine(` ip address ${iface.ip} ${iface.mask}`);
            if (ifName === 'Serial0/1/0' && iface.role === 'DCE' && iface.clockRate > 0) {
                printLine(` clock rate ${iface.clockRate}`);
            }
            printLine(` ${iface.state === 'up' ? 'no shutdown' : 'shutdown'}`);
            printLine('!');
        }
        rState.routes.forEach(r => {
            printLine(`ip route ${r.network} ${r.mask} ${r.nextHop}`);
        });
        printLine('end');
    }

    // ── Targeted Interface Validation ─────────────────────────────
    if (validateRouterBtn) {
        validateRouterBtn.addEventListener('click', () => {
            const rState = routerStates[activeRouterKey];
            let issues = [];
            let ok = [];

            const reqIfs = (currentMode === '4A') 
                ? ['GigabitEthernet0/0', 'GigabitEthernet0/1']
                : ['GigabitEthernet0/0', 'GigabitEthernet0/1', 'Serial0/1/0'];

            reqIfs.forEach(ifName => {
                const iface = rState.interfaces[ifName];
                if (iface.ip && iface.mask && iface.state === 'up') {
                    if (ifName === 'Serial0/1/0' && iface.role === 'DCE' && iface.clockRate !== 64000) {
                        issues.push(`⚠ ${ifName}: IP configured & UP, but missing 'clock rate 64000' on DCE.`);
                    } else {
                        ok.push(`✔ ${ifName}: ${iface.ip} — UP`);
                    }
                } else if (iface.ip && iface.mask) {
                    issues.push(`⚠ ${ifName}: ${iface.ip} — interface is SHUTDOWN. Run "no shutdown".`);
                } else {
                    issues.push(`✘ ${ifName}: not configured.`);
                }
            });

            const allUp = issues.length === 0;
            routerValidationOutput.style.cssText = `margin-top:1rem; padding:1rem; border-radius:6px; display:block;
                background:${allUp ? '#D1FAE5' : '#FEF3C7'}; 
                color:${allUp ? '#065F46' : '#92400E'};
                border:1px solid ${allUp ? '#34D399' : '#FCD34D'};`;

            routerValidationOutput.innerHTML =
                `<strong>${rState.hostname} Validation ${allUp ? 'Passed ✔' : 'Issues Found ⚠'}</strong><br><br>` +
                [...ok, ...issues].map(s => `${s}<br>`).join('') +
                (allUp ? '<br>Required interfaces configured and operational!' : '<br>Fix the issues above and re-validate.');
        });
    }

    // ── Ping Tool & Granular Deterministic Troubleshooter ────────
    if (openPingBtn) {
        openPingBtn.addEventListener('click', () => {
            pingSection.style.display = 'block';
            populatePingSources();
        });
    }
    if (closePingBtn) closePingBtn.addEventListener('click', () => { pingSection.style.display = 'none'; });

    function populatePingSources() {
        if (!pingSource) return;
        pingSource.innerHTML = '<option value="">-- Select Source PC --</option>';
        for (const id in nodes()) {
            const n = nodes()[id];
            if (n.type === 'PC') {
                const opt = document.createElement('option');
                opt.value = id;
                opt.textContent = `${n.label || id}  (IP: ${n.ip || 'not set'})`;
                pingSource.appendChild(opt);
            }
        }
    }

    if (sendPingBtn) {
        sendPingBtn.addEventListener('click', () => {
            const srcId  = pingSource ? pingSource.value : '';
            const destIp = pingDest   ? pingDest.value.trim() : '';

            pingOutput.innerHTML = '';
            if (troubleshooterOutput) { troubleshooterOutput.style.display = 'none'; }

            if (!srcId) {
                pingOutput.innerHTML = '<span style="color:#F87171">Select a source PC first.</span><br>';
                return;
            }
            if (!destIp) {
                pingOutput.innerHTML = '<span style="color:#F87171">Enter a destination IP address.</span><br>';
                return;
            }

            const srcNode = nodes()[srcId];
            if (!srcNode || !srcNode.ip) {
                pingOutput.innerHTML = '<span style="color:#F87171">Source PC has no IP configured. Double-click it to set one.</span><br>';
                return;
            }

            pingOutput.innerHTML = `Pinging ${destIp} with 32 bytes of data:<br><br>`;

            const diag = evaluatePingState(srcNode, destIp, srcId);
            let sent = 0, received = 0;
            const total = 4;

            const interval = setInterval(() => {
                if (sent >= total) {
                    clearInterval(interval);
                    pingOutput.innerHTML += `<br>Ping statistics for ${destIp}:<br>`;
                    pingOutput.innerHTML += `&nbsp;&nbsp;&nbsp;&nbsp;Packets: Sent = ${total}, Received = ${received}, Lost = ${total - received} (${Math.round((total - received) / total * 100)}% loss)<br>`;
                    if (received === total) {
                        pingOutput.innerHTML += `<br><span style="color:#34D399">Approximate round trip times: &lt;1ms</span>`;
                        showTroubleshooter('✔ Ping Successful! End-to-end connectivity verified across all hops and return path.', true);
                        updateResult();
                    } else {
                        showTroubleshooter(diag.reason, false);
                    }
                    return;
                }

                if (diag.success) {
                    pingOutput.innerHTML += `Reply from ${destIp}: bytes=32 time&lt;1ms TTL=128<br>`;
                    received++;
                    if (sent === 0 && window.animatePacket && diag.route && diag.route.length >= 2) {
                        window.animatePacket(diag.route[0], diag.route[diag.route.length - 1], diag.route);
                    }
                } else {
                    pingOutput.innerHTML += `Request timed out.<br>`;
                }
                sent++;
            }, 500);
        });
    }

    function evaluatePingState(srcNode, destIp, srcId) {
        let destNode = null, destId = null;
        for (const id in nodes()) {
            if (nodes()[id].ip === destIp) { destNode = nodes()[id]; destId = id; break; }
        }

        if (!srcNode.ip || !srcNode.subnet) {
            return { success: false, reason: 'Source PC has incomplete IP configuration.' };
        }

        if (currentMode === '4A') {
            if (!srcNode.gateway) return { success: false, reason: 'Source PC has no Default Gateway configured.' };
            
            const r0 = routerStates['R0'];
            const g00 = r0.interfaces['GigabitEthernet0/0'];
            const g01 = r0.interfaces['GigabitEthernet0/1'];

            if (g00.state !== 'up' || !g00.ip) return { success: false, reason: 'Router0 GigabitEthernet0/0 is DOWN or unassigned.' };
            if (g01.state !== 'up' || !g01.ip) return { success: false, reason: 'Router0 GigabitEthernet0/1 is DOWN or unassigned.' };

            if (srcNode.gateway !== g00.ip && srcNode.gateway !== g01.ip) {
                return { success: false, reason: `Source Default Gateway (${srcNode.gateway}) does not match Router0 interface.` };
            }

            if (!destNode) return { success: false, reason: `Destination host ${destIp} is unreachable (device not found).` };
            if (!destNode.gateway) return { success: false, reason: `Destination host has no Default Gateway configured.` };
            if (destNode.gateway !== g00.ip && destNode.gateway !== g01.ip) {
                return { success: false, reason: `Destination Default Gateway does not match Router0 interface.` };
            }

            let r0Id = null;
            for (const id in nodes()) { if (nodes()[id].type === 'Router') { r0Id = id; break; } }
            return { success: true, route: [srcId, r0Id, destId].filter(Boolean) };

        } else {
            // Part 4-B: Strict /27 Subnetting & Dual Router Routing
            if (!srcNode.gateway) return { success: false, reason: 'Source PC has no Default Gateway configured.' };
            if (srcNode.subnet !== '255.255.255.224') return { success: false, reason: 'Source PC does not have the correct /27 mask (255.255.255.224).' };

            const r0 = routerStates['R0'];
            const r1 = routerStates['R1'];

            // Check WAN serial link & clock rate
            if (r0.interfaces['Serial0/1/0'].state !== 'up') return { success: false, reason: 'Router0 Serial0/1/0 interface is administratively DOWN.' };
            if (r1.interfaces['Serial0/1/0'].state !== 'up') return { success: false, reason: 'Router1 Serial0/1/0 interface is administratively DOWN.' };
            if (r0.interfaces['Serial0/1/0'].clockRate !== 64000) return { success: false, reason: 'Serial link down: Router0 (DCE) requires "clock rate 64000".' };

            if (!destNode) return { success: false, reason: `Destination host with IP ${destIp} not found.` };
            if (destNode.subnet !== '255.255.255.224') return { success: false, reason: `Destination host has incorrect /27 mask (${destNode.subnet}).` };

            const srcNet = calculateNetwork(srcNode.ip, srcNode.subnet);
            const destNet = calculateNetwork(destNode.ip, destNode.subnet);

            // Forward route verification (R0 -> R1)
            const r0HasForwardRoute = r0.routes.some(r => r.network === destNet && r.mask === '255.255.255.224' && r.nextHop === '192.168.10.66');
            if (!r0HasForwardRoute && (destNet === '192.168.10.96' || destNet === '192.168.10.128')) {
                return { success: false, reason: `Router0 has no valid static route to remote network ${destNet}/27 via next hop 192.168.10.66.` };
            }

            // Return route verification (R1 -> R0)
            const r1HasReturnRoute = r1.routes.some(r => r.network === srcNet && r.mask === '255.255.255.224' && r.nextHop === '192.168.10.65');
            if (!r1HasReturnRoute && (srcNet === '192.168.10.0' || srcNet === '192.168.10.32')) {
                return { success: false, reason: `Return path missing: Router1 has no static route back to source network ${srcNet}/27 via next hop 192.168.10.65.` };
            }

            let r0Id = null, r1Id = null;
            for (const id in nodes()) {
                if (nodes()[id].type === 'Router') {
                    if (nodes()[id].label === 'Router0') r0Id = id;
                    if (nodes()[id].label === 'Router1') r1Id = id;
                }
            }

            return { success: true, route: [srcId, r0Id, r1Id, destId].filter(Boolean) };
        }
    }

    function showTroubleshooter(msg, success) {
        if (!troubleshooterOutput) return;
        troubleshooterOutput.style.cssText = `display:block; margin-top:1rem; padding:1rem; border-radius:6px;
            background:${success ? '#D1FAE5' : '#FEE2E2'};
            color:${success ? '#065F46' : '#991B1B'};
            border:1px solid ${success ? '#34D399' : '#F87171'};`;
        troubleshooterOutput.innerHTML = `<strong>Troubleshooter Diagnostic:</strong><br>${msg}`;
    }

    // ── Result update ─────────────────────────────────────────────
    function updateResult() {
        if (!resultText) return;
        if (currentMode === '4A') {
            resultText.innerHTML = 'Part 4-A: The implementation of router IP addressing and connectivity is completed and verified.<br><br>Part 4-B: Pending.';
        } else {
            resultText.innerHTML = 'Part 4-A: The implementation of router IP addressing and connectivity is completed and verified.<br><br>Part 4-B: Thus, the implementation of IP addressing &amp; subnetting in WAN is done and verified.';
        }
    }

    // ── IP Config Modal save ──────────────────────────────────────
    const saveIpBtn = document.getElementById('save-ip-config');
    if (saveIpBtn) {
        saveIpBtn.addEventListener('click', () => {
            setTimeout(populatePingSources, 100);
        });
    }

    // ── Init ──────────────────────────────────────────────────────
    setMode('4A');
    updatePrompt();
});
