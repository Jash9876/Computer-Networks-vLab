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
});
