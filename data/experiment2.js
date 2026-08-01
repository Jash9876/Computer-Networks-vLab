const experimentData = {
    aim: "Exercise 2: Cabling – Straight Through and Cross-over Cabling",
    objectives: [
        "Understand the difference between Straight-through and Crossover cables.",
        "Learn the specific pin configurations (T568A and T568B).",
        "Determine which cable to use when connecting different network devices."
    ],
    theory: `
        <h3>1. Ethernet Cable</h3>
        <p>An Ethernet cable is a network cable used for high-speed wired network connections between two devices. It consists of twisted pair conductors and uses an RJ45 connector.</p>

        <h3>2. Straight Through Cable</h3>
        <p>A straight-through cable has the same pin out at each end (Pin 1 to Pin 1, Pin 2 to Pin 2, etc.). It is in accordance with either the T568A or T568B standards. It is used to connect unlike devices, such as a computer to a network hub or switch.</p>

        <h3>3. Crossover Cable</h3>
        <p>In a crossover cable, Pin 1 is crossed with Pin 3, and Pin 2 is crossed with Pin 6. The internal wiring reverses the transmission and receive signals. It is widely used to connect two devices of the same type (e.g., two computers or two switches to each other).</p>
        
        <h3>4. Devices Connectivity</h3>
        <table>
            <tr><th>Devices</th><th>Hub</th><th>Switch</th><th>Router</th><th>PC</th></tr>
            <tr><td>Hub</td><td>Crossover</td><td>Crossover</td><td>Straight</td><td>Straight</td></tr>
            <tr><td>Switch</td><td>Crossover</td><td>Crossover</td><td>Straight</td><td>Straight</td></tr>
            <tr><td>Router</td><td>Straight</td><td>Straight</td><td>Crossover</td><td>Crossover</td></tr>
            <tr><td>PC</td><td>Straight</td><td>Straight</td><td>Crossover</td><td>Crossover</td></tr>
        </table>
    `,
    procedure: `
        <ol>
            <li>Review the Theory tab to understand pinouts and device connectivity.</li>
            <li>In the Simulation tab, use the <strong>Cable Pinout Module</strong> to match the correct wires for Straight-through vs Crossover cables.</li>
            <li>Use the <strong>Device Connectivity Module</strong> to select the appropriate cable for different device pairs.</li>
            <li>Record your observations.</li>
            <li>Complete the Quiz to generate your certificate.</li>
        </ol>
    `,
    quiz: [
        {
            question: "Which pins are crossed over in a Crossover cable?",
            options: ["1 and 2, 3 and 4", "1 and 3, 2 and 6", "4 and 5, 7 and 8", "All pins are crossed"],
            answer: 1,
            explanation: "In a crossover cable, Transmit (Tx) pins 1 and 2 are crossed to Receive (Rx) pins 3 and 6."
        },
        {
            question: "Which cable should you use to connect a PC directly to another PC?",
            options: ["Straight-through", "Crossover", "Console", "Serial"],
            answer: 1,
            explanation: "Like devices (PC to PC) transmit and receive on the same pins, so a Crossover cable is needed to swap Tx and Rx."
        },
        {
            question: "Which cable is used to connect a Switch to a Router?",
            options: ["Straight-through", "Crossover", "Fiber", "Coaxial"],
            answer: 0,
            explanation: "A Switch and a Router are unlike devices in terms of port function, so a Straight-through cable is used."
        }
    ]
};
