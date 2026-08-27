// Authoritative Server-Side Quiz Answer Keys for Experiments 1–5
// Eliminates client score spoofing

const QUIZ_ANSWER_KEYS = {
    // Experiment 1: Study of Network Cables, Network Commands & PT UI (4 Questions)
    1: [
        { id: 0, correctIndex: 2 }, // CLI
        { id: 1, correctIndex: 2 }, // ICMP
        { id: 2, correctIndex: 3 }, // Fiber Optic
        { id: 3, correctIndex: 2 }  // Layer 3 (Network)
    ],

    // Experiment 2: Study of IP Addressing & Cable Pinout Construction (5 Questions)
    2: [
        { id: 0, correctIndex: 2 }, // T568A: W-G, G, W-O, Bl, W-Bl, O, W-Br, Br
        { id: 1, correctIndex: 1 }, // Crossover
        { id: 2, correctIndex: 2 }, // Class C /24
        { id: 3, correctIndex: 2 }, // Same subnet / Direct IP
        { id: 4, correctIndex: 1 }  // Straight-Through
    ],

    // Experiment 3: Router Configuration Through a Console (5 Questions)
    3: [
        { id: 0, correctIndex: 2 }, // RS-232 / RJ-45 Rollover Console Cable
        { id: 1, correctIndex: 1 }, // 9600-8-N-1
        { id: 2, correctIndex: 2 }, // line con 0
        { id: 3, correctIndex: 1 }, // no shutdown
        { id: 4, correctIndex: 2 }  // copy running-config startup-config
    ],

    // Experiment 4: Design of Subnet IP Addressing in Packet Tracer (5 Questions)
    4: [
        { id: 0, correctIndex: 1 }, // 255.255.255.224 (/27)
        { id: 1, correctIndex: 2 }, // 30 usable hosts per subnet
        { id: 2, correctIndex: 1 }, // 192.168.10.32
        { id: 3, correctIndex: 2 }, // DCE (Data Communications Equipment)
        { id: 4, correctIndex: 1 }  // Next-Hop Serial IP of Neighbor Router
    ],

    // Experiment 5: Demonstration of Static and Default Routing (10 Questions)
    5: [
        { id: 0, correctIndex: 1 }, // 192.168.10.127
        { id: 1, correctIndex: 1 }, // 192.168.10.96/27 network is not directly connected to Router0
        { id: 2, correctIndex: 2 }, // 192.168.10.66
        { id: 3, correctIndex: 1 }, // Statically configured route with Administrative Distance 1
        { id: 4, correctIndex: 1 }, // Echo Reply packet dropped at Router1
        { id: 5, correctIndex: 1 }, // ip route 0.0.0.0 0.0.0.0 192.168.10.66
        { id: 6, correctIndex: 0 }, // Stub router single exit path
        { id: 7, correctIndex: 1 }, // Ping reachability vs traceroute intermediate hops
        { id: 8, correctIndex: 1 }, // clock rate 64000 timing synchronization
        { id: 9, correctIndex: 1 }  // S* candidate default route
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

    if (Array.isArray(userAnswers)) {
        userAnswers.forEach(ans => {
            const match = key.find(k => k.id === ans.questionIndex);
            if (match && match.correctIndex === ans.selectedIndex) {
                earnedScore++;
            }
        });
    }

    const percentage = Math.round((earnedScore / totalQuestions) * 100);
    const passed = percentage >= 70;

    return {
        earnedScore,
        totalQuestions,
        percentage,
        passed
    };
}

module.exports = {
    QUIZ_ANSWER_KEYS,
    evaluateServerQuiz
};
