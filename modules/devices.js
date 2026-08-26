// Module 4: Device Topology Builder

document.addEventListener('DOMContentLoaded', () => {
    const draggables = document.querySelectorAll('#topo-tools .draggable-item');
    const canvas = document.getElementById('topology-canvas');
    const svgLayer = document.getElementById('connection-layer');
    const checkBtn = document.getElementById('check-topology');
    const resetBtn = document.getElementById('reset-topology');
    const feedback = document.getElementById('topology-feedback');
    const connectModeBtn = document.getElementById('connect-mode-btn');
    const cableTypeSelect = document.getElementById('cable-type-select');

    let draggedItemType = null;
    let draggedItemIcon = null;
    let nodeCount = 0;
    const typeCounters = {}; // { PC: 0, Switch: 0, Router: 0 }
    
    // Graph state
    const nodes = {}; // { id: { element, type, x, y } }
    const edges = []; // { sourceId, targetId, cableType }
    
    window.Topology = { nodes, edges };
    
    let isConnectMode = false;

    // Toggle Connect Mode
    if (connectModeBtn) {
        connectModeBtn.addEventListener('click', () => {
            isConnectMode = !isConnectMode;
            if (isConnectMode) {
                connectModeBtn.style.backgroundColor = 'var(--accent-color)';
                connectModeBtn.innerHTML = `<i data-lucide="mouse-pointer"></i> Enable Move Mode`;
                canvas.style.cursor = 'crosshair';
                if (cableTypeSelect) cableTypeSelect.style.display = 'inline-block';
            } else {
                connectModeBtn.style.backgroundColor = 'var(--secondary-color)';
                connectModeBtn.innerHTML = `<i data-lucide="link"></i> Enable Connect Mode`;
                canvas.style.cursor = 'default';
                if (cableTypeSelect) cableTypeSelect.style.display = 'none';
            }
            if (window.lucide) lucide.createIcons();
        });
    }

    // Make tools draggable
    draggables.forEach(tool => {
        tool.addEventListener('dragstart', (e) => {
            draggedItemType = tool.getAttribute('data-type');
            draggedItemIcon = tool.getAttribute('data-icon');
            e.dataTransfer.setData('text/plain', draggedItemType);
            e.dataTransfer.setData('icon', draggedItemIcon);
        });
    });

    // Make canvas drop target
    if(canvas) {
        canvas.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
        });

        canvas.addEventListener('drop', (e) => {
            e.preventDefault();
            const type = e.dataTransfer.getData('text/plain');
            const icon = e.dataTransfer.getData('icon');
            if (!type) return;

            const rect = canvas.getBoundingClientRect();
            const x = e.clientX - rect.left - 30; 
            const y = e.clientY - rect.top - 30;

            const id = `node-${nodeCount++}`;
            const typeIndex = typeCounters[type] || 0;
            typeCounters[type] = typeIndex + 1;
            const label = `${type}${typeIndex}`;
            const node = document.createElement('div');
            node.className = 'topology-node';
            node.innerHTML = `<img src="assets/icons/${icon}.svg" width="24" height="24" style="margin-bottom: 2px; pointer-events: none;"><br><span style="pointer-events: none;">${label}</span>`;
            node.style.left = `${Math.max(0, Math.min(x, canvas.clientWidth - 60))}px`;
            node.style.top = `${Math.max(0, Math.min(y, canvas.clientHeight - 60))}px`;
            node.id = id;
            
            nodes[id] = { element: node, type: type, label: label, x: x+30, y: y+30, ip: '', subnet: '', gateway: '', dns: '' };
            
            makeNodeInteractive(node, id);
            canvas.appendChild(node);
            
            if (typeof addObservation === 'function') {
                addObservation("Topology Builder", "Added " + type, "Node placed");
            }
        });
    }

    // Drawing temporary line in connect mode
    let drawingLine = null;
    let sourceNodeId = null;

    canvas.addEventListener('mousemove', (e) => {
        if (isConnectMode && drawingLine && sourceNodeId) {
            const rect = canvas.getBoundingClientRect();
            drawingLine.setAttribute('x2', e.clientX - rect.left);
            drawingLine.setAttribute('y2', e.clientY - rect.top);
        }
    });

    canvas.addEventListener('mouseup', () => {
        if (isConnectMode && drawingLine) {
            // Mouse released on empty canvas, cancel drawing
            svgLayer.removeChild(drawingLine);
            drawingLine = null;
            sourceNodeId = null;
        }
    });

    function makeNodeInteractive(node, id) {
        let isDragging = false;
        let startX, startY, initialX, initialY;

        node.addEventListener('mousedown', (e) => {
            if (isConnectMode) {
                // Start drawing line
                e.stopPropagation();
                sourceNodeId = id;
                const rect = canvas.getBoundingClientRect();
                const x1 = nodes[id].x;
                const y1 = nodes[id].y;
                
                drawingLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                drawingLine.setAttribute('x1', x1);
                drawingLine.setAttribute('y1', y1);
                drawingLine.setAttribute('x2', e.clientX - rect.left);
                drawingLine.setAttribute('y2', e.clientY - rect.top);
                drawingLine.setAttribute('stroke', '#005BAC');
                drawingLine.setAttribute('stroke-width', '3');
                
                const currentCable = cableTypeSelect ? cableTypeSelect.value : 'straight';
                if (currentCable === 'crossover') {
                    drawingLine.setAttribute('stroke-dasharray', '5,5');
                    drawingLine.setAttribute('stroke', '#D97706'); // Orange for crossover
                } else if (currentCable === 'console') {
                    drawingLine.setAttribute('stroke-dasharray', '8,4');
                    drawingLine.setAttribute('stroke', '#7C3AED'); // Purple for console
                }
                
                svgLayer.appendChild(drawingLine);
            } else {
                // Move mode
                isDragging = true;
                startX = e.clientX;
                startY = e.clientY;
                initialX = parseInt(node.style.left) || 0;
                initialY = parseInt(node.style.top) || 0;
                node.style.zIndex = 100;
            }
        });
        
        node.addEventListener('dblclick', (e) => {
            e.stopPropagation();
            if ((document.title.includes('Exercise 2') || document.title.includes('Exercise 4')) && nodes[id].type === 'PC') {
                // Open IP Config Modal
                const modal = document.getElementById('ip-config-modal');
                if (modal) {
                    document.getElementById('ip-config-device-name').textContent = `Configuration for ${nodes[id].label || id}`;
                    document.getElementById('ip-address-input').value = nodes[id].ip || '';
                    document.getElementById('subnet-mask-input').value = nodes[id].subnet || '';
                    document.getElementById('gateway-input').value = nodes[id].gateway || '';
                    const dnsEl = document.getElementById('dns-input');
                    if (dnsEl) dnsEl.value = nodes[id].dns || '';
                    document.getElementById('ip-config-error').textContent = '';
                    
                    document.getElementById('save-ip-config').setAttribute('data-node-id', id);
                    modal.style.display = 'flex';
                }
            } else if (document.title.includes('Exercise 3') && nodes[id].type === 'PC') {
                // For Exp 3, double-clicking PC opens the terminal settings modal
                const termBtn = document.getElementById('exp3-open-terminal-btn');
                if (termBtn && termBtn.style.display !== 'none') {
                    termBtn.click();
                }
            } else {
                // Remove node
                node.remove();
                delete nodes[id];
                
                // Remove connected edges
                for (let i = edges.length - 1; i >= 0; i--) {
                    if (edges[i].sourceId === id || edges[i].targetId === id) {
                        edges.splice(i, 1);
                    }
                }
                drawConnections();
            }
        });

        node.addEventListener('mouseup', (e) => {
            if (isConnectMode && drawingLine && sourceNodeId) {
                e.stopPropagation();
                if (sourceNodeId !== id) {
                    // Valid connection created
                    const currentCable = cableTypeSelect ? cableTypeSelect.value : 'straight';

                    // Exp 3: Console cable requires port selection
                    if (document.title.includes('Exercise 3') && currentCable === 'console') {
                        const portModal = document.getElementById('exp3-port-modal');
                        if (portModal) {
                            window.exp3PendingEdge = { sourceId: sourceNodeId, targetId: id, cableType: currentCable };
                            portModal.style.display = 'flex';
                            const errEl = document.getElementById('exp3-port-error');
                            if (errEl) errEl.textContent = '';
                        }
                    } else {
                        edges.push({ sourceId: sourceNodeId, targetId: id, cableType: currentCable });
                        if (typeof addObservation === 'function') {
                            addObservation("Topology Cabling", "Connected " + nodes[sourceNodeId].type + " to " + nodes[id].type + " (" + currentCable + ")", "Success");
                        }
                    }
                }
                // Cleanup temp line and redraw all permanent edges
                if(svgLayer.contains(drawingLine)) {
                    svgLayer.removeChild(drawingLine);
                }
                drawingLine = null;
                sourceNodeId = null;
                drawConnections();
            }
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            
            let newX = initialX + dx;
            let newY = initialY + dy;
            
            newX = Math.max(0, Math.min(newX, canvas.clientWidth - 60));
            newY = Math.max(0, Math.min(newY, canvas.clientHeight - 60));

            node.style.left = `${newX}px`;
            node.style.top = `${newY}px`;
            
            // Update node center coordinates
            nodes[id].x = newX + 30;
            nodes[id].y = newY + 30;
            
            drawConnections();
        });

        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                node.style.zIndex = '';
            }
        });
    }

    function drawConnections() {
        if (!svgLayer) return;
        svgLayer.innerHTML = '';
        
        edges.forEach(edge => {
            const n1 = nodes[edge.sourceId];
            const n2 = nodes[edge.targetId];
            
            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('x1', n1.x);
            line.setAttribute('y1', n1.y);
            line.setAttribute('x2', n2.x);
            line.setAttribute('y2', n2.y);
            line.setAttribute('stroke-width', '3');
            
            if (edge.cableType === 'crossover') {
                line.setAttribute('stroke', '#D97706');
                line.setAttribute('stroke-dasharray', '5,5');
            } else if (edge.cableType === 'console') {
                line.setAttribute('stroke', '#7C3AED');
                line.setAttribute('stroke-dasharray', '8,4');
            } else if (edge.cableType === 'serial') {
                line.setAttribute('stroke', '#DC2626');
                line.setAttribute('stroke-dasharray', '6,3');
                line.setAttribute('stroke-width', '4');
            } else {
                line.setAttribute('stroke', '#005BAC');
            }
            
            line.style.cursor = 'pointer';
            line.addEventListener('click', () => {
                // Remove line on click
                const index = edges.indexOf(edge);
                if (index > -1) {
                    edges.splice(index, 1);
                    drawConnections();
                }
            });
            
            svgLayer.appendChild(line);
        });
    }

    // IP Config Modal Logic
    const ipModal = document.getElementById('ip-config-modal');
    if (ipModal) {
        document.getElementById('close-ip-config').addEventListener('click', () => {
            ipModal.style.display = 'none';
        });
        document.getElementById('save-ip-config').addEventListener('click', () => {
            const id = document.getElementById('save-ip-config').getAttribute('data-node-id');
            const ip = document.getElementById('ip-address-input').value.trim();
            const subnet = document.getElementById('subnet-mask-input').value.trim();
            const gateway = document.getElementById('gateway-input').value.trim();
            const dns = document.getElementById('dns-input') ? document.getElementById('dns-input').value.trim() : '';
            
            const ipRegex = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/;
            if (!ip || !ipRegex.test(ip)) {
                document.getElementById('ip-config-error').textContent = 'Invalid IP Address format.';
                return;
            }
            if (!subnet || !ipRegex.test(subnet)) {
                document.getElementById('ip-config-error').textContent = 'Invalid Subnet Mask format.';
                return;
            }
            
            nodes[id].ip = ip;
            nodes[id].subnet = subnet;
            nodes[id].gateway = gateway;
            nodes[id].dns = dns;
            
            ipModal.style.display = 'none';
            if (typeof addObservation === 'function') addObservation("IP Config", `Configured ${id} with IP ${ip}`, "Success");
        });
    }

    if(checkBtn) {
        checkBtn.addEventListener('click', () => {
            feedback.style.color = 'var(--text-main)';
            const pingBtn = document.getElementById('send-ping');
            if (pingBtn) pingBtn.style.display = 'none';

            if (document.title.includes('Exercise 2')) {
                // Exp 2 Validation (P2P or LAN)
                let pcs = [], switches = [], routers = [];
                Object.keys(nodes).forEach(k => {
                    if (nodes[k].type === 'PC') pcs.push(k);
                    if (nodes[k].type === 'Switch') switches.push(k);
                    if (nodes[k].type === 'Router') routers.push(k);
                });
                
                const getEdge = (id1, id2) => edges.find(e => (e.sourceId === id1 && e.targetId === id2) || (e.sourceId === id2 && e.targetId === id1));
                
                if (pcs.length === 2 && switches.length === 0 && routers.length === 0) {
                    const edge = getEdge(pcs[0], pcs[1]);
                    if (!edge) {
                        feedback.style.color = '#EF4444';
                        feedback.textContent = 'Devices are not physically connected.';
                        return;
                    }
                    if (edge.cableType !== 'crossover') {
                        feedback.style.color = '#EF4444';
                        feedback.textContent = 'Incorrect cable selected for PC-to-PC connection. (Requires Crossover)';
                        return;
                    }
                    if (!nodes[pcs[0]].ip || !nodes[pcs[1]].ip) {
                        feedback.style.color = '#EF4444';
                        feedback.textContent = 'IP addresses not configured. Double-click the PCs to set their IPs.';
                        return;
                    }
                    if (nodes[pcs[0]].subnet !== nodes[pcs[1]].subnet) {
                        feedback.style.color = '#EF4444';
                        feedback.textContent = 'Devices belong to different subnets.';
                        return;
                    }
                    
                    feedback.style.color = '#059669';
                    feedback.textContent = 'Topology and IP Configuration Correct! Ready to ping.';
                    if (pingBtn) pingBtn.style.display = 'inline-block';
                    window.exp2PingData = { targetIp: nodes[pcs[1]].ip, sourceId: pcs[0], targetId: pcs[1] };
                    
                } else if (pcs.length === 2 && switches.length === 1 && routers.length === 0) {
                    const edge1 = getEdge(pcs[0], switches[0]);
                    const edge2 = getEdge(pcs[1], switches[0]);
                    
                    if (!edge1 || !edge2) {
                        feedback.style.color = '#EF4444';
                        feedback.textContent = 'Devices are not physically connected correctly to the Switch.';
                        return;
                    }
                    if (edge1.cableType !== 'straight' || edge2.cableType !== 'straight') {
                        feedback.style.color = '#EF4444';
                        feedback.textContent = 'Incorrect cable selected. Connecting a PC to a Switch requires a Straight-Through cable.';
                        return;
                    }
                    if (!nodes[pcs[0]].ip || !nodes[pcs[1]].ip) {
                        feedback.style.color = '#EF4444';
                        feedback.textContent = 'IP addresses not configured. Double-click the PCs to set their IPs.';
                        return;
                    }
                    if (nodes[pcs[0]].subnet !== nodes[pcs[1]].subnet) {
                        feedback.style.color = '#EF4444';
                        feedback.textContent = 'Devices belong to different subnets.';
                        return;
                    }
                    
                    feedback.style.color = '#059669';
                    feedback.textContent = 'Topology and IP Configuration Correct! Ready to ping.';
                    if (pingBtn) pingBtn.style.display = 'inline-block';
                    window.exp2PingData = { targetIp: nodes[pcs[1]].ip, sourceId: pcs[0], targetId: pcs[1], switchId: switches[0] };
                } else {
                    feedback.style.color = '#EF4444';
                    feedback.textContent = 'Topology incorrect. Build either a P2P network (2 PCs) or a Simple LAN (2 PCs + 1 Switch).';
                }
            } else if (document.title.includes('Exercise 3') || document.title.includes('Exercise 4')) {
                // Exp 3/4 Validation
                // This block just prevents the Exp 1 fallback from running.
                // Let the experiment-specific handler take over (it listens to the same click).
                return;
            } else {
                // Exp 1 Validation
                let pcId = null, switchId = null, routerId = null;
                Object.keys(nodes).forEach(k => {
                    if(nodes[k].type === 'PC') pcId = k;
                    if(nodes[k].type === 'Switch') switchId = k;
                    if(nodes[k].type === 'Router') routerId = k;
                });
    
                if (!pcId || !switchId || !routerId) {
                    feedback.style.color = 'var(--text-main)';
                    feedback.textContent = 'Please place at least a PC, a Switch, and a Router on the canvas.';
                    return;
                }
    
                const getEdge = (id1, id2) => {
                    return edges.find(e => (e.sourceId === id1 && e.targetId === id2) || (e.sourceId === id2 && e.targetId === id1));
                };
    
                const pcToSwitchEdge = getEdge(pcId, switchId);
                const switchToRouterEdge = getEdge(switchId, routerId);
                const pcToRouterEdge = getEdge(pcId, routerId);
    
                if (pcToSwitchEdge && switchToRouterEdge && !pcToRouterEdge) {
                    if (pcToSwitchEdge.cableType === 'straight' && switchToRouterEdge.cableType === 'straight') {
                        feedback.style.color = '#059669';
                        feedback.textContent = 'Excellent! You successfully cabled a basic LAN. (PC ↔ Switch ↔ Router) using correct Straight-through cables.';
                        if (typeof addObservation === 'function') addObservation("Topology Checker", "Verified connections", "Success");
                        
                        if (pingBtn) pingBtn.style.display = 'inline-block';
                        
                        if (typeof PlatformManager !== 'undefined' && !document.getElementById('crimp-pinout')) {
                            PlatformManager.markCompleted(1, 100);
                        }
                    } else {
                        feedback.style.color = '#D97706';
                        feedback.textContent = 'Connections are correct, but wrong cable types used! PC to Switch and Switch to Router both require Straight-Through cables.';
                        if (typeof addObservation === 'function') addObservation("Topology Checker", "Verified connections", "Wrong Cables");
                    }
                } else {
                    feedback.style.color = '#EF4444';
                    feedback.textContent = 'Topology incorrect. Connect the PC to the Switch, and the Switch to the Router.';
                    if (typeof addObservation === 'function') addObservation("Topology Checker", "Verified connections", "Failed");
                }
            }
        });
    }

    // Realistic Ping simulation for Exp 2
    const pingBtn = document.getElementById('send-ping');
    if (pingBtn && document.title.includes('Exercise 2')) {
        // Remove old listeners that might interfere (if packet-animation.js is removed, this handles it cleanly)
        const newPingBtn = pingBtn.cloneNode(true);
        pingBtn.parentNode.replaceChild(newPingBtn, pingBtn);
        
        function animatePingPacket(sourceNode, targetNode, switchNode = null) {
            return new Promise((resolve) => {
                const svgLayer = document.getElementById('connection-layer');
                if (!svgLayer) { resolve(); return; }
                
                const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                circle.setAttribute('r', '8');
                circle.setAttribute('fill', '#EF4444'); 
                circle.setAttribute('stroke', '#7F1D1D');
                circle.setAttribute('stroke-width', '2');
                svgLayer.appendChild(circle);

                const duration = switchNode ? 400 : 800; // faster if it stops at switch
                
                function moveDot(start, end) {
                    return new Promise(res => {
                        const startTime = performance.now();
                        function frame(time) {
                            const elapsed = time - startTime;
                            const progress = Math.min(elapsed / duration, 1);
                            circle.setAttribute('cx', start.x + (end.x - start.x) * progress);
                            circle.setAttribute('cy', start.y + (end.y - start.y) * progress);
                            if (progress < 1) requestAnimationFrame(frame);
                            else res();
                        }
                        requestAnimationFrame(frame);
                    });
                }
                
                (async function() {
                    if (switchNode) {
                        await moveDot(sourceNode, switchNode);
                        await moveDot(switchNode, targetNode);
                        // Return trip
                        await moveDot(targetNode, switchNode);
                        await moveDot(switchNode, sourceNode);
                    } else {
                        await moveDot(sourceNode, targetNode);
                        // Return trip
                        await moveDot(targetNode, sourceNode);
                    }
                    circle.remove();
                    resolve();
                })();
            });
        }

        newPingBtn.addEventListener('click', async () => {
            const pingStats = document.getElementById('ping-stats');
            if (!pingStats) return;
            
            newPingBtn.disabled = true;
            pingStats.style.display = 'block';
            pingStats.innerHTML = `C:\\> ping ${window.exp2PingData.targetIp}\n\nPinging ${window.exp2PingData.targetIp} with 32 bytes of data:\n`;
            
            const sNode = nodes[window.exp2PingData.sourceId];
            const tNode = nodes[window.exp2PingData.targetId];
            const swNode = window.exp2PingData.switchId ? nodes[window.exp2PingData.switchId] : null;

            for (let count = 1; count <= 4; count++) {
                // Wait for the animation to complete
                await animatePingPacket(sNode, tNode, swNode);
                pingStats.innerHTML += `Reply from ${window.exp2PingData.targetIp}: bytes=32 time<1ms TTL=128\n`;
                pingStats.scrollTop = pingStats.scrollHeight;
            }
            
            setTimeout(() => {
                pingStats.innerHTML += `\nPing statistics for ${window.exp2PingData.targetIp}:\n`;
                pingStats.innerHTML += `    Packets: Sent = 4, Received = 4, Lost = 0 (0% loss),\n`;
                pingStats.innerHTML += `Approximate round trip times in milli-seconds:\n`;
                pingStats.innerHTML += `    Minimum = 0ms, Maximum = 0ms, Average = 0ms\n\nC:\\> `;
                pingStats.scrollTop = pingStats.scrollHeight;
                newPingBtn.disabled = false;
                if (typeof PlatformManager !== 'undefined') PlatformManager.markCompleted(3, 100);
                if (typeof addObservation === 'function') addObservation("Ping Simulation", "Ping Successful", "Success");
            }, 500);
        });
    }

    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            // Clear nodes
            Object.keys(nodes).forEach(id => {
                nodes[id].element.remove();
                delete nodes[id];
            });
            // Clear edges
            edges.length = 0;
            drawConnections();
            
            feedback.textContent = '';
            
            const pingBtn = document.getElementById('send-ping');
            if (pingBtn) pingBtn.style.display = 'none';
            
            const pingStats = document.getElementById('ping-stats');
            if (pingStats) pingStats.style.display = 'none';
        });
    }
});
