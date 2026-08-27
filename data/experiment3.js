const experimentData = {
    aim: "Exercise 3: Router Configuration Through a Console",
    objectives: [
        "Understand the purpose and use of a console connection to configure a Cisco router.",
        "Learn how to connect a PC to a router using a console (rollover) cable via the RS232 and Console interfaces.",
        "Set default terminal parameters (9600 bps, 8 data bits, no parity, 1 stop bit, no flow control) for console communication.",
        "Configure console line authentication (password and login) on a Cisco router.",
        "Configure a privileged EXEC (enable) password on a Cisco router.",
        "Understand the difference between running-config and startup-config and the importance of saving configuration.",
        "Perform a router reload and verify that saved authentication persists.",
        "Configure IPv4 and IPv6 addresses, subnet masks, descriptions, and enable interfaces on the router."
    ],
    theory: `
        <p style="background:#EFF6FF; padding:0.85rem 1rem; border-radius:8px; border-left:4px solid #3B82F6; margin-bottom:1.5rem;">
            <strong>🌐 Real-World Context:</strong> Before a Cisco router can be used in a production network, an administrator must perform an initial configuration. Since a brand-new router has no IP address, this initial setup <em>must</em> be done through a direct physical connection — the <strong>console connection</strong>. This experiment teaches you exactly how that process works.
        </p>

        <h3>1. Console Connection</h3>
        <p>A <strong>console connection</strong> is an out-of-band management method used to access a Cisco device when no network connectivity exists. It uses a special <strong>console (rollover) cable</strong> that connects the PC's <strong>RS232 serial port</strong> to the router's <strong>Console port</strong>.</p>
        <p>Unlike SSH or Telnet (which require network access), the console connection works even on a completely unconfigured router — making it essential for initial setup, password recovery, and disaster recovery.</p>

        <div style="display:flex; gap:1.5rem; margin:1rem 0; flex-wrap:wrap;">
            <div style="flex:1; min-width:200px; background:#F8FAFC; border:1px solid #E2E8F0; border-radius:8px; padding:1rem;">
                <h4 style="margin:0 0 0.5rem; color:#6B7280;">🖥️ PC Side</h4>
                <p style="margin:0; font-size:0.9rem;"><strong>RS232 Serial Port</strong> — the 9-pin (DB-9) connector used for serial communication. Modern laptops may need a USB-to-Serial adapter.</p>
            </div>
            <div style="flex:1; min-width:200px; background:#EFF6FF; border:2px solid #3B82F6; border-radius:8px; padding:1rem;">
                <h4 style="margin:0 0 0.5rem; color:#1D4ED8;">📡 Router Side</h4>
                <p style="margin:0; font-size:0.9rem;"><strong>Console Port</strong> — a dedicated management port (RJ-45 or USB) on the router front/back panel, labelled "CONSOLE".</p>
            </div>
        </div>

        <h3>2. Terminal Settings</h3>
        <p>After physically connecting the cable, you open a <strong>terminal emulator</strong> (such as PuTTY, HyperTerminal, or the Packet Tracer Terminal) on the PC. The terminal must be configured with the <strong>default console parameters</strong>:</p>
        <table style="width:100%; border-collapse:collapse; margin-bottom:1rem;">
            <tr style="background:#E5E7EB;"><th style="padding:0.5rem; border:1px solid #CBD5E1;">Parameter</th><th style="padding:0.5rem; border:1px solid #CBD5E1;">Default Value</th></tr>
            <tr><td style="padding:0.5rem; border:1px solid #CBD5E1;">Bits Per Second</td><td style="padding:0.5rem; border:1px solid #CBD5E1; font-family:monospace;">9600</td></tr>
            <tr style="background:#F9FAFB;"><td style="padding:0.5rem; border:1px solid #CBD5E1;">Data Bits</td><td style="padding:0.5rem; border:1px solid #CBD5E1; font-family:monospace;">8</td></tr>
            <tr><td style="padding:0.5rem; border:1px solid #CBD5E1;">Parity</td><td style="padding:0.5rem; border:1px solid #CBD5E1; font-family:monospace;">None</td></tr>
            <tr style="background:#F9FAFB;"><td style="padding:0.5rem; border:1px solid #CBD5E1;">Stop Bits</td><td style="padding:0.5rem; border:1px solid #CBD5E1; font-family:monospace;">1</td></tr>
            <tr><td style="padding:0.5rem; border:1px solid #CBD5E1;">Flow Control</td><td style="padding:0.5rem; border:1px solid #CBD5E1; font-family:monospace;">None</td></tr>
        </table>
        <p style="background:#F0FDF4; padding:0.75rem 1rem; border-radius:6px; border-left:4px solid #059669;">
            <strong>💡 Why 9600 bps?</strong> Cisco devices use 9600 baud as the default serial console speed. Both the PC and router must agree on these parameters for successful communication — a mismatch means garbled output or no output at all.
        </p>

        <h3>3. Cisco IOS CLI Modes</h3>
        <p>The Cisco IOS Command Line Interface operates in a hierarchy of modes. Each mode provides access to different sets of commands:</p>
        <div style="background:#1F2937; color:#10B981; padding:1rem; border-radius:8px; font-family:'Courier New', monospace; font-size:0.85rem; margin:0.5rem 0 1rem; overflow-x:auto;">
            <span style="color:#93C5FD;">User EXEC Mode</span>        Router&gt;            (Limited monitoring commands)<br>
                    ↓ enable<br>
            <span style="color:#93C5FD;">Privileged EXEC Mode</span>  Router#             (Full monitoring + config access)<br>
                    ↓ configure terminal<br>
            <span style="color:#93C5FD;">Global Config Mode</span>    Router(config)#     (System-wide configuration)<br>
                    ↓ line console 0 / interface ...<br>
            <span style="color:#93C5FD;">Sub-Config Modes</span>      Router(config-line)#  or  Router(config-if)#
        </div>

        <h3>4. Console Password & Login</h3>
        <p>To secure the console line, you enter <strong>Line Configuration Mode</strong> and set a password. The <code style="background:#F1F5F9; padding:2px 6px; border-radius:4px;">login</code> command tells the router to require password authentication when someone connects via the console.</p>
        <pre style="background:#1F2937; color:#10B981; padding:1rem; border-radius:6px; font-size:0.85rem; overflow-x:auto;">Router(config)# line console 0
Router(config-line)# password cisco
Router(config-line)# login
Router(config-line)# exit</pre>

        <h3>5. Enable (Privileged EXEC) Password</h3>
        <p>The <strong>enable password</strong> protects access to Privileged EXEC mode. Without it, anyone at the console can immediately access full configuration capabilities.</p>
        <pre style="background:#1F2937; color:#10B981; padding:1rem; border-radius:6px; font-size:0.85rem; overflow-x:auto;">Router(config)# enable password cisco123</pre>

        <h3>6. Running-Config vs Startup-Config</h3>
        <p>This is one of the most critical concepts in Cisco networking:</p>
        <div style="display:flex; gap:1.5rem; margin:1rem 0; flex-wrap:wrap;">
            <div style="flex:1; min-width:200px; background:#FEF3C7; border:2px solid #D97706; border-radius:8px; padding:1rem;">
                <h4 style="margin:0 0 0.5rem; color:#92400E;">⚡ Running-Config (RAM)</h4>
                <p style="margin:0; font-size:0.9rem;">The <em>active</em> configuration currently in use. Stored in volatile RAM — <strong>lost on reboot</strong> unless saved.</p>
            </div>
            <div style="flex:1; min-width:200px; background:#D1FAE5; border:2px solid #059669; border-radius:8px; padding:1rem;">
                <h4 style="margin:0 0 0.5rem; color:#065F46;">💾 Startup-Config (NVRAM)</h4>
                <p style="margin:0; font-size:0.9rem;">The <em>saved</em> configuration loaded at boot. Stored in non-volatile NVRAM — <strong>survives reboot</strong>.</p>
            </div>
        </div>
        <p>The command <code style="background:#F1F5F9; padding:2px 6px; border-radius:4px;">copy running-config startup-config</code> (or <code>copy run start</code>) copies the active config to NVRAM, making it permanent.</p>

        <h3>7. Router Interface Configuration</h3>
        <p>After securing the router, you configure its network interfaces with IP addresses so it can route traffic between networks:</p>
        <pre style="background:#1F2937; color:#10B981; padding:1rem; border-radius:6px; font-size:0.85rem; overflow-x:auto;">Router(config)# interface gigabitethernet 0/0/0
Router(config-if)# ip address 192.168.10.1 255.255.255.0
Router(config-if)# ipv6 address 2001:db8:acad:1::1/64
Router(config-if)# description Link to LAN 1
Router(config-if)# no shutdown</pre>
        <p>The <code style="background:#F1F5F9; padding:2px 6px; border-radius:4px;">no shutdown</code> command is essential — Cisco interfaces are <strong>administratively disabled by default</strong> and must be explicitly enabled.</p>
    `,
    procedure: `
        <ol style="line-height:2;">
            <li>
                <strong>Read the Theory:</strong> Go to the Theory tab. Focus on console connections, IOS CLI modes, and the difference between running-config and startup-config.
            </li>
            <li>
                <strong>Module 1 — Console Network Setup:</strong> In the Simulation tab, drag a <strong>PC</strong> and a <strong>Router (1941)</strong> onto the canvas.
                <ul style="margin-top:0.4rem; margin-left:1.5rem; font-size:0.9rem; color:#374151;">
                    <li>Enable <em>Connect Mode</em> and select <strong>Console Cable</strong>.</li>
                    <li>Click the PC, then the Router to draw a connection.</li>
                    <li>Select the correct interfaces: <strong>RS232</strong> on PC0, <strong>Console</strong> on Router0.</li>
                    <li>Click <em>Check Topology</em> to validate the physical connection.</li>
                </ul>
            </li>
            <li>
                <strong>Module 2 — Terminal Configuration:</strong> Double-click the PC to open the Terminal.
                <ul style="margin-top:0.4rem; margin-left:1.5rem; font-size:0.9rem; color:#374151;">
                    <li>Verify the default terminal parameters (9600 bps, 8 data bits, None parity, 1 stop bit, None flow control).</li>
                    <li>Click <strong>OK</strong> to accept and enter the router CLI session.</li>
                </ul>
            </li>
            <li>
                <strong>Module 3 — Router Authentication:</strong> Use the CLI to configure console and enable passwords:
                <ul style="margin-top:0.4rem; margin-left:1.5rem; font-size:0.9rem; color:#374151;">
                    <li><code>enable</code> → <code>configure terminal</code> → <code>line console 0</code></li>
                    <li><code>password cisco</code> → <code>login</code> → <code>exit</code></li>
                    <li><code>enable password cisco123</code> → <code>exit</code></li>
                    <li><code>copy run start</code> → press Enter to accept default filename</li>
                </ul>
            </li>
            <li>
                <strong>Module 4 — Reload & Verify Authentication:</strong> Type <code>reload</code> to reboot the router. After the boot sequence, enter the console password (<code>cisco</code>) and enable password (<code>cisco123</code>) to verify they persist.
            </li>
            <li>
                <strong>Module 5 — Interface Configuration:</strong> Enter Global Config mode and configure the three interfaces:
                <ul style="margin-top:0.4rem; margin-left:1.5rem; font-size:0.9rem; color:#374151;">
                    <li>GigabitEthernet 0/0/0: IP 192.168.10.1/24, IPv6 2001:db8:acad:1::1/64, "Link to LAN 1"</li>
                    <li>GigabitEthernet 0/0/1: IP 192.168.11.1/24, IPv6 2001:db8:acad:2::1/64, "Link to LAN 2"</li>
                    <li>Serial 0/0/0: IP 209.165.200.225/30, IPv6 2001:db8:acad:3::225/64, "Link to R2"</li>
                </ul>
            </li>
            <li>
                <strong>Verify Configuration:</strong> Use <code>show ip interface brief</code> and <code>show running-config</code> to verify all interfaces are correctly configured and up.
            </li>
            <li>
                Check your progress in the <strong>Observation</strong> tab, then complete the <strong>Quiz</strong>.
            </li>
        </ol>
    `,
    result: "Thus, the initial configuration of a router (console authentication, enable password, and interface configuration) is done successfully through a console connection.",
    quiz: [
        {
            question: "What is the purpose of a console connection to a router?",
            options: [
                "To connect the router to the internet",
                "To perform initial configuration when no network connectivity exists",
                "To transfer files between the PC and router",
                "To monitor network traffic in real-time"
            ],
            answer: 1,
            explanation: "A console connection provides out-of-band management access to a Cisco router. Since a new router has no IP address, the console is the only way to perform initial configuration before network access is available."
        },
        {
            question: "Which PC interface is used to establish a console connection to a router?",
            options: [
                "Ethernet (RJ-45)",
                "USB Type-A",
                "RS232 (Serial)",
                "HDMI"
            ],
            answer: 2,
            explanation: "The RS232 serial port (DB-9 connector) on the PC connects to the router's Console port using a console (rollover) cable. Modern computers may require a USB-to-Serial adapter."
        },
        {
            question: "What is the default terminal speed (baud rate) for a Cisco console connection?",
            options: [
                "115200 bps",
                "19200 bps",
                "9600 bps",
                "4800 bps"
            ],
            answer: 2,
            explanation: "Cisco devices use 9600 baud as the default console speed. Both the terminal emulator and the router must use the same speed for communication to work properly."
        },
        {
            question: "What is the difference between running-config and startup-config?",
            options: [
                "Running-config is in NVRAM; startup-config is in RAM",
                "Running-config is the active config in RAM; startup-config is the saved config in NVRAM that loads at boot",
                "They are different names for the same configuration file",
                "Running-config is for routers; startup-config is for switches"
            ],
            answer: 1,
            explanation: "The running-config is the active configuration stored in volatile RAM (lost on reboot). The startup-config is stored in non-volatile NVRAM and is loaded automatically when the router boots. 'copy run start' copies the active config to NVRAM to make it permanent."
        },
        {
            question: "Why is the 'no shutdown' command necessary when configuring a router interface?",
            options: [
                "It prevents the router from shutting down",
                "It enables the interface — Cisco interfaces are administratively disabled by default",
                "It disables the shutdown timer",
                "It saves the interface configuration"
            ],
            answer: 1,
            explanation: "All Cisco router interfaces are in a 'shutdown' (administratively disabled) state by default. The 'no shutdown' command enables the interface so it can send and receive traffic."
        }
    ]
};
