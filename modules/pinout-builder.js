// Module 1 (Exp 2): Interactive Cable Configuration (T568B)

document.addEventListener('DOMContentLoaded', () => {
    const wireItems = document.querySelectorAll('.wire-item');
    const pinSlots = document.querySelectorAll('.pin-slot');
    const crimpBtn = document.getElementById('crimp-pinout');
    const resetBtn = document.getElementById('reset-pinout');
    const showCorrectBtn = document.getElementById('show-correct-pinout');
    const feedback = document.getElementById('pinout-feedback');
    const wireSource = document.getElementById('wire-source');
    const cableTester = document.getElementById('cable-tester');
    const runTestBtn = document.getElementById('run-test');
    const modeSelect = document.getElementById('pinout-mode-select');

    if (!crimpBtn) return; // Not on Exp 2 page

    let isCrimped = false;

    // Standard pinouts
    const t568b = ['ow', 'o', 'gw', 'bl', 'blw', 'g', 'brw', 'br'];
    const t568a = ['gw', 'g', 'ow', 'bl', 'blw', 'o', 'brw', 'br'];
    
    const colorNames = {
        'ow': 'Orange-White', 'o': 'Orange', 'gw': 'Green-White', 'g': 'Green',
        'bl': 'Blue', 'blw': 'Blue-White', 'brw': 'Brown-White', 'br': 'Brown'
    };

    if (showCorrectBtn) {
        showCorrectBtn.addEventListener('click', () => {
            const mode = modeSelect ? modeSelect.value : 'T568B';
            const expected = (mode === 'T568A' || mode === 'Crossover') ? t568a : t568b;
            const names = expected.map((c, i) => `Pin ${i+1}: ${colorNames[c]}`).join('\n');
            alert(`Correct Pinout for ${mode}:\n\n${names}\n\nNote: A Crossover cable has T568A on one end and T568B on the other. For the "Crossover" option here, build the T568A end!`);
        });
    }

    // Setup draggable wires
    wireItems.forEach(wire => {
        wire.addEventListener('dragstart', (e) => {
            if (isCrimped) { e.preventDefault(); return; }
            e.dataTransfer.setData('text/plain', wire.id);
            setTimeout(() => wire.classList.add('dragging'), 0);
        });

        wire.addEventListener('dragend', () => {
            wire.classList.remove('dragging');
        });
    });

    // Setup drop zones (Pin slots)
    pinSlots.forEach(slot => {
        slot.addEventListener('dragover', (e) => {
            e.preventDefault();
            slot.style.backgroundColor = '#E5E7EB';
        });

        slot.addEventListener('dragleave', () => {
            slot.style.backgroundColor = 'white';
        });

        slot.addEventListener('drop', (e) => {
            if (isCrimped) return;
            e.preventDefault();
            slot.style.backgroundColor = 'white';
            
            const wireId = e.dataTransfer.getData('text/plain');
            const wireElement = document.getElementById(wireId);
            
            // Only allow 1 wire per slot
            if (slot.querySelectorAll('.wire-item').length === 0) {
                // Remove text from slot
                slot.textContent = '';
                
                // Style wire for slot
                wireElement.style.height = '100%';
                wireElement.style.width = '100%';
                wireElement.style.writingMode = 'vertical-rl';
                wireElement.style.textOrientation = 'mixed';
                wireElement.style.margin = '0';
                wireElement.style.border = 'none';
                wireElement.classList.add('wire-slide-in');
                
                slot.appendChild(wireElement);
                
                if (typeof addObservation === 'function') {
                    const pinNum = slot.getAttribute('data-pin');
                    addObservation("Pinout Builder", "Placed wire into Pin " + pinNum, "Success");
                }
            }
        });
    });

    // Setup drop zone back to source
    if (wireSource) {
        wireSource.addEventListener('dragover', (e) => {
            if (isCrimped) return;
            e.preventDefault();
        });

        wireSource.addEventListener('drop', (e) => {
            if (isCrimped) return;
            e.preventDefault();
            const wireId = e.dataTransfer.getData('text/plain');
            const wireElement = document.getElementById(wireId);
            
            // Reset styles
            wireElement.style.height = 'auto';
            wireElement.style.width = 'auto';
            wireElement.style.writingMode = 'horizontal-tb';
            wireElement.style.margin = '0';
            wireElement.style.border = '1px solid #ccc';
            wireElement.classList.remove('wire-slide-in');
            
            wireSource.appendChild(wireElement);
            
            // Fix empty slots text
            pinSlots.forEach(s => {
                if(s.innerHTML === '') {
                    s.textContent = 'Pin ' + s.getAttribute('data-pin');
                }
            });
        });
    }

    crimpBtn.addEventListener('click', () => {
        if (isCrimped) return;
        
        let allFilled = true;
        pinSlots.forEach(slot => {
            if (!slot.querySelector('.wire-item')) allFilled = false;
        });

        if (!allFilled) {
            feedback.style.color = 'var(--text-main)';
            feedback.textContent = 'Please place all 8 wires into the RJ-45 pins first before crimping.';
            return;
        }

        isCrimped = true;
        crimpBtn.disabled = true;
        crimpBtn.style.opacity = '0.5';
        feedback.style.color = 'var(--text-main)';
        feedback.textContent = 'Connector crimped! Wires are locked. Now test the cable.';
        
        // Show tester
        cableTester.style.display = 'block';
        if(showCorrectBtn) showCorrectBtn.style.display = 'none';
    });

    runTestBtn.addEventListener('click', async () => {
        runTestBtn.disabled = true;
        feedback.textContent = 'Testing...';
        
        let currentPinout = [];
        pinSlots.forEach(slot => {
            const wire = slot.querySelector('.wire-item');
            currentPinout.push(wire ? wire.getAttribute('data-color') : null);
        });

        let isCorrect = true;
        const mode = modeSelect ? modeSelect.value : 'T568B';
        const expectedPinout = (mode === 'T568A' || mode === 'Crossover') ? t568a : t568b;
        
        // Sequentially test each pin with a delay
        for (let i = 0; i < 8; i++) {
            const led = document.getElementById(`led-${i+1}`);
            
            // Blink yellow to simulate testing
            led.style.backgroundColor = '#FBBF24';
            
            await new Promise(r => setTimeout(r, 400));
            
            if (currentPinout[i] === expectedPinout[i]) {
                led.style.backgroundColor = '#10B981'; // Green
                led.style.boxShadow = '0 0 10px #10B981';
            } else {
                led.style.backgroundColor = '#EF4444'; // Red
                led.style.boxShadow = '0 0 10px #EF4444';
                isCorrect = false;
            }
        }

        if (isCorrect) {
            feedback.style.color = '#059669';
            feedback.textContent = `Test Passed! You have successfully built the ${mode} configuration.`;
            if (typeof PlatformManager !== 'undefined') PlatformManager.markCompleted(2, 100);
            if (typeof addObservation === 'function') addObservation("Pinout Checker", `Tested ${mode}`, "Success");
        } else {
            feedback.style.color = '#EF4444';
            feedback.textContent = 'Test Failed! Incorrect wire order detected (Red LEDs). You must reset and try again.';
            if (showCorrectBtn) showCorrectBtn.style.display = 'block';
            if (typeof addObservation === 'function') addObservation("Pinout Checker", `Tested ${mode}`, "Failed");
        }
        
        runTestBtn.disabled = false;
    });

    resetBtn.addEventListener('click', () => {
        isCrimped = false;
        crimpBtn.disabled = false;
        crimpBtn.style.opacity = '1';
        cableTester.style.display = 'none';
        if (showCorrectBtn) showCorrectBtn.style.display = 'none';
        const wires = document.querySelectorAll('.pin-slot .wire-item');
        wires.forEach(wireElement => {
            // Reset styles
            wireElement.style.height = 'auto';
            wireElement.style.width = 'auto';
            wireElement.style.writingMode = 'horizontal-tb';
            wireElement.style.margin = '0';
            wireElement.style.border = '1px solid #ccc';
            wireElement.classList.remove('wire-slide-in');
            wireSource.appendChild(wireElement);
        });
        
        pinSlots.forEach(s => {
            s.textContent = 'Pin ' + s.getAttribute('data-pin');
        });
        
        feedback.textContent = '';
        
        // Reset LEDs
        for (let i = 1; i <= 8; i++) {
            const led = document.getElementById(`led-${i}`);
            if (led) {
                led.style.backgroundColor = '#4B5563';
                led.style.boxShadow = 'none';
            }
        }
    });
});
