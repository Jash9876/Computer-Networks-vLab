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
                'Serial0/1/0':        { ip: '', mask: '', state: 'down' }
            },
            routes: []
        },
        R1: {
            hostname: 'Router1',
            interfaces: {
                'GigabitEthernet0/0': { ip: '', mask: '', state: 'down' },
                'GigabitEthernet0/1': { ip: '', mask: '', state: 'down' },
                'Serial0/1/0':        { ip: '', mask: '', state: 'down' }
            },
            routes: []
        }
    };

    // ── DOM refs ──────────────────────────────────────────────────
    const mode4ABtn        = document.getElementById('mode-4a-btn');
    const mode4BBtn        = document.getElementById('mode-4b-btn');
    const topoInstructions = document.getElementById('topo-instructions');
    const cableSelect      = document.getElementById('cable-type-select');
    const checkTopoBtn     = document.getElementById('check-topology');
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
        // Scroll the outer terminal container, not the output div
        if (terminalContainer) terminalContainer.scrollTop = terminalContainer.scrollHeight;
    }

    function clearTerminal() {
        if (terminalOutput) terminalOutput.textContent = '';
    }

    function obs(action, result) {
        if (typeof addObservation === 'function') addObservation('Router CLI', action, result);
    }

    // ── Interface name normaliser ─────────────────────────────────
    function normaliseIf(raw) {
        const n = (raw || '').trim().toLowerCase().replace(/\s+/g, '');
        if (/^(g|gi|gigabitethernet)0\/0$/.test(n)) return 'GigabitEthernet0/0';
        if (/^(g|gi|gigabitethernet)0\/1$/.test(n)) return 'GigabitEthernet0/1';
        if (/^(s|se|serial)0\/1\/0$/.test(n))       return 'Serial0/1/0';
        return null;
    }

    // ── Mode switching ────────────────────────────────────────────
    function setMode(mode) {
        if (currentMode !== mode) {
            currentMode = mode;
            resetExperimentState();
        }

        // Button styles
        if (mode === '4A') {
            mode4ABtn.style.cssText = 'padding:.25rem .75rem;font-size:.875rem;background-color:var(--primary-color);color:white;';
            mode4BBtn.style.cssText = 'padding:.25rem .75rem;font-size:.875rem;background-color:var(--secondary-color);color:#E5E7EB;';
            topoInstructions.innerHTML = 'Drag <strong>2 PCs</strong> and <strong>1 Router</strong> onto the canvas, then connect them with <strong>Crossover</strong> cables.';
            cableSelect.innerHTML = '<option value="crossover">Crossover</option>';
            if (openSubnetBtn) openSubnetBtn.style.display = 'none';
            if (subnetSection) subnetSection.style.display = 'none';
        } else {
            mode4BBtn.style.cssText = 'padding:.25rem .75rem;font-size:.875rem;background-color:var(--primary-color);color:white;';
            mode4ABtn.style.cssText = 'padding:.25rem .75rem;font-size:.875rem;background-color:var(--secondary-color);color:#E5E7EB;';
            topoInstructions.innerHTML = 'Drag <strong>4 PCs</strong> and <strong>2 Routers</strong> onto the canvas. Connect PCs → Routers with <strong>Crossover</strong>, Routers → Routers with <strong>Serial DCE</strong>.';
            cableSelect.innerHTML = '<option value="crossover">Crossover</option><option value="serial">Serial DCE</option>';
            if (openSubnetBtn) openSubnetBtn.style.display = 'inline-block';
        }
        clearPanels();
    }

    function resetExperimentState() {
        // 1. Reset topology
        const resetBtn = document.getElementById('reset-topology');
        if (resetBtn) resetBtn.click();
        
        // 2. Reset router states
        routerStates.R0 = {
            hostname: 'Router0',
            interfaces: {
                'GigabitEthernet0/0': { ip: '', mask: '', state: 'down' },
                'GigabitEthernet0/1': { ip: '', mask: '', state: 'down' },
                'Serial0/1/0':        { ip: '', mask: '', state: 'down' }
            },
            routes: []
        };
        routerStates.R1 = {
            hostname: 'Router1',
            interfaces: {
                'GigabitEthernet0/0': { ip: '', mask: '', state: 'down' },
                'GigabitEthernet0/1': { ip: '', mask: '', state: 'down' },
                'Serial0/1/0':        { ip: '', mask: '', state: 'down' }
            },
            routes: []
        };

        // 3. Reset CLI state
        cliMode = 'user_exec';
        cliInterface = null;
        activeRouterKey = 'R0';
        cliHistory = [];
        historyIndex = -1;
        
        const termOutput = document.getElementById('terminal-output');
        if (termOutput) {
            termOutput.innerHTML = '<div>Router con0 is now available</div><div><br></div><div>Press RETURN to get started.</div>';
        }

        // 4. Reset other UI
        const subnetOutput = document.getElementById('subnet-output');
        if (subnetOutput) subnetOutput.innerHTML = '';
        const subnetInput = document.getElementById('subnet-input');
        if (subnetInput) subnetInput.value = '';
        
        const pingStats = document.getElementById('ping-stats');
        if (pingStats) pingStats.innerHTML = '';
        
        const resultText = document.getElementById('result-text');
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

    // ── Topology check ────────────────────────────────────────────
    checkTopoBtn.addEventListener('click', () => {
        let pcCount = 0, routerCount = 0;
        for (let id in nodes()) {
            const n = nodes()[id];
            if (n.type === 'PC')     pcCount++;
            if (n.type === 'Router') routerCount++;
        }

        if (currentMode === '4A') {
            if (pcCount === 2 && routerCount === 1) {
                topoFeedback.style.color = '#059669';
                topoFeedback.textContent = '✔ Topology 4-A correct! Double-click PCs to set IPs, then open the Router CLI.';
                if (openTerminalBtn) openTerminalBtn.style.display = 'inline-block';
                if (openPingBtn)     openPingBtn.style.display     = 'inline-block';
            } else {
                topoFeedback.style.color = '#DC2626';
                topoFeedback.textContent = `✘ Need 2 PCs and 1 Router. (Have ${pcCount} PC(s) and ${routerCount} Router(s))`;
            }
        } else {
            if (pcCount === 4 && routerCount === 2) {
                topoFeedback.style.color = '#059669';
                topoFeedback.textContent = '✔ Topology 4-B correct! Use Subnet Analyzer, configure both routers, then test ping.';
                if (openTerminalBtn) openTerminalBtn.style.display = 'inline-block';
                if (openPingBtn)     openPingBtn.style.display     = 'inline-block';
                if (openSubnetBtn)   openSubnetBtn.style.display   = 'inline-block';
            } else {
                topoFeedback.style.color = '#DC2626';
                topoFeedback.textContent = `✘ Need 4 PCs and 2 Routers. (Have ${pcCount} PC(s) and ${routerCount} Router(s))`;
            }
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
        // Only in 4B: inject a small dropdown above the terminal to switch between R0/R1
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

    // Terminal input handler
    if (terminalInput) {
        terminalInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const raw = terminalInput.value;
                const cmd = raw.trim();
                terminalInput.value = '';

                // Echo typed line
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

        // Keep focus in terminal
        terminalContainer && terminalContainer.addEventListener('click', () => terminalInput.focus());
    }

    // ── Command processor ─────────────────────────────────────────
    function processCommand(raw) {
        const lower = raw.toLowerCase().trim();
        const parts = lower.split(/\s+/);
        const cmd   = parts[0];
        const rState = routerStates[activeRouterKey];

        // ? help
        if (cmd === '?') {
            if (cliMode === 'user_exec') {
                printLine('Available commands:');
                printLine('  enable       - Enter privileged EXEC mode');
            } else if (cliMode === 'priv_exec') {
                printLine('Available commands:');
                printLine('  configure terminal  - Enter global config mode');
                printLine('  show ip route       - Show routing table');
                printLine('  show ip interface brief  - Show interface summary');
                printLine('  disable             - Return to user EXEC');
            } else if (cliMode === 'global_config') {
                printLine('Available commands:');
                printLine('  interface <g0/0|g0/1|s0/1/0>  - Enter interface config');
                printLine('  ip route <net> <mask> <nexthop> - Add static route');
                printLine('  hostname <name>                - Set hostname');
                printLine('  exit                           - Return to priv EXEC');
            } else if (cliMode === 'if_config') {
                printLine('Available commands:');
                printLine('  ip address <ip> <mask>  - Set IP address');
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
                const ifKey = normaliseIf(parts.slice(1).join('/'));
                if (!ifKey) {
                    printLine('% Invalid input. Valid interfaces: g0/0, g0/1, s0/1/0');
                    return;
                }
                cliInterface = ifKey;
                cliMode = 'if_config';
                obs(`interface ${ifKey}`, 'Entered IF config');
            } else if (cmd === 'ip' && parts[1] === 'route') {
                // ip route <network> <mask> <nexthop>
                const originalParts = raw.trim().split(/\s+/);
                if (originalParts.length >= 5) {
                    const network = originalParts[2];
                    const mask    = originalParts[3];
                    const nexthop = originalParts[4];
                    // Remove duplicate if exists
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
                    obs(`ip address on ${cliInterface}`, `Set to ${originalParts[2]}`);
                } else {
                    printLine('% Incomplete command. Syntax: ip address <ip> <mask>');
                }
            } else if (cmd === 'no' && parts[1] === 'shutdown') {
                rState.interfaces[cliInterface].state = 'up';
                printLine(`%LINK-5-CHANGED: Interface ${cliInterface}, changed state to up`);
                printLine(`%LINEPROTO-5-UPDOWN: Line protocol on Interface ${cliInterface}, changed state to up`);
                obs(`no shutdown on ${cliInterface}`, 'Interface up');
            } else if (cmd === 'shutdown') {
                rState.interfaces[cliInterface].state = 'down';
                printLine(`%LINK-5-CHANGED: Interface ${cliInterface}, changed state to administratively down`);
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

    // ── Show commands ─────────────────────────────────────────────
    function printRoutingTable(rState) {
        printLine('Codes: C - connected, S - static');
        printLine('       * - candidate default');
        printLine('');
        printLine('Gateway of last resort is not set');
        printLine('');
        let hasAny = false;
        for (const ifName in rState.interfaces) {
            const iface = rState.interfaces[ifName];
            if (iface.state === 'up' && iface.ip) {
                printLine(`C    ${iface.ip}/? is directly connected, ${ifName}`);
                hasAny = true;
            }
        }
        rState.routes.forEach(route => {
            printLine(`S    ${route.network} [1/0] via ${route.nextHop}`);
            hasAny = true;
        });
        if (!hasAny) printLine('     (no routes yet — configure interfaces and add static routes)');
    }

    function printInterfaceBrief(rState) {
        printLine('Interface                  IP-Address      OK? Method Status                Protocol');
        for (const ifName in rState.interfaces) {
            const iface = rState.interfaces[ifName];
            const ip    = iface.ip || 'unassigned    ';
            const proto = iface.state === 'up' ? 'up' : 'down';
            const status= iface.state === 'up' ? 'up                   ' : 'administratively down';
            printLine(`${ifName.padEnd(27)}${ip.padEnd(16)}YES manual ${status} ${proto}`);
        }
    }

    function printRunningConfig(rState) {
        printLine('Building configuration...');
        printLine('');
        printLine('Current configuration:');
        printLine(`hostname ${rState.hostname}`);
        printLine('!');
        for (const ifName in rState.interfaces) {
            const iface = rState.interfaces[ifName];
            printLine(`interface ${ifName}`);
            if (iface.ip) printLine(` ip address ${iface.ip} ${iface.mask}`);
            printLine(` ${iface.state === 'up' ? 'no shutdown' : 'shutdown'}`);
            printLine('!');
        }
        rState.routes.forEach(r => {
            printLine(`ip route ${r.network} ${r.mask} ${r.nextHop}`);
        });
        printLine('end');
    }

    // ── Validate Router Config button ─────────────────────────────
    if (validateRouterBtn) {
        validateRouterBtn.addEventListener('click', () => {
            const rState = routerStates[activeRouterKey];
            let issues = [];
            let ok = [];

            for (const ifName in rState.interfaces) {
                const iface = rState.interfaces[ifName];
                if (iface.ip && iface.mask && iface.state === 'up') {
                    ok.push(`✔ ${ifName}: ${iface.ip} — UP`);
                } else if (iface.ip && iface.mask) {
                    issues.push(`⚠ ${ifName}: ${iface.ip} — interface is SHUTDOWN. Run "no shutdown".`);
                } else {
                    issues.push(`✘ ${ifName}: not configured.`);
                }
            }

            const allUp = issues.length === 0;
            routerValidationOutput.style.cssText = `margin-top:1rem; padding:1rem; border-radius:6px; display:block;
                background:${allUp ? '#D1FAE5' : '#FEF3C7'}; 
                color:${allUp ? '#065F46' : '#92400E'};
                border:1px solid ${allUp ? '#34D399' : '#FCD34D'};`;

            routerValidationOutput.innerHTML =
                `<strong>${rState.hostname} Validation ${allUp ? 'Passed ✔' : 'Issues Found ⚠'}</strong><br><br>` +
                [...ok, ...issues].map(s => `${s}<br>`).join('') +
                (allUp ? '<br>All interfaces configured and up!' : '<br>Fix the issues above and re-validate.');
        });
    }

    // ── Ping Tool ─────────────────────────────────────────────────
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

            let sent = 0, received = 0;
            const total = 4;

            const interval = setInterval(() => {
                if (sent >= total) {
                    clearInterval(interval);
                    pingOutput.innerHTML += `<br>Ping statistics for ${destIp}:<br>`;
                    pingOutput.innerHTML += `&nbsp;&nbsp;&nbsp;&nbsp;Packets: Sent = ${total}, Received = ${received}, Lost = ${total - received} (${Math.round((total - received) / total * 100)}% loss)<br>`;
                    if (received === total) {
                        pingOutput.innerHTML += `<br><span style="color:#34D399">Approximate round trip times: &lt;1ms</span>`;
                        showTroubleshooter('✔ Ping Successful! End-to-end connectivity verified.', true);
                        updateResult();
                    } else {
                        showTroubleshooter(buildFailReason(srcNode, destIp), false);
                    }
                    return;
                }

                const result = checkPingSuccess(srcNode, destIp, srcId);
                if (result.success) {
                    pingOutput.innerHTML += `Reply from ${destIp}: bytes=32 time&lt;1ms TTL=128<br>`;
                    received++;
                    if (sent === 0 && window.animatePacket && result.route && result.route.length >= 2) {
                        window.animatePacket(result.route[0], result.route[result.route.length - 1], result.route);
                    }
                } else {
                    pingOutput.innerHTML += `Request timed out.<br>`;
                }
                sent++;
            }, 600);
        });
    }

    function checkPingSuccess(srcNode, destIp, srcId) {
        // Find dest node
        let destNode = null, destId = null;
        for (const id in nodes()) {
            if (nodes()[id].ip === destIp) { destNode = nodes()[id]; destId = id; break; }
        }

        // Check router interfaces too
        let routerIfMatch = false;
        for (const rk in routerStates) {
            for (const ifName in routerStates[rk].interfaces) {
                const iface = routerStates[rk].interfaces[ifName];
                if (iface.ip === destIp && iface.state === 'up') { routerIfMatch = true; break; }
            }
        }

        if (!destNode && !routerIfMatch) return { success: false };

        if (currentMode === '4A') {
            // Need: srcNode has gateway, both R0 interfaces up, destNode has ip
            if (!srcNode.gateway) return { success: false };
            const r0 = routerStates['R0'];
            const anyUp = Object.values(r0.interfaces).some(i => i.state === 'up' && i.ip);
            if (!anyUp) return { success: false };

            // Find router node id on canvas
            let routerNodeId = null;
            for (const id in nodes()) {
                if (nodes()[id].type === 'Router') { routerNodeId = id; break; }
            }
            return { success: true, route: [srcId, routerNodeId, destId].filter(Boolean) };
        } else {
            // 4B: Need routes on both sides
            if (!srcNode.gateway) return { success: false };
            const r0 = routerStates['R0'], r1 = routerStates['R1'];
            const r0hasRoutes = r0.routes.length > 0;
            const r1hasRoutes = r1.routes.length > 0;
            if (!r0hasRoutes || !r1hasRoutes) return { success: false };

            let r0Id = null, r1Id = null, rcount = 0;
            for (const id in nodes()) {
                if (nodes()[id].type === 'Router') {
                    if (rcount === 0) r0Id = id;
                    else r1Id = id;
                    rcount++;
                }
            }
            return { success: true, route: [srcId, r0Id, r1Id, destId].filter(Boolean) };
        }
    }

    function buildFailReason(srcNode, destIp) {
        const reasons = [];
        if (!srcNode.gateway) reasons.push('Source PC has no Default Gateway set.');
        if (currentMode === '4A') {
            const r0 = routerStates['R0'];
            const anyUp = Object.values(r0.interfaces).some(i => i.state === 'up' && i.ip);
            if (!anyUp) reasons.push('Router0 has no interfaces configured and up.');
        } else {
            if (routerStates['R0'].routes.length === 0) reasons.push('Router0 has no static routes configured.');
            if (routerStates['R1'].routes.length === 0) reasons.push('Router1 has no static routes configured.');
        }
        // Check dest exists
        let destFound = false;
        for (const id in nodes()) { if (nodes()[id].ip === destIp) { destFound = true; break; } }
        if (!destFound) reasons.push(`No device found with IP ${destIp} — check the destination IP.`);

        return reasons.length > 0
            ? '✘ Ping Failed.<br>' + reasons.map(r => `&nbsp;&nbsp;• ${r}`).join('<br>')
            : '✘ Ping Failed. Check all IP configurations, gateways, interface states, and static routes.';
    }

    function showTroubleshooter(msg, success) {
        if (!troubleshooterOutput) return;
        troubleshooterOutput.style.cssText = `display:block; margin-top:1rem; padding:1rem; border-radius:6px;
            background:${success ? '#D1FAE5' : '#FEE2E2'};
            color:${success ? '#065F46' : '#991B1B'};
            border:1px solid ${success ? '#34D399' : '#F87171'};`;
        troubleshooterOutput.innerHTML = `<strong>Troubleshooter:</strong> ${msg}`;
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

    // ── IP Config Modal save — also update ping sources label ─────
    const saveIpBtn = document.getElementById('save-ip-config');
    if (saveIpBtn) {
        saveIpBtn.addEventListener('click', () => {
            // After save, repopulate ping sources to reflect new IPs
            setTimeout(populatePingSources, 100);
        });
    }

    // ── Init ──────────────────────────────────────────────────────
    setMode('4A');
    updatePrompt();
});
