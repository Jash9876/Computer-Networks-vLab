// Experiment 10 Data - Configuration of Border Gateway Protocol (BGP)
const experimentData = {
    title: "Exercise 10 — Configuration of Border Gateway Protocol (BGP)",
    description: "Configure and verify Border Gateway Protocol (BGP) across Autonomous Systems (eBGP between AS 10 and AS 20) with GigabitEthernet interconnection, neighbor peering, customer prefix advertisement, and link failure route convergence.",

    aim: `<div style="margin-bottom: 0.5rem;">
        <h4 style="margin: 0 0 0.4rem 0; color: #1E293B; font-size: 1rem; font-weight: 700;">EXERCISE 10: CONFIGURATION OF BORDER GATEWAY PROTOCOL</h4>
        <p style="margin: 0; color: #475569; font-size: 0.95rem;">To configure the Border Gateway Protocol (BGP) on Cisco Packet Tracer.</p>
    </div>`,

    objectives: [
        "Understand the architecture, path-vector mechanics, and Autonomous System (AS) routing principles of Border Gateway Protocol (BGP-4).",
        "Differentiate between Interior Gateway Protocols (IGPs such as OSPF and RIP) and Exterior Gateway Protocols (EGPs such as External BGP / eBGP).",
        "Configure GigabitEthernet interface IP addressing and cross-over cable interconnection between two Cisco routers across AS 10 and AS 20.",
        "Establish an eBGP peering adjacency using the neighbor <IP-Address> remote-as <AS-Number> command.",
        "Advertise LAN network prefixes into BGP using the network <Network-ID> mask <Subnet-Mask> command.",
        "Analyze BGP routing information, neighbor adjacency states, and prefix exchange using show ip bgp summary and show ip bgp neighbor.",
        "Observe BGP link failure and route withdrawal behavior when the inter-AS interface changes state."
    ],

    theory: `
        <h3>1. Required Hardware / Software Components</h3>
        <p>The following hardware and software components are utilized for the inter-Autonomous System BGP configuration:</p>

        <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 6px; padding: 1rem; margin-bottom: 1.5rem; max-width: 600px;">
            <h4 style="margin: 0 0 0.5rem 0; color: #1E293B; font-size: 0.95rem; font-weight: 700;">Exercise 10 Components List</h4>
            <ul style="margin-left: 1.25rem; margin-top: 0.25rem; margin-bottom: 0; font-size: 0.9rem; color: #334155;">
                <li><strong>PC</strong> &times; 4 (PC0, PC1 in AS 10; PC2, PC3 in AS 20)</li>
                <li><strong>Switch</strong> &times; 2 (Switch0, Switch1)</li>
                <li><strong>Router</strong> &times; 2 (Router0 in AS 10, Router1 in AS 20)</li>
                <li><strong>Copper Straight-Through Cable</strong> &times; 6</li>
                <li><strong>Copper Cross-over Cable</strong> &times; 1 (Router0 Gig0/1 &harr; Router1 Gig0/1)</li>
            </ul>
        </div>

        <h3>2. What is Border Gateway Protocol (BGP)?</h3>
        <p>The <strong>Border Gateway Protocol (BGP)</strong> is an Exterior Gateway Protocol (EGP) used to exchange routing and reachability information between <strong>Autonomous Systems (AS)</strong>.</p>
        <p>BGP is classified as a <strong>Path-Vector Routing Protocol</strong>. Unlike Interior Gateway Protocols such as RIP and OSPF, BGP considers the path through Autonomous Systems and other routing attributes when selecting routes.</p>

        <h3>3. Autonomous Systems &amp; eBGP vs. iBGP</h3>
        <p>An <strong>Autonomous System (AS)</strong> is a collection of networks and routers operating under a common administrative policy.</p>
        <ul>
            <li><strong>External BGP (eBGP):</strong> BGP peering established between routers belonging to <strong>different Autonomous Systems</strong>, such as Router0 in <strong>AS 10</strong> and Router1 in <strong>AS 20</strong>.</li>
            <li><strong>Internal BGP (iBGP):</strong> BGP peering established between routers belonging to the <strong>same Autonomous System</strong>.</li>
        </ul>
        <p>For this experiment, the focus is on <strong>eBGP</strong> between AS 10 and AS 20.</p>

        <h3>4. BGP Neighbor Peering &amp; TCP Port 179</h3>
        <p>BGP establishes peering sessions using reliable <strong>TCP communication on port 179</strong>. BGP neighbors are explicitly configured so that the routers can establish a session and exchange routing information.</p>
        <p>The BGP Finite State Machine (FSM) includes the following states:</p>
        <div style="background:#1F2937; color:#10B981; padding:1rem; border-radius:8px; font-family:'Courier New', monospace; font-size:0.85rem; margin:0.5rem 0 1rem; overflow-x:auto;">
            <span style="color:#FBBF24;">1. Idle</span>        &rarr; Initial state in which the router initializes BGP resources.<br>
            <span style="color:#FBBF24;">2. Connect</span>     &rarr; Router attempts to establish a TCP connection with the neighbor.<br>
            <span style="color:#FBBF24;">3. Active</span>      &rarr; Router attempts to establish or re-establish the TCP connection after a connection failure.<br>
            <span style="color:#93C5FD;">4. OpenSent</span>    &rarr; TCP connection is established and the BGP OPEN message has been sent.<br>
            <span style="color:#93C5FD;">5. OpenConfirm</span> &rarr; Router waits for confirmation of the BGP session.<br>
            <span style="color:#34D399; font-weight:bold;">6. Established</span> &rarr; BGP session is successfully established and routing updates can be exchanged.
        </div>

        <h3>5. Advertising Prefixes into BGP</h3>
        <p>The BGP <code>network &lt;network-id&gt; mask &lt;subnet-mask&gt;</code> command is used to advertise a specific network prefix into BGP.</p>
        <p>The specified network and subnet mask must correspond to a route present in the router's routing table before BGP can advertise the prefix.</p>
        <p>For this experiment, the LAN networks <strong>192.168.10.0/24</strong> and <strong>192.168.20.0/24</strong> are advertised through BGP between AS 10 and AS 20.</p>

        <h3>6. BGP Path Attributes and Route Withdrawal</h3>
        <p>BGP uses path attributes to determine and advertise routing information. One important attribute is the <strong>AS-Path</strong>, which records the sequence of Autonomous Systems through which a route has passed.</p>
        <p>For example, when Router1 in <strong>AS 20</strong> advertises <strong>192.168.20.0/24</strong> to Router0 in <strong>AS 10</strong>, Router0 can learn the route with <strong>AS 20</strong> appearing in the AS-Path.</p>
        <p>If the inter-AS connection between the routers fails, the BGP peering session is lost and routes learned through that session are withdrawn. When connectivity is restored, the BGP session can be re-established and the routes can be learned again.</p>

        <h3>7. BGP Verification Commands</h3>
        <table style="width:100%; border-collapse:collapse; margin-top:0.5rem; text-align:left;">
            <thead>
                <tr style="border-bottom: 2px solid #CBD5E1; background:#F1F5F9;">
                    <th style="padding:0.6rem;">Command</th>
                    <th style="padding:0.6rem;">Purpose</th>
                </tr>
            </thead>
            <tbody>
                <tr style="border-bottom: 1px solid #E2E8F0;">
                    <td style="padding:0.6rem;"><code>show ip bgp summary</code></td>
                    <td style="padding:0.6rem;">Displays BGP neighbor status and information about the BGP routing table.</td>
                </tr>
                <tr style="border-bottom: 1px solid #E2E8F0;">
                    <td style="padding:0.6rem;"><code>show ip bgp</code></td>
                    <td style="padding:0.6rem;">Displays entries in the BGP routing table, including path information such as Next-Hop and AS-Path.</td>
                </tr>
                <tr style="border-bottom: 1px solid #E2E8F0;">
                    <td style="padding:0.6rem;"><code>show ip bgp neighbor</code></td>
                    <td style="padding:0.6rem;">Displays detailed information about the configured BGP neighbor and its BGP session.</td>
                </tr>
                <tr>
                    <td style="padding:0.6rem;"><code>show ip route bgp</code></td>
                    <td style="padding:0.6rem;">Displays routes learned through BGP that are installed in the IP routing table.</td>
                </tr>
            </tbody>
        </table>
    `,

    procedure: `
        <h3>Laboratory Procedure: Configuration of Border Gateway Protocol (BGP)</h3>
        <p>This experiment guides you through constructing an inter-domain network topology, assigning IP addresses across two Autonomous Systems (AS 10 &amp; AS 20), configuring eBGP peering on dual Cisco routers, advertising customer LAN prefixes, inspecting BGP convergence, and validating end-to-end IP communication.</p>

        <hr style="margin: 2rem 0; border-color: #E2E8F0;">

        <h4>Step 1: Assemble the Required Topology</h4>
        <p><strong>What to do:</strong> Drag and drop the required components (4 PCs, 2 Switches, 2 Routers) onto the canvas and connect them using the appropriate cables as shown in the topology diagram:</p>
        <ul>
            <li>Connect <strong>PC0 (Fa0/0)</strong> &amp; <strong>PC1 (Fa0/0)</strong> to <strong>Switch0</strong> using <strong>Copper Straight-Through</strong> cables.</li>
            <li>Connect <strong>Switch0</strong> to <strong>Router0 (Gig0/0)</strong> using a <strong>Copper Straight-Through</strong> cable.</li>
            <li>Connect <strong>Router0 (Gig0/1)</strong> to <strong>Router1 (Gig0/1)</strong> using a <strong>Copper Cross-over</strong> cable.</li>
            <li>Connect <strong>Router1 (Gig0/0)</strong> to <strong>Switch1</strong> using a <strong>Copper Straight-Through</strong> cable.</li>
            <li>Connect <strong>Switch1</strong> to <strong>PC2 (Fa0/0)</strong> &amp; <strong>PC3 (Fa0/0)</strong> using <strong>Copper Straight-Through</strong> cables.</li>
        </ul>
        <p><strong>Expected result:</strong> The physical topology is constructed and all device interfaces are correctly cabled across the AS 10 (pink) and AS 20 (green) zones.</p>

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
                    <th style="padding:0.5rem 0.75rem;">Autonomous System</th>
                </tr>
            </thead>
            <tbody>
                <tr style="border-bottom: 1px solid #E5E7EB;"><td style="padding:0.5rem 0.75rem;"><strong>PC0</strong></td><td style="padding:0.5rem 0.75rem;">Fa0</td><td style="padding:0.5rem 0.75rem;"><code>192.168.10.2</code></td><td style="padding:0.5rem 0.75rem;"><code>255.255.255.0</code></td><td style="padding:0.5rem 0.75rem;"><code>192.168.10.1</code></td><td style="padding:0.5rem 0.75rem;">AS 10</td></tr>
                <tr style="border-bottom: 1px solid #E5E7EB;"><td style="padding:0.5rem 0.75rem;"><strong>PC1</strong></td><td style="padding:0.5rem 0.75rem;">Fa0</td><td style="padding:0.5rem 0.75rem;"><code>192.168.10.3</code></td><td style="padding:0.5rem 0.75rem;"><code>255.255.255.0</code></td><td style="padding:0.5rem 0.75rem;"><code>192.168.10.1</code></td><td style="padding:0.5rem 0.75rem;">AS 10</td></tr>
                <tr style="border-bottom: 1px solid #E5E7EB;"><td style="padding:0.5rem 0.75rem;"><strong>Router 0</strong></td><td style="padding:0.5rem 0.75rem;">Gig0/0</td><td style="padding:0.5rem 0.75rem;"><code>192.168.10.1</code></td><td style="padding:0.5rem 0.75rem;"><code>255.255.255.0</code></td><td style="padding:0.5rem 0.75rem;">&mdash;</td><td style="padding:0.5rem 0.75rem;">AS 10 (LAN)</td></tr>
                <tr style="border-bottom: 1px solid #E5E7EB;"><td style="padding:0.5rem 0.75rem;"><strong>Router 0</strong></td><td style="padding:0.5rem 0.75rem;">Gig0/1</td><td style="padding:0.5rem 0.75rem;"><code>10.10.10.1</code></td><td style="padding:0.5rem 0.75rem;"><code>255.0.0.0</code></td><td style="padding:0.5rem 0.75rem;">&mdash;</td><td style="padding:0.5rem 0.75rem;">AS 10 (WAN Link)</td></tr>
                <tr style="border-bottom: 1px solid #E5E7EB;"><td style="padding:0.5rem 0.75rem;"><strong>Router 1</strong></td><td style="padding:0.5rem 0.75rem;">Gig0/0</td><td style="padding:0.5rem 0.75rem;"><code>192.168.20.1</code></td><td style="padding:0.5rem 0.75rem;"><code>255.255.255.0</code></td><td style="padding:0.5rem 0.75rem;">&mdash;</td><td style="padding:0.5rem 0.75rem;">AS 20 (LAN)</td></tr>
                <tr style="border-bottom: 1px solid #E5E7EB;"><td style="padding:0.5rem 0.75rem;"><strong>Router 1</strong></td><td style="padding:0.5rem 0.75rem;">Gig0/1</td><td style="padding:0.5rem 0.75rem;"><code>10.10.10.2</code></td><td style="padding:0.5rem 0.75rem;"><code>255.0.0.0</code></td><td style="padding:0.5rem 0.75rem;">&mdash;</td><td style="padding:0.5rem 0.75rem;">AS 20 (WAN Link)</td></tr>
                <tr style="border-bottom: 1px solid #E5E7EB;"><td style="padding:0.5rem 0.75rem;"><strong>PC2</strong></td><td style="padding:0.5rem 0.75rem;">Fa0</td><td style="padding:0.5rem 0.75rem;"><code>192.168.20.2</code></td><td style="padding:0.5rem 0.75rem;"><code>255.255.255.0</code></td><td style="padding:0.5rem 0.75rem;"><code>192.168.20.1</code></td><td style="padding:0.5rem 0.75rem;">AS 20</td></tr>
                <tr><td style="padding:0.5rem 0.75rem;"><strong>PC3</strong></td><td style="padding:0.5rem 0.75rem;">Fa0</td><td style="padding:0.5rem 0.75rem;"><code>192.168.20.3</code></td><td style="padding:0.5rem 0.75rem;"><code>255.255.255.0</code></td><td style="padding:0.5rem 0.75rem;"><code>192.168.20.1</code></td><td style="padding:0.5rem 0.75rem;">AS 20</td></tr>
            </tbody>
        </table>
        <p><strong>Expected result:</strong> All end devices and router interfaces are assigned valid network parameters.</p>

        <h4>Step 3: Connect the Two Routers Using Copper Cross-Over Cable</h4>
        <p><strong>What to do:</strong> Interconnect Router0 (Gig0/1) and Router1 (Gig0/1) using the Copper Cross-over cable.</p>
        <p><strong>Expected result:</strong> Physical inter-AS GigabitEthernet link is connected and ready for BGP peering.</p>

        <h4>Step 4: Configure Interface IP and BGP on Router0 (AS 10)</h4>
        <p><strong>What to do:</strong> Open Router0, click on the &ldquo;CLI&rdquo; tab, and configure its GigabitEthernet interfaces and the BGP routing process:</p>
        <pre style="background:#1F2937; color:#10B981; padding:1rem; border-radius:6px; font-size:0.85rem; overflow-x:auto;">Router> enable
Router# configure terminal
Router(config)# interface GigabitEthernet0/0
Router(config-if)# ip address 192.168.10.1 255.255.255.0
Router(config-if)# no shutdown
Router(config-if)# exit
Router(config)# interface GigabitEthernet0/1
Router(config-if)# ip address 10.10.10.1 255.0.0.0
Router(config-if)# no shutdown
Router(config-if)# exit
Router(config)# router bgp 10
Router(config-router)# neighbor 10.10.10.2 remote-as 20
Router(config-router)# network 192.168.10.0 mask 255.255.255.0
Router(config-router)# exit
Router(config)# do write
Router(config)# exit</pre>
        <p><strong>Expected result:</strong> Router0 is assigned Autonomous System 10, configures neighbor <code>10.10.10.2</code> in AS 20, and advertises customer network <code>192.168.10.0/24</code>.</p>

        <h4>Step 5: Configure Interface IP and BGP on Router1 (AS 20)</h4>
        <p><strong>What to do:</strong> Repeat the configuration procedure on Router1:</p>
        <pre style="background:#1F2937; color:#10B981; padding:1rem; border-radius:6px; font-size:0.85rem; overflow-x:auto;">Router> enable
Router# configure terminal
Router(config)# interface GigabitEthernet0/0
Router(config-if)# ip address 192.168.20.1 255.255.255.0
Router(config-if)# no shutdown
Router(config-if)# exit
Router(config)# interface GigabitEthernet0/1
Router(config-if)# ip address 10.10.10.2 255.0.0.0
Router(config-if)# no shutdown
Router(config-if)# exit
Router(config)# router bgp 20
Router(config-router)# neighbor 10.10.10.1 remote-as 10
%BGP-5-ADJCHANGE: neighbor 10.10.10.1 Up
Router(config-router)# network 192.168.20.0 mask 255.255.255.0
Router(config-router)# exit
Router(config)# do write
Router(config)# exit</pre>
        <p><strong>Expected result:</strong> Router1 is assigned Autonomous System 20, the eBGP adjacency with Router0 transitions to <strong>Established</strong> (logging <code>%BGP-5-ADJCHANGE: neighbor 10.10.10.1 Up</code>), and network <code>192.168.20.0/24</code> is advertised into BGP.</p>

        <h4>Step 6: Check BGP Configuration Summary and Neighbors</h4>
        <p><strong>What to do:</strong> In Privileged EXEC mode, verify BGP address summary and neighbor state using the verification commands:</p>
        <pre style="background:#1F2937; color:#10B981; padding:1rem; border-radius:6px; font-size:0.85rem; overflow-x:auto;">Router# show ip bgp summary
Router# show ip bgp neighbor
Router# show ip bgp</pre>
        <p><strong>Expected result:</strong> <code>show ip bgp summary</code> displays the remote neighbor in <strong>State: Established</strong> with 1 received prefix, and <code>show ip bgp</code> displays the learned route with AS-Path attribute <code>20</code> or <code>10</code>.</p>

        <h4>Step 7: Verify End-to-End Connectivity Across Autonomous Systems</h4>
        <p><strong>What to do:</strong> Open the Command Prompt on <strong>PC0 (192.168.10.2)</strong> in AS 10 and test connectivity across the WAN boundary to <strong>PC3 (192.168.20.3)</strong> in AS 20:</p>
        <pre style="background:#1F2937; color:#10B981; padding:1rem; border-radius:6px; font-size:0.85rem; overflow-x:auto;">PC> ping 192.168.20.3</pre>
        <p><strong>Expected result:</strong> <code>Reply from 192.168.20.3: bytes=32 time&lt;1ms TTL=126</code> confirming successful inter-AS routing.</p>
    `,



    result: "The implementation of BGP configuration is done successfully using Cisco Packet tracer.",

    quiz: [
        {
            question: "Which transport layer protocol and port number does BGP use to establish peering sessions?",
            options: [
                "UDP port 520",
                "TCP port 179",
                "IP protocol 89",
                "TCP port 23"
            ],
            correct: 1,
            explanation: "BGP establishes reliable point-to-point peering connections using Transmission Control Protocol (TCP) on port 179."
        },
        {
            question: "What type of routing protocol is Border Gateway Protocol (BGP)?",
            options: [
                "Link-State Interior Gateway Protocol",
                "Distance-Vector Interior Gateway Protocol",
                "Path-Vector Exterior Gateway Protocol",
                "Hybrid Interior Gateway Protocol"
            ],
            correct: 2,
            explanation: "BGP is a Path-Vector Exterior Gateway Protocol that uses path attributes such as AS-Path to make inter-domain routing decisions."
        },
        {
            question: "In Cisco IOS, what is the default Administrative Distance (AD) for External BGP (eBGP) routes?",
            options: [
                "20",
                "90",
                "110",
                "200"
            ],
            correct: 0,
            explanation: "eBGP routes have an Administrative Distance of 20, making them highly trusted compared to OSPF (110), RIP (120), or iBGP (200)."
        },
        {
            question: "Which Cisco IOS command is used to advertise the subnet 192.168.10.0/24 into the BGP routing process?",
            options: [
                "network 192.168.10.0 0.0.0.255 area 0",
                "network 192.168.10.0 mask 255.255.255.0",
                "router-id 192.168.10.0",
                "neighbor 192.168.10.0 advertise"
            ],
            correct: 1,
            explanation: "In BGP, prefixes are injected into the BGP table using the 'network <network-id> mask <subnet-mask>' command syntax."
        },
        {
            question: "What is the final, fully operational state in the BGP Finite State Machine?",
            options: [
                "OpenConfirm",
                "Connect",
                "Established",
                "Active"
            ],
            correct: 2,
            explanation: "The 'Established' state indicates that the BGP TCP connection, OPEN exchange, and KEEPALIVE confirmation have completed, allowing UPDATE messages to exchange prefixes."
        }
    ]
};
