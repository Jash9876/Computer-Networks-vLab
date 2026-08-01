// Advanced Difficulty Timer

const TimerManager = {
    interval: null,
    timeLeft: 0,
    uiElement: null,

    init() {
        // Create UI element
        this.uiElement = document.createElement('div');
        this.uiElement.style.position = 'fixed';
        this.uiElement.style.top = '20px';
        this.uiElement.style.right = '20px';
        this.uiElement.style.backgroundColor = '#EF4444'; // Red
        this.uiElement.style.color = 'white';
        this.uiElement.style.padding = '0.5rem 1rem';
        this.uiElement.style.borderRadius = '8px';
        this.uiElement.style.fontWeight = 'bold';
        this.uiElement.style.fontSize = '1.25rem';
        this.uiElement.style.zIndex = '1000';
        this.uiElement.style.display = 'none';
        this.uiElement.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1)';
        document.body.appendChild(this.uiElement);

        document.addEventListener('difficultyChanged', (e) => {
            if (e.detail === 'advanced') {
                this.startTimer(180); // 3 minutes
            } else {
                this.stopTimer();
            }
        });
    },

    startTimer(seconds) {
        this.stopTimer();
        this.timeLeft = seconds;
        this.uiElement.style.display = 'block';
        this.updateUI();

        this.interval = setInterval(() => {
            this.timeLeft--;
            this.updateUI();

            if (this.timeLeft <= 0) {
                this.stopTimer();
                alert("Time's up! In Advanced mode, you must complete the tasks quickly. The page will now reset.");
                window.location.reload();
            }
        }, 1000);
    },

    stopTimer() {
        if (this.interval) clearInterval(this.interval);
        this.uiElement.style.display = 'none';
    },

    updateUI() {
        const mins = Math.floor(this.timeLeft / 60);
        const secs = this.timeLeft % 60;
        this.uiElement.textContent = `⏱ ${mins}:${secs.toString().padStart(2, '0')}`;
    }
};

document.addEventListener('DOMContentLoaded', () => TimerManager.init());
