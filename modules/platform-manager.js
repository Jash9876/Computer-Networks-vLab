// Platform Manager: Handles Global State and Progression

const PlatformManager = {
    progression: {
        completed: [] // Array of completed exp numbers, e.g. [1, 2]
    },

    init() {
        this.loadState();
        this.applyProgressionUI();
    },

    loadState() {
        const savedProg = localStorage.getItem('vlab_progression');
        if (savedProg) {
            try {
                this.progression = JSON.parse(savedProg);
            } catch(e) {}
        }
    },

    markCompleted(expNumber, score) {
        if (!this.progression.completed.includes(expNumber)) {
            this.progression.completed.push(expNumber);
            localStorage.setItem('vlab_progression', JSON.stringify(this.progression));
            this.applyProgressionUI();
        }
        // Save score if needed
        localStorage.setItem(`vlab_score_exp${expNumber}`, score);
    },

    applyProgressionUI() {
        // Update sidebar links with locks and checkmarks
        const navLinks = document.querySelectorAll('.sidebar nav ul li a');
        
        navLinks.forEach((link, index) => {
            const expNum = index + 1; // Assuming linear order 1,2,3,4...
            
            // Re-build inner HTML for icons
            let linkText = link.textContent.replace(/✓|🔒/g, '').trim();
            
            if (this.progression.completed.includes(expNum)) {
                link.innerHTML = `${linkText} <span style="color: #10B981; float: right;">✓</span>`;
                link.style.pointerEvents = 'auto';
                link.style.opacity = '1';
            } else if (expNum === 1 || this.progression.completed.includes(expNum - 1)) {
                // Unlocked but not completed (Exp 1 is always unlocked)
                link.innerHTML = `${linkText}`;
                link.style.pointerEvents = 'auto';
                link.style.opacity = '1';
            } else {
                // Locked
                link.innerHTML = `${linkText} <span style="color: #9CA3AF; float: right;">🔒</span>`;
                link.style.pointerEvents = 'none';
                link.style.opacity = '0.6';
            }
        });
    }
};

document.addEventListener('DOMContentLoaded', () => PlatformManager.init());
