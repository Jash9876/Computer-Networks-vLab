const experimentData = {
    aim: "Exercise 8: Configuration of Single Area and Multi-Area OSPF in Cisco Packet Tracer",
    objectives: [
        "Understand the architecture, Link-State Advertisement (LSA) mechanics, and SPF shortest path calculation of the OSPF protocol (RFC 2328).",
        "Configure and verify Single Area OSPF (Area 0) across a multi-router mesh topology using Cisco IOS CLI commands.",
        "Implement Multi-Area OSPF hierarchy with Backbone Area 0, Area 1, and Area 2 using an Area Border Router (ABR).",
        "Assign deterministic OSPF Router IDs and advertise subnets using precise inverse wildcard masks.",
        "Analyze Link-State databases, neighbor adjacencies, and routing tables using 'show ip ospf neighbor', 'show ip route ospf', and 'show ip ospf database'."
    ],
    theory: `
        <h3>1. What is Open Shortest Path First (OSPF)?</h3>
        <p>Open Shortest Path First (OSPF) is an open-standard, Link-State Interior Gateway Protocol (IGP) defined in <strong>RFC 2328</strong> (OSPFv2 for IPv4). Unlike Distance Vector protocols (such as RIP) which periodically broadcast their entire routing tables and measure distance in hop counts, OSPF routers build a complete topological map of the network by exchanging Link-State Advertisements (LSAs).</p>
        <p>Every router in an OSPF area maintains an identical <strong>Link-State Database (LSDB)</strong>. Each router independently runs <strong>Dijkstra's Shortest Path First (SPF)</strong> algorithm on its LSDB to compute the shortest loop-free path to every destination subnet, installing the best routes into the IP routing table.</p>

        <h3>2. OSPF Core Characteristics</h3>
        <ul>
            <li><strong>Protocol Type:</strong> Link-State Interior Gateway Protocol (IGP).</li>
            <li><strong>Transport:</strong> IP Protocol 89 (does not use TCP or UDP). Multicast destinations: <code>224.0.0.5</code> (All OSPF Routers) and <code>224.0.0.6</code> (All DR/BDR Routers).</li>
            <li><strong>Administrative Distance (AD):</strong> <code>110</code> (preferred over RIP with AD 120, but subordinate to EIGRP internal with AD 90).</li>
            <li><strong>Metric (Cost):</strong> Inversely proportional to interface bandwidth:
                <br><code>Cost = Reference Bandwidth / Interface Bandwidth</code> (Default Reference Bandwidth = 100 Mbps = 10<sup>8</sup> bps).
                <br><em>Examples:</em> 100 Mbps FastEthernet = Cost 1; 1 Gbps GigabitEthernet = Cost 1; 1.544 Mbps T1 Serial = Cost 64.
            </li>
            <li><strong>Classless Routing:</strong> Supports CIDR, VLSM, and contiguous/discontiguous subnetting with inverse wildcard masks.</li>
        </ul>

        <h3>3. Single Area vs. Multi-Area OSPF Architecture</h3>
        <table style="width:100%; border-collapse:collapse; margin-top:1rem; margin-bottom:1.5rem; text-align:left;">
            <thead>
                <tr style="border-bottom: 2px solid #E2E8F0; background:#F8FAFC;">
                    <th style="padding:0.75rem;">Feature</th>
                    <th style="padding:0.75rem;">Single Area OSPF (Part 8A)</th>
                    <th style="padding:0.75rem;">Multi-Area OSPF (Part 8B)</th>
                </tr>
            </thead>
            <tbody>
                <tr style="border-bottom: 1px solid #E2E8F0;">
                    <td style="padding:0.75rem;"><strong>Area Scope</strong></td>
                    <td style="padding:0.75rem;">All routers and interfaces belong to a single area: <strong>Area 0</strong> (Backbone).</td>
                    <td style="padding:0.75rem;">Network divided into Backbone Area 0 and regular areas (Area 1, Area 2, etc.).</td>
                </tr>
                <tr style="border-bottom: 1px solid #E2E8F0;">
                    <td style="padding:0.75rem;"><strong>LSDB Size</strong></td>
                    <td style="padding:0.75rem;">Grows linearly with total network routers and links.</td>
                    <td style="padding:0.75rem;">Significantly smaller; routers only maintain full topology for their local area.</td>
                </tr>
                <tr style="border-bottom: 1px solid #E2E8F0;">
                    <td style="padding:0.75rem;"><strong>SPF Recalculation</strong></td>
                    <td style="padding:0.75rem;">A link flap anywhere causes SPF recalculation on <em>all</em> routers.</td>
                    <td style="padding:0.75rem;">Link flaps are isolated to the affected area; other areas receive Type 3 Summary LSAs.</td>
                </tr>
                <tr style="border-bottom: 1px solid #E2E8F0;">
                    <td style="padding:0.75rem;"><strong>Router Roles</strong></td>
                    <td style="padding:0.75rem;">Internal Routers only.</td>
                    <td style="padding:0.75rem;"><strong>ABR (Area Border Router)</strong> connects Area 0 to non-backbone areas; <strong>Internal Routers</strong> operate inside one area.</td>
                </tr>
                <tr>
                    <td style="padding:0.75rem;"><strong>Scalability</strong></td>
                    <td style="padding:0.75rem;">Recommended for small networks (up to ~50 routers).</td>
                    <td style="padding:0.75rem;">Highly scalable enterprise hierarchy with route summarization support.</td>
                </tr>
            </tbody>
        </table>

        <h3>4. OSPF Link-State Advertisement (LSA) Types</h3>
        <ul>
            <li><strong>Type 1 (Router LSA):</strong> Generated by every router. Describes the router's local links and interface states. Flooded only within its originated area.</li>
            <li><strong>Type 2 (Network LSA):</strong> Generated by the Designated Router (DR) on multi-access broadcast segments. Lists all routers attached to that segment. Flooded only within its area.</li>
            <li><strong>Type 3 (Summary LSA):</strong> Generated by Area Border Routers (ABRs). Advertises inter-area network prefixes between regular areas and Area 0.</li>
            <li><strong>Type 4 &amp; 5 (ASBR Summary &amp; External LSAs):</strong> Advertise routes redistributed from external autonomous systems (e.g., BGP, static, RIP).</li>
        </ul>

        <h3>5. OSPF Neighbor Adjacency States</h3>
        <p>Before exchanging routing tables, two OSPF routers establish adjacency through eight sequential states:</p>
        <ol>
            <li><strong>Down:</strong> No Hello packets received from the neighbor.</li>
            <li><strong>Init:</strong> Hello received from neighbor, but our own Router ID is not yet listed in the neighbor's active neighbor list.</li>
            <li><strong>2-Way:</strong> Bidirectional communication established. Designated Router (DR) and Backup Designated Router (BDR) election takes place on broadcast networks.</li>
            <li><strong>ExStart:</strong> Master/Slave relationship determined and initial Database Description (DBD) sequence number selected.</li>
            <li><strong>Exchange:</strong> Routers exchange DBD packets describing their LSDB contents.</li>
            <li><strong>Loading:</strong> Routers send Link-State Requests (LSR) for missing or outdated links and receive Link-State Updates (LSU).</li>
            <li><strong>Full:</strong> Routers possess identical LSDBs and are fully adjacent (e.g., <code>FULL/DR</code> or <code>FULL/-</code> on point-to-point serial links).</li>
        </ol>

        <h3>6. Key Cisco IOS OSPF CLI Commands</h3>
        <pre style="background:#1F2937; color:#10B981; padding:1rem; border-radius:6px; font-size:0.85rem; overflow-x:auto;">Router(config)# router ospf &lt;process-id&gt;
Router(config-router)# router-id &lt;A.B.C.D&gt;
Router(config-router)# network &lt;network-address&gt; &lt;wildcard-mask&gt; area &lt;area-id&gt;

Router# show ip ospf neighbor
Router# show ip route ospf
Router# show ip ospf database
Router# show ip interface brief</pre>
    `,
    procedure: `
        <h3>Procedure Implementation Specification for Experiment 8</h3>
        <p>This experiment covers two distinct OSPF topologies as prescribed in the curriculum manual:</p>
        <ul>
            <li><strong>Part 8A:</strong> Configuration of Single Area OSPF (Area 0 Mesh Topology)</li>
            <li><strong>Part 8B:</strong> Configuration of Multi-Area OSPF (Backbone Area 0, Area 1, Area 2 with Central ABR)</li>
        </ul>

        <hr style="margin: 2rem 0; border-color: #E2E8F0;">

        <h3>Part 8A: Single Area OSPF Configuration</h3>

        <h4>Step 1: Construct the 8A Mesh Topology</h4>
        <p><strong>What to do:</strong> In the Simulation tab under Part 8A, drag <strong>2 PCs (PC0, PC1)</strong> and <strong>3 Routers (Router1, Router2, Router3)</strong> onto the canvas. Connect them using appropriate cables:</p>
        <ul>
            <li>PC0 &rarr; Router1 using <strong>Copper cross-over</strong> cable.</li>
            <li>Router1 &rarr; Router2 using <strong>Copper cross-over</strong> cable.</li>
            <li>Router2 &rarr; Router3 using <strong>Copper cross-over</strong> cable.</li>
            <li>Router1 &harr; Router3 using <strong>Serial DCE</strong> cable.</li>
            <li>Router3 &rarr; PC1 using <strong>Copper cross-over</strong> cable.</li>
        </ul>
        <p><strong>Why this step?</strong> Establishes the physical mesh topology with both high-speed Gigabit Ethernet and WAN Serial connections.</p>
        <p><strong>Expected result:</strong> Clicking "Check Topology" confirms all 5 connections and unlocks Stage 2.</p>

        <h4>Step 2: Configure IP Addressing for Part 8A</h4>
        <p><strong>What to do:</strong> Double-click PC0 and PC1 on the canvas to configure their IP address, subnet mask, and default gateway:</p>
        <ul>
            <li><strong>PC0:</strong> IP <code>10.0.0.2</code>, Subnet Mask <code>255.0.0.0</code>, Gateway <code>10.0.0.1</code></li>
            <li><strong>PC1:</strong> IP <code>50.0.0.2</code>, Subnet Mask <code>255.0.0.0</code>, Gateway <code>50.0.0.1</code></li>
        </ul>
        <p><strong>Why this step?</strong> Provides host network parameters so end stations can send traffic to their respective default gateways on Router1 and Router3.</p>
        <p><strong>Expected result:</strong> Host addressing is committed and verified.</p>

        <h4>Step 3: Configure OSPF on Router 1</h4>
        <p><strong>What to do:</strong> Open the CLI console for Router1 and configure OSPF Process 1 in Area 0:</p>
        <pre style="background:#1F2937; color:#10B981; padding:1rem; border-radius:6px; font-size:0.85rem; overflow-x:auto;">Router1# configure terminal
Router1(config)# router ospf 1
Router1(config-router)# network 10.0.0.0 0.255.255.255 area 0
Router1(config-router)# network 20.0.0.0 0.255.255.255 area 0
Router1(config-router)# network 30.0.0.0 0.255.255.255 area 0
Router1(config-router)# exit
Router1(config)# exit</pre>
        <p><strong>Why this step?</strong> Enables OSPF on GigabitEthernet0/0 (10.0.0.1), GigabitEthernet0/1 (20.0.0.1), and Serial0/1/0 (30.0.0.1) under Area 0.</p>
        <p><strong>Expected result:</strong> Router 1 begins sending OSPF Hello packets out of all three interfaces.</p>

        <h4>Step 4: Configure OSPF on Router 2</h4>
        <p><strong>What to do:</strong> Select Router2 console and configure OSPF Process 2 in Area 0:</p>
        <pre style="background:#1F2937; color:#10B981; padding:1rem; border-radius:6px; font-size:0.85rem; overflow-x:auto;">Router2# configure terminal
Router2(config)# router ospf 2
Router2(config-router)# network 20.0.0.0 0.255.255.255 area 0
Router2(config-router)# network 40.0.0.0 0.255.255.255 area 0
Router2(config-router)# exit
Router2(config)# exit</pre>
        <p><strong>Why this step?</strong> Enables OSPF transit routing between subnet 20.0.0.0/8 (toward R1) and 40.0.0.0/8 (toward R3).</p>
        <p><strong>Expected result:</strong> Router 2 forms neighbor adjacency with Router 1 on GigabitEthernet0/0.</p>

        <h4>Step 5: Configure OSPF on Router 3</h4>
        <p><strong>What to do:</strong> Select Router3 console and configure OSPF Process 3 in Area 0:</p>
        <pre style="background:#1F2937; color:#10B981; padding:1rem; border-radius:6px; font-size:0.85rem; overflow-x:auto;">Router3# configure terminal
Router3(config)# router ospf 3
Router3(config-router)# network 30.0.0.0 0.255.255.255 area 0
Router3(config-router)# network 40.0.0.0 0.255.255.255 area 0
Router3(config-router)# network 50.0.0.0 0.255.255.255 area 0
Router3(config-router)# exit
Router3(config)# exit</pre>
        <p><strong>Why this step?</strong> Connects Router 3 to the mesh across Serial0/1/1 (30.0.0.2), GigabitEthernet0/1 (40.0.0.2), and LAN GigabitEthernet0/0 (50.0.0.1).</p>
        <p><strong>Expected result:</strong> Router 3 establishes FULL adjacencies with Router 1 and Router 2.</p>

        <h4>Step 6: Verify Single Area OSPF Convergence</h4>
        <p><strong>What to do:</strong> Execute verification commands on Router1 CLI and perform ping from PC0:</p>
        <pre style="background:#1F2937; color:#10B981; padding:1rem; border-radius:6px; font-size:0.85rem; overflow-x:auto;">Router1# show ip ospf neighbor
Router1# show ip route ospf
Router1# ping 50.0.0.2</pre>
        <p><strong>Why this step?</strong> Verifies that all neighbor states reach FULL, remote subnets 40.0.0.0/8 and 50.0.0.0/8 are learned via OSPF (AD 110), and end-to-end packet transmission succeeds.</p>
        <p><strong>Expected result:</strong> Adjacencies show FULL/DR and FULL/-, routing table lists OSPF routes with AD 110, and ping success rate is 100%.</p>

        <hr style="margin: 2rem 0; border-color: #E2E8F0;">

        <h3>Part 8B: Multi-Area OSPF Configuration</h3>

        <h4>Step 7: Construct the 8B Multi-Area Topology</h4>
        <p><strong>What to do:</strong> Switch to Part 8B tab. Place <strong>4 Routers (Router0, Router1, Router2, Router3)</strong>, <strong>3 Switches (Switch0, Switch1, Switch2)</strong>, and <strong>6 PCs (PC0&hellip;PC5)</strong> onto the canvas:</p>
        <ul>
            <li><strong>Area 0 (Backbone):</strong> PC0, PC1 &rarr; Switch0 &rarr; Router1 (Gig0/0). Router1 (Gig0/1) &rarr; Router0 (Gig0/0).</li>
            <li><strong>Area 1 (Regular Area):</strong> PC2, PC3 &rarr; Switch2 &rarr; Router2 (Gig0/0). Router2 (Gig0/1) &rarr; Router0 (Gig0/1).</li>
            <li><strong>Area 2 (Regular Area):</strong> PC4, PC5 &rarr; Switch1 &rarr; Router3 (Gig0/0). Router3 (Gig0/1) &rarr; Router0 (Gig0/2).</li>
        </ul>
        <p><strong>Why this step?</strong> Builds the star-of-areas hierarchical topology with Router0 serving as the Area Border Router (ABR).</p>
        <p><strong>Expected result:</strong> Check Topology validates multi-area layout and unlocks addressing.</p>

        <h4>Step 8: Configure Host IP Addressing for Part 8B</h4>
        <p><strong>What to do:</strong> Double-click each PC on the canvas to configure IP address, subnet mask, and gateway:</p>
        <ul>
            <li><strong>Area 0:</strong> PC0 (<code>192.168.1.2/24</code>, GW <code>192.168.1.1</code>), PC1 (<code>192.168.1.3/24</code>, GW <code>192.168.1.1</code>)</li>
            <li><strong>Area 1:</strong> PC2 (<code>192.168.3.2/24</code>, GW <code>192.168.3.1</code>), PC3 (<code>192.168.3.3/24</code>, GW <code>192.168.3.1</code>)</li>
            <li><strong>Area 2:</strong> PC4 (<code>192.168.2.2/24</code>, GW <code>192.168.2.1</code>), PC5 (<code>192.168.2.3/24</code>, GW <code>192.168.2.1</code>)</li>
        </ul>
        <p><strong>Why this step?</strong> Sets up distinct logical subnets for each area.</p>
        <p><strong>Expected result:</strong> Host configuration is validated and Stage 3 opens.</p>

        <h4>Step 9: Configure OSPF on Router 1 (Area 0)</h4>
        <p><strong>What to do:</strong> Open Router1 CLI and configure OSPF Process 15 with Router-ID 1.1.1.1:</p>
        <pre style="background:#1F2937; color:#10B981; padding:1rem; border-radius:6px; font-size:0.85rem; overflow-x:auto;">Router1# configure terminal
Router1(config)# router ospf 15
Router1(config-router)# router-id 1.1.1.1
Router1(config-router)# network 192.168.1.0 0.0.0.255 area 0
Router1(config-router)# network 10.10.10.8 0.0.0.3 area 0
Router1(config-router)# exit
Router1(config)# exit</pre>
        <p><strong>Why this step?</strong> Places LAN 192.168.1.0/24 and WAN link 10.10.10.8/30 into Backbone Area 0.</p>
        <p><strong>Expected result:</strong> Router 1 runs OSPF in Area 0 with RID 1.1.1.1.</p>

        <h4>Step 10: Configure OSPF on Router 2 (Area 1)</h4>
        <p><strong>What to do:</strong> Open Router2 CLI and configure OSPF Process 15 with Router-ID 2.2.2.2:</p>
        <pre style="background:#1F2937; color:#10B981; padding:1rem; border-radius:6px; font-size:0.85rem; overflow-x:auto;">Router2# configure terminal
Router2(config)# router ospf 15
Router2(config-router)# router-id 2.2.2.2
Router2(config-router)# network 192.168.3.0 0.0.0.255 area 1
Router2(config-router)# network 10.10.10.4 0.0.0.3 area 1
Router2(config-router)# exit
Router2(config)# exit</pre>
        <p><strong>Why this step?</strong> Places LAN 192.168.3.0/24 and WAN link 10.10.10.4/30 into Area 1.</p>
        <p><strong>Expected result:</strong> Router 2 runs OSPF in Area 1 with RID 2.2.2.2.</p>

        <h4>Step 11: Configure OSPF on Router 3 (Area 2)</h4>
        <p><strong>What to do:</strong> Open Router3 CLI and configure OSPF Process 15 with Router-ID 3.3.3.3:</p>
        <pre style="background:#1F2937; color:#10B981; padding:1rem; border-radius:6px; font-size:0.85rem; overflow-x:auto;">Router3# configure terminal
Router3(config)# router ospf 15
Router3(config-router)# router-id 3.3.3.3
Router3(config-router)# network 192.168.2.0 0.0.0.255 area 2
Router3(config-router)# network 10.10.10.0 0.0.0.3 area 2
Router3(config-router)# exit
Router3(config)# exit</pre>
        <p><strong>Why this step?</strong> Places LAN 192.168.2.0/24 and WAN link 10.10.10.0/30 into Area 2.</p>
        <p><strong>Expected result:</strong> Router 3 runs OSPF in Area 2 with RID 3.3.3.3.</p>

        <h4>Step 12: Configure Central ABR Router 0</h4>
        <p><strong>What to do:</strong> Open Router0 CLI and configure OSPF across Area 0, Area 1, and Area 2 with Router-ID 4.4.4.4:</p>
        <pre style="background:#1F2937; color:#10B981; padding:1rem; border-radius:6px; font-size:0.85rem; overflow-x:auto;">Router0# configure terminal
Router0(config)# router ospf 15
Router0(config-router)# router-id 4.4.4.4
Router0(config-router)# network 10.10.10.8 0.0.0.3 area 0
Router0(config-router)# network 10.10.10.4 0.0.0.3 area 1
Router0(config-router)# network 10.10.10.0 0.0.0.3 area 2
Router0(config-router)# exit
Router0(config)# exit</pre>
        <p><strong>Why this step?</strong> Router 0 acts as the ABR, interconnecting Area 0, Area 1, and Area 2 and originating Type 3 Summary LSAs.</p>
        <p><strong>Expected result:</strong> Adjacencies form with all three perimeter routers.</p>

        <h4>Step 13: Verify Multi-Area OSPF Database and Inter-Area Routing</h4>
        <p><strong>What to do:</strong> On Router0 and PC0, execute verification commands:</p>
        <pre style="background:#1F2937; color:#10B981; padding:1rem; border-radius:6px; font-size:0.85rem; overflow-x:auto;">Router0# show ip ospf neighbor
Router0# show ip ospf database
Router0# ping 192.168.2.2</pre>
        <p><strong>Why this step?</strong> Confirms neighbor adjacencies with 1.1.1.1, 2.2.2.2, and 3.3.3.3, verifies Summary Net Link States (Type 3 LSAs) across areas, and validates cross-area ping from Area 0 to Area 2.</p>
        <p><strong>Expected result:</strong> Full neighbor adjacencies, Type 3 Summary LSAs listed in database, and 100% ping success.</p>
    `,
    quiz: [
        {
            question: "What is the standard Administrative Distance (AD) of OSPF routes in Cisco IOS?",
            options: [
                "90",
                "100",
                "110",
                "120"
            ],
            correct: 2,
            explanation: "OSPF has an administrative distance of 110. EIGRP internal is 90, IGRP is 100, and RIP is 120."
        },
        {
            question: "Which algorithm does OSPF use to calculate the shortest loop-free path tree?",
            options: [
                "Bellman-Ford Algorithm",
                "Dijkstra's Shortest Path First (SPF) Algorithm",
                "Floyd-Warshall Algorithm",
                "Diffusing Update Algorithm (DUAL)"
            ],
            correct: 1,
            explanation: "OSPF is a Link-State protocol that utilizes Dijkstra's Shortest Path First (SPF) algorithm to calculate the best path to every destination."
        },
        {
            question: "Why must all non-backbone areas connect directly to Area 0 in a Multi-Area OSPF design?",
            options: [
                "To ensure loop-free inter-area routing and prevent routing loops through a star-of-areas topology",
                "Because routers in non-backbone areas lack memory for routing tables",
                "To allow RIP routes to be automatically redistributed",
                "Because Cisco switches only support Area 0 VLAN tags"
            ],
            correct: 0,
            explanation: "OSPF enforces a two-tier hierarchy where Area 0 acts as the core transit backbone. Requiring all areas to connect to Area 0 prevents inter-area routing loops."
        },
        {
            question: "What is the role of an Area Border Router (ABR) in Multi-Area OSPF?",
            options: [
                "It redistributes routes from external autonomous systems like BGP into OSPF",
                "It maintains separate Link-State Databases for each attached area and floods Type 3 Summary LSAs between them",
                "It disables OSPF authentication on LAN interfaces",
                "It acts exclusively as a DHCP and DNS server for branch subnets"
            ],
            correct: 1,
            explanation: "An ABR has interfaces in multiple areas (including Area 0). It maintains an LSDB for each area and generates Type 3 Summary LSAs to advertise network prefixes between areas."
        },
        {
            question: "What is the correct inverse wildcard mask for advertising a /24 subnet (e.g., 192.168.1.0 255.255.255.0) in OSPF?",
            options: [
                "255.255.255.0",
                "0.0.0.255",
                "0.0.255.255",
                "0.255.255.255"
            ],
            correct: 1,
            explanation: "The wildcard mask is computed by subtracting the subnet mask from 255.255.255.255: (255.255.255.255 - 255.255.255.0) = 0.0.0.255."
        }
    ]
};

if (typeof window !== 'undefined') {
    window.experimentData = experimentData;
}
if (typeof module !== 'undefined' && module.exports) {
    module.exports = experimentData;
}
