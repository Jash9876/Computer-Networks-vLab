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
        <h3>1. Required Hardware / Software Components</h3>
        <p>The following hardware and software components are required to configure a Cisco router through a direct console connection:</p>
        
        <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 6px; padding: 1rem; margin-bottom: 1.5rem; max-width: 500px;">
            <h4 style="margin: 0 0 0.5rem 0; color: #1E293B; font-size: 0.95rem; font-weight: 700;">Exercise 3 Components List</h4>
            <ul style="margin-left: 1.25rem; margin-top: 0.25rem; margin-bottom: 0; font-size: 0.9rem; color: #334155;">
                <li><strong>PC</strong> &times; 1 (with RS232 Serial Port / Terminal Emulator)</li>
                <li><strong>Router</strong> &times; 1 (Cisco 1941 / ISR Series with RJ-45 Console Port)</li>
                <li><strong>Console (Rollover) Cable</strong> &times; 1 (DB-9 / RJ-45 to Console)</li>
            </ul>
        </div>

        <p style="background:#EFF6FF; padding:0.85rem 1rem; border-radius:8px; border-left:4px solid #3B82F6; margin-bottom:1.5rem;">
            <strong>🌐 Real-World Context:</strong> Before a Cisco router can be used in a production network, an administrator must perform an initial configuration. Since a brand-new router has no IP address, this initial setup <em>must</em> be done through a direct physical connection — the <strong>console connection</strong>. This experiment teaches you exactly how that process works.
        </p>

        <h3>2. Console Connection</h3>
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

        <h3>3. Terminal Settings</h3>
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

        <h3>4. Cisco IOS CLI Modes</h3>
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

        <h3>5. Console Password & Login</h3>
        <p>To secure the console line, you enter <strong>Line Configuration Mode</strong> and set a password. The <code style="background:#F1F5F9; padding:2px 6px; border-radius:4px;">login</code> command tells the router to require password authentication when someone connects via the console.</p>
        <pre style="background:#1F2937; color:#10B981; padding:1rem; border-radius:6px; font-size:0.85rem; overflow-x:auto;">Router(config)# line console 0
Router(config-line)# password cisco
Router(config-line)# login
Router(config-line)# exit</pre>

        <h3>6. Enable (Privileged EXEC) Password</h3>
        <p>The <strong>enable password</strong> protects access to Privileged EXEC mode. Without it, anyone at the console can immediately access full configuration capabilities.</p>
        <pre style="background:#1F2937; color:#10B981; padding:1rem; border-radius:6px; font-size:0.85rem; overflow-x:auto;">Router(config)# enable password cisco123</pre>

        <h3>7. Running-Config vs Startup-Config</h3>
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

        <h3>8. Router Interface Configuration</h3>
        <p>After securing the router, you configure its network interfaces with IP addresses so it can route traffic between networks:</p>
        <pre style="background:#1F2937; color:#10B981; padding:1rem; border-radius:6px; font-size:0.85rem; overflow-x:auto;">Router(config)# interface GigabitEthernet0/0/0
Router(config-if)# ip address 192.168.10.1 255.255.255.0
Router(config-if)# ipv6 address 2001:db8:acad:1::1/64
Router(config-if)# description Link to LAN 1
Router(config-if)# no shutdown</pre>
        <p>The <code style="background:#F1F5F9; padding:2px 6px; border-radius:4px;">no shutdown</code> command is essential — Cisco interfaces are <strong>administratively disabled by default</strong> and must be explicitly enabled.</p>
    `,
    procedure: `
        <h3>Laboratory Procedure: Router Configuration Through a Console</h3>
        <p>This experiment guides you through the initial physical connection, terminal parameter setup, line and privileged authentication configuration, configuration backup (NVRAM), reload verification, and interface addressing on a Cisco router.</p>

        <hr style="margin: 2rem 0; border-color: #E2E8F0;">

        <h4>Step 1: Assemble the Physical Console Topology</h4>
        <p><strong>What to do:</strong> In the Simulation workspace, place a <strong>PC</strong> and a <strong>Router (1941)</strong> onto the canvas and connect them using a <strong>Console Cable</strong>:</p>
        <ul>
            <li>Drag <strong>PC</strong> and <strong>Router</strong> from the palette onto the canvas.</li>
            <li>Click <strong>Enable Connect Mode</strong> and select <strong>Console Cable</strong>.</li>
            <li>Connect the <strong>RS232</strong> port of the PC to the <strong>Console</strong> port of the Router.</li>
            <li>Click <strong>Check Topology</strong> to validate the connection.</li>
        </ul>
        <p><strong>Expected result:</strong> Physical console connection is validated between PC0 (RS232) and Router0 (Console).</p>

        <h4>Step 2: Configure Terminal Emulation Parameters</h4>
        <p><strong>What to do:</strong> Double-click the PC icon (or click <strong>Open Terminal</strong>) to launch the Terminal Configuration window and verify the serial parameters:</p>
        <table style="width:100%; border-collapse:collapse; margin-top:0.75rem; margin-bottom:0.75rem; text-align:left;">
            <thead>
                <tr style="border-bottom: 2px solid #E5E7EB; background:#F8FAFC;">
                    <th style="padding:0.5rem 0.75rem;">Parameter</th>
                    <th style="padding:0.5rem 0.75rem;">Standard Value</th>
                    <th style="padding:0.5rem 0.75rem;">Description</th>
                </tr>
            </thead>
            <tbody>
                <tr style="border-bottom: 1px solid #E5E7EB;"><td style="padding:0.5rem 0.75rem;"><strong>Bits Per Second (Baud)</strong></td><td style="padding:0.5rem 0.75rem;"><code>9600</code></td><td style="padding:0.5rem 0.75rem;">Transmission speed for console communication</td></tr>
                <tr style="border-bottom: 1px solid #E5E7EB;"><td style="padding:0.5rem 0.75rem;"><strong>Data Bits</strong></td><td style="padding:0.5rem 0.75rem;"><code>8</code></td><td style="padding:0.5rem 0.75rem;">Character length</td></tr>
                <tr style="border-bottom: 1px solid #E5E7EB;"><td style="padding:0.5rem 0.75rem;"><strong>Parity</strong></td><td style="padding:0.5rem 0.75rem;"><code>None</code></td><td style="padding:0.5rem 0.75rem;">No error parity bit</td></tr>
                <tr style="border-bottom: 1px solid #E5E7EB;"><td style="padding:0.5rem 0.75rem;"><strong>Stop Bits</strong></td><td style="padding:0.5rem 0.75rem;"><code>1</code></td><td style="padding:0.5rem 0.75rem;">One stop bit delimiter</td></tr>
                <tr><td style="padding:0.5rem 0.75rem;"><strong>Flow Control</strong></td><td style="padding:0.5rem 0.75rem;"><code>None</code></td><td style="padding:0.5rem 0.75rem;">No hardware/software handshaking</td></tr>
            </tbody>
        </table>
        <p>Click <strong>OK</strong> to connect to the active Cisco IOS CLI prompt (<code>Router&gt;</code>).</p>
        <p><strong>Expected result:</strong> Terminal emulator establishes communication with the router and displays the User EXEC prompt.</p>

        <h4>Step 3: Configure Console Line Password and Privileged Password</h4>
        <p><strong>What to do:</strong> Enter Privileged EXEC mode, then Global Configuration mode, and configure console line authentication and the enable password:</p>
        <pre style="background:#1F2937; color:#10B981; padding:1rem; border-radius:6px; font-size:0.85rem; overflow-x:auto;">Router> enable
Router# configure terminal
Router(config)# line console 0
Router(config-line)# password cisco
Router(config-line)# login
Router(config-line)# exit
Router(config)# enable password cisco123
Router(config)# exit</pre>
        <p><strong>Expected result:</strong> Console line requires password <code>cisco</code> upon connection, and privileged access requires enable password <code>cisco123</code>.</p>

        <h4>Step 4: Save Active Configuration to NVRAM (Startup-Config)</h4>
        <p><strong>What to do:</strong> In Privileged EXEC mode, save the running-config to startup-config so changes survive a reboot:</p>
        <pre style="background:#1F2937; color:#10B981; padding:1rem; border-radius:6px; font-size:0.85rem; overflow-x:auto;">Router# copy running-config startup-config
Destination filename [startup-config]? [Press Enter]
Building configuration...
[OK]</pre>
        <p><strong>Expected result:</strong> Configuration successfully written to NVRAM.</p>

        <h4>Step 5: Reload the Router and Verify Authentication</h4>
        <p><strong>What to do:</strong> Execute the <code>reload</code> command to restart the router and verify that saved passwords persist:</p>
        <pre style="background:#1F2937; color:#10B981; padding:1rem; border-radius:6px; font-size:0.85rem; overflow-x:auto;">Router# reload
Proceed with reload? [confirm] [Press Enter]

System Bootstrap, Version 15.1(4)M4
...
User Access Verification
Password: cisco
Router> enable
Password: cisco123
Router#</pre>
        <p><strong>Expected result:</strong> Router reboots, prompts for the console password (<code>cisco</code>), and requires enable password (<code>cisco123</code>) to access Privileged EXEC mode.</p>

        <h4>Step 6: Configure Router Interfaces (IPv4, IPv6, Description)</h4>
        <p><strong>What to do:</strong> Re-enter Global Configuration mode and configure the specified GigabitEthernet and Serial interfaces according to the interface table:</p>
        <table style="width:100%; border-collapse:collapse; margin-top:0.75rem; margin-bottom:0.75rem; text-align:left;">
            <thead>
                <tr style="border-bottom: 2px solid #E5E7EB; background:#F8FAFC;">
                    <th style="padding:0.5rem 0.75rem;">Interface</th>
                    <th style="padding:0.5rem 0.75rem;">IPv4 Address &amp; Mask</th>
                    <th style="padding:0.5rem 0.75rem;">IPv6 Address</th>
                    <th style="padding:0.5rem 0.75rem;">Description</th>
                </tr>
            </thead>
            <tbody>
                <tr style="border-bottom: 1px solid #E5E7EB;"><td style="padding:0.5rem 0.75rem;"><strong>GigabitEthernet0/0/0</strong></td><td style="padding:0.5rem 0.75rem;"><code>192.168.10.1 255.255.255.0</code></td><td style="padding:0.5rem 0.75rem;"><code>2001:db8:acad:1::1/64</code></td><td style="padding:0.5rem 0.75rem;">Link to LAN 1</td></tr>
                <tr style="border-bottom: 1px solid #E5E7EB;"><td style="padding:0.5rem 0.75rem;"><strong>GigabitEthernet0/0/1</strong></td><td style="padding:0.5rem 0.75rem;"><code>192.168.11.1 255.255.255.0</code></td><td style="padding:0.5rem 0.75rem;"><code>2001:db8:acad:2::1/64</code></td><td style="padding:0.5rem 0.75rem;">Link to LAN 2</td></tr>
                <tr><td style="padding:0.5rem 0.75rem;"><strong>Serial0/0/0</strong></td><td style="padding:0.5rem 0.75rem;"><code>209.165.200.225 255.255.255.252</code></td><td style="padding:0.5rem 0.75rem;"><code>2001:db8:acad:3::225/64</code></td><td style="padding:0.5rem 0.75rem;">Link to R2</td></tr>
            </tbody>
        </table>
        
        <p><strong>Commands for GigabitEthernet0/0/0:</strong></p>
        <pre style="background:#1F2937; color:#10B981; padding:1rem; border-radius:6px; font-size:0.85rem; overflow-x:auto;">Router# configure terminal
Router(config)# interface GigabitEthernet0/0/0
Router(config-if)# ip address 192.168.10.1 255.255.255.0
Router(config-if)# ipv6 address 2001:db8:acad:1::1/64
Router(config-if)# description Link to LAN 1
Router(config-if)# no shutdown
Router(config-if)# exit</pre>

        <p><strong>Commands for GigabitEthernet0/0/1:</strong></p>
        <pre style="background:#1F2937; color:#10B981; padding:1rem; border-radius:6px; font-size:0.85rem; overflow-x:auto;">Router(config)# interface GigabitEthernet0/0/1
Router(config-if)# ip address 192.168.11.1 255.255.255.0
Router(config-if)# ipv6 address 2001:db8:acad:2::1/64
Router(config-if)# description Link to LAN 2
Router(config-if)# no shutdown
Router(config-if)# exit</pre>

        <p><strong>Commands for Serial0/0/0:</strong></p>
        <pre style="background:#1F2937; color:#10B981; padding:1rem; border-radius:6px; font-size:0.85rem; overflow-x:auto;">Router(config)# interface Serial0/0/0
Router(config-if)# ip address 209.165.200.225 255.255.255.252
Router(config-if)# ipv6 address 2001:db8:acad:3::225/64
Router(config-if)# description Link to R2
Router(config-if)# no shutdown
Router(config-if)# exit
Router(config)# exit</pre>
        <p><strong>Expected result:</strong> All three interfaces are assigned dual-stack IP addresses, descriptions, and administratively brought up (<code>up/up</code>).</p>

        <h4>Step 7: Verify Interface Configuration and Operational Status</h4>
        <p><strong>What to do:</strong> In Privileged EXEC mode, verify the status of all configured interfaces using Cisco IOS show commands:</p>
        <pre style="background:#1F2937; color:#10B981; padding:1rem; border-radius:6px; font-size:0.85rem; overflow-x:auto;">Router# show ip interface brief
Router# show running-config</pre>
        <p>Click <strong>Validate Interfaces</strong> under the CLI terminal in the simulation tab to run automated interface validation.</p>
        <p><strong>Expected result:</strong> <code>GigabitEthernet0/0/0</code>, <code>GigabitEthernet0/0/1</code>, and <code>Serial0/0/0</code> report correct IP addresses with status <code>up</code> and protocol <code>up</code>.</p>
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
