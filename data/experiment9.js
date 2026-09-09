// Experiment 9 Data - Point-to-Point Protocol (PPP) & High-Level Data Link Control (HDLC)
const experimentData = {
    title: "Exercise 9 — Configuration of Point-to-Point Protocol (PPP) & HDLC Protocol",
    description: "Configure and verify Point-to-Point Protocol (PPP) with CHAP authentication and OSPF routing, and inspect High-Level Data Link Control (HDLC) protocol framing on serial point-to-point links.",

    aim: `<div style="margin-bottom: 1.25rem;">
        <h4 style="margin: 0 0 0.4rem 0; color: #1E293B; font-size: 1rem; font-weight: 700;">EXERCISE-9-A: CONFIGURATION OF POINT-TO-POINT PROTOCOL</h4>
        <p style="margin: 0; color: #475569; font-size: 0.95rem;">To configure the point-to-point protocol (PPP) on Cisco Packet Tracer.</p>
    </div>
    <div>
        <h4 style="margin: 0 0 0.4rem 0; color: #1E293B; font-size: 1rem; font-weight: 700;">EXERCISE-9-B: CONFIGURATION OF HDLC PROTOCOL</h4>
        <p style="margin: 0; color: #475569; font-size: 0.95rem;">To configure the HDLC protocol on Cisco Packet Tracer.</p>
    </div>`,

    objectives: [
        "Configure and verify Point-to-Point Protocol (PPP) encapsulation across serial interfaces on Cisco routers.",
        "Implement and validate Challenge Handshake Authentication Protocol (CHAP) authentication between connecting WAN peers.",
        "Configure Open Shortest Path First (OSPF) dynamic routing (Process 25, Area 0) across multi-LAN networks connected via serial links.",
        "Inspect and analyze High-Level Data Link Control (HDLC) synchronous serial framing and transceiver hardware clocking (DCE vs. DTE) using Cisco IOS diagnostic commands.",
        "Verify end-to-end IP connectivity and routing table convergence across serial point-to-point connections."
    ],

    theory: `
        <h3>1. Required Components &amp; Hardware Requirements</h3>
        <p>The following hardware and software components are utilized for the WAN serial protocol configurations:</p>
        
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">
            <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 6px; padding: 1rem;">
                <h4 style="margin: 0 0 0.5rem 0; color: #1E293B; font-size: 0.95rem; font-weight: 700;">Exercise 9-A (PPP Configuration)</h4>
                <ul style="margin-left: 1.25rem; margin-top: 0.25rem; margin-bottom: 0; font-size: 0.9rem; color: #334155;">
                    <li><strong>PC</strong> &times; 4</li>
                    <li><strong>Switch</strong> &times; 2</li>
                    <li><strong>Router (Cisco 1841 / 2811)</strong> &times; 2</li>
                    <li><strong>Copper Straight-Through Cable</strong> &times; 4</li>
                    <li><strong>Serial Cable (DCE)</strong> &times; 1</li>
                </ul>
            </div>
            <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 6px; padding: 1rem;">
                <h4 style="margin: 0 0 0.5rem 0; color: #1E293B; font-size: 0.95rem; font-weight: 700;">Exercise 9-B (HDLC Configuration)</h4>
                <ul style="margin-left: 1.25rem; margin-top: 0.25rem; margin-bottom: 0; font-size: 0.9rem; color: #334155;">
                    <li><strong>Router (Cisco 1841 / 2811)</strong> &times; 2</li>
                    <li><strong>Serial Cable (DCE)</strong> &times; 1</li>
                </ul>
            </div>
        </div>

        <h3>2. Point-to-Point Protocol (PPP)</h3>
        <p>
            The <strong>Point-to-Point Protocol (PPP)</strong> is a data link layer (Layer 2) protocol used to establish and maintain a direct connection between two networking nodes over serial links.
        </p>
        <p>
            PPP is structured into three main components:
        </p>
        <ul>
            <li><strong>HDLC-like Framing:</strong> A method for encapsulating datagrams over serial links.</li>
            <li><strong>Link Control Protocol (LCP):</strong> Establishes, configures, tests, and terminates the data-link connection. LCP also handles authentication negotiation.</li>
            <li><strong>Network Control Protocols (NCPs):</strong> A family of protocols used to establish and configure different network-layer protocols (such as IPCP for IPv4).</li>
        </ul>

        <h3>3. PPP Authentication (CHAP)</h3>
        <p>
            PPP supports authentication mechanisms to verify the identity of the remote peer before establishing the link:
        </p>
        <ul>
            <li><strong>Challenge Handshake Authentication Protocol (CHAP):</strong> A three-way authentication handshake in which the peer responds to a challenge using a shared secret. The password itself is not sent directly across the link, providing protection against replay attacks.</li>
        </ul>

        <h3>4. High-Level Data Link Control (HDLC) Protocol</h3>
        <p>
            <strong>High-Level Data Link Control (HDLC)</strong> is a bit-oriented synchronous data link layer protocol originally developed by ISO. Cisco routers use a Cisco-proprietary version of HDLC as the default encapsulation for synchronous serial interfaces. Cisco HDLC includes a 2-byte protocol code field, allowing multiple network-layer protocols (such as IPv4) to share the same serial line.
        </p>

        <h3>5. Physical Layer: DCE vs. DTE</h3>
        <p>
            In synchronous serial communications:
        </p>
        <ul>
            <li><strong>DCE (Data Communications Equipment):</strong> The device providing the physical clocking signal for synchronization (e.g., modem or CSU/DSU). In Packet Tracer simulations, the router connected to the DCE end of a serial cable provides the clock rate.</li>
            <li><strong>DTE (Data Terminal Equipment):</strong> The user device that receives clocking from the DCE (e.g., customer edge router).</li>
        </ul>
        <p>
            The command <code>show controllers serial0/1/0</code> inspects the serial hardware transceiver to identify whether the connected cable end is DCE or DTE.
        </p>

        <h3>6. PPP and HDLC Encapsulation</h3>
        <p>
            Encapsulation determines how data is formatted for transmission across a serial link. PPP and HDLC are Layer 2 encapsulation protocols used on serial interfaces. PPP provides additional features such as link control and authentication, while HDLC provides a simpler framing mechanism for serial communication.
        </p>
    `,

    procedure: `
        <h3>Laboratory Procedure: WAN Data Link Protocols (PPP &amp; HDLC)</h3>
        <p>This experiment guides you through configuring and verifying serial point-to-point Layer 2 encapsulation protocols. The procedure is divided into two distinct exercises:</p>
        <ul>
            <li><strong>Exercise 9-A &mdash; Configuration of Point-to-Point Protocol (PPP):</strong> Multi-LAN serial topology using Cisco routers (SITE-A &amp; SITE-B), OSPF dynamic routing (Process 25, Area 0), and PPP encapsulation with Challenge Handshake Authentication Protocol (CHAP).</li>
            <li><strong>Exercise 9-B &mdash; Configuration of HDLC Protocol:</strong> Point-to-point serial interconnection between two Cisco routers (Router0 &amp; Router1), verifying hardware transceiver clocking (DCE vs. DTE) and Cisco-proprietary HDLC framing.</li>
        </ul>

        <hr style="margin: 2rem 0; border-color: #E2E8F0;">

        <h3>Exercise 9-A: Configuration of Point-to-Point Protocol (PPP)</h3>

        <h4>Step 1: Assemble the Required Topology</h4>
        <p><strong>What to do:</strong> Drag and drop the required components (4 PCs, 2 Switches, 2 Routers: SITE-A and SITE-B) onto the canvas and connect them using the appropriate cables as shown in the topology diagram:</p>
        <ul>
            <li>Connect <strong>PC0 (Fa0/0)</strong> &amp; <strong>PC1 (Fa0/0)</strong> to <strong>Switch0</strong> using <strong>Copper Straight-Through</strong> cables.</li>
            <li>Connect <strong>Switch0</strong> to <strong>SITE-A (Gig0/0)</strong> using a <strong>Copper Straight-Through</strong> cable.</li>
            <li>Connect <strong>SITE-A (Se0/3/0)</strong> to <strong>SITE-B (Se0/3/1)</strong> using a <strong>Serial DCE</strong> cable.</li>
            <li>Connect <strong>SITE-B (Gig0/0)</strong> to <strong>Switch1</strong> using a <strong>Copper Straight-Through</strong> cable.</li>
            <li>Connect <strong>Switch1</strong> to <strong>PC2 (Fa0/0)</strong> &amp; <strong>PC3 (Fa0/0)</strong> using <strong>Copper Straight-Through</strong> cables.</li>
        </ul>
        <p><strong>Expected result:</strong> The physical topology is constructed and all device interfaces are cabled.</p>

        <h4>Step 2: Assign IP Addresses and Subnet Masks</h4>
        <p><strong>What to do:</strong> Assign the IP address, subnet mask, and default gateway for all PCs and router interfaces as per the Addressing Table:</p>
        <table style="width:100%; border-collapse:collapse; margin-top:0.75rem; margin-bottom:0.75rem; text-align:left;">
            <thead>
                <tr style="border-bottom: 2px solid #E5E7EB; background:#F8FAFC;">
                    <th style="padding:0.5rem 0.75rem;">Device</th>
                    <th style="padding:0.5rem 0.75rem;">Interface</th>
                    <th style="padding:0.5rem 0.75rem;">IP Address</th>
                    <th style="padding:0.5rem 0.75rem;">Subnet Mask</th>
                    <th style="padding:0.5rem 0.75rem;">Gateway</th>
                </tr>
            </thead>
            <tbody>
                <tr style="border-bottom: 1px solid #E5E7EB;"><td style="padding:0.5rem 0.75rem;"><strong>PC0</strong></td><td style="padding:0.5rem 0.75rem;">Fa0/0</td><td style="padding:0.5rem 0.75rem;"><code>192.168.10.2</code></td><td style="padding:0.5rem 0.75rem;"><code>255.255.255.0</code></td><td style="padding:0.5rem 0.75rem;"><code>192.168.10.1</code></td></tr>
                <tr style="border-bottom: 1px solid #E5E7EB;"><td style="padding:0.5rem 0.75rem;"><strong>PC1</strong></td><td style="padding:0.5rem 0.75rem;">Fa0/0</td><td style="padding:0.5rem 0.75rem;"><code>192.168.10.3</code></td><td style="padding:0.5rem 0.75rem;"><code>255.255.255.0</code></td><td style="padding:0.5rem 0.75rem;"><code>192.168.10.1</code></td></tr>
                <tr style="border-bottom: 1px solid #E5E7EB;"><td style="padding:0.5rem 0.75rem;"><strong>Router 1 (SITE-A)</strong></td><td style="padding:0.5rem 0.75rem;">Gig0/0</td><td style="padding:0.5rem 0.75rem;"><code>192.168.10.1</code></td><td style="padding:0.5rem 0.75rem;"><code>255.255.255.0</code></td><td style="padding:0.5rem 0.75rem;">&mdash;</td></tr>
                <tr style="border-bottom: 1px solid #E5E7EB;"><td style="padding:0.5rem 0.75rem;"><strong>Router 1 (SITE-A)</strong></td><td style="padding:0.5rem 0.75rem;">Se0/3/0</td><td style="padding:0.5rem 0.75rem;"><code>10.10.10.1</code></td><td style="padding:0.5rem 0.75rem;"><code>255.255.255.252</code></td><td style="padding:0.5rem 0.75rem;">&mdash;</td></tr>
                <tr style="border-bottom: 1px solid #E5E7EB;"><td style="padding:0.5rem 0.75rem;"><strong>Router 2 (SITE-B)</strong></td><td style="padding:0.5rem 0.75rem;">Gig0/0</td><td style="padding:0.5rem 0.75rem;"><code>192.168.20.1</code></td><td style="padding:0.5rem 0.75rem;"><code>255.255.255.0</code></td><td style="padding:0.5rem 0.75rem;">&mdash;</td></tr>
                <tr style="border-bottom: 1px solid #E5E7EB;"><td style="padding:0.5rem 0.75rem;"><strong>Router 2 (SITE-B)</strong></td><td style="padding:0.5rem 0.75rem;">Se0/3/1</td><td style="padding:0.5rem 0.75rem;"><code>10.10.10.2</code></td><td style="padding:0.5rem 0.75rem;"><code>255.255.255.252</code></td><td style="padding:0.5rem 0.75rem;">&mdash;</td></tr>
                <tr style="border-bottom: 1px solid #E5E7EB;"><td style="padding:0.5rem 0.75rem;"><strong>PC2</strong></td><td style="padding:0.5rem 0.75rem;">Fa0/0</td><td style="padding:0.5rem 0.75rem;"><code>192.168.20.2</code></td><td style="padding:0.5rem 0.75rem;"><code>255.255.255.0</code></td><td style="padding:0.5rem 0.75rem;"><code>192.168.20.1</code></td></tr>
                <tr><td style="padding:0.5rem 0.75rem;"><strong>PC3</strong></td><td style="padding:0.5rem 0.75rem;">Fa0/0</td><td style="padding:0.5rem 0.75rem;"><code>192.168.20.3</code></td><td style="padding:0.5rem 0.75rem;"><code>255.255.255.0</code></td><td style="padding:0.5rem 0.75rem;"><code>192.168.20.1</code></td></tr>
            </tbody>
        </table>
        <p><strong>Expected result:</strong> All endpoints and router interfaces are configured with valid network addressing.</p>

        <h4>Step 3: Connect the Two Routers Using Serial DCE Cable</h4>
        <p><strong>What to do:</strong> Connect Router 1 (SITE-A) and Router 2 (SITE-B) using the Serial DCE cable.</p>
        <p><strong>Expected result:</strong> Serial link physical connection established between the two routers.</p>

        <h4>Step 4: Configure OSPF Routing on Router 1 (SITE-A)</h4>
        <p><strong>What to do:</strong> Open Router 1, click on the &ldquo;CLI&rdquo; tab, and configure the OSPF protocol as follows:</p>
        <pre style="background:#1F2937; color:#10B981; padding:1rem; border-radius:6px; font-size:0.85rem; overflow-x:auto;">SITE-A# configure terminal
SITE-A(config)# router ospf 25
SITE-A(config-router)# router-id 1.1.1.1
SITE-A(config-router)# network 10.10.10.0 0.0.0.3 area 0
SITE-A(config-router)# network 192.168.10.0 0.0.0.255 area 0
SITE-A(config-router)# exit
SITE-A(config)# do write
SITE-A(config)# exit</pre>
        <p><strong>Expected result:</strong> OSPF routing process 25 configured on SITE-A with Router ID 1.1.1.1 advertising its connected networks into Area 0.</p>

        <h4>Step 5: Configure OSPF Routing on Router 2 (SITE-B)</h4>
        <p><strong>What to do:</strong> Repeat the OSPF configuration procedure on Router 2 (SITE-B):</p>
        <pre style="background:#1F2937; color:#10B981; padding:1rem; border-radius:6px; font-size:0.85rem; overflow-x:auto;">SITE-B# configure terminal
SITE-B(config)# router ospf 25
SITE-B(config-router)# router-id 1.1.2.2
SITE-B(config-router)# network 10.10.10.0 0.0.0.3 area 0
SITE-B(config-router)# network 192.168.20.0 0.0.0.255 area 0
SITE-B(config-router)# exit
SITE-B(config)# do write
SITE-B(config)# exit</pre>
        <p><strong>Expected result:</strong> OSPF routing process 25 configured on SITE-B with Router ID 1.1.2.2 advertising its connected networks into Area 0.</p>

        <h4>Step 6: Configure Point-to-Point Protocol (PPP) on Both Routers</h4>
        <p><strong>What to do:</strong> Configure the point-to-point protocol for both sites as per the commands:</p>
        <p><strong>On SITE-A:</strong></p>
        <pre style="background:#1F2937; color:#10B981; padding:1rem; border-radius:6px; font-size:0.85rem; overflow-x:auto;">Router(config)# hostname SITE-A
SITE-A(config)# username SITE-B password cisco
SITE-A(config)# interface Serial0/3/0
SITE-A(config-if)# encapsulation ppp
SITE-A(config-if)# ppp authentication chap
SITE-A(config-if)# exit
SITE-A(config)# do write</pre>
        <p><strong>On SITE-B:</strong></p>
        <pre style="background:#1F2937; color:#10B981; padding:1rem; border-radius:6px; font-size:0.85rem; overflow-x:auto;">Router(config)# hostname SITE-B
SITE-B(config)# username SITE-A password cisco
SITE-B(config)# interface Serial0/3/1
SITE-B(config-if)# encapsulation ppp
SITE-B(config-if)# ppp authentication chap
SITE-B(config-if)# exit</pre>
        <p><strong>Expected result:</strong> PPP encapsulation and CHAP authentication enabled on the serial interfaces of both routers.</p>

        <h4>Step 7: Check Configuration of PPP and OSPF Neighbor</h4>
        <p><strong>What to do:</strong> Check the configuration of PPP and OSPF neighbor adjacency on both routers:</p>
        <pre style="background:#1F2937; color:#10B981; padding:1rem; border-radius:6px; font-size:0.85rem; overflow-x:auto;">SITE-A# show ip ospf neighbor
SITE-B# show ip ospf neighbor</pre>
        <p><strong>Expected result:</strong> The OSPF neighbor adjacency is verified successfully across the authenticated serial link.</p>

        <h4>Step 8: Check Configuration of the Topology on Both Routers</h4>
        <p><strong>What to do:</strong> Check the configuration and interface status of the topology on the routers:</p>
        <pre style="background:#1F2937; color:#10B981; padding:1rem; border-radius:6px; font-size:0.85rem; overflow-x:auto;">SITE-B# show interface Serial0/3/1</pre>
        <p><strong>Expected result:</strong> Interface status shows <code>Serial0/3/1 is up, line protocol is up (connected)</code> with <code>Encapsulation PPP</code> verified.</p>

        <h4>Step 9: Verify End-to-End Connectivity (Output &amp; Result)</h4>
        <p><strong>What to do:</strong> Verify connectivity between end devices using the ping command and packet simulation.</p>
        <pre style="background:#1F2937; color:#10B981; padding:1rem; border-radius:6px; font-size:0.85rem; overflow-x:auto;">PC0> ping 192.168.20.2</pre>
        <p><strong>Expected result:</strong> ICMP echo requests successfully reach the destination host and replies are received, verifying end-to-end communication across the configured PPP WAN link.</p>

        <hr style="margin: 2rem 0; border-color: #E2E8F0;">

        <h3>Exercise 9-B: Configuration of HDLC Protocol</h3>

        <h4>Step 1: Assemble the Two-Router Topology</h4>
        <p><strong>What to do:</strong> Drag and drop the required components (2 Routers: Router0 and Router1) and connect them using the appropriate Serial DCE cable as shown in the diagram between <code>Serial0/1/0</code> and <code>Serial0/1/1</code>.</p>
        <p><strong>Expected result:</strong> Router0 and Router1 are placed and connected via the serial cable.</p>

        <h4>Step 2: Find the DCE and DTE Routers</h4>
        <p><strong>What to do:</strong> Find the DCE and DTE routers by using the command on both routers:</p>
        <pre style="background:#1F2937; color:#10B981; padding:1rem; border-radius:6px; font-size:0.85rem; overflow-x:auto;">Router# show controllers serial0/1/0</pre>
        <p><strong>Expected result:</strong> The controller output identifies the cable hardware transceiver roles (DCE vs. DTE) on the serial interfaces.</p>

        <h4>Step 3: Configure the HDLC Protocol on Both Routers</h4>
        <p><strong>What to do:</strong> Configure the HDLC protocol and assign interface IP addresses using the following commands on both routers:</p>
        <p><strong>On Router0:</strong></p>
        <pre style="background:#1F2937; color:#10B981; padding:1rem; border-radius:6px; font-size:0.85rem; overflow-x:auto;">Router# configure terminal
Router(config)# interface Serial0/1/0
Router(config-if)# ip address 192.168.1.1 255.255.255.0
Router(config-if)# encapsulation hdlc
Router(config-if)# no shutdown
Router(config-if)# exit
Router(config)# exit</pre>
        <p><strong>On Router1:</strong></p>
        <pre style="background:#1F2937; color:#10B981; padding:1rem; border-radius:6px; font-size:0.85rem; overflow-x:auto;">Router> enable
Router# configure terminal
Router(config)# interface Serial0/1/1
Router(config-if)# ip address 192.168.1.2 255.255.255.0
Router(config-if)# encapsulation hdlc
Router(config-if)# no shutdown
Router(config-if)# exit
Router(config)# exit</pre>
        <p><strong>Expected result:</strong> Serial interfaces are configured with IP addresses, HDLC encapsulation is enabled, and interfaces are brought administratively up.</p>

        <h4>Step 4: Check IP Connectivity Between the Routers</h4>
        <p><strong>What to do:</strong> Check the IP connectivity between the routers using the ping command:</p>
        <pre style="background:#1F2937; color:#10B981; padding:1rem; border-radius:6px; font-size:0.85rem; overflow-x:auto;">Router0# ping 192.168.1.2</pre>
        <p><strong>Expected result:</strong> ICMP ping packets transmitted successfully across the serial link, confirming bidirectional IP reachability between Router0 and Router1.</p>

        <h4>Step 5: Check the HDLC Configuration on Both Routers</h4>
        <p><strong>What to do:</strong> Check the HDLC configuration on both routers:</p>
        <pre style="background:#1F2937; color:#10B981; padding:1rem; border-radius:6px; font-size:0.85rem; overflow-x:auto;">Router0# show interface Serial0/1/0</pre>
        <p><strong>Expected result:</strong> Interface status shows <code>Serial0/1/0 is up, line protocol is up (connected)</code> with <code>Encapsulation HDLC</code> verified.</p>
    `,

    addressingTable: [
        { device: "PC0", interface: "Fa0/0", ip: "192.168.10.2", mask: "255.255.255.0", gateway: "192.168.10.1" },
        { device: "PC1", interface: "Fa0/0", ip: "192.168.10.3", mask: "255.255.255.0", gateway: "192.168.10.1" },
        { device: "Router 1 (SITE-A)", interface: "Gig0/0", ip: "192.168.10.1", mask: "255.255.255.0", gateway: "--" },
        { device: "Router 1 (SITE-A)", interface: "Se0/3/0", ip: "10.10.10.1", mask: "255.255.255.252", gateway: "--" },
        { device: "Router 2 (SITE-B)", interface: "Gig0/0", ip: "192.168.20.1", mask: "255.255.255.0", gateway: "--" },
        { device: "Router 2 (SITE-B)", interface: "Se0/3/1", ip: "10.10.10.2", mask: "255.255.255.252", gateway: "--" },
        { device: "PC2", interface: "Fa0/0", ip: "192.168.20.2", mask: "255.255.255.0", gateway: "192.168.20.1" },
        { device: "PC3", interface: "Fa0/0", ip: "192.168.20.3", mask: "255.255.255.0", gateway: "192.168.20.1" }
    ],

    addressingTable9B: [
        { device: "Router0", interface: "Se0/1/0", ip: "192.168.1.1", mask: "255.255.255.0", gateway: "--" },
        { device: "Router1", interface: "Se0/1/1", ip: "192.168.1.2", mask: "255.255.255.0", gateway: "--" }
    ],

    quiz: [
        {
            question: "Which Cisco IOS interface command is used to configure Point-to-Point Protocol (PPP) encapsulation on a synchronous serial link?",
            options: [
                "encapsulation ppp",
                "ppp enable",
                "link protocol ppp",
                "switchport mode ppp"
            ],
            ans: 0,
            hint: "Refer to Step 6 of Exercise 9-A where encapsulation is set on interface Serial0/3/0.",
            explanation: "The command 'encapsulation ppp' in interface configuration mode specifies PPP as the Layer 2 data link framing protocol on synchronous serial lines."
        },
        {
            question: "In Exercise 9-A, what command is entered in interface configuration mode to enable Challenge Handshake Authentication Protocol?",
            options: [
                "auth chap enable",
                "ppp authentication chap",
                "enable chap auth",
                "ppp secure chap"
            ],
            ans: 1,
            hint: "Look at the interface configuration sequence executed on SITE-A and SITE-B under Step 6.",
            explanation: "The command 'ppp authentication chap' configures the interface to require and respond to CHAP three-way handshake authentication."
        },
        {
            question: "When configuring CHAP authentication on Router SITE-A, why is the command 'username SITE-B password cisco' configured in global configuration mode?",
            options: [
                "To define the hostname that SITE-A uses to advertise in OSPF",
                "To establish a local database entry matching the remote peer's hostname and shared secret",
                "To assign an administrative SSH login user for remote management",
                "To encrypt all routing update packets sent to SITE-B"
            ],
            ans: 1,
            hint: "CHAP uses the peer's hostname as the lookup username to retrieve the shared secret for MD5 hashing.",
            explanation: "In CHAP authentication, each router must have a local username configured matching the remote router's exact hostname, sharing the identical pre-shared password secret."
        },
        {
            question: "Which Cisco IOS command was executed in Exercise 9-B Step 2 to verify whether the router port is attached to a DCE or DTE cable?",
            options: [
                "show clock rate",
                "show interface status",
                "show controllers serial0/1/0",
                "show serial hardware"
            ],
            ans: 2,
            hint: "Check Step 2 of Exercise 9-B which displays 'DTE V.35 TX and RX clocks detected'.",
            explanation: "The command 'show controllers serial [slot/port]' displays hardware and transceiver chip-level diagnostic information, including whether the serial cable is DCE or DTE."
        },
        {
            question: "According to the verification in Exercise 9-B Step 5 (show int se0/1/0), what is the default Layer 2 encapsulation on Cisco router synchronous serial interfaces?",
            options: [
                "PPP",
                "HDLC",
                "Frame Relay",
                "SLIP"
            ],
            ans: 1,
            hint: "Look at the output of 'show int se0/1/0' in Step 5 where Encapsulation is highlighted.",
            explanation: "Cisco routers use Cisco proprietary High-Level Data Link Control (HDLC) as the default data-link layer encapsulation on all point-to-point synchronous serial interfaces."
        }
    ]
};
