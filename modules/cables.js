// Module 3: Cable Identification

document.addEventListener('DOMContentLoaded', () => {
    const draggables = document.querySelectorAll('#cable-drag-items .draggable-item');
    const dropZones = document.querySelectorAll('#cable-drop-zones .drop-zone');

    draggables.forEach(draggable => {
        draggable.addEventListener('dragstart', () => {
            draggable.classList.add('dragging');
            // Store the ID of the dragged element
            draggable.dataset.draggedId = draggable.id;
        });

        draggable.addEventListener('dragend', () => {
            draggable.classList.remove('dragging');
        });
    });

    dropZones.forEach(zone => {
        zone.addEventListener('dragover', e => {
            e.preventDefault();
            zone.classList.add('drag-over');
        });

        zone.addEventListener('dragleave', () => {
            zone.classList.remove('drag-over');
        });

        zone.addEventListener('drop', e => {
            e.preventDefault();
            zone.classList.remove('drag-over');
            
            const dragging = document.querySelector('.dragging');
            if (!dragging) return;

            const targetId = zone.getAttribute('data-target');
            const draggedId = dragging.id;

            if (targetId === draggedId) {
                // Correct match
                const targetBox = zone.querySelector('.drop-target');
                targetBox.innerHTML = dragging.innerHTML;
                targetBox.style.borderColor = 'var(--primary-color)';
                targetBox.style.backgroundColor = '#EFF6FF';
                targetBox.style.color = 'var(--text-main)';
                targetBox.style.fontWeight = 'bold';
                
                // Hide the original draggable
                dragging.style.display = 'none';

                // Log observation
                if (typeof addObservation === 'function') {
                    addObservation("Cable Identification", "Matched " + dragging.getAttribute('data-name'), "Correct");
                }
            } else {
                // Incorrect match visual feedback
                zone.style.borderColor = 'red';
                setTimeout(() => {
                    zone.style.borderColor = 'var(--border-color)';
                }, 500);

                if (typeof addObservation === 'function') {
                    addObservation("Cable Identification", "Attempted to match " + dragging.getAttribute('data-name'), "Incorrect");
                }
            }
        });
    });

    // Stage 2: Pin Configuration
    const pinBtns = document.querySelectorAll('.pin-btn');
    const pinFeedback = document.getElementById('pin-feedback');

    pinBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const isCorrect = btn.getAttribute('data-correct') === 'true';
            if (isCorrect) {
                pinFeedback.textContent = "Correct! T568B uses this color standard.";
                pinFeedback.style.color = '#059669';
                if (typeof addObservation === 'function') {
                    addObservation("Cable Pins", "Selected T568B", "Correct");
                }
            } else {
                pinFeedback.textContent = "Incorrect. Try again.";
                pinFeedback.style.color = '#D97706';
                if (typeof addObservation === 'function') {
                    addObservation("Cable Pins", "Selected " + btn.textContent, "Incorrect");
                }
            }
        });
    });

    // Stage 3: Device Connectivity
    const connectSelect = document.getElementById('connectivity-select');
    const connectFeedback = document.getElementById('connectivity-feedback');

    if(connectSelect) {
        if (document.title.includes('Exercise 2')) {
            // Dynamic Exp 2 logic
            const scenarios = [
                { q: "connect a <strong>PC</strong> directly to another <strong>PC</strong>", a: "crossover", exp: "Like devices transmit and receive on the same pins, so a Crossover cable is needed to swap Tx and Rx." },
                { q: "connect a <strong>Switch</strong> to a <strong>PC</strong>", a: "straight", exp: "A Switch and a PC are unlike devices, so a Straight-Through cable is used." },
                { q: "connect a <strong>Router</strong> to a <strong>Switch</strong>", a: "straight", exp: "A Router and a Switch are unlike devices, so a Straight-Through cable is used." },
                { q: "connect a <strong>Switch</strong> to another <strong>Switch</strong>", a: "crossover", exp: "Switches are like devices. To connect them without uplink ports, a Crossover cable is needed." }
            ];
            
            // Randomize array
            for (let i = scenarios.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [scenarios[i], scenarios[j]] = [scenarios[j], scenarios[i]];
            }
            
            let currentScenario = 0;
            const questionText = connectSelect.previousElementSibling;
            
            function loadScenario() {
                if (currentScenario < scenarios.length) {
                    questionText.innerHTML = `Scenario ${currentScenario + 1}/${scenarios.length}: Select the correct cable to ${scenarios[currentScenario].q}:`;
                    connectSelect.value = "";
                    connectFeedback.textContent = "";
                } else {
                    questionText.innerHTML = "<strong>Awesome! You have completed all connectivity scenarios.</strong>";
                    connectSelect.style.display = "none";
                }
            }
            
            loadScenario();
            
            connectSelect.addEventListener('change', () => {
                const val = connectSelect.value;
                if (!val) return;
                
                const correct = scenarios[currentScenario].a;
                if (val === correct) {
                    connectFeedback.innerHTML = `<span style="color:#059669;"><strong>Correct!</strong> ${scenarios[currentScenario].exp}</span><br><button id="next-scenario-btn" class="btn" style="margin-top:0.5rem; background:#3B82F6;">Next Scenario</button>`;
                    connectSelect.disabled = true;
                    
                    document.getElementById('next-scenario-btn').addEventListener('click', () => {
                        currentScenario++;
                        connectSelect.disabled = false;
                        loadScenario();
                    });
                    
                    if (typeof addObservation === 'function') addObservation("Cable Connectivity", `Answered scenario ${currentScenario+1} correctly`, "Correct");
                } else {
                    connectFeedback.innerHTML = `<span style="color:#D97706;"><strong>Incorrect.</strong> Try again!</span>`;
                    if (typeof addObservation === 'function') addObservation("Cable Connectivity", `Answered scenario ${currentScenario+1} incorrectly`, "Incorrect");
                }
            });
        } else {
            // Exp 1 static logic
            connectSelect.addEventListener('change', () => {
                const val = connectSelect.value;
                if (val === 'crossover') {
                    connectFeedback.textContent = "Correct! Like devices (PC to PC, Switch to Switch) require a Crossover cable.";
                    connectFeedback.style.color = '#059669';
                    if (typeof addObservation === 'function') {
                        addObservation("Cable Connectivity", "Selected Crossover for PC-PC", "Correct");
                    }
                } else if (val) {
                    connectFeedback.textContent = "Incorrect. That cable is not used for connecting two PCs directly.";
                    connectFeedback.style.color = '#D97706';
                    if (typeof addObservation === 'function') {
                        addObservation("Cable Connectivity", "Selected " + val + " for PC-PC", "Incorrect");
                    }
                } else {
                    connectFeedback.textContent = "";
                }
            });
        }
    }
});
