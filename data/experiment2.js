const experimentData = {
    aim: "Exercise 2: Cabling – Straight Through and Cross-over Cabling",
    objectives: [
        "Understand the physical difference between Straight-through and Crossover cables and why each exists.",
        "Learn the specific wire color pin configurations for T568A and T568B standards.",
        "Determine which cable type is required when connecting different types of network devices.",
        "Demonstrate a Peer-to-Peer (P2P) network using a Crossover cable.",
        "Demonstrate a Simple LAN using Straight-Through cables and a Switch.",
        "Configure IP addresses, Subnet Mask, and Default Gateway on network devices.",
        "Use the Ping command to verify successful logical connectivity between two configured devices."
    ],
    theory: `
        <p style="background:#EFF6FF; padding:0.85rem 1rem; border-radius:8px; border-left:4px solid #3B82F6; margin-bottom:1.5rem;">
            <strong>🌐 Real-World Context:</strong> In a real office, plugging the wrong cable between two computers means zero communication — no shared files, no internet, nothing. This experiment teaches you exactly which cable to use, why it works that way, and how to verify the connection with real network commands.
        </p>

        <h3>1. Ethernet Cable & the RJ-45 Connector</h3>
        <p>An <strong>Ethernet cable</strong> is the physical wire used to connect computers, switches, and routers in a wired network. At each end it has an <strong>RJ-45 connector</strong> — it looks exactly like a telephone plug but wider (8 pins instead of 4).</p>
        <p>Inside the cable are <strong>8 thin copper wires</strong> twisted into 4 pairs. The twisting is intentional — it cancels out electrical interference between neighbouring wires (called <em>crosstalk</em>), keeping the signal clean over longer distances.</p>

        <div style="display:flex; gap:1.5rem; margin:1rem 0; flex-wrap:wrap;">
            <div style="flex:1; min-width:180px; background:#F8FAFC; border:1px solid #E2E8F0; border-radius:8px; padding:1rem;">
                <h4 style="margin:0 0 0.5rem; color:#6B7280;">📞 RJ-11 (Phone Jack)</h4>
                <p style="margin:0; font-size:0.9rem;">4 pins. Used for telephone lines only. <em>Too small for network use.</em></p>
            </div>
            <div style="flex:1; min-width:180px; background:#EFF6FF; border:2px solid #3B82F6; border-radius:8px; padding:1rem;">
                <h4 style="margin:0 0 0.5rem; color:#1D4ED8;">🖥️ RJ-45 (Network Jack)</h4>
                <p style="margin:0; font-size:0.9rem;">8 pins. Used for all Ethernet network cables (Cat5, Cat5e, Cat6). <em>This is what we use in this experiment.</em></p>
            </div>
        </div>
        <p>The order in which those 8 wires are inserted into the RJ-45 connector is called the <strong>pinout</strong>. Getting the pinout right is critical — a single wire in the wrong slot and the cable won't carry data.</p>

        <h3>2. Straight-Through Cable</h3>
        <p>A <strong>straight-through cable</strong> has the <em>exact same wire arrangement</em> on both ends. Pin 1 connects to Pin 1, Pin 2 to Pin 2, and so on all the way to Pin 8. This is the most common cable you'll find in offices, schools, and data centres.</p>

        <div style="background:#F0FDF4; border-left:4px solid #059669; border-radius:6px; padding:0.85rem 1rem; margin:0.75rem 0 1rem;">
            <strong>💡 The Tx/Rx Analogy (Understanding WHY it works):</strong><br>
            Think of Pins 1 &amp; 2 as the device's <em>"mouth"</em> (Transmit / Tx) and Pins 3 &amp; 6 as its <em>"ears"</em> (Receive / Rx).<br><br>
            When you connect <strong>unlike devices</strong> (e.g., PC to Switch), their mouths and ears naturally align — the PC's Tx pins connect directly to the Switch's Rx pins. A straight wire is all you need.
        </div>

        <p>Use a straight-through cable for <strong>unlike devices</strong>:</p>
        <ul style="margin-left:2rem; margin-bottom:1rem;">
            <li>PC → Switch <em>(most common scenario in a LAN)</em></li>
            <li>PC → Hub</li>
            <li>Switch → Router</li>
            <li>Hub → Router</li>
        </ul>

        <p>There are two wiring standards — both produce a valid straight-through cable; they just use different colour arrangements:</p>

        <div style="display:flex; gap:1.5rem; margin:1rem 0 0.5rem; flex-wrap:wrap;">
            <div style="flex:1; min-width:200px; background:#F8FAFC; padding:1rem; border-radius:8px; border:2px solid #10B981;">
                <h4 style="margin-top:0; color:#059669;">T568A — Color Code</h4>
                <p style="font-size:0.8rem; color:#6B7280; margin-bottom:0.5rem;">Common in US government &amp; home wiring</p>
                <ol style="margin-left:1.5rem; line-height:1.9;">
                    <li><span style="color:#10B981;">●</span> Green-White</li>
                    <li><span style="color:#10B981;">●</span> Green</li>
                    <li><span style="color:#F97316;">●</span> Orange-White</li>
                    <li><span style="color:#3B82F6;">●</span> Blue</li>
                    <li><span style="color:#3B82F6;">●</span> Blue-White</li>
                    <li><span style="color:#F97316;">●</span> Orange</li>
                    <li><span style="color:#8B5A2B;">●</span> Brown-White</li>
                    <li><span style="color:#8B5A2B;">●</span> Brown</li>
                </ol>
            </div>
            <div style="flex:1; min-width:200px; background:#F8FAFC; padding:1rem; border-radius:8px; border:2px solid #F97316;">
                <h4 style="margin-top:0; color:#F97316;">T568B — Color Code</h4>
                <p style="font-size:0.8rem; color:#6B7280; margin-bottom:0.5rem;">Most widely used worldwide in offices &amp; enterprise</p>
                <ol style="margin-left:1.5rem; line-height:1.9;">
                    <li><span style="color:#F97316;">●</span> Orange-White</li>
                    <li><span style="color:#F97316;">●</span> Orange</li>
                    <li><span style="color:#10B981;">●</span> Green-White</li>
                    <li><span style="color:#3B82F6;">●</span> Blue</li>
                    <li><span style="color:#3B82F6;">●</span> Blue-White</li>
                    <li><span style="color:#10B981;">●</span> Green</li>
                    <li><span style="color:#8B5A2B;">●</span> Brown-White</li>
                    <li><span style="color:#8B5A2B;">●</span> Brown</li>
                </ol>
            </div>
        </div>
        <p style="background:#EFF6FF; padding:0.75rem 1rem; border-radius:6px; border-left:4px solid #3B82F6; margin-top:0.5rem;">
            <strong>Key Difference:</strong> T568A has <span style="color:#059669;"><strong>Green</strong></span> wires on Pins 1 &amp; 2. T568B has <span style="color:#F97316;"><strong>Orange</strong></span> wires on Pins 1 &amp; 2. Both ends must use the <em>same</em> standard for a straight-through cable — never mix them!
        </p>

        <h3>3. Crossover Cable</h3>
        <p>A <strong>crossover cable</strong> has <strong>T568A on one end</strong> and <strong>T568B on the other end</strong>. This deliberately "crosses" the transmit wires of one device into the receive wires of the other.</p>

        <div style="background:#FFF7ED; border-left:4px solid #F97316; border-radius:6px; padding:0.85rem 1rem; margin:0.75rem 0 1rem;">
            <strong>💡 Why crossing is needed:</strong><br>
            When two <strong>like devices</strong> (e.g., PC to PC) connect, <em>both are "talking" on pins 1 &amp; 2</em>. Their signals collide and neither hears the other. The crossover solves this by redirecting Device A's Transmit wire to Device B's Receive pins — and vice versa:
            <pre style="background:#1F2937; color:#F9A8D4; padding:0.75rem; border-radius:6px; font-size:0.85rem; margin-top:0.75rem; overflow-x:auto;">PC-A  Pin 1 (Tx) ──────────────── Pin 3 (Rx)  PC-B
PC-A  Pin 2 (Tx) ──────────────── Pin 6 (Rx)  PC-B
PC-A  Pin 3 (Rx) ──────────────── Pin 1 (Tx)  PC-B
PC-A  Pin 6 (Rx) ──────────────── Pin 2 (Tx)  PC-B</pre>
        </div>

        <p>Use a crossover cable for <strong>like devices</strong> (same type of equipment):</p>
        <ul style="margin-left:2rem; margin-bottom:1rem;">
            <li>PC → PC <em>(creates a direct Point-to-Point / P2P network)</em></li>
            <li>Switch → Switch</li>
            <li>Hub → Hub</li>
            <li>Router → Router</li>
        </ul>

        <h3>4. Device Connectivity Rules</h3>
        <p>Quick rule: <strong>Same type = Crossover &nbsp;|&nbsp; Different types = Straight-Through</strong></p>
        <div style="display:flex; gap:1.5rem; margin-bottom:0.75rem; flex-wrap:wrap;">
            <span style="background:#FEE2E2; color:#991B1B; padding:0.3rem 0.75rem; border-radius:20px; font-size:0.875rem; font-weight:600;">🔴 Red = Crossover</span>
            <span style="background:#D1FAE5; color:#065F46; padding:0.3rem 0.75rem; border-radius:20px; font-size:0.875rem; font-weight:600;">🟢 Green = Straight-Through</span>
        </div>
        <table style="width:100%; border-collapse:collapse; margin-bottom:1.5rem;">
            <tr style="background:#E5E7EB;"><th style="padding:0.5rem 0.75rem; text-align:left; border:1px solid #CBD5E1;">Devices</th><th style="padding:0.5rem; border:1px solid #CBD5E1;">Hub</th><th style="padding:0.5rem; border:1px solid #CBD5E1;">Switch</th><th style="padding:0.5rem; border:1px solid #CBD5E1;">Router</th><th style="padding:0.5rem; border:1px solid #CBD5E1;">PC</th></tr>
            <tr><td style="padding:0.5rem 0.75rem; border:1px solid #CBD5E1;"><strong>Hub</strong></td><td style="padding:0.5rem; border:1px solid #CBD5E1; color:#DC2626; font-weight:600; text-align:center;">Crossover</td><td style="padding:0.5rem; border:1px solid #CBD5E1; color:#DC2626; font-weight:600; text-align:center;">Crossover</td><td style="padding:0.5rem; border:1px solid #CBD5E1; color:#059669; font-weight:600; text-align:center;">Straight</td><td style="padding:0.5rem; border:1px solid #CBD5E1; color:#059669; font-weight:600; text-align:center;">Straight</td></tr>
            <tr style="background:#F9FAFB;"><td style="padding:0.5rem 0.75rem; border:1px solid #CBD5E1;"><strong>Switch</strong></td><td style="padding:0.5rem; border:1px solid #CBD5E1; color:#DC2626; font-weight:600; text-align:center;">Crossover</td><td style="padding:0.5rem; border:1px solid #CBD5E1; color:#DC2626; font-weight:600; text-align:center;">Crossover</td><td style="padding:0.5rem; border:1px solid #CBD5E1; color:#059669; font-weight:600; text-align:center;">Straight</td><td style="padding:0.5rem; border:1px solid #CBD5E1; color:#059669; font-weight:600; text-align:center;">Straight</td></tr>
            <tr><td style="padding:0.5rem 0.75rem; border:1px solid #CBD5E1;"><strong>Router</strong></td><td style="padding:0.5rem; border:1px solid #CBD5E1; color:#059669; font-weight:600; text-align:center;">Straight</td><td style="padding:0.5rem; border:1px solid #CBD5E1; color:#059669; font-weight:600; text-align:center;">Straight</td><td style="padding:0.5rem; border:1px solid #CBD5E1; color:#DC2626; font-weight:600; text-align:center;">Crossover</td><td style="padding:0.5rem; border:1px solid #CBD5E1; color:#DC2626; font-weight:600; text-align:center;">Crossover</td></tr>
            <tr style="background:#F9FAFB;"><td style="padding:0.5rem 0.75rem; border:1px solid #CBD5E1;"><strong>PC</strong></td><td style="padding:0.5rem; border:1px solid #CBD5E1; color:#059669; font-weight:600; text-align:center;">Straight</td><td style="padding:0.5rem; border:1px solid #CBD5E1; color:#059669; font-weight:600; text-align:center;">Straight</td><td style="padding:0.5rem; border:1px solid #CBD5E1; color:#DC2626; font-weight:600; text-align:center;">Crossover</td><td style="padding:0.5rem; border:1px solid #CBD5E1; color:#DC2626; font-weight:600; text-align:center;">Crossover</td></tr>
        </table>

        <h3>5. IP Address</h3>
        <p>An <strong>IP Address</strong> (Internet Protocol Address) is a unique number assigned to every device on a network — like a postal address for your computer. Without it, the network has no idea where to deliver data.</p>
        <p>A standard IPv4 address looks like <code style="background:#F1F5F9; padding:2px 6px; border-radius:4px;">192.168.10.1</code> — four groups of numbers (each 0–255) separated by dots. The first groups identify the <em>network</em>, the last group identifies the <em>specific device</em>.</p>

        <h3>6. Subnet Mask</h3>
        <p>A <strong>Subnet Mask</strong> tells a device which part of the IP address is the network and which part is the device. The most common value is <code style="background:#F1F5F9; padding:2px 6px; border-radius:4px;">255.255.255.0</code>.</p>
        <p>Two devices can only communicate <strong>directly</strong> if they are on the same network (same subnet). Think of it like a city and house number — two houses can only be on the same street if they share the same city.</p>

        <h3>7. Default Gateway</h3>
        <p>The <strong>Default Gateway</strong> is the IP address of your router — the "exit door" from your local network to the rest of the world. When your computer wants to reach a website or a device on a different network, it sends the data to the gateway first, which then forwards it.</p>
        <p style="background:#FFFBEB; border-left:4px solid #D97706; border-radius:6px; padding:0.75rem 1rem; margin:0.5rem 0;">
            <strong>⚠️ Important:</strong> For two devices on the <em>same</em> local network (LAN), no gateway is needed to ping each other. The gateway only matters for reaching <strong>other networks or the internet</strong>.
        </p>

        <div style="background:#F8FAFC; border:1px solid #E2E8F0; border-radius:8px; padding:1rem; margin:1rem 0 1.5rem;">
            <h4 style="margin:0 0 0.75rem; color:#1E293B;">📋 Unified Real-Office Example — Two PCs on the Same LAN</h4>
            <table style="width:100%; border-collapse:collapse; font-size:0.9rem;">
                <tr style="background:#E5E7EB;"><th style="padding:0.4rem 0.75rem; text-align:left; border:1px solid #CBD5E1;">Setting</th><th style="padding:0.4rem 0.75rem; border:1px solid #CBD5E1;">PC1</th><th style="padding:0.4rem 0.75rem; border:1px solid #CBD5E1;">PC2</th></tr>
                <tr><td style="padding:0.4rem 0.75rem; border:1px solid #CBD5E1;">IP Address</td><td style="padding:0.4rem 0.75rem; border:1px solid #CBD5E1; font-family:monospace;">192.168.1.10</td><td style="padding:0.4rem 0.75rem; border:1px solid #CBD5E1; font-family:monospace;">192.168.1.20</td></tr>
                <tr style="background:#F9FAFB;"><td style="padding:0.4rem 0.75rem; border:1px solid #CBD5E1;">Subnet Mask</td><td style="padding:0.4rem 0.75rem; border:1px solid #CBD5E1; font-family:monospace;">255.255.255.0</td><td style="padding:0.4rem 0.75rem; border:1px solid #CBD5E1; font-family:monospace;">255.255.255.0</td></tr>
                <tr><td style="padding:0.4rem 0.75rem; border:1px solid #CBD5E1;">Default Gateway</td><td style="padding:0.4rem 0.75rem; border:1px solid #CBD5E1; font-family:monospace;">192.168.1.1</td><td style="padding:0.4rem 0.75rem; border:1px solid #CBD5E1; font-family:monospace;">192.168.1.1</td></tr>
            </table>
            <p style="font-size:0.875rem; margin:0.75rem 0 0; color:#374151;">✅ Both PCs share the same subnet (192.168.1.x) so they can ping each other directly. The gateway (192.168.1.1) is only used to reach websites on the internet.</p>
        </div>

        <h3>8. Ping Command</h3>
        <p><strong>Ping</strong> is the most fundamental network diagnostic tool. It sends a small test packet (<strong>ICMP Echo Request</strong>) to a target device and waits for a reply (<strong>ICMP Echo Reply</strong>). If a reply comes back, the two devices can communicate.</p>
        <p>On Windows, open Command Prompt and type: <code style="background:#F1F5F9; padding:2px 6px; border-radius:4px;">ping 192.168.1.20</code></p>

        <div style="display:flex; gap:1.5rem; margin:0.75rem 0; flex-wrap:wrap;">
            <div style="flex:1; min-width:240px;">
                <p style="font-weight:600; color:#059669; margin-bottom:0.4rem;">✅ Successful Ping</p>
                <pre style="background:#1F2937; color:#10B981; padding:1rem; border-radius:6px; font-size:0.82rem; margin:0; overflow-x:auto;">C:\\> ping 192.168.1.20

Pinging 192.168.1.20 with 32 bytes of data:
Reply from 192.168.1.20: bytes=32 time&lt;1ms TTL=128
Reply from 192.168.1.20: bytes=32 time&lt;1ms TTL=128
Reply from 192.168.1.20: bytes=32 time&lt;1ms TTL=128
Reply from 192.168.1.20: bytes=32 time&lt;1ms TTL=128

Ping statistics for 192.168.1.20:
  Packets: Sent=4, Received=4, Lost=0 (0% loss)</pre>
            </div>
            <div style="flex:1; min-width:240px;">
                <p style="font-weight:600; color:#DC2626; margin-bottom:0.4rem;">❌ Failed Ping</p>
                <pre style="background:#1F2937; color:#EF4444; padding:1rem; border-radius:6px; font-size:0.82rem; margin:0; overflow-x:auto;">C:\\> ping 192.168.1.20

Pinging 192.168.1.20 with 32 bytes of data:
Request timed out.
Request timed out.
Request timed out.
Request timed out.

Ping statistics for 192.168.1.20:
  Packets: Sent=4, Received=0, Lost=4 (100% loss)</pre>
            </div>
        </div>
        <div style="background:#FFF1F2; border-left:4px solid #DC2626; border-radius:6px; padding:0.75rem 1rem; margin-top:0.75rem;">
            <strong>🔧 If you see "Request timed out", check:</strong>
            <ol style="margin:0.5rem 0 0 1.5rem; font-size:0.9rem;">
                <li>Is the correct cable type selected? (Crossover for PC-PC, Straight for PC-Switch)</li>
                <li>Are both PCs on the same subnet? (First 3 numbers of IP must match)</li>
                <li>Are both PCs physically connected in the topology?</li>
            </ol>
        </div>
        <p style="background:#F0FDF4; padding:0.75rem 1rem; border-radius:6px; border-left:4px solid #059669; margin-top:0.75rem;">
            <strong>What the numbers mean:</strong> <em>TTL=128</em> means the packet came from a Windows device (Windows uses TTL 128 by default). <em>time&lt;1ms</em> means the reply came back in under 1 millisecond — an excellent, healthy connection.
        </p>

        <h3>9. IPConfig Command</h3>
        <p><strong>ipconfig</strong> is a Windows command that shows the current network configuration of your computer. It's the first thing a network technician checks when troubleshooting.</p>
        <p>Type <code style="background:#F1F5F9; padding:2px 6px; border-radius:4px;">ipconfig</code> in Command Prompt to see your IP Address, Subnet Mask, and Default Gateway:</p>
        <pre style="background:#1F2937; color:#93C5FD; padding:1rem; border-radius:6px; font-size:0.85rem; overflow-x:auto;">C:\\> ipconfig

Windows IP Configuration

Ethernet adapter Local Area Connection:

   Connection-specific DNS Suffix  . :
   IPv4 Address. . . . . . . . . . . : 192.168.1.10
   Subnet Mask . . . . . . . . . . . : 255.255.255.0
   Default Gateway . . . . . . . . . : 192.168.1.1

C:\\></pre>
        <p>In this experiment, you will manually enter these values into the IP Configuration panel for each PC in the topology builder — simulating how a network administrator configures a small office network from scratch.</p>
    `,
    procedure: `
        <ol style="line-height:2;">
            <li>
                <strong>Read the Theory:</strong> Go to the Theory tab. Focus on sections 2 and 3 (Straight-Through vs Crossover) and section 4 (the device connectivity table). Understanding <em>why</em> each cable exists will make the simulation much easier.
            </li>
            <li>
                <strong>Module 1 — Cable Pin Configuration:</strong> In the Simulation tab, drag and drop the coloured wires into the correct RJ-45 pin slots for T568A, T568B, or Crossover.
                <ul style="margin-top:0.4rem; margin-left:1.5rem; font-size:0.9rem; color:#374151;">
                    <li>Select the cable standard from the dropdown before dragging.</li>
                    <li>Click <em>Crimp Connector</em> to check your work — incorrect pins will be highlighted.</li>
                    <li>Use <em>Show Correct Pinout</em> if you're stuck.</li>
                </ul>
            </li>
            <li>
                <strong>Module 2 — Device Connectivity Quiz:</strong> Identify the correct cable for each randomly generated device-pair scenario. Read the explanation shown after each answer — it reinforces the "why".
            </li>
            <li>
                <strong>Module 3A — Build a P2P Network:</strong>
                <ul style="margin-top:0.4rem; margin-left:1.5rem; font-size:0.9rem; color:#374151;">
                    <li>Drag <strong>2 PCs</strong> onto the canvas.</li>
                    <li>Enable <em>Connect Mode</em> and select <strong>Crossover</strong> cable.</li>
                    <li>Click the first PC, then the second PC to draw a connection.</li>
                    <li>Double-click each PC to open the IP Config panel. Enter:<br>
                        PC1: IP <code>192.168.10.1</code>, Mask <code>255.255.255.0</code><br>
                        PC2: IP <code>192.168.10.2</code>, Mask <code>255.255.255.0</code>
                    </li>
                    <li>Click <em>Check Topology</em> to validate.</li>
                </ul>
                <p style="background:#FFFBEB; border-left:3px solid #D97706; padding:0.5rem 0.75rem; border-radius:4px; font-size:0.875rem; margin-top:0.5rem;">
                    ⚠️ <strong>Common Mistake:</strong> If you choose Straight-Through here, the validation will fail. PC-to-PC always needs a Crossover cable!
                </p>
            </li>
            <li>
                <strong>Module 3B — Build a Simple LAN:</strong> Reset the canvas, then drag <strong>2 PCs + 1 Switch</strong> onto the canvas.
                <ul style="margin-top:0.4rem; margin-left:1.5rem; font-size:0.9rem; color:#374151;">
                    <li>Enable Connect Mode and select <strong>Straight-Through</strong> cable.</li>
                    <li>Connect PC1 → Switch and PC2 → Switch.</li>
                    <li>Double-click each PC to configure IP addresses on the <strong>same subnet</strong> (e.g., 192.168.10.1 and 192.168.10.2).</li>
                    <li>Click <em>Check Topology</em> to validate.</li>
                </ul>
                <p style="background:#FFFBEB; border-left:3px solid #D97706; padding:0.5rem 0.75rem; border-radius:4px; font-size:0.875rem; margin-top:0.5rem;">
                    ⚠️ <strong>Common Mistake:</strong> Using IPs from different subnets (e.g., 192.168.<strong>10</strong>.1 and 192.168.<strong>20</strong>.1) will fail the ping check even if cables are correct!
                </p>
            </li>
            <li>
                <strong>Verify with Ping:</strong> Once topology is validated, a <em>Send Ping</em> button will appear. Click it to watch the red packet travel across the connection and read the terminal output.
                <p style="background:#EFF6FF; border-left:3px solid #3B82F6; padding:0.5rem 0.75rem; border-radius:4px; font-size:0.875rem; margin-top:0.5rem;">
                    💡 <strong>Pro Tip:</strong> If the ping animation doesn't appear, click <em>Check Topology</em> once more before pressing Send Ping.
                </p>
            </li>
            <li>
                <strong>Check Observations:</strong> Go to the Observation tab — every action you took in the simulation is logged there automatically, including timestamps and results.
            </li>
            <li><strong>Complete the Quiz</strong> to test your understanding and generate your certificate.</li>
        </ol>
    `,
    result: "Thus the implementation of Peer-to-Peer (P2P) Network and Local Area Network (LAN) using the correct cabling standards (Crossover and Straight-Through) is done successfully.",
    quiz: [
        {
            question: "Which pins are crossed over in a Crossover cable?",
            options: ["Pins 1 & 2 with Pins 3 & 4", "Pins 1 & 2 with Pins 3 & 6", "Pins 4 & 5 with Pins 7 & 8", "All 8 pins are crossed"],
            answer: 1,
            explanation: "In a crossover cable, the Transmit (Tx) pins 1 & 2 on one end are wired to the Receive (Rx) pins 3 & 6 on the other — this is what makes devices 'hear' each other instead of talking over one another."
        },
        {
            question: "Which cable should you use to connect a PC directly to another PC?",
            options: ["Straight-through", "Crossover", "Console", "Serial"],
            answer: 1,
            explanation: "PC to PC are like devices — both transmit on pins 1 & 2 and receive on pins 3 & 6. A Crossover cable is needed to redirect PC-A's transmit to PC-B's receive, and vice versa."
        },
        {
            question: "Which cable is used to connect a Switch to a Router?",
            options: ["Straight-through", "Crossover", "Fiber Optic", "Coaxial"],
            answer: 0,
            explanation: "A Switch and a Router are unlike devices — their transmit and receive pins are already opposite. A Straight-through cable connects them correctly without any crossing needed."
        },
        {
            question: "In the T568B standard, what color wire is on Pin 1?",
            options: ["Green-White", "Orange-White", "Blue", "Brown-White"],
            answer: 1,
            explanation: "T568B starts with Orange-White on Pin 1. This is the key difference from T568A, which starts with Green-White on Pin 1. Everything else (Blue, Brown pairs) is the same."
        },
        {
            question: "PC1 has IP 192.168.10.5 and PC2 has IP 192.168.20.5. Both have Subnet Mask 255.255.255.0. They are connected with a Crossover cable. PC1 cannot ping PC2. What is the problem?",
            options: [
                "The Crossover cable should be a Straight-Through cable",
                "PC1 and PC2 are on different subnets (192.168.10.x vs 192.168.20.x)",
                "A switch is required between them",
                "The Subnet Mask is wrong"
            ],
            answer: 1,
            explanation: "The cable is correct (Crossover for PC-to-PC). The problem is the IPs: 192.168.10.x and 192.168.20.x are different subnets. Both PCs must share the same network prefix (e.g., both on 192.168.10.x) to communicate directly."
        }
    ]
};
