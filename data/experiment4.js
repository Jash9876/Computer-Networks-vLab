const experimentData = {
    aim: "Exercise 4: Configuration of IP Address in Router and Subnetting in WAN",
    objectives: [
        "Configure IP addresses and default gateways on end devices (PCs).",
        "Configure IP addresses and enable GigabitEthernet interfaces on a Cisco Router.",
        "Understand and apply Subnetting using a /27 subnet mask.",
        "Configure Serial interfaces for WAN connectivity between routers with DTE/DCE roles.",
        "Implement Static Routing to enable communication between remote networks."
    ],
    theory: `
        <h3>1. Router IP Configuration</h3>
        <p>A router connects different networks. To communicate with each network, each router interface must be assigned an IP address belonging to the network connected to that interface.</p>
        <p>The router interface address is also used as the default gateway for devices in that network.</p>
        <p>For example:</p>
        <pre style="background:#1F2937; color:#10B981; padding:1rem; border-radius:6px; font-size:0.85rem; overflow-x:auto;">Router(config)# interface gigabitethernet 0/0
Router(config-if)# ip address 192.168.10.1 255.255.255.0
Router(config-if)# no shutdown</pre>
        <p>The <code>no shutdown</code> command enables the interface. An interface that is administratively shut down cannot forward packets even when its IP address is correctly configured.</p>

        <h3>2. Default Gateway</h3>
        <p>A default gateway is the IP address of the router interface through which a device communicates with destinations outside its local network.</p>
        <p>Each PC in the experiment uses the IP address of the corresponding router interface as its default gateway.</p>

        <h3>3. WAN Subnetting (/27 Mask)</h3>
        <p>Subnetting divides a larger network into smaller networks.</p>
        <p>In this experiment, the <code>192.168.10.0</code> network is divided using a <code>/27</code> subnet mask:</p>
        <p><code>255.255.255.224</code></p>
        <p>A <code>/27</code> mask provides 5 host bits, giving 32 addresses per subnet, of which 30 are usable for hosts.</p>
        <p>The subnets used in this experiment are:</p>
        <table style="width:100%; border-collapse:collapse; margin-top:1rem; text-align:left;">
            <thead>
                <tr style="border-bottom: 2px solid #E5E7EB;">
                    <th style="padding:0.5rem;">Network</th>
                    <th style="padding:0.5rem;">Usable Host Range</th>
                    <th style="padding:0.5rem;">Broadcast</th>
                </tr>
            </thead>
            <tbody>
                <tr style="border-bottom: 1px solid #E5E7EB;">
                    <td style="padding:0.5rem;">192.168.10.0/27</td>
                    <td style="padding:0.5rem;">192.168.10.1 &ndash; 192.168.10.30</td>
                    <td style="padding:0.5rem;">192.168.10.31</td>
                </tr>
                <tr style="border-bottom: 1px solid #E5E7EB;">
                    <td style="padding:0.5rem;">192.168.10.32/27</td>
                    <td style="padding:0.5rem;">192.168.10.33 &ndash; 192.168.10.62</td>
                    <td style="padding:0.5rem;">192.168.10.63</td>
                </tr>
                <tr style="border-bottom: 1px solid #E5E7EB;">
                    <td style="padding:0.5rem;">192.168.10.64/27</td>
                    <td style="padding:0.5rem;">192.168.10.65 &ndash; 192.168.10.94</td>
                    <td style="padding:0.5rem;">192.168.10.95</td>
                </tr>
                <tr style="border-bottom: 1px solid #E5E7EB;">
                    <td style="padding:0.5rem;">192.168.10.96/27</td>
                    <td style="padding:0.5rem;">192.168.10.97 &ndash; 192.168.10.126</td>
                    <td style="padding:0.5rem;">192.168.10.127</td>
                </tr>
                <tr>
                    <td style="padding:0.5rem;">192.168.10.128/27</td>
                    <td style="padding:0.5rem;">192.168.10.129 &ndash; 192.168.10.158</td>
                    <td style="padding:0.5rem;">192.168.10.159</td>
                </tr>
            </tbody>
        </table>

        <h3>4. DTE and DCE in Serial Links</h3>
        <p>In a serial WAN connection, one router acts as Data Terminal Equipment (DTE) and the other as Data Circuit-terminating Equipment (DCE).</p>
        <p>The DCE side provides the clocking signal for the serial connection. The clock rate controls the timing of data transmission across the serial link.</p>

        <h3>5. Static Routing</h3>
        <p>Routers automatically know about networks directly connected to their interfaces.</p>
        <p>To reach a remote network that is not directly connected, a static route can be configured. A static route specifies the destination network, subnet mask, and next-hop IP address.</p>
        <p>Example:</p>
        <pre style="background:#1F2937; color:#10B981; padding:1rem; border-radius:6px; font-size:0.85rem; overflow-x:auto;">Router(config)# ip route [Destination Network] [Subnet Mask] [Next-Hop IP]</pre>
        <p>The next-hop address identifies the neighboring router through which the destination network can be reached.</p>

        <h3>6. Routing Table</h3>
        <p>A routing table contains information about the networks that a router can reach.</p>
        <p>It can contain directly connected networks and manually configured static routes.</p>
        <p>The routing table can be viewed using:</p>
        <pre style="background:#1F2937; color:#10B981; padding:1rem; border-radius:6px; font-size:0.85rem; overflow-x:auto;">Router# show ip route</pre>
        <p>The router uses this information to determine how packets should be forwarded toward their destination.</p>

        <h3>7. Packet Forwarding</h3>
        <p>When a device sends a packet to a destination outside its local subnet, it forwards the packet to its default gateway.</p>
        <p>The router examines its routing table, identifies the appropriate destination network and next hop, and forwards the packet through the appropriate interface.</p>
        <p>In this experiment, the packet path can be visualized as:</p>
        <p><code>PC &rarr; Router0 &rarr; Serial WAN &rarr; Router1 &rarr; Destination PC</code></p>

        <h3>8. Ping and Connectivity Verification</h3>
        <p>The <code>ping</code> command is used to test connectivity between network devices.</p>
        <p>It sends ICMP Echo Request messages to the destination and waits for ICMP Echo Reply messages.</p>
        <p>Example:</p>
        <pre style="background:#1F2937; color:#10B981; padding:1rem; border-radius:6px; font-size:0.85rem; overflow-x:auto;">ping 192.168.10.130</pre>
        <p>A successful ping indicates that the required physical connections, IP addressing, interfaces, routing, and return path are correctly configured.</p>
    `,
    procedure: `
        <h3>Procedure Implementation Specification for Experiment 4</h3>
        <p>The procedure covers both:</p>
        <ul>
            <li><strong>Experiment 4-A:</strong> Configuration of IP Address in Router</li>
            <li><strong>Experiment 4-B:</strong> Subnetting in WAN Configuration (DTE and DCE)</li>
        </ul>

        <hr style="margin: 2rem 0; border-color: #374151;">

        <h3>Part A: Configuration of IP Address in Router</h3>
        
        <h4>Step 1: Create the Topology</h4>
        <p>Create the following topology:</p>
        <ul>
            <li>2 PCs: PC0 and PC1</li>
            <li>1 Router: Router0</li>
            <li>PC0 connected to Router0</li>
            <li>PC1 connected to Router0</li>
        </ul>

        <h4>Step 2: Configure PC0</h4>
        <p>Open the IP Configuration interface for PC0 and enter:</p>
        <table style="width:100%; border-collapse:collapse; margin-top:1rem; margin-bottom:1rem; text-align:left;">
            <thead><tr style="border-bottom: 2px solid #E5E7EB;">
                <th style="padding:0.5rem;">Parameter</th><th style="padding:0.5rem;">Required Value</th>
            </tr></thead>
            <tbody>
                <tr style="border-bottom: 1px solid #E5E7EB;"><td style="padding:0.5rem;">IP Address</td><td style="padding:0.5rem;">192.168.10.2</td></tr>
                <tr style="border-bottom: 1px solid #E5E7EB;"><td style="padding:0.5rem;">Subnet Mask</td><td style="padding:0.5rem;">255.255.255.0</td></tr>
                <tr><td style="padding:0.5rem;">Default Gateway</td><td style="padding:0.5rem;">192.168.10.1</td></tr>
            </tbody>
        </table>

        <h4>Step 3: Configure PC1</h4>
        <p>Configure PC1 with:</p>
        <table style="width:100%; border-collapse:collapse; margin-top:1rem; margin-bottom:1rem; text-align:left;">
            <thead><tr style="border-bottom: 2px solid #E5E7EB;">
                <th style="padding:0.5rem;">Parameter</th><th style="padding:0.5rem;">Required Value</th>
            </tr></thead>
            <tbody>
                <tr style="border-bottom: 1px solid #E5E7EB;"><td style="padding:0.5rem;">IP Address</td><td style="padding:0.5rem;">192.168.11.2</td></tr>
                <tr style="border-bottom: 1px solid #E5E7EB;"><td style="padding:0.5rem;">Subnet Mask</td><td style="padding:0.5rem;">255.255.255.0</td></tr>
                <tr><td style="padding:0.5rem;">Default Gateway</td><td style="padding:0.5rem;">192.168.11.1</td></tr>
            </tbody>
        </table>

        <h4>Step 4: Configure Router0 Through the Terminal</h4>
        <p>Open the router CLI. Start with:</p>
        <pre style="background:#1F2937; color:#10B981; padding:1rem; border-radius:6px; font-size:0.85rem; overflow-x:auto;">enable
configure terminal</pre>
        
        <p><strong>Step 4.1: Configure Router0 G0/0</strong></p>
        <pre style="background:#1F2937; color:#10B981; padding:1rem; border-radius:6px; font-size:0.85rem; overflow-x:auto;">interface gigabitethernet 0/0
ip address 192.168.10.1 255.255.255.0
no shutdown
exit</pre>
        
        <p><strong>Step 4.2: Configure Router0 G0/1</strong></p>
        <pre style="background:#1F2937; color:#10B981; padding:1rem; border-radius:6px; font-size:0.85rem; overflow-x:auto;">interface gigabitethernet 0/1
ip address 192.168.11.1 255.255.255.0
no shutdown
exit</pre>

        <h4>Step 5: Verify Router Interfaces</h4>
        <p>Execute:</p>
        <pre style="background:#1F2937; color:#10B981; padding:1rem; border-radius:6px; font-size:0.85rem; overflow-x:auto;">end
show ip interface brief</pre>

        <h4>Step 6: Verify Connectivity</h4>
        <p>From PC0:</p>
        <pre style="background:#1F2937; color:#10B981; padding:1rem; border-radius:6px; font-size:0.85rem; overflow-x:auto;">ping 192.168.10.1</pre>
        <p>From PC1:</p>
        <pre style="background:#1F2937; color:#10B981; padding:1rem; border-radius:6px; font-size:0.85rem; overflow-x:auto;">ping 192.168.11.1</pre>

        <hr style="margin: 2rem 0; border-color: #374151;">

        <h3>Part B: Subnetting in WAN Configuration</h3>

        <h4>Step 7: Create the WAN Topology</h4>
        <p>Create 4 PCs and 2 Routers with the following connections:</p>
        <ul>
            <li>PC0 &mdash; Router0</li>
            <li>PC1 &mdash; Router0</li>
            <li>Router0 &mdash; Serial WAN &mdash; Router1</li>
            <li>Router1 &mdash; PC2</li>
            <li>Router1 &mdash; PC3</li>
        </ul>

        <h4>Step 8: Configure the PCs</h4>
        <p>Use the /27 subnet mask: <code>255.255.255.224</code></p>
        <table style="width:100%; border-collapse:collapse; margin-top:1rem; margin-bottom:1rem; text-align:left;">
            <thead><tr style="border-bottom: 2px solid #E5E7EB;">
                <th style="padding:0.5rem;">Device</th><th style="padding:0.5rem;">IP Address</th><th style="padding:0.5rem;">Subnet Mask</th><th style="padding:0.5rem;">Default Gateway</th>
            </tr></thead>
            <tbody>
                <tr style="border-bottom: 1px solid #E5E7EB;"><td style="padding:0.5rem;">PC0</td><td style="padding:0.5rem;">192.168.10.2</td><td style="padding:0.5rem;">255.255.255.224</td><td style="padding:0.5rem;">192.168.10.1</td></tr>
                <tr style="border-bottom: 1px solid #E5E7EB;"><td style="padding:0.5rem;">PC1</td><td style="padding:0.5rem;">192.168.10.34</td><td style="padding:0.5rem;">255.255.255.224</td><td style="padding:0.5rem;">192.168.10.33</td></tr>
                <tr style="border-bottom: 1px solid #E5E7EB;"><td style="padding:0.5rem;">PC2</td><td style="padding:0.5rem;">192.168.10.98</td><td style="padding:0.5rem;">255.255.255.224</td><td style="padding:0.5rem;">192.168.10.97</td></tr>
                <tr><td style="padding:0.5rem;">PC3</td><td style="padding:0.5rem;">192.168.10.130</td><td style="padding:0.5rem;">255.255.255.224</td><td style="padding:0.5rem;">192.168.10.129</td></tr>
            </tbody>
        </table>

        <h4>Step 9: Configure Router0</h4>
        <pre style="background:#1F2937; color:#10B981; padding:1rem; border-radius:6px; font-size:0.85rem; overflow-x:auto;">enable
configure terminal
interface gigabitethernet 0/0
ip address 192.168.10.1 255.255.255.224
no shutdown
exit
interface gigabitethernet 0/1
ip address 192.168.10.33 255.255.255.224
no shutdown
exit
interface serial 0/1/0
ip address 192.168.10.65 255.255.255.224
no shutdown
exit</pre>

        <h4>Step 10: Configure Router1</h4>
        <pre style="background:#1F2937; color:#10B981; padding:1rem; border-radius:6px; font-size:0.85rem; overflow-x:auto;">enable
configure terminal
interface gigabitethernet 0/0
ip address 192.168.10.97 255.255.255.224
no shutdown
exit
interface gigabitethernet 0/1
ip address 192.168.10.129 255.255.255.224
no shutdown
exit
interface serial 0/1/0
ip address 192.168.10.66 255.255.255.224
no shutdown
exit</pre>

        <h4>Step 11: Configure and Identify DTE/DCE</h4>
        <p>On the DCE interface (e.g. Router0):</p>
        <pre style="background:#1F2937; color:#10B981; padding:1rem; border-radius:6px; font-size:0.85rem; overflow-x:auto;">interface serial 0/1/0
clock rate 64000</pre>

        <h4>Step 12: Verify Interfaces</h4>
        <pre style="background:#1F2937; color:#10B981; padding:1rem; border-radius:6px; font-size:0.85rem; overflow-x:auto;">show ip interface brief</pre>

        <h4>Step 13: Understand the /27 Subnets</h4>
        <p>Open the Subnet Analyzer to visualize the networks used:</p>
        <ul>
            <li>192.168.10.0/27 (PC0 + Router0 G0/0)</li>
            <li>192.168.10.32/27 (PC1 + Router0 G0/1)</li>
            <li>192.168.10.64/27 (Router0 S0/1/0 + Router1 S0/1/0)</li>
            <li>192.168.10.96/27 (PC2 + Router1 G0/0)</li>
            <li>192.168.10.128/27 (PC3 + Router1 G0/1)</li>
        </ul>

        <h4>Step 14: Identify Remote Networks</h4>
        <p>Router0 directly connects to .0, .32, and .64 subnets. It must reach remote networks .96 and .128.</p>
        <p>Router1 directly connects to .64, .96, and .128 subnets. It must reach remote networks .0 and .32.</p>

        <h4>Step 15: Configure Static Routes on Router0</h4>
        <pre style="background:#1F2937; color:#10B981; padding:1rem; border-radius:6px; font-size:0.85rem; overflow-x:auto;">ip route 192.168.10.96 255.255.255.224 192.168.10.66
ip route 192.168.10.128 255.255.255.224 192.168.10.66</pre>

        <h4>Step 16: Configure Static Routes on Router1</h4>
        <pre style="background:#1F2937; color:#10B981; padding:1rem; border-radius:6px; font-size:0.85rem; overflow-x:auto;">ip route 192.168.10.0 255.255.255.224 192.168.10.65
ip route 192.168.10.32 255.255.255.224 192.168.10.65</pre>

        <h4>Step 17: Verify Routing Tables</h4>
        <pre style="background:#1F2937; color:#10B981; padding:1rem; border-radius:6px; font-size:0.85rem; overflow-x:auto;">show ip route</pre>

        <h4>Step 18 & 19: Test End-to-End Connectivity</h4>
        <p>From PC0 to PC2 (192.168.10.98) and PC3 (192.168.10.130):</p>
        <pre style="background:#1F2937; color:#10B981; padding:1rem; border-radius:6px; font-size:0.85rem; overflow-x:auto;">ping 192.168.10.98
ping 192.168.10.130</pre>
        
        <h4>Step 22: Final Verification</h4>
        <p>The experiment should only be considered successfully completed when all required checks pass.</p>
        
        <h4>Step 23: Result</h4>
        <p>After successful completion, update the existing Result tab with the student's progress and final status.</p>
    `,
    result: "Part 4-A: The implementation of router IP addressing and connectivity is completed and verified.<br><br>Part 4-B: Thus, the implementation of IP addressing & subnetting is done and verified in packet tracer.",
    quiz: [
        {
            question: "What is the purpose of configuring an IP address on a router's interface?",
            options: [
                "To connect to the power supply",
                "To act as the default gateway for devices in that network",
                "To assign MAC addresses to devices",
                "To encrypt data transmission"
            ],
            answer: 1,
            explanation: "The router's interface IP serves as the default gateway for devices on the connected network, allowing them to communicate with external networks."
        },
        {
            question: "Which of the following is a valid subnet mask for a /27 network?",
            options: [
                "255.255.255.0",
                "255.255.255.192",
                "255.255.255.224",
                "255.255.255.240"
            ],
            answer: 2,
            explanation: "A /27 subnet mask borrows 3 bits from the host portion, resulting in 128 + 64 + 32 = 224 in the last octet: 255.255.255.224."
        },
        {
            question: "How many usable host IP addresses are available in a /27 subnet?",
            options: [
                "14",
                "30",
                "62",
                "254"
            ],
            answer: 1,
            explanation: "A /27 mask leaves 5 bits for hosts (32 - 27 = 5). Total addresses = 2^5 = 32. Subtracting the network and broadcast addresses gives 30 usable hosts."
        },
        {
            question: "In a serial WAN link, which device is responsible for providing the clock rate?",
            options: [
                "DTE (Data Terminal Equipment)",
                "DCE (Data Circuit-terminating Equipment)",
                "The Switch",
                "The PC"
            ],
            answer: 1,
            explanation: "The DCE provides the clocking signal for the serial communication link to synchronize data transmission."
        },
        {
            question: "What information is required to configure a static route?",
            options: [
                "Destination Network, Subnet Mask, and Next-Hop IP",
                "Source IP, Destination IP, and Protocol",
                "MAC Address, Subnet Mask, and Gateway",
                "Router Name, Password, and Interface"
            ],
            answer: 0,
            explanation: "A static route requires the remote destination network address, its subnet mask, and the IP address of the next-hop router that will receive the packet."
        },
        {
            question: "If a ping from PC0 to PC3 fails and the troubleshooter shows 'Return path missing', what is the most likely cause?",
            options: [
                "PC0 has the wrong IP address",
                "Router0 has no route to PC3",
                "Router1 has no static route back to PC0's network",
                "The physical cable is broken"
            ],
            answer: 2,
            explanation: "Routing must be bidirectional. If the packet reached the destination, Router0 had the route, but Router1 lacked the return route to send the ICMP Reply back."
        }
    ]
};
