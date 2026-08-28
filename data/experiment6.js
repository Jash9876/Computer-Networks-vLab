const experimentData = {
    aim: "Exercise 6: Configuration of Network Address Translation (NAT) in Packet Tracer",
    objectives: [
        "Understand the architecture and necessity of Network Address Translation (NAT) in IPv4 networking.",
        "Differentiate between Inside Local, Inside Global, Outside Local, and Outside Global addresses.",
        "Implement and verify 1-to-1 Static NAT on a Cisco boundary router for dedicated server access.",
        "Configure Access Control Lists (ACL) and Dynamic NAT Pools for scalable many-to-many outbound translations.",
        "Verify active address translations using 'show ip nat translations', 'show ip nat statistics', and 'debug ip nat'."
    ],
    theory: `
        <h3>1. What is Network Address Translation (NAT)?</h3>
        <p>Network Address Translation (NAT) is a method defined in RFC 1631 and RFC 3022 that enables private IP address networks (RFC 1918) to connect to the public Internet by translating private local addresses into globally routable public IP addresses.</p>
        <p>NAT conserves global IPv4 address space and adds a layer of security by hiding internal network topologies from outside networks.</p>

        <h3>2. NAT Address Terminology</h3>
        <ul>
            <li><strong>Inside Local:</strong> The actual private IP address assigned to a host on the internal network (e.g., <code>10.10.10.1</code> or <code>10.0.0.2</code>).</li>
            <li><strong>Inside Global:</strong> The globally unique public IP address allocated by the ISP that represents internal hosts to the outside world (e.g., <code>30.30.30.10</code> or <code>2.0.0.10</code>).</li>
            <li><strong>Outside Local:</strong> The IP address of an outside host as it is known to the internal network.</li>
            <li><strong>Outside Global:</strong> The actual public IP address assigned to an outside host on the public Internet.</li>
        </ul>

        <h3>3. Types of NAT</h3>
        <table style="width:100%; border-collapse:collapse; margin-top:1rem; margin-bottom:1rem; text-align:left;">
            <thead>
                <tr style="border-bottom: 2px solid #E5E7EB;">
                    <th style="padding:0.5rem;">NAT Type</th>
                    <th style="padding:0.5rem;">Mapping Technique</th>
                    <th style="padding:0.5rem;">Typical Use Case</th>
                </tr>
            </thead>
            <tbody>
                <tr style="border-bottom: 1px solid #E5E7EB;">
                    <td style="padding:0.5rem;"><strong>Static NAT (Part 6A)</strong></td>
                    <td style="padding:0.5rem;">One-to-One permanent mapping between an Inside Local IP and an Inside Global IP.</td>
                    <td style="padding:0.5rem;">Web servers, Mail servers, and internal resources that must be reachable from external networks.</td>
                </tr>
                <tr style="border-bottom: 1px solid #E5E7EB;">
                    <td style="padding:0.5rem;"><strong>Dynamic NAT (Part 6B)</strong></td>
                    <td style="padding:0.5rem;">Many-to-Many mapping where inside hosts dynamically acquire an available public IP from a configured NAT pool.</td>
                    <td style="padding:0.5rem;">Corporate outbound user browsing when sufficient public IPv4 addresses are allocated.</td>
                </tr>
                <tr>
                    <td style="padding:0.5rem;"><strong>PAT (NAT Overload)</strong></td>
                    <td style="padding:0.5rem;">Many-to-One mapping using unique Layer 4 port numbers.</td>
                    <td style="padding:0.5rem;">Home/SOHO broadband routers sharing a single public IP among hundreds of devices.</td>
                </tr>
            </tbody>
        </table>

        <h3>4. Static NAT Cisco IOS Commands</h3>
        <pre style="background:#1F2937; color:#10B981; padding:1rem; border-radius:6px; font-size:0.85rem; overflow-x:auto;">Router(config)# interface gigabitethernet 0/0
Router(config-if)# ip nat inside
Router(config-if)# exit

Router(config)# interface serial 0/1/0
Router(config-if)# ip nat outside
Router(config-if)# exit

Router(config)# ip nat inside source static &lt;inside-local-ip&gt; &lt;inside-global-ip&gt;
Router(config)# ip route &lt;dest-network&gt; &lt;mask&gt; &lt;next-hop&gt;</pre>

        <h3>5. Dynamic NAT Cisco IOS Commands</h3>
        <pre style="background:#1F2937; color:#10B981; padding:1rem; border-radius:6px; font-size:0.85rem; overflow-x:auto;">Router(config)# access-list 1 permit 10.0.0.0 0.255.255.255
Router(config)# ip nat pool DYNAT 2.0.0.10 2.0.0.20 netmask 255.0.0.0
Router(config)# ip nat inside source list 1 pool DYNAT
Router(config)# interface gigabitethernet 0/0
Router(config-if)# ip nat inside
Router(config-if)# interface serial 0/1/0
Router(config-if)# ip nat outside</pre>
    `,
    procedure: `
        <h3>Procedure Implementation Specification for Experiment 6</h3>
        <p>This experiment is divided into two distinct configurations:</p>
        <ul>
            <li><strong>Part 6A:</strong> Static NAT Configuration (One-to-One Translation)</li>
            <li><strong>Part 6B:</strong> Dynamic NAT Configuration (ACL and Pool-Based Translation)</li>
        </ul>

        <hr style="margin: 2rem 0; border-color: #374151;">

        <h3>Part 6A: Static NAT Configuration</h3>

        <h4>Step 1: Construct the 6A Topology</h4>
        <p>Place the following devices on the workspace and establish connections:</p>
        <ul>
            <li><strong>Public Side:</strong> PC0 and PC1 connected to Switch0; Switch0 connected to Router0 (G0/0).</li>
            <li><strong>WAN Serial Link:</strong> Router0 (S0/1/0 - DCE) connected via Serial DCE cable to Router1 (S0/1/0 - DTE).</li>
            <li><strong>Private Side:</strong> Router1 (G0/0) connected to Switch1; Switch1 connected to PC2 and Server0.</li>
        </ul>

        <h4>Step 2: Configure IP Addressing for 6A Devices</h4>
        <table style="width:100%; border-collapse:collapse; margin-top:1rem; margin-bottom:1rem; text-align:left;">
            <thead><tr style="border-bottom: 2px solid #E5E7EB;">
                <th style="padding:0.5rem;">Device</th><th style="padding:0.5rem;">Interface</th><th style="padding:0.5rem;">IP Address</th><th style="padding:0.5rem;">Subnet Mask</th><th style="padding:0.5rem;">Default Gateway</th>
            </tr></thead>
            <tbody>
                <tr style="border-bottom: 1px solid #E5E7EB;"><td style="padding:0.5rem;"><strong>PC0</strong></td><td style="padding:0.5rem;">FastEthernet0</td><td style="padding:0.5rem;">20.20.20.1</td><td style="padding:0.5rem;">255.255.255.0</td><td style="padding:0.5rem;">20.20.20.254</td></tr>
                <tr style="border-bottom: 1px solid #E5E7EB;"><td style="padding:0.5rem;"><strong>PC1</strong></td><td style="padding:0.5rem;">FastEthernet0</td><td style="padding:0.5rem;">20.20.20.2</td><td style="padding:0.5rem;">255.255.255.0</td><td style="padding:0.5rem;">20.20.20.254</td></tr>
                <tr style="border-bottom: 1px solid #E5E7EB;"><td style="padding:0.5rem;"><strong>Router0 G0/0</strong></td><td style="padding:0.5rem;">G0/0</td><td style="padding:0.5rem;">20.20.20.254</td><td style="padding:0.5rem;">255.255.255.0</td><td style="padding:0.5rem;">—</td></tr>
                <tr style="border-bottom: 1px solid #E5E7EB;"><td style="padding:0.5rem;"><strong>Router0 S0/1/0</strong></td><td style="padding:0.5rem;">S0/1/0 (DCE)</td><td style="padding:0.5rem;">30.30.30.2</td><td style="padding:0.5rem;">255.255.255.0</td><td style="padding:0.5rem;">— (Clock Rate 64000)</td></tr>
                <tr style="border-bottom: 1px solid #E5E7EB;"><td style="padding:0.5rem;"><strong>Router1 S0/1/0</strong></td><td style="padding:0.5rem;">S0/1/0 (DTE)</td><td style="padding:0.5rem;">30.30.30.3</td><td style="padding:0.5rem;">255.255.255.0</td><td style="padding:0.5rem;">—</td></tr>
                <tr style="border-bottom: 1px solid #E5E7EB;"><td style="padding:0.5rem;"><strong>Router1 G0/0</strong></td><td style="padding:0.5rem;">G0/0</td><td style="padding:0.5rem;">10.10.10.254</td><td style="padding:0.5rem;">255.255.255.0</td><td style="padding:0.5rem;">—</td></tr>
                <tr style="border-bottom: 1px solid #E5E7EB;"><td style="padding:0.5rem;"><strong>PC2</strong></td><td style="padding:0.5rem;">FastEthernet0</td><td style="padding:0.5rem;">10.10.10.1</td><td style="padding:0.5rem;">255.255.255.0</td><td style="padding:0.5rem;">10.10.10.254</td></tr>
                <tr><td style="padding:0.5rem;"><strong>Server0</strong></td><td style="padding:0.5rem;">FastEthernet0</td><td style="padding:0.5rem;">10.10.10.2</td><td style="padding:0.5rem;">255.255.255.0</td><td style="padding:0.5rem;">10.10.10.254</td></tr>
            </tbody>
        </table>

        <h4>Step 3: Configure Static NAT &amp; Routing on Router1</h4>
        <pre style="background:#1F2937; color:#10B981; padding:1rem; border-radius:6px; font-size:0.85rem; overflow-x:auto;">enable
configure terminal
interface gigabitethernet 0/0
ip address 10.10.10.254 255.255.255.0
ip nat inside
no shutdown
exit

interface serial 0/1/0
ip address 30.30.30.3 255.255.255.0
ip nat outside
no shutdown
exit

ip nat inside source static 10.10.10.1 30.30.30.10
ip nat inside source static 10.10.10.2 30.30.30.20
ip route 20.20.20.0 255.255.255.0 30.30.30.2
exit</pre>

        <h4>Step 4: Verify 6A Static NAT</h4>
        <p>From <strong>PC0</strong> (Public), send ICMP Echo requests to the mapped Inside Global addresses:</p>
        <pre style="background:#1F2937; color:#10B981; padding:1rem; border-radius:6px; font-size:0.85rem; overflow-x:auto;">ping 30.30.30.10
ping 30.30.30.20</pre>
        <p>On <strong>Router1</strong>, view the translation table:</p>
        <pre style="background:#1F2937; color:#10B981; padding:1rem; border-radius:6px; font-size:0.85rem; overflow-x:auto;">show ip nat translations</pre>

        <hr style="margin: 2rem 0; border-color: #374151;">

        <h3>Part 6B: Dynamic NAT Configuration</h3>

        <h4>Step 5: Construct the 6B Topology</h4>
        <p>Switch to Mode 6B. Connect:</p>
        <ul>
            <li><strong>Private Side:</strong> PC0 (10.0.0.2) &amp; PC1 (10.0.0.3) &rarr; Switch0 &rarr; Router0 (G0/0).</li>
            <li><strong>WAN Link:</strong> Router0 (S0/1/0 - DCE) &rarr; Router1 (S0/1/0 - DTE).</li>
            <li><strong>Public Side:</strong> Router1 (G0/0) &rarr; Server0 (3.0.0.2).</li>
        </ul>

        <h4>Step 6: Configure Dynamic NAT Pool &amp; ACL on Router0</h4>
        <pre style="background:#1F2937; color:#10B981; padding:1rem; border-radius:6px; font-size:0.85rem; overflow-x:auto;">enable
configure terminal
interface gigabitethernet 0/0
ip address 10.0.0.1 255.0.0.0
ip nat inside
no shutdown
exit

interface serial 0/1/0
ip address 2.0.0.1 255.0.0.0
clock rate 64000
ip nat outside
no shutdown
exit

access-list 1 permit 10.0.0.0 0.255.255.255
ip nat pool DYNAT 2.0.0.10 2.0.0.20 netmask 255.0.0.0
ip nat inside source list 1 pool DYNAT
ip route 3.0.0.0 255.0.0.0 2.0.0.2
exit</pre>

        <h4>Step 7: Verify 6B Dynamic NAT &amp; Debugging</h4>
        <p>Enable NAT debugging on Router0:</p>
        <pre style="background:#1F2937; color:#10B981; padding:1rem; border-radius:6px; font-size:0.85rem; overflow-x:auto;">debug ip nat</pre>
        <p>From <strong>PC0</strong>, ping the outside server:</p>
        <pre style="background:#1F2937; color:#10B981; padding:1rem; border-radius:6px; font-size:0.85rem; overflow-x:auto;">ping 3.0.0.2</pre>
        <p>Inspect translations generated in real time:</p>
        <pre style="background:#1F2937; color:#10B981; padding:1rem; border-radius:6px; font-size:0.85rem; overflow-x:auto;">show ip nat translations
show ip nat statistics</pre>
    `,
    quiz: [
        {
            question: "What is the primary function of Network Address Translation (NAT)?",
            options: [
                "To encrypt network payloads at the transport layer",
                "To translate private IP addresses to public routable IP addresses",
                "To assign dynamic MAC addresses to network interfaces",
                "To automatically establish OSPF adjacencies"
            ],
            correct: 1,
            explanation: "NAT translates private (RFC 1918) IP addresses into globally unique public IP addresses so internal hosts can access the Internet."
        },
        {
            question: "Which Cisco IOS command defines a static NAT mapping between inside local and inside global addresses?",
            options: [
                "ip nat pool STATIC 10.10.10.1 30.30.30.10",
                "ip nat inside source static 10.10.10.1 30.30.30.10",
                "ip nat static translation 10.10.10.1 to 30.30.30.10",
                "ip route 10.10.10.1 255.255.255.255 30.30.30.10"
            ],
            correct: 1,
            explanation: "The command 'ip nat inside source static <local-ip> <global-ip>' configures a permanent 1-to-1 static NAT entry."
        },
        {
            question: "In Cisco NAT terminology, what is an 'Inside Local' address?",
            options: [
                "The public IP address assigned to an internal host by an ISP",
                "The actual private IP address assigned to an end device on the inside network",
                "The IP address of the external web server on the Internet",
                "The loopback IP address of the boundary router"
            ],
            correct: 1,
            explanation: "Inside Local is the private IP address configured on an internal host before translation occurs."
        },
        {
            question: "What is the role of an Access Control List (ACL) in Dynamic NAT configuration?",
            options: [
                "To define the pool of available public IP addresses",
                "To specify which inside local traffic/subnets are permitted to undergo NAT translation",
                "To encrypt DNS requests over the WAN",
                "To set the router interface clock rate"
            ],
            correct: 1,
            explanation: "In Dynamic NAT, a standard ACL (e.g. 'access-list 1 permit 10.0.0.0 0.255.255.255') identifies the internal source IP addresses permitted to be translated."
        },
        {
            question: "Which command shows active NAT translation table entries on a Cisco router?",
            options: [
                "show ip route nat",
                "show ip nat translations",
                "show ip interface brief",
                "show running-config nat"
            ],
            correct: 1,
            explanation: "'show ip nat translations' displays all current active NAT mappings, including protocol, inside local, inside global, and outside destinations."
        },
        {
            question: "What will happen if you forget to configure 'ip nat inside' and 'ip nat outside' on router interfaces?",
            options: [
                "The router will automatically detect interface roles",
                "NAT will not function because the router cannot identify where translation should occur",
                "The router will crash with a memory allocation fault",
                "Only UDP packets will be translated"
            ],
            correct: 1,
            explanation: "The router requires explicit interface boundary markers ('ip nat inside' and 'ip nat outside') to know when incoming/outgoing packets must be translated."
        },
        {
            question: "Which command activates real-time Cisco IOS console output of NAT packet translations?",
            options: [
                "debug ip nat",
                "show ip nat live",
                "terminal monitor nat",
                "log ip nat active"
            ],
            correct: 0,
            explanation: "'debug ip nat' enables real-time diagnostic output showing source/destination IP translations as packets cross the NAT boundary."
        },
        {
            question: "In Dynamic NAT, what happens when all IP addresses in the configured NAT pool are currently in use and another host tries to communicate externally?",
            options: [
                "The packet is automatically routed without translation",
                "The new connection is dropped/timed out unless PAT (overload) is configured",
                "The router converts the address to IPv6",
                "The router steals the IP from the first active host"
            ],
            correct: 1,
            explanation: "In pure Dynamic NAT without overload, if the pool is exhausted, new translation requests are dropped until an existing translation expires."
        },
        {
            question: "What is the command to stop real-time NAT debugging in Cisco IOS?",
            options: [
                "stop debug ip nat",
                "no debug ip nat (or undebug all)",
                "clear ip nat debug",
                "exit debug"
            ],
            correct: 1,
            explanation: "'no debug ip nat' or 'undebug all' (un all) turns off real-time NAT debugging."
        },
        {
            question: "What command creates a Dynamic NAT pool named 'DYNAT' with public IPs 2.0.0.10 to 2.0.0.20?",
            options: [
                "ip nat pool DYNAT 2.0.0.10 2.0.0.20 netmask 255.0.0.0",
                "create nat pool DYNAT start 2.0.0.10 end 2.0.0.20",
                "ip pool DYNAT range 2.0.0.10 2.0.0.20",
                "ip nat inside pool DYNAT 2.0.0.10 2.0.0.20"
            ],
            correct: 0,
            explanation: "'ip nat pool <name> <start-ip> <end-ip> netmask <mask>' defines the allocatable pool of public addresses for dynamic translation."
        }
    ]
};
