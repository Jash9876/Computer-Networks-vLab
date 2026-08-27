// Platform Manager: Handles Global State and Progression

const PlatformManager = {
    progression: {
        completed: [] // Array of completed exp numbers, e.g. [1, 2]
    },

    async init() {
        // 1. Initial immediate paint from localStorage cache
        this.loadLocalCache();
        this.applyProgressionUI();

        // 2. Fetch authoritative state from PostgreSQL API
        await this.syncFromServer();
    },

    loadLocalCache() {
        const savedProg = localStorage.getItem('vlab_progression');
        if (savedProg) {
            try {
                this.progression = JSON.parse(savedProg);
            } catch(e) {}
        }
    },

    async syncFromServer() {
        try {
            const token = localStorage.getItem('vlab_token');
            const authHeaders = token ? { 'Authorization': `Bearer ${token}` } : {};
            const res = await fetch('/api/progress/get', { headers: authHeaders });
            if (res.ok) {
                const data = await res.json();
                if (data && Array.isArray(data.completedExperiments)) {
                    this.progression.completed = data.completedExperiments;
                    localStorage.setItem('vlab_progression', JSON.stringify(this.progression));
                    this.applyProgressionUI();
                }
            }
        } catch (e) {
            console.warn('[PlatformManager] Using local progress cache.');
        }
    },

    async markCompleted(expNumber, score = 100) {
        // Strict Institutional Rule: Browser NEVER marks completion independently.
        // Server validation (PostgreSQL) is the sole authority for completion.
        try {
            const token = localStorage.getItem('vlab_token');
            const authHeaders = {
                'Content-Type': 'application/json',
                ...(token ? { 'Authorization': `Bearer ${token}` } : {})
            };
            
            // Sync milestone event to server
            await fetch('/api/events/log', {
                method: 'POST',
                headers: authHeaders,
                body: JSON.stringify({
                    experimentId: expNumber,
                    stage: 'EXPERIMENT_COMPLETED',
                    eventType: 'LAB_COMPLETED',
                    payload: { score, timestamp: new Date().toISOString() }
                })
            });

            // Re-sync authoritative state from PostgreSQL
            await this.syncFromServer();
        } catch (e) {
            console.warn('[VLab Platform] Server validation pending reconnection.');
        }
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
