// Platform Manager: Handles Global State, Progression, and Difficulty

const PlatformManager = {
    settings: {
        difficulty: 'beginner' // beginner, intermediate, advanced
    },
    progression: {
        completed: [] // Array of completed exp numbers, e.g. [1, 2]
    },

    init() {
        this.loadState();
        this.renderDifficultySelector();
        this.applyProgressionUI();
        
        // Listen for changes
        const diffSelect = document.getElementById('global-difficulty');
        if (diffSelect) {
            diffSelect.value = this.settings.difficulty;
            diffSelect.addEventListener('change', (e) => {
                this.setDifficulty(e.target.value);
            });
        }

        // Apply initial difficulty rules
        this.applyDifficultyRules();
    },

    loadState() {
        const savedDiff = localStorage.getItem('vlab_difficulty');
        if (savedDiff) this.settings.difficulty = savedDiff;

        const savedProg = localStorage.getItem('vlab_progression');
        if (savedProg) {
            try {
                this.progression = JSON.parse(savedProg);
            } catch(e) {}
        }
    },

    setDifficulty(level) {
        this.settings.difficulty = level;
        localStorage.setItem('vlab_difficulty', level);
        this.applyDifficultyRules();
    },

    applyDifficultyRules() {
        // Broadcast event so other modules (timer, etc) can react
        document.dispatchEvent(new CustomEvent('difficultyChanged', { detail: this.settings.difficulty }));

        // Handle visual hints globally based on difficulty
        const hints = document.querySelectorAll('.hint-text, [data-info]');
        hints.forEach(hint => {
            if (this.settings.difficulty === 'intermediate' || this.settings.difficulty === 'advanced') {
                if(hint.classList.contains('hint-text')) hint.style.display = 'none';
                if(hint.hasAttribute('data-info')) hint.removeAttribute('title'); // basic removal
            } else {
                if(hint.classList.contains('hint-text')) hint.style.display = 'block';
                if(hint.hasAttribute('data-info')) hint.setAttribute('title', hint.getAttribute('data-info'));
            }
        });
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
