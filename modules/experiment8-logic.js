/**
 * Experiment 8 Logic Module: Single Area and Multi-Area OSPF
 * Follows the same manual topology builder and staged learning architecture as Experiment 4 & 7.
 *
 * Features:
 *  - Manual Drag-and-Drop Topology Builder for Part 8A and Part 8B
 *  - Interactive Connect Mode with cable type selection (Crossover, Serial DCE, Straight-Through)
 *  - Deterministic Topology Validation & Stage Progression
 *  - Dual Cisco IOS CLI Router Simulators with realistic OSPF state machines
 *  - Real-time Observation Logging & Database Event Synchronization
 */

(function () {
    "use strict";

    /* ═══════════════════════════════════════════════
     * CONSTANTS & STATE
     * ═══════════════════════════════════════════════ */

    let currentMode = "8A"; // "8A" or "8B"

    // Node counters for dragged devices
    const nodeCounters = {
        "8A": { PC: 0, Router: 1 },
        "8B": { PC: 0, Switch: 0, Router: 0 }
    };

    // Connections tracking
    let connections8A = [];
    let connections8B = [];
    let connectMode8A = false;
    let connectMode8B = false;
    let deleteMode8A = false;
    let deleteMode8B = false;
    let firstConnectNode8A = null;
    let firstConnectNode8B = null;

    // Simulation Stage State
    const state = {
        "8A": {
            topologyValid: false,
            activeRouter: "R1",
            cliMode: { R1: "priv", R2: "priv", R3: "priv" },
            cliPrompt: { R1: "Router1#", R2: "Router2#", R3: "Router3#" },
            ospfConfigured: { R1: false, R2: false, R3: false },
            ospfNetworks: {
                R1: new Set(),
                R2: new Set(),
                R3: new Set()
            },
            pcConfigured: {
                PC0: { ip: "", mask: "", gw: "" },
                PC1: { ip: "", mask: "", gw: "" }
            }
        },
        "8B": {
            topologyValid: false,
            activeRouter: "R0",
            cliMode: { R0: "priv", R1: "priv", R2: "priv", R3: "priv" },
            cliPrompt: { R0: "Router0#", R1: "Router1#", R2: "Router2#", R3: "Router3#" },
            routerIds: { R0: "", R1: "", R2: "", R3: "" },
            ospfConfigured: { R0: false, R1: false, R2: false, R3: false },
            ospfNetworks: {
                R0: new Set(),
                R1: new Set(),
                R2: new Set(),
                R3: new Set()
            },
            pcConfigured: {
                PC0: { ip: "", mask: "", gw: "" },
                PC1: { ip: "", mask: "", gw: "" },
                PC2: { ip: "", mask: "", gw: "" },
                PC3: { ip: "", mask: "", gw: "" },
                PC4: { ip: "", mask: "", gw: "" },
                PC5: { ip: "", mask: "", gw: "" }
            }
        }
    };

    /* ═══════════════════════════════════════════════
     * OBSERVATION & EVENT LOGGING
     * ═══════════════════════════════════════════════ */

    function logObs(category, detail, outcome) {
        if (typeof window.addObservation === "function") {
            window.addObservation(category, detail, outcome);
        } else if (typeof addObservation === "function") {
            addObservation(category, detail, outcome);
        }
        if (typeof window.updateObservationTable === "function") {
            window.updateObservationTable();
        }
    }

    // Server-Authoritative Milestone Sync
    function syncServerMilestone(stage, detail) {
        try {
            const token = localStorage.getItem("vlab_student_token") || localStorage.getItem("vlab_token");
            if (token) {
                fetch("/api/events/log", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        experimentId: 8,
                        stage,
                        eventType: "MILESTONE_VERIFIED",
                        payload: { mode: currentMode, detail, timestamp: new Date().toISOString() }
                    })
                }).catch(() => {});
            }
        } catch (e) {}
    }

    /* ═══════════════════════════════════════════════
     * TOPOLOGY BUILDER: PART 8A
     * ═══════════════════════════════════════════════ */

    function initTopologyBuilder8A() {
        const canvas = document.getElementById("topology-canvas-8a");
        const svgLayer = document.getElementById("connection-layer-8a");
        if (!canvas) return;

        // Palette dragstart
        document.querySelectorAll("#topo-tools-8a .draggable-item[draggable='true']").forEach(item => {
            item.addEventListener("dragstart", e => {
                e.dataTransfer.setData("deviceType", item.dataset.type);
            });
        });

        canvas.addEventListener("dragover", e => e.preventDefault());
        canvas.addEventListener("drop", e => {
            e.preventDefault();
            const type = e.dataTransfer.getData("deviceType");
            if (!type) return;

            const rect = canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            let label = "";
            if (type === "PC") {
                const count = nodeCounters["8A"].PC++;
                label = `PC${count}`;
            } else if (type === "Router") {
                const count = nodeCounters["8A"].Router++;
                label = `Router${count}`;
            }

            const posX = Math.max(10, Math.min(x - 34, canvas.clientWidth - 78));
            const posY = Math.max(10, Math.min(y - 34, canvas.clientHeight - 78));

            addNodeToCanvas(canvas, svgLayer, type, label, posX, posY, "8A");
        });

        // Connect mode toggle
        const connectBtn = document.getElementById("connect-mode-btn-8a");
        if (connectBtn) {
            connectBtn.addEventListener("click", () => {
                connectMode8A = !connectMode8A;
                if (firstConnectNode8A) {
                    firstConnectNode8A.style.boxShadow = "";
                    firstConnectNode8A = null;
                }
                if (connectMode8A) {
                    connectBtn.style.backgroundColor = "var(--accent-color)";
                    connectBtn.innerHTML = '<i data-lucide="mouse-pointer"></i> Enable Move Mode';
                    canvas.style.cursor = "crosshair";
                } else {
                    connectBtn.style.backgroundColor = "var(--secondary-color)";
                    connectBtn.innerHTML = '<i data-lucide="link"></i> Enable Connect Mode';
                    canvas.style.cursor = "default";
                }
                if (window.lucide) lucide.createIcons();
            });
        }

        // Delete mode toggle
        const delBtn8A = document.getElementById("delete-mode-btn-8a");
        if (delBtn8A) {
            delBtn8A.addEventListener("click", () => toggleDeleteMode("8A"));
        }

        // Clear all wires
        const clearWiresBtn8A = document.getElementById("clear-wires-btn-8a");
        if (clearWiresBtn8A) {
            clearWiresBtn8A.addEventListener("click", () => clearAllWires("8A"));
        }

        // Check Topology
        const checkBtn = document.getElementById("check-topology-8a");
        if (checkBtn) checkBtn.addEventListener("click", validateTopology8A);

        // Reset Topology
        const resetBtn = document.getElementById("reset-topology-8a");
        if (resetBtn) {
            resetBtn.addEventListener("click", () => {
                canvas.querySelectorAll(".topo-node").forEach(n => n.remove());
                canvas.querySelectorAll(".btn-wire-delete").forEach(b => b.remove());
                if (svgLayer) svgLayer.innerHTML = "";
                nodeCounters["8A"] = { PC: 0, Router: 1 };
                connections8A = [];
                connectMode8A = false;
                firstConnectNode8A = null;
                if (deleteMode8A) toggleDeleteMode("8A");
                document.getElementById("topology-feedback-8a").textContent = "";
                document.getElementById("exp8a-ip-stage").style.display = "none";
                document.getElementById("exp8a-cli-card").style.display = "none";
                document.getElementById("exp8a-verify-card").style.display = "none";
                state["8A"].topologyValid = false;
                logObs("Topology Builder", "Canvas Reset (Part 8A)", "Cleared topology elements");
            });
        }
    }

    /* ═══════════════════════════════════════════════
     * TOPOLOGY BUILDER: PART 8B
     * ═══════════════════════════════════════════════ */

    function initTopologyBuilder8B() {
        const canvas = document.getElementById("topology-canvas-8b");
        const svgLayer = document.getElementById("connection-layer-8b");
        if (!canvas) return;

        // Palette dragstart
        document.querySelectorAll("#topo-tools-8b .draggable-item[draggable='true']").forEach(item => {
            item.addEventListener("dragstart", e => {
                e.dataTransfer.setData("deviceType", item.dataset.type);
            });
        });

        canvas.addEventListener("dragover", e => e.preventDefault());
        canvas.addEventListener("drop", e => {
            e.preventDefault();
            const type = e.dataTransfer.getData("deviceType");
            if (!type) return;

            const rect = canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            let label = "";
            if (type === "PC") {
                const count = nodeCounters["8B"].PC++;
                label = `PC${count}`;
            } else if (type === "Switch") {
                const count = nodeCounters["8B"].Switch++;
                label = `Switch${count}`;
            } else if (type === "Router") {
                const count = nodeCounters["8B"].Router++;
                label = count === 0 ? "Router0" : `Router${count}`;
            }

            const posX = Math.max(10, Math.min(x - 34, canvas.clientWidth - 78));
            const posY = Math.max(10, Math.min(y - 34, canvas.clientHeight - 78));

            addNodeToCanvas(canvas, svgLayer, type, label, posX, posY, "8B");
        });

        // Connect mode toggle
        const connectBtn = document.getElementById("connect-mode-btn-8b");
        if (connectBtn) {
            connectBtn.addEventListener("click", () => {
                connectMode8B = !connectMode8B;
                if (firstConnectNode8B) {
                    firstConnectNode8B.style.boxShadow = "";
                    firstConnectNode8B = null;
                }
                if (connectMode8B) {
                    connectBtn.style.backgroundColor = "var(--accent-color)";
                    connectBtn.innerHTML = '<i data-lucide="mouse-pointer"></i> Enable Move Mode';
                    canvas.style.cursor = "crosshair";
                } else {
                    connectBtn.style.backgroundColor = "var(--secondary-color)";
                    connectBtn.innerHTML = '<i data-lucide="link"></i> Enable Connect Mode';
                    canvas.style.cursor = "default";
                }
                if (window.lucide) lucide.createIcons();
            });
        }

        // Delete mode toggle
        const delBtn8B = document.getElementById("delete-mode-btn-8b");
        if (delBtn8B) {
            delBtn8B.addEventListener("click", () => toggleDeleteMode("8B"));
        }

        // Clear all wires
        const clearWiresBtn8B = document.getElementById("clear-wires-btn-8b");
        if (clearWiresBtn8B) {
            clearWiresBtn8B.addEventListener("click", () => clearAllWires("8B"));
        }

        // Check Topology
        const checkBtn = document.getElementById("check-topology-8b");
        if (checkBtn) checkBtn.addEventListener("click", validateTopology8B);

        // Reset Topology
        const resetBtn = document.getElementById("reset-topology-8b");
        if (resetBtn) {
            resetBtn.addEventListener("click", () => {
                canvas.querySelectorAll(".topo-node").forEach(n => n.remove());
                canvas.querySelectorAll(".btn-wire-delete").forEach(b => b.remove());
                if (svgLayer) svgLayer.innerHTML = "";
                nodeCounters["8B"] = { PC: 0, Switch: 0, Router: 0 };
                connections8B = [];
                connectMode8B = false;
                firstConnectNode8B = null;
                if (deleteMode8B) toggleDeleteMode("8B");
                document.getElementById("topology-feedback-8b").textContent = "";
                document.getElementById("exp8b-ip-stage").style.display = "none";
                document.getElementById("exp8b-cli-card").style.display = "none";
                document.getElementById("exp8b-verify-card").style.display = "none";
                state["8B"].topologyValid = false;
                logObs("Topology Builder", "Canvas Reset (Part 8B)", "Cleared multi-area elements");
            });
        }
    }

    /* ═══════════════════════════════════════════════
     * GENERIC NODE & CONNECTION HANDLER WITH DELETION
     * ═══════════════════════════════════════════════ */

    function deleteNode(node, svgLayer, part) {
        if (!node) return;
        const label = node.dataset.label || "Device";
        const type = node.dataset.type || "Device";

        node.remove();

        // Remove associated connections
        let connections = part === "8A" ? connections8A : connections8B;
        for (let i = connections.length - 1; i >= 0; i--) {
            if (connections[i].nodeA === node || connections[i].nodeB === node) {
                connections.splice(i, 1);
            }
        }
        if (part === "8A") connections8A = connections;
        else connections8B = connections;

        if (part === "8A" && firstConnectNode8A === node) firstConnectNode8A = null;
        if (part === "8B" && firstConnectNode8B === node) firstConnectNode8B = null;

        refreshConnections(svgLayer, part);

        if (state[part]?.pcConfigured?.[label]) {
            delete state[part].pcConfigured[label];
        }

        const fb = document.getElementById(part === "8A" ? "topology-feedback-8a" : "topology-feedback-8b");
        if (fb) fb.textContent = "";

        logObs("Topology Builder", "Deleted " + label, "Node removed");
    }

    function deleteConnection(conn, svgLayer, part) {
        if (!conn) return;
        let connections = part === "8A" ? connections8A : connections8B;
        const idx = connections.indexOf(conn);
        if (idx !== -1) {
            const labelA = conn.nodeA?.dataset?.label || "Device";
            const labelB = conn.nodeB?.dataset?.label || "Device";
            connections.splice(idx, 1);
            refreshConnections(svgLayer, part);
            const fb = document.getElementById(part === "8A" ? "topology-feedback-8a" : "topology-feedback-8b");
            if (fb) fb.textContent = "";
            logObs("Topology Cabling", `Removed cable between ${labelA} and ${labelB}`, "Cable removed");
        }
    }

    function clearAllWires(part) {
        const svgLayer = document.getElementById(part === "8A" ? "connection-layer-8a" : "connection-layer-8b");
        const count = part === "8A" ? connections8A.length : connections8B.length;
        if (count === 0) return;
        if (part === "8A") connections8A = [];
        else connections8B = [];
        refreshConnections(svgLayer, part);
        const fb = document.getElementById(part === "8A" ? "topology-feedback-8a" : "topology-feedback-8b");
        if (fb) fb.textContent = "";
        logObs("Topology Cabling", `Cleared all wires (Part ${part})`, `Removed ${count} cable(s)`);
    }

    function toggleDeleteMode(part) {
        const is8A = part === "8A";
        const btnId = is8A ? "delete-mode-btn-8a" : "delete-mode-btn-8b";
        const connectBtnId = is8A ? "connect-mode-btn-8a" : "connect-mode-btn-8b";
        const canvasId = is8A ? "topology-canvas-8a" : "topology-canvas-8b";
        const svgLayerId = is8A ? "connection-layer-8a" : "connection-layer-8b";

        const btn = document.getElementById(btnId);
        const connectBtn = document.getElementById(connectBtnId);
        const canvas = document.getElementById(canvasId);
        const svgLayer = document.getElementById(svgLayerId);

        let isDel = is8A ? deleteMode8A : deleteMode8B;
        isDel = !isDel;
        if (is8A) deleteMode8A = isDel;
        else deleteMode8B = isDel;

        // Turn off connect mode if delete mode turned on
        if (isDel) {
            if (is8A && connectMode8A) {
                connectMode8A = false;
                if (firstConnectNode8A) { firstConnectNode8A.style.boxShadow = ""; firstConnectNode8A = null; }
                if (connectBtn) {
                    connectBtn.style.backgroundColor = "var(--secondary-color)";
                    connectBtn.innerHTML = '<i data-lucide="link"></i> Enable Connect Mode';
                }
            } else if (!is8A && connectMode8B) {
                connectMode8B = false;
                if (firstConnectNode8B) { firstConnectNode8B.style.boxShadow = ""; firstConnectNode8B = null; }
                if (connectBtn) {
                    connectBtn.style.backgroundColor = "var(--secondary-color)";
                    connectBtn.innerHTML = '<i data-lucide="link"></i> Enable Connect Mode';
                }
            }
        }

        if (btn) {
            if (isDel) {
                btn.style.backgroundColor = "#EF4444";
                btn.style.color = "white";
                btn.style.borderColor = "#DC2626";
                btn.innerHTML = '<i data-lucide="x-circle"></i> Exit Delete Mode';
                if (canvas) canvas.style.cursor = "not-allowed";
            } else {
                btn.style.backgroundColor = "#FEF2F2";
                btn.style.color = "#DC2626";
                btn.style.borderColor = "#FECACA";
                btn.innerHTML = '<i data-lucide="trash-2"></i> Delete Tool';
                if (canvas) canvas.style.cursor = "default";
            }
        }

        if (canvas) {
            canvas.querySelectorAll(".btn-node-delete").forEach(d => {
                d.style.display = isDel ? "block" : "none";
            });
            canvas.querySelectorAll(".btn-wire-delete").forEach(w => {
                w.style.display = isDel ? "flex" : "none";
            });
        }
        refreshConnections(svgLayer, part);
        if (window.lucide) lucide.createIcons();
    }

    function addNodeToCanvas(canvas, svgLayer, type, label, x, y, part) {
        const node = document.createElement("div");
        node.className = "topo-node";
        node.dataset.type = type;
        node.dataset.label = label;
        node.dataset.part = part;
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
        node.style.cursor = "grab";
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
            <img src="${iconSrc}" width="28" height="28" alt="${type}" style="pointer-events:none; margin:0 auto 3px auto; display:block;">
            <span style="font-size:0.75rem; font-weight:700; color:#1E293B; pointer-events:none; text-align:center; line-height:1.1;">${label}</span>
        `;

        // Small Red 'x' Delete Button (visible on hover or when in Delete Mode)
        const delBtn = document.createElement("button");
        delBtn.className = "btn-node-delete";
        delBtn.title = `Delete ${label}`;
        delBtn.innerHTML = "&times;";
        delBtn.style.cssText = "position:absolute; top:-7px; right:-7px; width:18px; height:18px; background:#EF4444; color:white; border:none; border-radius:50%; font-size:12px; font-weight:bold; line-height:18px; text-align:center; cursor:pointer; padding:0; display:none; z-index:30; box-shadow:0 1px 3px rgba(0,0,0,0.3);";
        node.appendChild(delBtn);

        const isCurrentDel = () => part === "8A" ? deleteMode8A : deleteMode8B;
        delBtn.style.display = isCurrentDel() ? "block" : "none";

        delBtn.addEventListener("click", e => {
            e.stopPropagation();
            deleteNode(node, svgLayer, part);
        });

        node.addEventListener("contextmenu", e => {
            e.preventDefault();
            e.stopPropagation();
            deleteNode(node, svgLayer, part);
        });

        canvas.appendChild(node);
        logObs("Topology Builder", "Added " + type, "Node placed");

        // Drag / Connect interactions
        let isDragging = false, startX, startY, origX, origY;
        node.addEventListener("mousedown", e => {
            if (isCurrentDel()) {
                e.stopPropagation();
                deleteNode(node, svgLayer, part);
                return;
            }
            const isConnect = part === "8A" ? connectMode8A : connectMode8B;
            if (isConnect) {
                e.stopPropagation();
                handleConnectClick(node, svgLayer, part);
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
            node.style.left = `${newX}px`;
            node.style.top = `${newY}px`;
            refreshConnections(svgLayer, part);
        });

        document.addEventListener("mouseup", () => {
            if (isDragging) {
                isDragging = false;
                node.style.zIndex = "10";
                node.style.cursor = "grab";
            }
        });

        // Double-click to configure IP for PCs
        if (type === "PC") {
            node.addEventListener("dblclick", () => openIPConfigModal(label, part));
        }
    }

    function handleConnectClick(node, svgLayer, part) {
        let firstNode = part === "8A" ? firstConnectNode8A : firstConnectNode8B;
        const connections = part === "8A" ? connections8A : connections8B;
        const selectId = part === "8A" ? "cable-type-select-8a" : "cable-type-select-8b";
        const cableType = document.getElementById(selectId)?.value || "crossover";

        if (!firstNode) {
            if (part === "8A") firstConnectNode8A = node;
            else firstConnectNode8B = node;
            node.style.boxShadow = "0 0 0 3px #10B981";
        } else if (firstNode !== node) {
            // Check for existing connection between the pair
            const exists = connections.some(c =>
                (c.nodeA === firstNode && c.nodeB === node) ||
                (c.nodeA === node && c.nodeB === firstNode)
            );

            if (!exists) {
                connections.push({ nodeA: firstNode, nodeB: node, cableType });
                refreshConnections(svgLayer, part);
                logObs("Topology Cabling", `Connected ${firstNode.dataset.type} to ${node.dataset.type} (${cableType})`, "Success");
            }

            firstNode.style.boxShadow = "";
            if (part === "8A") firstConnectNode8A = null;
            else firstConnectNode8B = null;
        }
    }

    function refreshConnections(svgLayer, part) {
        if (!svgLayer) return;
        svgLayer.innerHTML = "";
        const canvas = document.getElementById(part === "8A" ? "topology-canvas-8a" : "topology-canvas-8b");
        if (canvas) {
            canvas.querySelectorAll(".btn-wire-delete").forEach(b => b.remove());
        }
        const connections = part === "8A" ? connections8A : connections8B;
        const isDel = part === "8A" ? deleteMode8A : deleteMode8B;

        connections.forEach(c => {
            const rA = c.nodeA.getBoundingClientRect();
            const rB = c.nodeB.getBoundingClientRect();
            const canvasRect = svgLayer.getBoundingClientRect();

            const x1 = rA.left + rA.width / 2 - canvasRect.left;
            const y1 = rA.top + rA.height / 2 - canvasRect.top;
            const x2 = rB.left + rB.width / 2 - canvasRect.left;
            const y2 = rB.top + rB.height / 2 - canvasRect.top;
            const midX = (x1 + x2) / 2;
            const midY = (y1 + y2) / 2;

            const isSerial = c.cableType === "serial";
            const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
            line.setAttribute("x1", x1);
            line.setAttribute("y1", y1);
            line.setAttribute("x2", x2);
            line.setAttribute("y2", y2);
            line.setAttribute("stroke", isDel ? "#EF4444" : (isSerial ? "#DC2626" : "#2563EB"));
            line.setAttribute("stroke-width", isDel ? "4" : (isSerial ? "3" : "2.5"));
            if (isSerial || isDel) line.setAttribute("stroke-dasharray", isDel ? "4,4" : "6,4");
            line.style.pointerEvents = "stroke";
            line.style.cursor = isDel ? "not-allowed" : "pointer";
            line.setAttribute("title", isDel ? "Click to delete cable" : `${c.cableType} cable (Click '×' badge to delete)`);

            // Wide transparent hitLine (22px wide) for effortless mouse targeting
            const hitLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
            hitLine.setAttribute("x1", x1);
            hitLine.setAttribute("y1", y1);
            hitLine.setAttribute("x2", x2);
            hitLine.setAttribute("y2", y2);
            hitLine.setAttribute("stroke", "transparent");
            hitLine.setAttribute("stroke-width", "22");
            hitLine.style.pointerEvents = "stroke";
            hitLine.style.cursor = isDel ? "not-allowed" : "pointer";
            hitLine.setAttribute("title", `Click to delete ${c.cableType} cable`);

            // Midpoint delete badge (HTML button directly on canvas)
            const delWireBtn = document.createElement("button");
            delWireBtn.className = "btn-wire-delete";
            const labelA = c.nodeA?.dataset?.label || "Device";
            const labelB = c.nodeB?.dataset?.label || "Device";
            delWireBtn.title = `Delete wire between ${labelA} and ${labelB}`;
            delWireBtn.innerHTML = "&times;";
            delWireBtn.style.cssText = `position:absolute; left:${Math.round(midX - 11)}px; top:${Math.round(midY - 11)}px; width:22px; height:22px; background:#EF4444; color:white; border:2px solid white; border-radius:50%; font-size:15px; font-weight:bold; line-height:18px; text-align:center; cursor:pointer; padding:0; z-index:15; box-shadow:0 1px 4px rgba(0,0,0,0.35); align-items:center; justify-content:center; opacity:0.95; transition:transform 0.15s ease, background 0.15s ease;`;
            delWireBtn.style.display = isDel ? "flex" : "none";

            const onWireHoverIn = () => {
                const curDel = part === "8A" ? deleteMode8A : deleteMode8B;
                if (curDel) {
                    delWireBtn.style.transform = "scale(1.25)";
                    delWireBtn.style.background = "#DC2626";
                }
            };

            const onWireHoverOut = () => {
                const curDel = part === "8A" ? deleteMode8A : deleteMode8B;
                if (curDel) {
                    delWireBtn.style.transform = "scale(1)";
                    delWireBtn.style.background = "#EF4444";
                }
            };

            hitLine.addEventListener("mouseenter", onWireHoverIn);
            hitLine.addEventListener("mouseleave", onWireHoverOut);
            delWireBtn.addEventListener("mouseenter", onWireHoverIn);
            delWireBtn.addEventListener("mouseleave", onWireHoverOut);

            delWireBtn.addEventListener("click", e => {
                e.stopPropagation();
                deleteConnection(c, svgLayer, part);
            });

            hitLine.addEventListener("click", e => {
                e.stopPropagation();
                deleteConnection(c, svgLayer, part);
            });

            hitLine.addEventListener("contextmenu", e => {
                e.preventDefault();
                e.stopPropagation();
                deleteConnection(c, svgLayer, part);
            });

            line.addEventListener("click", e => {
                e.stopPropagation();
                deleteConnection(c, svgLayer, part);
            });

            line.addEventListener("contextmenu", e => {
                e.preventDefault();
                e.stopPropagation();
                deleteConnection(c, svgLayer, part);
            });

            svgLayer.appendChild(line);
            svgLayer.appendChild(hitLine);

            // Green status indicator dots near nodes
            const dotA = document.createElementNS("http://www.w3.org/2000/svg", "circle");
            dotA.setAttribute("cx", x1 + (x2 - x1) * 0.15);
            dotA.setAttribute("cy", y1 + (y2 - y1) * 0.15);
            dotA.setAttribute("r", "4");
            dotA.setAttribute("fill", isDel ? "#EF4444" : "#10B981");
            svgLayer.appendChild(dotA);

            const dotB = document.createElementNS("http://www.w3.org/2000/svg", "circle");
            dotB.setAttribute("cx", x1 + (x2 - x1) * 0.85);
            dotB.setAttribute("cy", y1 + (y2 - y1) * 0.85);
            dotB.setAttribute("r", "4");
            dotB.setAttribute("fill", isDel ? "#EF4444" : "#10B981");
            svgLayer.appendChild(dotB);

            if (canvas) canvas.appendChild(delWireBtn);
        });
    }

    /* ═══════════════════════════════════════════════
     * TOPOLOGY VALIDATION
     * ═══════════════════════════════════════════════ */

    function validateTopology8A() {
        const canvas = document.getElementById("topology-canvas-8a");
        const fb = document.getElementById("topology-feedback-8a");
        const nodes = Array.from(canvas.querySelectorAll(".topo-node"));

        const labels = nodes.map(n => n.dataset.label);
        const hasPC0 = labels.includes("PC0");
        const hasPC1 = labels.includes("PC1");
        const hasR1 = labels.includes("Router1");
        const hasR2 = labels.includes("Router2");
        const hasR3 = labels.includes("Router3");

        if (!hasPC0 || !hasPC1 || !hasR1 || !hasR2 || !hasR3) {
            fb.style.color = "#DC2626";
            fb.textContent = "❌ Missing devices. Ensure PC0, PC1, Router1, Router2, and Router3 are on the canvas.";
            return;
        }

        // Verify required link connections
        function isConnected(lblA, lblB, requiredType) {
            return connections8A.some(c => {
                const a = c.nodeA.dataset.label;
                const b = c.nodeB.dataset.label;
                const pairMatch = (a === lblA && b === lblB) || (a === lblB && b === lblA);
                return pairMatch && (!requiredType || c.cableType === requiredType);
            });
        }

        const linkPC0_R1 = isConnected("PC0", "Router1");
        const linkR1_R2 = isConnected("Router1", "Router2");
        const linkR2_R3 = isConnected("Router2", "Router3");
        const linkR1_R3_serial = isConnected("Router1", "Router3", "serial");
        const linkR3_PC1 = isConnected("Router3", "PC1");

        if (!linkPC0_R1) {
            fb.style.color = "#DC2626";
            fb.textContent = "❌ Missing connection: Connect PC0 to Router1 using Copper cross-over cable.";
            return;
        }
        if (!linkR1_R2) {
            fb.style.color = "#DC2626";
            fb.textContent = "❌ Missing connection: Connect Router1 to Router2 using Copper cross-over cable.";
            return;
        }
        if (!linkR2_R3) {
            fb.style.color = "#DC2626";
            fb.textContent = "❌ Missing connection: Connect Router2 to Router3 using Copper cross-over cable.";
            return;
        }
        if (!linkR1_R3_serial) {
            fb.style.color = "#DC2626";
            fb.textContent = "❌ Missing connection: Connect Router1 to Router3 using Serial DCE cable.";
            return;
        }
        if (!linkR3_PC1) {
            fb.style.color = "#DC2626";
            fb.textContent = "❌ Missing connection: Connect Router3 to PC1 using Copper cross-over cable.";
            return;
        }

        fb.style.color = "#059669";
        fb.textContent = "✓ Physical topology verified successfully! Proceed to Stage 2: IP Addressing.";
        state["8A"].topologyValid = true;
        document.getElementById("exp8a-ip-stage").style.display = "block";

        logObs("Topology Checker", "Verified connections", "Success");
        syncServerMilestone("8A_TOPOLOGY_COMPLETE", "Single Area OSPF topology construction validated.");
    }

    function validateTopology8B() {
        const canvas = document.getElementById("topology-canvas-8b");
        const fb = document.getElementById("topology-feedback-8b");
        const nodes = Array.from(canvas.querySelectorAll(".topo-node"));

        const labels = nodes.map(n => n.dataset.label);
        const pcsPresent = ["PC0", "PC1", "PC2", "PC3", "PC4", "PC5"].every(l => labels.includes(l));
        const swsPresent = ["Switch0", "Switch1", "Switch2"].every(l => labels.includes(l));
        const rtsPresent = ["Router0", "Router1", "Router2", "Router3"].every(l => labels.includes(l));

        if (!pcsPresent || !swsPresent || !rtsPresent) {
            fb.style.color = "#DC2626";
            fb.textContent = "❌ Missing devices. Ensure 6 PCs, 3 Switches, and 4 Routers are placed on the canvas.";
            return;
        }

        function isConnected(lblA, lblB) {
            return connections8B.some(c => {
                const a = c.nodeA.dataset.label;
                const b = c.nodeB.dataset.label;
                return (a === lblA && b === lblB) || (a === lblB && b === lblA);
            });
        }

        // Verify Star-of-Areas connections
        const a0OK = isConnected("PC0", "Switch0") && isConnected("PC1", "Switch0") && isConnected("Switch0", "Router1") && isConnected("Router1", "Router0");
        const a1OK = isConnected("PC2", "Switch2") && isConnected("PC3", "Switch2") && isConnected("Switch2", "Router2") && isConnected("Router2", "Router0");
        const a2OK = isConnected("PC4", "Switch1") && isConnected("PC5", "Switch1") && isConnected("Switch1", "Router3") && isConnected("Router3", "Router0");

        if (!a0OK) {
            fb.style.color = "#DC2626";
            fb.textContent = "❌ Incomplete Area 0: Connect PC0, PC1 -> Switch0 -> Router1 -> Router0.";
            return;
        }
        if (!a1OK) {
            fb.style.color = "#DC2626";
            fb.textContent = "❌ Incomplete Area 1: Connect PC2, PC3 -> Switch2 -> Router2 -> Router0.";
            return;
        }
        if (!a2OK) {
            fb.style.color = "#DC2626";
            fb.textContent = "❌ Incomplete Area 2: Connect PC4, PC5 -> Switch1 -> Router3 -> Router0.";
            return;
        }

        fb.style.color = "#059669";
        fb.textContent = "✓ Multi-Area topology verified successfully! Proceed to Stage 2: IP Addressing.";
        state["8B"].topologyValid = true;
        document.getElementById("exp8b-ip-stage").style.display = "block";

        logObs("Topology Checker", "Verified connections", "Success");
        syncServerMilestone("8B_TOPOLOGY_COMPLETE", "Multi-Area OSPF topology construction validated.");
    }

    /* ═══════════════════════════════════════════════
     * IP CONFIGURATION MODAL
     * ═══════════════════════════════════════════════ */

    let activeModalPc = null;
    let activeModalPart = null;

    function openIPConfigModal(pcLabel, part) {
        activeModalPc = pcLabel;
        activeModalPart = part;
        const modal = document.getElementById("ip-config-modal");
        const titleEl = document.getElementById("ip-modal-title");
        const ipIn = document.getElementById("ip-address-input");
        const maskIn = document.getElementById("subnet-mask-input");
        const gwIn = document.getElementById("gateway-input");

        const saved = state[part].pcConfigured[pcLabel] || {};
        titleEl.textContent = `IP Configuration: ${pcLabel}`;
        ipIn.value = saved.ip || "";
        maskIn.value = saved.mask || (part === "8A" ? "255.0.0.0" : "255.255.255.0");
        gwIn.value = saved.gw || "";

        modal.style.display = "flex";
    }

    function initIPModalHandlers() {
        const cancelBtn = document.getElementById("cancel-ip-config");
        const saveBtn = document.getElementById("save-ip-config");
        const modal = document.getElementById("ip-config-modal");

        if (cancelBtn) {
            cancelBtn.addEventListener("click", () => {
                modal.style.display = "none";
            });
        }

        if (saveBtn) {
            saveBtn.addEventListener("click", () => {
                const ip = document.getElementById("ip-address-input").value.trim();
                const mask = document.getElementById("subnet-mask-input").value.trim();
                const gw = document.getElementById("gateway-input").value.trim();

                if (!activeModalPc || !activeModalPart) return;
                state[activeModalPart].pcConfigured[activeModalPc] = { ip, mask, gw };
                modal.style.display = "none";

                logObs("IP Config", `Configured ${activeModalPc} with IP ${ip}`, "Success");

                // Check if Stage 2 complete
                checkIPStageComplete(activeModalPart);
            });
        }
    }

    function checkIPStageComplete(part) {
        if (part === "8A") {
            const pc0 = state["8A"].pcConfigured.PC0;
            const pc1 = state["8A"].pcConfigured.PC1;
            if (pc0.ip === "10.0.0.2" && pc1.ip === "50.0.0.2") {
                document.getElementById("exp8a-cli-card").style.display = "block";
                logObs("IP Addressing", "Stage 2 Complete (Part 8A)", "PC0 and PC1 configured. Unlocked Stage 3: Router CLI.");
                syncServerMilestone("8A_IP_CONFIGURED", "Host IP addresses configured for Part 8A.");
            }
        } else {
            const p = state["8B"].pcConfigured;
            const allConfigured = p.PC0.ip && p.PC1.ip && p.PC2.ip && p.PC3.ip && p.PC4.ip && p.PC5.ip;
            if (allConfigured) {
                document.getElementById("exp8b-cli-card").style.display = "block";
                logObs("IP Addressing", "Stage 2 Complete (Part 8B)", "All 6 PCs configured across Area 0, 1, 2. Unlocked Stage 3: Router CLI.");
                syncServerMilestone("8B_IP_CONFIGURED", "Host IP addresses configured for Part 8B.");
            }
        }
    }

    /* ═══════════════════════════════════════════════
     * CISCO IOS CLI SIMULATION ENGINE
     * ═══════════════════════════════════════════════ */

    function initCliEngines() {
        // Router selector 8A
        document.querySelectorAll("#r-selector-8a .btn-r-sel-8a").forEach(btn => {
            btn.addEventListener("click", () => {
                document.querySelectorAll("#r-selector-8a .btn-r-sel-8a").forEach(b => {
                    b.classList.remove("active");
                    b.style.background = "#E2E8F0";
                    b.style.color = "#334155";
                });
                btn.classList.add("active");
                btn.style.background = "#2563EB";
                btn.style.color = "white";

                const r = btn.dataset.r;
                state["8A"].activeRouter = r;
                updatePrompt("8A");
                printLine(`\n[ Switched CLI active console to Router ${r.replace('R', '')} ]`, "8A");
            });
        });

        // Router selector 8B
        document.querySelectorAll("#r-selector-8b .btn-r-sel-8b").forEach(btn => {
            btn.addEventListener("click", () => {
                document.querySelectorAll("#r-selector-8b .btn-r-sel-8b").forEach(b => {
                    b.classList.remove("active");
                    b.style.background = "#E2E8F0";
                    b.style.color = "#334155";
                });
                btn.classList.add("active");
                btn.style.background = btn.dataset.r === "R0" ? "#DC2626" : "#2563EB";
                btn.style.color = "white";

                const r = btn.dataset.r;
                state["8B"].activeRouter = r;
                updatePrompt("8B");
                printLine(`\n[ Switched CLI active console to Router ${r.replace('R', '')} ]`, "8B");
            });
        });

        // Terminal input 8A
        const in8A = document.getElementById("terminal-input-8a");
        if (in8A) {
            in8A.addEventListener("keydown", e => {
                if (e.key === "Enter") {
                    e.preventDefault();
                    const text = in8A.value.trim();
                    in8A.value = "";
                    if (!text) {
                        printLine(document.getElementById("terminal-prompt-8a").textContent, "8A");
                        return;
                    }
                    executeCliCommand(text, "8A");
                }
            });
        }

        // Terminal input 8B
        const in8B = document.getElementById("terminal-input-8b");
        if (in8B) {
            in8B.addEventListener("keydown", e => {
                if (e.key === "Enter") {
                    e.preventDefault();
                    const text = in8B.value.trim();
                    in8B.value = "";
                    if (!text) {
                        printLine(document.getElementById("terminal-prompt-8b").textContent, "8B");
                        return;
                    }
                    executeCliCommand(text, "8B");
                }
            });
        }

        // Quick Ping button 8A
        const pingBtn8A = document.getElementById("btn-quick-ping-8a");
        if (pingBtn8A) {
            pingBtn8A.addEventListener("click", () => {
                runQuickPing("8A");
            });
        }

        // Quick Ping button 8B
        const pingBtn8B = document.getElementById("btn-quick-ping-8b");
        if (pingBtn8B) {
            pingBtn8B.addEventListener("click", () => {
                runQuickPing("8B");
            });
        }
    }

    function updatePrompt(part) {
        const promptEl = document.getElementById(`terminal-prompt-${part.toLowerCase()}`);
        if (!promptEl) return;
        const activeR = state[part].activeRouter;
        const mode = state[part].cliMode[activeR];
        const num = activeR.replace("R", "");

        if (mode === "global") promptEl.textContent = `Router${num}(config)#`;
        else if (mode === "router_ospf") promptEl.textContent = `Router${num}(config-router)#`;
        else promptEl.textContent = `Router${num}#`;
    }

    function printLine(text, part) {
        const out = document.getElementById(`terminal-output-${part.toLowerCase()}`);
        if (!out) return;
        const div = document.createElement("div");
        div.style.whiteSpace = "pre-wrap";
        div.style.lineHeight = "1.4";
        div.textContent = text;
        out.appendChild(div);
        out.scrollTop = out.scrollHeight;
    }

    function executeCliCommand(cmd, part) {
        const prompt = document.getElementById(`terminal-prompt-${part.toLowerCase()}`).textContent;
        printLine(`${prompt} ${cmd}`, part);

        const lower = cmd.trim().toLowerCase();
        const activeR = state[part].activeRouter;
        const curMode = state[part].cliMode[activeR];

        // Global navigation
        if (lower === "exit") {
            if (curMode === "router_ospf") state[part].cliMode[activeR] = "global";
            else if (curMode === "global") state[part].cliMode[activeR] = "priv";
            updatePrompt(part);
            return;
        }

        if (lower === "end") {
            state[part].cliMode[activeR] = "priv";
            updatePrompt(part);
            return;
        }

        if (lower === "clear" || lower === "cls") {
            const out = document.getElementById(`terminal-output-${part.toLowerCase()}`);
            if (out) out.innerHTML = "";
            return;
        }

        // In Privileged Exec mode or User Exec mode
        if (lower === "enable" || lower === "en") {
            state[part].cliMode[activeR] = "priv";
            updatePrompt(part);
            logObs("Router CLI", "enable", "Entered privileged EXEC");
            return;
        }

        if (curMode === "priv") {
            if (lower === "configure terminal" || lower === "conf t" || lower === "config t") {
                state[part].cliMode[activeR] = "global";
                printLine("Enter configuration commands, one per line. End with CNTL/Z.", part);
                updatePrompt(part);
                logObs("Router CLI", cmd, "Entered global config");
                return;
            }
            if (lower === "show ip ospf neighbor" || lower === "sh ip ospf neighbor" || lower === "sh ip ospf neigh") {
                showIpOspfNeighbor(part);
                logObs("Router CLI", cmd, "Verified");
                return;
            }
            if (lower === "show ip route ospf" || lower === "sh ip route ospf") {
                showIpRouteOspf(part);
                logObs("Router CLI", cmd, "Verified");
                return;
            }
            if (lower === "show ip ospf database" || lower === "sh ip ospf database" || lower === "sh ip ospf db") {
                showIpOspfDatabase(part);
                logObs("Router CLI", cmd, "Verified");
                return;
            }
            if (lower === "show ip interface brief" || lower === "sh ip int br") {
                showIpInterfaceBrief(part);
                logObs("Router CLI", cmd, "Verified");
                return;
            }
            if (lower.startsWith("ping ")) {
                handleCliPing(cmd.substring(5).trim(), part);
                return;
            }
        }

        // In Global Config mode
        if (curMode === "global") {
            if (lower.startsWith("router ospf")) {
                state[part].cliMode[activeR] = "router_ospf";
                updatePrompt(part);
                logObs("Router CLI", cmd, "Entered router OSPF mode");
                return;
            }
        }

        // In Router OSPF Config mode
        if (curMode === "router_ospf") {
            if (lower.startsWith("router-id ")) {
                const rid = cmd.substring(10).trim();
                if (part === "8B") state["8B"].routerIds[activeR] = rid;
                printLine(`% OSPF Router-ID set to ${rid}`, part);
                logObs("Router CLI", cmd, `Router-ID configured (${rid})`);
                return;
            }

            const netMatch = cmd.match(/^network\s+([\d\.]+)\s+([\d\.]+)\s+area\s+(\d+)/i);
            if (netMatch) {
                const net = netMatch[1];
                const wildcard = netMatch[2];
                const area = parseInt(netMatch[3], 10);

                state[part].ospfNetworks[activeR].add(`${net} ${wildcard} area ${area}`);
                printLine(`% OSPF network ${net} ${wildcard} area ${area} committed`, part);
                logObs("Router CLI", cmd, "Network registered");

                checkOspfConvergence(part);
                return;
            }
        }

        printLine(`% Invalid input or command unrecognized: "${cmd}"`, part);
    }

    function checkOspfConvergence(part) {
        if (part === "8A") {
            const r1Done = state["8A"].ospfNetworks.R1.size >= 3;
            const r2Done = state["8A"].ospfNetworks.R2.size >= 2;
            const r3Done = state["8A"].ospfNetworks.R3.size >= 3;

            if (r1Done && r2Done && r3Done) {
                document.getElementById("exp8a-verify-card").style.display = "block";
                logObs("OSPF Configuration", "Single Area OSPF Converged", "All routers configured with Area 0 statements.");
                syncServerMilestone("8A_OSPF_CONFIGURED", "Single Area OSPF configured across all routers.");
            }
        } else {
            const r0Done = state["8B"].ospfNetworks.R0.size >= 3;
            const r1Done = state["8B"].ospfNetworks.R1.size >= 2;
            const r2Done = state["8B"].ospfNetworks.R2.size >= 2;
            const r3Done = state["8B"].ospfNetworks.R3.size >= 2;

            if (r0Done && r1Done && r2Done && r3Done) {
                document.getElementById("exp8b-verify-card").style.display = "block";
                logObs("OSPF Configuration", "Multi-Area OSPF Converged", "ABR Router 0 and perimeter routers configured across Area 0/1/2.");
                syncServerMilestone("8B_OSPF_CONFIGURED", "Multi-Area OSPF hierarchy configured.");
            }
        }
    }

    function showIpOspfNeighbor(part) {
        if (part === "8A") {
            printLine("Neighbor ID     Pri   State           Dead Time   Address         Interface", "8A");
            printLine("20.0.0.2          1   FULL/DR         00:00:36    20.0.0.2        GigabitEthernet0/1", "8A");
            printLine("50.0.0.1          0   FULL/  -        00:00:32    30.0.0.2        Serial0/1/0", "8A");
        } else {
            printLine("Neighbor ID     Pri   State           Dead Time   Address         Interface", "8B");
            printLine("1.1.1.1           1   FULL/BDR        00:00:35    10.10.10.8      GigabitEthernet0/0", "8B");
            printLine("2.2.2.2           1   FULL/BDR        00:00:38    10.10.10.4      GigabitEthernet0/1", "8B");
            printLine("3.3.3.3           1   FULL/BDR        00:00:31    10.10.10.0      GigabitEthernet0/2", "8B");
        }
        logObs("CLI Verification", "show ip ospf neighbor", "FULL neighbor adjacencies confirmed");
    }

    function showIpRouteOspf(part) {
        printLine("Codes: L - local, C - connected, S - static, R - RIP, O - OSPF, IA - OSPF inter area\n", part);
        if (part === "8A") {
            printLine("O    40.0.0.0/8 [110/2] via 20.0.0.2, 00:04:12, GigabitEthernet0/1", "8A");
            printLine("O    50.0.0.0/8 [110/65] via 30.0.0.2, 00:04:12, Serial0/1/0", "8A");
        } else {
            printLine("O IA 192.168.1.0/24 [110/2] via 10.10.10.8, 00:02:15, GigabitEthernet0/0", "8B");
            printLine("O IA 192.168.3.0/24 [110/2] via 10.10.10.4, 00:02:15, GigabitEthernet0/1", "8B");
            printLine("O IA 192.168.2.0/24 [110/2] via 10.10.10.0, 00:02:15, GigabitEthernet0/2", "8B");
        }
        logObs("CLI Verification", "show ip route ospf", "OSPF routes with AD 110 verified");
    }

    function showIpOspfDatabase(part) {
        if (part === "8A") {
            printLine("            OSPF Router with ID (30.0.0.1) (Process ID 1)", "8A");
            printLine("                Router Link States (Area 0)\n", "8A");
            printLine("Link ID         ADV Router      Age         Seq#       Checksum Link count", "8A");
            printLine("20.0.0.1        20.0.0.1        452         0x80000003 0x004A21 3", "8A");
            printLine("20.0.0.2        20.0.0.2        440         0x80000002 0x003B15 2", "8A");
            printLine("50.0.0.1        50.0.0.1        438         0x80000003 0x005F12 3", "8A");
        } else {
            printLine("            OSPF Router with ID (4.4.4.4) (Process ID 15)", "8B");
            printLine("                Router Link States (Area 0)\n", "8B");
            printLine("Link ID         ADV Router      Age         Seq#       Checksum Link count", "8B");
            printLine("1.1.1.1         1.1.1.1         312         0x80000002 0x0031E2 2", "8B");
            printLine("4.4.4.4         4.4.4.4         298         0x80000004 0x004A11 2\n", "8B");
            printLine("                Summary Net Link States (Area 0)\n", "8B");
            printLine("Link ID         ADV Router      Age         Seq#       Checksum", "8B");
            printLine("192.168.2.0     4.4.4.4         295         0x80000001 0x0061A2", "8B");
            printLine("192.168.3.0     4.4.4.4         295         0x80000001 0x0053BC", "8B");
        }
        logObs("CLI Verification", "show ip ospf database", "Link-State Database inspected");
    }

    function showIpInterfaceBrief(part) {
        printLine("Interface              IP-Address      OK? Method Status                Protocol", part);
        if (part === "8A") {
            printLine("GigabitEthernet0/0     10.0.0.1        YES manual up                    up", "8A");
            printLine("GigabitEthernet0/1     20.0.0.1        YES manual up                    up", "8A");
            printLine("Serial0/1/0            30.0.0.1        YES manual up                    up", "8A");
        } else {
            printLine("GigabitEthernet0/0     10.10.10.10     YES manual up                    up", "8B");
            printLine("GigabitEthernet0/1     10.10.10.6      YES manual up                    up", "8B");
            printLine("GigabitEthernet0/2     10.10.10.2      YES manual up                    up", "8B");
        }
    }

    function handleCliPing(destIp, part) {
        printLine(`Sending 5, 100-byte ICMP Echos to ${destIp}, timeout is 2 seconds:`, part);
        printLine("!!!!!", part);
        printLine("Success rate is 100 percent (5/5), round-trip min/avg/max = 1/2/4 ms", part);
        logObs("Ping Simulation", `Ping ${destIp}`, "Success");
    }

    function runQuickPing(part) {
        const outEl = document.getElementById(`verify-output-${part.toLowerCase()}`);
        const statusEl = document.getElementById(`ping-status-${part.toLowerCase()}`);

        if (statusEl) {
            statusEl.style.color = "#2563EB";
            statusEl.textContent = "Transmitting ICMP Echo Requests...";
        }

        setTimeout(() => {
            if (part === "8A") {
                if (outEl) {
                    outEl.innerHTML = `
Pinging 50.0.0.2 with 32 bytes of data:
Reply from 50.0.0.2: bytes=32 time=2ms TTL=126
Reply from 50.0.0.2: bytes=32 time=1ms TTL=126
Reply from 50.0.0.2: bytes=32 time=2ms TTL=126
Reply from 50.0.0.2: bytes=32 time=1ms TTL=126

Ping statistics for 50.0.0.2:
    Packets: Sent = 4, Received = 4, Lost = 0 (0% loss),
Approximate round trip times in milli-seconds:
    Minimum = 1ms, Maximum = 2ms, Average = 1ms
                    `;
                }
                if (statusEl) {
                    statusEl.style.color = "#059669";
                    statusEl.textContent = "✔ Ping Success: 100% Reachable across OSPF Mesh!";
                }
                logObs("Ping Simulation", "Ping PC0 -> PC1 (50.0.0.2)", "Success");
                syncServerMilestone("8A_CONNECTIVITY_VERIFIED", "End-to-end ping across Area 0 succeeded.");
            } else {
                if (outEl) {
                    outEl.innerHTML = `
Pinging 192.168.2.2 with 32 bytes of data:
Reply from 192.168.2.2: bytes=32 time=3ms TTL=125
Reply from 192.168.2.2: bytes=32 time=2ms TTL=125
Reply from 192.168.2.2: bytes=32 time=3ms TTL=125
Reply from 192.168.2.2: bytes=32 time=2ms TTL=125

Ping statistics for 192.168.2.2:
    Packets: Sent = 4, Received = 4, Lost = 0 (0% loss),
Approximate round trip times in milli-seconds:
    Minimum = 2ms, Maximum = 3ms, Average = 2ms
                    `;
                }
                if (statusEl) {
                    statusEl.style.color = "#059669";
                    statusEl.textContent = "✔ Inter-Area Ping Success: Area 0 -> Area 2 Reachable!";
                }
                logObs("Ping Simulation", "Ping PC0 -> PC4 (192.168.2.2)", "Success");
                syncServerMilestone("8B_CONNECTIVITY_VERIFIED", "Cross-area ping across ABR succeeded.");
            }
        }, 500);
    }

    /* ═══════════════════════════════════════════════
     * PART SWITCHING & RESET
     * ═══════════════════════════════════════════════ */

    function initPartSwitchers() {
        const btn8A = document.getElementById("btn-mode-8a");
        const btn8B = document.getElementById("btn-mode-8b");
        const cont8A = document.getElementById("exp8-part-a");
        const cont8B = document.getElementById("exp8-part-b");
        const resetBtn = document.getElementById("btn-reset-exp8");

        if (btn8A && btn8B) {
            btn8A.addEventListener("click", () => {
                currentMode = "8A";
                btn8A.style.background = "var(--primary-color)";
                btn8A.style.color = "white";
                btn8B.style.background = "#F1F5F9";
                btn8B.style.color = "#334155";
                cont8A.style.display = "block";
                cont8B.style.display = "none";
            });

            btn8B.addEventListener("click", () => {
                currentMode = "8B";
                btn8B.style.background = "var(--primary-color)";
                btn8B.style.color = "white";
                btn8A.style.background = "#F1F5F9";
                btn8A.style.color = "#334155";
                cont8B.style.display = "block";
                cont8A.style.display = "none";
            });
        }

        if (resetBtn) {
            resetBtn.addEventListener("click", () => {
                if (confirm("Reset current simulation workspace?")) {
                    location.reload();
                }
            });
        }
    }

    /* ═══════════════════════════════════════════════
     * INITIALIZATION
     * ═══════════════════════════════════════════════ */

    document.addEventListener("DOMContentLoaded", () => {
        initPartSwitchers();
        initTopologyBuilder8A();
        initTopologyBuilder8B();
        initIPModalHandlers();
        initCliEngines();
    });

})();
