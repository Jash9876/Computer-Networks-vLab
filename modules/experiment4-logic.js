// modules/experiment4-logic.js
// Complete Logic Engine for Experiment 4:
// - Exercise 4-A: Configuration of IP Address in Router
// - Exercise 4-B: Subnetting in WAN Configuration (DTE & DCE)
// Strictly follows Cisco IOS behavior: Static routing ONLY (no RIP), HWIC-2T module simulation,
// user-calculated static route validation, and Cisco prompt execution.

document.addEventListener('DOMContentLoaded', function () {
    'use strict';

    // ─────────────────────────────────────────────────────────────
    // 1. STATE MANAGEMENT
    // ─────────────────────────────────────────────────────────────
    let currentPart = 'A'; // 'A' or 'B'

    // Topology Graphs (local to Part A and Part B)
    const topoA = { nodes: {}, edges: [], counters: { PC: 0, Router: 0 } };
    const topoB = { nodes: {}, edges: [], counters: { PC: 0, Router: 0 } };

    // Router State Machines
    // Part A Router0
    const router4A = {
        hostname: 'Router0',
        cliMode: 'user_exec', // 'user_exec' | 'priv_exec' | 'global_config' | 'if_config'
        cliInterface: null,
        history: [],
        historyIndex: -1,
        interfaces: {
            'GigabitEthernet0/0': { ip: '', mask: '', state: 'down' },
            'GigabitEthernet0/1': { ip: '', mask: '', state: 'down' }
        }
    };

    // Part B Dual Routers
    let activeRouterKey4B = 'R0'; // 'R0' or 'R1'
    const router4B = {
        R0: {
            hostname: 'Router0',
            cliMode: 'user_exec',
            cliInterface: null,
            history: [],
            historyIndex: -1,
            hwicInstalled: false,
            powerOn: true,
            interfaces: {
                'GigabitEthernet0/0': { ip: '', mask: '', state: 'down' },
                'GigabitEthernet0/1': { ip: '', mask: '', state: 'down' },
                'Serial0/1/0':        { ip: '', mask: '', state: 'down', clockRate: 0, role: 'DCE' }
            },
            routes: [] // { network, mask, nextHop }
        },
        R1: {
            hostname: 'Router1',
            cliMode: 'user_exec',
            cliInterface: null,
            history: [],
            historyIndex: -1,
            hwicInstalled: false,
            powerOn: true,
            interfaces: {
                'GigabitEthernet0/0': { ip: '', mask: '', state: 'down' },
                'GigabitEthernet0/1': { ip: '', mask: '', state: 'down' },
                'Serial0/1/0':        { ip: '', mask: '', state: 'down', clockRate: 0, role: 'DTE' }
            },
            routes: []
        }
    };

    // Milestone completion tracker
    const achievedMilestones = new Set();

    function reportMilestone(milestoneId) {
        if (!achievedMilestones.has(milestoneId)) {
            achievedMilestones.add(milestoneId);
            if (typeof window.addObservation === 'function') {
                window.addObservation('Experiment 4', `Milestone: ${milestoneId}`, 'Verified');
            }
            updateResultText();
        }
    }

    // ─────────────────────────────────────────────────────────────
    // 2. HELPER FUNCTIONS
    // ─────────────────────────────────────────────────────────────
    function normaliseIf(raw) {
        if (!raw) return null;
        const s = String(raw).trim().toLowerCase().replace(/\s+/g, ' ');
        if (/^(?:gigabitethernet\s*(?:gi|g)?\s*0\/0|(?:gi|g)\s*0\/0|0\/0)$/i.test(s)) return 'GigabitEthernet0/0';
        if (/^(?:gigabitethernet\s*(?:gi|g)?\s*0\/1|(?:gi|g)\s*0\/1|0\/1)$/i.test(s)) return 'GigabitEthernet0/1';
        if (/^(?:serial\s*(?:se|s)?\s*0\/1\/0|(?:se|s)\s*0\/1\/0|0\/1\/0)$/i.test(s)) return 'Serial0/1/0';
        return null;
    }

    function calculateNetwork(ipStr, maskStr) {
        if (!ipStr || !maskStr) return '';
        const ipParts = ipStr.split('.').map(Number);
        const maskParts = maskStr.split('.').map(Number);
        if (ipParts.length !== 4 || maskParts.length !== 4) return '';
        return ipParts.map((p, i) => p & maskParts[i]).join('.');
    }

    function getPartPrompt(part, routerKey) {
        if (part === 'A') {
            const h = router4A.hostname;
            switch (router4A.cliMode) {
                case 'user_exec':     return `${h}>`;
                case 'priv_exec':     return `${h}#`;
                case 'global_config': return `${h}(config)#`;
                case 'if_config':     return `${h}(config-if)#`;
                default:              return `${h}>`;
            }
        } else {
            const r = router4B[routerKey];
            const h = r.hostname;
            switch (r.cliMode) {
                case 'user_exec':     return `${h}>`;
                case 'priv_exec':     return `${h}#`;
                case 'global_config': return `${h}(config)#`;
                case 'if_config':     return `${h}(config-if)#`;
                default:              return `${h}>`;
            }
        }
    }

    function printTerminal(termOutput, text) {
        if (!termOutput) return;
        termOutput.textContent += text + '\n';
        termOutput.scrollTop = termOutput.scrollHeight;
    }

    // ─────────────────────────────────────────────────────────────
    // 3. TAB NAVIGATION (EXERCISE 4-A vs 4-B)
    // ─────────────────────────────────────────────────────────────
    const navBtns = document.querySelectorAll('.exp4-nav-btn');
    const partACont = document.getElementById('exp4-part-a');
    const partBCont = document.getElementById('exp4-part-b');
    const resetBtn = document.getElementById('exp4-reset-btn');

    function switchPart(part) {
        currentPart = part;
        navBtns.forEach(btn => {
            const bPart = btn.getAttribute('data-part');
            if (bPart === part) {
                btn.style.backgroundColor = 'var(--primary-color)';
                btn.style.color = 'white';
            } else {
                btn.style.backgroundColor = 'var(--secondary-color)';
                btn.style.color = 'white';
            }
        });

        if (part === 'A') {
            if (partACont) partACont.style.display = 'block';
            if (partBCont) partBCont.style.display = 'none';
            window.Topology = topoA;
        } else {
            if (partACont) partACont.style.display = 'none';
            if (partBCont) partBCont.style.display = 'block';
            window.Topology = topoB;
        }
    }

    navBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const p = btn.getAttribute('data-part');
            if (p) switchPart(p);
        });
    });

    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            if (confirm('Reset all progress in Experiment 4? Canvas, CLI configurations, and routes will be cleared.')) {
                location.reload();
            }
        });
    }

    // ─────────────────────────────────────────────────────────────
    // 4. CANVAS DND & WIRING ENGINE (Part A and Part B isolated)
    // ─────────────────────────────────────────────────────────────
    function setupCanvas(partPrefix, topoState, is4B) {
        const canvas = document.getElementById(`topology-canvas-${partPrefix}`);
        const svgLayer = document.getElementById(`connection-layer-${partPrefix}`);
        const connectBtn = document.getElementById(`connect-mode-btn-${partPrefix}`);
        const cableSelect = document.getElementById(`cable-type-select-${partPrefix}`);
        const checkBtn = document.getElementById(`check-topology-${partPrefix}`);
        const resetCanvasBtn = document.getElementById(`reset-topology-${partPrefix}`);
        const feedback = document.getElementById(`topology-feedback-${partPrefix}`);
        const toolPc = document.getElementById(`node-pc-${partPrefix}`);
        const toolRouter = document.getElementById(`node-router-${partPrefix}`);

        let isConnectMode = false;
        let selectedNodeForConnect = null;

        function drawConnections() {
            if (!svgLayer) return;
            svgLayer.innerHTML = '';
            topoState.edges.forEach(edge => {
                const n1 = topoState.nodes[edge.sourceId];
                const n2 = topoState.nodes[edge.targetId];
                if (!n1 || !n2) return;

                const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                line.setAttribute('x1', n1.x);
                line.setAttribute('y1', n1.y);
                line.setAttribute('x2', n2.x);
                line.setAttribute('y2', n2.y);

                if (edge.cableType === 'crossover') {
                    line.setAttribute('stroke', '#D97706');
                    line.setAttribute('stroke-dasharray', '6,4');
                    line.setAttribute('stroke-width', '3');
                } else if (edge.cableType === 'serial') {
                    line.setAttribute('stroke', '#DC2626');
                    line.setAttribute('stroke-dasharray', '8,4');
                    line.setAttribute('stroke-width', '4');
                } else {
                    line.setAttribute('stroke', '#005BAC');
                    line.setAttribute('stroke-width', '3');
                }

                line.style.cursor = 'pointer';
                line.addEventListener('click', () => {
                    const idx = topoState.edges.indexOf(edge);
                    if (idx > -1) {
                        topoState.edges.splice(idx, 1);
                        drawConnections();
                    }
                });
                svgLayer.appendChild(line);
            });
        }

        if (connectBtn) {
            connectBtn.addEventListener('click', () => {
                isConnectMode = !isConnectMode;
                if (isConnectMode) {
                    connectBtn.style.backgroundColor = 'var(--accent-color)';
                    connectBtn.innerHTML = '<i data-lucide="mouse-pointer"></i> Enable Move Mode';
                    canvas.style.cursor = 'crosshair';
                } else {
                    connectBtn.style.backgroundColor = 'var(--secondary-color)';
                    connectBtn.innerHTML = '<i data-lucide="link"></i> Enable Connect Mode';
                    canvas.style.cursor = 'default';
                    if (selectedNodeForConnect) {
                        selectedNodeForConnect.style.boxShadow = '';
                        selectedNodeForConnect = null;
                    }
                }
                if (window.lucide) lucide.createIcons();
            });
        }

        function createNode(type, icon, x, y) {
            topoState.counters[type] = (topoState.counters[type] || 0) + 1;
            const index = topoState.counters[type] - 1;
            const id = `${type.toLowerCase()}_${partPrefix}_${index}`;
            const label = `${type}${index}`;

            const el = document.createElement('div');
            el.className = 'network-node';
            el.id = id;
            el.style.position = 'absolute';
            el.style.left = `${x}px`;
            el.style.top = `${y}px`;
            el.style.width = '64px';
            el.style.height = '64px';
            el.style.display = 'flex';
            el.style.flexDirection = 'column';
            el.style.alignItems = 'center';
            el.style.justifyContent = 'center';
            el.style.background = 'white';
            el.style.border = '2px solid var(--primary-color)';
            el.style.borderRadius = '8px';
            el.style.cursor = 'grab';
            el.style.userSelect = 'none';
            el.style.zIndex = '10';

            el.innerHTML = `
                <img src="assets/icons/${icon}.svg" width="28" height="28" style="pointer-events:none;">
                <span style="font-size:0.75rem; font-weight:700; color:#1E293B; pointer-events:none;">${label}</span>
            `;

            topoState.nodes[id] = {
                id,
                type,
                label,
                element: el,
                x: x + 32,
                y: y + 32,
                ip: '',
                subnet: '',
                gateway: ''
            };

            // Dragging
            let isDragging = false;
            let startX, startY, initX, initY;

            el.addEventListener('mousedown', (e) => {
                if (isConnectMode) {
                    e.stopPropagation();
                    if (!selectedNodeForConnect) {
                        selectedNodeForConnect = el;
                        el.style.boxShadow = '0 0 0 3px #10B981';
                    } else if (selectedNodeForConnect !== el) {
                        const srcId = selectedNodeForConnect.id;
                        const tgtId = el.id;
                        const cable = cableSelect ? cableSelect.value : 'crossover';

                        const exists = topoState.edges.some(ed => 
                            (ed.sourceId === srcId && ed.targetId === tgtId) ||
                            (ed.sourceId === tgtId && ed.targetId === srcId)
                        );

                        if (!exists) {
                            topoState.edges.push({ sourceId: srcId, targetId: tgtId, cableType: cable });
                            drawConnections();
                        }

                        selectedNodeForConnect.style.boxShadow = '';
                        selectedNodeForConnect = null;
                    }
                    return;
                }

                isDragging = true;
                startX = e.clientX;
                startY = e.clientY;
                initX = parseInt(el.style.left, 10);
                initY = parseInt(el.style.top, 10);
                el.style.cursor = 'grabbing';
            });

            document.addEventListener('mousemove', (e) => {
                if (!isDragging) return;
                const dx = e.clientX - startX;
                const dy = e.clientY - startY;
                const newX = Math.max(0, Math.min(initX + dx, canvas.clientWidth - 64));
                const newY = Math.max(0, Math.min(initY + dy, canvas.clientHeight - 64));
                el.style.left = `${newX}px`;
                el.style.top = `${newY}px`;
                topoState.nodes[id].x = newX + 32;
                topoState.nodes[id].y = newY + 32;
                drawConnections();
            });

            document.addEventListener('mouseup', () => {
                if (isDragging) {
                    isDragging = false;
                    el.style.cursor = 'grab';
                }
            });

            // Double-click to open IP Configuration (for PCs)
            el.addEventListener('dblclick', () => {
                if (type === 'PC') {
                    openIpModal(topoState.nodes[id], partPrefix);
                }
            });

            canvas.appendChild(el);
            drawConnections();
        }

        // Palette drag
        [toolPc, toolRouter].forEach(tool => {
            if (!tool) return;
            tool.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('text/plain', tool.getAttribute('data-type'));
                e.dataTransfer.setData('icon', tool.getAttribute('data-icon'));
            });
        });

        if (canvas) {
            canvas.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'copy';
            });
            canvas.addEventListener('drop', (e) => {
                e.preventDefault();
                const type = e.dataTransfer.getData('text/plain');
                const icon = e.dataTransfer.getData('icon') || (type === 'PC' ? 'pc' : 'router');
                const rect = canvas.getBoundingClientRect();
                const dropX = e.clientX - rect.left - 32;
                const dropY = e.clientY - rect.top - 32;
                createNode(type, icon, Math.max(0, dropX), Math.max(0, dropY));
            });
        }

        // Reset canvas
        if (resetCanvasBtn) {
            resetCanvasBtn.addEventListener('click', () => {
                Object.keys(topoState.nodes).forEach(k => {
                    topoState.nodes[k].element.remove();
                });
                topoState.nodes = {};
                topoState.edges = [];
                topoState.counters.PC = 0;
                topoState.counters.Router = 0;
                drawConnections();
                if (feedback) feedback.textContent = '';
            });
        }

        // Topology Check Button
        if (checkBtn) {
            checkBtn.addEventListener('click', () => {
                validateTopology(partPrefix, topoState, is4B, feedback);
            });
        }
    }

    // IP Modal Handler
    const ipModal = document.getElementById('ip-config-modal');
    const ipDevName = document.getElementById('ip-config-device-name');
    const ipInput = document.getElementById('ip-address-input');
    const maskInput = document.getElementById('subnet-mask-input');
    const gwInput = document.getElementById('gateway-input');
    const saveIpBtn = document.getElementById('save-ip-config');
    const closeIpBtn = document.getElementById('close-ip-config');
    const ipError = document.getElementById('ip-config-error');
    let currentEditingNode = null;

    function openIpModal(nodeObj, partPrefix) {
        currentEditingNode = nodeObj;
        if (ipDevName) ipDevName.textContent = `${nodeObj.label} (${partPrefix === 'A' ? 'Exercise 4-A /24' : 'Exercise 4-B /27'})`;
        if (ipInput) ipInput.value = nodeObj.ip || '';
        if (maskInput) maskInput.value = nodeObj.subnet || (partPrefix === 'A' ? '255.255.255.0' : '255.255.255.224');
        if (gwInput) gwInput.value = nodeObj.gateway || '';
        if (ipError) ipError.textContent = '';
        if (ipModal) ipModal.style.display = 'flex';
    }

    if (closeIpBtn) {
        closeIpBtn.addEventListener('click', () => {
            if (ipModal) ipModal.style.display = 'none';
        });
    }

    if (saveIpBtn) {
        saveIpBtn.addEventListener('click', () => {
            if (!currentEditingNode) return;
            const ip = ipInput.value.trim();
            const mask = maskInput.value.trim();
            const gw = gwInput.value.trim();

            const ipRegex = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/;
            if (!ip || !ipRegex.test(ip)) {
                ipError.textContent = 'Invalid IP Address format.';
                return;
            }
            if (!mask || !ipRegex.test(mask)) {
                ipError.textContent = 'Invalid Subnet Mask format.';
                return;
            }
            if (!gw || !ipRegex.test(gw)) {
                ipError.textContent = 'Invalid Default Gateway format.';
                return;
            }

            currentEditingNode.ip = ip;
            currentEditingNode.subnet = mask;
            currentEditingNode.gateway = gw;

            if (ipModal) ipModal.style.display = 'none';
        });
    }

    // ─────────────────────────────────────────────────────────────
    // 5. TOPOLOGY VALIDATION (PART A & PART B)
    // ─────────────────────────────────────────────────────────────
    function validateTopology(partPrefix, topoState, is4B, feedbackEl) {
        const pcs = Object.values(topoState.nodes).filter(n => n.type === 'PC');
        const routers = Object.values(topoState.nodes).filter(n => n.type === 'Router');

        function isConnected(id1, id2, cableReq) {
            return topoState.edges.some(e =>
                ((e.sourceId === id1 && e.targetId === id2) || (e.sourceId === id2 && e.targetId === id1)) &&
                (!cableReq || e.cableType === cableReq)
            );
        }

        if (!is4B) {
            if (pcs.length !== 2 || routers.length !== 1) {
                feedbackEl.style.color = '#DC2626';
                feedbackEl.textContent = `✘ Need exactly 2 PCs (PC0, PC1) and 1 Router (Router0). (Found ${pcs.length} PC(s), ${routers.length} Router(s))`;
                return;
            }

            const r0 = routers[0];
            const p0 = pcs.find(p => p.label === 'PC0') || pcs[0];
            const p1 = pcs.find(p => p.label === 'PC1') || pcs[1];

            if (!isConnected(p0.id, r0.id, 'crossover')) {
                feedbackEl.style.color = '#DC2626';
                feedbackEl.textContent = `✘ ${p0.label} must be connected to ${r0.label} via a Copper Cross-over cable.`;
                return;
            }
            if (!isConnected(p1.id, r0.id, 'crossover')) {
                feedbackEl.style.color = '#DC2626';
                feedbackEl.textContent = `✘ ${p1.label} must be connected to ${r0.label} via a Copper Cross-over cable.`;
                return;
            }

            feedbackEl.style.color = '#059669';
            feedbackEl.innerHTML = '✔ Topology 4-A Verified!<br>✓ PC0 &harr; Router0 (Copper Cross-over)<br>✓ PC1 &harr; Router0 (Copper Cross-over)<br>Now configure PC IP parameters and Router0 interfaces in Stage 2 &amp; 3.';
            reportMilestone('4A_TOPOLOGY_COMPLETE');

        } else {
            if (pcs.length !== 4 || routers.length !== 2) {
                feedbackEl.style.color = '#DC2626';
                feedbackEl.textContent = `✘ Need exactly 4 PCs (PC0..PC3) and 2 Routers (Router0, Router1). (Found ${pcs.length} PC(s), ${routers.length} Router(s))`;
                return;
            }

            const r0 = routers.find(r => r.label === 'Router0') || routers[0];
            const r1 = routers.find(r => r.label === 'Router1') || routers[1];
            const p0 = pcs.find(p => p.label === 'PC0');
            const p1 = pcs.find(p => p.label === 'PC1');
            const p2 = pcs.find(p => p.label === 'PC2');
            const p3 = pcs.find(p => p.label === 'PC3');

            if (!isConnected(r0.id, r1.id, 'serial')) {
                feedbackEl.style.color = '#DC2626';
                feedbackEl.textContent = '✘ Router0 and Router1 must be connected with a Serial DCE cable.';
                return;
            }

            if (p0 && !isConnected(p0.id, r0.id, 'crossover')) {
                feedbackEl.style.color = '#DC2626';
                feedbackEl.textContent = '✘ PC0 must be connected to Router0 via Copper Cross-over cable.';
                return;
            }
            if (p1 && !isConnected(p1.id, r0.id, 'crossover')) {
                feedbackEl.style.color = '#DC2626';
                feedbackEl.textContent = '✘ PC1 must be connected to Router0 via Copper Cross-over cable.';
                return;
            }
            if (p2 && !isConnected(p2.id, r1.id, 'crossover')) {
                feedbackEl.style.color = '#DC2626';
                feedbackEl.textContent = '✘ PC2 must be connected to Router1 via Copper Cross-over cable.';
                return;
            }
            if (p3 && !isConnected(p3.id, r1.id, 'crossover')) {
                feedbackEl.style.color = '#DC2626';
                feedbackEl.textContent = '✘ PC3 must be connected to Router1 via Copper Cross-over cable.';
                return;
            }

            feedbackEl.style.color = '#059669';
            feedbackEl.innerHTML = '✔ WAN Topology 4-B Verified!<br>✓ PC0 &amp; PC1 &harr; Router0 (LAN subnets .0/27 and .32/27)<br>✓ Router0 &harr; Router1 (Serial WAN link .64/27)<br>✓ PC2 &amp; PC3 &harr; Router1 (LAN subnets .96/27 and .128/27)<br>Proceed to HWIC-2T hardware installation in Stage 2.';
            reportMilestone('4B_TOPOLOGY_COMPLETE');
        }
    }

    // Initialize both canvases
    setupCanvas('4a', topoA, false);
    setupCanvas('4b', topoB, true);

    // ─────────────────────────────────────────────────────────────
    // 6. HWIC-2T HARDWARE MODULE SIMULATION (PART B)
    // ─────────────────────────────────────────────────────────────
    const r0PwrBtn = document.getElementById('r0-power-toggle-btn');
    const r0HwicBtn = document.getElementById('r0-insert-hwic-btn');
    const r0PwrBadge = document.getElementById('r0-power-badge');
    const r0HwicStatus = document.getElementById('r0-hwic-status');

    const r1PwrBtn = document.getElementById('r1-power-toggle-btn');
    const r1HwicBtn = document.getElementById('r1-insert-hwic-btn');
    const r1PwrBadge = document.getElementById('r1-power-badge');
    const r1HwicStatus = document.getElementById('r1-hwic-status');
    const hwicFeedback = document.getElementById('hwic-feedback');

    function updateHwicUI() {
        if (r0PwrBadge) {
            r0PwrBadge.textContent = router4B.R0.powerOn ? 'POWER ON' : 'POWER OFF';
            r0PwrBadge.style.background = router4B.R0.powerOn ? '#10B981' : '#64748B';
        }
        if (r0PwrBtn) r0PwrBtn.textContent = router4B.R0.powerOn ? 'Toggle Power (OFF)' : 'Toggle Power (ON)';
        if (r0HwicStatus) {
            if (router4B.R0.hwicInstalled) {
                r0HwicStatus.textContent = 'HWIC-2T Installed (Serial0/1/0 & Serial0/1/1 active)';
                r0HwicStatus.style.color = '#059669';
            } else {
                r0HwicStatus.textContent = 'Empty (Serial0/1/0 unavailable)';
                r0HwicStatus.style.color = '#DC2626';
            }
        }

        if (r1PwrBadge) {
            r1PwrBadge.textContent = router4B.R1.powerOn ? 'POWER ON' : 'POWER OFF';
            r1PwrBadge.style.background = router4B.R1.powerOn ? '#10B981' : '#64748B';
        }
        if (r1PwrBtn) r1PwrBtn.textContent = router4B.R1.powerOn ? 'Toggle Power (OFF)' : 'Toggle Power (ON)';
        if (r1HwicStatus) {
            if (router4B.R1.hwicInstalled) {
                r1HwicStatus.textContent = 'HWIC-2T Installed (Serial0/1/0 & Serial0/1/1 active)';
                r1HwicStatus.style.color = '#059669';
            } else {
                r1HwicStatus.textContent = 'Empty (Serial0/1/0 unavailable)';
                r1HwicStatus.style.color = '#DC2626';
            }
        }

        if (router4B.R0.hwicInstalled && router4B.R1.hwicInstalled && router4B.R0.powerOn && router4B.R1.powerOn) {
            if (hwicFeedback) {
                hwicFeedback.style.color = '#059669';
                hwicFeedback.textContent = '✔ HWIC-2T modules successfully installed and powered on in both Routers! Serial0/1/0 is now available for configuration.';
            }
            reportMilestone('4B_SERIAL_CONFIGURED');
        }
    }

    if (r0PwrBtn) {
        r0PwrBtn.addEventListener('click', () => {
            router4B.R0.powerOn = !router4B.R0.powerOn;
            updateHwicUI();
        });
    }
    if (r0HwicBtn) {
        r0HwicBtn.addEventListener('click', () => {
            if (router4B.R0.powerOn) {
                alert('Cannot insert HWIC-2T while power is ON! Turn off the router power first (Step 2 in manual).');
                return;
            }
            router4B.R0.hwicInstalled = true;
            updateHwicUI();
        });
    }

    if (r1PwrBtn) {
        r1PwrBtn.addEventListener('click', () => {
            router4B.R1.powerOn = !router4B.R1.powerOn;
            updateHwicUI();
        });
    }
    if (r1HwicBtn) {
        r1HwicBtn.addEventListener('click', () => {
            if (router4B.R1.powerOn) {
                alert('Cannot insert HWIC-2T while power is ON! Turn off the router power first (Step 2 in manual).');
                return;
            }
            router4B.R1.hwicInstalled = true;
            updateHwicUI();
        });
    }

    // ─────────────────────────────────────────────────────────────
    // 7. ROUTER CLI SIMULATOR (4A)
    // ─────────────────────────────────────────────────────────────
    const termOut4A = document.getElementById('terminal-output-4a');
    const termIn4A = document.getElementById('terminal-input-4a');
    const termPrompt4A = document.getElementById('terminal-prompt-4a');
    const checkR0Btn4A = document.getElementById('check-r0-config-4a');
    const fbR04A = document.getElementById('feedback-r0-4a');

    function updatePrompt4A() {
        if (termPrompt4A) termPrompt4A.textContent = getPartPrompt('A') + ' ';
    }

    function initTerminal4A() {
        if (!termOut4A) return;
        termOut4A.textContent = 'Router con0 is now available\n\nPress RETURN to get started.\n';
        updatePrompt4A();
    }
    initTerminal4A();

    if (termIn4A) {
        termIn4A.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const raw = termIn4A.value;
                const cmd = raw.trim();
                termIn4A.value = '';

                printTerminal(termOut4A, getPartPrompt('A') + ' ' + raw);

                if (cmd) {
                    router4A.history.unshift(cmd);
                    if (router4A.history.length > 30) router4A.history.pop();
                    processCmd4A(cmd);
                }
                router4A.historyIndex = -1;
                updatePrompt4A();
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                if (router4A.historyIndex < router4A.history.length - 1) router4A.historyIndex++;
                termIn4A.value = router4A.history[router4A.historyIndex] || '';
            } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                if (router4A.historyIndex > 0) router4A.historyIndex--;
                else router4A.historyIndex = -1;
                termIn4A.value = router4A.historyIndex >= 0 ? router4A.history[router4A.historyIndex] : '';
            }
        });
    }

    function processCmd4A(raw) {
        const lower = raw.toLowerCase().trim();
        const parts = lower.split(/\s+/);
        const cmd = parts[0];

        if (cmd === '?' || cmd === 'help') {
            printTerminal(termOut4A, 'Available commands: enable, configure terminal, interface <g0/0|g0/1>, ip address <ip> <mask>, no shutdown, show ip interface brief, show ip route, exit, end');
            return;
        }

        if (router4A.cliMode === 'user_exec') {
            if (cmd === 'enable' || cmd === 'en') {
                router4A.cliMode = 'priv_exec';
            } else {
                printTerminal(termOut4A, `% Unknown command: "${raw}". Type "enable" to enter privileged mode.`);
            }
        } else if (router4A.cliMode === 'priv_exec') {
            if ((cmd === 'configure' && (parts[1] === 'terminal' || parts[1] === 't')) || cmd === 'conf' || cmd === 'conft') {
                router4A.cliMode = 'global_config';
                printTerminal(termOut4A, 'Enter configuration commands, one per line. End with CNTL/Z.');
            } else if (cmd === 'show' && parts[1] === 'ip' && parts[2] === 'interface' && parts[3] === 'brief') {
                printInterfaceBrief4A();
            } else if (cmd === 'show' && parts[1] === 'ip' && parts[2] === 'route') {
                printRoutingTable4A();
            } else if (cmd === 'disable' || cmd === 'exit') {
                router4A.cliMode = 'user_exec';
            } else {
                printTerminal(termOut4A, `% Unknown command: "${raw}". Type ? for help.`);
            }
        } else if (router4A.cliMode === 'global_config') {
            if (cmd === 'interface' || cmd === 'int') {
                const ifKey = normaliseIf(parts.slice(1).join(' '));
                if (ifKey && (ifKey === 'GigabitEthernet0/0' || ifKey === 'GigabitEthernet0/1')) {
                    router4A.cliInterface = ifKey;
                    router4A.cliMode = 'if_config';
                } else {
                    printTerminal(termOut4A, '% Invalid interface. Valid interfaces for Part A: GigabitEthernet0/0, GigabitEthernet0/1');
                }
            } else if (cmd === 'exit' || cmd === 'end') {
                router4A.cliMode = 'priv_exec';
            } else {
                printTerminal(termOut4A, `% Unknown command: "${raw}". Type ? for help.`);
            }
        } else if (router4A.cliMode === 'if_config') {
            const iface = router4A.interfaces[router4A.cliInterface];
            if (cmd === 'ip' && parts[1] === 'address') {
                const rawParts = raw.trim().split(/\s+/);
                if (rawParts.length >= 4) {
                    iface.ip = rawParts[2];
                    iface.mask = rawParts[3];
                } else {
                    printTerminal(termOut4A, '% Incomplete command. Syntax: ip address <ip> <subnet-mask>');
                }
            } else if (cmd === 'no' && parts[1] === 'shutdown') {
                iface.state = 'up';
                printTerminal(termOut4A, `%LINK-5-CHANGED: Interface ${router4A.cliInterface}, changed state to up`);
                printTerminal(termOut4A, `%LINEPROTO-5-UPDOWN: Line protocol on Interface ${router4A.cliInterface}, changed state to up`);
            } else if (cmd === 'shutdown') {
                iface.state = 'down';
                printTerminal(termOut4A, `%LINK-5-CHANGED: Interface ${router4A.cliInterface}, changed state to administratively down`);
            } else if (cmd === 'exit') {
                router4A.cliMode = 'global_config';
                router4A.cliInterface = null;
            } else if (cmd === 'end') {
                router4A.cliMode = 'priv_exec';
                router4A.cliInterface = null;
            } else {
                printTerminal(termOut4A, `% Unknown command: "${raw}". Type ? for help.`);
            }
        }
    }

    function printInterfaceBrief4A() {
        printTerminal(termOut4A, 'Interface                  IP-Address      OK? Method Status                Protocol');
        for (const ifName in router4A.interfaces) {
            const iface = router4A.interfaces[ifName];
            const ip = iface.ip || 'unassigned     ';
            const status = iface.state === 'up' ? 'up                    ' : 'administratively down ';
            const proto = iface.state === 'up' ? 'up' : 'down';
            printTerminal(termOut4A, `${ifName.padEnd(27)}${ip.padEnd(16)}YES manual ${status}${proto}`);
        }
    }

    function printRoutingTable4A() {
        printTerminal(termOut4A, 'Codes: C - connected, S - static, R - RIP, M - mobile\nGateway of last resort is not set\n');
        let hasAny = false;
        for (const ifName in router4A.interfaces) {
            const iface = router4A.interfaces[ifName];
            if (iface.state === 'up' && iface.ip && iface.mask) {
                const net = calculateNetwork(iface.ip, iface.mask);
                printTerminal(termOut4A, `C    ${net}/24 is directly connected, ${ifName}`);
                hasAny = true;
            }
        }
        if (!hasAny) printTerminal(termOut4A, '     (no active routes in table)');
    }

    if (checkR0Btn4A) {
        checkR0Btn4A.addEventListener('click', () => {
            const g00 = router4A.interfaces['GigabitEthernet0/0'];
            const g01 = router4A.interfaces['GigabitEthernet0/1'];

            const g00Ok = g00.ip === '192.168.10.1' && g00.mask === '255.255.255.0' && g00.state === 'up';
            const g01Ok = g01.ip === '192.168.11.1' && g01.mask === '255.255.255.0' && g01.state === 'up';

            if (g00Ok && g01Ok) {
                fbR04A.style.color = '#059669';
                fbR04A.textContent = '✔ Router0 Interfaces GigabitEthernet0/0 and 0/1 are correctly configured and UP!';
                reportMilestone('4A_ROUTER_CONFIGURED');
            } else {
                fbR04A.style.color = '#DC2626';
                fbR04A.textContent = '✘ Interface requirements not met. G0/0: 192.168.10.1/24 (no shutdown), G0/1: 192.168.11.1/24 (no shutdown).';
            }
        });
    }

    // ─────────────────────────────────────────────────────────────
    // 8. PC COMMAND PROMPT & PING VERIFICATION (4A)
    // ─────────────────────────────────────────────────────────────
    const sendPing4ABtn = document.getElementById('send-ping-4a');
    const cmdOut4A = document.getElementById('cmd-output-4a');
    const pingFb4A = document.getElementById('ping-feedback-4a');

    if (sendPing4ABtn) {
        sendPing4ABtn.addEventListener('click', () => {
            const srcDev = document.getElementById('ping-src-4a').value;
            const destIp = document.getElementById('ping-dest-4a').value.trim();

            const pcs = Object.values(topoA.nodes).filter(n => n.type === 'PC');

            cmdOut4A.innerHTML = `C:\\&gt; ping ${destIp}<br><br>Pinging ${destIp} with 32 bytes of data:<br>`;
            pingFb4A.textContent = '';

            const g00 = router4A.interfaces['GigabitEthernet0/0'];
            const g01 = router4A.interfaces['GigabitEthernet0/1'];

            const pc0 = pcs.find(p => p.label === 'PC0');
            const pc1 = pcs.find(p => p.label === 'PC1');

            let success = false;
            let failureReason = '';

            if (!pc0 || !pc1) {
                failureReason = 'PCs missing from topology.';
            } else if (!pc0.ip || !pc1.ip) {
                failureReason = 'Double-click PCs on canvas to configure IP parameters first.';
            } else if (g00.state !== 'up' || g01.state !== 'up') {
                failureReason = 'Router0 interfaces are down. Configure them in Router CLI with "no shutdown".';
            } else if (g00.ip !== '192.168.10.1' || g01.ip !== '192.168.11.1') {
                failureReason = 'Router0 interface IP addresses do not match the addressing table.';
            } else if (srcDev === 'PC1' && destIp === '192.168.10.2') {
                if (pc1.gateway === '192.168.11.1' && pc0.gateway === '192.168.10.1') success = true;
                else failureReason = 'Check default gateways on PC0 and PC1.';
            } else if (srcDev === 'PC0' && destIp === '192.168.11.2') {
                if (pc0.gateway === '192.168.10.1' && pc1.gateway === '192.168.11.1') success = true;
                else failureReason = 'Check default gateways on PC0 and PC1.';
            } else {
                failureReason = `Destination ${destIp} is unreachable.`;
            }

            let count = 0;
            const timer = setInterval(() => {
                count++;
                if (success) {
                    cmdOut4A.innerHTML += `Reply from ${destIp}: bytes=32 time&lt;1ms TTL=127<br>`;
                } else {
                    cmdOut4A.innerHTML += `Request timed out.<br>`;
                }
                cmdOut4A.scrollTop = cmdOut4A.scrollHeight;

                if (count >= 4) {
                    clearInterval(timer);
                    cmdOut4A.innerHTML += `<br>Ping statistics for ${destIp}:<br>&nbsp;&nbsp;&nbsp;&nbsp;Packets: Sent = 4, Received = ${success ? 4 : 0}, Lost = ${success ? 0 : 4} (${success ? 0 : 100}% loss)<br>`;
                    if (success) {
                        cmdOut4A.innerHTML += `Approximate round trip times in milli-seconds:<br>&nbsp;&nbsp;&nbsp;&nbsp;Minimum = 0ms, Maximum = 1ms, Average = 0ms<br><br>C:\\&gt; _`;
                        pingFb4A.style.color = '#059669';
                        pingFb4A.textContent = '✔ Ping Successful! Packets routed through Router0 across both subnets.';
                        reportMilestone('4A_CONNECTIVITY_VERIFIED');
                    } else {
                        cmdOut4A.innerHTML += `<br>C:\\&gt; _`;
                        pingFb4A.style.color = '#DC2626';
                        pingFb4A.textContent = `✘ Ping Failed: ${failureReason}`;
                    }
                    cmdOut4A.scrollTop = cmdOut4A.scrollHeight;
                }
            }, 400);
        });
    }

    // ─────────────────────────────────────────────────────────────
    // 9. DUAL ROUTER CLI SIMULATOR (4B)
    // ─────────────────────────────────────────────────────────────
    const termOut4B = document.getElementById('terminal-output-4b');
    const termIn4B = document.getElementById('terminal-input-4b');
    const termPrompt4B = document.getElementById('terminal-prompt-4b');
    const swR0Btn4B = document.getElementById('sw-r0-4b');
    const swR1Btn4B = document.getElementById('sw-r1-4b');
    const clockBadge4B = document.getElementById('exp4b-serial-clock-badge');

    function updatePrompt4B() {
        if (termPrompt4B) termPrompt4B.textContent = getPartPrompt('B', activeRouterKey4B) + ' ';
    }

    function switchRouter4B(key) {
        activeRouterKey4B = key;
        if (swR0Btn4B && swR1Btn4B) {
            swR0Btn4B.style.backgroundColor = key === 'R0' ? 'var(--primary-color)' : 'var(--secondary-color)';
            swR1Btn4B.style.backgroundColor = key === 'R1' ? 'var(--primary-color)' : 'var(--secondary-color)';
        }
        printTerminal(termOut4B, `\n--- Switched to ${router4B[key].hostname} CLI ---\n`);
        updatePrompt4B();
    }

    if (swR0Btn4B) swR0Btn4B.addEventListener('click', () => switchRouter4B('R0'));
    if (swR1Btn4B) swR1Btn4B.addEventListener('click', () => switchRouter4B('R1'));

    function initTerminal4B() {
        if (!termOut4B) return;
        termOut4B.textContent = 'Router0 con0 is now available\n\nPress RETURN to get started.\n';
        updatePrompt4B();
    }
    initTerminal4B();

    if (termIn4B) {
        termIn4B.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const raw = termIn4B.value;
                const cmd = raw.trim();
                termIn4B.value = '';

                printTerminal(termOut4B, getPartPrompt('B', activeRouterKey4B) + ' ' + raw);

                const currentR = router4B[activeRouterKey4B];
                if (cmd) {
                    currentR.history.unshift(cmd);
                    if (currentR.history.length > 30) currentR.history.pop();
                    processCmd4B(cmd, currentR);
                }
                currentR.historyIndex = -1;
                updatePrompt4B();
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                const currentR = router4B[activeRouterKey4B];
                if (currentR.historyIndex < currentR.history.length - 1) currentR.historyIndex++;
                termIn4B.value = currentR.history[currentR.historyIndex] || '';
            } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                const currentR = router4B[activeRouterKey4B];
                if (currentR.historyIndex > 0) currentR.historyIndex--;
                else currentR.historyIndex = -1;
                termIn4B.value = currentR.historyIndex >= 0 ? currentR.history[currentR.historyIndex] : '';
            }
        });
    }

    function processCmd4B(raw, rState) {
        const lower = raw.toLowerCase().trim();
        const parts = lower.split(/\s+/);
        const cmd = parts[0];

        if (cmd === '?' || cmd === 'help') {
            printTerminal(termOut4B, 'Available commands:\n  enable\n  configure terminal\n  interface <g0/0|g0/1|s0/1/0>\n  ip address <ip> <subnet-mask>\n  clock rate 64000 (DCE only)\n  no shutdown\n  ip route <dest-net> <dest-mask> <next-hop>\n  show ip route\n  show ip interface brief\n  exit / end');
            return;
        }

        if (rState.cliMode === 'user_exec') {
            if (cmd === 'enable' || cmd === 'en') {
                rState.cliMode = 'priv_exec';
            } else {
                printTerminal(termOut4B, `% Unknown command: "${raw}". Type "enable" to enter privileged mode.`);
            }
        } else if (rState.cliMode === 'priv_exec') {
            if ((cmd === 'configure' && (parts[1] === 'terminal' || parts[1] === 't')) || cmd === 'conf' || cmd === 'conft') {
                rState.cliMode = 'global_config';
                printTerminal(termOut4B, 'Enter configuration commands, one per line. End with CNTL/Z.');
            } else if (cmd === 'show' && parts[1] === 'ip' && parts[2] === 'route') {
                printRoutingTable4B(rState);
            } else if (cmd === 'show' && parts[1] === 'ip' && parts[2] === 'interface' && parts[3] === 'brief') {
                printInterfaceBrief4B(rState);
            } else if (cmd === 'disable' || cmd === 'exit') {
                rState.cliMode = 'user_exec';
            } else {
                printTerminal(termOut4B, `% Unknown command: "${raw}". Type ? for help.`);
            }
        } else if (rState.cliMode === 'global_config') {
            if (cmd === 'interface' || cmd === 'int') {
                const ifKey = normaliseIf(parts.slice(1).join(' '));
                if (ifKey) {
                    if (ifKey === 'Serial0/1/0' && !rState.hwicInstalled) {
                        printTerminal(termOut4B, '% Interface Serial0/1/0 does not exist! Install HWIC-2T module in Stage 2 first.');
                        return;
                    }
                    rState.cliInterface = ifKey;
                    rState.cliMode = 'if_config';
                } else {
                    printTerminal(termOut4B, '% Invalid interface. Valid: GigabitEthernet0/0, GigabitEthernet0/1, Serial0/1/0');
                }
            } else if (cmd === 'ip' && parts[1] === 'route') {
                const rawParts = raw.trim().split(/\s+/);
                if (rawParts.length >= 5) {
                    const network = rawParts[2];
                    const mask = rawParts[3];
                    const nextHop = rawParts[4];
                    rState.routes = rState.routes.filter(r => !(r.network === network && r.mask === mask));
                    rState.routes.push({ network, mask, nextHop });
                    printTerminal(termOut4B, '');
                    checkStaticRoutesCompletion();
                } else {
                    printTerminal(termOut4B, '% Incomplete command. Syntax: ip route <network> <mask> <next-hop>');
                }
            } else if (cmd === 'exit' || cmd === 'end') {
                rState.cliMode = 'priv_exec';
            } else {
                printTerminal(termOut4B, `% Unknown command: "${raw}". Type ? for help.`);
            }
        } else if (rState.cliMode === 'if_config') {
            const iface = rState.interfaces[rState.cliInterface];
            if (cmd === 'ip' && parts[1] === 'address') {
                const rawParts = raw.trim().split(/\s+/);
                if (rawParts.length >= 4) {
                    iface.ip = rawParts[2];
                    iface.mask = rawParts[3];
                    checkRoutersConfigured4B();
                } else {
                    printTerminal(termOut4B, '% Incomplete command. Syntax: ip address <ip> <subnet-mask>');
                }
            } else if (cmd === 'clock' && parts[1] === 'rate') {
                if (rState.cliInterface !== 'Serial0/1/0') {
                    printTerminal(termOut4B, '% Error: Clock rate can only be configured on Serial interfaces.');
                } else if (iface.role !== 'DCE') {
                    printTerminal(termOut4B, '% Error: Clock rate can only be applied to DCE cable ends (Router0).');
                } else {
                    const rate = parseInt(parts[2], 10);
                    if (rate === 64000) {
                        iface.clockRate = 64000;
                        if (clockBadge4B) {
                            clockBadge4B.textContent = 'DCE CLOCK: 64000 (SET)';
                            clockBadge4B.style.background = '#10B981';
                        }
                        checkRoutersConfigured4B();
                    } else {
                        printTerminal(termOut4B, '% Syntax: clock rate 64000');
                    }
                }
            } else if (cmd === 'no' && parts[1] === 'shutdown') {
                iface.state = 'up';
                printTerminal(termOut4B, `%LINK-5-CHANGED: Interface ${rState.cliInterface}, changed state to up`);
                if (rState.cliInterface === 'Serial0/1/0' && iface.role === 'DCE' && iface.clockRate !== 64000) {
                    printTerminal(termOut4B, `%LINEPROTO-5-UPDOWN: Line protocol on Interface ${rState.cliInterface}, changed state to down (DCE clock missing)`);
                } else {
                    printTerminal(termOut4B, `%LINEPROTO-5-UPDOWN: Line protocol on Interface ${rState.cliInterface}, changed state to up`);
                }
                checkRoutersConfigured4B();
            } else if (cmd === 'shutdown') {
                iface.state = 'down';
                printTerminal(termOut4B, `%LINK-5-CHANGED: Interface ${rState.cliInterface}, changed state to administratively down`);
            } else if (cmd === 'exit') {
                rState.cliMode = 'global_config';
                rState.cliInterface = null;
            } else if (cmd === 'end') {
                rState.cliMode = 'priv_exec';
                rState.cliInterface = null;
            } else {
                printTerminal(termOut4B, `% Unknown command: "${raw}". Type ? for help.`);
            }
        }
    }

    function printRoutingTable4B(rState) {
        printTerminal(termOut4B, 'Codes: L - local, C - connected, S - static, R - RIP, M - mobile');
        printTerminal(termOut4B, '       D - EIGRP, EX - EIGRP external, O - OSPF, IA - OSPF inter area\n');
        printTerminal(termOut4B, 'Gateway of last resort is not set\n');
        printTerminal(termOut4B, '192.168.10.0/24 is variably subnetted, 8 subnets, 2 masks');

        for (const ifName in rState.interfaces) {
            const iface = rState.interfaces[ifName];
            if (iface.state === 'up' && iface.ip && iface.mask) {
                const net = calculateNetwork(iface.ip, iface.mask);
                printTerminal(termOut4B, `C   ${net}/27 is directly connected, ${ifName}`);
                printTerminal(termOut4B, `L   ${iface.ip}/32 is directly connected, ${ifName}`);
            }
        }

        rState.routes.forEach(rt => {
            printTerminal(termOut4B, `S   ${rt.network}/27 [1/0] via ${rt.nextHop}`);
        });
    }

    function printInterfaceBrief4B(rState) {
        printTerminal(termOut4B, 'Interface                  IP-Address      OK? Method Status                Protocol');
        for (const ifName in rState.interfaces) {
            const iface = rState.interfaces[ifName];
            const ip = iface.ip || 'unassigned     ';
            const isUp = iface.state === 'up';
            let proto = isUp ? 'up' : 'down';
            if (ifName === 'Serial0/1/0' && iface.role === 'DCE' && iface.clockRate !== 64000) {
                proto = 'down';
            }
            const status = isUp ? 'up                    ' : 'administratively down ';
            printTerminal(termOut4B, `${ifName.padEnd(27)}${ip.padEnd(16)}YES manual ${status}${proto}`);
        }
    }

    function checkRoutersConfigured4B() {
        const r0 = router4B.R0;
        const r1 = router4B.R1;

        const r0Ok = r0.interfaces['GigabitEthernet0/0'].ip === '192.168.10.1' &&
                     r0.interfaces['GigabitEthernet0/1'].ip === '192.168.10.33' &&
                     r0.interfaces['Serial0/1/0'].ip === '192.168.10.65' &&
                     r0.interfaces['Serial0/1/0'].clockRate === 64000 &&
                     r0.interfaces['Serial0/1/0'].state === 'up';

        if (r0Ok) reportMilestone('4B_ROUTER0_CONFIGURED');

        const r1Ok = r1.interfaces['GigabitEthernet0/0'].ip === '192.168.10.97' &&
                     r1.interfaces['GigabitEthernet0/1'].ip === '192.168.10.129' &&
                     r1.interfaces['Serial0/1/0'].ip === '192.168.10.66' &&
                     r1.interfaces['Serial0/1/0'].state === 'up';

        if (r1Ok) reportMilestone('4B_ROUTER1_CONFIGURED');
    }

    // ─────────────────────────────────────────────────────────────
    // 10. STATIC ROUTE BUILDER & VALIDATOR (4B)
    // ─────────────────────────────────────────────────────────────
    const applyStaticBtn = document.getElementById('apply-static-routes-btn');
    const staticFeedback = document.getElementById('static-routes-feedback');

    function checkStaticRoutesCompletion() {
        const r0 = router4B.R0;
        const r1 = router4B.R1;

        const r0Has96 = r0.routes.some(r => r.network === '192.168.10.96' && r.nextHop === '192.168.10.66');
        const r0Has128 = r0.routes.some(r => r.network === '192.168.10.128' && r.nextHop === '192.168.10.66');
        const r1Has0 = r1.routes.some(r => r.network === '192.168.10.0' && r.nextHop === '192.168.10.65');
        const r1Has32 = r1.routes.some(r => r.network === '192.168.10.32' && r.nextHop === '192.168.10.65');

        if (r0Has96 && r0Has128 && r1Has0 && r1Has32) {
            reportMilestone('4B_STATIC_ROUTES_CONFIGURED');
            return true;
        }
        return false;
    }

    if (applyStaticBtn) {
        applyStaticBtn.addEventListener('click', () => {
            const r0nh1 = (document.getElementById('route-r0-nh1').value || '').trim();
            const r0nh2 = (document.getElementById('route-r0-nh2').value || '').trim();
            const r1nh1 = (document.getElementById('route-r1-nh1').value || '').trim();
            const r1nh2 = (document.getElementById('route-r1-nh2').value || '').trim();

            const r0Valid = (r0nh1 === '192.168.10.66' && r0nh2 === '192.168.10.66');
            const r1Valid = (r1nh1 === '192.168.10.65' && r1nh2 === '192.168.10.65');

            if (r0Valid && r1Valid) {
                router4B.R0.routes = [
                    { network: '192.168.10.96', mask: '255.255.255.224', nextHop: '192.168.10.66' },
                    { network: '192.168.10.128', mask: '255.255.255.224', nextHop: '192.168.10.66' }
                ];
                router4B.R1.routes = [
                    { network: '192.168.10.0', mask: '255.255.255.224', nextHop: '192.168.10.65' },
                    { network: '192.168.10.32', mask: '255.255.255.224', nextHop: '192.168.10.65' }
                ];

                staticFeedback.style.color = '#059669';
                staticFeedback.textContent = '✔ Static routes verified and installed into both routers! Run "show ip route" in CLI to see "S" entries.';
                reportMilestone('4B_STATIC_ROUTES_CONFIGURED');
            } else {
                staticFeedback.style.color = '#DC2626';
                staticFeedback.textContent = '✘ Incorrect Next-Hop IPs! Router0 must point to Router1 Se0/1/0 (192.168.10.66), and Router1 must point to Router0 Se0/1/0 (192.168.10.65).';
            }
        });
    }

    // ─────────────────────────────────────────────────────────────
    // 11. PC COMMAND PROMPT & END-TO-END PING (4B)
    // ─────────────────────────────────────────────────────────────
    const sendPing4BBtn = document.getElementById('send-ping-4b');
    const cmdOut4B = document.getElementById('cmd-output-4b');
    const pingFb4B = document.getElementById('ping-feedback-4b');

    if (sendPing4BBtn) {
        sendPing4BBtn.addEventListener('click', () => {
            const srcDev = document.getElementById('ping-src-4b').value;
            const destIp = document.getElementById('ping-dest-4b').value.trim();

            cmdOut4B.innerHTML = `C:\\&gt; ping ${destIp}<br><br>Pinging ${destIp} with 32 bytes of data:<br>`;
            pingFb4B.textContent = '';

            const pcs = Object.values(topoB.nodes).filter(n => n.type === 'PC');
            const pcSrc = pcs.find(p => p.label === srcDev);
            const pcDest = pcs.find(p => p.ip === destIp);

            const r0 = router4B.R0;
            const r1 = router4B.R1;

            let success = false;
            let failReason = '';

            if (!pcSrc || !pcSrc.ip || !pcSrc.gateway) {
                failReason = `Source device (${srcDev}) has no IP or default gateway configured.`;
            } else if (!pcDest || !pcDest.gateway) {
                failReason = `Destination host (${destIp}) is not configured on any PC in the topology.`;
            } else if (pcSrc.subnet !== '255.255.255.224' || pcDest.subnet !== '255.255.255.224') {
                failReason = 'Incorrect subnet mask! Both source and destination must use 255.255.255.224 (/27).';
            } else if (r0.interfaces['Serial0/1/0'].state !== 'up' || r1.interfaces['Serial0/1/0'].state !== 'up') {
                failReason = 'Serial WAN interface is down on one or both routers.';
            } else if (r0.interfaces['Serial0/1/0'].clockRate !== 64000) {
                failReason = 'Line protocol on Serial0/1/0 is down: Router0 (DCE) requires "clock rate 64000".';
            } else {
                const srcNet = calculateNetwork(pcSrc.ip, pcSrc.subnet);
                const destNet = calculateNetwork(pcDest.ip, pcDest.subnet);

                const r0HasForward = r0.routes.some(r => r.network === destNet && r.nextHop === '192.168.10.66');
                const r1HasReturn = r1.routes.some(r => r.network === srcNet && r.nextHop === '192.168.10.65');

                if ((destNet === '192.168.10.96' || destNet === '192.168.10.128') && !r0HasForward) {
                    failReason = `Router0 has no static route for remote network ${destNet}/27.`;
                } else if ((srcNet === '192.168.10.0' || srcNet === '192.168.10.32') && !r1HasReturn) {
                    failReason = `Return path missing! Router1 has no static route back to ${srcNet}/27.`;
                } else {
                    success = true;
                }
            }

            let count = 0;
            const timer = setInterval(() => {
                count++;
                if (success) {
                    if (count === 1) {
                        cmdOut4B.innerHTML += `Request timed out.<br>`;
                    } else {
                        cmdOut4B.innerHTML += `Reply from ${destIp}: bytes=32 time=1ms TTL=126<br>`;
                    }
                } else {
                    cmdOut4B.innerHTML += `Request timed out.<br>`;
                }
                cmdOut4B.scrollTop = cmdOut4B.scrollHeight;

                if (count >= 4) {
                    clearInterval(timer);
                    const received = success ? 3 : 0;
                    const lost = 4 - received;
                    cmdOut4B.innerHTML += `<br>Ping statistics for ${destIp}:<br>&nbsp;&nbsp;&nbsp;&nbsp;Packets: Sent = 4, Received = ${received}, Lost = ${lost} (${lost * 25}% loss)<br>`;
                    if (success) {
                        cmdOut4B.innerHTML += `Approximate round trip times in milli-seconds:<br>&nbsp;&nbsp;&nbsp;&nbsp;Minimum = 1ms, Maximum = 2ms, Average = 1ms<br><br>C:\\&gt; _`;
                        pingFb4B.style.color = '#059669';
                        pingFb4B.textContent = '✔ Ping Successful! Static routes verified across the WAN serial link.';
                        reportMilestone('4B_CONNECTIVITY_VERIFIED');
                    } else {
                        cmdOut4B.innerHTML += `<br>C:\\&gt; _`;
                        pingFb4B.style.color = '#DC2626';
                        pingFb4B.textContent = `✘ Ping Failed: ${failReason}`;
                    }
                    cmdOut4B.scrollTop = cmdOut4B.scrollHeight;
                }
            }, 400);
        });
    }

    // ─────────────────────────────────────────────────────────────
    // 12. RESULT TAB UPDATER
    // ─────────────────────────────────────────────────────────────
    function updateResultText() {
        const resTextEl = document.getElementById('result-text');
        if (!resTextEl) return;

        const has4A = achievedMilestones.has('4A_CONNECTIVITY_VERIFIED');
        const has4B = achievedMilestones.has('4B_CONNECTIVITY_VERIFIED');

        resTextEl.innerHTML = `
            <strong>Exercise 4 Practical Evaluation Status:</strong><br><br>
            • <strong>Part 4-A (Configuration of IP Address in Router):</strong> ${has4A ? '<span style="color:#059669; font-weight:bold;">Completed &amp; Verified ✔</span>' : '<span style="color:#D97706; font-weight:bold;">In Progress</span>'}<br>
            • <strong>Part 4-B (Subnetting in WAN Configuration):</strong> ${has4B ? '<span style="color:#059669; font-weight:bold;">Completed &amp; Verified ✔</span>' : '<span style="color:#D97706; font-weight:bold;">In Progress</span>'}<br><br>
            <em>${has4A && has4B ? 'Thus, the implementation of IP addressing &amp; subnetting in WAN is done and verified in Packet Tracer.' : 'Complete both parts and submit the viva evaluation to generate your academic certificate.'}</em>
        `;
    }

    // Initial load
    switchPart('A');
});