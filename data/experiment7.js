const experimentData = {
    aim: "Exercise 7: Demonstration of Routing Information Protocol (RIP v1 & RIP v2)",
    objectives: [
        "Understand Distance Vector routing and how routers share reachability information with their neighbors.",
        "Explain how RIP uses hop count as its routing metric and why a hop count of 16 means unreachable.",
        "Configure RIP v1 (classful) on Cisco routers and observe dynamic route learning across a multi-router topology.",
        "Configure RIP v2 (classless) with subnet-mask support, VLSM/CIDR, and the no auto-summary command.",
        "Verify dynamic route convergence using show ip route and test end-to-end connectivity using ping and traceroute."
    ],
    theory: `
        <h3>1. What is Routing and the Routing Table?</h3>
        <p>In computer networking, <strong>routing</strong> is the process of selecting paths across one or more networks to forward IP packets from a source to a destination. Routers operate at Layer 3 (Network Layer) of the OSI model and connect different logical subnets.</p>
        <p>To determine where to forward every incoming packet, a router consults its <strong>routing table</strong>. The routing table contains:</p>
        <ul>
            <li><strong>Destination Network &amp; Subnet Mask:</strong> The target network address and prefix length.</li>
            <li><strong>Next-Hop IP Address:</strong> The IP address of the adjacent gateway router to which the packet should be sent.</li>
            <li><strong>Exit Interface:</strong> The local physical or logical interface (e.g., <code>GigabitEthernet0/0</code>, <code>Serial0/1/0</code>) used to forward the packet out.</li>
            <li><strong>Metric / Cost:</strong> A value representing the path distance or quality (hop count, bandwidth, delay) used to select the optimal path.</li>
        </ul>

        <h3>2. Routing Information Protocol (RIP) Overview</h3>
        <p><strong>RIP (Routing Information Protocol)</strong> is an Interior Gateway Protocol (IGP) built on the <strong>Distance Vector</strong> routing algorithm (Bellman-Ford algorithm). Defined in RFC 1058 (RIP v1) and RFC 2453 (RIP v2):</p>
        <ul>
            <li><strong>Distance Vector Principle:</strong> A router does not map the entire network topology. Instead, each router advertises its own distance (metric) and vector (next-hop direction) exclusively to its directly connected neighbours on periodic 30-second timers.</li>
            <li><strong>Routing Metric:</strong> RIP uses <strong>hop count</strong> as its exclusive metric. Each router traversed equals exactly 1 hop.</li>
            <li><strong>Maximum Hop Count &amp; Metric of 16:</strong> The maximum valid path length is <strong>15 hops</strong>. A metric of <strong>16 is defined as infinity (unreachable)</strong>. If a route reaches 16 hops, it is deemed unreachable and purged, preventing routing loops from persisting indefinitely.</li>
            <li><strong>Administrative Distance (AD):</strong> RIP has a default Administrative Distance of <strong>120</strong> in Cisco IOS.</li>
        </ul>

        <h3>3. How RIP Learns Routes and Route Codes</h3>
        <p>Routers dynamically build and populate their routing tables through the following sequence:</p>
        <ol>
            <li><strong>Directly Connected Routes (<code>C</code>):</strong> Interfaces configured with active IP addresses automatically install directly connected network routes.</li>
            <li><strong>Local Routes (<code>L</code>):</strong> Host routes (/32) representing the exact IP address assigned to the router's own active interface.</li>
            <li><strong>Periodic Advertisement:</strong> Every 30 seconds, a router broadcasts or multicasts its complete routing table out of all RIP-enabled interfaces.</li>
            <li><strong>Metric Increment:</strong> When a neighbouring router receives this advertisement, it increments the hop count of each received route by <strong>+1</strong>.</li>
            <li><strong>Dynamic Installation (<code>R</code>):</strong> If the learned route is new or offers a shorter hop count than existing paths, the router installs it into its routing table marked with the <strong><code>R</code></strong> (RIP) route code.</li>
        </ol>

        <h3>4. RIP v1: Classful Distance Vector Routing</h3>
        <p><strong>RIP version 1 (RFC 1058)</strong> is a <strong>classful</strong> protocol designed for early IP networks based on strict Class A (/8), Class B (/16), and Class C (/24) boundaries:</p>
        <ul>
            <li><strong>No Subnet Masks in Updates:</strong> RIP v1 packets carry only the network address without any subnet mask. The receiving router must assume the default classful mask or the mask of its own receiving interface.</li>
            <li><strong>Broadcast Updates:</strong> Updates are sent to the Layer 3 broadcast address <code>255.255.255.255</code>, requiring all devices on the local segment (including non-router PCs and switches) to process the packet up to the transport layer.</li>
            <li><strong>No VLSM / CIDR:</strong> Because subnet masks are not transmitted, RIP v1 cannot support Variable Length Subnet Masking (VLSM) or Classless Inter-Domain Routing (CIDR). Subnets of differing lengths from the same major network cannot be distinguished.</li>
            <li><strong>No Authentication:</strong> Routing updates are unauthenticated.</li>
        </ul>

        <h3>5. RIP v2: Classless Routing &amp; VLSM Support</h3>
        <p><strong>RIP version 2 (RFC 2453)</strong> is an enhanced <strong>classless</strong> routing protocol backward-compatible with RIP v1 while resolving its critical limitations:</p>
        <ul>
            <li><strong>Subnet Masks Included:</strong> Each route advertisement explicitly contains its 32-bit subnet mask alongside the network prefix, allowing precise subnetting.</li>
            <li><strong>Multicast Updates:</strong> RIP v2 sends updates to the dedicated multicast address <code>224.0.0.9</code> (All RIP Routers). Non-RIP hosts ignore these frames at Layer 2 (MAC <code>01-00-5E-00-00-09</code>) without CPU overhead.</li>
            <li><strong>VLSM &amp; CIDR Support:</strong> Fully supports arbitrary subnet prefix lengths (such as /27, /28, /30) within the same major network block.</li>
            <li><strong>Route Summarization Control:</strong> Supports the <code>no auto-summary</code> command to disable automatic boundary summarization.</li>
            <li><strong>Authentication:</strong> Supports plain text and MD5 cryptographic authentication for secure route updates.</li>
        </ul>

        <h3>6. RIP v1 vs. RIP v2 Comparison</h3>
        <table style="width:100%; border-collapse:collapse; margin-top:1rem; margin-bottom:1rem; text-align:left;">
            <thead>
                <tr style="border-bottom: 2px solid #E5E7EB; background:#F8FAFC;">
                    <th style="padding:0.6rem 0.75rem;">Feature</th>
                    <th style="padding:0.6rem 0.75rem;">RIP v1</th>
                    <th style="padding:0.6rem 0.75rem;">RIP v2</th>
                </tr>
            </thead>
            <tbody>
                <tr style="border-bottom: 1px solid #E5E7EB;">
                    <td style="padding:0.6rem 0.75rem;"><strong>Routing Architecture</strong></td>
                    <td style="padding:0.6rem 0.75rem;">Classful</td>
                    <td style="padding:0.6rem 0.75rem;">Classless</td>
                </tr>
                <tr style="border-bottom: 1px solid #E5E7EB;">
                    <td style="padding:0.6rem 0.75rem;"><strong>Subnet Mask in Updates</strong></td>
                    <td style="padding:0.6rem 0.75rem;">No (inferred by class/interface)</td>
                    <td style="padding:0.6rem 0.75rem;">Yes (explicit 32-bit mask included)</td>
                </tr>
                <tr style="border-bottom: 1px solid #E5E7EB;">
                    <td style="padding:0.6rem 0.75rem;"><strong>VLSM &amp; CIDR Support</strong></td>
                    <td style="padding:0.6rem 0.75rem;">Not Supported</td>
                    <td style="padding:0.6rem 0.75rem;">Fully Supported</td>
                </tr>
                <tr style="border-bottom: 1px solid #E5E7EB;">
                    <td style="padding:0.6rem 0.75rem;"><strong>Update Destination Address</strong></td>
                    <td style="padding:0.6rem 0.75rem;">Broadcast (<code>255.255.255.255</code>)</td>
                    <td style="padding:0.6rem 0.75rem;">Multicast (<code>224.0.0.9</code>)</td>
                </tr>
                <tr style="border-bottom: 1px solid #E5E7EB;">
                    <td style="padding:0.6rem 0.75rem;"><strong>Metric</strong></td>
                    <td style="padding:0.6rem 0.75rem;">Hop count (max 15; 16 = inf)</td>
                    <td style="padding:0.6rem 0.75rem;">Hop count (max 15; 16 = inf)</td>
                </tr>
                <tr style="border-bottom: 1px solid #E5E7EB;">
                    <td style="padding:0.6rem 0.75rem;"><strong>Authentication</strong></td>
                    <td style="padding:0.6rem 0.75rem;">None</td>
                    <td style="padding:0.6rem 0.75rem;">Plain text &amp; MD5 hash</td>
                </tr>
                <tr>
                    <td style="padding:0.6rem 0.75rem;"><strong>Automatic Summarization</strong></td>
                    <td style="padding:0.6rem 0.75rem;">Mandatory at classful boundary</td>
                    <td style="padding:0.6rem 0.75rem;">Enabled by default; disabled via <code>no auto-summary</code></td>
                </tr>
            </tbody>
        </table>

        <h3>7. Cisco IOS RIP Configuration Commands</h3>
        <p>The standard Cisco IOS commands used to activate and tune RIP are:</p>
        <table style="width:100%; border-collapse:collapse; margin-top:1rem; margin-bottom:1rem; text-align:left;">
            <thead>
                <tr style="border-bottom: 2px solid #E5E7EB; background:#F8FAFC;">
                    <th style="padding:0.6rem 0.75rem;">IOS Command</th>
                    <th style="padding:0.6rem 0.75rem;">Context Mode</th>
                    <th style="padding:0.6rem 0.75rem;">Functional Purpose</th>
                </tr>
            </thead>
            <tbody>
                <tr style="border-bottom: 1px solid #E5E7EB;">
                    <td style="padding:0.6rem 0.75rem;"><code>router rip</code></td>
                    <td style="padding:0.6rem 0.75rem;">Global Config (<code>config#</code>)</td>
                    <td style="padding:0.6rem 0.75rem;">Starts the RIP routing process and enters <code>(config-router)#</code> configuration mode.</td>
                </tr>
                <tr style="border-bottom: 1px solid #E5E7EB;">
                    <td style="padding:0.6rem 0.75rem;"><code>version 2</code></td>
                    <td style="padding:0.6rem 0.75rem;">Router RIP (<code>config-router#</code>)</td>
                    <td style="padding:0.6rem 0.75rem;">Enables RIP version 2 classless operation, sending and receiving only v2 multicast updates.</td>
                </tr>
                <tr style="border-bottom: 1px solid #E5E7EB;">
                    <td style="padding:0.6rem 0.75rem;"><code>network &lt;network-address&gt;</code></td>
                    <td style="padding:0.6rem 0.75rem;">Router RIP (<code>config-router#</code>)</td>
                    <td style="padding:0.6rem 0.75rem;">Enables the RIP process on all local interfaces whose IP address belongs to the specified major classful network.</td>
                </tr>
                <tr>
                    <td style="padding:0.6rem 0.75rem;"><code>no auto-summary</code></td>
                    <td style="padding:0.6rem 0.75rem;">Router RIP (<code>config-router#</code>)</td>
                    <td style="padding:0.6rem 0.75rem;">Disables automatic classful route summarization, allowing specific subnets (e.g. /27) to be advertised intact.</td>
                </tr>
            </tbody>
        </table>

        <h3>8. Understanding the <code>network</code> Command</h3>
        <p>A common misconception is that the <code>network</code> command tells the router which remote networks to look for. In Cisco IOS, the <code>network</code> command does two specific things:</p>
        <ol>
            <li><strong>Interface Activation:</strong> It searches the router's <em>own local interfaces</em>. Any interface whose configured IP address falls inside the specified network block is enabled for RIP (it begins sending and listening for RIP packets).</li>
            <li><strong>Route Advertisement:</strong> It advertises the directly connected network of those enabled interfaces to all neighbouring routers.</li>
        </ol>
        <p><strong>Crucial Rule:</strong> You <em>never</em> enter a remote network in the <code>network</code> command. You only enter the major network addresses that your router is directly attached to. Remote networks are discovered automatically through neighbour advertisements.</p>

        <h3>9. RIP Convergence Example: Router0 &harr; Router1</h3>
        <p>Consider the topology where Router0 and Router1 are linked over a serial WAN link (<code>10.0.0.0/8</code>):</p>
        <pre style="background:#0F172A; color:#38BDF8; padding:1rem; border-radius:6px; font-size:0.85rem; border-left:3px solid #38BDF8;">
[LAN: 192.168.10.0/24] --- (G0/0) Router0 (Se0/1/0: 10.0.0.1) &lt;==== WAN ====&gt; (Se0/1/0: 10.0.0.2) Router1 (G0/0) --- [LAN: 192.168.12.0/24]
        </pre>
        <ol>
            <li><strong>Initial State (Before RIP):</strong> Router0 only has <code>C 192.168.10.0/24</code> and <code>C 10.0.0.0/8</code>. Router1 only has <code>C 192.168.12.0/24</code> and <code>C 10.0.0.0/8</code>. Neither router knows how to reach the other's LAN.</li>
            <li><strong>RIP Execution:</strong> Router0 advertises <code>192.168.10.0/24 (metric 0)</code> out of <code>Serial0/1/0</code>. Router1 advertises <code>192.168.12.0/24 (metric 0)</code> across the serial link.</li>
            <li><strong>Route Installation:</strong> Router0 receives <code>192.168.12.0</code>, increments the hop count by +1 (metric = 1), and installs:
                <br><code>R 192.168.12.0/24 [120/1] via 10.0.0.2, Serial0/1/0</code>
            </li>
            <li><strong>Convergence:</strong> Router1 similarly installs <code>R 192.168.10.0/24 [120/1] via 10.0.0.1</code>. Both routers now have full reachability.</li>
        </ol>

        <h3>10. Why Experiment 7B Uses /27 Subnets and <code>no auto-summary</code></h3>
        <p>In Experiment 7B, a single Class C network <code>192.168.10.0/24</code> is divided using VLSM into <strong>/27 subnets</strong> (subnet mask <code>255.255.255.224</code>, block size of 32):</p>
        <ul>
            <li><code>192.168.10.0/27</code> (Router0 LAN 1)</li>
            <li><code>192.168.10.32/27</code> (Router0 LAN 2)</li>
            <li><code>192.168.10.64/27</code> (Router0 &harr; Router1 WAN Link)</li>
            <li><code>192.168.10.96/27</code> (Router1 LAN 1)</li>
            <li><code>192.168.10.128/27</code> (Router1 LAN 2)</li>
        </ul>
        <p><strong>Why <code>no auto-summary</code> is Required:</strong> By default, RIP automatically summarizes subnets to their classful major network boundary (<code>192.168.10.0/24</code>) when crossing network boundaries. When all subnets belong to the same major network, failure to disable auto-summarization causes routers to advertise conflicting summary routes rather than the individual /27 host subnets. The <code>no auto-summary</code> command forces RIP v2 to send the full, unsummarized /27 subnets with their exact masks.</p>

        <h3>11. Essential Cisco IOS RIP Verification Commands</h3>
        <p>The following commands are used in Cisco IOS to monitor, troubleshoot, and verify RIP routing operations:</p>
        <table style="width:100%; border-collapse:collapse; margin-top:1rem; margin-bottom:1rem; text-align:left;">
            <thead>
                <tr style="border-bottom: 2px solid #E5E7EB; background:#F8FAFC;">
                    <th style="padding:0.6rem 0.75rem;">Command</th>
                    <th style="padding:0.6rem 0.75rem;">Syntax / Mode</th>
                    <th style="padding:0.6rem 0.75rem;">Verification Output &amp; Purpose</th>
                </tr>
            </thead>
            <tbody>
                <tr style="border-bottom: 1px solid #E5E7EB;">
                    <td style="padding:0.6rem 0.75rem;"><code>show ip interface brief</code></td>
                    <td style="padding:0.6rem 0.75rem;">Privileged EXEC (<code>#</code>)</td>
                    <td style="padding:0.6rem 0.75rem;">Displays a concise table of all router interfaces, their assigned IP addresses, and Layer 1/Layer 2 operational status (<code>up/up</code>).</td>
                </tr>
                <tr style="border-bottom: 1px solid #E5E7EB;">
                    <td style="padding:0.6rem 0.75rem;"><code>show ip route</code></td>
                    <td style="padding:0.6rem 0.75rem;">Privileged EXEC (<code>#</code>)</td>
                    <td style="padding:0.6rem 0.75rem;">Displays the active IP routing table, route sources (<code>C</code>, <code>L</code>, <code>R</code>), destination prefixes, administrative distance, hop-count metrics, and next-hop gateways.</td>
                </tr>
                <tr style="border-bottom: 1px solid #E5E7EB;">
                    <td style="padding:0.6rem 0.75rem;"><code>show ip protocols</code></td>
                    <td style="padding:0.6rem 0.75rem;">Privileged EXEC (<code>#</code>)</td>
                    <td style="padding:0.6rem 0.75rem;">Shows active routing protocol parameters, configured RIP version, update timers (30s), active network statements, and routing information sources.</td>
                </tr>
                <tr style="border-bottom: 1px solid #E5E7EB;">
                    <td style="padding:0.6rem 0.75rem;"><code>show running-config</code></td>
                    <td style="padding:0.6rem 0.75rem;">Privileged EXEC (<code>#</code>)</td>
                    <td style="padding:0.6rem 0.75rem;">Displays the active in-memory configuration, verifying interface IPs, clock rate settings, <code>router rip</code> statements, and <code>no auto-summary</code>.</td>
                </tr>
                <tr style="border-bottom: 1px solid #E5E7EB;">
                    <td style="padding:0.6rem 0.75rem;"><code>ping &lt;IP&gt;</code></td>
                    <td style="padding:0.6rem 0.75rem;">User/Priv EXEC &amp; PC CLI</td>
                    <td style="padding:0.6rem 0.75rem;">Sends ICMP Echo Requests to verify Layer 3 bidirectional reachability to target host or interface.</td>
                </tr>
                <tr>
                    <td style="padding:0.6rem 0.75rem;"><code>traceroute / tracert &lt;IP&gt;</code></td>
                    <td style="padding:0.6rem 0.75rem;">Router EXEC / PC CLI</td>
                    <td style="padding:0.6rem 0.75rem;">Traces the hop-by-hop layer 3 path through intermediate gateways to destination, verifying end-to-end multi-router transit.</td>
                </tr>
            </tbody>
        </table>
    `,
    procedure: `
        <h3>Laboratory Procedure: RIP v1 &amp; RIP v2 Dynamic Routing</h3>
        <p>This experiment guides you through configuring and verifying dynamic routing using the Routing Information Protocol (RIP). The procedure is divided into two distinct exercises:</p>
        <ul>
            <li><strong>Exercise 7.A — RIP v1:</strong> Multi-router network using separate classful /24 LAN networks and a /8 serial WAN link.</li>
            <li><strong>Exercise 7.B — RIP v2:</strong> Subnetted multi-router topology divided into classless subnetting using /27 subnets carved from <code>192.168.10.0/24</code>, demonstrating classless route advertisement and <code>no auto-summary</code>.</li>
        </ul>

        <hr style="margin: 2rem 0; border-color: #E2E8F0;">

        <h3>Exercise 7.A — RIP v1 (Classful Routing)</h3>

        <h4>Step 1: Inspect the Required Topology</h4>
        <p><strong>What to do:</strong> Review the network architecture before placing devices:</p>
        <ul>
            <li><strong>PC0 &amp; PC1:</strong> Host endpoints in Router0's local area networks.</li>
            <li><strong>Switch0 &amp; Switch1:</strong> Layer 2 distribution switches connecting hosts to Router0's GigabitEthernet interfaces.</li>
            <li><strong>Router0:</strong> Gateway router providing Layer 3 routing for LAN 1 (192.168.10.0/24) and LAN 2 (192.168.11.0/24), connected to WAN via Serial0/1/0 (DCE).</li>
            <li><strong>Router1:</strong> Gateway router providing Layer 3 routing for LAN 3 (192.168.12.0/24) and LAN 4 (192.168.13.0/24), connected to WAN via Serial0/1/0 (DTE).</li>
            <li><strong>Switch2 &amp; Switch3:</strong> Layer 2 switches connecting Router1 to hosts PC2 and PC3.</li>
            <li><strong>PC2 &amp; PC3:</strong> Host endpoints in Router1's local area networks.</li>
        </ul>
        <p><strong>Why this step?</strong> Understanding the functional purpose of each device ensures clear topological mapping before wiring and configuration.</p>
        <p><strong>Expected result:</strong> Clear mental model of the dual-router, four-LAN network topology.</p>

        <h4>Step 2: Build and Connect the Topology</h4>
        <p><strong>What to do:</strong> In the simulation workspace:</p>
        <ol>
            <li>Drag and drop <strong>4 PCs</strong> (PC0, PC1, PC2, PC3), <strong>4 Switches</strong> (Switch0, Switch1, Switch2, Switch3), and <strong>2 Routers</strong> (Router0, Router1) onto the canvas.</li>
            <li>Using <strong>Copper Straight-Through</strong> cables, connect:
                <ul>
                    <li>PC0 &rarr; Switch0 and PC1 &rarr; Switch1</li>
                    <li>Switch0 &rarr; Router0 (G0/0) and Switch1 &rarr; Router0 (G0/1)</li>
                    <li>Router1 (G0/0) &rarr; Switch2 and Router1 (G0/1) &rarr; Switch3</li>
                    <li>Switch2 &rarr; PC2 and Switch3 &rarr; PC3</li>
                </ul>
            </li>
            <li>Using a <strong>Serial DCE</strong> cable, connect Router0 (Serial0/1/0) to Router1 (Serial0/1/0).</li>
        </ol>
        <p><strong>Why this step?</strong> PCs and switches connect to router Ethernet interfaces via straight-through cables. The point-to-point serial WAN link provides the inter-router communication channel required to exchange RIP routing updates across networks.</p>
        <p><strong>Expected result:</strong> All 10 devices placed with all 9 cable links established on the canvas.</p>

        <h4>Step 3: Check Topology Validation</h4>
        <p><strong>What to do:</strong> Click the <strong>Check Topology</strong> button on the canvas toolbar.</p>
        <p><strong>Why this step?</strong> Topology validation verifies that all required device counts, interface connections, and cable types match the lab specification before moving to addressing and CLI configuration.</p>
        <p><strong>Expected result:</strong> A green success notification confirms valid topology, unlocking the IP Configuration and Cisco IOS CLI panels.</p>

        <h4>Step 4: Configure PC Addressing</h4>
        <p><strong>What to do:</strong> Double-click each PC or enter the configuration dialog to assign IP addresses, subnet masks, and default gateways:</p>
        <table style="width:100%; border-collapse:collapse; margin-top:0.75rem; margin-bottom:0.75rem; text-align:left;">
            <thead>
                <tr style="border-bottom: 2px solid #E5E7EB; background:#F8FAFC;">
                    <th style="padding:0.5rem 0.75rem;">Host</th>
                    <th style="padding:0.5rem 0.75rem;">IP Address</th>
                    <th style="padding:0.5rem 0.75rem;">Subnet Mask</th>
                    <th style="padding:0.5rem 0.75rem;">Default Gateway</th>
                </tr>
            </thead>
            <tbody>
                <tr style="border-bottom: 1px solid #E5E7EB;"><td style="padding:0.5rem 0.75rem;"><strong>PC0</strong></td><td style="padding:0.5rem 0.75rem;"><code>192.168.10.2</code></td><td style="padding:0.5rem 0.75rem;"><code>255.255.255.0</code></td><td style="padding:0.5rem 0.75rem;"><code>192.168.10.1</code></td></tr>
                <tr style="border-bottom: 1px solid #E5E7EB;"><td style="padding:0.5rem 0.75rem;"><strong>PC1</strong></td><td style="padding:0.5rem 0.75rem;"><code>192.168.11.2</code></td><td style="padding:0.5rem 0.75rem;"><code>255.255.255.0</code></td><td style="padding:0.5rem 0.75rem;"><code>192.168.11.1</code></td></tr>
                <tr style="border-bottom: 1px solid #E5E7EB;"><td style="padding:0.5rem 0.75rem;"><strong>PC2</strong></td><td style="padding:0.5rem 0.75rem;"><code>192.168.12.2</code></td><td style="padding:0.5rem 0.75rem;"><code>255.255.255.0</code></td><td style="padding:0.5rem 0.75rem;"><code>192.168.12.1</code></td></tr>
                <tr><td style="padding:0.5rem 0.75rem;"><strong>PC3</strong></td><td style="padding:0.5rem 0.75rem;"><code>192.168.13.2</code></td><td style="padding:0.5rem 0.75rem;"><code>255.255.255.0</code></td><td style="padding:0.5rem 0.75rem;"><code>192.168.13.1</code></td></tr>
            </tbody>
        </table>
        <p><strong>Why this step?</strong> Every endpoint requires a unique Layer 3 IP address and mask to communicate on its subnet, and a default gateway pointing to its local router interface to forward packets destined for remote networks.</p>
        <p><strong>Expected result:</strong> All 4 PCs have valid network parameters assigned.</p>

        <h4>Step 5: Configure Router0 Interfaces</h4>
        <p><strong>What to do:</strong> Access the Router0 CLI terminal and execute the following Cisco IOS commands:</p>
        <pre style="background:#1F2937; color:#10B981; padding:1rem; border-radius:6px; font-size:0.85rem; overflow-x:auto;">Router0> enable
Router0# configure terminal
Router0(config)# interface GigabitEthernet0/0
Router0(config-if)# ip address 192.168.10.1 255.255.255.0
Router0(config-if)# no shutdown
Router0(config-if)# exit
Router0(config)# interface GigabitEthernet0/1
Router0(config-if)# ip address 192.168.11.1 255.255.255.0
Router0(config-if)# no shutdown
Router0(config-if)# exit
Router0(config)# interface Serial0/1/0
Router0(config-if)# ip address 10.0.0.1 255.0.0.0
Router0(config-if)# clock rate 64000
Router0(config-if)# no shutdown
Router0(config-if)# end</pre>
        <p><strong>Why this step?</strong> Assigns gateway IP addresses to LAN interfaces and configures the DCE serial link with a clock rate for Layer 1 synchronization. <code>no shutdown</code> brings the interfaces administratively up.</p>
        <p><strong>Expected result:</strong> Router0 interfaces G0/0, G0/1, and Se0/1/0 are enabled with assigned IP addresses.</p>

        <h4>Step 6: Configure Router1 Interfaces</h4>
        <p><strong>What to do:</strong> Switch to the Router1 CLI terminal and configure its interfaces:</p>
        <pre style="background:#1F2937; color:#10B981; padding:1rem; border-radius:6px; font-size:0.85rem; overflow-x:auto;">Router1> enable
Router1# configure terminal
Router1(config)# interface GigabitEthernet0/0
Router1(config-if)# ip address 192.168.12.1 255.255.255.0
Router1(config-if)# no shutdown
Router1(config-if)# exit
Router1(config)# interface GigabitEthernet0/1
Router1(config-if)# ip address 192.168.13.1 255.255.255.0
Router1(config-if)# no shutdown
Router1(config-if)# exit
Router1(config)# interface Serial0/1/0
Router1(config-if)# ip address 10.0.0.2 255.0.0.0
Router1(config-if)# no shutdown
Router1(config-if)# end</pre>
        <p><strong>Expected result:</strong> Router1 interfaces G0/0, G0/1, and Se0/1/0 are active and up.</p>

        <h4>Step 7: Verify Interfaces and Test Initial Connectivity (Before RIP)</h4>
        <p><strong>What to do:</strong> On Router0, verify the serial link and test connectivity to Router1 and PC3. Repeat <code>show ip interface brief</code> on Router1 to confirm its interfaces:</p>
        <pre style="background:#1F2937; color:#10B981; padding:1rem; border-radius:6px; font-size:0.85rem; overflow-x:auto;">Router0# show ip interface brief
Router0# ping 10.0.0.2
Router0# ping 192.168.13.2</pre>
        <p><strong>Why this step?</strong> Confirms that all directly connected links (including the serial WAN) are operational. Notice that pinging the adjacent router serial address (<code>10.0.0.2</code>) succeeds, but pinging a remote host like <code>192.168.13.2</code> <strong>fails</strong> because Router0 has not yet learned Router1's LAN routes through RIP.</p>
        <p><strong>Expected result:</strong> Interfaces show <code>up/up</code>. The serial link ping succeeds, while the remote network ping to PC3 fails as expected before RIP is configured.</p>

        <h4>Step 8: Configure RIP v1 on Router0</h4>
        <p><strong>What to do:</strong> On Router0, activate the RIP routing process for its directly connected networks:</p>
        <pre style="background:#1F2937; color:#10B981; padding:1rem; border-radius:6px; font-size:0.85rem; overflow-x:auto;">Router0# configure terminal
Router0(config)# router rip
Router0(config-router)# network 192.168.10.0
Router0(config-router)# network 192.168.11.0
Router0(config-router)# network 10.0.0.0
Router0(config-router)# end</pre>
        <p><strong>Why this step?</strong> The <code>network</code> statements specify Router0's <em>own connected networks</em>, instructing RIP to transmit routing updates out of those interfaces and advertise those prefixes to Router1.</p>
        <p><strong>Expected result:</strong> RIP v1 process active on Router0 advertising its 3 directly connected networks.</p>

        <h4>Step 9: Configure RIP v1 on Router1</h4>
        <p><strong>What to do:</strong> On Router1, configure RIP for its local networks:</p>
        <pre style="background:#1F2937; color:#10B981; padding:1rem; border-radius:6px; font-size:0.85rem; overflow-x:auto;">Router1# configure terminal
Router1(config)# router rip
Router1(config-router)# network 192.168.12.0
Router1(config-router)# network 192.168.13.0
Router1(config-router)# network 10.0.0.0
Router1(config-router)# end</pre>
        <p><strong>Why this step?</strong> Enables RIP on Router1's interfaces so it advertises its connected LANs across the serial link to Router0.</p>
        <p><strong>Expected result:</strong> RIP v1 process active on Router1 advertising 192.168.12.0, 192.168.13.0, and 10.0.0.0.</p>

        <h4>Step 10: Verify Dynamic Route Convergence</h4>
        <p><strong>What to do:</strong> Allow the simulator to update the routing state, then verify the learned routes on Router0:</p>
        <pre style="background:#1F2937; color:#10B981; padding:1rem; border-radius:6px; font-size:0.85rem; overflow-x:auto;">Router0# show ip protocols
Router0# show ip route</pre>
        <p><strong>Why this step?</strong> Inspects the dynamic routing table. The table should display:
            <br>&bull; <code>C</code> &mdash; Directly connected networks (192.168.10.0/24, 192.168.11.0/24, 10.0.0.0/8)
            <br>&bull; <code>L</code> &mdash; Local host routes (/32)
            <br>&bull; <code>R</code> &mdash; Dynamically learned RIP routes (192.168.12.0/24 and 192.168.13.0/24 via 10.0.0.2)
        </p>
        <p><strong>Expected result:</strong> Router0 displays dynamically learned <code>R</code> entries for Router1's LANs with a RIP metric of 1 and administrative distance 120.</p>

        <h4>Step 11: Test End-to-End Connectivity (Part A)</h4>
        <p><strong>What to do:</strong> From PC0 CLI or Router0, ping and trace the remote host PC3:</p>
        <pre style="background:#1F2937; color:#10B981; padding:1rem; border-radius:6px; font-size:0.85rem; overflow-x:auto;">ping 192.168.13.2
tracert 192.168.13.2</pre>
        <p><strong>Why this step?</strong> Validates that dynamic route convergence has succeeded: the remote ping that failed in Step 7 now succeeds with 100% reply rate.</p>
        <p><strong>Expected result:</strong> Ping succeeds; traceroute shows the packet crossing the Router0 &rarr; Router1 path before reaching PC3.</p>

        <hr style="margin: 2rem 0; border-color: #E2E8F0;">

        <h3>Exercise 7.B — RIP v2 (Classless Subnetting using /27 Subnets)</h3>

        <h4>Step 12: Inspect the RIP v2 Subnetted Addressing Plan</h4>
        <p><strong>What to do:</strong> Review the classless /27 addressing scheme (subnet mask <code>255.255.255.224</code>, block size 32) carved from major network <code>192.168.10.0/24</code>:</p>
        <table style="width:100%; border-collapse:collapse; margin-top:0.75rem; margin-bottom:0.75rem; text-align:left;">
            <thead>
                <tr style="border-bottom: 2px solid #E5E7EB; background:#F8FAFC;">
                    <th style="padding:0.5rem 0.75rem;">Device</th>
                    <th style="padding:0.5rem 0.75rem;">Interface</th>
                    <th style="padding:0.5rem 0.75rem;">IP Address / Subnet</th>
                    <th style="padding:0.5rem 0.75rem;">Subnet Mask</th>
                    <th style="padding:0.5rem 0.75rem;">Gateway</th>
                </tr>
            </thead>
            <tbody>
                <tr style="border-bottom: 1px solid #E5E7EB;"><td style="padding:0.5rem 0.75rem;"><strong>PC0</strong></td><td style="padding:0.5rem 0.75rem;">NIC</td><td style="padding:0.5rem 0.75rem;"><code>192.168.10.2</code></td><td style="padding:0.5rem 0.75rem;"><code>255.255.255.224</code> (/27)</td><td style="padding:0.5rem 0.75rem;"><code>192.168.10.1</code></td></tr>
                <tr style="border-bottom: 1px solid #E5E7EB;"><td style="padding:0.5rem 0.75rem;"><strong>PC1</strong></td><td style="padding:0.5rem 0.75rem;">NIC</td><td style="padding:0.5rem 0.75rem;"><code>192.168.10.34</code></td><td style="padding:0.5rem 0.75rem;"><code>255.255.255.224</code> (/27)</td><td style="padding:0.5rem 0.75rem;"><code>192.168.10.33</code></td></tr>
                <tr style="border-bottom: 1px solid #E5E7EB;"><td style="padding:0.5rem 0.75rem;"><strong>Router0</strong></td><td style="padding:0.5rem 0.75rem;">G0/0</td><td style="padding:0.5rem 0.75rem;"><code>192.168.10.1</code></td><td style="padding:0.5rem 0.75rem;"><code>255.255.255.224</code> (/27)</td><td style="padding:0.5rem 0.75rem;">&mdash;</td></tr>
                <tr style="border-bottom: 1px solid #E5E7EB;"><td style="padding:0.5rem 0.75rem;"><strong>Router0</strong></td><td style="padding:0.5rem 0.75rem;">G0/1</td><td style="padding:0.5rem 0.75rem;"><code>192.168.10.33</code></td><td style="padding:0.5rem 0.75rem;"><code>255.255.255.224</code> (/27)</td><td style="padding:0.5rem 0.75rem;">&mdash;</td></tr>
                <tr style="border-bottom: 1px solid #E5E7EB;"><td style="padding:0.5rem 0.75rem;"><strong>Router0</strong></td><td style="padding:0.5rem 0.75rem;">Se0/1/0 (DCE)</td><td style="padding:0.5rem 0.75rem;"><code>192.168.10.65</code></td><td style="padding:0.5rem 0.75rem;"><code>255.255.255.224</code> (/27)</td><td style="padding:0.5rem 0.75rem;">&mdash;</td></tr>
                <tr style="border-bottom: 1px solid #E5E7EB;"><td style="padding:0.5rem 0.75rem;"><strong>Router1</strong></td><td style="padding:0.5rem 0.75rem;">Se0/1/0 (DTE)</td><td style="padding:0.5rem 0.75rem;"><code>192.168.10.66</code></td><td style="padding:0.5rem 0.75rem;"><code>255.255.255.224</code> (/27)</td><td style="padding:0.5rem 0.75rem;">&mdash;</td></tr>
                <tr style="border-bottom: 1px solid #E5E7EB;"><td style="padding:0.5rem 0.75rem;"><strong>Router1</strong></td><td style="padding:0.5rem 0.75rem;">G0/0</td><td style="padding:0.5rem 0.75rem;"><code>192.168.10.97</code></td><td style="padding:0.5rem 0.75rem;"><code>255.255.255.224</code> (/27)</td><td style="padding:0.5rem 0.75rem;">&mdash;</td></tr>
                <tr style="border-bottom: 1px solid #E5E7EB;"><td style="padding:0.5rem 0.75rem;"><strong>Router1</strong></td><td style="padding:0.5rem 0.75rem;">G0/1</td><td style="padding:0.5rem 0.75rem;"><code>192.168.10.129</code></td><td style="padding:0.5rem 0.75rem;"><code>255.255.255.224</code> (/27)</td><td style="padding:0.5rem 0.75rem;">&mdash;</td></tr>
                <tr style="border-bottom: 1px solid #E5E7EB;"><td style="padding:0.5rem 0.75rem;"><strong>PC2</strong></td><td style="padding:0.5rem 0.75rem;">NIC</td><td style="padding:0.5rem 0.75rem;"><code>192.168.10.98</code></td><td style="padding:0.5rem 0.75rem;"><code>255.255.255.224</code> (/27)</td><td style="padding:0.5rem 0.75rem;"><code>192.168.10.97</code></td></tr>
                <tr><td style="padding:0.5rem 0.75rem;"><strong>PC3</strong></td><td style="padding:0.5rem 0.75rem;">NIC</td><td style="padding:0.5rem 0.75rem;"><code>192.168.10.130</code></td><td style="padding:0.5rem 0.75rem;"><code>255.255.255.224</code> (/27)</td><td style="padding:0.5rem 0.75rem;"><code>192.168.10.129</code></td></tr>
            </tbody>
        </table>
        <p><strong>Why this step?</strong> All subnets share the same /24 major network, demonstrating why classless routing (RIP v2) and <code>no auto-summary</code> are necessary to prevent automatic summarization collisions.</p>
        <p><strong>Expected result:</strong> Clear understanding of the /27 subnet boundaries (block size 32).</p>

        <h4>Step 13: Configure Router Interfaces for Part B</h4>
        <p><strong>What to do:</strong> In the Part B simulation tab, configure the /27 IP addresses on Router0 and Router1:</p>
        <pre style="background:#1F2937; color:#10B981; padding:1rem; border-radius:6px; font-size:0.85rem; overflow-x:auto;">Router0# configure terminal
Router0(config)# interface GigabitEthernet0/0
Router0(config-if)# ip address 192.168.10.1 255.255.255.224
Router0(config-if)# no shutdown
Router0(config-if)# exit
Router0(config)# interface GigabitEthernet0/1
Router0(config-if)# ip address 192.168.10.33 255.255.255.224
Router0(config-if)# no shutdown
Router0(config-if)# exit
Router0(config)# interface Serial0/1/0
Router0(config-if)# ip address 192.168.10.65 255.255.255.224
Router0(config-if)# clock rate 64000
Router0(config-if)# no shutdown
Router0(config-if)# end</pre>
        <p>On Router1:</p>
        <pre style="background:#1F2937; color:#10B981; padding:1rem; border-radius:6px; font-size:0.85rem; overflow-x:auto;">Router1# configure terminal
Router1(config)# interface GigabitEthernet0/0
Router1(config-if)# ip address 192.168.10.97 255.255.255.224
Router1(config-if)# no shutdown
Router1(config-if)# exit
Router1(config)# interface GigabitEthernet0/1
Router1(config-if)# ip address 192.168.10.129 255.255.255.224
Router1(config-if)# no shutdown
Router1(config-if)# exit
Router1(config)# interface Serial0/1/0
Router1(config-if)# ip address 192.168.10.66 255.255.255.224
Router1(config-if)# no shutdown
Router1(config-if)# end</pre>
        <p><strong>Why this step?</strong> Applies the subnetted /27 addresses across all router interfaces.</p>
        <p><strong>Expected result:</strong> Interfaces are assigned the /27 IPs and transitioned to up/up.</p>

        <h4>Step 14: Verify Interfaces and Initial Reachability</h4>
        <p><strong>What to do:</strong> Run <code>show ip interface brief</code> on both routers and test serial link connectivity:</p>
        <pre style="background:#1F2937; color:#10B981; padding:1rem; border-radius:6px; font-size:0.85rem; overflow-x:auto;">Router0# show ip interface brief
Router0# ping 192.168.10.66
Router0# ping 192.168.10.130</pre>
        <p><strong>Why this step?</strong> Verifies that all interfaces are up with correct /27 subnet masks. Pinging adjacent serial IP <code>192.168.10.66</code> succeeds, but pinging remote host <code>192.168.10.130</code> fails because Router0 has not yet learned Router1's LAN subnet through RIP.</p>
        <p><strong>Expected result:</strong> Output displays all interfaces up/up. The serial link ping succeeds, while the ping to PC3 fails because Router0 has not yet learned Router1's LAN subnet through RIP.</p>

        <h4>Step 15: Configure RIP v2 on Router0</h4>
        <p><strong>What to do:</strong> On Router0, enable RIP version 2 and disable automatic summarization:</p>
        <pre style="background:#1F2937; color:#10B981; padding:1rem; border-radius:6px; font-size:0.85rem; overflow-x:auto;">Router0# configure terminal
Router0(config)# router rip
Router0(config-router)# version 2
Router0(config-router)# network 192.168.10.0
Router0(config-router)# no auto-summary
Router0(config-router)# end</pre>
        <p><strong>Why this step?</strong> <code>version 2</code> enables classless updates with subnet masks, and <code>no auto-summary</code> ensures each /27 subnet is advertised individually instead of being summarized to 192.168.10.0/24.</p>
        <p><strong>Expected result:</strong> Router0 runs RIP v2 with classless updates and no auto-summarization.</p>

        <h4>Step 16: Configure RIP v2 on Router1</h4>
        <p><strong>What to do:</strong> On Router1, configure RIP v2 identically:</p>
        <pre style="background:#1F2937; color:#10B981; padding:1rem; border-radius:6px; font-size:0.85rem; overflow-x:auto;">Router1# configure terminal
Router1(config)# router rip
Router1(config-router)# version 2
Router1(config-router)# network 192.168.10.0
Router1(config-router)# no auto-summary
Router1(config-router)# end</pre>
        <p><strong>Why this step?</strong> Enables RIP v2 on Router1 so it advertises its /27 subnets with full subnet-mask fidelity across multicast 224.0.0.9.</p>
        <p><strong>Expected result:</strong> Both routers now exchange RIP v2 updates.</p>

        <h4>Step 17: Verify RIP v2 Routing Tables</h4>
        <p><strong>What to do:</strong> Allow the simulator to update the routing state, then execute <code>show ip protocols</code> and <code>show ip route</code> on Router0:</p>
        <pre style="background:#1F2937; color:#10B981; padding:1rem; border-radius:6px; font-size:0.85rem; overflow-x:auto;">Router0# show ip protocols
Router0# show ip route</pre>
        <p><strong>Why this step?</strong> Confirms that Router0 has learned the individual <code>192.168.10.96/27</code> and <code>192.168.10.128/27</code> subnets as <code>R</code> entries rather than an ambiguous /24 summary.</p>
        <p><strong>Expected result:</strong> Routing table clearly shows distinct /27 subnets learned via RIP with a metric of 1 and administrative distance 120.</p>

        <h4>Step 18: Test End-to-End Connectivity (Part B)</h4>
        <p><strong>What to do:</strong> From PC0, ping PC3 across the subnetted network and perform a traceroute:</p>
        <pre style="background:#1F2937; color:#10B981; padding:1rem; border-radius:6px; font-size:0.85rem; overflow-x:auto;">ping 192.168.10.130
tracert 192.168.10.130</pre>
        <p><strong>Why this step?</strong> Validates that classless routing routes packets accurately across multiple /27 subnets without packet drop.</p>
        <p><strong>Expected result:</strong> Successful ping replies and traceroute confirming that the packet crosses the Router0 &rarr; Router1 path before reaching PC3.</p>
    `,
    observations: `
        <h3>Expected Observations</h3>
        <p>After completing both exercises, the following results should be observed:</p>
        <ol>
            <li>All router interfaces configured with correct IP addresses come up as <strong>up/up</strong> in <code>show ip interface brief</code>.</li>
            <li>Directly connected networks appear as <code>C</code> (Connected) entries in the routing table immediately after interface configuration.</li>
            <li>After RIP is enabled and one update cycle completes, remote networks appear as <code>R</code> (RIP-learned) entries in the routing table.</li>
            <li>In <strong>Part A (RIP v1)</strong>, the routing table shows classful /24 and /8 entries for learned routes. End-to-end connectivity between PC0 and PC3 is successful.</li>
            <li>In <strong>Part B (RIP v2)</strong>, the routing table shows /27 subnet entries with the correct subnet mask preserved — confirming that RIP v2 is carrying subnet-mask information in its updates.</li>
            <li>Ping between PCs on different /27 subnets succeeds after RIP v2 converges, demonstrating that routing decisions are made using the /27 prefix lengths.</li>
            <li>Traceroute output shows the multi-hop path through Router0 and Router1, confirming that packets are being forwarded dynamically based on RIP-learned routes.</li>
        </ol>
    `,
    quiz: [
        {
            question: "RIP (Routing Information Protocol) belongs to which category of routing protocols?",
            options: [
                "Link-State — each router builds a complete map of the network topology",
                "Distance Vector — routers share routing tables with directly connected neighbours",
                "Path Vector — routers exchange the full path of autonomous systems",
                "Hybrid — combines Distance Vector and Link-State mechanisms"
            ],
            correct: 1,
            explanation: "RIP is a Distance Vector routing protocol. Each router shares its routing table (distance and direction to known networks) only with its directly connected neighbours, not with the entire network."
        },
        {
            question: "A router running RIP discovers that a destination network requires 16 hops to reach. What does this mean?",
            options: [
                "The route is the longest valid path and will be preferred over shorter routes",
                "The network is unreachable — hop count 16 represents infinity in RIP",
                "The route will be installed with a lower priority than 15-hop routes",
                "The router will wait 60 seconds and then try again with a different path"
            ],
            correct: 1,
            explanation: "In RIP, the maximum usable hop count is 15. A hop count of 16 is defined as infinity and means the destination network is unreachable. RIP will not install a route with a metric of 16."
        },
        {
            question: "You have subnets 192.168.10.0/27, 192.168.10.32/27, and 192.168.10.64/27 on different router interfaces. Why is RIP v1 unsuitable for this scenario?",
            options: [
                "RIP v1 does not support serial interfaces",
                "RIP v1 does not include subnet-mask information in routing updates and cannot distinguish between subnets of the same major network",
                "RIP v1 requires a minimum of four routers to operate correctly",
                "RIP v1 uses a different administrative distance that conflicts with /27 subnets"
            ],
            correct: 1,
            explanation: "RIP v1 is classful — it does not transmit subnet masks in route advertisements. When it receives 192.168.10.32, it has no way to determine the /27 prefix length and assumes the classful /24 boundary instead. This makes it impossible to distinguish between the individual /27 subnets."
        },
        {
            question: "In a RIP v2 configuration, why is the 'no auto-summary' command important when all subnets belong to the same major network (e.g., 192.168.10.0/24)?",
            options: [
                "It disables RIP updates completely and forces the administrator to enter routes manually",
                "It prevents RIP v2 from automatically collapsing the individual /27 subnets back into a single 192.168.10.0/24 summary when advertising across the network",
                "It changes the RIP update interval from 30 seconds to 10 seconds for faster convergence",
                "It enables the router to accept routes from both RIP v1 and RIP v2 neighbours simultaneously"
            ],
            correct: 1,
            explanation: "Without 'no auto-summary', RIP v2 may automatically summarize subnets such as 192.168.10.32/27 and 192.168.10.96/27 into the classful summary 192.168.10.0/24 when advertising across major-network boundaries. This hides the individual subnet detail. 'no auto-summary' disables this behaviour so each /27 subnet is advertised with its exact prefix length."
        },
        {
            question: "After configuring RIP on both routers, you run 'show ip route' on Router0 and see entries marked 'R'. What does the 'R' code indicate?",
            options: [
                "Routes that were manually configured as static routes by the administrator",
                "Routes that are directly connected to Router0's own interfaces",
                "Routes that were dynamically learned from a neighbouring router through RIP",
                "Routes that have been rejected because their hop count exceeded the maximum"
            ],
            correct: 2,
            explanation: "In Cisco IOS routing tables, 'C' = Connected (directly attached network), 'L' = Local (the router's own interface IP), 'S' = Static (manually configured), and 'R' = RIP (dynamically learned via RIP). An 'R' entry confirms that RIP has successfully advertised that network from a neighbouring router."
        }
    ]
};
