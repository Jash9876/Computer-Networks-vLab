// Module 1: Packet Tracer Explorer

document.addEventListener('DOMContentLoaded', () => {
    const ptExplorer = document.getElementById('pt-explorer');
    const ptInfo = document.getElementById('pt-info');

    if (!ptExplorer || !ptInfo) return;

    ptExplorer.addEventListener('click', (e) => {
        // Find the closest element with a data-info attribute
        const target = e.target.closest('[data-info]');
        if (target) {
            const infoText = target.getAttribute('data-info');
            ptInfo.innerHTML = `<strong>Exploration:</strong> ${infoText}`;
            
            // Log observation
            if (typeof addObservation === 'function') {
                const name = infoText.split(':')[0];
                addObservation("Packet Tracer Explorer", "Clicked " + name, "Read UI explanation");
            }

            // Visual feedback
            target.style.outline = "2px solid var(--accent-color)";
            setTimeout(() => {
                target.style.outline = "none";
            }, 500);
            
            // Prevent bubbling if clicking nested areas
            e.stopPropagation();
        }
    });
});
