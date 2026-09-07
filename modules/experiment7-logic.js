/**
 * Experiment 7 Logic Module — RIP v1 & RIP v2 Dynamic Routing
 * Follows the same Virtual Lab architecture as experiment5-logic.js
 *
 * Features:
 *  - Full drag-drop topology builder (4 PCs, 4 Switches, 2 Routers)
 *  - Topology validation (exact same pattern as exp5)
 *  - Dual Cisco IOS CLI simulators (Part A: RIP v1, Part B: RIP v2)
 *  - Dynamic routing table computation and live display
 *  - Packet journey hop-by-hop trace
 *  - WAN link failure simulation
 *  - Observation log with timestamping
 *  - Quiz (5 questions) with 70% pass threshold
 *  - Certificate generation
 */

(function () {
    "use strict";

    /* ═══════════════════════════════════════════════
     * CONSTANTS & STATE
     * ═══════════════════════════════════════════════ */

    // Node counters for auto-naming dragged devices
    const nodeCounters = { PC: 0, Switch: 0, Router: 0 };

    // Global state shared across Part A and Part B
    const state = {
        topologyValid: false,   // set true after successful topology check

        // Part A — RIP v1
        a: {
            activeRouter: "R0",       // which terminal is active
            cliMode: { R0: "user", R1: "user" },      // user | priv | global | if | router_rip
            cliPrompt: { R0: "Router0>", R1: "Router1>" },
            ifContext: { R0: "", R1: "" },             // current interface context
            ripConfigured: { R0: false, R1: false },   // basic RIP done
            ripNetworks: { R0: new Set(), R1: new Set() },
            ripVersion: { R0: 1, R1: 1 },
            clockSet: { R0: false },                   // DCE clock rate on R0
            wanUp: true,                               // WAN link state
            converged: false,
            pcConfigured: {                            // PC IP config (double-click modal - user entered)
                PC0: { ip: "", mask: "", gw: "" },
                PC1: { ip: "", mask: "", gw: "" },
                PC2: { ip: "", mask: "", gw: "" },
                PC3: { ip: "", mask: "", gw: "" }
            }
        },

        // Part B — RIP v2
        b: {
            activeRouter: "R0",
            cliMode: { R0: "user", R1: "user" },
            cliPrompt: { R0: "Router0>", R1: "Router1>" },
            ifContext: { R0: "", R1: "" },
            ripConfigured: { R0: false, R1: false },
            ripNetworks: { R0: new Set(), R1: new Set() },
            ripVersion: { R0: 2, R1: 2 },
            noAutoSummary: { R0: false, R1: false },
            clockSet: { R0: false },
            wanUp: true,
            converged: false,
            pcConfigured: {
                PC0: { ip: "", mask: "", gw: "" },
                PC1: { ip: "", mask: "", gw: "" },
                PC2: { ip: "", mask: "", gw: "" },
                PC3: { ip: "", mask: "", gw: "" }
            }
        }
    };



    // Topology connection tracking (for canvas rendering)
    let connectMode = false;
    let deleteMode = false;
    let firstConnectNode = null;

    /* ═══════════════════════════════════════════════
     * ROUTER ADDRESS TABLES (pre-configured)
     * ═══════════════════════════════════════════════ */

    // Part A RIP v1 addressing (classful /8, /24)
    const ADDR_A = {
        R0: {
            "GigabitEthernet0/0": { ip: "192.168.10.1",  mask: "255.255.255.0", cidr: 24 },
            "GigabitEthernet0/1": { ip: "192.168.11.1",  mask: "255.255.255.0", cidr: 24 },
            "Serial0/1/0":        { ip: "10.0.0.1",      mask: "255.0.0.0",     cidr: 8, dce: true }
        },
        R1: {
            "Serial0/1/0":        { ip: "10.0.0.2",      mask: "255.0.0.0",     cidr: 8  },
            "GigabitEthernet0/0": { ip: "192.168.12.1",  mask: "255.255.255.0", cidr: 24 },
            "GigabitEthernet0/1": { ip: "192.168.13.1",  mask: "255.255.255.0", cidr: 24 }
        }
    };

    // Part B RIP v2 addressing (classless /27)
    const ADDR_B = {
        R0: {
            "GigabitEthernet0/0": { ip: "192.168.10.1",  mask: "255.255.255.224", cidr: 27 },
            "GigabitEthernet0/1": { ip: "192.168.10.33", mask: "255.255.255.224", cidr: 27 },
            "Serial0/1/0":        { ip: "192.168.10.65", mask: "255.255.255.224", cidr: 27, dce: true }
        },
        R1: {
            "Serial0/1/0":        { ip: "192.168.10.66", mask: "255.255.255.224", cidr: 27 },
            "GigabitEthernet0/0": { ip: "192.168.10.97", mask: "255.255.255.224", cidr: 27 },
            "GigabitEthernet0/1": { ip: "192.168.10.129",mask: "255.255.255.224", cidr: 27 }
        }
    };

    /* ═══════════════════════════════════════════════
     * UTILITY FUNCTIONS
     * ═══════════════════════════════════════════════ */

    function logObs(category, detail, outcome) {
        if (typeof window.addObservation === "function") {
            window.addObservation(category, detail, outcome);
        } else if (typeof addObservation === "function") {
            addObservation(category, detail, outcome);
        }
    }

    window.setServerMilestones = function (serverMilestones) {
        if (Array.isArray(serverMilestones)) {
            if (serverMilestones.includes("7A_TOPOLOGY") || serverMilestones.includes("7B_TOPOLOGY")) {
                state.topologyValid = true;
            }
            if (serverMilestones.includes("7A_CONVERGED")) {
                state.a.converged = true;
                updateConvergenceBadge("a");
            }
            if (serverMilestones.includes("7B_CONVERGED")) {
                state.b.converged = true;
                updateConvergenceBadge("b");
            }
        }
    };

    function inet4pton(ip) {
        const parts = ip.split(".").map(Number);
        return (parts[0] << 24 | parts[1] << 16 | parts[2] << 8 | parts[3]) >>> 0;
    }

    function networkAddr(ip, mask) {
        return inet4pton(ip) & inet4pton(mask);
    }

    function sameNetwork(ipA, ipB, mask) {
        const m = inet4pton(mask);
        return (inet4pton(ipA) & m) === (inet4pton(ipB) & m);
    }

    function cidrToMask(cidr) {
        const n = cidr >>> 0;
        return [(0xFFFFFFFF << (32 - n)) >>> 0].map(v =>
            [(v >> 24) & 0xFF, (v >> 16) & 0xFF, (v >> 8) & 0xFF, v & 0xFF].join(".")
        )[0];
    }

    function maskToCidr(mask) {
        let n = inet4pton(mask), c = 0;
        while (n) { c += n & 1; n >>>= 1; }
        return c;
    }

    function networkToString(ip, mask) {
        const net = (inet4pton(ip) & inet4pton(mask)) >>> 0;
        const a = [(net >> 24) & 0xFF, (net >> 16) & 0xFF, (net >> 8) & 0xFF, net & 0xFF];
        return a.join(".") + "/" + maskToCidr(mask);
    }

    /* ═══════════════════════════════════════════════
     * ROUTING TABLE COMPUTATION
     * ═══════════════════════════════════════════════ */

    /**
     * Build the routing table for a router given state.
     * Returns array of route objects: { type, network, mask, cidr, via, iface, metric }
     */
    function buildRouteTable(part, routerKey) {
        // part = "a" | "b"
        const ps = state[part];
        const ADDR = part === "a" ? ADDR_A : ADDR_B;
        const rAddr = ADDR[routerKey];
        const peerKey = routerKey === "R0" ? "R1" : "R0";
        const peerAddr = ADDR[peerKey];
        const routes = [];

        // Directly connected routes (always present, regardless of RIP)
        Object.entries(rAddr).forEach(([iface, a]) => {
            routes.push({ type: "C", network: networkToString(a.ip, a.mask), mask: a.mask, cidr: a.cidr, via: "—", iface, metric: 0 });
            routes.push({ type: "L", network: a.ip + "/" + maskToCidr(a.mask) + " (HOST)", mask: a.mask, cidr: 255, via: "—", iface, metric: 0 });
        });

        if (ps.converged && ps.wanUp) {
            // Add RIP-learned routes from peer's interfaces
            Object.entries(peerAddr).forEach(([iface, a]) => {
                // Only advertise LAN interfaces of peer (skip the WAN interface that connects to us)
                const isWanIface = iface.startsWith("Serial");
                if (!isWanIface || part === "b") {
                    const network = networkToString(a.ip, a.mask);
                    if (!routes.find(r => r.network === network && r.type === "C")) {
                        // determine via IP: the peer's serial interface toward us
                        const peerSerial = peerAddr["Serial0/1/0"];
                        const viaIp = peerSerial ? peerSerial.ip : "?";
                        routes.push({ type: "R", network, mask: a.mask, cidr: a.cidr, via: viaIp, iface: "Serial0/1/0", metric: 1 });
                    }
                }
            });
        }

        return routes;
    }

    function renderRoutingTables(part) {
        const containerId = part === "a" ? "exp7a-routing-tables" : "exp7b-routing-tables";
        const el = document.getElementById(containerId);
        if (!el) return;
        const ps = state[part];

        const makeTable = (routerKey, label) => {
            const routes = buildRouteTable(part, routerKey);
            let rows = "";
            routes.forEach((r, idx) => {
                const typeColor = r.type === "C" ? "#047857" : r.type === "L" ? "#0369A1" : r.type === "R" ? "#B45309" : "#475569";
                const rowBg = idx % 2 === 0 ? "#FFFFFF" : "#F8FAFC";
                rows += `<tr style="border-bottom:1px solid #E2E8F0; background:${rowBg};">
                    <td style="padding:0.4rem 0.5rem; color:${typeColor}; font-weight:700;">${r.type}</td>
                    <td style="padding:0.4rem 0.5rem; font-family:monospace; font-size:0.8rem; color:#0F172A; font-weight:500;">${r.network}</td>
                    <td style="padding:0.4rem 0.5rem; font-family:monospace; font-size:0.8rem; color:#475569;">${r.via}</td>
                    <td style="padding:0.4rem 0.5rem; font-family:monospace; font-size:0.8rem; color:#475569;">${r.iface}</td>
                </tr>`;
            });

            const convergedBadge = ps.converged && ps.wanUp
                ? '<span style="font-size:0.72rem; background:#059669; color:white; padding:0.15rem 0.45rem; border-radius:3px; margin-left:0.5rem; font-weight:600;">CONVERGED</span>'
                : '<span style="font-size:0.72rem; background:#D97706; color:white; padding:0.15rem 0.45rem; border-radius:3px; margin-left:0.5rem; font-weight:600;">PENDING</span>';

            return `<div style="background:#FFFFFF; border:1px solid #CBD5E1; border-radius:6px; padding:0.75rem; overflow-x:auto; box-shadow:0 1px 3px rgba(0,0,0,0.05);">
                <div style="color:#1E293B; font-family:monospace; font-size:0.85rem; margin-bottom:0.5rem; font-weight:700; display:flex; align-items:center;">
                    <span>${label} &mdash; show ip route</span> ${convergedBadge}
                </div>
                <table style="width:100%; border-collapse:collapse; font-size:0.8rem;">
                    <thead><tr style="background:#F1F5F9; border-bottom:2px solid #CBD5E1; color:#334155; font-size:0.75rem;">
                        <th style="padding:0.35rem 0.5rem; text-align:left; font-weight:600;">Type</th>
                        <th style="padding:0.35rem 0.5rem; text-align:left; font-weight:600;">Network / Host</th>
                        <th style="padding:0.35rem 0.5rem; text-align:left; font-weight:600;">Via (Next Hop)</th>
                        <th style="padding:0.35rem 0.5rem; text-align:left; font-weight:600;">Interface</th>
                    </tr></thead>
                    <tbody>${rows}</tbody>
                </table>
                <div style="color:#64748B; font-size:0.72rem; margin-top:0.5rem; padding-top:0.35rem; border-top:1px solid #F1F5F9;">
                    Legend: <span style="color:#047857; font-weight:600;">C</span> = Connected &nbsp;|&nbsp;
                    <span style="color:#0369A1; font-weight:600;">L</span> = Local &nbsp;|&nbsp;
                    <span style="color:#B45309; font-weight:600;">R</span> = RIP
                </div>
            </div>`;
        };

        el.innerHTML = makeTable("R0", "Router0") + makeTable("R1", "Router1");
    }

    /* ═══════════════════════════════════════════════
     * TOPOLOGY BUILDER (shared between parts)
     * ═══════════════════════════════════════════════ */

    function initTopologyBuilder() {
        const canvas = document.getElementById("topology-canvas");
        const svgLayer = document.getElementById("connection-layer");
        if (!canvas) return;

        // Drag from palette
        document.querySelectorAll(".draggable-item[draggable='true']").forEach(item => {
            item.addEventListener("dragstart", e => {
                e.dataTransfer.setData("deviceType", item.dataset.type);
                e.dataTransfer.setData("deviceIcon", item.dataset.icon);
            });
        });

        canvas.addEventListener("dragover", e => e.preventDefault());
        canvas.addEventListener("drop", e => {
            e.preventDefault();
            const type = e.dataTransfer.getData("deviceType");
            const icon = e.dataTransfer.getData("deviceIcon");
            if (!type) return;

            const rect = canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            const idx = nodeCounters[type]++;
            const labels = { PC: `PC${idx}`, Switch: `Switch${idx}`, Router: idx === 0 ? "Router0" : `Router${idx}` };
            const label = labels[type] || (type + idx);

            const posX = Math.max(0, Math.min(x - 32, canvas.clientWidth - 68));
            const posY = Math.max(0, Math.min(y - 32, canvas.clientHeight - 68));

            addNodeToCanvas(canvas, svgLayer, type, icon, label, posX, posY);
        });

        // Connect mode toggle
        const connectBtn = document.getElementById("connect-mode-btn");
        const deleteBtn = document.getElementById("delete-mode-btn");

        function toggleDeleteMode() {
            deleteMode = !deleteMode;
            if (deleteMode) {
                if (connectMode && connectBtn) {
                    connectMode = false;
                    connectBtn.style.backgroundColor = "var(--secondary-color)";
                    connectBtn.innerHTML = '<i data-lucide="link"></i> Enable Connect Mode';
                    if (firstConnectNode) {
                        firstConnectNode.style.boxShadow = "";
                        firstConnectNode = null;
                    }
                }
                if (deleteBtn) {
                    deleteBtn.style.backgroundColor = '#EF4444';
                    deleteBtn.style.color = 'white';
                    deleteBtn.style.borderColor = '#DC2626';
                    deleteBtn.innerHTML = '<i data-lucide="x-circle"></i> Exit Delete Mode';
                }
                if (canvas) canvas.style.cursor = 'not-allowed';
            } else {
                if (deleteBtn) {
                    deleteBtn.style.backgroundColor = '#FEF2F2';
                    deleteBtn.style.color = '#DC2626';
                    deleteBtn.style.borderColor = '#FECACA';
                    deleteBtn.innerHTML = '<i data-lucide="trash-2"></i> Delete Tool';
                }
                if (canvas) canvas.style.cursor = 'default';
            }

            if (canvas) {
                canvas.querySelectorAll('.btn-node-delete').forEach(d => {
                    d.style.display = deleteMode ? 'block' : 'none';
                });
                canvas.querySelectorAll('.btn-wire-delete').forEach(w => {
                    w.style.display = deleteMode ? 'flex' : 'none';
                });
            }
            refreshConnections(svgLayer);
            if (window.lucide) lucide.createIcons();
        }

        if (deleteBtn) {
            deleteBtn.addEventListener("click", toggleDeleteMode);
        }

        if (connectBtn) {
            connectBtn.addEventListener("click", () => {
                connectMode = !connectMode;
                if (firstConnectNode) {
                    firstConnectNode.style.boxShadow = "";
                    firstConnectNode = null;
                }
                if (connectMode) {
                    if (deleteMode) {
                        deleteMode = false;
                        if (deleteBtn) {
                            deleteBtn.style.backgroundColor = '#FEF2F2';
                            deleteBtn.style.color = '#DC2626';
                            deleteBtn.style.borderColor = '#FECACA';
                            deleteBtn.innerHTML = '<i data-lucide="trash-2"></i> Delete Tool';
                        }
                        if (canvas) {
                            canvas.querySelectorAll('.btn-node-delete').forEach(d => {
                                d.style.display = 'none';
                            });
                            canvas.querySelectorAll('.btn-wire-delete').forEach(w => {
                                w.style.display = 'none';
                            });
                        }
                    }
                    connectBtn.style.backgroundColor = "var(--accent-color)";
                    connectBtn.innerHTML = '<i data-lucide="mouse-pointer"></i> Enable Move Mode';
                    canvas.style.cursor = "crosshair";
                } else {
                    connectBtn.style.backgroundColor = "var(--secondary-color)";
                    connectBtn.innerHTML = '<i data-lucide="link"></i> Enable Connect Mode';
                    canvas.style.cursor = "default";
                }
                refreshConnections(svgLayer);
                if (window.lucide) lucide.createIcons();
            });
        }

        // Check topology button
        const checkBtn = document.getElementById("check-topology");
        if (checkBtn) checkBtn.addEventListener("click", validateTopology);

        // Reset topology
        const resetBtn = document.getElementById("reset-topology");
        if (resetBtn) {
            resetBtn.addEventListener("click", () => {
                canvas.querySelectorAll(".topo-node").forEach(n => n.remove());
                if (svgLayer) svgLayer.innerHTML = "";
                Object.keys(nodeCounters).forEach(k => nodeCounters[k] = 0);
                window._exp7Connections = [];
                connectMode = false;
                deleteMode = false;
                if (firstConnectNode) {
                    firstConnectNode.style.boxShadow = "";
                    firstConnectNode = null;
                }
                document.getElementById("topology-feedback").textContent = "";
                if (connectBtn) {
                    connectBtn.style.backgroundColor = "var(--secondary-color)";
                    connectBtn.innerHTML = '<i data-lucide="link"></i> Enable Connect Mode';
                }
                if (deleteBtn) {
                    deleteBtn.style.backgroundColor = '#FEF2F2';
                    deleteBtn.style.color = '#DC2626';
                    deleteBtn.style.borderColor = '#FECACA';
                    deleteBtn.innerHTML = '<i data-lucide="trash-2"></i> Delete Tool';
                }
                canvas.style.cursor = "default";
                if (window.lucide) lucide.createIcons();
                document.getElementById("exp7a-ip-stage").style.display = "none";
                state.topologyValid = false;
                logObs("Topology Builder", "Canvas reset", "Success");
            });
        }
    }

    function addNodeToCanvas(canvas, svgLayer, type, icon, label, x, y) {
        const node = document.createElement("div");
        node.className = "topo-node";
        node.dataset.type = type;
        node.dataset.label = label;
        node.style.position = "absolute";
        node.style.left = `${x}px`;
        node.style.top = `${y}px`;
        node.style.width = "68px";
        node.style.height = "68px";
        node.style.display = "flex";
        node.style.flexDirection = "column";
        node.style.alignItems = "center";
        node.style.justifyContent = "center";
        node.style.background = "white";
        node.style.border = "2px solid var(--primary-color)";
        node.style.borderRadius = "10px";
        node.style.cursor = connectMode ? "crosshair" : "grab";
        node.style.userSelect = "none";
        node.style.zIndex = "10";
        node.style.boxShadow = "0 2px 6px rgba(0, 0, 0, 0.08)";
        node.style.padding = "4px 2px";
        node.style.boxSizing = "border-box";

        const iconSrc = {
            PC: "assets/icons/pc.svg",
            Switch: "assets/icons/switch.svg",
            Router: "assets/icons/router.svg"
        }[type] || "assets/icons/pc.svg";

        node.innerHTML = `
            <img src="${iconSrc}" width="28" height="28" alt="${type}" style="pointer-events:none; margin: 0 auto 3px auto; display: block;">
            <span style="font-size:0.75rem; font-weight:700; color:#1E293B; pointer-events:none; text-align:center; line-height:1.1;">${label}</span>
        `;

        const delBtn = document.createElement("button");
        delBtn.className = "btn-node-delete";
        delBtn.title = `Delete ${label}`;
        delBtn.innerHTML = "&times;";
        delBtn.style.cssText = `position:absolute; top:-7px; right:-7px; width:18px; height:18px; background:#EF4444; color:white; border:none; border-radius:50%; font-size:12px; font-weight:bold; line-height:18px; text-align:center; cursor:pointer; padding:0; z-index:30; box-shadow:0 1px 3px rgba(0,0,0,0.3);`;
        delBtn.style.display = deleteMode ? 'block' : 'none';
        node.appendChild(delBtn);

        function removeExp7Node() {
            node.remove();
            for (let i = window._exp7Connections.length - 1; i >= 0; i--) {
                if (window._exp7Connections[i].nodeA === node || window._exp7Connections[i].nodeB === node) {
                    window._exp7Connections.splice(i, 1);
                }
            }
            refreshConnections(svgLayer);
            const feedback = document.getElementById("topology-feedback");
            if (feedback) feedback.textContent = "";
            logObs("Topology Builder", `Deleted ${label}`, "Node removed");
        }

        delBtn.addEventListener("click", e => {
            e.stopPropagation();
            removeExp7Node();
        });

        canvas.appendChild(node);
        logObs("Topology Builder", "Added " + type, "Node placed");

        // Dragging (reposition)
        let isDragging = false, startX, startY, origX, origY;
        node.addEventListener("mousedown", e => {
            if (deleteMode) {
                e.stopPropagation();
                removeExp7Node();
                return;
            }
            if (connectMode) {
                e.stopPropagation();
                handleConnectClick(node, canvas, svgLayer);
                return;
            }
            if (e.target.tagName === "BUTTON") return;
            isDragging = true;
            startX = e.clientX; startY = e.clientY;
            origX = parseInt(node.style.left) || 0;
            origY = parseInt(node.style.top) || 0;
            node.style.zIndex = "100";
            node.style.cursor = "grabbing";
            e.preventDefault();
        });
        document.addEventListener("mousemove", e => {
            if (!isDragging) return;
            const newX = Math.max(0, Math.min(origX + e.clientX - startX, canvas.clientWidth - 68));
            const newY = Math.max(0, Math.min(origY + e.clientY - startY, canvas.clientHeight - 68));
            node.style.left = newX + "px";
            node.style.top = newY + "px";
            refreshConnections(svgLayer);
        });
        document.addEventListener("mouseup", () => {
            if (isDragging) {
                isDragging = false;
                node.style.zIndex = "10";
                node.style.cursor = connectMode ? "crosshair" : "grab";
            }
        });

        // Double-click to configure PC
        if (type === "PC") {
            node.addEventListener("dblclick", () => openIPConfigModal(label, node));
        }
    }

    // Connection tracking
    window._exp7Connections = window._exp7Connections || [];

    function handleConnectClick(node, canvas, svgLayer) {
        if (!firstConnectNode) {
            firstConnectNode = node;
            node.style.boxShadow = "0 0 0 3px #10B981";
        } else if (firstConnectNode !== node) {
            const cableType = document.getElementById("cable-type-select")?.value || "straight";
            
            // Avoid duplicate connection between same pair
            const exists = window._exp7Connections.some(c => 
                (c.nodeA === firstConnectNode && c.nodeB === node) ||
                (c.nodeA === node && c.nodeB === firstConnectNode)
            );

            if (!exists) {
                window._exp7Connections.push({ nodeA: firstConnectNode, nodeB: node, cableType });
                refreshConnections(svgLayer);
                const typeA = firstConnectNode?.dataset?.type || "Device";
                const typeB = node?.dataset?.type || "Device";
                let actionMsg = `Connected ${typeA} to ${typeB}`;
                if (cableType === "serial" || (typeA === "Router" && typeB === "Router")) {
                    actionMsg = "Connected serial WAN link";
                } else if ((typeA === "PC" && typeB === "Switch") || (typeA === "Switch" && typeB === "PC")) {
                    actionMsg = "Connected PC to Switch";
                } else if ((typeA === "Switch" && typeB === "Router") || (typeA === "Router" && typeB === "Switch")) {
                    actionMsg = "Connected Switch to Router";
                } else if ((typeA === "PC" && typeB === "Router") || (typeA === "Router" && typeB === "PC")) {
                    actionMsg = "Connected PC to Router (crossover)";
                } else if (typeA === "Router" && typeB === "Router") {
                    actionMsg = "Connected Router to Router";
                }
                logObs("Topology Cabling", actionMsg, "Success");
            }
            firstConnectNode.style.boxShadow = "";
            firstConnectNode = null;
        } else {
            firstConnectNode.style.boxShadow = "";
            firstConnectNode = null;
        }
    }

    function getNodeCenter(node, canvas) {
        const left = parseInt(node.style.left) || 0;
        const top = parseInt(node.style.top) || 0;
        return {
            x: left + 34,
            y: top + 34
        };
    }

    function drawLine(nodeA, nodeB, cableType, svgLayer) {
        const canvas = document.getElementById("topology-canvas");
        if (!canvas || !svgLayer) return;
        const a = getNodeCenter(nodeA, canvas);
        const b = getNodeCenter(nodeB, canvas);
        
        const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
        line.setAttribute("x1", a.x); line.setAttribute("y1", a.y);
        line.setAttribute("x2", b.x); line.setAttribute("y2", b.y);
        line.setAttribute("stroke-width", deleteMode ? "4" : "3");

        if (deleteMode) {
            line.setAttribute("stroke", "#EF4444");
            line.setAttribute("stroke-dasharray", "4,4");
            line.style.cursor = "not-allowed";
        } else if (cableType === "crossover") {
            line.setAttribute("stroke", "#D97706");
            line.setAttribute("stroke-dasharray", "6,4");
            line.style.cursor = "pointer";
        } else if (cableType === "serial") {
            line.setAttribute("stroke", "#DC2626");
            line.setAttribute("stroke-dasharray", "8,4");
            line.setAttribute("stroke-width", "4");
            line.style.cursor = "pointer";
        } else {
            // Straight-Through (matching Exp 4's professional blue style)
            line.setAttribute("stroke", "#005BAC");
            line.style.cursor = "pointer";
        }
        
        function removeExp7Edge() {
            const idx = window._exp7Connections.findIndex(c => 
                (c.nodeA === nodeA && c.nodeB === nodeB) ||
                (c.nodeA === nodeB && c.nodeB === nodeA)
            );
            if (idx > -1) {
                window._exp7Connections.splice(idx, 1);
                refreshConnections(svgLayer);
                logObs("Topology Cabling", `Removed link between ${nodeA?.dataset?.label} and ${nodeB?.dataset?.label}`, "Success");
            }
        }

        line.addEventListener("click", () => {
            if (deleteMode) {
                removeExp7Edge();
            }
        });

        svgLayer.appendChild(line);

        const midX = (a.x + b.x) / 2;
        const midY = (a.y + b.y) / 2;
        const delWireBtn = document.createElement("button");
        delWireBtn.className = "btn-wire-delete";
        delWireBtn.title = "Delete cable";
        delWireBtn.innerHTML = "&times;";
        delWireBtn.style.cssText = `position:absolute; left:${Math.round(midX - 11)}px; top:${Math.round(midY - 11)}px; width:22px; height:22px; background:#EF4444; color:white; border:2px solid white; border-radius:50%; font-size:15px; font-weight:bold; line-height:18px; text-align:center; cursor:pointer; padding:0; z-index:15; box-shadow:0 1px 4px rgba(0,0,0,0.35); align-items:center; justify-content:center;`;
        delWireBtn.style.display = deleteMode ? "flex" : "none";

        delWireBtn.addEventListener("click", e => {
            e.stopPropagation();
            removeExp7Edge();
        });

        canvas.appendChild(delWireBtn);
    }

    function refreshConnections(svgLayer) {
        const canvas = document.getElementById("topology-canvas");
        if (!svgLayer) return;
        svgLayer.innerHTML = "";
        if (canvas) {
            canvas.querySelectorAll(".btn-wire-delete").forEach(b => b.remove());
        }
        window._exp7Connections.forEach(({ nodeA, nodeB, cableType }) => {
            if (nodeA && nodeB && nodeA.parentNode && nodeB.parentNode) {
                drawLine(nodeA, nodeB, cableType, svgLayer);
            }
        });
    }

    /* ═══════════════════════════════════════════════
     * TOPOLOGY VALIDATION
     * ═══════════════════════════════════════════════ */

    function validateTopology() {
        const canvas = document.getElementById("topology-canvas");
        const feedback = document.getElementById("topology-feedback");
        if (!canvas || !feedback) return;

        const nodes = Array.from(canvas.querySelectorAll(".topo-node"));
        const pcs = nodes.filter(n => n.dataset.type === "PC");
        const switches = nodes.filter(n => n.dataset.type === "Switch");
        const routers = nodes.filter(n => n.dataset.type === "Router");
        const conns = window._exp7Connections || [];

        const errors = [];
        if (pcs.length < 4) errors.push(`Need 4 PCs (found ${pcs.length})`);
        if (switches.length < 4) errors.push(`Need 4 Switches (found ${switches.length})`);
        if (routers.length < 2) errors.push(`Need 2 Routers (found ${routers.length})`);
        if (conns.length < 9) errors.push(`Need at least 9 cables (PC×4→Switch×4→Router×2 + 1 serial WAN link). Found ${conns.length}.`);

        // Check serial link exists between the two routers
        const r0 = routers.find(r => r.dataset.label === "Router0");
        const r1 = routers.find(r => r.dataset.label === "Router1");
        const hasSerial = r0 && r1 && conns.some(c =>
            ((c.nodeA === r0 && c.nodeB === r1) || (c.nodeA === r1 && c.nodeB === r0)) &&
            c.cableType === "serial"
        );
        if (!hasSerial) errors.push("Router0 ↔ Router1 must be connected with a Serial DCE cable.");

        if (errors.length > 0) {
            feedback.innerHTML = `<span style="color:#DC2626;">✘ Topology Invalid:</span><br>• ${errors.join("<br>• ")}`;
            logObs("Topology Checker", "Verified connections", "Failed");
            return;
        }

        // Topology valid
        state.topologyValid = true;
        feedback.innerHTML = `<span style="color:#059669;">✔ Topology Correct! 4 PCs, 4 Switches, 2 Routers — Serial WAN link detected.</span>`;
        document.getElementById("exp7a-ip-stage").style.display = "block";

        // Update Part B topology note
        const noteEl = document.getElementById("exp7b-topo-note");
        if (noteEl) noteEl.style.display = "none";
        const okEl = document.getElementById("exp7b-topo-ok");
        if (okEl) okEl.style.display = "block";

        logObs("Topology Checker", "Verified connections", "Success");
        logObs("Experiment 7", "Milestone: 7A_TOPOLOGY", "Verified");
        logObs("Experiment 7", "Milestone: 7B_TOPOLOGY", "Verified");

        // Render initial routing tables
        renderRoutingTables("a");
        renderRoutingTables("b");

        // Scroll into view
        setTimeout(() => {
            document.getElementById("exp7a-ip-stage")?.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 300);
    }

    /* ═══════════════════════════════════════════════
     * IP CONFIG MODAL (for PC double-click)
     * ═══════════════════════════════════════════════ */

    function openIPConfigModal(label, node) {
        const modal = document.getElementById("ip-config-modal");
        if (!modal) return;

        // Get current Part's PC config
        const activePart = getCurrentPart();
        const pcKey = label;
        const cfg = state[activePart].pcConfigured[pcKey] || {};

        document.getElementById("ip-config-device-name").textContent = label + " — IP Configuration (Part " + activePart.toUpperCase() + ")";
        
        // Show blank inputs for the user to type unless they previously entered and saved values
        document.getElementById("ip-address-input").value = cfg.ip || "";
        document.getElementById("subnet-mask-input").value = cfg.mask || "";
        document.getElementById("gateway-input").value = cfg.gw || "";

        // Dynamic helper placeholders indicating what is expected
        const expHost = (activePart === "a" ? HOST_INFO_A : HOST_INFO_B)[pcKey];
        if (expHost) {
            document.getElementById("ip-address-input").placeholder = "e.g. " + expHost.ip;
            document.getElementById("subnet-mask-input").placeholder = activePart === "a" ? "e.g. 255.255.255.0" : "e.g. 255.255.255.224";
            document.getElementById("gateway-input").placeholder = "e.g. " + expHost.gw;
        }

        document.getElementById("ip-config-error").textContent = "";
        document.getElementById("save-ip-config").dataset.nodeId = label;

        modal.style.display = "flex";
        setTimeout(() => document.getElementById("ip-address-input")?.focus(), 100);
    }

    function getCurrentPart() {
        const bEl = document.getElementById("exp7-part-b");
        return (bEl && bEl.style.display !== "none") ? "b" : "a";
    }

    function closeIPConfigModal() {
        const modal = document.getElementById("ip-config-modal");
        if (modal) modal.style.display = "none";
    }

    function saveIPConfig() {
        const label = document.getElementById("save-ip-config").dataset.nodeId;
        const ip = document.getElementById("ip-address-input").value.trim();
        const mask = document.getElementById("subnet-mask-input").value.trim();
        const gw = document.getElementById("gateway-input").value.trim();
        const errEl = document.getElementById("ip-config-error");

        const ipRegex = /^\d{1,3}(\.\d{1,3}){3}$/;
        if (!ipRegex.test(ip) || !ipRegex.test(mask) || !ipRegex.test(gw)) {
            errEl.textContent = "Enter valid IPv4 addresses for IP, Subnet Mask, and Gateway.";
            return;
        }

        const activePart = getCurrentPart();
        const expected = (activePart === "a" ? HOST_INFO_A : HOST_INFO_B)[label];
        const expMask = activePart === "a" ? "255.255.255.0" : "255.255.255.224";

        if (expected && (ip !== expected.ip || mask !== expMask || gw !== expected.gw)) {
            errEl.innerHTML = `<span style="color:#DC2626;">Incorrect configuration for ${label}. Refer to the Stage 2 Addressing Table.<br>Expected IP: <code>${expected.ip}</code>, Mask: <code>${expMask}</code>, Gateway: <code>${expected.gw}</code></span>`;
            return;
        }

        if (state[activePart].pcConfigured[label]) {
            state[activePart].pcConfigured[label] = { ip, mask, gw };
        }

        logObs("IP Config", `Configured ${label} with IP ${ip}`, "Success");
        logObs("IP Config", `Configured subnet mask ${mask}`, "Success");
        logObs("IP Config", `Configured default gateway ${gw}`, "Success");
        closeIPConfigModal();
    }

    /* ═══════════════════════════════════════════════
     * CISCO IOS CLI SIMULATORS
     * ═══════════════════════════════════════════════ */

    /**
     * Generic CLI handler. Works for Part A and Part B independently.
     * @param {string} part  - "a" | "b"
     * @param {string} rawCmd
     */
    function handleCLICommand(part, rawCmd) {
        const cmd = rawCmd.trim();
        if (!cmd) return;

        const ps = state[part];
        const rk = ps.activeRouter;  // "R0" | "R1"
        const ADDR = part === "a" ? ADDR_A : ADDR_B;
        const rAddr = ADDR[rk];
        const mode = ps.cliMode[rk];

        // Output appenders
        const outputId = part === "a" ? "terminal-output" : "terminal-output-b";
        const promptId = part === "a" ? "terminal-prompt" : "terminal-prompt-b";
        const appended = [];

        function print(line) { appended.push(line); }
        function flush() {
            const el = document.getElementById(outputId);
            if (!el) return;
            const prompt = ps.cliPrompt[rk];
            el.innerHTML += `\n${escapeHtml(prompt)} ${escapeHtml(cmd)}\n`;
            if (appended.length > 0) {
                el.innerHTML += `${escapeHtml(appended.join("\n"))}\n`;
            }
            const term = el.closest(".terminal");
            if (term) term.scrollTop = term.scrollHeight;
            else el.scrollTop = el.scrollHeight;
        }

        // Strip 'do ' prefix
        let effectiveCmd = cmd;
        const isDoCmd = /^do\s+/i.test(cmd);
        if (isDoCmd) effectiveCmd = cmd.replace(/^do\s+/i, "");

        // Execute
        processCommand(part, rk, mode, effectiveCmd, isDoCmd, print, ADDR, rAddr);
        flush();
        // Update prompt
        const promptEl = document.getElementById(promptId);
        if (promptEl) promptEl.textContent = ps.cliPrompt[rk];
    }

    function escapeHtml(s) {
        return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }

    function updatePromptForMode(part, rk) {
        const ps = state[part];
        const mode = ps.cliMode[rk];
        const label = rk === "R0" ? "Router0" : "Router1";
        switch (mode) {
            case "user":       ps.cliPrompt[rk] = `${label}>`; break;
            case "priv":       ps.cliPrompt[rk] = `${label}#`; break;
            case "global":     ps.cliPrompt[rk] = `${label}(config)#`; break;
            case "if":         ps.cliPrompt[rk] = `${label}(config-if)#`; break;
            case "router_rip": ps.cliPrompt[rk] = `${label}(config-router)#`; break;
            default:           ps.cliPrompt[rk] = `${label}>`; break;
        }
    }

    function processCommand(part, rk, mode, cmd, isDoCmd, print, ADDR, rAddr) {
        const ps = state[part];
        const peerKey = rk === "R0" ? "R1" : "R0";
        const label = rk === "R0" ? "Router0" : "Router1";
        const cmdLower = cmd.trim().toLowerCase();

        // ── Enable ──
        if (cmdLower === "enable" || cmdLower === "en") {
            if (mode === "user") {
                ps.cliMode[rk] = "priv";
                updatePromptForMode(part, rk);
                logObs("Router CLI", "enable", "Entered privileged EXEC");
            } else {
                print("% Already in privileged EXEC mode.");
            }
            return;
        }

        // ── Disable ──
        if (cmdLower === "disable") {
            ps.cliMode[rk] = "user";
            updatePromptForMode(part, rk);
            logObs("Router CLI", "disable", "Entered user EXEC mode");
            return;
        }

        // ── Exit / end ──
        if (cmdLower === "end") {
            // Cisco IOS 'end' always jumps straight back to privileged EXEC (#) mode from any config mode
            ps.cliMode[rk] = "priv";
            ps.ifContext[rk] = "";
            updatePromptForMode(part, rk);
            logObs("Router CLI", "end", "Returned to privileged EXEC mode");
            return;
        }

        if (cmdLower === "exit" || cmdLower === "quit") {
            if (mode === "router_rip") { ps.cliMode[rk] = "global"; }
            else if (mode === "if")     { ps.cliMode[rk] = "global"; ps.ifContext[rk] = ""; }
            else if (mode === "global") { ps.cliMode[rk] = "priv"; }
            else if (mode === "priv")   { ps.cliMode[rk] = "user"; }
            updatePromptForMode(part, rk);
            logObs("Router CLI", "exit", "Exited current configuration mode");
            return;
        }

        // ── Configure terminal ──
        if (/^config(ure)?\s+t(erminal)?$/.test(cmdLower) || cmdLower === "conf t") {
            if (mode !== "priv" && !isDoCmd) { print("% Enter privileged EXEC mode first (enable)."); return; }
            ps.cliMode[rk] = "global";
            updatePromptForMode(part, rk);
            print("Enter configuration commands, one per line. End with CNTL/Z.");
            logObs("Router CLI", "configure terminal", "Entered global configuration mode");
            return;
        }

        // ── Hostname ──
        if (cmdLower.startsWith("hostname ")) {
            if (mode !== "global") { print("% Command not available in this mode."); return; }
            logObs("Router CLI", cmd, "Hostname configured");
            return;
        }

        // ── Interface ──
        // Support: interface gigabitethernet 0/0, int g0/0, interface g 0/0, int gigabitethernet0/0, serial 0/1/0, s0/1/0, etc.
        const ifMatch = cmd.match(/^int(erface)?\s+([a-z]+)\s*([0-9]+(?:\/[0-9]+)+)/i);
        if (ifMatch) {
            if (mode !== "global" && !isDoCmd) { print("% Command requires global config mode (configure terminal)."); return; }
            const typeStr = ifMatch[2].toLowerCase();
            const portStr = ifMatch[3];
            let rawIf = "";

            if (typeStr.startsWith("g") || typeStr.startsWith("fa")) {
                if (portStr === "0/0" || portStr === "0/1") {
                    rawIf = `GigabitEthernet${portStr}`;
                } else {
                    rawIf = `GigabitEthernet${portStr}`;
                }
            } else if (typeStr.startsWith("s")) {
                if (portStr === "0/1/0" || portStr === "0/0/0" || portStr === "0/0") {
                    rawIf = "Serial0/1/0";
                } else {
                    rawIf = `Serial${portStr}`;
                }
            } else {
                rawIf = `${ifMatch[2]}${portStr}`;
            }

            ps.ifContext[rk] = rawIf;
            ps.cliMode[rk] = "if";
            updatePromptForMode(part, rk);
            logObs("Router CLI", cmd, "Entered interface configuration mode");
            return;
        }

        // ── ip address (in if mode) ──
        const ipAddrMatch = cmd.match(/^ip\s+add(ress)?\s+(\S+)\s+(\S+)/i);
        if (ipAddrMatch && (mode === "if" || isDoCmd)) {
            print(`IP address set on ${ps.ifContext[rk] || "interface"}.`);
            logObs("Router CLI", cmd, `Configured IP address ${ipAddrMatch[2]} ${ipAddrMatch[3]}`);
            return;
        }

        // ── clock rate ──
        const clockMatch = cmd.match(/^clock\s+rate\s+(\d+)/i);
        if (clockMatch && (mode === "if" || isDoCmd)) {
            if (rk === "R0" && (ps.ifContext[rk] === "Serial0/1/0" || isDoCmd || !ps.ifContext[rk])) {
                state[part].a = state[part].a || {};
                ps.clockSet = ps.clockSet || {};
                ps.clockSet["R0"] = true;
                print("Clock rate set to " + clockMatch[1]);
                logObs("Router CLI", cmd, `Clock rate set to ${clockMatch[1]}`);
            } else {
                print("% Clock rate only applies to DCE serial interfaces.");
            }
            return;
        }

        // ── no shutdown / shutdown ──
        if (/^no\s+shut(down)?$/i.test(cmdLower) && (mode === "if" || isDoCmd)) {
            const iface = ps.ifContext[rk] || "interface";
            print(`%LINK-5-CHANGED: Interface ${iface}, changed state to up`);
            print(`%LINEPROTO-5-UPDOWN: Line protocol on Interface ${iface}, changed state to up`);
            logObs("Router CLI", "no shutdown", "Interface enabled");
            return;
        }
        if (/^shut(down)?$/i.test(cmdLower) && (mode === "if" || isDoCmd)) {
            const iface = ps.ifContext[rk] || "interface";
            print(`%LINK-5-CHANGED: Interface ${iface}, changed state to administratively down`);
            print(`%LINEPROTO-5-UPDOWN: Line protocol on Interface ${iface}, changed state to down`);
            logObs("Router CLI", "shutdown", "Interface disabled");
            return;
        }

        // ── router rip ──
        if (/^router\s+rip$/i.test(cmdLower)) {
            if (mode !== "global" && !isDoCmd) { print("% Command requires global configuration mode."); return; }
            ps.cliMode[rk] = "router_rip";
            updatePromptForMode(part, rk);
            logObs("Router CLI", "router rip", "Entered RIP configuration mode");
            return;
        }

        // ── version (inside router rip) ──
        if (/^(ver|version)\s+[12]$/i.test(cmdLower) && (mode === "router_rip" || isDoCmd)) {
            const ver = parseInt(cmdLower.split(/\s+/)[1]);
            ps.ripVersion[rk] = ver;
            print(`RIP version ${ver} enabled on ${label}.`);
            logObs("Router CLI", `version ${ver}`, `RIP version set to ${ver}`);
            checkConvergence(part);
            return;
        }

        // ── no auto-summary (inside router rip) ──
        if (/^no\s+auto(-?summary)?$/i.test(cmdLower) && (mode === "router_rip" || isDoCmd)) {
            if (ps.noAutoSummary) ps.noAutoSummary[rk] = true;
            print("Automatic network summarization disabled.");
            logObs("Router CLI", "no auto-summary", "Automatic summarization disabled");
            checkConvergence(part);
            return;
        }
        if (/^auto(-?summary)?$/i.test(cmdLower) && (mode === "router_rip" || isDoCmd)) {
            if (ps.noAutoSummary) ps.noAutoSummary[rk] = false;
            print("Automatic network summarization enabled.");
            logObs("Router CLI", "auto-summary", "Automatic summarization enabled");
            checkConvergence(part);
            return;
        }

        // ── network (inside router rip) ──
        const netMatch = cmd.match(/^net(work)?\s+(\S+)/i);
        if (netMatch && (mode === "router_rip" || isDoCmd)) {
            const net = netMatch[2];
            ps.ripNetworks[rk].add(net);
            print(`RIP: network ${net} added to routing process.`);
            logObs("Router CLI", cmd, `Network ${net} added`);
            if (part === "a") {
                logObs("Experiment 7", rk === "R0" ? "Milestone: 7A_ROUTER0_RIP" : "Milestone: 7A_ROUTER1_RIP", "Verified");
            } else {
                logObs("Experiment 7", rk === "R0" ? "Milestone: 7B_ROUTER0_RIPV2" : "Milestone: 7B_ROUTER1_RIPV2", "Verified");
            }
            checkConvergence(part);
            return;
        }

        // ── show ip protocols ──
        if (/^(show|sh)\s+ip\s+prot(ocols)?/i.test(cmdLower)) {
            const ver = ps.ripVersion[rk] || (part === "b" ? 2 : 1);
            print(`Routing Protocol is "rip"`);
            print(`  Sending updates every 30 seconds, next due in 18 seconds`);
            print(`  Invalid after 180 seconds, hold down 180, flushed after 240`);
            print(`  Outgoing update filter list for all interfaces is not set`);
            print(`  Incoming update filter list for all interfaces is not set`);
            print(`  Default version control: send version ${ver}, receive version ${ver}`);
            print(`    Interface             Send  Recv  Triggered RIP  Key-chain`);
            print(`    GigabitEthernet0/0    ${ver}     ${ver}`);
            print(`    GigabitEthernet0/1    ${ver}     ${ver}`);
            print(`    Serial0/1/0           ${ver}     ${ver}`);
            if (ps.noAutoSummary && ps.noAutoSummary[rk]) {
                print(`  Automatic network summarization is not in effect`);
            } else {
                print(`  Automatic network summarization is in effect`);
            }
            print(`  Routing for Networks:`);
            if (ps.ripNetworks[rk].size > 0) {
                ps.ripNetworks[rk].forEach(n => print(`    ${n}`));
            } else {
                print(`    (None configured)`);
            }
            print(`  Routing Information Sources:`);
            const peerSerial = ADDR[peerKey] && ADDR[peerKey]["Serial0/1/0"];
            if (ps.converged && peerSerial) {
                print(`    Gateway         Distance      Last Update`);
                print(`    ${peerSerial.ip.padEnd(16)}120           00:00:12`);
            }
            print(`  Distance: (default is 120)`);
            logObs("Router CLI", "show ip protocols", "Routing protocols displayed");
            return;
        }

        // ── show ip route ──
        if (/^(show|sh)\s+ip\s+ro(ute)?/i.test(cmdLower)) {
            const routes = buildRouteTable(part, rk);
            print("Codes: C - connected, L - local, R - RIP");
            print("");
            if (routes.length === 0) {
                print("% Network not in table");
            } else {
                routes.forEach(r => {
                    if (r.type === "C") print(`C    ${r.network} is directly connected, ${r.iface}`);
                    else if (r.type === "L") print(`L    ${r.network} is directly connected, ${r.iface}`);
                    else if (r.type === "R") print(`R    ${r.network} [120/1] via ${r.via}, 00:00:05, ${r.iface}`);
                });
            }
            logObs("Router CLI", "show ip route", "Routing table displayed");
            return;
        }

        // ── show ip interface brief ──
        if (/^(show|sh)\s+ip\s+(int|interface)\s+bri(ef)?/i.test(cmdLower)) {
            print(`Interface                  IP-Address      OK? Method Status                Protocol`);
            const rIfaceAddr = ADDR[rk];
            if (rIfaceAddr) {
                Object.entries(rIfaceAddr).forEach(([iface, a]) => {
                    const statusStr = ps.wanUp ? "up" : (iface.includes("Serial") ? "down" : "up");
                    const protoStr  = ps.wanUp ? "up" : (iface.includes("Serial") ? "down" : "up");
                    print(`${iface.padEnd(27)}${a.ip.padEnd(16)}YES manual ${statusStr.padEnd(22)}${protoStr}`);
                });
            }
            logObs("Router CLI", "show ip interface brief", "Interface status displayed");
            return;
        }

        // ── show running-config (abbreviated) ──
        if (/^(show|sh)\s+(run|running-config)/i.test(cmdLower)) {
            const rIfaceAddr = ADDR[rk];
            print("Building configuration...");
            print(`hostname ${label}`);
            print("!");
            if (rIfaceAddr) {
                Object.entries(rIfaceAddr).forEach(([iface, a]) => {
                    print(`interface ${iface}`);
                    print(` ip address ${a.ip} ${a.mask}`);
                    if (a.dce) print(` clock rate 64000`);
                    print(` no shutdown`);
                    print("!");
                });
            }
            if (ps.ripNetworks[rk].size > 0 || ps.ripConfigured[rk]) {
                print("router rip");
                print(` version ${ps.ripVersion[rk]}`);
                ps.ripNetworks[rk].forEach(n => print(` network ${n}`));
                if (ps.noAutoSummary && ps.noAutoSummary[rk]) print(" no auto-summary");
                print("!");
            }
            print("end");
            logObs("Router CLI", "show running-config", "Running configuration displayed");
            return;
        }

        // ── ping ──
        const pingMatch = cmd.match(/^ping\s+(\S+)/i);
        if (pingMatch) {
            const targetIp = pingMatch[1];
            const reachable = isReachable(part, rk, targetIp);
            print(`Type escape sequence to abort.`);
            print(`Sending 5, 100-byte ICMP Echos to ${targetIp}, timeout is 2 seconds:`);
            if (reachable) {
                print("!!!!!");
                print(`Success rate is 100 percent (5/5), round-trip min/avg/max = 1/2/3 ms`);
                logObs("Router CLI", cmd, "Success");
            } else {
                print(".....");
                print(`Success rate is 0 percent (0/5)`);
                logObs("Router CLI", cmd, "Failed");
            }
            return;
        }

        // ── traceroute / tracert ──
        const traceMatch = cmd.match(/^(trac(eroute)?|tracert)\s+(\S+)/i);
        if (traceMatch) {
            const targetIp = traceMatch[3];
            const reachable = isReachable(part, rk, targetIp);
            print(`Type escape sequence to abort.`);
            print(`Tracing the route to ${targetIp}`);
            if (reachable) {
                const peerSerial = ADDR[peerKey] && ADDR[peerKey]["Serial0/1/0"];
                const mySerial = ADDR[rk] && ADDR[rk]["Serial0/1/0"];
                if (mySerial) print(`  1  ${mySerial.ip}  1 msec  1 msec  1 msec`);
                if (peerSerial) print(`  2  ${peerSerial.ip}  2 msec  2 msec  2 msec`);
                print(`  3  ${targetIp}  3 msec  3 msec  3 msec`);
                logObs("Router CLI", cmd, "Packet trace completed");
            } else {
                print(`  1  * * *`);
                print(`  2  * * *`);
                print(`Destination unreachable.`);
                logObs("Router CLI", cmd, "Destination unreachable");
            }
            return;
        }

        // ── debug ip rip ──
        if (/^debug\s+ip\s+rip/i.test(cmdLower)) {
            if (ps.converged) {
                print("RIP protocol debugging is on");
                const peerSerial = ADDR[peerKey] && ADDR[peerKey]["Serial0/1/0"];
                const myG0 = ADDR[rk] && ADDR[rk]["GigabitEthernet0/0"];
                print(`RIP: sending v${ps.ripVersion[rk]} update to 255.255.255.255 via ${myG0?.ip}`);
                ps.ripNetworks[rk].forEach(n => print(`RIP: sending update for ${n}`));
                if (peerSerial) print(`RIP: received v${ps.ripVersion[peerKey]} update from ${peerSerial.ip}`);
            } else {
                print("RIP: No RIP updates. Configure RIP on both routers first.");
            }
            logObs("Router CLI", "debug ip rip", "RIP debugging enabled");
            return;
        }

        // ── undebug all ──
        if (/^(undebug|un\s+all|no\s+debug)/i.test(cmdLower)) {
            print("All possible debugging has been turned off");
            logObs("Router CLI", cmd, "Debugging disabled");
            return;
        }

        // ── ? / help ──
        if (cmdLower === "?" || cmdLower === "help") {
            print("Available commands (abbreviated):");
            if (mode === "user")   print("  enable, exit, ping <ip>, traceroute <ip>");
            if (mode === "priv")   print("  configure terminal, show ip route, show ip protocols, show ip interface brief, show running-config, ping <ip>, traceroute <ip>, exit, disable");
            if (mode === "global") print("  interface <intf>, router rip, hostname <name>, exit, end");
            if (mode === "if")     print("  ip address <ip> <mask>, clock rate <rate>, no shutdown, shutdown, exit, end");
            if (mode === "router_rip") print("  version 1|2, network <net>, no auto-summary, auto-summary, exit, end");
            return;
        }

        // ── Unknown ──
        print(`% Unrecognized command: "${cmd}". Type '?' for help.`);
    }

    /**
     * Check if an IP is reachable from a given router in a given part scenario.
     */
    function isReachable(part, rk, targetIp) {
        const ps = state[part];
        if (!ps.wanUp) {
            // Only locally connected nets are reachable if WAN is down
            const ADDR_X = part === "a" ? ADDR_A : ADDR_B;
            return Object.values(ADDR_X[rk]).some(a =>
                sameNetwork(a.ip, targetIp, a.mask)
            );
        }
        if (!ps.converged) {
            // Only locally connected
            const ADDR_X = part === "a" ? ADDR_A : ADDR_B;
            return Object.values(ADDR_X[rk]).some(a =>
                sameNetwork(a.ip, targetIp, a.mask)
            );
        }
        // Fully converged — all addresses reachable
        return true;
    }

    /**
     * Check if convergence conditions are met and update state/UI accordingly.
     */
    function checkConvergence(part) {
        const ps = state[part];
        const r0Done = ps.ripNetworks.R0.size >= 1;
        const r1Done = ps.ripNetworks.R1.size >= 1;

        // Part B additionally requires version 2 and no auto-summary on both
        let partBReady = true;
        if (part === "b") {
            partBReady = (ps.ripVersion.R0 === 2) && (ps.ripVersion.R1 === 2) &&
                         (ps.noAutoSummary && ps.noAutoSummary.R0) && (ps.noAutoSummary.R1);
        }

        if (r0Done && r1Done && ps.wanUp && (part === "a" || partBReady)) {
            if (!ps.converged) {
                ps.converged = true;
                ps.ripConfigured.R0 = true;
                ps.ripConfigured.R1 = true;
                announceConvergence(part);
            }
        } else {
            ps.converged = false;
        }
        renderRoutingTables(part);
        updateConvergenceBadge(part);
    }

    function announceConvergence(part) {
        const badgeId = part === "a" ? "exp7a-convergence-badge" : "exp7b-convergence-badge";
        const badge = document.getElementById(badgeId);
        if (badge) {
            badge.textContent = "✔ RIP CONVERGED";
            badge.style.background = "#059669";
        }
        // Show convergence message in terminal
        const outId = part === "a" ? "terminal-output" : "terminal-output-b";
        const el = document.getElementById(outId);
        if (el) {
            el.innerHTML += `\n<span style="color:#A3E635;">%RIP: Network convergence complete — dynamic routes learned from peer router.</span>\n`;
            el.scrollTop = el.scrollHeight;
        }
        logObs("Routing", part === "b" ? "RIP v2 configured" : "RIP v1 configured", "Verified");
        logObs("Routing", "Route learned", "Verified");
        logObs("Routing", "Routing table verified", "Verified");

        if (part === "a") {
            logObs("Experiment 7", "Milestone: 7A_ROUTER0_RIP", "Verified");
            logObs("Experiment 7", "Milestone: 7A_ROUTER1_RIP", "Verified");
            logObs("Experiment 7", "Milestone: 7A_CONVERGED", "Verified");
        } else {
            logObs("Experiment 7", "Milestone: 7B_ROUTER0_RIPV2", "Verified");
            logObs("Experiment 7", "Milestone: 7B_ROUTER1_RIPV2", "Verified");
            logObs("Experiment 7", "Milestone: 7B_CONVERGED", "Verified");
        }
    }

    function updateConvergenceBadge(part) {
        const ps = state[part];
        const badgeId = part === "a" ? "exp7a-convergence-badge" : "exp7b-convergence-badge";
        const badge = document.getElementById(badgeId);
        if (!badge) return;
        if (ps.converged && ps.wanUp) {
            badge.textContent = "✔ RIP CONVERGED";
            badge.style.background = "#059669";
        } else if (ps.ripNetworks.R0.size > 0 || ps.ripNetworks.R1.size > 0) {
            badge.textContent = "⏳ PARTIAL CONFIG";
            badge.style.background = "#D97706";
        } else {
            badge.textContent = `AWAITING RIP ${part === "b" ? "v2 " : ""}CONFIG`;
            badge.style.background = "#DC2626";
        }
    }

    /* ═══════════════════════════════════════════════
     * PACKET JOURNEY SIMULATOR
     * ═══════════════════════════════════════════════ */

    const HOST_INFO_A = {
        PC0: { ip: "192.168.10.2",  gw: "192.168.10.1",  lan: "LAN0 via Switch0" },
        PC1: { ip: "192.168.11.2",  gw: "192.168.11.1",  lan: "LAN1 via Switch1" },
        PC2: { ip: "192.168.12.2",  gw: "192.168.12.1",  lan: "LAN2 via Switch2" },
        PC3: { ip: "192.168.13.2",  gw: "192.168.13.1",  lan: "LAN3 via Switch3" }
    };

    const HOST_INFO_B = {
        PC0: { ip: "192.168.10.2",   gw: "192.168.10.1",   lan: "LAN0 (192.168.10.0/27)" },
        PC1: { ip: "192.168.10.34",  gw: "192.168.10.33",  lan: "LAN1 (192.168.10.32/27)" },
        PC2: { ip: "192.168.10.98",  gw: "192.168.10.97",  lan: "LAN2 (192.168.10.96/27)" },
        PC3: { ip: "192.168.10.130", gw: "192.168.10.129", lan: "LAN3 (192.168.10.128/27)" }
    };

    const R0_SIDE_A = new Set(["PC0", "PC1"]);
    const R1_SIDE_A = new Set(["PC2", "PC3"]);
    const R0_SIDE_B = new Set(["PC0", "PC1"]);
    const R1_SIDE_B = new Set(["PC2", "PC3"]);

    function simulatePacketJourney(part) {
        const srcId = part === "a" ? "exp7a-journey-src" : "exp7b-journey-src";
        const dstId = part === "a" ? "exp7a-journey-dst" : "exp7b-journey-dst";
        const outId = part === "a" ? "exp7a-journey-output" : "exp7b-journey-output";

        const src = document.getElementById(srcId)?.value;
        const dst = document.getElementById(dstId)?.value;
        const el  = document.getElementById(outId);
        if (!el || !src || !dst) return;

        const HOST = part === "a" ? HOST_INFO_A : HOST_INFO_B;
        const ps   = state[part];
        const ADDR = part === "a" ? ADDR_A : ADDR_B;
        const R0_SIDE = part === "a" ? R0_SIDE_A : R0_SIDE_B;
        const R1_SIDE = part === "a" ? R1_SIDE_A : R1_SIDE_B;

        const srcH = HOST[src];
        const dstH = HOST[dst];
        if (!srcH || !dstH) { el.textContent = "Unknown host selection."; return; }

        const lines = [];
        lines.push(`╔══════════════════════════════════════════════════════╗`);
        lines.push(`  PACKET JOURNEY: ${src} (${srcH.ip}) → ${dst} (${dstH.ip})`);
        lines.push(`  Protocol: ICMP Echo (Ping)  |  Part ${part.toUpperCase()}: RIP v${part === "a" ? 1 : 2}`);
        lines.push(`╚══════════════════════════════════════════════════════╝`);
        lines.push("");

        if (src === dst) {
            lines.push("▶ Source and destination are the same host. No routing needed.");
            el.textContent = lines.join("\n");
            return;
        }

        const srcOnR0 = R0_SIDE.has(src);
        const dstOnR0 = R0_SIDE.has(dst);

        // In Part B, if PCs were configured in Part A, auto-transition to /27 subnet addressing per Stage 2 Addressing Table
        if (part === "b") {
            ["PC0", "PC1", "PC2", "PC3"].forEach(pcKey => {
                if (!ps.pcConfigured[pcKey] || !ps.pcConfigured[pcKey].ip) {
                    if (state.a.pcConfigured[pcKey] && state.a.pcConfigured[pcKey].ip) {
                        const hInfoB = HOST_INFO_B[pcKey];
                        ps.pcConfigured[pcKey] = {
                            ip: hInfoB.ip,
                            mask: "255.255.255.224",
                            gw: hInfoB.gw
                        };
                    }
                }
            });
        }

        const userSrcCfg = ps.pcConfigured[src] || {};
        const userDstCfg = ps.pcConfigured[dst] || {};

        if (!userSrcCfg.ip || !userDstCfg.ip) {
            lines.push(`[ERROR] ✘ Host IP Configuration Missing!`);
            lines.push(`Double-click ${!userSrcCfg.ip ? src : dst} on the canvas to configure its IP Address, Subnet Mask, and Gateway per the addressing table first.`);
            el.textContent = lines.join("\n");
            logObs("Connectivity", `Ping ${src} → ${dst}`, "Failed — Host IP missing");
            return;
        }

        // Step 1: Source host
        lines.push(`[STEP 1] ${src} (${srcH.ip}) prepares ICMP Echo packet`);
        lines.push(`         Destination: ${dstH.ip}`);
        lines.push(`         Source gateway: ${srcH.gw}`);
        lines.push("");

        if (srcOnR0 === dstOnR0) {
            // Same router side (both on R0 or both on R1)
            const rLabel = srcOnR0 ? "Router0" : "Router1";
            lines.push(`[STEP 2] ${src} sends packet to default gateway ${srcH.gw} (${rLabel})`);
            lines.push(`         ${rLabel} checks routing table for ${dstH.ip}...`);
            lines.push(`         → Found as directly connected network on same router.`);
            lines.push("");
            lines.push(`[STEP 3] ${rLabel} forwards to ${dst} (${dstH.ip}) — intra-router delivery`);
            lines.push("");
            lines.push(`[RESULT] ✔ Delivery successful (same router, no WAN traversal)`);
            logObs("Connectivity", `Ping ${src} → ${dst}`, "Success");
            logObs("Connectivity", "Packet journey completed", "Delivered");
            if (part === "b") {
                logObs("Experiment 7", `Milestone: 7B_CONNECTIVITY`, "Verified");
                logObs("Experiment 7", `Milestone: 7_CONNECTIVITY_VERIFIED`, "Verified");
            } else {
                logObs("Experiment 7", `Milestone: 7A_CONNECTIVITY`, "Verified");
            }
        } else {
            // Cross-router journey
            if (!ps.converged || !ps.wanUp) {
                lines.push(`[STEP 2] ${src} sends packet to gateway ${srcH.gw}`);
                lines.push("");
                if (!ps.converged) {
                    lines.push(`[STEP 3] ✘ FAILED — RIP has not converged yet.`);
                    lines.push(`         Configure RIP on both routers and ensure networks are advertised.`);
                } else if (!ps.wanUp) {
                    lines.push(`[STEP 3] ✘ FAILED — WAN serial link is DOWN.`);
                    lines.push(`         The inter-router link has failed. Restore the WAN link to re-enable routing.`);
                }
                lines.push("");
                lines.push(`[RESULT] ✘ Packet dropped — destination unreachable`);
                logObs("Connectivity", `Ping ${src} → ${dst}`, "Failed");
                el.textContent = lines.join("\n");
                return;
            }

            const srcRouter = srcOnR0 ? "Router0" : "Router1";
            const dstRouter = dstOnR0 ? "Router0" : "Router1";
            const srcRouterKey = srcOnR0 ? "R0" : "R1";
            const dstRouterKey = dstOnR0 ? "R0" : "R1";
            const serialSrc = ADDR[srcRouterKey]["Serial0/1/0"];
            const serialDst = ADDR[dstRouterKey]["Serial0/1/0"];

            const srcSwitch = src === "PC0" ? "Switch0" : src === "PC1" ? "Switch1" : src === "PC2" ? "Switch2" : "Switch3";
            const dstSwitch = dst === "PC0" ? "Switch0" : dst === "PC1" ? "Switch1" : dst === "PC2" ? "Switch2" : "Switch3";
            const srcIface = srcOnR0 ? (src === "PC0" ? "GigabitEthernet0/0" : "GigabitEthernet0/1") : (src === "PC2" ? "GigabitEthernet0/0" : "GigabitEthernet0/1");
            const dstIface = dstOnR0 ? (dst === "PC0" ? "GigabitEthernet0/0" : "GigabitEthernet0/1") : (dst === "PC2" ? "GigabitEthernet0/0" : "GigabitEthernet0/1");

            // Forward Path
            lines.push(`[FORWARD PATH: ${src} → ${dst}]`);
            lines.push(`[STEP 2] ${src} (${srcH.ip}) → ${srcSwitch} → ${srcRouter} (${srcIface})`);
            lines.push(`         Frame sent to default gateway: ${srcH.gw}`);
            lines.push("");
            lines.push(`[STEP 3] ${srcRouter} checks routing table for ${dstH.ip}`);
            if (part === "b") {
                const subnetTarget = dst === "PC0" ? "192.168.10.0/27" : dst === "PC1" ? "192.168.10.32/27" : dst === "PC2" ? "192.168.10.96/27" : "192.168.10.128/27";
                lines.push(`         → RIP v2 longest-prefix match found: R ${subnetTarget} [120/1] via ${serialDst?.ip}, Serial0/1/0`);
            } else {
                lines.push(`         → RIP-learned route found: via Serial0/1/0 (metric 1)`);
            }
            lines.push(`         Forwarding out Serial0/1/0 (${serialSrc?.ip})`);
            lines.push("");
            lines.push(`[STEP 4] Packet traverses WAN Serial DCE/DTE Link:`);
            lines.push(`         ${srcRouter} (Serial0/1/0: ${serialSrc?.ip}) ═══════> ${dstRouter} (Serial0/1/0: ${serialDst?.ip})`);
            lines.push("");
            lines.push(`[STEP 5] ${dstRouter} receives packet and looks up ${dstH.ip} in routing table:`);
            lines.push(`         → Directly connected on ${dstIface}`);
            lines.push(`         Forwarding: ${dstRouter} (${dstIface}) → ${dstSwitch} → ${dst} (${dstH.ip})`);
            lines.push("");
            lines.push(`[STEP 6] ${dst} (${dstH.ip}) receives ICMP Echo Request`);
            lines.push("");

            // Reverse Path (ICMP Echo-Reply)
            lines.push(`[REVERSE PATH: ${dst} → ${src} (ICMP Echo-Reply)]`);
            lines.push(`[STEP 7] ${dst} prepares ICMP Echo-Reply (src=${dstH.ip}, dst=${srcH.ip})`);
            lines.push(`         Sends to gateway ${dstH.gw} via ${dstSwitch} → ${dstRouter} (${dstIface})`);
            lines.push(`[STEP 8] ${dstRouter} checks routing table for ${srcH.ip}`);
            if (part === "b") {
                const srcSubnet = src === "PC0" ? "192.168.10.0/27" : src === "PC1" ? "192.168.10.32/27" : src === "PC2" ? "192.168.10.96/27" : "192.168.10.128/27";
                lines.push(`         → RIP v2 match found: R ${srcSubnet} [120/1] via ${serialSrc?.ip}, Serial0/1/0`);
            } else {
                lines.push(`         → RIP route match via ${serialSrc?.ip}, Serial0/1/0`);
            }
            lines.push(`         Traverses WAN: ${dstRouter} (${serialDst?.ip}) ═══════> ${srcRouter} (${serialSrc?.ip})`);
            lines.push(`[STEP 9] ${srcRouter} delivers reply to ${srcSwitch} → ${src} (${srcH.ip})`);
            lines.push("");
            lines.push(`[RESULT] ✔ End-to-end bidirectional ICMP delivery successful (RTT ~ 2ms, 0% packet loss)`);

            logObs("Connectivity", `Ping ${src} → ${dst}`, "Success");
            logObs("Connectivity", "Packet journey completed", "Delivered");
            if (part === "b") {
                logObs("Experiment 7", `Milestone: 7B_CONNECTIVITY`, "Verified");
                logObs("Experiment 7", `Milestone: 7_CONNECTIVITY_VERIFIED`, "Verified");
            } else {
                logObs("Experiment 7", `Milestone: 7A_CONNECTIVITY`, "Verified");
            }
        }

        el.textContent = lines.join("\n");
    }

    /* ═══════════════════════════════════════════════
     * WAN FAILURE SIMULATION
     * ═══════════════════════════════════════════════ */

    function simulateWANFailure(part) {
        const ps = state[part];
        ps.wanUp = false;
        ps.converged = false;

        const statusId = part === "a" ? "exp7a-wan-status" : "exp7b-wan-status";
        const failBtnId = part === "a" ? "exp7a-fail-wan" : "exp7b-fail-wan";
        const restBtnId = part === "a" ? "exp7a-restore-wan" : "exp7b-restore-wan";

        const statusEl = document.getElementById(statusId);
        const failBtn  = document.getElementById(failBtnId);
        const restBtn  = document.getElementById(restBtnId);

        if (statusEl) { statusEl.textContent = "WAN Serial Link: ⚠ DOWN (Serial Interface Failed)"; statusEl.style.color = "#DC2626"; }
        if (failBtn)  failBtn.style.display = "none";
        if (restBtn)  restBtn.style.display = "inline-flex";

        renderRoutingTables(part);
        updateConvergenceBadge(part);
        logObs("Simulation Activity", `WAN Serial Link Failure (Part ${part.toUpperCase()})`, "WAN link down — routes withdrawn");

        // Show in terminal
        const outId = part === "a" ? "terminal-output" : "terminal-output-b";
        const el = document.getElementById(outId);
        if (el) {
            el.innerHTML += `\n<span style="color:#FCA5A5;">%LINK-3-UPDOWN: Interface Serial0/1/0, changed state to down\n%LINEPROTO-5-UPDOWN: Line protocol on Interface Serial0/1/0, changed state to down\n%RIP: Routes withdrawn for failed interface.</span>\n`;
            el.scrollTop = el.scrollHeight;
        }
    }

    function restoreWANLink(part) {
        const ps = state[part];
        ps.wanUp = true;

        const statusId = part === "a" ? "exp7a-wan-status" : "exp7b-wan-status";
        const failBtnId = part === "a" ? "exp7a-fail-wan" : "exp7b-fail-wan";
        const restBtnId = part === "a" ? "exp7a-restore-wan" : "exp7b-restore-wan";

        const statusEl = document.getElementById(statusId);
        const failBtn  = document.getElementById(failBtnId);
        const restBtn  = document.getElementById(restBtnId);

        if (statusEl) { statusEl.textContent = "WAN Serial Link: ✔ Operational (DCE/DTE Up)"; statusEl.style.color = "#059669"; }
        if (failBtn)  failBtn.style.display = "inline-flex";
        if (restBtn)  restBtn.style.display = "none";

        checkConvergence(part);
        logObs("Simulation Activity", `WAN Serial Link Restored (Part ${part.toUpperCase()})`, "WAN link operational — RIP reconverged");

        const outId = part === "a" ? "terminal-output" : "terminal-output-b";
        const el = document.getElementById(outId);
        if (el) {
            el.innerHTML += `\n<span style="color:#A3E635;">%LINK-3-UPDOWN: Interface Serial0/1/0, changed state to up\n%LINEPROTO-5-UPDOWN: Line protocol on Interface Serial0/1/0, changed state to up\n%RIP: Reconvergence in progress...</span>\n`;
            el.scrollTop = el.scrollHeight;
        }
    }

    /* ═══════════════════════════════════════════════
     * PART NAVIGATION
     * ═══════════════════════════════════════════════ */

    function switchPart(part) {
        document.getElementById("exp7-part-a").style.display = part === "A" ? "block" : "none";
        document.getElementById("exp7-part-b").style.display = part === "B" ? "block" : "none";

        document.querySelectorAll(".exp7-nav-btn").forEach(btn => {
            const isActive = btn.dataset.part === part;
            btn.style.backgroundColor = isActive ? "var(--primary-color)" : "var(--secondary-color)";
            btn.style.color = isActive ? "white" : "";
        });

        // When switching to Part B, carry over valid topology and transition host addressing to /27 subnets if Part A was configured
        if (part === "B" || part === "b") {
            if (state.topologyValid) {
                const noteEl = document.getElementById("exp7b-topo-note");
                if (noteEl) noteEl.style.display = "none";
                const okEl = document.getElementById("exp7b-topo-ok");
                if (okEl) okEl.style.display = "block";
            }
            ["PC0", "PC1", "PC2", "PC3"].forEach(pcKey => {
                if (!state.b.pcConfigured[pcKey] || !state.b.pcConfigured[pcKey].ip) {
                    if (state.a.pcConfigured[pcKey] && state.a.pcConfigured[pcKey].ip) {
                        const hInfoB = HOST_INFO_B[pcKey];
                        state.b.pcConfigured[pcKey] = {
                            ip: hInfoB.ip,
                            mask: "255.255.255.224",
                            gw: hInfoB.gw
                        };
                    }
                }
            });
            renderRoutingTables("b");
            updateConvergenceBadge("b");
        }
    }



    /* ═══════════════════════════════════════════════
     * QUIZ
     * ═══════════════════════════════════════════════ */

    const QUIZ_QUESTIONS = [
        {
            q: "What is the primary difference between RIP v1 and RIP v2?",
            opts: [
                "RIP v1 uses TCP; RIP v2 uses UDP",
                "RIP v2 supports VLSM and sends subnet mask information in updates, while RIP v1 is classful and does not",
                "RIP v2 uses Dijkstra's algorithm; RIP v1 uses Bellman-Ford",
                "RIP v1 supports OSPF areas; RIP v2 does not"
            ],
            ans: 1
        },
        {
            q: "What is the maximum hop count in RIP before a destination is considered unreachable?",
            opts: ["8", "15", "16", "255"],
            ans: 2
        },
        {
            q: "Which RIP command disables automatic classful route summarization in RIP v2?",
            opts: ["no classful", "no auto-summary", "version 2 no-summary", "ip rip classless"],
            ans: 1
        },
        {
            q: "What is RIP's default update interval?",
            opts: ["10 seconds", "30 seconds", "60 seconds", "90 seconds"],
            ans: 1
        },
        {
            q: "In a RIP topology, if the WAN link fails, what happens to dynamically learned routes?",
            opts: [
                "They remain in the routing table indefinitely",
                "They are flushed immediately",
                "After the invalid timer (180s) expires, routes become unreachable and are flushed after the flush timer (240s)",
                "RIP switches to OSPF automatically"
            ],
            ans: 2
        }
    ];

    let quizAnswers = {};

    function renderQuiz() {
        const container = document.getElementById("quiz-container");
        if (!container) return;
        let html = "";
        QUIZ_QUESTIONS.forEach((q, qi) => {
            html += `<div class="quiz-question card" style="margin-bottom:1rem; padding:1rem; border:1px solid var(--border-color); border-radius:6px;">
                <p style="font-weight:600; margin-top:0; margin-bottom:0.5rem;">Q${qi + 1}. ${escapeHtml(q.q)}</p>
                <div>`;
            q.opts.forEach((opt, oi) => {
                html += `<label style="display:flex; align-items:flex-start; gap:0.5rem; margin-bottom:0.35rem; cursor:pointer;">
                    <input type="radio" name="q${qi}" value="${oi}" style="margin-top:0.2rem;" id="q${qi}o${oi}">
                    <span style="font-size:0.9rem;">${escapeHtml(opt)}</span>
                </label>`;
            });
            html += `</div></div>`;
        });
        container.innerHTML = html;
        quizAnswers = {};
        document.getElementById("quiz-results").style.display = "none";
    }

    function submitQuiz() {
        let score = 0;
        let allAnswered = true;
        QUIZ_QUESTIONS.forEach((q, qi) => {
            const sel = document.querySelector(`input[name="q${qi}"]:checked`);
            if (!sel) { allAnswered = false; return; }
            quizAnswers[qi] = parseInt(sel.value);
            if (quizAnswers[qi] === q.ans) score++;
        });

        if (!allAnswered) {
            alert("Please answer all 5 questions before submitting.");
            return;
        }

        const pct = (score / QUIZ_QUESTIONS.length) * 100;
        const passed = pct >= 70;

        const resEl = document.getElementById("quiz-results");
        resEl.style.display = "block";
        resEl.innerHTML = `<div style="background:${passed ? "#F0FDF4" : "#FFF1F2"}; border:1px solid ${passed ? "#BBF7D0" : "#FECDD3"}; padding:1rem; border-radius:6px;">
            <div style="font-size:1.1rem; font-weight:700; color:${passed ? "#059669" : "#DC2626"};">
                ${passed ? "✔ PASS" : "✘ FAIL"} — Score: ${score}/${QUIZ_QUESTIONS.length} (${pct.toFixed(0)}%)
            </div>
            <div style="font-size:0.875rem; color:#64748B; margin-top:0.25rem;">
                ${passed ? "Congratulations! You have met the 70% passing threshold." : "You need at least 70% (4 correct answers) to pass. Review the theory and try again."}
            </div>
        </div>`;

        logObs("Quiz", "Submitted Quiz", `Attempt ${window.currentAttempt || 1}`);

        // Update Result section
        updateResultSection(score, pct, passed);
    }

    function updateResultSection(score, pct, passed) {
        const resText = document.getElementById("result-text");
        const certBtn = document.getElementById("view-cert-btn");
        if (!resText) return;

        resText.innerHTML = `
            <table style="border-collapse:collapse; width:100%; max-width:480px; margin-bottom:1rem; font-size:0.9rem;">
                <tr style="border-bottom:1px solid var(--border-color);"><td style="padding:0.5rem 0.75rem; font-weight:600; color:#64748B;">Experiment</td><td style="padding:0.5rem 0.75rem;">Exercise 7 — RIP v1 &amp; RIP v2</td></tr>
                <tr style="border-bottom:1px solid var(--border-color);"><td style="padding:0.5rem 0.75rem; font-weight:600; color:#64748B;">Quiz Score</td><td style="padding:0.5rem 0.75rem; font-weight:700; color:${passed ? "#059669" : "#DC2626"};">${score}/5 (${pct.toFixed(0)}%)</td></tr>
                <tr style="border-bottom:1px solid var(--border-color);"><td style="padding:0.5rem 0.75rem; font-weight:600; color:#64748B;">Pass Threshold</td><td style="padding:0.5rem 0.75rem;">70% (4 correct)</td></tr>
                <tr style="border-bottom:1px solid var(--border-color);"><td style="padding:0.5rem 0.75rem; font-weight:600; color:#64748B;">Status</td><td style="padding:0.5rem 0.75rem; font-weight:700; color:${passed ? "#059669" : "#DC2626"};">${passed ? "✔ PASS" : "✘ FAIL"}</td></tr>
                <tr><td style="padding:0.5rem 0.75rem; font-weight:600; color:#64748B;">Topology Valid</td><td style="padding:0.5rem 0.75rem; color:${state.topologyValid ? "#059689" : "#D97706"};">${state.topologyValid ? "✔ Yes" : "Not validated yet"}</td></tr>
            </table>
            ${passed ? '<p style="color:#059669; font-weight:600;">You have successfully completed Exercise 7. Click below to view your certificate.</p>' : '<p style="color:#DC2626;">Please revisit the theory and quiz sections, then resubmit the quiz to obtain a passing grade.</p>'}
        `;

        if (certBtn) certBtn.style.display = passed ? "inline-flex" : "none";
    }

    function openCertificate() {
        const modal = document.getElementById("cert-modal");
        if (!modal) return;
        const nameEl = document.getElementById("cert-name");
        const storedName = window._studentName || localStorage.getItem("studentName") || "Student";
        if (nameEl) nameEl.textContent = storedName;

        const score = QUIZ_QUESTIONS.filter((q, i) => quizAnswers[i] === q.ans).length;
        document.getElementById("cert-score").textContent = `${score}/5 (${(score / 5 * 100).toFixed(0)}%)`;
        document.getElementById("cert-attempt").textContent = "Exercise 7";
        document.getElementById("cert-date").textContent = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
        modal.style.display = "flex";
    }

    /* ═══════════════════════════════════════════════
     * LOAD THEORY / AIM / PROCEDURE FROM DATA FILE
     * Handled by the shared script.js which reads the
     * global `experimentData` variable set by data/experiment7.js
     * ═══════════════════════════════════════════════ */

    /* ═══════════════════════════════════════════════
     * SIDEBAR NAVIGATION (same pattern as other experiments)
     * ═══════════════════════════════════════════════ */

    function initSidebarNav() {
        document.querySelectorAll(".nav-item[data-target]").forEach(item => {
            item.addEventListener("click", () => {
                const target = item.dataset.target;
                document.querySelectorAll(".nav-item").forEach(i => i.classList.remove("active"));
                document.querySelectorAll(".section").forEach(s => s.classList.remove("active"));
                item.classList.add("active");
                const sec = document.getElementById(target);
                if (sec) sec.classList.add("active");
                // Re-render observations whenever the tab is opened
                if (target === "observation" && typeof window.updateObservationTable === "function") {
                    window.updateObservationTable();
                }
            });
        });
    }

    /* ═══════════════════════════════════════════════
     * RESET ALL
     * ═══════════════════════════════════════════════ */

    function resetLab() {
        if (!confirm("Reset the entire lab? All simulation progress will be lost.")) return;

        // Reset all state
        ["a", "b"].forEach(part => {
            const ps = state[part];
            ps.converged = false;
            ps.wanUp = true;
            ps.activeRouter = "R0";
            ps.cliMode.R0 = "user"; ps.cliMode.R1 = "user";
            ps.cliPrompt.R0 = "Router0>"; ps.cliPrompt.R1 = "Router1>";
            ps.ifContext.R0 = ""; ps.ifContext.R1 = "";
            ps.ripConfigured.R0 = false; ps.ripConfigured.R1 = false;
            ps.ripNetworks.R0.clear(); ps.ripNetworks.R1.clear();
            ps.ripVersion.R0 = part === "a" ? 1 : 2;
            ps.ripVersion.R1 = part === "a" ? 1 : 2;
            if (ps.noAutoSummary) { ps.noAutoSummary.R0 = false; ps.noAutoSummary.R1 = false; }
            if (ps.clockSet) { ps.clockSet.R0 = false; }
        });

        state.topologyValid = false;

        // Clear terminals
        ["terminal-output", "terminal-output-b"].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.innerHTML = "";
        });
        ["terminal-prompt", "terminal-prompt-b"].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.textContent = "Router0>";
        });

        // Clear canvas
        const canvas = document.getElementById("topology-canvas");
        if (canvas) canvas.querySelectorAll(".topo-node").forEach(n => n.remove());
        const svgLayer = document.getElementById("connection-layer");
        if (svgLayer) svgLayer.innerHTML = "";
        window._exp7Connections = [];
        Object.keys(nodeCounters).forEach(k => nodeCounters[k] = 0);

        // Reset UI elements
        document.getElementById("topology-feedback").textContent = "";
        document.getElementById("exp7a-ip-stage").style.display = "none";

        // WAN buttons
        ["a", "b"].forEach(part => {
            const statusId = part === "a" ? "exp7a-wan-status" : "exp7b-wan-status";
            const failBtnId = part === "a" ? "exp7a-fail-wan" : "exp7b-fail-wan";
            const restBtnId = part === "a" ? "exp7a-restore-wan" : "exp7b-restore-wan";
            const statusEl = document.getElementById(statusId);
            const failBtn  = document.getElementById(failBtnId);
            const restBtn  = document.getElementById(restBtnId);
            if (statusEl) { statusEl.textContent = "WAN Serial Link: Operational (DCE/DTE Up)"; statusEl.style.color = "#059669"; }
            if (failBtn)  failBtn.style.display = "inline-flex";
            if (restBtn)  restBtn.style.display = "none";
        });

        // Re-render
        renderRoutingTables("a");
        renderRoutingTables("b");
        updateConvergenceBadge("a");
        updateConvergenceBadge("b");

        logObs("Topology Builder", "Canvas reset", "Success");
    }

    /* ═══════════════════════════════════════════════
     * INIT — Wire everything together
     * ═══════════════════════════════════════════════ */

    function init() {
        // Sidebar navigation
        initSidebarNav();

        // Topology builder
        initTopologyBuilder();

        // Part navigation buttons
        document.querySelectorAll(".exp7-nav-btn").forEach(btn => {
            btn.addEventListener("click", () => switchPart(btn.dataset.part));
        });

        // Reset lab
        const resetLabBtn = document.getElementById("exp7-reset-btn");
        if (resetLabBtn) resetLabBtn.addEventListener("click", resetLab);

        // ── CLI Part A ──
        const inputA = document.getElementById("terminal-input");
        const outA   = document.getElementById("terminal-output");
        if (inputA) {
            // Welcome message
            if (outA) outA.innerHTML = `Welcome to Virtual Lab Terminal Simulator. Type 'help' or '?' for commands.`;
            inputA.addEventListener("keydown", e => {
                if (e.key === "Enter") {
                    handleCLICommand("a", inputA.value);
                    inputA.value = "";
                }
            });
        }

        // Router switcher Part A
        const swR0A = document.getElementById("sw-r0");
        const swR1A = document.getElementById("sw-r1");
        if (swR0A) swR0A.addEventListener("click", () => {
            state.a.activeRouter = "R0";
            swR0A.style.backgroundColor = "var(--primary-color)"; swR0A.style.color = "white";
            if (swR1A) { swR1A.style.backgroundColor = "var(--secondary-color)"; swR1A.style.color = ""; }
            const pEl = document.getElementById("terminal-prompt");
            if (pEl) pEl.textContent = state.a.cliPrompt.R0;
            if (outA) {
                outA.innerHTML += `\n[Switched to Router0 terminal]\n`;
                const term = outA.closest(".terminal");
                if (term) term.scrollTop = term.scrollHeight;
            }
        });
        if (swR1A) swR1A.addEventListener("click", () => {
            state.a.activeRouter = "R1";
            swR1A.style.backgroundColor = "var(--primary-color)"; swR1A.style.color = "white";
            if (swR0A) { swR0A.style.backgroundColor = "var(--secondary-color)"; swR0A.style.color = ""; }
            const pEl = document.getElementById("terminal-prompt");
            if (pEl) pEl.textContent = state.a.cliPrompt.R1;
            if (outA) {
                outA.innerHTML += `\n[Switched to Router1 terminal]\n`;
                const term = outA.closest(".terminal");
                if (term) term.scrollTop = term.scrollHeight;
            }
        });

        // ── CLI Part B ──
        const inputB = document.getElementById("terminal-input-b");
        const outB   = document.getElementById("terminal-output-b");
        if (inputB) {
            if (outB) outB.innerHTML = `Welcome to Virtual Lab Terminal Simulator. Type 'help' or '?' for commands.`;
            inputB.addEventListener("keydown", e => {
                if (e.key === "Enter") {
                    handleCLICommand("b", inputB.value);
                    inputB.value = "";
                }
            });
        }

        // Router switcher Part B
        const swR0B = document.getElementById("sw-r0-b");
        const swR1B = document.getElementById("sw-r1-b");
        if (swR0B) swR0B.addEventListener("click", () => {
            state.b.activeRouter = "R0";
            swR0B.style.backgroundColor = "var(--primary-color)"; swR0B.style.color = "white";
            if (swR1B) { swR1B.style.backgroundColor = "var(--secondary-color)"; swR1B.style.color = ""; }
            const pEl = document.getElementById("terminal-prompt-b");
            if (pEl) pEl.textContent = state.b.cliPrompt.R0;
            if (outB) {
                outB.innerHTML += `\n[Switched to Router0 terminal]\n`;
                const term = outB.closest(".terminal");
                if (term) term.scrollTop = term.scrollHeight;
            }
        });
        if (swR1B) swR1B.addEventListener("click", () => {
            state.b.activeRouter = "R1";
            swR1B.style.backgroundColor = "var(--primary-color)"; swR1B.style.color = "white";
            if (swR0B) { swR0B.style.backgroundColor = "var(--secondary-color)"; swR0B.style.color = ""; }
            const pEl = document.getElementById("terminal-prompt-b");
            if (pEl) pEl.textContent = state.b.cliPrompt.R1;
            if (outB) {
                outB.innerHTML += `\n[Switched to Router1 terminal]\n`;
                const term = outB.closest(".terminal");
                if (term) term.scrollTop = term.scrollHeight;
            }
        });

        // WAN failure buttons Part A
        document.getElementById("exp7a-fail-wan")?.addEventListener("click", () => simulateWANFailure("a"));
        document.getElementById("exp7a-restore-wan")?.addEventListener("click", () => restoreWANLink("a"));

        // WAN failure buttons Part B
        document.getElementById("exp7b-fail-wan")?.addEventListener("click", () => simulateWANFailure("b"));
        document.getElementById("exp7b-restore-wan")?.addEventListener("click", () => restoreWANLink("b"));

        // Packet journey buttons
        document.getElementById("exp7a-start-journey")?.addEventListener("click", () => simulatePacketJourney("a"));
        document.getElementById("exp7b-start-journey")?.addEventListener("click", () => simulatePacketJourney("b"));

        // IP config modal
        document.getElementById("close-ip-config")?.addEventListener("click", closeIPConfigModal);
        document.getElementById("save-ip-config")?.addEventListener("click", saveIPConfig);

        // Certificate
        document.getElementById("view-cert-btn")?.addEventListener("click", openCertificate);
        document.getElementById("close-cert")?.addEventListener("click", () => {
            const m = document.getElementById("cert-modal");
            if (m) m.style.display = "none";
        });

        // Render empty routing tables
        renderRoutingTables("a");
        renderRoutingTables("b");
        updateConvergenceBadge("a");
        updateConvergenceBadge("b");

        // Initialize lucide icons
        if (typeof lucide !== "undefined" && lucide.createIcons) {
            try { lucide.createIcons(); } catch (e) {}
        }
    }

    /* Run after DOM ready */
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }

})();
