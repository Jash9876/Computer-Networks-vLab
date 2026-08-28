// Experiment 3: Cisco Router CLI State Machine
// Handles all CLI interaction for "Router Configuration Through a Console"

(function () {
    'use strict';

    // ── Router State ──────────────────────────────────────────────
    const routerState = {
        consolePassword: '',
        consoleLoginEnabled: false,
        enablePassword: '',
        startupConfigSaved: false,
        routerReloaded: false,
        authenticatedConsole: false,
        authenticatedEnable: false,
        hostname: 'Router',

        interfaces: {
            'GigabitEthernet0/0/0': { ipv4: '', mask: '', ipv6: '', description: '', shutdown: true },
            'GigabitEthernet0/0/1': { ipv4: '', mask: '', ipv6: '', description: '', shutdown: true },
            'Serial0/0/0':          { ipv4: '', mask: '', ipv6: '', description: '', shutdown: true }
        },

        // snapshot of running-config at save time (for reload persistence)
        savedConfig: null
    };

    // ── Expected values ───────────────────────────────────────────
    const EXPECTED = {
        consolePassword: 'cisco',
        enablePassword: 'cisco123',
        interfaces: {
            'GigabitEthernet0/0/0': { ipv4: '192.168.10.1', mask: '255.255.255.0', ipv6: '2001:db8:acad:1::1/64', description: 'Link to LAN 1' },
            'GigabitEthernet0/0/1': { ipv4: '192.168.11.1', mask: '255.255.255.0', ipv6: '2001:db8:acad:2::1/64', description: 'Link to LAN 2' },
            'Serial0/0/0':          { ipv4: '209.165.200.225', mask: '255.255.255.252', ipv6: '2001:db8:acad:3::225/64', description: 'Link to R2' }
        }
    };

    // ── CLI Mode enum ─────────────────────────────────────────────
    const MODE = {
        USER_EXEC: 'user_exec',
        PRIV_EXEC: 'priv_exec',
        GLOBAL_CONFIG: 'global_config',
        LINE_CONFIG: 'line_config',
        IF_CONFIG: 'if_config'
    };

    let currentMode = MODE.USER_EXEC;
    let currentInterface = ''; // e.g. 'GigabitEthernet0/0/0'
    let awaitingPassword = false;
    let passwordTarget = ''; // 'console' | 'enable'
    let awaitingReloadConfirm = false;
    let awaitingCopyConfirm = false;
    let cliHistory = [];
    let historyIndex = -1;

    // ── Progress tracking ─────────────────────────────────────────
    const progress = {
        consoleConnected: false,
        terminalConfigured: false,
        consolePasswordSet: false,
        enablePasswordSet: false,
        configSaved: false,
        reloadDone: false,
        authVerified: false,
        g000Configured: false,
        g001Configured: false,
        s000Configured: false
    };

    // ── DOM references (set on init) ──────────────────────────────
    let terminalOutput = null;
    let terminalInput = null;
    let terminalPrompt = null;
    let terminalContainer = null;

    // ── Helpers ───────────────────────────────────────────────────
    function getPromptText() {
        const h = routerState.hostname;
        switch (currentMode) {
            case MODE.USER_EXEC:     return `${h}>`;
            case MODE.PRIV_EXEC:     return `${h}#`;
            case MODE.GLOBAL_CONFIG: return `${h}(config)#`;
            case MODE.LINE_CONFIG:   return `${h}(config-line)#`;
            case MODE.IF_CONFIG:     return `${h}(config-if)#`;
            default:                 return `${h}>`;
        }
    }

    function updatePrompt() {
        if (terminalPrompt) {
            terminalPrompt.textContent = awaitingPassword ? 'Password: ' : getPromptText() + ' ';
        }
        if (terminalInput) {
            terminalInput.type = awaitingPassword ? 'password' : 'text';
        }
    }

    function printLine(text) {
        if (!terminalOutput) return;
        terminalOutput.textContent += text + '\n';
        scrollToBottom();
    }

    function printLines(lines) {
        lines.forEach(l => printLine(l));
    }

    function scrollToBottom() {
        if (terminalOutput) {
            terminalOutput.scrollTop = terminalOutput.scrollHeight;
        }
    }

    function obs(action, result) {
        if (typeof addObservation === 'function') {
            addObservation('Router CLI', action, result);
        }
    }

    // ── Interface name normalizer ─────────────────────────────────
    function normalizeInterface(name) {
        if (!name) return null;
        let n = String(name).trim().toLowerCase();
        n = n.replace(/^gigabitethernet\s*/, 'gi')
             .replace(/^fastethernet\s*/, 'fa')
             .replace(/^serial\s*/, 'se')
             .replace(/\s+/g, '');

        if (/^(gi|g)?0\/0\/0$/.test(n) || n === '0/0/0') return 'GigabitEthernet0/0/0';
        if (/^(gi|g)?0\/0\/1$/.test(n) || n === '0/0/1') return 'GigabitEthernet0/0/1';
        if (/^(se|s)?0\/0\/0$/.test(n))                  return 'Serial0/0/0';
        return null;
    }

    // ── Check if an interface is fully configured ─────────────────
    function isInterfaceComplete(ifName) {
        const iface = routerState.interfaces[ifName];
        const exp = EXPECTED.interfaces[ifName];
        if (!iface || !exp) return false;
        return iface.ipv4 === exp.ipv4 &&
               iface.mask === exp.mask &&
               iface.ipv6 === exp.ipv6 &&
               iface.description.toLowerCase() === exp.description.toLowerCase() &&
               !iface.shutdown;
    }

    // ── Update progress & result ──────────────────────────────────
    function updateProgress() {
        progress.consolePasswordSet = routerState.consolePassword === EXPECTED.consolePassword && routerState.consoleLoginEnabled;
        progress.enablePasswordSet = routerState.enablePassword === EXPECTED.enablePassword;
        progress.configSaved = routerState.startupConfigSaved;
        progress.reloadDone = routerState.routerReloaded;
        progress.authVerified = routerState.authenticatedConsole && routerState.authenticatedEnable;
        progress.g000Configured = isInterfaceComplete('GigabitEthernet0/0/0');
        progress.g001Configured = isInterfaceComplete('GigabitEthernet0/0/1');
        progress.s000Configured = isInterfaceComplete('Serial0/0/0');

        // Update the result section
        updateResultTab();
    }

    function updateResultTab() {
        const resultEl = document.getElementById('result-text');
        if (!resultEl) return;

        const items = [
            { label: 'Console Connection', done: progress.consoleConnected },
            { label: 'Terminal Session', done: progress.terminalConfigured },
            { label: 'Console Authentication', done: progress.consolePasswordSet },
            { label: 'Enable Authentication', done: progress.enablePasswordSet },
            { label: 'Configuration Saved', done: progress.configSaved },
            { label: 'Reload Verification', done: progress.reloadDone },
            { label: 'Authentication Verified', done: progress.authVerified },
            { label: 'G0/0/0 Configuration', done: progress.g000Configured },
            { label: 'G0/0/1 Configuration', done: progress.g001Configured },
            { label: 'S0/0/0 Configuration', done: progress.s000Configured }
        ];

        const allDone = items.every(i => i.done);
        let html = '<table style="width:100%; border-collapse:collapse; margin-bottom:1rem;">';
        html += '<thead><tr><th style="padding:0.5rem 0.75rem; text-align:left; border:1px solid #CBD5E1; background:#F3F4F6;">Task</th><th style="padding:0.5rem; border:1px solid #CBD5E1; background:#F3F4F6; width:80px; text-align:center;">Status</th></tr></thead><tbody>';
        items.forEach(item => {
            const icon = item.done ? '<span style="color:#059669; font-size:1.2rem;">✓</span>' : '<span style="color:#9CA3AF; font-size:1.2rem;">○</span>';
            html += `<tr><td style="padding:0.5rem 0.75rem; border:1px solid #CBD5E1;">${item.label}</td><td style="padding:0.5rem; border:1px solid #CBD5E1; text-align:center;">${icon}</td></tr>`;
        });
        html += '</tbody></table>';

        if (allDone) {
            html += '<div style="background:#D1FAE5; border:1px solid #059669; border-radius:8px; padding:1rem; text-align:center; margin-top:1rem;">';
            html += '<h3 style="color:#065F46; margin:0 0 0.5rem;">Experiment Completed Successfully ✓</h3>';
            html += '<p style="color:#065F46; margin:0;"><strong>Conclusion:</strong> Thus, the initial configuration of a router is done successfully.</p>';
            html += '</div>';
        } else {
            html += '<p style="color:#6B7280; font-style:italic;">Complete all tasks to finish the experiment.</p>';
        }

        resultEl.innerHTML = html;
    }

    // ── Build show outputs ────────────────────────────────────────
    function showRunningConfig() {
        const lines = [
            'Building configuration...',
            '',
            'Current configuration:',
            '!',
            `hostname ${routerState.hostname}`,
            '!'
        ];
        if (routerState.enablePassword) {
            lines.push(`enable password ${routerState.enablePassword}`);
            lines.push('!');
        }
        Object.keys(routerState.interfaces).forEach(ifName => {
            const iface = routerState.interfaces[ifName];
            lines.push(`interface ${ifName}`);
            if (iface.description) lines.push(` description ${iface.description}`);
            if (iface.ipv4 && iface.mask) lines.push(` ip address ${iface.ipv4} ${iface.mask}`);
            if (iface.ipv6) lines.push(` ipv6 address ${iface.ipv6}`);
            if (iface.shutdown) lines.push(' shutdown');
            else lines.push(' no shutdown');
            lines.push('!');
        });
        if (routerState.consolePassword) {
            lines.push('line console 0');
            lines.push(` password ${routerState.consolePassword}`);
            if (routerState.consoleLoginEnabled) lines.push(' login');
            lines.push('!');
        }
        lines.push('end');
        return lines;
    }

    function showStartupConfig() {
        if (!routerState.savedConfig) {
            return ['startup-config is not present'];
        }
        return ['Building configuration...', '', '(Startup configuration matches last saved running-config)', ''];
    }

    function showIpInterfaceBrief() {
        const lines = [
            'Interface              IP-Address       OK? Method Status                Protocol',
        ];
        Object.keys(routerState.interfaces).forEach(ifName => {
            const iface = routerState.interfaces[ifName];
            const ip = iface.ipv4 || 'unassigned';
            const status = iface.shutdown ? 'administratively down' : 'up';
            const protocol = iface.shutdown ? 'down' : 'up';
            const padName = (ifName + '                      ').slice(0, 23);
            const padIp = (ip + '                ').slice(0, 17);
            lines.push(`${padName}${padIp}YES  manual ${status.padEnd(22)} ${protocol}`);
        });
        return lines;
    }

    function showIpv6InterfaceBrief() {
        const lines = [
            'Interface              IPv6 Address                    Status',
        ];
        Object.keys(routerState.interfaces).forEach(ifName => {
            const iface = routerState.interfaces[ifName];
            const ipv6 = iface.ipv6 || 'unassigned';
            const status = iface.shutdown ? 'down' : 'up';
            const padName = (ifName + '                      ').slice(0, 23);
            lines.push(`${padName}${ipv6.padEnd(32)} ${status}`);
        });
        return lines;
    }

    // ── Reload simulation ─────────────────────────────────────────
    function simulateReload() {
        // Restore from saved config or reset if nothing saved
        if (routerState.savedConfig) {
            routerState.consolePassword = routerState.savedConfig.consolePassword;
            routerState.consoleLoginEnabled = routerState.savedConfig.consoleLoginEnabled;
            routerState.enablePassword = routerState.savedConfig.enablePassword;
            // Interfaces reset to saved state (for simplicity, keep them)
            Object.keys(routerState.savedConfig.interfaces).forEach(ifName => {
                routerState.interfaces[ifName] = { ...routerState.savedConfig.interfaces[ifName] };
            });
        } else {
            routerState.consolePassword = '';
            routerState.consoleLoginEnabled = false;
            routerState.enablePassword = '';
            Object.keys(routerState.interfaces).forEach(ifName => {
                routerState.interfaces[ifName] = { ipv4: '', mask: '', ipv6: '', description: '', shutdown: true };
            });
        }

        routerState.routerReloaded = true;
        routerState.authenticatedConsole = false;
        routerState.authenticatedEnable = false;
        currentMode = MODE.USER_EXEC;

        // Clear output and show boot sequence
        terminalOutput.textContent = '';

        const bootLines = [
            '',
            'System Bootstrap, Version 15.0(1r)M9',
            '',
            'Initializing Hardware...',
            '',
            'System image file is "flash:c1900-universalk9-mz.SPA.151-4.M4.bin"',
            '',
            'Cisco IOS Software, C1900 Software',
            'Copyright (c) 1986-2012 by Cisco Systems, Inc.',
            '',
            'Initializing interfaces...',
            '',
        ];

        let lineIndex = 0;
        const bootInterval = setInterval(() => {
            if (lineIndex < bootLines.length) {
                printLine(bootLines[lineIndex]);
                lineIndex++;
            } else {
                clearInterval(bootInterval);
                // After boot: check if console authentication is configured
                if (routerState.consoleLoginEnabled && routerState.consolePassword) {
                    printLine('Press RETURN to get started!');
                    printLine('');
                    printLine('');
                    printLine('User Access Verification');
                    printLine('');
                    awaitingPassword = true;
                    passwordTarget = 'console';
                    updatePrompt();
                    terminalInput.disabled = false;
                    terminalInput.focus();
                } else {
                    printLine('Press RETURN to get started!');
                    printLine('');
                    currentMode = MODE.USER_EXEC;
                    updatePrompt();
                    terminalInput.disabled = false;
                    terminalInput.focus();
                }
                obs('Router Reload', 'Router reloaded successfully');
                updateProgress();
            }
        }, 200);

        terminalInput.disabled = true;
    }

    // ── Command Processing ────────────────────────────────────────
    function processCommand(rawInput) {
        const input = rawInput.trim();

        // ── Password entry ──
        if (awaitingPassword) {
            handlePasswordInput(input);
            return;
        }

        // ── Reload confirm ──
        if (awaitingReloadConfirm) {
            awaitingReloadConfirm = false;
            if (input === '' || input.toLowerCase().startsWith('y')) {
                printLine('');
                simulateReload();
            } else {
                printLine('');
                printLine('Reload aborted.');
            }
            updatePrompt();
            return;
        }

        // ── Copy confirm ──
        if (awaitingCopyConfirm) {
            awaitingCopyConfirm = false;
            // Accept default (empty) or typed filename
            printLine('Building configuration...');
            printLine('[OK]');
            printLine('');

            // Save snapshot
            routerState.startupConfigSaved = true;
            routerState.savedConfig = {
                consolePassword: routerState.consolePassword,
                consoleLoginEnabled: routerState.consoleLoginEnabled,
                enablePassword: routerState.enablePassword,
                interfaces: {}
            };
            Object.keys(routerState.interfaces).forEach(ifName => {
                routerState.savedConfig.interfaces[ifName] = { ...routerState.interfaces[ifName] };
            });

            obs('copy run start', 'Configuration saved to startup-config');
            updateProgress();
            updatePrompt();
            return;
        }

        // Echo the command
        printLine(getPromptText() + ' ' + input);

        if (!input) {
            updatePrompt();
            return;
        }

        // Add to history
        cliHistory.push(input);
        historyIndex = cliHistory.length;

        const parts = input.toLowerCase().split(/\s+/);
        const cmd = parts[0];

        // ── Route to current mode handler ──
        switch (currentMode) {
            case MODE.USER_EXEC:     handleUserExec(input, parts, cmd); break;
            case MODE.PRIV_EXEC:     handlePrivExec(input, parts, cmd); break;
            case MODE.GLOBAL_CONFIG: handleGlobalConfig(input, parts, cmd); break;
            case MODE.LINE_CONFIG:   handleLineConfig(input, parts, cmd); break;
            case MODE.IF_CONFIG:     handleIfConfig(input, parts, cmd); break;
        }

        updatePrompt();
    }

    // ── Password handler ──────────────────────────────────────────
    function handlePasswordInput(input) {
        if (passwordTarget === 'console') {
            if (input === routerState.consolePassword) {
                printLine('');
                routerState.authenticatedConsole = true;
                currentMode = MODE.USER_EXEC;
                awaitingPassword = false;
                obs('Console Auth', 'Console authentication successful');
                updateProgress();
            } else {
                printLine('');
                printLine('% Access denied.');
                printLine('');
                printLine('User Access Verification');
                printLine('');
                // stays in password mode
            }
        } else if (passwordTarget === 'enable') {
            if (input === routerState.enablePassword) {
                printLine('');
                routerState.authenticatedEnable = true;
                currentMode = MODE.PRIV_EXEC;
                awaitingPassword = false;
                obs('Enable Auth', 'Privileged EXEC authentication successful');
                updateProgress();
            } else {
                printLine('');
                printLine('% Access denied.');
                printLine('');
                awaitingPassword = false;
                currentMode = MODE.USER_EXEC;
            }
        }
        updatePrompt();
    }

    // ── User EXEC mode ────────────────────────────────────────────
    function handleUserExec(input, parts, cmd) {
        switch (cmd) {
            case 'enable':
            case 'en':
                if (routerState.enablePassword && routerState.routerReloaded) {
                    awaitingPassword = true;
                    passwordTarget = 'enable';
                    printLine('');
                } else {
                    currentMode = MODE.PRIV_EXEC;
                }
                break;
            case 'show':
                printLine("% You must be in privileged EXEC mode to use 'show' commands. Type 'enable' first.");
                break;
            case 'exit':
                printLine('Router con0 is now available');
                break;
            case '?':
            case 'help':
                printLine('Available commands in User EXEC mode:');
                printLine('  enable    - Enter Privileged EXEC mode');
                printLine('  exit      - Exit the CLI session');
                printLine('  ?         - Show available commands');
                break;
            default:
                printLine(`% Unknown command or not available in User EXEC mode: "${input}"`);
                printLine("  Type '?' for available commands. Use 'enable' to enter Privileged EXEC mode.");
                break;
        }
    }

    // ── Privileged EXEC mode ──────────────────────────────────────
    function handlePrivExec(input, parts, cmd) {
        if (cmd === 'configure' || (cmd === 'conf' && parts[1] === 't') || input.toLowerCase() === 'configure terminal' || input.toLowerCase() === 'conf t') {
            printLine('Enter configuration commands, one per line. End with CNTL/Z.');
            currentMode = MODE.GLOBAL_CONFIG;
            return;
        }

        switch (cmd) {
            case 'show':
                handleShowCommand(parts);
                break;
            case 'copy':
                handleCopyCommand(input.toLowerCase());
                break;
            case 'reload':
                if (!routerState.startupConfigSaved) {
                    printLine('');
                    printLine('System configuration has been modified. Save? [yes/no]: ');
                    printLine("% Warning: Unsaved changes will be lost. Use 'copy run start' first.");
                }
                printLine('Proceed with reload? [confirm]');
                awaitingReloadConfirm = true;
                break;
            case 'disable':
                currentMode = MODE.USER_EXEC;
                break;
            case 'exit':
                currentMode = MODE.USER_EXEC;
                break;
            case '?':
            case 'help':
                printLine('Available commands in Privileged EXEC mode:');
                printLine('  configure terminal  - Enter Global Configuration mode');
                printLine('  show running-config - Display current running configuration');
                printLine('  show startup-config - Display saved startup configuration');
                printLine('  show ip interface brief    - Display interface IP summary');
                printLine('  show ipv6 interface brief  - Display interface IPv6 summary');
                printLine('  copy run start      - Save running-config to startup-config');
                printLine('  reload              - Restart the router');
                printLine('  disable / exit      - Return to User EXEC mode');
                break;
            case 'enable':
                printLine("% Already in Privileged EXEC mode.");
                break;
            default:
                printLine(`% Unknown command: "${input}"`);
                printLine("  The router is currently in Privileged EXEC mode. Type '?' for available commands.");
                break;
        }
    }

    // ── show commands ─────────────────────────────────────────────
    function handleShowCommand(parts) {
        const sub = parts.slice(1).join(' ');
        if (sub === 'running-config' || sub === 'run') {
            showRunningConfig().forEach(l => printLine(l));
        } else if (sub === 'startup-config' || sub === 'start') {
            showStartupConfig().forEach(l => printLine(l));
        } else if (sub === 'ip interface brief' || sub === 'ip int brief' || sub === 'ip int br') {
            showIpInterfaceBrief().forEach(l => printLine(l));
        } else if (sub === 'ipv6 interface brief' || sub === 'ipv6 int brief' || sub === 'ipv6 int br') {
            showIpv6InterfaceBrief().forEach(l => printLine(l));
        } else {
            printLine(`% Unknown show command: "show ${sub}"`);
            printLine('  Available: show running-config, show startup-config, show ip interface brief, show ipv6 interface brief');
        }
        printLine('');
    }

    // ── copy command ──────────────────────────────────────────────
    function handleCopyCommand(input) {
        if (input === 'copy run start' || input === 'copy running-config startup-config') {
            printLine('Destination filename [startup-config]?');
            awaitingCopyConfirm = true;
        } else {
            printLine(`% Unknown copy operation: "${input}"`);
            printLine("  Use: copy running-config startup-config (or copy run start)");
        }
    }

    // ── Global Config mode ────────────────────────────────────────
    function handleGlobalConfig(input, parts, cmd) {
        if (cmd === 'line') {
            if (parts[1] === 'console' && parts[2] === '0') {
                currentMode = MODE.LINE_CONFIG;
                return;
            }
            printLine('% Invalid line specification. Use: line console 0');
            return;
        }

        if (cmd === 'interface' || cmd === 'int') {
            const ifRaw = parts.slice(1).join(' ');
            const ifName = normalizeInterface(ifRaw);
            if (ifName) {
                currentInterface = ifName;
                currentMode = MODE.IF_CONFIG;
            } else {
                printLine(`% Invalid interface: "${ifRaw}"`);
                printLine('  Available interfaces: GigabitEthernet 0/0/0, GigabitEthernet 0/0/1, Serial 0/0/0');
            }
            return;
        }

        if (cmd === 'enable') {
            if (parts[1] === 'password') {
                const pw = parts.slice(2).join(' ');
                if (pw) {
                    routerState.enablePassword = pw;
                    obs('Enable Password', `Enable password set to "${pw}"`);
                    updateProgress();
                } else {
                    printLine('% Missing password. Usage: enable password <password>');
                }
                return;
            }
            printLine("% 'enable' is not valid in Global Configuration mode.");
            printLine("  Did you mean 'enable password <password>'?");
            return;
        }

        if (cmd === 'hostname') {
            const name = parts.slice(1).join(' ');
            if (name) {
                routerState.hostname = name.charAt(0).toUpperCase() + name.slice(1);
            }
            return;
        }

        switch (cmd) {
            case 'exit':
            case 'end':
                currentMode = MODE.PRIV_EXEC;
                if (cmd === 'end') printLine('%SYS-5-CONFIG_I: Configured from console by console');
                break;
            case 'do':
                // Allow "do show ..." from config mode
                handleShowCommand(parts.slice(1));
                break;
            case '?':
            case 'help':
                printLine('Available commands in Global Configuration mode:');
                printLine('  line console 0      - Enter Line Configuration for console');
                printLine('  enable password <pw> - Set the privileged EXEC password');
                printLine('  interface <name>    - Enter Interface Configuration mode');
                printLine('  hostname <name>     - Set the router hostname');
                printLine('  exit / end          - Return to Privileged EXEC mode');
                printLine('  do show ...         - Execute show commands from config mode');
                break;
            default:
                printLine(`% Unknown command for Global Configuration mode: "${input}"`);
                printLine("  Type '?' for available commands.");
                break;
        }
    }

    // ── Line Config mode ──────────────────────────────────────────
    function handleLineConfig(input, parts, cmd) {
        switch (cmd) {
            case 'password':
                const pw = parts.slice(1).join(' ');
                if (pw) {
                    routerState.consolePassword = pw;
                    obs('Console Password', `Console password set to "${pw}"`);
                    updateProgress();
                } else {
                    printLine('% Missing password. Usage: password <password>');
                }
                break;
            case 'login':
                routerState.consoleLoginEnabled = true;
                obs('Console Login', 'Console login authentication enabled');
                updateProgress();
                break;
            case 'exit':
                currentMode = MODE.GLOBAL_CONFIG;
                break;
            case 'end':
                currentMode = MODE.PRIV_EXEC;
                printLine('%SYS-5-CONFIG_I: Configured from console by console');
                break;
            case 'ip':
                printLine("% Invalid command for the current configuration mode (line config).");
                printLine("  IP address configuration must be done in Interface Configuration mode.");
                printLine("  Exit to Global Config, then use: interface <name>");
                break;
            case 'enable':
                printLine("% 'enable' is not valid in Line Configuration mode.");
                printLine("  Exit to Global Config first, then use: enable password <password>");
                break;
            case '?':
            case 'help':
                printLine('Available commands in Line Configuration mode:');
                printLine('  password <pw>  - Set the console line password');
                printLine('  login          - Enable login authentication on this line');
                printLine('  exit           - Return to Global Configuration mode');
                printLine('  end            - Return to Privileged EXEC mode');
                break;
            default:
                printLine(`% Unknown command for Line Configuration mode: "${input}"`);
                printLine("  Console password configuration must be performed from line configuration mode.");
                printLine("  Type '?' for available commands.");
                break;
        }
    }

    // ── Interface Config mode ─────────────────────────────────────
    function handleIfConfig(input, parts, cmd) {
        const iface = routerState.interfaces[currentInterface];
        if (!iface) {
            printLine('% Internal error: interface not found.');
            currentMode = MODE.GLOBAL_CONFIG;
            return;
        }

        if (cmd === 'ip' && parts[1] === 'address') {
            const ip = parts[2];
            const mask = parts[3];
            if (!ip || !mask) {
                printLine('% Incomplete command. Usage: ip address <IP> <Subnet Mask>');
                printLine('  Example: ip address 192.168.10.1 255.255.255.0');
                return;
            }
            iface.ipv4 = ip;
            iface.mask = mask;
            obs(`${currentInterface} IPv4`, `Set to ${ip} ${mask}`);
            updateProgress();
            return;
        }

        if (cmd === 'ipv6' && parts[1] === 'address') {
            const addr = parts[2];
            if (!addr) {
                printLine('% Incomplete command. Usage: ipv6 address <IPv6-address/prefix>');
                printLine('  Example: ipv6 address 2001:db8:acad:1::1/64');
                return;
            }
            iface.ipv6 = addr;
            obs(`${currentInterface} IPv6`, `Set to ${addr}`);
            updateProgress();
            return;
        }

        if (cmd === 'description') {
            const desc = input.substring(input.toLowerCase().indexOf('description') + 12).trim();
            if (!desc) {
                printLine('% Missing description text. Usage: description <text>');
                return;
            }
            iface.description = desc;
            obs(`${currentInterface} Description`, `Set to "${desc}"`);
            updateProgress();
            return;
        }

        if (cmd === 'no' && parts[1] === 'shutdown') {
            iface.shutdown = false;
            printLine(`%LINK-5-CHANGED: Interface ${currentInterface}, changed state to up`);
            printLine(`%LINEPROTO-5-UPDOWN: Line protocol on Interface ${currentInterface}, changed state to up`);
            obs(`${currentInterface}`, 'Interface enabled (no shutdown)');
            updateProgress();
            return;
        }

        if (cmd === 'shutdown') {
            iface.shutdown = true;
            printLine(`%LINK-5-CHANGED: Interface ${currentInterface}, changed state to administratively down`);
            return;
        }

        switch (cmd) {
            case 'exit':
                currentMode = MODE.GLOBAL_CONFIG;
                currentInterface = '';
                break;
            case 'end':
                currentMode = MODE.PRIV_EXEC;
                currentInterface = '';
                printLine('%SYS-5-CONFIG_I: Configured from console by console');
                break;
            case 'password':
                printLine("% 'password' is not valid in Interface Configuration mode.");
                printLine("  Password configuration must be done in Line Configuration mode.");
                printLine("  Exit to Global Config, then use: line console 0");
                break;
            case 'enable':
                printLine("% 'enable' is not valid in Interface Configuration mode.");
                break;
            case 'line':
                printLine("% 'line' is not valid in Interface Configuration mode.");
                printLine("  Exit to Global Config first, then use: line console 0");
                break;
            case '?':
            case 'help':
                printLine(`Configuring interface: ${currentInterface}`);
                printLine('Available commands:');
                printLine('  ip address <IP> <mask>   - Set IPv4 address');
                printLine('  ipv6 address <addr/pfx>  - Set IPv6 address');
                printLine('  description <text>       - Set interface description');
                printLine('  no shutdown              - Enable the interface');
                printLine('  shutdown                 - Disable the interface');
                printLine('  exit                     - Return to Global Configuration');
                printLine('  end                      - Return to Privileged EXEC');
                break;
            default:
                printLine(`% Invalid command for the current configuration mode (interface config): "${input}"`);
                printLine("  Type '?' for available commands.");
                break;
        }
    }

    // ── Initialization ────────────────────────────────────────────
    function initCLI() {
        terminalContainer = document.getElementById('exp3-terminal');
        terminalOutput = document.getElementById('exp3-terminal-output');
        terminalInput = document.getElementById('exp3-terminal-input');
        terminalPrompt = document.getElementById('exp3-terminal-prompt');

        if (!terminalInput) return;

        // Initial state
        currentMode = MODE.USER_EXEC;
        updatePrompt();
        printLine('');
        printLine('Router con0 is now available');
        printLine('');
        printLine('');

        // Handle key input
        terminalInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                const val = terminalInput.value;
                terminalInput.value = '';
                processCommand(val);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                if (historyIndex > 0) {
                    historyIndex--;
                    terminalInput.value = cliHistory[historyIndex] || '';
                }
            } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                if (historyIndex < cliHistory.length - 1) {
                    historyIndex++;
                    terminalInput.value = cliHistory[historyIndex] || '';
                } else {
                    historyIndex = cliHistory.length;
                    terminalInput.value = '';
                }
            }
        });
    }

    // ── Terminal Settings Modal ────────────────────────────────────
    function initTerminalSettingsModal() {
        const openBtn = document.getElementById('exp3-open-terminal-btn');
        const modal = document.getElementById('exp3-terminal-settings-modal');
        const okBtn = document.getElementById('exp3-terminal-ok');
        const cancelBtn = document.getElementById('exp3-terminal-cancel');
        const closeBtn = document.getElementById('exp3-close-terminal-settings');
        const errorEl = document.getElementById('exp3-terminal-settings-error');
        const cliSection = document.getElementById('exp3-cli-section');

        if (!openBtn || !modal) return;

        openBtn.addEventListener('click', () => {
            // Check if topology is validated first
            if (!progress.consoleConnected) {
                const fb = document.getElementById('topology-feedback');
                if (fb) {
                    fb.style.color = '#EF4444';
                    fb.textContent = 'You must first connect the PC to the Router with a Console cable and validate the topology.';
                }
                return;
            }
            modal.style.display = 'flex';
            if (errorEl) errorEl.textContent = '';
        });

        if (okBtn) {
            okBtn.addEventListener('click', () => {
                // Validate settings
                const bps = document.getElementById('exp3-bps').value;
                const dataBits = document.getElementById('exp3-data-bits').value;
                const parity = document.getElementById('exp3-parity').value;
                const stopBits = document.getElementById('exp3-stop-bits').value;
                const flowControl = document.getElementById('exp3-flow-control').value;

                if (bps !== '9600' || dataBits !== '8' || parity !== 'None' || stopBits !== '1' || flowControl !== 'None') {
                    if (errorEl) {
                        errorEl.textContent = 'The default console settings (9600, 8, None, 1, None) are required for this experiment. These are the standard Cisco console parameters.';
                    }
                    return;
                }

                progress.terminalConfigured = true;
                obs('Terminal Settings', 'Default terminal parameters accepted (9600/8/N/1/None)');
                updateProgress();

                modal.style.display = 'none';

                // Show CLI section
                if (cliSection) {
                    cliSection.style.display = 'block';
                    initCLI();
                    if (terminalInput) terminalInput.focus();
                }
            });
        }

        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => { modal.style.display = 'none'; });
        }
        if (closeBtn) {
            closeBtn.addEventListener('click', () => { modal.style.display = 'none'; });
        }
    }

    // ── Port Selection Modal ──────────────────────────────────────
    function initPortSelectionModal() {
        const modal = document.getElementById('exp3-port-modal');
        const connectBtn = document.getElementById('exp3-port-connect');
        const cancelBtn = document.getElementById('exp3-port-cancel');
        const closeBtn = document.getElementById('exp3-close-port-modal');
        const errorEl = document.getElementById('exp3-port-error');

        if (!modal) return;

        if (connectBtn) {
            connectBtn.addEventListener('click', () => {
                const pcPort = document.getElementById('exp3-pc-port').value;
                const routerPort = document.getElementById('exp3-router-port').value;

                if (pcPort !== 'RS232') {
                    if (errorEl) errorEl.textContent = 'Console communication requires the PC\'s RS232 serial interface. Select RS232.';
                    return;
                }
                if (routerPort !== 'Console') {
                    if (errorEl) errorEl.textContent = 'Console communication requires the router\'s Console interface. Select Console.';
                    return;
                }

                // Ports are correct — store the selection
                window.exp3PortsSelected = { pc: pcPort, router: routerPort };
                modal.style.display = 'none';

                // Now finalize the edge in topology
                if (window.exp3PendingEdge) {
                    const { sourceId, targetId, cableType } = window.exp3PendingEdge;
                    if (window.Topology) {
                        window.Topology.edges.push({ sourceId, targetId, cableType, pcPort, routerPort });
                        // Redraw connections
                        document.getElementById('check-topology')?.click();
                    }
                    window.exp3PendingEdge = null;
                }

                obs('Port Selection', `PC: ${pcPort}, Router: ${routerPort}`);
            });
        }

        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                modal.style.display = 'none';
                window.exp3PendingEdge = null;
            });
        }
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                modal.style.display = 'none';
                window.exp3PendingEdge = null;
            });
        }
    }

    // ── Topology validation checker ───────────────────────────────
    function initExp3TopologyCheck() {
        const checkBtn = document.getElementById('check-topology');
        if (!checkBtn) return;

        // We add an additional listener that runs after the existing one
        checkBtn.addEventListener('click', () => {
            if (!document.title.includes('Exercise 3')) return;

            const feedback = document.getElementById('topology-feedback');
            if (!feedback) return;

            const topo = window.Topology;
            if (!topo) return;

            const nodes = topo.nodes;
            const edges = topo.edges;

            let pcs = [], routers = [];
            Object.keys(nodes).forEach(k => {
                if (nodes[k].type === 'PC') pcs.push(k);
                if (nodes[k].type === 'Router') routers.push(k);
            });

            // Validation messages
            const status = [];

            // 1. PC exists
            if (pcs.length >= 1) {
                status.push({ label: 'PC detected', ok: true });
            } else {
                status.push({ label: 'PC detected', ok: false });
            }

            // 2. Router exists
            if (routers.length >= 1) {
                status.push({ label: 'Router 1941 detected', ok: true });
            } else {
                status.push({ label: 'Router 1941 detected', ok: false });
            }

            if (pcs.length === 0 || routers.length === 0) {
                feedback.style.color = '#EF4444';
                feedback.innerHTML = renderStatusList(status);
                feedback.innerHTML += '<br>Place at least 1 PC and 1 Router (1941) on the canvas.';
                return;
            }

            // 3. Find edge between PC and Router
            const edge = edges.find(e =>
                (pcs.includes(e.sourceId) && routers.includes(e.targetId)) ||
                (routers.includes(e.sourceId) && pcs.includes(e.targetId))
            );

            // 4. Console cable
            if (edge && edge.cableType === 'console') {
                status.push({ label: 'Console cable', ok: true });
            } else if (edge) {
                status.push({ label: 'Console cable', ok: false });
                feedback.style.color = '#EF4444';
                feedback.innerHTML = renderStatusList(status);
                feedback.innerHTML += '<br>A Console cable is required for this experiment. Select Console Cable in the cable type dropdown.';
                return;
            } else {
                status.push({ label: 'Console cable', ok: false });
                feedback.style.color = '#EF4444';
                feedback.innerHTML = renderStatusList(status);
                feedback.innerHTML += '<br>Devices are not connected. Use Connect Mode to draw a Console cable between the PC and Router.';
                return;
            }

            // 5. Port selection
            if (edge.pcPort === 'RS232') {
                status.push({ label: 'RS232 connection', ok: true });
            } else {
                status.push({ label: 'RS232 connection', ok: false });
            }

            if (edge.routerPort === 'Console') {
                status.push({ label: 'Router Console', ok: true });
            } else {
                status.push({ label: 'Router Console', ok: false });
            }

            const allOk = status.every(s => s.ok);

            if (allOk) {
                feedback.style.color = '#059669';
                feedback.innerHTML = renderStatusList(status);
                feedback.innerHTML += '<br><strong>Console connection validated! You may now open the Terminal.</strong>';
                progress.consoleConnected = true;

                // Show the open terminal button
                const openBtn = document.getElementById('exp3-open-terminal-btn');
                if (openBtn) openBtn.style.display = 'inline-block';

                updateProgress();
            } else {
                feedback.style.color = '#EF4444';
                feedback.innerHTML = renderStatusList(status);
            }
        });
    }

    function renderStatusList(items) {
        return items.map(i => {
            const icon = i.ok ? '<span style="color:#059669;">✓</span>' : '<span style="color:#EF4444;">✗</span>';
            return `${icon} ${i.label}`;
        }).join('<br>');
    }

    // ── Reset handler ─────────────────────────────────────────────
    function initResetHandler() {
        const resetBtn = document.getElementById('reset-topology');
        if (!resetBtn) return;

        resetBtn.addEventListener('click', () => {
            if (!document.title.includes('Exercise 3')) return;

            // Reset router state
            routerState.consolePassword = '';
            routerState.consoleLoginEnabled = false;
            routerState.enablePassword = '';
            routerState.startupConfigSaved = false;
            routerState.routerReloaded = false;
            routerState.authenticatedConsole = false;
            routerState.authenticatedEnable = false;
            routerState.hostname = 'Router';
            routerState.savedConfig = null;
            Object.keys(routerState.interfaces).forEach(ifName => {
                routerState.interfaces[ifName] = { ipv4: '', mask: '', ipv6: '', description: '', shutdown: true };
            });

            // Reset progress
            Object.keys(progress).forEach(k => { progress[k] = false; });

            // Reset CLI state
            currentMode = MODE.USER_EXEC;
            currentInterface = '';
            awaitingPassword = false;
            passwordTarget = '';
            awaitingReloadConfirm = false;
            awaitingCopyConfirm = false;
            cliHistory = [];
            historyIndex = -1;

            // Hide CLI section
            const cliSection = document.getElementById('exp3-cli-section');
            if (cliSection) cliSection.style.display = 'none';

            // Clear terminal
            if (terminalOutput) terminalOutput.textContent = '';

            // Hide open terminal button
            const openBtn = document.getElementById('exp3-open-terminal-btn');
            if (openBtn) openBtn.style.display = 'none';

            // Clear port selection
            window.exp3PortsSelected = null;
            window.exp3PendingEdge = null;

            // Update result
            updateProgress();

            obs('Reset', 'Experiment 3 state reset');
        });
    }

    // ── Validation Panel ──────────────────────────────────────────
    function initValidationPanel() {
        const validateBtn = document.getElementById('exp3-validate-interfaces');
        if (!validateBtn) return;

        validateBtn.addEventListener('click', () => {
            const panel = document.getElementById('exp3-validation-output');
            if (!panel) return;

            let html = '';

            Object.keys(EXPECTED.interfaces).forEach(ifName => {
                const iface = routerState.interfaces[ifName];
                const exp = EXPECTED.interfaces[ifName];

                html += `<h4 style="margin-top:1rem; margin-bottom:0.5rem;">${ifName}</h4>`;
                html += '<table style="width:100%; border-collapse:collapse; margin-bottom:0.5rem; font-size:0.9rem;">';

                const checks = [
                    { label: 'IPv4 Address', actual: iface.ipv4, expected: exp.ipv4 },
                    { label: 'Subnet Mask', actual: iface.mask, expected: exp.mask },
                    { label: 'IPv6 Address', actual: iface.ipv6, expected: exp.ipv6 },
                    { label: 'Description', actual: iface.description, expected: exp.description },
                    { label: 'Interface Enabled', actual: !iface.shutdown, expected: true }
                ];

                checks.forEach(c => {
                    let match;
                    if (typeof c.expected === 'boolean') {
                        match = c.actual === c.expected;
                    } else {
                        match = c.actual.toLowerCase() === c.expected.toLowerCase();
                    }
                    const icon = match ? '<span style="color:#059669;">✓</span>' : '<span style="color:#EF4444;">✗</span>';
                    const display = typeof c.actual === 'boolean' ? (c.actual ? 'Yes' : 'No') : (c.actual || '(not set)');
                    html += `<tr><td style="padding:0.3rem 0.5rem; border:1px solid #CBD5E1;">${c.label}</td><td style="padding:0.3rem 0.5rem; border:1px solid #CBD5E1; font-family:monospace;">${display}</td><td style="padding:0.3rem; border:1px solid #CBD5E1; text-align:center; width:40px;">${icon}</td></tr>`;
                });

                html += '</table>';
            });

            panel.innerHTML = html;
            updateProgress();
        });
    }

    // ── Boot everything on DOMContentLoaded ───────────────────────
    document.addEventListener('DOMContentLoaded', () => {
        if (!document.title.includes('Exercise 3')) return;

        initTerminalSettingsModal();
        initPortSelectionModal();
        initExp3TopologyCheck();
        initResetHandler();
        initValidationPanel();

        // Initial result tab state
        updateProgress();
    });

    // Expose progress for external access
    window.Exp3Progress = progress;
    window.Exp3RouterState = routerState;

})();
