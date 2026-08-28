/* 
 * Experiment 6: Network Address Translation (NAT) Configuration
 * Interactive Simulation Engine: Part 6A (Static NAT) & Part 6B (Dynamic NAT)
 * Cisco IOS CLI Parser, Translation Engine, and Deterministic Milestone Verification
 */

(function () {
    let currentMode = '6A'; // '6A' or '6B'
    let activeRouterKey = 'R1'; // 'R0' or 'R1'
    let cliMode = 'user_exec'; // 'user_exec', 'priv_exec', 'global_config', 'if_config'
    let cliInterface = null;
    let cliHistory = [];
    let historyIndex = -1;
    let natDebugging = false;

    // ── Topology & Device State ─────────────────────────────────────
    let topoNodes = {};
    let cablesList = [];

    // Cisco Router States
    let routerStates = {
        R0: {
            hostname: 'Router0',
            interfaces: {
                'GigabitEthernet0/0': { ip: null, mask: null, state: 'down', natRole: null },
                'Serial0/1/0': { ip: null, mask: null, state: 'down', role: 'DCE', clockRate: 0, natRole: null }
            },
            staticRoutes: [],
            staticNatRules: [], // [ { localIp, globalIp } ]
            dynamicNatPools: {}, // { 'DYNAT': { startIp, endIp, mask, allocated: {} } }
            accessLists: {}, // { 1: [ { permit: true, net: '10.0.0.0', wildcard: '0.255.255.255' } ] }
            dynamicNatBindings: [], // [ { listNum: 1, poolName: 'DYNAT' } ]
            activeTranslations: [] // [ { protocol: 'ICMP', insideGlobal, insideLocal, outsideLocal, outsideGlobal, expiresAt } ]
        },
        R1: {
            hostname: 'Router1',
            interfaces: {
                'GigabitEthernet0/0': { ip: null, mask: null, state: 'down', natRole: null },
                'Serial0/1/0': { ip: null, mask: null, state: 'down', role: 'DTE', clockRate: 0, natRole: null }
            },
            staticRoutes: [],
            staticNatRules: [],
            dynamicNatPools: {},
            accessLists: {},
            dynamicNatBindings: [],
            activeTranslations: []
        }
    };

    // Expected Configurations
    const EXPECTED_6A = {
        devices: {
            'PC0': { ip: '20.20.20.1', mask: '255.255.255.0', gateway: '20.20.20.254' },
            'PC1': { ip: '20.20.20.2', mask: '255.255.255.0', gateway: '20.20.20.254' },
            'PC2': { ip: '10.10.10.1', mask: '255.255.255.0', gateway: '10.10.10.254' },
            'Server0': { ip: '10.10.10.2', mask: '255.255.255.0', gateway: '10.10.10.254' }
        },
        R0: {
            g00: { ip: '20.20.20.254', mask: '255.255.255.0' },
            s010: { ip: '30.30.30.2', mask: '255.255.255.0', clockRate: 64000 }
        },
        R1: {
            g00: { ip: '10.10.10.254', mask: '255.255.255.0', natRole: 'inside' },
            s010: { ip: '30.30.30.3', mask: '255.255.255.0', natRole: 'outside' },
            staticNat: [
                { localIp: '10.10.10.1', globalIp: '30.30.30.10' },
                { localIp: '10.10.10.2', globalIp: '30.30.30.20' }
            ],
            staticRoute: { network: '20.20.20.0', mask: '255.255.255.0', nextHop: '30.30.30.2' }
        }
    };

    const EXPECTED_6B = {
        devices: {
            'PC0': { ip: '10.0.0.2', mask: '255.0.0.0', gateway: '10.0.0.1' },
            'PC1': { ip: '10.0.0.3', mask: '255.0.0.0', gateway: '10.0.0.1' },
            'Server0': { ip: '3.0.0.2', mask: '255.0.0.0', gateway: '3.0.0.1' }
        },
        R0: {
            g00: { ip: '10.0.0.1', mask: '255.0.0.0', natRole: 'inside' },
            s010: { ip: '2.0.0.1', mask: '255.0.0.0', clockRate: 64000, natRole: 'outside' },
            acl1: { net: '10.0.0.0', wildcard: '0.255.255.255' },
            poolName: 'DYNAT',
            poolStart: '2.0.0.10',
            poolEnd: '2.0.0.20',
            staticRoute: { network: '3.0.0.0', mask: '255.0.0.0', nextHop: '2.0.0.2' }
        },
        R1: {
            s010: { ip: '2.0.0.2', mask: '255.0.0.0' },
            g00: { ip: '3.0.0.1', mask: '255.0.0.0' }
        }
    };

    // Milestone tracking
    let verifiedMilestones = new Set();

    function obs(stage, action, result) {
        if (typeof addObservation === 'function') {
            addObservation(stage, action, result);
        }
    }

    // ── Interface Name Normalizer ─────────────────────────────────
    function normaliseIf(raw) {
        if (!raw) return null;
        const s = String(raw).trim().toLowerCase().replace(/\s+/g, ' ');

        // GigabitEthernet 0/0
        if (/^(?:gigabitethernet\s*(?:gi|g)?\s*0\/0|(?:gi|g)\s*0\/0|0\/0|fastethernet\s*0\/0|fa\s*0\/0)$/i.test(s)) {
            return 'GigabitEthernet0/0';
        }

        // Serial 0/1/0
        if (/^(?:serial\s*(?:se|s)?\s*0\/1\/0|(?:se|s)\s*0\/1\/0|0\/1\/0|serial\s*0\/0\/0|s\s*0\/0\/0)$/i.test(s)) {
            return 'Serial0/1/0';
        }

        return null;
    }

    // ── IP Calculation Helper ─────────────────────────────────────
    function calculateNetwork(ipStr, maskStr) {
        if (!ipStr || !maskStr) return '';
        const ipParts = ipStr.split('.').map(Number);
        const maskParts = maskStr.split('.').map(Number);
        if (ipParts.length !== 4 || maskParts.length !== 4) return '';
        return ipParts.map((p, i) => p & maskParts[i]).join('.');
    }

    function ipToLong(ip) {
        return ip.split('.').reduce((acc, oct) => (acc << 8) + parseInt(oct, 10), 0) >>> 0;
    }

    function longToIp(long) {
        return [(long >>> 24) & 255, (long >>> 16) & 255, (long >>> 8) & 255, long & 255].join('.');
    }

    // ── Initialize Interactive Canvas ─────────────────────────────
    function initTopology(mode) {
        currentMode = mode;
        topoNodes = {};
        cablesList = [];

        if (mode === '6A') {
            activeRouterKey = 'R1';
            // Default 6A pre-configured background state for Router0
            routerStates.R0.hostname = 'Router0';
            routerStates.R0.interfaces['GigabitEthernet0/0'] = { ip: '20.20.20.254', mask: '255.255.255.0', state: 'up', natRole: null };
            routerStates.R0.interfaces['Serial0/1/0'] = { ip: '30.30.30.2', mask: '255.255.255.0', state: 'up', role: 'DCE', clockRate: 64000, natRole: null };

            // Router1 is to be configured by the student
            routerStates.R1.hostname = 'Router1';
            routerStates.R1.interfaces['GigabitEthernet0/0'] = { ip: null, mask: null, state: 'down', natRole: null };
            routerStates.R1.interfaces['Serial0/1/0'] = { ip: null, mask: null, state: 'down', role: 'DTE', clockRate: 0, natRole: null };
            routerStates.R1.staticNatRules = [];
            routerStates.R1.staticRoutes = [];
            routerStates.R1.activeTranslations = [];

            topoNodes = {
                'PC0': { type: 'PC', label: 'PC0', ip: '20.20.20.1', subnet: '255.255.255.0', gateway: '20.20.20.254', x: 60, y: 100 },
                'PC1': { type: 'PC', label: 'PC1', ip: '20.20.20.2', subnet: '255.255.255.0', gateway: '20.20.20.254', x: 60, y: 220 },
                'SW0': { type: 'Switch', label: 'Switch0', x: 180, y: 160 },
                'R0':  { type: 'Router', label: 'Router0', x: 300, y: 160 },
                'R1':  { type: 'Router', label: 'Router1', x: 480, y: 160 },
                'SW1': { type: 'Switch', label: 'Switch1', x: 600, y: 160 },
                'PC2': { type: 'PC', label: 'PC2', ip: '', subnet: '', gateway: '', x: 720, y: 100 },
                'Server0': { type: 'Server', label: 'Server0', ip: '', subnet: '', gateway: '', x: 720, y: 220 }
            };
        } else {
            // Mode 6B: Dynamic NAT
            activeRouterKey = 'R0';
            // Router0 to be configured by student
            routerStates.R0.hostname = 'Router0';
            routerStates.R0.interfaces['GigabitEthernet0/0'] = { ip: null, mask: null, state: 'down', natRole: null };
            routerStates.R0.interfaces['Serial0/1/0'] = { ip: null, mask: null, state: 'down', role: 'DCE', clockRate: 0, natRole: null };
            routerStates.R0.accessLists = {};
            routerStates.R0.dynamicNatPools = {};
            routerStates.R0.dynamicNatBindings = [];
            routerStates.R0.staticRoutes = [];
            routerStates.R0.activeTranslations = [];

            // Router1 pre-configured as ISP
            routerStates.R1.hostname = 'Router1';
            routerStates.R1.interfaces['Serial0/1/0'] = { ip: '2.0.0.2', mask: '255.0.0.0', state: 'up', role: 'DTE', clockRate: 0, natRole: null };
            routerStates.R1.interfaces['GigabitEthernet0/0'] = { ip: '3.0.0.1', mask: '255.0.0.0', state: 'up', natRole: null };

            topoNodes = {
                'PC0': { type: 'PC', label: 'PC0', ip: '', subnet: '', gateway: '', x: 80, y: 110 },
                'PC1': { type: 'PC', label: 'PC1', ip: '', subnet: '', gateway: '', x: 80, y: 230 },
                'SW0': { type: 'Switch', label: 'Switch0', x: 220, y: 170 },
                'R0':  { type: 'Router', label: 'Router0', x: 360, y: 170 },
                'R1':  { type: 'Router', label: 'Router1', x: 540, y: 170 },
                'Server0': { type: 'Server', label: 'Server0', ip: '3.0.0.2', subnet: '255.0.0.0', gateway: '3.0.0.1', x: 700, y: 170 }
            };
        }

        renderTopologyCanvas();
        updatePrompt();
    }

    function renderTopologyCanvas() {
        const canvasContainer = document.getElementById('nat-topology-container');
        if (!canvasContainer) return;

        canvasContainer.innerHTML = '';
        const canvas = document.createElement('div');
        canvas.style.cssText = 'position:relative; width:100%; height:320px; background:#F8FAFC; border:1px solid #E2E8F0; border-radius:8px; overflow:hidden;';

        // Render Connections
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.style.cssText = 'position:absolute; top:0; left:0; width:100%; height:100%; pointer-events:none;';
        
        function drawLine(n1, n2, isSerial) {
            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('x1', n1.x + 24);
            line.setAttribute('y1', n1.y + 24);
            line.setAttribute('x2', n2.x + 24);
            line.setAttribute('y2', n2.y + 24);
            line.setAttribute('stroke', isSerial ? '#DC2626' : '#2563EB');
            line.setAttribute('stroke-width', isSerial ? '3' : '2');
            if (isSerial) line.setAttribute('stroke-dasharray', '6,4');
            svg.appendChild(line);
        }

        if (currentMode === '6A') {
            drawLine(topoNodes['PC0'], topoNodes['SW0'], false);
            drawLine(topoNodes['PC1'], topoNodes['SW0'], false);
            drawLine(topoNodes['SW0'], topoNodes['R0'], false);
            drawLine(topoNodes['R0'], topoNodes['R1'], true);
            drawLine(topoNodes['R1'], topoNodes['SW1'], false);
            drawLine(topoNodes['SW1'], topoNodes['PC2'], false);
            drawLine(topoNodes['SW1'], topoNodes['Server0'], false);
        } else {
            drawLine(topoNodes['PC0'], topoNodes['SW0'], false);
            drawLine(topoNodes['PC1'], topoNodes['SW0'], false);
            drawLine(topoNodes['SW0'], topoNodes['R0'], false);
            drawLine(topoNodes['R0'], topoNodes['R1'], true);
            drawLine(topoNodes['R1'], topoNodes['Server0'], false);
        }
        canvas.appendChild(svg);

        // Render Device Nodes
        for (const id in topoNodes) {
            const n = topoNodes[id];
            const nodeDiv = document.createElement('div');
            nodeDiv.id = `node-${id}`;
            nodeDiv.style.cssText = `position:absolute; left:${n.x}px; top:${n.y}px; width:48px; height:48px; background:white; border:2px solid #3B82F6; border-radius:8px; display:flex; flex-direction:column; align-items:center; justify-content:center; cursor:pointer; box-shadow:0 2px 4px rgba(0,0,0,0.1); user-select:none; z-index:10;`;

            let iconName = 'monitor';
            if (n.type === 'Router') iconName = 'router';
            else if (n.type === 'Switch') iconName = 'network';
            else if (n.type === 'Server') iconName = 'server';

            nodeDiv.innerHTML = `
                <div style="font-size:0.65rem; font-weight:bold; color:#1E293B;">${n.label}</div>
                <div style="font-size:0.55rem; color:#64748B;">${n.ip || 'no-ip'}</div>
            `;

            nodeDiv.addEventListener('click', () => handleNodeClick(id));
            canvas.appendChild(nodeDiv);
        }

        canvasContainer.appendChild(canvas);
    }

    function handleNodeClick(id) {
        const node = topoNodes[id];
        if (!node) return;

        if (node.type === 'PC' || node.type === 'Server') {
            openIpModal(id);
        } else if (node.type === 'Router') {
            activeRouterKey = id === 'R0' ? 'R0' : 'R1';
            updatePrompt();
            printLine(`\n[ Switched CLI active console to ${routerStates[activeRouterKey].hostname} ]`);
        }
    }

    function openIpModal(id) {
        const modal = document.getElementById('ip-config-modal');
        const titleEl = document.getElementById('ip-modal-title');
        const ipInput = document.getElementById('ip-address-input');
        const maskInput = document.getElementById('subnet-mask-input');
        const gwInput = document.getElementById('gateway-input');
        const node = topoNodes[id];

        if (!modal || !node) return;
        modal.style.display = 'flex';
        titleEl.textContent = `IP Configuration: ${node.label}`;
        ipInput.value = node.ip || '';
        maskInput.value = node.subnet || '';
        gwInput.value = node.gateway || '';

        document.getElementById('save-ip-config').onclick = () => {
            node.ip = ipInput.value.trim();
            node.subnet = maskInput.value.trim();
            node.gateway = gwInput.value.trim();
            modal.style.display = 'none';
            renderTopologyCanvas();
            checkAddressingMilestone();
            checkDynamicNatMilestone();
        };
    }

    // ── CLI & Terminal Handling ─────────────────────────────────────
    const terminalOutput = document.getElementById('nat-terminal-output');
    const terminalInput = document.getElementById('nat-terminal-input');
    const terminalPrompt = document.getElementById('nat-terminal-prompt');

    function printLine(text) {
        if (!terminalOutput) return;
        const line = document.createElement('div');
        line.style.cssText = 'white-space:pre-wrap; line-height:1.4; color:#E2E8F0; font-family:monospace; font-size:0.85rem;';
        line.innerHTML = text || '&nbsp;';
        terminalOutput.appendChild(line);
        terminalOutput.scrollTop = terminalOutput.scrollHeight;
    }

    function updatePrompt() {
        if (!terminalPrompt) return;
        const rState = routerStates[activeRouterKey];
        if (cliMode === 'user_exec') terminalPrompt.textContent = `${rState.hostname}>`;
        else if (cliMode === 'priv_exec') terminalPrompt.textContent = `${rState.hostname}#`;
        else if (cliMode === 'global_config') terminalPrompt.textContent = `${rState.hostname}(config)#`;
        else if (cliMode === 'if_config') terminalPrompt.textContent = `${rState.hostname}(config-if)#`;
    }

    if (terminalInput) {
        terminalInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                const cmd = terminalInput.value.trim();
                printLine(`${terminalPrompt.textContent} ${cmd}`);
                terminalInput.value = '';
                if (cmd) {
                    cliHistory.unshift(cmd);
                    historyIndex = -1;
                    processCommand(cmd);
                }
                updatePrompt();
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
    }

    // ── Command Processor ───────────────────────────────────────────
    function processCommand(raw) {
        const lower = raw.toLowerCase().trim();
        const parts = lower.split(/\s+/);
        const cmd   = parts[0];
        const rState = routerStates[activeRouterKey];

        if (cmd === '?' || cmd === 'help') {
            printLine('Available Cisco IOS commands:');
            if (cliMode === 'user_exec') {
                printLine('  enable             - Enter privileged EXEC mode');
                printLine('  ping <ip>          - Test ICMP connectivity');
            } else if (cliMode === 'priv_exec') {
                printLine('  configure terminal       - Enter global configuration');
                printLine('  show ip nat translations - Display active NAT table');
                printLine('  show ip nat statistics   - Display NAT summary counters');
                printLine('  show ip interface brief  - Interface status summary');
                printLine('  show ip route            - Display IP routing table');
                printLine('  debug ip nat             - Enable real-time NAT debugging');
                printLine('  no debug ip nat / undebug all - Stop NAT debugging');
                printLine('  ping <ip>                - Send ICMP echo requests');
                printLine('  disable / exit           - Return to user EXEC');
            } else if (cliMode === 'global_config') {
                printLine('  interface <name>                     - Enter interface config mode');
                printLine('  ip nat inside source static <loc> <glob> - Static 1-to-1 NAT mapping');
                printLine('  access-list <num> permit <net> <wildcard> - Define standard ACL');
                printLine('  ip nat pool <name> <start> <end> netmask <mask> - Define Dynamic NAT pool');
                printLine('  ip nat inside source list <num> pool <name>   - Bind ACL to Dynamic Pool');
                printLine('  ip route <net> <mask> <nexthop>      - Add static route');
                printLine('  exit / end                           - Return to privileged EXEC');
            } else if (cliMode === 'if_config') {
                printLine('  ip address <ip> <mask> - Assign IP address and mask');
                printLine('  ip nat inside          - Designate interface as NAT inside boundary');
                printLine('  ip nat outside         - Designate interface as NAT outside boundary');
                printLine('  clock rate 64000       - Set DCE serial clock rate');
                printLine('  no shutdown            - Enable interface');
                printLine('  shutdown               - Administratively disable interface');
                printLine('  exit                   - Return to global configuration');
            }
            return;
        }

        // Mode: user_exec
        if (cliMode === 'user_exec') {
            if (cmd === 'enable' || cmd === 'en') {
                cliMode = 'priv_exec';
                obs('CLI Command', 'enable', 'Entered privileged EXEC');
            } else if (cmd === 'ping') {
                executeCliPing(parts[1]);
            } else {
                printLine(`% Unknown command: "${raw}". Type ? for help.`);
            }
            return;
        }

        // Mode: priv_exec
        if (cliMode === 'priv_exec') {
            if (cmd === 'configure' || cmd === 'conf' || cmd === 'config') {
                cliMode = 'global_config';
                printLine('Enter configuration commands, one per line. End with CNTL/Z.');
            } else if (cmd === 'show' && parts[1] === 'ip' && parts[2] === 'nat' && parts[3] === 'translations') {
                printNatTranslations(rState);
            } else if (cmd === 'show' && parts[1] === 'ip' && parts[2] === 'nat' && parts[3] === 'statistics') {
                printNatStatistics(rState);
            } else if (cmd === 'show' && parts[1] === 'ip' && parts[2] === 'interface' && parts[3] === 'brief') {
                printInterfaceBrief(rState);
            } else if (cmd === 'show' && parts[1] === 'ip' && parts[2] === 'route') {
                printRoutingTable(rState);
            } else if (cmd === 'debug' && parts[1] === 'ip' && parts[2] === 'nat') {
                natDebugging = true;
                printLine('IP NAT debugging is on');
                obs('NAT Debug', 'debug ip nat', 'Enabled real-time NAT diagnostics');
            } else if ((cmd === 'no' && parts[1] === 'debug' && parts[2] === 'ip' && parts[3] === 'nat') || cmd === 'undebug') {
                natDebugging = false;
                printLine('IP NAT debugging is off');
            } else if (cmd === 'ping') {
                executeCliPing(parts[1]);
            } else if (cmd === 'disable' || cmd === 'exit') {
                cliMode = 'user_exec';
            } else {
                printLine(`% Unknown command: "${raw}". Type ? for help.`);
            }
            return;
        }

        // Mode: global_config
        if (cliMode === 'global_config') {
            if (cmd === 'interface' || cmd === 'int') {
                const ifKey = normaliseIf(parts.slice(1).join(' '));
                if (!ifKey) {
                    printLine('% Invalid interface. Available: GigabitEthernet0/0, Serial0/1/0');
                    return;
                }
                cliInterface = ifKey;
                cliMode = 'if_config';
                obs('Interface Config', `interface ${ifKey}`, 'Entered IF config mode');
            } else if (cmd === 'ip' && parts[1] === 'nat' && parts[2] === 'inside' && parts[3] === 'source' && parts[4] === 'static') {
                const originalParts = raw.trim().split(/\s+/);
                if (originalParts.length >= 7) {
                    const localIp = originalParts[5];
                    const globalIp = originalParts[6];
                    rState.staticNatRules = rState.staticNatRules.filter(r => r.localIp !== localIp);
                    rState.staticNatRules.push({ localIp, globalIp });
                    printLine('');
                    obs('Static NAT Config', `ip nat inside source static ${localIp} ${globalIp}`, 'Static mapping recorded');
                    checkStaticNatMilestone();
                } else {
                    printLine('% Incomplete command. Usage: ip nat inside source static <inside-local-ip> <inside-global-ip>');
                }
            } else if (cmd === 'access-list') {
                const originalParts = raw.trim().split(/\s+/);
                if (originalParts.length >= 5 && originalParts[2].toLowerCase() === 'permit') {
                    const listNum = parseInt(originalParts[1]);
                    const net = originalParts[3];
                    const wildcard = originalParts[4];
                    if (!rState.accessLists[listNum]) rState.accessLists[listNum] = [];
                    rState.accessLists[listNum].push({ permit: true, net, wildcard });
                    printLine('');
                    obs('ACL Config', `access-list ${listNum} permit ${net} ${wildcard}`, 'ACL configured');
                    checkDynamicNatMilestone();
                } else {
                    printLine('% Incomplete ACL command. Usage: access-list <1-99> permit <network> <wildcard-mask>');
                }
            } else if (cmd === 'ip' && parts[1] === 'nat' && parts[2] === 'pool') {
                const originalParts = raw.trim().split(/\s+/);
                if (originalParts.length >= 8 && originalParts[6].toLowerCase() === 'netmask') {
                    const poolName = originalParts[3];
                    const startIp = originalParts[4];
                    const endIp = originalParts[5];
                    const mask = originalParts[7];
                    rState.dynamicNatPools[poolName] = { startIp, endIp, mask, allocated: {} };
                    printLine('');
                    obs('NAT Pool Config', `ip nat pool ${poolName} ${startIp} ${endIp} netmask ${mask}`, 'Dynamic pool created');
                    checkDynamicNatMilestone();
                } else {
                    printLine('% Incomplete pool command. Usage: ip nat pool <name> <start-ip> <end-ip> netmask <mask>');
                }
            } else if (cmd === 'ip' && parts[1] === 'nat' && parts[2] === 'inside' && parts[3] === 'source' && parts[4] === 'list' && parts[6] === 'pool') {
                const originalParts = raw.trim().split(/\s+/);
                const listNum = parseInt(originalParts[5]);
                const poolName = originalParts[7];
                rState.dynamicNatBindings = rState.dynamicNatBindings.filter(b => b.listNum !== listNum);
                rState.dynamicNatBindings.push({ listNum, poolName });
                printLine('');
                obs('Dynamic NAT Binding', `ip nat inside source list ${listNum} pool ${poolName}`, 'Dynamic NAT activated');
                checkDynamicNatMilestone();
            } else if (cmd === 'ip' && parts[1] === 'route') {
                const originalParts = raw.trim().split(/\s+/);
                if (originalParts.length >= 5) {
                    const network = originalParts[2];
                    const mask = originalParts[3];
                    const nextHop = originalParts[4];
                    rState.staticRoutes = rState.staticRoutes.filter(r => !(r.network === network && r.mask === mask));
                    rState.staticRoutes.push({ network, mask, nextHop });
                    printLine('');
                    obs('Static Route', `ip route ${network} ${mask} ${nextHop}`, 'Static route configured');
                    checkStaticNatMilestone();
                    checkDynamicNatMilestone();
                }
            } else if (cmd === 'exit' || cmd === 'end') {
                cliMode = 'priv_exec';
            } else {
                printLine(`% Unknown command: "${raw}". Type ? for help.`);
            }
            return;
        }

        // Mode: if_config
        if (cliMode === 'if_config') {
            const iface = rState.interfaces[cliInterface];
            if (cmd === 'ip' && parts[1] === 'address') {
                const originalParts = raw.trim().split(/\s+/);
                if (originalParts.length >= 4) {
                    iface.ip = originalParts[2];
                    iface.mask = originalParts[3];
                    printLine('');
                    obs('Interface IP', `ip address ${originalParts[2]} ${originalParts[3]} on ${cliInterface}`, 'IP configured');
                    checkAddressingMilestone();
                }
            } else if (cmd === 'ip' && parts[1] === 'nat' && (parts[2] === 'inside' || parts[2] === 'outside')) {
                iface.natRole = parts[2];
                printLine('');
                obs('NAT Interface Role', `ip nat ${parts[2]} on ${cliInterface}`, `Designated as ${parts[2]}`);
                checkStaticNatMilestone();
                checkDynamicNatMilestone();
            } else if (cmd === 'clock' && parts[1] === 'rate') {
                if (iface.role === 'DCE') {
                    iface.clockRate = parseInt(parts[2]) || 64000;
                    printLine('');
                    obs('Clock Rate', `clock rate ${parts[2]} on ${cliInterface}`, 'Clock rate applied');
                } else {
                    printLine('% Error: Clock rate can only be applied to DCE cable ends.');
                }
            } else if (cmd === 'no' && parts[1] === 'shutdown') {
                iface.state = 'up';
                printLine(`%LINK-3-UPDOWN: Interface ${cliInterface}, changed state to up`);
                printLine(`%LINEPROTO-5-UPDOWN: Line protocol on Interface ${cliInterface}, changed state to up`);
                obs('Interface State', `no shutdown on ${cliInterface}`, 'Interface brought UP');
                checkAddressingMilestone();
                checkStaticNatMilestone();
                checkDynamicNatMilestone();
            } else if (cmd === 'shutdown') {
                iface.state = 'down';
                printLine(`%LINK-5-CHANGED: Interface ${cliInterface}, changed state to administratively down`);
            } else if (cmd === 'exit') {
                cliMode = 'global_config';
            } else {
                printLine(`% Unknown command: "${raw}". Type ? for help.`);
            }
            return;
        }
    }

    // ── Table Displays ──────────────────────────────────────────────
    function printNatTranslations(rState) {
        if (!rState.activeTranslations || rState.activeTranslations.length === 0) {
            printLine('Pro  Inside global     Inside local       Outside local      Outside global');
            printLine('---  ----------------  ----------------  ----------------  ----------------');
            printLine('     (no active NAT translations recorded)');
            return;
        }
        printLine('Pro  Inside global     Inside local       Outside local      Outside global');
        printLine('---  ----------------  ----------------  ----------------  ----------------');
        rState.activeTranslations.forEach(t => {
            const pro = (t.protocol || 'icmp').padEnd(5);
            const ig = (t.insideGlobal || '---').padEnd(18);
            const il = (t.insideLocal || '---').padEnd(18);
            const ol = (t.outsideLocal || '---').padEnd(18);
            const og = (t.outsideGlobal || '---');
            printLine(`${pro}${ig}${il}${ol}${og}`);
        });
    }

    function printNatStatistics(rState) {
        const totalStatic = rState.staticNatRules.length;
        const totalDynamic = rState.activeTranslations.filter(t => t.type === 'dynamic').length;
        printLine(`Total active translations: ${rState.activeTranslations.length} (${totalStatic} static, ${totalDynamic} dynamic)`);
        printLine(`Outside interfaces:`);
        for (const ifName in rState.interfaces) {
            if (rState.interfaces[ifName].natRole === 'outside') printLine(`  ${ifName}`);
        }
        printLine(`Inside interfaces:`);
        for (const ifName in rState.interfaces) {
            if (rState.interfaces[ifName].natRole === 'inside') printLine(`  ${ifName}`);
        }
        printLine(`Hits: ${rState.activeTranslations.length * 5}  Misses: 0`);
    }

    function printInterfaceBrief(rState) {
        printLine('Interface                  IP-Address      OK? Method Status                Protocol');
        for (const ifName in rState.interfaces) {
            const iface = rState.interfaces[ifName];
            const ip = iface.ip || 'unassigned    ';
            let isLineUp = iface.state === 'up';
            if (ifName === 'Serial0/1/0' && iface.role === 'DCE' && iface.clockRate !== 64000) isLineUp = false;
            const proto = isLineUp ? 'up' : 'down';
            const status = iface.state === 'up' ? 'up                   ' : 'administratively down';
            printLine(`${ifName.padEnd(27)}${ip.padEnd(16)}YES manual ${status} ${proto}`);
        }
    }

    function printRoutingTable(rState) {
        printLine('Codes: C - connected, S - static');
        printLine('');
        for (const ifName in rState.interfaces) {
            const iface = rState.interfaces[ifName];
            if (iface.state === 'up' && iface.ip) {
                printLine(`C    ${iface.ip}/24 is directly connected, ${ifName}`);
            }
        }
        rState.staticRoutes.forEach(route => {
            printLine(`S    ${route.network}/24 [1/0] via ${route.nextHop}`);
        });
    }

    // ── Ping & NAT Translation Simulation ───────────────────────────
    function executeCliPing(targetIp) {
        if (!targetIp) {
            printLine('% Incomplete command. Usage: ping <destination-ip>');
            return;
        }
        printLine('Type escape sequence to abort.');
        printLine(`Sending 5, 100-byte ICMP Echos to ${targetIp}, timeout is 2 seconds:`);

        const evalRes = evaluateNatConnectivity(activeRouterKey, targetIp);
        if (evalRes.success) {
            printLine('!!!!!');
            printLine('Success rate is 100 percent (5/5), round-trip min/avg/max = 1/3/8 ms');
            obs('Ping Verification', `ping ${targetIp}`, 'ICMP Echo successful with active NAT');
            if (currentMode === '6A') checkStaticNatVerifyMilestone();
            else checkDynamicNatVerifyMilestone();
        } else {
            printLine('.....');
            printLine(`Success rate is 0 percent (0/5) (${evalRes.reason})`);
            obs('Ping Verification', `ping ${targetIp}`, `Failed: ${evalRes.reason}`);
        }
    }

    function evaluateNatConnectivity(sourceKey, targetIp) {
        if (currentMode === '6A') {
            // Mode 6A: Static NAT on Router1
            const r1 = routerStates.R1;
            const r0 = routerStates.R0;

            if (r1.interfaces['GigabitEthernet0/0'].state !== 'up' || r1.interfaces['GigabitEthernet0/0'].natRole !== 'inside') {
                return { success: false, reason: 'Router1 G0/0 is down or missing "ip nat inside".' };
            }
            if (r1.interfaces['Serial0/1/0'].state !== 'up' || r1.interfaces['Serial0/1/0'].natRole !== 'outside') {
                return { success: false, reason: 'Router1 Serial0/1/0 is down or missing "ip nat outside".' };
            }

            // Check if pinging mapped static global IP (e.g. 30.30.30.10 or 30.30.30.20)
            const matchedStatic = r1.staticNatRules.find(r => r.globalIp === targetIp);
            if (!matchedStatic) {
                return { success: false, reason: `No static NAT translation rule found for destination ${targetIp}.` };
            }

            // Ensure static route exists back to public side
            const hasRoute = r1.staticRoutes.some(r => r.network === '20.20.20.0' && r.nextHop === '30.30.30.2');
            if (!hasRoute) {
                return { success: false, reason: 'Router1 missing static route to 20.20.20.0/24 via 30.30.30.2.' };
            }

            // Record dynamic translation in NAT table
            r1.activeTranslations = r1.activeTranslations.filter(t => t.insideLocal !== matchedStatic.localIp);
            r1.activeTranslations.push({
                protocol: 'icmp',
                insideGlobal: matchedStatic.globalIp,
                insideLocal: matchedStatic.localIp,
                outsideLocal: '20.20.20.1',
                outsideGlobal: '20.20.20.1',
                type: 'static'
            });

            return { success: true };

        } else {
            // Mode 6B: Dynamic NAT on Router0
            const r0 = routerStates.R0;
            const r1 = routerStates.R1;

            if (r0.interfaces['GigabitEthernet0/0'].state !== 'up' || r0.interfaces['GigabitEthernet0/0'].natRole !== 'inside') {
                return { success: false, reason: 'Router0 G0/0 is down or missing "ip nat inside".' };
            }
            if (r0.interfaces['Serial0/1/0'].state !== 'up' || r0.interfaces['Serial0/1/0'].natRole !== 'outside') {
                return { success: false, reason: 'Router0 Serial0/1/0 is down or missing "ip nat outside".' };
            }
            if (r0.interfaces['Serial0/1/0'].clockRate !== 64000) {
                return { success: false, reason: 'Router0 Serial0/1/0 (DCE) missing "clock rate 64000".' };
            }

            // Check ACL 1
            const acl1 = r0.accessLists[1];
            if (!acl1 || !acl1.some(a => a.net === '10.0.0.0' && a.wildcard === '0.255.255.255')) {
                return { success: false, reason: 'ACL 1 missing or not permitting 10.0.0.0 0.255.255.255.' };
            }

            // Check Dynamic Pool
            const pool = r0.dynamicNatPools['DYNAT'];
            if (!pool || pool.startIp !== '2.0.0.10' || pool.endIp !== '2.0.0.20') {
                return { success: false, reason: 'Dynamic NAT pool "DYNAT" (2.0.0.10 - 2.0.0.20) not configured.' };
            }

            // Check Binding
            const isBound = r0.dynamicNatBindings.some(b => b.listNum === 1 && b.poolName === 'DYNAT');
            if (!isBound) {
                return { success: false, reason: 'Missing binding: "ip nat inside source list 1 pool DYNAT".' };
            }

            // Check Route to 3.0.0.0
            const hasRoute = r0.staticRoutes.some(r => r.network === '3.0.0.0' && r.nextHop === '2.0.0.2');
            if (!hasRoute) {
                return { success: false, reason: 'Router0 missing static route to 3.0.0.0 via 2.0.0.2.' };
            }

            // Dynamically allocate from pool
            const allocatedGlobal = '2.0.0.10';
            const insideLocal = '10.0.0.2';

            if (natDebugging) {
                printLine(`NAT: s=${insideLocal}->${allocatedGlobal}, d=${targetIp} [0]`);
                printLine(`NAT: s=${targetIp}, d=${allocatedGlobal}->${insideLocal} [0]`);
            }

            r0.activeTranslations = r0.activeTranslations.filter(t => t.insideLocal !== insideLocal);
            r0.activeTranslations.push({
                protocol: 'icmp',
                insideGlobal: allocatedGlobal,
                insideLocal: insideLocal,
                outsideLocal: targetIp,
                outsideGlobal: targetIp,
                type: 'dynamic'
            });

            return { success: true };
        }
    }

    // ── Milestone Verification Handlers ─────────────────────────────
    function checkAddressingMilestone() {
        if (currentMode === '6A') {
            const pc0 = topoNodes['PC0'];
            const pc1 = topoNodes['PC1'];
            const pc2 = topoNodes['PC2'];
            const s0 = topoNodes['Server0'];
            const r0 = routerStates.R0;
            const r1 = routerStates.R1;

            const isPc0Ok = pc0 && pc0.ip === '20.20.20.1' && pc0.gateway === '20.20.20.254';
            const isPc1Ok = pc1 && pc1.ip === '20.20.20.2' && pc1.gateway === '20.20.20.254';
            const isPc2Ok = pc2 && pc2.ip === '10.10.10.1' && pc2.gateway === '10.10.10.254';
            const isS0Ok = s0 && s0.ip === '10.10.10.2' && s0.gateway === '10.10.10.254';

            const isR0G0Ok = r0.interfaces['GigabitEthernet0/0'].ip === '20.20.20.254' && r0.interfaces['GigabitEthernet0/0'].state === 'up';
            const isR0S0Ok = r0.interfaces['Serial0/1/0'].ip === '30.30.30.2' && r0.interfaces['Serial0/1/0'].state === 'up';
            const isR1G0Ok = r1.interfaces['GigabitEthernet0/0'].ip === '10.10.10.254' && r1.interfaces['GigabitEthernet0/0'].state === 'up';
            const isR1S0Ok = r1.interfaces['Serial0/1/0'].ip === '30.30.30.3' && r1.interfaces['Serial0/1/0'].state === 'up';

            if (isPc0Ok && isPc1Ok && isPc2Ok && isS0Ok && isR0G0Ok && isR0S0Ok && isR1G0Ok && isR1S0Ok) {
                recordMilestone('6A_TOPOLOGY_IP', '6A Topology & Addressing', 'Configured 6A IP addresses, subnet masks, and operational interfaces across all devices.');
            }
        } else {
            // For 6B, addressing verification is verified as part of 6B Dynamic NAT Config
            checkDynamicNatMilestone();
        }
    }

    function checkStaticNatMilestone() {
        const r1 = routerStates.R1;
        const hasInside = r1.interfaces['GigabitEthernet0/0'].natRole === 'inside';
        const hasOutside = r1.interfaces['Serial0/1/0'].natRole === 'outside';
        const hasMap1 = r1.staticNatRules.some(r => r.localIp === '10.10.10.1' && r.globalIp === '30.30.30.10');
        const hasMap2 = r1.staticNatRules.some(r => r.localIp === '10.10.10.2' && r.globalIp === '30.30.30.20');
        const hasRoute = r1.staticRoutes.some(r => r.network === '20.20.20.0' && r.nextHop === '30.30.30.2');

        if (hasInside && hasOutside && hasMap1 && hasMap2 && hasRoute) {
            recordMilestone('6A_STATIC_NAT', '6A Static NAT Config', 'Configured static 1-to-1 mappings, inside/outside boundaries, and return route.');
        }
    }

    function checkStaticNatVerifyMilestone() {
        const r1 = routerStates.R1;
        const hasActiveTrans = r1.activeTranslations.some(t => 
            t.type === 'static' &&
            ((t.insideLocal === '10.10.10.1' && t.insideGlobal === '30.30.30.10') ||
             (t.insideLocal === '10.10.10.2' && t.insideGlobal === '30.30.30.20'))
        );
        if (hasActiveTrans && verifiedMilestones.has('6A_STATIC_NAT')) {
            recordMilestone('6A_NAT_VERIFY', '6A Static NAT Verified', 'ICMP traffic successfully translated between inside private and outside public domains.');
        }
    }

    function checkDynamicNatMilestone() {
        if (currentMode !== '6B') return;
        const pc0 = topoNodes['PC0'];
        const pc1 = topoNodes['PC1'];
        const s0  = topoNodes['Server0'];
        const r0 = routerStates.R0;

        const isPc0Ok = pc0 && pc0.ip === '10.0.0.2' && pc0.gateway === '10.0.0.1';
        const isPc1Ok = pc1 && pc1.ip === '10.0.0.3' && pc1.gateway === '10.0.0.1';
        const isS0Ok  = s0 && s0.ip === '3.0.0.2' && s0.gateway === '3.0.0.1';

        const isR0G0Ok = r0.interfaces['GigabitEthernet0/0'].ip === '10.0.0.1' && r0.interfaces['GigabitEthernet0/0'].state === 'up' && r0.interfaces['GigabitEthernet0/0'].natRole === 'inside';
        const isR0S0Ok = r0.interfaces['Serial0/1/0'].ip === '2.0.0.1' && r0.interfaces['Serial0/1/0'].state === 'up' && r0.interfaces['Serial0/1/0'].natRole === 'outside' && r0.interfaces['Serial0/1/0'].clockRate === 64000;

        const hasAcl = r0.accessLists[1] && r0.accessLists[1].some(a => a.net === '10.0.0.0' && a.wildcard === '0.255.255.255');
        const hasPool = r0.dynamicNatPools['DYNAT'] && r0.dynamicNatPools['DYNAT'].startIp === '2.0.0.10' && r0.dynamicNatPools['DYNAT'].endIp === '2.0.0.20';
        const hasBinding = r0.dynamicNatBindings.some(b => b.listNum === 1 && b.poolName === 'DYNAT');
        const hasRoute = r0.staticRoutes.some(r => r.network === '3.0.0.0' && r.nextHop === '2.0.0.2');

        if (isPc0Ok && isPc1Ok && isS0Ok && isR0G0Ok && isR0S0Ok && hasAcl && hasPool && hasBinding && hasRoute) {
            recordMilestone('6B_DYN_NAT_CFG', '6B Dynamic NAT Config', 'Configured 6B addressing, Dynamic NAT pool, standard ACL 1, binding rule, and static route.');
        }
    }

    function checkDynamicNatVerifyMilestone() {
        const r0 = routerStates.R0;
        const hasValidDynTrans = r0.activeTranslations.some(t => 
            t.type === 'dynamic' &&
            (t.insideLocal === '10.0.0.2' || t.insideLocal === '10.0.0.3') &&
            t.insideGlobal >= '2.0.0.10' && t.insideGlobal <= '2.0.0.20' &&
            t.outsideGlobal === '3.0.0.2'
        );
        if (hasValidDynTrans && verifiedMilestones.has('6B_DYN_NAT_CFG')) {
            recordMilestone('6B_DYN_NAT_VERIFY', '6B Dynamic NAT Verified', 'Dynamic IP pool allocation and real-time NAT translation verified with outside server.');
        }
    }

    function recordMilestone(milestoneId, stageName, desc) {
        if (!verifiedMilestones.has(milestoneId)) {
            verifiedMilestones.add(milestoneId);
            obs(stageName, `Milestone: ${milestoneId}`, desc);
            updateResult();
        }
    }

    function updateResult() {
        const resTextEl = document.getElementById('result-text');
        if (!resTextEl) return;
        const completedCount = verifiedMilestones.size;
        const isSimComplete = completedCount >= 5;

        resTextEl.innerHTML = `
            <strong>Academic Laboratory Record (Experiment 6 - NAT):</strong><br><br>
            • <strong>Verified Practical Milestones:</strong> ${completedCount}/5 Complete ${isSimComplete ? '✔' : ''}<br>
            • <strong>6A Topology &amp; Addressing:</strong> ${verifiedMilestones.has('6A_TOPOLOGY_IP') ? '<span style="color:#059669; font-weight:bold;">✔ Verified</span>' : '<span style="color:#D97706;">In Progress</span>'}<br>
            • <strong>6A Static NAT Config:</strong> ${verifiedMilestones.has('6A_STATIC_NAT') ? '<span style="color:#059669; font-weight:bold;">✔ Verified</span>' : '<span style="color:#D97706;">In Progress</span>'}<br>
            • <strong>6A NAT Translation Ping:</strong> ${verifiedMilestones.has('6A_NAT_VERIFY') ? '<span style="color:#059669; font-weight:bold;">✔ Verified</span>' : '<span style="color:#64748B;">Pending</span>'}<br>
            • <strong>6B Dynamic NAT Pool &amp; ACL:</strong> ${verifiedMilestones.has('6B_DYN_NAT_CFG') ? '<span style="color:#059669; font-weight:bold;">✔ Verified</span>' : '<span style="color:#D97706;">In Progress</span>'}<br>
            • <strong>6B Dynamic Translation Ping:</strong> ${verifiedMilestones.has('6B_DYN_NAT_VERIFY') ? '<span style="color:#059669; font-weight:bold;">✔ Verified</span>' : '<span style="color:#64748B;">Pending</span>'}<br>
            • <strong>Simulation Requirement Status:</strong> ${isSimComplete ? '<span style="color:#059669; font-weight:bold;">Completed (85%)</span>' : '<span style="color:#2563EB;">In Progress</span>'}
        `;
    }

    // ── Mode Switch Tabs (6A / 6B) ──────────────────────────────────
    document.addEventListener('DOMContentLoaded', () => {
        const btn6A = document.getElementById('btn-mode-6a');
        const btn6B = document.getElementById('btn-mode-6b');

        if (btn6A && btn6B) {
            btn6A.addEventListener('click', () => {
                btn6A.style.background = 'var(--primary-color)';
                btn6A.style.color = 'white';
                btn6B.style.background = '#F1F5F9';
                btn6B.style.color = '#334155';
                initTopology('6A');
                printLine('\n=== Part 6A: Static NAT Active (Router1 Console) ===');
            });

            btn6B.addEventListener('click', () => {
                btn6B.style.background = 'var(--primary-color)';
                btn6B.style.color = 'white';
                btn6A.style.background = '#F1F5F9';
                btn6A.style.color = '#334155';
                initTopology('6B');
                printLine('\n=== Part 6B: Dynamic NAT Active (Router0 Console) ===');
            });
        }

        initTopology('6A');
    });

})();
