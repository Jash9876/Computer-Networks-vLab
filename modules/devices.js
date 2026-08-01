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
            const node = document.createElement('div');
            node.className = 'topology-node';
            node.innerHTML = `<img src="assets/icons/${icon}.svg" width="24" height="24" style="margin-bottom: 2px; pointer-events: none;"><br><span style="pointer-events: none;">${type}</span>`;
            node.style.left = `${Math.max(0, Math.min(x, canvas.clientWidth - 60))}px`;
            node.style.top = `${Math.max(0, Math.min(y, canvas.clientHeight - 60))}px`;
            node.id = id;
            
            nodes[id] = { element: node, type: type, x: x+30, y: y+30 };
            
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
        });

        node.addEventListener('mouseup', (e) => {
            if (isConnectMode && drawingLine && sourceNodeId) {
                e.stopPropagation();
                if (sourceNodeId !== id) {
                    // Valid connection created
                    const currentCable = cableTypeSelect ? cableTypeSelect.value : 'straight';
                    edges.push({ sourceId: sourceNodeId, targetId: id, cableType: currentCable });
                    if (typeof addObservation === 'function') {
                        addObservation("Topology Cabling", "Connected " + nodes[sourceNodeId].type + " to " + nodes[id].type + " (" + currentCable + ")", "Success");
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

    if(checkBtn) {
        checkBtn.addEventListener('click', () => {
            // We need a PC connected to a Switch, and Switch connected to Router
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
                // Verify cables
                if (pcToSwitchEdge.cableType === 'straight' && switchToRouterEdge.cableType === 'straight') {
                    feedback.style.color = '#059669';
                    feedback.textContent = 'Excellent! You successfully cabled a basic LAN. (PC ↔ Switch ↔ Router) using correct Straight-through cables.';
                    if (typeof addObservation === 'function') addObservation("Topology Checker", "Verified connections", "Success");
                    
                    // Reveal Send Ping button
                    const pingBtn = document.getElementById('send-ping');
                    if (pingBtn) pingBtn.style.display = 'inline-block';
                    
                    // Mark global completion for Exp 1
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
