/**
 * Experiment 9 Logic Module: Point-to-Point Protocol (PPP) & HDLC Protocol
 * Follows the same manual topology builder and staged learning architecture as Experiments 4, 7, & 8.
 *
 * Features:
 *  - Manual Drag-and-Drop Topology Builder for Exercise 9-A and Exercise 9-B
 *  - Interactive Connect Mode with cable type selection (Straight-Through, Serial DCE, Crossover)
 *  - Delete Tool (delete devices or cables) & Clear Wires Tool
 *  - Deterministic Topology Validation & Stage Progression
 *  - Cisco IOS CLI Simulators for SITE-A, SITE-B, Router0, and Router1
 *  - Commands: router ospf 25, encapsulation ppp, ppp authentication chap, show controllers, encapsulation hdlc, show int
 *  - Real-time Observation Logging & Database Event Synchronization
 */

(function () {
    "use strict";

    /* ═══════════════════════════════════════════════
     * CONSTANTS & STATE
     * ═══════════════════════════════════════════════ */

    let currentMode = "9A"; // "9A" or "9B"

    // Node counters for dragged devices
    const nodeCounters = {
        "9A": { PC: 0, Switch: 0, Router: 0 },
        "9B": { Router: 0 }
    };

    // Connections tracking
    let connections9A = [];
    let connections9B = [];
    let connectMode9A = false;
    let connectMode9B = false;
    let deleteMode9A = false;
    let deleteMode9B = false;
    let firstConnectNode9A = null;
    let firstConnectNode9B = null;

    // Simulation Stage State
    const state = {
        "9A": {
            topologyValid: false,
            activeRouter: "SITE-A",
            cliMode: { "SITE-A": "priv", "SITE-B": "priv" },
            cliPrompt: { "SITE-A": "SITE-A#", "SITE-B": "SITE-B#" },
            ospfConfigured: { "SITE-A": false, "SITE-B": false },
            ospfNetworks: {
                "SITE-A": new Set(),
                "SITE-B": new Set()
            },
            pppConfigured: {
                "SITE-A": { encap: false, chap: false, user: false },
                "SITE-B": { encap: false, chap: false, user: false }
            },
            pcConfigured: {
                PC0: { ip: "", mask: "", gw: "" },
                PC1: { ip: "", mask: "", gw: "" },
                PC2: { ip: "", mask: "", gw: "" },
                PC3: { ip: "", mask: "", gw: "" }
            }
        },
        "9B": {
            topologyValid: false,
            activeRouter: "Router0",
            cliMode: { Router0: "priv", Router1: "priv" },
            cliPrompt: { Router0: "Router0#", Router1: "Router1#" },
            hdlcConfigured: {
                Router0: { ip: false, hdlc: false, noShut: false },
                Router1: { ip: false, hdlc: false, noShut: false }
            },
            controllersInspected: {
                Router0: false,
                Router1: false
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
                        experimentId: 9,
                        stage,
                        eventType: "MILESTONE_VERIFIED",
                        payload: { mode: currentMode, detail, timestamp: new Date().toISOString() }
                    })
                }).catch(() => {});
            }
        } catch (e) {}
    }

    /* ═══════════════════════════════════════════════
     * TOPOLOGY BUILDER: PART 9A
     * ═══════════════════════════════════════════════ */

    function initTopologyBuilder9A() {
        const canvas = document.getElementById("topology-canvas-9a");
        const svgLayer = document.getElementById("connection-layer-9a");
        if (!canvas) return;

        // Palette dragstart
        document.querySelectorAll("#topo-tools-9a .draggable-item[draggable='true']").forEach(item => {
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
                const count = nodeCounters["9A"].PC++;
                label = `PC${count}`;
            } else if (type === "Switch") {
                const count = nodeCounters["9A"].Switch++;
                label = `Switch${count}`;
            } else if (type === "Router") {
                const count = nodeCounters["9A"].Router++;
                label = count === 0 ? "SITE-A" : (count === 1 ? "SITE-B" : `Router${count}`);
            }

            const posX = Math.max(10, Math.min(x - 34, canvas.clientWidth - 78));
            const posY = Math.max(10, Math.min(y - 34, canvas.clientHeight - 78));

            addNodeToCanvas(canvas, svgLayer, type, label, posX, posY, "9A");
        });

        // Connect mode toggle
        const connectBtn = document.getElementById("connect-mode-btn-9a");
        if (connectBtn) {
            connectBtn.addEventListener("click", () => {
                connectMode9A = !connectMode9A;
                if (firstConnectNode9A) {
                    firstConnectNode9A.style.boxShadow = "";
                    firstConnectNode9A = null;
                }
                if (connectMode9A) {
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
        const delBtn9A = document.getElementById("delete-mode-btn-9a");
        if (delBtn9A) {
            delBtn9A.addEventListener("click", () => toggleDeleteMode("9A"));
        }

        // Clear all wires
        const clearWiresBtn9A = document.getElementById("clear-wires-btn-9a");
        if (clearWiresBtn9A) {
            clearWiresBtn9A.addEventListener("click", () => clearAllWires("9A"));
        }

        // Check Topology
        const checkBtn = document.getElementById("check-topology-9a");
        if (checkBtn) checkBtn.addEventListener("click", validateTopology9A);

        // Reset Topology
        const resetBtn = document.getElementById("reset-topology-9a");
        if (resetBtn) {
            resetBtn.addEventListener("click", () => {
                canvas.querySelectorAll(".topo-node").forEach(n => n.remove());
                canvas.querySelectorAll(".btn-wire-delete").forEach(b => b.remove());
                if (svgLayer) svgLayer.innerHTML = "";
                nodeCounters["9A"] = { PC: 0, Switch: 0, Router: 0 };
                connections9A = [];
                connectMode9A = false;
                firstConnectNode9A = null;
                if (deleteMode9A) toggleDeleteMode("9A");
                document.getElementById("topology-feedback-9a").textContent = "";
                document.getElementById("exp9a-ip-stage").style.display = "none";
                document.getElementById("exp9a-cli-card").style.display = "none";
                document.getElementById("exp9a-verify-card").style.display = "none";
                state["9A"].topologyValid = false;
                logObs("Topology Builder", "Canvas Reset (Part 9A)", "Cleared topology elements");
            });
        }
    }

    /* ═══════════════════════════════════════════════
     * TOPOLOGY BUILDER: PART 9B
     * ═══════════════════════════════════════════════ */

    function initTopologyBuilder9B() {
        const canvas = document.getElementById("topology-canvas-9b");
        const svgLayer = document.getElementById("connection-layer-9b");
        if (!canvas) return;

        // Palette dragstart
        document.querySelectorAll("#topo-tools-9b .draggable-item[draggable='true']").forEach(item => {
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
            if (type === "Router") {
                const count = nodeCounters["9B"].Router++;
                label = `Router${count}`;
            }

            const posX = Math.max(10, Math.min(x - 34, canvas.clientWidth - 78));
            const posY = Math.max(10, Math.min(y - 34, canvas.clientHeight - 78));

            addNodeToCanvas(canvas, svgLayer, type, label, posX, posY, "9B");
        });

        // Connect mode toggle
        const connectBtn = document.getElementById("connect-mode-btn-9b");
        if (connectBtn) {
            connectBtn.addEventListener("click", () => {
                connectMode9B = !connectMode9B;
                if (firstConnectNode9B) {
                    firstConnectNode9B.style.boxShadow = "";
                    firstConnectNode9B = null;
                }
                if (connectMode9B) {
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
        const delBtn9B = document.getElementById("delete-mode-btn-9b");
        if (delBtn9B) {
            delBtn9B.addEventListener("click", () => toggleDeleteMode("9B"));
        }

        // Clear all wires
        const clearWiresBtn9B = document.getElementById("clear-wires-btn-9b");
        if (clearWiresBtn9B) {
            clearWiresBtn9B.addEventListener("click", () => clearAllWires("9B"));
        }

        // Check Topology
        const checkBtn = document.getElementById("check-topology-9b");
        if (checkBtn) checkBtn.addEventListener("click", validateTopology9B);

        // Reset Topology
        const resetBtn = document.getElementById("reset-topology-9b");
        if (resetBtn) {
            resetBtn.addEventListener("click", () => {
                canvas.querySelectorAll(".topo-node").forEach(n => n.remove());
                canvas.querySelectorAll(".btn-wire-delete").forEach(b => b.remove());
                if (svgLayer) svgLayer.innerHTML = "";
                nodeCounters["9B"] = { Router: 0 };
                connections9B = [];
                connectMode9B = false;
                firstConnectNode9B = null;
                if (deleteMode9B) toggleDeleteMode("9B");
                document.getElementById("topology-feedback-9b").textContent = "";
                document.getElementById("exp9b-ip-stage").style.display = "none";
                document.getElementById("exp9b-cli-card").style.display = "none";
                document.getElementById("exp9b-verify-card").style.display = "none";
                state["9B"].topologyValid = false;
                logObs("Topology Builder", "Canvas Reset (Part 9B)", "Cleared HDLC router elements");
            });
        }
    }

    /* ═══════════════════════════════════════════════
     * GENERIC NODE & CONNECTION HANDLER WITH DELETION
     * ═══════════════════════════════════════════════ */

    function deleteNode(node, svgLayer, part) {
        if (!node) return;
        const label = node.dataset.label || "Device";

        node.remove();

        // Remove associated connections
        let connections = part === "9A" ? connections9A : connections9B;
        for (let i = connections.length - 1; i >= 0; i--) {
            if (connections[i].nodeA === node || connections[i].nodeB === node) {
                connections.splice(i, 1);
            }
        }
        if (part === "9A") connections9A = connections;
        else connections9B = connections;

        if (part === "9A" && firstConnectNode9A === node) firstConnectNode9A = null;
        if (part === "9B" && firstConnectNode9B === node) firstConnectNode9B = null;

        refreshConnections(svgLayer, part);

        if (state[part]?.pcConfigured?.[label]) {
            delete state[part].pcConfigured[label];
        }

        const fb = document.getElementById(part === "9A" ? "topology-feedback-9a" : "topology-feedback-9b");
        if (fb) fb.textContent = "";

        logObs("Topology Builder", "Deleted " + label, "Node removed");
    }

    function deleteConnection(conn, svgLayer, part) {
        if (!conn) return;
        let connections = part === "9A" ? connections9A : connections9B;
        const idx = connections.indexOf(conn);
        if (idx !== -1) {
            const labelA = conn.nodeA?.dataset?.label || "Device";
            const labelB = conn.nodeB?.dataset?.label || "Device";
            connections.splice(idx, 1);
            refreshConnections(svgLayer, part);
            const fb = document.getElementById(part === "9A" ? "topology-feedback-9a" : "topology-feedback-9b");
            if (fb) fb.textContent = "";
            logObs("Topology Cabling", `Removed cable between ${labelA} and ${labelB}`, "Cable removed");
        }
    }

    function clearAllWires(part) {
        const svgLayer = document.getElementById(part === "9A" ? "connection-layer-9a" : "connection-layer-9b");
        const count = part === "9A" ? connections9A.length : connections9B.length;
        if (count === 0) return;
        if (part === "9A") connections9A = [];
        else connections9B = [];
        refreshConnections(svgLayer, part);
        const fb = document.getElementById(part === "9A" ? "topology-feedback-9a" : "topology-feedback-9b");
        if (fb) fb.textContent = "";
        logObs("Topology Cabling", `Cleared all wires (Part ${part})`, `Removed ${count} cable(s)`);
    }

    function toggleDeleteMode(part) {
        const is9A = part === "9A";
        const btnId = is9A ? "delete-mode-btn-9a" : "delete-mode-btn-9b";
        const connectBtnId = is9A ? "connect-mode-btn-9a" : "connect-mode-btn-9b";
        const canvasId = is9A ? "topology-canvas-9a" : "topology-canvas-9b";
        const svgLayerId = is9A ? "connection-layer-9a" : "connection-layer-9b";

        const btn = document.getElementById(btnId);
        const connectBtn = document.getElementById(connectBtnId);
        const canvas = document.getElementById(canvasId);
        const svgLayer = document.getElementById(svgLayerId);

        let isDel = is9A ? deleteMode9A : deleteMode9B;
        isDel = !isDel;
        if (is9A) deleteMode9A = isDel;
        else deleteMode9B = isDel;

        // Turn off connect mode if delete mode turned on
        if (isDel) {
            if (is9A && connectMode9A) {
                connectMode9A = false;
                if (firstConnectNode9A) { firstConnectNode9A.style.boxShadow = ""; firstConnectNode9A = null; }
                if (connectBtn) {
                    connectBtn.style.backgroundColor = "var(--secondary-color)";
                    connectBtn.innerHTML = '<i data-lucide="link"></i> Enable Connect Mode';
                }
            } else if (!is9A && connectMode9B) {
                connectMode9B = false;
                if (firstConnectNode9B) { firstConnectNode9B.style.boxShadow = ""; firstConnectNode9B = null; }
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

        // Small Red 'x' Delete Button
        const delBtn = document.createElement("button");
        delBtn.className = "btn-node-delete";
        delBtn.title = `Delete ${label}`;
        delBtn.innerHTML = "&times;";
        delBtn.style.cssText = "position:absolute; top:-7px; right:-7px; width:18px; height:18px; background:#EF4444; color:white; border:none; border-radius:50%; font-size:12px; font-weight:bold; line-height:18px; text-align:center; cursor:pointer; padding:0; display:none; z-index:30; box-shadow:0 1px 3px rgba(0,0,0,0.3);";
        node.appendChild(delBtn);

        const isCurrentDel = () => part === "9A" ? deleteMode9A : deleteMode9B;
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
            const isConnect = part === "9A" ? connectMode9A : connectMode9B;
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

        // Double-click to configure IP for PCs (in Part 9A)
        if (type === "PC" && part === "9A") {
            node.addEventListener("dblclick", () => openIPConfigModal(label, part));
        }
    }

    function handleConnectClick(node, svgLayer, part) {
        let firstNode = part === "9A" ? firstConnectNode9A : firstConnectNode9B;
        const connections = part === "9A" ? connections9A : connections9B;
        const selectId = part === "9A" ? "cable-type-select-9a" : "cable-type-select-9b";
        const cableType = document.getElementById(selectId)?.value || "straight";

        if (!firstNode) {
            if (part === "9A") firstConnectNode9A = node;
            else firstConnectNode9B = node;
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
            if (part === "9A") firstConnectNode9A = null;
            else firstConnectNode9B = null;
        }
    }

    function refreshConnections(svgLayer, part) {
        if (!svgLayer) return;
        svgLayer.innerHTML = "";
        const canvas = document.getElementById(part === "9A" ? "topology-canvas-9a" : "topology-canvas-9b");
        if (canvas) {
            canvas.querySelectorAll(".btn-wire-delete").forEach(b => b.remove());
        }
        const connections = part === "9A" ? connections9A : connections9B;
        const isDel = part === "9A" ? deleteMode9A : deleteMode9B;

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

            // Wide transparent hitLine (22px wide) for easy targeting
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

            // Midpoint delete badge (HTML button)
            const delWireBtn = document.createElement("button");
            delWireBtn.className = "btn-wire-delete";
            const labelA = c.nodeA?.dataset?.label || "Device";
            const labelB = c.nodeB?.dataset?.label || "Device";
            delWireBtn.title = `Delete wire between ${labelA} and ${labelB}`;
            delWireBtn.innerHTML = "&times;";
            delWireBtn.style.cssText = `position:absolute; left:${Math.round(midX - 11)}px; top:${Math.round(midY - 11)}px; width:22px; height:22px; background:#EF4444; color:white; border:2px solid white; border-radius:50%; font-size:15px; font-weight:bold; line-height:18px; text-align:center; cursor:pointer; padding:0; z-index:15; box-shadow:0 1px 4px rgba(0,0,0,0.35); align-items:center; justify-content:center; opacity:0.95; transition:transform 0.15s ease, background 0.15s ease;`;
            delWireBtn.style.display = isDel ? "flex" : "none";

            const onWireHoverIn = () => {
                const curDel = part === "9A" ? deleteMode9A : deleteMode9B;
                if (curDel) {
                    delWireBtn.style.transform = "scale(1.25)";
                    delWireBtn.style.background = "#DC2626";
                }
            };

            const onWireHoverOut = () => {
                const curDel = part === "9A" ? deleteMode9A : deleteMode9B;
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

            // Green status indicator dots
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

    function validateTopology9A() {
        const canvas = document.getElementById("topology-canvas-9a");
        const fb = document.getElementById("topology-feedback-9a");
        const nodes = Array.from(canvas.querySelectorAll(".topo-node"));

        const labels = nodes.map(n => n.dataset.label);
        const hasPC0 = labels.includes("PC0");
        const hasPC1 = labels.includes("PC1");
        const hasPC2 = labels.includes("PC2");
        const hasPC3 = labels.includes("PC3");
        const hasSW0 = labels.includes("Switch0");
        const hasSW1 = labels.includes("Switch1");
        const hasSiteA = labels.includes("SITE-A");
        const hasSiteB = labels.includes("SITE-B");

        if (!hasPC0 || !hasPC1 || !hasPC2 || !hasPC3 || !hasSW0 || !hasSW1 || !hasSiteA || !hasSiteB) {
            fb.style.color = "#DC2626";
            fb.textContent = "❌ Missing devices. Ensure PC0, PC1, PC2, PC3, Switch0, Switch1, SITE-A, and SITE-B are placed on the canvas.";
            return;
        }

        // Verify required link connections
        function isConnected(lblA, lblB, requiredType) {
            return connections9A.some(c => {
                const a = c.nodeA.dataset.label;
                const b = c.nodeB.dataset.label;
                const pairMatch = (a === lblA && b === lblB) || (a === lblB && b === lblA);
                return pairMatch && (!requiredType || c.cableType === requiredType);
            });
        }

        const linkPC0_SW0 = isConnected("PC0", "Switch0");
        const linkPC1_SW0 = isConnected("PC1", "Switch0");
        const linkSW0_SiteA = isConnected("Switch0", "SITE-A");
        const linkSiteA_SiteB_serial = isConnected("SITE-A", "SITE-B", "serial");
        const linkSiteB_SW1 = isConnected("SITE-B", "Switch1");
        const linkPC2_SW1 = isConnected("PC2", "Switch1");
        const linkPC3_SW1 = isConnected("PC3", "Switch1");

        if (!linkPC0_SW0 || !linkPC1_SW0 || !linkSW0_SiteA) {
            fb.style.color = "#DC2626";
            fb.textContent = "❌ Incomplete LAN 1: Connect PC0 & PC1 to Switch0, and Switch0 to SITE-A.";
            return;
        }

        if (!linkSiteA_SiteB_serial) {
            fb.style.color = "#DC2626";
            fb.textContent = "❌ Missing Serial Link: Connect SITE-A and SITE-B using a Serial DCE cable.";
            return;
        }

        if (!linkSiteB_SW1 || !linkPC2_SW1 || !linkPC3_SW1) {
            fb.style.color = "#DC2626";
            fb.textContent = "❌ Incomplete LAN 2: Connect SITE-B to Switch1, and Switch1 to PC2 & PC3.";
            return;
        }

        fb.style.color = "#059669";
        fb.textContent = "✓ Exercise 9-A Topology verified successfully! Proceed to Stage 2: IP Addressing.";
        state["9A"].topologyValid = true;
        document.getElementById("exp9a-ip-stage").style.display = "block";

        logObs("Topology Checker", "Verified Exercise 9-A connections", "Success");
        syncServerMilestone("9A_TOPOLOGY_COMPLETE", "PPP network topology construction validated.");
    }

    function validateTopology9B() {
        const canvas = document.getElementById("topology-canvas-9b");
        const fb = document.getElementById("topology-feedback-9b");
        const nodes = Array.from(canvas.querySelectorAll(".topo-node"));

        const labels = nodes.map(n => n.dataset.label);
        const hasR0 = labels.includes("Router0");
        const hasR1 = labels.includes("Router1");

        if (!hasR0 || !hasR1) {
            fb.style.color = "#DC2626";
            fb.textContent = "❌ Missing devices. Ensure Router0 and Router1 are on the canvas.";
            return;
        }

        function isConnected(lblA, lblB, requiredType) {
            return connections9B.some(c => {
                const a = c.nodeA.dataset.label;
                const b = c.nodeB.dataset.label;
                const pairMatch = (a === lblA && b === lblB) || (a === lblB && b === lblA);
                return pairMatch && (!requiredType || c.cableType === requiredType);
            });
        }

        const serialLink = isConnected("Router0", "Router1", "serial");
        if (!serialLink) {
            fb.style.color = "#DC2626";
            fb.textContent = "❌ Connect Router0 and Router1 using a Serial DCE cable.";
            return;
        }

        fb.style.color = "#059669";
        fb.textContent = "✓ Exercise 9-B HDLC Serial link verified! Proceed to Stage 2: Addressing Table & Stage 3: CLI.";
        state["9B"].topologyValid = true;
        document.getElementById("exp9b-ip-stage").style.display = "block";
        document.getElementById("exp9b-cli-card").style.display = "block";

        logObs("Topology Checker", "Verified Exercise 9-B HDLC link", "Success");
        syncServerMilestone("9B_TOPOLOGY_COMPLETE", "HDLC serial topology construction validated.");
    }

    /* ═══════════════════════════════════════════════
     * IP CONFIGURATION MODAL (Part 9A)
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
        maskIn.value = saved.mask || "255.255.255.0";
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

                // Update status in Stage 2 table
                const statusEl = document.getElementById(`cfg-status-${activeModalPc.toLowerCase()}`);
                if (statusEl) {
                    statusEl.innerHTML = `<span style="color:#059669; font-weight:600;">Configured (${ip})</span>`;
                }

                logObs("IP Config", `Configured ${activeModalPc} with IP ${ip}`, "Success");

                // Check if all 4 PCs are configured
                checkIPStageComplete();
            });
        }
    }

    function checkIPStageComplete() {
        const p = state["9A"].pcConfigured;
        const pc0OK = p.PC0.ip === "192.168.10.2";
        const pc1OK = p.PC1.ip === "192.168.10.3";
        const pc2OK = p.PC2.ip === "192.168.20.2";
        const pc3OK = p.PC3.ip === "192.168.20.3";

        if (pc0OK && pc1OK && pc2OK && pc3OK) {
            document.getElementById("exp9a-cli-card").style.display = "block";
            logObs("IP Addressing", "Stage 2 Complete (Exercise 9-A)", "All PCs configured per table. Unlocked Stage 3: Router CLI.");
            syncServerMilestone("9A_IP_CONFIGURED", "Host IP addresses configured for Exercise 9-A.");
        }
    }

    /* ═══════════════════════════════════════════════
     * CISCO IOS CLI SIMULATION ENGINES
     * ═══════════════════════════════════════════════ */

    function initCliEngines() {
        // Router selector 9A
        document.querySelectorAll("#r-selector-9a .btn-r-sel-9a").forEach(btn => {
            btn.addEventListener("click", () => {
                document.querySelectorAll("#r-selector-9a .btn-r-sel-9a").forEach(b => {
                    b.classList.remove("active");
                    b.style.background = "#E2E8F0";
                    b.style.color = "#334155";
                });
                btn.classList.add("active");
                btn.style.background = "#2563EB";
                btn.style.color = "white";

                const r = btn.dataset.r;
                state["9A"].activeRouter = r;
                updatePrompt("9A");
                printLine(`\n[ Switched CLI active console to Router ${r} ]`, "9A");
            });
        });

        // Router selector 9B
        document.querySelectorAll("#r-selector-9b .btn-r-sel-9b").forEach(btn => {
            btn.addEventListener("click", () => {
                document.querySelectorAll("#r-selector-9b .btn-r-sel-9b").forEach(b => {
                    b.classList.remove("active");
                    b.style.background = "#E2E8F0";
                    b.style.color = "#334155";
                });
                btn.classList.add("active");
                btn.style.background = "#2563EB";
                btn.style.color = "white";

                const r = btn.dataset.r;
                state["9B"].activeRouter = r;
                updatePrompt("9B");
                printLine(`\n[ Switched CLI active console to ${r} ]`, "9B");
            });
        });

        // Input 9A
        const input9A = document.getElementById("terminal-input-9a");
        if (input9A) {
            input9A.addEventListener("keydown", e => {
                if (e.key === "Enter") {
                    const cmd = input9A.value.trim();
                    input9A.value = "";
                    executeCommand9A(cmd);
                }
            });
        }

        // Input 9B
        const input9B = document.getElementById("terminal-input-9b");
        if (input9B) {
            input9B.addEventListener("keydown", e => {
                if (e.key === "Enter") {
                    const cmd = input9B.value.trim();
                    input9B.value = "";
                    executeCommand9B(cmd);
                }
            });
        }

        // Quick Ping Buttons
        const pingBtn9A = document.getElementById("btn-quick-ping-9a");
        if (pingBtn9A) pingBtn9A.addEventListener("click", () => runQuickPing("9A"));

        const pingBtn9B = document.getElementById("btn-quick-ping-9b");
        if (pingBtn9B) pingBtn9B.addEventListener("click", () => runQuickPing("9B"));
    }

    function updatePrompt(part) {
        if (part === "9A") {
            const active = state["9A"].activeRouter;
            const mode = state["9A"].cliMode[active];
            const promptEl = document.getElementById("terminal-prompt-9a");
            let pStr = `${active}#`;
            if (mode === "config") pStr = `${active}(config)#`;
            else if (mode === "ospf") pStr = `${active}(config-router)#`;
            else if (mode === "if") pStr = `${active}(config-if)#`;
            state["9A"].cliPrompt[active] = pStr;
            if (promptEl) promptEl.textContent = pStr;
        } else {
            const active = state["9B"].activeRouter;
            const mode = state["9B"].cliMode[active];
            const promptEl = document.getElementById("terminal-prompt-9b");
            let pStr = `${active}#`;
            if (mode === "config") pStr = `${active}(config)#`;
            else if (mode === "if") pStr = `${active}(config-if)#`;
            state["9B"].cliPrompt[active] = pStr;
            if (promptEl) promptEl.textContent = pStr;
        }
    }

    function printLine(str, part) {
        const outId = part === "9A" ? "terminal-output-9a" : "terminal-output-9b";
        const el = document.getElementById(outId);
        if (!el) return;
        el.textContent += str + "\n";
        el.scrollTop = el.scrollHeight;
    }

    /* ═══════════════════════════════════════════════
     * COMMAND EXECUTION: EXERCISE 9-A
     * ═══════════════════════════════════════════════ */

    function executeCommand9A(cmd) {
        const active = state["9A"].activeRouter;
        const mode = state["9A"].cliMode[active];
        const prompt = state["9A"].cliPrompt[active];

        printLine(`${prompt} ${cmd}`, "9A");
        if (!cmd) return;

        const low = cmd.toLowerCase().replace(/\s+/g, " ");

        // Navigation
        if (low === "conf t" || low === "configure terminal") {
            state["9A"].cliMode[active] = "config";
            updatePrompt("9A");
            return;
        }

        if (low === "exit" || low === "ex") {
            if (mode === "ospf" || mode === "if") {
                state["9A"].cliMode[active] = "config";
            } else if (mode === "config") {
                state["9A"].cliMode[active] = "priv";
            }
            updatePrompt("9A");
            return;
        }

        if (low === "end") {
            state["9A"].cliMode[active] = "priv";
            updatePrompt("9A");
            return;
        }

        // Hostname command
        if (low.startsWith("hostname ")) {
            printLine(`Hostname set to ${cmd.split(" ")[1]}`, "9A");
            return;
        }

        // Username SITE-X password cisco
        if (low.startsWith("username ")) {
            const peer = active === "SITE-A" ? "site-b" : "site-a";
            if (low.includes(peer) && low.includes("cisco")) {
                state["9A"].pppConfigured[active].user = true;
                printLine(`User account ${peer.toUpperCase()} authenticated with shared secret.`, "9A");
                logObs("PPP CHAP", `Configured username on ${active}`, "Success");
                checkPPPStageComplete();
            } else {
                printLine(`% Invalid remote peer username or password syntax. Expected: username ${peer.toUpperCase()} password cisco`, "9A");
            }
            return;
        }

        // Router OSPF 25
        if (low === "router ospf 25") {
            state["9A"].cliMode[active] = "ospf";
            updatePrompt("9A");
            return;
        }

        // Router-id
        if (low.startsWith("router-id ")) {
            printLine(`OSPF router-id assigned.`, "9A");
            return;
        }

        // Network statements in OSPF
        if (low.startsWith("network ")) {
            if (mode === "ospf") {
                state["9A"].ospfNetworks[active].add(low);
                printLine(`OSPF route advertised: ${cmd.replace('network ', '')}`, "9A");
                checkOspfStageComplete();
            } else {
                printLine("% Incomplete command. Enter router configuration mode first.", "9A");
            }
            return;
        }

        // Interface mode (e.g., int se0/3/0 or int se0/3/1)
        if (low.startsWith("int ") || low.startsWith("interface ")) {
            state["9A"].cliMode[active] = "if";
            updatePrompt("9A");
            return;
        }

        // Encapsulation ppp
        if (low === "encapsulation ppp" || low === "encap ppp") {
            if (mode === "if") {
                state["9A"].pppConfigured[active].encap = true;
                printLine("% LINK-3-UPDOWN: Interface Serial, changed state to up", "9A");
                printLine("% LINEPROTO-5-UPDOWN: Line protocol on Interface Serial, changed state to up", "9A");
                logObs("PPP Encapsulation", `Enabled PPP on ${active}`, "Success");
                checkPPPStageComplete();
            } else {
                printLine("% Enter interface configuration mode first.", "9A");
            }
            return;
        }

        // PPP authentication chap
        if (low === "ppp authentication chap" || low === "ppp auth chap") {
            if (mode === "if") {
                state["9A"].pppConfigured[active].chap = true;
                printLine("PPP CHAP authentication enabled on interface.", "9A");
                logObs("PPP CHAP", `Enabled CHAP on ${active}`, "Success");
                checkPPPStageComplete();
            } else {
                printLine("% Enter interface configuration mode first.", "9A");
            }
            return;
        }

        // Do write / write memory / copy running-config startup-config
        if (low === "do write" || low === "do wr" || low === "write" || low === "wr" || low === "write memory" || low === "copy running-config startup-config" || low === "copy run start") {
            printLine("Building configuration...\n[OK]", "9A");
            return;
        }

        // Show ip ospf neighbor (or do show ip ospf neighbor)
        if (low === "sh ip ospf neighbor" || low === "show ip ospf neighbor" || low === "do show ip ospf neighbor" || low === "do sh ip ospf neighbor") {
            showIpOspfNeighbor9A(active);
            return;
        }

        // Show int serial (or do show int serial)
        if (low.startsWith("sh int") || low.startsWith("show int") || low.startsWith("show interface") || low.startsWith("do show int") || low.startsWith("do sh int") || low.startsWith("do show interface")) {
            showIntSerial9A(active);
            return;
        }

        // Show ip interface brief
        if (low === "show ip int brief" || low === "show ip interface brief" || low === "sh ip int br" || low === "do show ip int brief" || low === "do show ip interface brief") {
            printLine("Interface                  IP-Address      OK? Method Status                Protocol", "9A");
            if (active === "SITE-A") {
                printLine("GigabitEthernet0/0         192.168.10.1    YES manual up                    up", "9A");
                printLine("Serial0/3/0                10.10.10.1      YES manual up                    up", "9A");
            } else {
                printLine("GigabitEthernet0/0         192.168.20.1    YES manual up                    up", "9A");
                printLine("Serial0/3/1                10.10.10.2      YES manual up                    up", "9A");
            }
            return;
        }

        // Help
        if (low === "help" || low === "?") {
            printLine("Available commands:", "9A");
            printLine("  configure terminal | conf t", "9A");
            printLine("  router ospf 25", "9A");
            printLine("  router-id <x.x.x.x>", "9A");
            printLine("  network <net> <wildcard> area 0", "9A");
            printLine("  username <PEER> password cisco", "9A");
            printLine("  interface Serial0/3/0 | Serial0/3/1", "9A");
            printLine("  encapsulation ppp", "9A");
            printLine("  ppp authentication chap", "9A");
            printLine("  do write | write | do wr", "9A");
            printLine("  show ip ospf neighbor", "9A");
            printLine("  show interface Serial0/3/0 | Serial0/3/1", "9A");
            printLine("  exit | end", "9A");
            return;
        }

        // Ping
        if (low.startsWith("ping ")) {
            const dest = cmd.split(" ")[1];
            handleCliPing(dest, "9A");
            return;
        }

        // Fallback
        printLine(`% Unknown or unsupported command: '${cmd}'. Type 'help' or refer to Procedure.`, "9A");
    }

    function checkOspfStageComplete() {
        const aDone = state["9A"].ospfNetworks["SITE-A"].size >= 2;
        const bDone = state["9A"].ospfNetworks["SITE-B"].size >= 2;

        if (aDone && bDone && !state["9A"].ospfConfigured["SITE-A"]) {
            state["9A"].ospfConfigured["SITE-A"] = true;
            state["9A"].ospfConfigured["SITE-B"] = true;
            logObs("OSPF Configuration", "OSPF 25 Configured", "Both SITE-A and SITE-B advertised WAN and LAN subnets into Area 0.");
            syncServerMilestone("9A_OSPF_CONFIGURED", "OSPF 25 configuration validated.");
        }
    }

    function checkPPPStageComplete() {
        const pA = state["9A"].pppConfigured["SITE-A"];
        const pB = state["9A"].pppConfigured["SITE-B"];

        const aOK = pA.encap && pA.chap && pA.user;
        const bOK = pB.encap && pB.chap && pB.user;

        if (aOK && bOK) {
            document.getElementById("exp9a-verify-card").style.display = "block";
            logObs("PPP Configuration", "PPP CHAP Authenticated", "Mutual CHAP passwords and encapsulation established.");
            syncServerMilestone("9A_PPP_CHAP_CONFIGURED", "PPP with CHAP authentication fully configured.");
        }
    }

    function showIpOspfNeighbor9A(active) {
        printLine("Neighbor ID     Pri   State           Dead Time   Address         Interface", "9A");
        if (active === "SITE-A") {
            printLine("1.1.2.2           0   FULL/  -        00:00:34    10.10.10.2      Serial0/3/0", "9A");
        } else {
            printLine("1.1.1.1           0   FULL/  -        00:00:32    10.10.10.1      Serial0/3/1", "9A");
        }
        logObs("CLI Verification", "sh ip ospf neighbor", "FULL neighbor adjacency confirmed over PPP link");
    }

    function showIntSerial9A(active) {
        const ifName = active === "SITE-A" ? "Serial0/3/0" : "Serial0/3/1";
        const ip = active === "SITE-A" ? "10.10.10.1/30" : "10.10.10.2/30";
        printLine(`${ifName} is up, line protocol is up (connected)`, "9A");
        printLine("  Hardware is WIC MBRD-1-SERIAL", "9A");
        printLine(`  Internet address is ${ip}`, "9A");
        printLine("  MTU 1500 bytes, BW 1544 Kbit/sec, DLY 20000 usec, reliability 255/255", "9A");
        printLine("  Encapsulation PPP, LCP Open, loopback not set", "9A");
        printLine("  Open: IPCP", "9A");
        logObs("CLI Verification", `sh int ${ifName}`, "Encapsulation PPP & LCP Open verified");
    }

    /* ═══════════════════════════════════════════════
     * COMMAND EXECUTION: EXERCISE 9-B
     * ═══════════════════════════════════════════════ */

    function executeCommand9B(cmd) {
        let active = state["9B"].activeRouter || "Router0";
        if (active === "R0") active = "Router0";
        if (active === "R1") active = "Router1";
        state["9B"].activeRouter = active;

        if (!state["9B"].hdlcConfigured[active]) {
            state["9B"].hdlcConfigured[active] = { ip: false, hdlc: false, noShut: false };
        }
        if (!state["9B"].cliMode[active]) {
            state["9B"].cliMode[active] = "priv";
        }
        if (!state["9B"].cliPrompt[active]) {
            state["9B"].cliPrompt[active] = `${active}#`;
        }

        const mode = state["9B"].cliMode[active];
        const prompt = state["9B"].cliPrompt[active];

        printLine(`${prompt} ${cmd}`, "9B");
        if (!cmd) return;

        const low = cmd.toLowerCase().replace(/\s+/g, " ");

        // Navigation
        if (low === "conf t" || low === "configure terminal") {
            state["9B"].cliMode[active] = "config";
            updatePrompt("9B");
            return;
        }

        if (low === "exit" || low === "ex") {
            if (mode === "if") {
                state["9B"].cliMode[active] = "config";
            } else if (mode === "config") {
                state["9B"].cliMode[active] = "priv";
            }
            updatePrompt("9B");
            return;
        }

        if (low === "end") {
            state["9B"].cliMode[active] = "priv";
            updatePrompt("9B");
            return;
        }

        // Hardware inspection: show controllers
        if (low.startsWith("show controllers") || low.startsWith("sh controllers")) {
            state["9B"].controllersInspected[active] = true;
            showControllers9B(active);
            return;
        }

        // Interface mode (e.g., int se0/1/0 or int se0/1/1)
        if (low.startsWith("int ") || low.startsWith("interface ")) {
            state["9B"].cliMode[active] = "if";
            updatePrompt("9B");
            return;
        }

        // IP Address
        if (low.startsWith("ip address ") || low.startsWith("ip add ")) {
            if (mode === "if") {
                state["9B"].hdlcConfigured[active].ip = true;
                printLine(`IP address configured on serial interface.`, "9B");
                checkHDLCStageComplete();
            } else {
                printLine("% Enter interface configuration mode first.", "9B");
            }
            return;
        }

        // Encapsulation hdlc
        if (low === "encapsulation hdlc" || low === "encap hdlc") {
            if (mode === "if") {
                state["9B"].hdlcConfigured[active].hdlc = true;
                printLine("Encapsulation set to High-Level Data Link Control (HDLC).", "9B");
                logObs("HDLC Configuration", `encapsulation hdlc on ${active}`, "Success");
                checkHDLCStageComplete();
            } else {
                printLine("% Enter interface configuration mode first.", "9B");
            }
            return;
        }

        // No shut
        if (low === "no shut" || low === "no shutdown") {
            if (mode === "if") {
                state["9B"].hdlcConfigured[active].noShut = true;
                printLine("% LINK-3-UPDOWN: Interface Serial, changed state to up", "9B");
                printLine("% LINEPROTO-5-UPDOWN: Line protocol on Interface Serial, changed state to up", "9B");
                checkHDLCStageComplete();
            } else {
                printLine("% Enter interface configuration mode first.", "9B");
            }
            return;
        }

        // Enable / User EXEC to Privileged EXEC
        if (low === "enable" || low === "en") {
            state["9B"].cliMode[active] = "priv";
            updatePrompt("9B");
            return;
        }

        // Do write / write memory / copy run start
        if (low === "do write" || low === "do wr" || low === "write" || low === "wr" || low === "write memory" || low === "copy running-config startup-config" || low === "copy run start") {
            printLine("Building configuration...\n[OK]", "9B");
            return;
        }

        // Show int serial (or do show int serial)
        if (low.startsWith("sh int") || low.startsWith("show int") || low.startsWith("show interface") || low.startsWith("do show int") || low.startsWith("do sh int") || low.startsWith("do show interface")) {
            showIntSerial9B(active);
            return;
        }

        // Show ip interface brief
        if (low === "show ip int brief" || low === "show ip interface brief" || low === "sh ip int br" || low === "do show ip int brief" || low === "do show ip interface brief") {
            printLine("Interface                  IP-Address      OK? Method Status                Protocol", "9B");
            if (active === "Router0") {
                printLine("Serial0/1/0                192.168.1.1     YES manual up                    up", "9B");
            } else {
                printLine("Serial0/1/1                192.168.1.2     YES manual up                    up", "9B");
            }
            return;
        }

        // Help
        if (low === "help" || low === "?") {
            printLine("Available commands:", "9B");
            printLine("  enable | en", "9B");
            printLine("  configure terminal | conf t", "9B");
            printLine("  show controllers serial0/1/0 | serial0/1/1", "9B");
            printLine("  interface Serial0/1/0 | Serial0/1/1", "9B");
            printLine("  ip address <ip> 255.255.255.0", "9B");
            printLine("  encapsulation hdlc", "9B");
            printLine("  no shutdown | no shut", "9B");
            printLine("  ping 192.168.1.2 | ping 192.168.1.1", "9B");
            printLine("  show interface Serial0/1/0 | Serial0/1/1", "9B");
            printLine("  do write | write | do wr", "9B");
            printLine("  exit | end", "9B");
            return;
        }

        // Ping
        if (low.startsWith("ping ")) {
            const dest = cmd.split(" ")[1];
            handleCliPing(dest, "9B");
            return;
        }

        // Fallback
        printLine(`% Unknown or unsupported command: '${cmd}'. Refer to Exercise 9-B Procedure.`, "9B");
    }

    function checkHDLCStageComplete() {
        const h = state["9B"].hdlcConfigured;
        const r0Done = (h.Router0 && h.Router0.hdlc) || (h.R0 && h.R0.hdlc);
        const r1Done = (h.Router1 && h.Router1.hdlc) || (h.R1 && h.R1.hdlc);

        if (r0Done && r1Done) {
            document.getElementById("exp9b-verify-card").style.display = "block";
            logObs("HDLC Configuration", "HDLC Framing Configured", "Router0 and Router1 synchronous framing active.");
            syncServerMilestone("9B_HDLC_CONFIGURED", "HDLC protocol configuration validated.");
        }
    }

    function showControllers9B(active) {
        const ifName = active === "Router0" ? "Serial0/1/0" : "Serial0/1/1";
        const role = active === "Router0" ? "DCE" : "DTE";
        printLine(`Interface ${ifName}`, "9B");
        printLine(`Hardware is PowerQUICC MPC860`, "9B");
        printLine(`${role} V.35, clock rate 2000000`, "9B");
        printLine(`tx_clk_rate = 2000000, rx_clk_rate = 2000000`, "9B");
        printLine(`DTE V.35 TX and RX clocks detected.`, "9B");
        logObs("Hardware Inspection", `show controllers ${ifName}`, `Verified ${role} hardware controller`);
    }

    function showIntSerial9B(active) {
        const ifName = active === "Router0" ? "Serial0/1/0" : "Serial0/1/1";
        const ip = active === "Router0" ? "192.168.1.1/24" : "192.168.1.2/24";
        printLine(`${ifName} is up, line protocol is up (connected)`, "9B");
        printLine("  Hardware is WIC MBRD-1-SERIAL", "9B");
        printLine(`  Internet address is ${ip}`, "9B");
        printLine("  MTU 1500 bytes, BW 1544 Kbit/sec, DLY 20000 usec", "9B");
        printLine("  Encapsulation HDLC, loopback not set", "9B");
        printLine("  Keepalive set (10 sec)", "9B");
        logObs("CLI Verification", `show int ${ifName}`, "Encapsulation HDLC confirmed");
    }

    function handleCliPing(destIp, part) {
        printLine(`Type escape sequence to abort.`, part);
        printLine(`Sending 5, 100-byte ICMP Echos to ${destIp}, timeout is 2 seconds:`, part);
        printLine("!!!!!", part);
        printLine("Success rate is 100 percent (5/5), round-trip min/avg/max = 1/2/4 ms", part);
        logObs("Ping Simulation", `Ping ${destIp}`, "Success (100% reply rate)");

        if (part === "9A") {
            syncServerMilestone("9A_CONNECTIVITY_VERIFIED", "End-to-end ping across PPP WAN link verified.");
        } else {
            syncServerMilestone("9B_CONNECTIVITY_VERIFIED", "HDLC router-to-router ping verified.");
        }
    }

    function runQuickPing(part) {
        const outEl = document.getElementById(`verify-output-${part.toLowerCase()}`);
        const statusEl = document.getElementById(`ping-status-${part.toLowerCase()}`);

        if (statusEl) {
            statusEl.style.color = "#2563EB";
            statusEl.textContent = "Transmitting ICMP Echo Requests...";
        }

        setTimeout(() => {
            if (part === "9A") {
                if (outEl) {
                    outEl.innerHTML = `
Pinging 192.168.20.2 with 32 bytes of data:
Reply from 192.168.20.2: bytes=32 time=2ms TTL=126
Reply from 192.168.20.2: bytes=32 time=1ms TTL=126
Reply from 192.168.20.2: bytes=32 time=2ms TTL=126
Reply from 192.168.20.2: bytes=32 time=1ms TTL=126

Ping statistics for 192.168.20.2:
    Packets: Sent = 4, Received = 4, Lost = 0 (0% loss),
Approximate round trip times in milli-seconds:
    Minimum = 1ms, Maximum = 2ms, Average = 1ms
                    `;
                }
                if (statusEl) {
                    statusEl.style.color = "#059669";
                    statusEl.textContent = "✔ Ping Success: 100% Reachable across PPP WAN link!";
                }
                logObs("Ping Simulation", "Ping PC0 -> PC2 (192.168.20.2)", "Success");
                syncServerMilestone("9A_CONNECTIVITY_VERIFIED", "End-to-end ping across PPP link succeeded.");
            } else {
                if (outEl) {
                    outEl.innerHTML = `
Router0# ping 192.168.1.2
Type escape sequence to abort.
Sending 5, 100-byte ICMP Echos to 192.168.1.2, timeout is 2 seconds:
!!!!!
Success rate is 100 percent (5/5), round-trip min/avg/max = 1/2/4 ms
                    `;
                }
                if (statusEl) {
                    statusEl.style.color = "#059669";
                    statusEl.textContent = "✔ HDLC Serial Ping Success: 192.168.1.2 Reachable!";
                }
                logObs("Ping Simulation", "Ping Router0 -> Router1 (192.168.1.2)", "Success");
                syncServerMilestone("9B_CONNECTIVITY_VERIFIED", "Router-to-router HDLC serial ping succeeded.");
            }
        }, 500);
    }

    /* ═══════════════════════════════════════════════
     * PART SWITCHING & RESET
     * ═══════════════════════════════════════════════ */

    function initPartSwitchers() {
        const btn9A = document.getElementById("btn-mode-9a");
        const btn9B = document.getElementById("btn-mode-9b");
        const cont9A = document.getElementById("exp9-part-a");
        const cont9B = document.getElementById("exp9-part-b");
        const resetBtn = document.getElementById("btn-reset-exp9");

        if (btn9A && btn9B) {
            btn9A.addEventListener("click", () => {
                currentMode = "9A";
                btn9A.style.background = "var(--primary-color)";
                btn9A.style.color = "white";
                btn9B.style.background = "#F1F5F9";
                btn9B.style.color = "#334155";
                cont9A.style.display = "block";
                cont9B.style.display = "none";
            });

            btn9B.addEventListener("click", () => {
                currentMode = "9B";
                btn9B.style.background = "var(--primary-color)";
                btn9B.style.color = "white";
                btn9A.style.background = "#F1F5F9";
                btn9A.style.color = "#334155";
                cont9B.style.display = "block";
                cont9A.style.display = "none";
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
        initTopologyBuilder9A();
        initTopologyBuilder9B();
        initIPModalHandlers();
        initCliEngines();
    });

})();
