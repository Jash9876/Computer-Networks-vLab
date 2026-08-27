const experimentData = {
    aim: "To understand the basics of Packet Tracer, Networking commands and Study of different types of cables",
    objectives: [
        "Learn how to use Cisco Packet Tracer to simulate real networks.",
        "Familiarize with the benefits and UI of Packet Tracer (Physical, Config, CLI, Desktop, Services).",
        "Understand essential networking commands (ping, traceroute, arp, netstat, etc.).",
        "Study different types of network cables (BNC, RJ-11, RJ-45, Fiber Optic, UTP, Coaxial) and color codes.",
        "Identify and understand basic network devices (Repeater, Hub, Switch, Bridge, Router, Gateway)."
    ],
    theory: `
        <h3>1. Introduction to Packet Tracer</h3>
        <p>Cisco Packet Tracer is a free application that enables you to practice network configuration and troubleshooting on your desktop or laptop computer. It enables you to mimic networks without having physical access to the underlying hardware.</p>
        <p><strong>Benefits:</strong> It is intended to familiarize you with the network simulation and visualization tool. You will learn about the many sorts of PT files and simulate real networks.</p>
        <h4>UI Tabs:</h4>
        <ul>
            <li><strong>Physical Tab:</strong> Interacting with the device including powering it on or off or installing different modules.</li>
            <li><strong>Config Tab:</strong> GUI to configure basic settings without command line knowledge.</li>
            <li><strong>CLI Tab:</strong> Provides access to the command line interface of a Cisco device.</li>
            <li><strong>Desktop Tab:</strong> For end devices (PCs/laptops), provides IP configuration, wireless configuration, command prompt, and web browser.</li>
            <li><strong>Services Tab:</strong> For servers, to configure common processes such as HTTP, DHCP, DNS.</li>
        </ul>

        <h3>2. Networking Commands</h3>
        <p>Essential network commands include:</p>
        <ul>
            <li><strong>Ping:</strong> Checks connectivity and latency using ICMP protocol.</li>
            <li><strong>Traceroute (tracert):</strong> Shows the traveling path of a package through our network.</li>
            <li><strong>Arp:</strong> Views the ARP table mappings between IP address and MAC address.</li>
            <li><strong>Netstat:</strong> Identifies all TCP connections and UDP open on a machine.</li>
            <li><strong>SSH:</strong> Allows running terminals on remote machines safely.</li>
            <li><strong>Curl / wget:</strong> Used to do HTTP, HTTPS or FTP requests to remote servers.</li>
        </ul>

        <h3>3. Study of Cables</h3>
        <ul>
            <li><strong>BNC:</strong> British Naval Connector used with coaxial cables.</li>
            <li><strong>RJ-11:</strong> Registered jack 11, used on modern telephone lines.</li>
            <li><strong>RJ-45:</strong> 8-wire connector used to connect computers to cat5 unshielded twisted pair cables.</li>
            <li><strong>Fiber Optic:</strong> Uses light to transmit information across a network. Core is made of glass.</li>
            <li><strong>UTP:</strong> Unshielded Twisted-Pair Cable consisting of up to 4 pairs of wires.</li>
            <li><strong>Coaxial:</strong> Copper wire surrounded by plastic, metal mesh, and protective plastic.</li>
        </ul>

        <h3>4. Network Devices</h3>
        <p>Devices include <strong>Repeater</strong> (Layer 1), <strong>Hub</strong> (Layer 1), <strong>Switch</strong> (Layer 2), <strong>Bridge</strong> (Layer 2), <strong>Router</strong> (Layer 3), and <strong>Gateway</strong> (Protocol translation).</p>
    `,
    procedure: `
        <ol>
            <li>Navigate to the <strong>Simulation</strong> tab from the sidebar.</li>
            <li><strong>Module 1:</strong> Explore the Packet Tracer UI by clicking on different areas of the mock window.</li>
            <li><strong>Module 2:</strong> Use the Terminal Simulator to enter commands like <code>ping google.com</code> or <code>arp -a</code> and observe the output.</li>
            <li><strong>Module 3:</strong> Test your knowledge of cables by dragging the correct cable name to its description.</li>
            <li><strong>Module 4:</strong> Build a basic logical network topology by dragging a PC, Switch, and Router onto the canvas, then verify it.</li>
            <li>Record your observations in the <strong>Observation</strong> tab.</li>
            <li>Finally, take the <strong>Quiz</strong> to test your understanding.</li>
        </ol>
    `,
    quiz: [
        {
            question: "Which tab in Packet Tracer provides a command line interface for Cisco devices?",
            options: ["Physical", "Config", "CLI", "Desktop"],
            answer: 2, // 0-indexed, so 2 = "CLI"
            explanation: "The CLI (Command Line Interface) tab provides direct command-line access to Cisco devices."
        },
        {
            question: "What protocol does the 'ping' command use to determine connectivity?",
            options: ["TCP", "UDP", "ICMP", "HTTP"],
            answer: 2,
            explanation: "Ping uses the ICMP (Internet Control Message Protocol) echo request and reply messages."
        },
        {
            question: "Which cable uses light to transmit information across a network?",
            options: ["UTP", "Coaxial", "RJ-45", "Fiber Optic"],
            answer: 3,
            explanation: "Fiber Optic cables use light signals (photons) over a glass or plastic core to transmit data."
        },
        {
            question: "At which OSI layer does a Router operate?",
            options: ["Layer 1 (Physical)", "Layer 2 (Data Link)", "Layer 3 (Network)", "Layer 4 (Transport)"],
            answer: 2,
            explanation: "A router operates at Layer 3 (Network Layer), using IP addresses to route packets between networks."
        },
        {
            question: "Which command displays the current IP-to-MAC address mapping table on a device?",
            options: ["ipconfig /all", "arp -a", "tracert 8.8.8.8", "netstat -r"],
            answer: 1,
            explanation: "The 'arp -a' command displays the Address Resolution Protocol (ARP) table, which maps Layer 3 IP addresses to Layer 2 physical MAC addresses."
        }
    ]
};
