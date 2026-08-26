// Packet Animation Simulator

document.addEventListener('DOMContentLoaded', () => {
    // This module handles ping animation for Exp 1.
    // Exp 2 has its own ping animation built into devices.js
    if (document.title.includes('Exercise 2')) return;

    const pingBtn = document.getElementById('send-ping');
    const pingStats = document.getElementById('ping-stats');
    const svgLayer = document.getElementById('connection-layer');
    
    if (!pingBtn || !svgLayer) return;

    let totalSent = 0;
    let totalReceived = 0;
    let totalLost = 0;

    const statSent = document.getElementById('stat-sent');
    const statReceived = document.getElementById('stat-received');
    const statLost = document.getElementById('stat-lost');
    const statRate = document.getElementById('stat-rate');

    pingBtn.addEventListener('click', async () => {
        pingBtn.disabled = true;
        pingStats.style.display = 'block';

        // Reset stats for new run
        totalSent = 0;
        totalReceived = 0;
        totalLost = 0;
        updateStatsUI();

        if (!window.Topology) return;

        // Find Nodes
        let pcId, switchId, routerId;
        for (const id in window.Topology.nodes) {
            const type = window.Topology.nodes[id].type;
            if (type === 'PC') pcId = id;
            if (type === 'Switch') switchId = id;
            if (type === 'Router') routerId = id;
        }

        if (!pcId || !switchId || !routerId) return;

        const pcNode = window.Topology.nodes[pcId];
        const switchNode = window.Topology.nodes[switchId];
        const routerNode = window.Topology.nodes[routerId];

        // Send 5 Packets
        for (let i = 0; i < 5; i++) {
            totalSent++;
            updateStatsUI();
            
            // PC to Switch
            await animatePacket(pcNode, switchNode, false);
            // Switch to Router
            await animatePacket(switchNode, routerNode, false);
            
            totalReceived++;
            updateStatsUI();
            
            // Short pause between packets
            await new Promise(r => setTimeout(r, 400));
        }

        pingBtn.disabled = false;
        
        if (typeof addObservation === 'function') {
            addObservation("Ping Simulation", `Sent: 5, Recv: ${totalReceived}, Lost: ${totalLost}`, totalLost > 0 ? "Warning" : "Success");
        }
    });

    function animatePacket(startNode, endNode, simulateDrop) {
        return new Promise((resolve) => {
            const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            circle.setAttribute('r', '8');
            circle.setAttribute('fill', '#EF4444'); // Red packet
            circle.setAttribute('stroke', '#7F1D1D');
            circle.setAttribute('stroke-width', '2');
            svgLayer.appendChild(circle);

            const duration = 1000; // ms
            const startTime = performance.now();
            
            let targetX = endNode.x;
            let targetY = endNode.y;
            
            if (simulateDrop) {
                targetX = startNode.x + (endNode.x - startNode.x) / 2;
                targetY = startNode.y + (endNode.y - startNode.y) / 2;
            }

            function frame(time) {
                const elapsed = time - startTime;
                const progress = Math.min(elapsed / duration, 1);

                const currentX = startNode.x + (targetX - startNode.x) * progress;
                const currentY = startNode.y + (targetY - startNode.y) * progress;

                circle.setAttribute('cx', currentX);
                circle.setAttribute('cy', currentY);

                if (progress < 1) {
                    requestAnimationFrame(frame);
                } else {
                    if (simulateDrop) {
                        // Visual burst or fade for dropped packet
                        circle.setAttribute('r', '15');
                        circle.setAttribute('fill', 'transparent');
                        circle.setAttribute('stroke', '#EF4444');
                        setTimeout(() => circle.remove(), 200);
                        resolve();
                    } else {
                        circle.remove();
                        resolve();
                    }
                }
            }
            requestAnimationFrame(frame);
        });
    }

    function updateStatsUI() {
        statSent.textContent = totalSent;
        statReceived.textContent = totalReceived;
        statLost.textContent = totalLost;
        
        if (totalSent > 0) {
            const rate = Math.round((totalReceived / totalSent) * 100);
            statRate.textContent = rate + '%';
            statRate.style.color = rate === 100 ? '#059669' : (rate > 50 ? '#D97706' : '#EF4444');
        } else {
            statRate.textContent = '0%';
            statRate.style.color = 'inherit';
        }
    }
});
