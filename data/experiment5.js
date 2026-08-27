const experimentData = {
    aim: "Exercise 5: Demonstration of Static and Default Routing",
    objectives: [
        "Configure IP addresses and default gateways on end devices across 5 subnets (/27).",
        "Understand the role of hardware serial modules (WIC-2T/Serial) in Cisco routers for WAN links.",
        "Differentiate directly connected networks from unknown remote networks in a routing table.",
        "Implement and verify Static Routing with explicit next-hop IP addresses on dual Cisco routers.",
        "Implement and verify Default Routing (0.0.0.0/0) replacing individual static route entries.",
        "Analyze hop-by-hop packet forwarding behavior using Ping (ICMP) and Traceroute (tracert)."
    ],
    theory: `
        <h3>1. Concept of Routing</h3>
        <p>A router is a Layer 3 internetworking device that connects different subnets or networks. By default, a router only knows about networks that are <strong>directly connected</strong> to its active interfaces.</p>
        <p>To reach remote networks that are not directly connected, a router must be provided with routing information through either <strong>Static Routing</strong>, <strong>Default Routing</strong>, or <strong>Dynamic Routing protocols</strong>.</p>

        <h3>2. Addressing Scheme & /27 Subnetting</h3>
        <p>In this experiment, the <code>192.168.10.0</code> network is divided into five <code>/27</code> subnets using the subnet mask <code>255.255.255.224</code> (block size = 32):</p>
        <table style="width:100%; border-collapse:collapse; margin-top:1rem; text-align:left;">
            <thead>
                <tr style="border-bottom: 2px solid #E5E7EB;">
                    <th style="padding:0.5rem;">Subnet</th>
                    <th style="padding:0.5rem;">Network ID</th>
                    <th style="padding:0.5rem;">Usable Host Range</th>
                    <th style="padding:0.5rem;">Broadcast</th>
                    <th style="padding:0.5rem;">Assignment</th>
                </tr>
            </thead>
            <tbody>
                <tr style="border-bottom: 1px solid #E5E7EB;">
                    <td style="padding:0.5rem;">LAN 1</td>
                    <td style="padding:0.5rem;">192.168.10.0/27</td>
                    <td style="padding:0.5rem;">192.168.10.1 &ndash; 192.168.10.30</td>
                    <td style="padding:0.5rem;">192.168.10.31</td>
                    <td style="padding:0.5rem;">PC0 &amp; Router0 G0/0</td>
                </tr>
                <tr style="border-bottom: 1px solid #E5E7EB;">
                    <td style="padding:0.5rem;">LAN 2</td>
                    <td style="padding:0.5rem;">192.168.10.32/27</td>
                    <td style="padding:0.5rem;">192.168.10.33 &ndash; 192.168.10.62</td>
                    <td style="padding:0.5rem;">192.168.10.63</td>
                    <td style="padding:0.5rem;">PC1 &amp; Router0 G0/1</td>
                </tr>
                <tr style="border-bottom: 1px solid #E5E7EB;">
                    <td style="padding:0.5rem;">WAN</td>
                    <td style="padding:0.5rem;">192.168.10.64/27</td>
                    <td style="padding:0.5rem;">192.168.10.65 &ndash; 192.168.10.94</td>
                    <td style="padding:0.5rem;">192.168.10.95</td>
                    <td style="padding:0.5rem;">R0 S0/1/0 (DCE) &amp; R1 S0/1/0 (DTE)</td>
                </tr>
                <tr style="border-bottom: 1px solid #E5E7EB;">
                    <td style="padding:0.5rem;">LAN 3</td>
                    <td style="padding:0.5rem;">192.168.10.96/27</td>
                    <td style="padding:0.5rem;">192.168.10.97 &ndash; 192.168.10.126</td>
                    <td style="padding:0.5rem;">192.168.10.127</td>
                    <td style="padding:0.5rem;">PC2 &amp; Router1 G0/0</td>
                </tr>
                <tr>
                    <td style="padding:0.5rem;">LAN 4</td>
                    <td style="padding:0.5rem;">192.168.10.128/27</td>
                    <td style="padding:0.5rem;">192.168.10.129 &ndash; 192.168.10.158</td>
                    <td style="padding:0.5rem;">192.168.10.159</td>
                    <td style="padding:0.5rem;">PC3 &amp; Router1 G0/1</td>
                </tr>
            </tbody>
        </table>

        <h3>3. Static Routing</h3>
        <p>Static routing involves manually defining routing entries in the router's routing table specifying how to reach remote subnets.</p>
        <p><strong>Cisco Command Syntax:</strong></p>
        <pre style="background:#1F2937; color:#10B981; padding:1rem; border-radius:6px; font-size:0.85rem; overflow-x:auto;">Router(config)# ip route &lt;Destination_Network&gt; &lt;Subnet_Mask&gt; &lt;Next_Hop_IP&gt;</pre>
        <p>For example, for Router0 to reach LAN 3 and LAN 4 behind Router1, the next-hop address is Router1's serial interface (<code>192.168.10.66</code>):</p>
        <pre style="background:#1F2937; color:#10B981; padding:1rem; border-radius:6px; font-size:0.85rem; overflow-x:auto;">Router0(config)# ip route 192.168.10.96 255.255.255.224 192.168.10.66
Router0(config)# ip route 192.168.10.128 255.255.255.224 192.168.10.66</pre>

        <h3>4. Return Path Requirement</h3>
        <p>Routing is inherently bidirectional. A packet cannot successfully be acknowledged if the destination router does not have a route back to the sender. Router1 must be configured with return static routes pointing to Router0's serial interface (<code>192.168.10.65</code>):</p>
        <pre style="background:#1F2937; color:#10B981; padding:1rem; border-radius:6px; font-size:0.85rem; overflow-x:auto;">Router1(config)# ip route 192.168.10.0 255.255.255.224 192.168.10.65
Router1(config)# ip route 192.168.10.32 255.255.255.224 192.168.10.65</pre>

        <h3>5. Default Routing (Quad-Zero Route)</h3>
        <p>A <strong>Default Route</strong> (also known as Gateway of Last Resort) matches all packets that do not match any other specific route in the routing table.</p>
        <p>It is represented by the address <code>0.0.0.0</code> and mask <code>0.0.0.0</code> (or <code>0.0.0.0/0</code>). When multiple remote networks exist behind a single neighboring gateway (stub router environment), a single default route can replace multiple individual static routes.</p>
        <p><strong>Cisco Command Syntax:</strong></p>
        <pre style="background:#1F2937; color:#10B981; padding:1rem; border-radius:6px; font-size:0.85rem; overflow-x:auto;">Router0(config)# ip route 0.0.0.0 0.0.0.0 192.168.10.66
Router1(config)# ip route 0.0.0.0 0.0.0.0 192.168.10.65</pre>

        <h3>6. Verification Tools: Ping vs Traceroute</h3>
        <ul>
            <li><strong>ping (ICMP Echo):</strong> Tests end-to-end round-trip connectivity between source and destination.</li>
            <li><strong>tracert (Traceroute):</strong> Identifies every intermediate layer 3 router hop along the path to the destination by sending packets with incrementing TTL (Time-To-Live) values.</li>
        </ul>
    `,
    procedure: `
        <h3>Procedure for Experiment 5</h3>
        <ol style="margin-left: 2rem; line-height: 1.8;">
            <li><strong>Part A &ndash; Addressing &amp; Subnet Detective:</strong> Complete the addressing table matching, /27 network identification, and classify directly connected vs remote networks.</li>
            <li><strong>Part B &ndash; Network Builder &amp; Hardware Preparation:</strong> Place the Serial Hardware Module into Router slots, place 4 PCs and 2 Routers onto the canvas, connect PCs via Copper Cross-over cables, and connect Router0 &harr; Router1 via Serial DCE cable.</li>
            <li><strong>Part C &ndash; Static Routing Lab:</strong> Identify unknown networks for Router0 (.96/27, .128/27) and Router1 (.0/27, .32/27). Build and execute the static routing CLI commands with appropriate next-hop IPs.</li>
            <li><strong>Part D &ndash; Packet Journey &amp; Verification:</strong> Inspect the routing table (<code>show ip route</code>), observe the hop-by-hop packet forwarding animation, and verify connectivity using <code>ping</code>.</li>
            <li><strong>Part E &ndash; Default Routing &amp; Traceroute:</strong> Replace individual static routes with a single default route (<code>0.0.0.0 0.0.0.0</code>), verify routing table status (<code>Gateway of last resort is set</code>), run <code>tracert 192.168.10.130</code>, and complete the Final Mastery comparison.</li>
        </ol>
    `,
    observations: [
        {
            component: "Addressing & Subnet Detective",
            action: "Identify /27 Network ID for 192.168.10.98",
            result: "Network: 192.168.10.96/27 | Usable: 192.168.10.97 - 192.168.10.126"
        },
        {
            component: "Hardware & Topology",
            action: "Install Serial WIC Module & Cable Routers",
            result: "Serial0/1/0 available on R0 (DCE, clock 64000) and R1 (DTE)"
        },
        {
            component: "Static Routing",
            action: "Configure static routes on R0 and R1",
            result: "R0 static routes to .96 & .128 via .66; R1 static routes to .0 & .32 via .65"
        },
        {
            component: "Default Routing",
            action: "Configure 0.0.0.0 0.0.0.0 on R0 and R1",
            result: "Gateway of last resort set via Serial WAN interface next hops"
        },
        {
            component: "Path Tracing",
            action: "Run tracert 192.168.10.130 from PC0",
            result: "Hop 1: 192.168.10.1 -> Hop 2: 192.168.10.66 -> Hop 3: 192.168.10.130"
        }
    ],
    quiz: [
        {
            question: "In the network 192.168.10.0/27, what is the broadcast address for the subnet containing host 192.168.10.98?",
            options: [
                "192.168.10.95",
                "192.168.10.127",
                "192.168.10.255",
                "192.168.10.128"
            ],
            answer: 1,
            hint: "Calculate the block size (32). Subnets start at .0, .32, .64, .96, .128. What is the last address of the .96 block?",
            explanation: "The subnet is 192.168.10.96/27. Block size is 32. The broadcast address is 96 + 31 = 192.168.10.127."
        },
        {
            question: "Why does Router0 initially not know how to forward packets to PC2 (192.168.10.98)?",
            options: [
                "The PC is turned off",
                "The 192.168.10.96/27 network is not directly connected to Router0",
                "Router0 has bad RAM",
                "Serial cables cannot transmit IP packets"
            ],
            answer: 1,
            hint: "Think about what entries a router automatically builds into its routing table when interfaces come up without routing protocols.",
            explanation: "Routers only know directly connected networks by default. Remote networks require static, default, or dynamic routes."
        },
        {
            question: "What is the correct next-hop IP for Router0 when configuring static routes to LAN 3 and LAN 4 behind Router1?",
            options: [
                "192.168.10.1",
                "192.168.10.65",
                "192.168.10.66",
                "192.168.10.97"
            ],
            answer: 2,
            hint: "Next-hop must be the IP address of the neighboring router interface on the WAN serial link (Router1's side), not Router0's own IP.",
            explanation: "The next hop is the IP address of the neighboring router interface on the shared link (Router1's Serial0/1/0: 192.168.10.66)."
        },
        {
            question: "What does the route entry 'S 192.168.10.96/27 [1/0] via 192.168.10.66' indicate in 'show ip route'?",
            options: [
                "Dynamic RIP route",
                "Statically configured route with Administrative Distance 1",
                "Directly connected interface",
                "Default route of last resort"
            ],
            answer: 1,
            hint: "Look at the prefix code 'S'. What does 'S' stand for compared to 'C' (connected) or 'R' (RIP)?",
            explanation: "The code 'S' denotes a static route. [1/0] represents an administrative distance of 1 and metric of 0."
        },
        {
            question: "If Router0 has a static route to LAN 3, but Router1 has no static route to LAN 1, what will happen when PC0 pings PC2?",
            options: [
                "Ping will succeed completely",
                "Forward packet reaches PC2, but the Echo Reply packet is dropped at Router1",
                "Router0 will refuse to transmit the packet",
                "PC0 default gateway will crash"
            ],
            answer: 1,
            hint: "Remember that IP communication is bidirectional: sending an ICMP request is only half the journey. What does the return reply need?",
            explanation: "Routing must be bidirectional. Without a return route on Router1, the ICMP echo reply cannot find a path back to LAN 1."
        }
    ]
};
