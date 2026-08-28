// Authoritative Server-Side Quiz Answer Keys for Experiments 1–5
// Eliminates client score spoofing

const QUIZ_ANSWER_KEYS = {
    // Experiment 1: Study of Network Cables, Network Commands & PT UI (5 Questions)
    1: [
        { id: 0, correctIndex: 2 }, // CLI tab
        { id: 1, correctIndex: 2 }, // ICMP
        { id: 2, correctIndex: 3 }, // Fiber Optic
        { id: 3, correctIndex: 2 }, // Layer 3 (Network)
        { id: 4, correctIndex: 1 }  // arp -a (IP-to-MAC mapping)
    ],

    // Experiment 2: Study of IP Addressing & Cable Pinout Construction (5 Questions)
    2: [
        { id: 0, correctIndex: 1 }, // Pins 1 & 2 with Pins 3 & 6
        { id: 1, correctIndex: 1 }, // Crossover (PC to PC)
        { id: 2, correctIndex: 0 }, // Straight-through (Switch to Router)
        { id: 3, correctIndex: 1 }, // Orange-White (T568B Pin 1)
        { id: 4, correctIndex: 1 }  // Different subnets (192.168.10.x vs 192.168.20.x)
    ],

    // Experiment 3: Router Configuration Through a Console (5 Questions)
    3: [
        { id: 0, correctIndex: 1 }, // Initial configuration when no network connectivity exists
        { id: 1, correctIndex: 2 }, // RS232 (Serial)
        { id: 2, correctIndex: 2 }, // 9600 bps
        { id: 3, correctIndex: 1 }, // Running-config in RAM, startup-config in NVRAM
        { id: 4, correctIndex: 1 }  // Enables the interface (no shutdown)
    ],

    // Experiment 4: Design of Subnet IP Addressing in Packet Tracer (5 Questions)
    4: [
        { id: 0, correctIndex: 1 }, // Act as default gateway for devices in that network
        { id: 1, correctIndex: 2 }, // 255.255.255.224 (/27)
        { id: 2, correctIndex: 1 }, // 30 usable hosts
        { id: 3, correctIndex: 1 }, // DCE (Data Circuit-terminating Equipment)
        { id: 4, correctIndex: 0 }  // Destination Network, Subnet Mask, and Next-Hop IP
    ],

    // Experiment 5: Demonstration of Static and Default Routing (5 Questions)
    5: [
        { id: 0, correctIndex: 1 }, // 192.168.10.127
        { id: 1, correctIndex: 1 }, // 192.168.10.96/27 network is not directly connected to Router0
        { id: 2, correctIndex: 2 }, // 192.168.10.66
        { id: 3, correctIndex: 1 }, // Statically configured route with Administrative Distance 1
        { id: 4, correctIndex: 1 }  // ip route 0.0.0.0 0.0.0.0 192.168.10.66
    ],

    // Experiment 6: Configuration of Network Address Translation (NAT) (10 Questions)
    6: [
        { id: 0, correctIndex: 1 }, // Translate private IP addresses to public routable IP addresses
        { id: 1, correctIndex: 1 }, // ip nat inside source static <local-ip> <global-ip>
        { id: 2, correctIndex: 1 }, // Actual private IP assigned to end device on inside
        { id: 3, correctIndex: 1 }, // Specify which inside local traffic is permitted to undergo NAT
        { id: 4, correctIndex: 1 }, // show ip nat translations
        { id: 5, correctIndex: 1 }, // NAT will not function without inside/outside markers
        { id: 6, correctIndex: 0 }, // debug ip nat
        { id: 7, correctIndex: 1 }, // New connection is dropped/timed out
        { id: 8, correctIndex: 1 }, // no debug ip nat (or undebug all)
        { id: 9, correctIndex: 0 }  // ip nat pool DYNAT 2.0.0.10 2.0.0.20 netmask 255.0.0.0
    ]
};

/**
 * Evaluates student answers against the authoritative server-side answer key
 * @param {number} experimentId 
 * @param {Array<{questionIndex: number, selectedIndex: number}>} userAnswers 
 * @returns {{ earnedScore: number, totalQuestions: number, percentage: number, passed: boolean }}
 */
function evaluateServerQuiz(experimentId, userAnswers) {
    const key = QUIZ_ANSWER_KEYS[experimentId];
    if (!key) {
        throw new Error(`No answer key defined for Experiment ${experimentId}`);
    }

    const totalQuestions = key.length;
    let earnedScore = 0;
    const details = [];

    if (Array.isArray(userAnswers)) {
        userAnswers.forEach(ans => {
            const match = key.find(k => k.id === ans.questionIndex);
            const isCorrect = match && match.correctIndex === ans.selectedIndex;
            if (isCorrect) {
                earnedScore++;
            }
            if (match) {
                details.push({
                    questionIndex: ans.questionIndex,
                    correct: !!isCorrect,
                    correctIndex: match.correctIndex
                });
            }
        });
    }

    const percentage = Math.round((earnedScore / totalQuestions) * 100);
    const passed = percentage >= 70;

    return {
        earnedScore,
        totalQuestions,
        percentage,
        passed,
        details
    };
}

module.exports = {
    QUIZ_ANSWER_KEYS,
    evaluateServerQuiz
};
