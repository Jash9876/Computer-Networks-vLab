// Main application script

document.addEventListener('DOMContentLoaded', () => {
    // 1. Load Data
    loadData();

    // 2. Setup Navigation
    setupNavigation();
});

function loadData() {
    if (typeof experimentData === 'undefined') {
        console.error("Experiment data not found. Ensure data/experiment1.js is loaded.");
        return;
    }

    // Aim
    document.getElementById('aim-text').textContent = experimentData.aim;
    
    // Objectives
    const objList = document.getElementById('objectives-list');
    objList.innerHTML = '';
    experimentData.objectives.forEach(obj => {
        const li = document.createElement('li');
        li.textContent = obj;
        objList.appendChild(li);
    });

    // Theory
    document.getElementById('theory-content').innerHTML = experimentData.theory;

    // Procedure
    document.getElementById('procedure-content').innerHTML = experimentData.procedure;

    // Result (will be updated dynamically, but set initial)
    // For Exercise 3, the CLI module manages the Result tab
    if (!document.title.includes('Exercise 3')) {
        document.getElementById('result-text').textContent = "Complete the simulations and quiz to view the final result.";
    }

    // Quiz
    setupQuiz();
}

function setupNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    const sections = document.querySelectorAll('.section');

    navItems.forEach(item => {
        item.addEventListener('click', () => {
            // Remove active class from all
            navItems.forEach(nav => nav.classList.remove('active'));
            sections.forEach(sec => sec.classList.remove('active'));

            // Add active class to clicked
            item.classList.add('active');
            const targetId = item.getAttribute('data-target');
            document.getElementById(targetId).classList.add('active');
        });
    });
}

// Global Observation Tracker
const observations = [];

function addObservation(moduleName, action, result) {
    observations.push({ time: new Date().toLocaleTimeString(), moduleName, action, result });
    updateObservationTable();
}

function updateObservationTable() {
    const container = document.getElementById('observation-content');
    if (observations.length === 0) {
        container.innerHTML = "<p>No observations recorded yet. Start interacting with the Simulation.</p>";
        return;
    }
    let html = `
        <table>
            <thead>
                <tr>
                    <th>Time</th>
                    <th>Module</th>
                    <th>Action</th>
                    <th>Result / Output</th>
                </tr>
            </thead>
            <tbody>
    `;

    observations.forEach(obs => {
        html += `
            <tr>
                <td>${obs.time}</td>
                <td>${obs.moduleName}</td>
                <td>${obs.action}</td>
                <td>${obs.result}</td>
            </tr>
        `;
    });

    html += `</tbody></table>`;
    container.innerHTML = html;
    
    // Show export button
    document.getElementById('export-csv').style.display = 'inline-block';
}

// CSV Export Logic
document.getElementById('export-csv').addEventListener('click', () => {
    if (observations.length === 0) return;
    
    let csv = 'Time,Module,Action,Result\n';
    observations.forEach(obs => {
        // Escape quotes and commas
        const mod = `"${obs.moduleName.replace(/"/g, '""')}"`;
        const act = `"${obs.action.replace(/"/g, '""')}"`;
        const res = `"${obs.result.replace(/"/g, '""')}"`;
        csv += `${obs.time},${mod},${act},${res}\n`;
    });
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'observations.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
});

// Quiz System
let currentAttempt = 0;

function setupQuiz() {
    const container = document.getElementById('quiz-container');
    container.innerHTML = '';

    experimentData.quiz.forEach((q, index) => {
        const qDiv = document.createElement('div');
        qDiv.className = 'quiz-question';
        
        let html = `<h4>Q${index + 1}: ${q.question}</h4><div class="quiz-options">`;
        
        q.options.forEach((opt, optIndex) => {
            html += `
                <label class="quiz-option">
                    <input type="radio" name="q${index}" value="${optIndex}">
                    ${opt}
                </label>
            `;
        });
        
        html += `</div><div class="quiz-feedback" id="feedback-q${index}"></div>`;
        qDiv.innerHTML = html;
        container.appendChild(qDiv);
    });

    document.getElementById('submit-quiz').addEventListener('click', evaluateQuiz);
}

function evaluateQuiz() {
    currentAttempt++;
    let score = 0;
    const total = experimentData.quiz.length;

    experimentData.quiz.forEach((q, index) => {
        const selected = document.querySelector(`input[name="q${index}"]:checked`);
        const feedbackEl = document.getElementById(`feedback-q${index}`);
        feedbackEl.style.display = 'block';

        if (!selected) {
            feedbackEl.className = 'quiz-feedback incorrect';
            feedbackEl.textContent = `Please select an option.`;
            return;
        }

        const selectedVal = parseInt(selected.value);
        if (selectedVal === q.answer) {
            score++;
            feedbackEl.className = 'quiz-feedback correct';
            feedbackEl.textContent = `✔ Correct! ${q.explanation || ''}`;
        } else {
            feedbackEl.className = 'quiz-feedback incorrect';
            if (currentAttempt === 1 && q.hint) {
                feedbackEl.innerHTML = `❌ <strong>Not quite. Hint:</strong> ${q.hint} <br><em>Re-evaluate your choice and click Submit Quiz again.</em>`;
            } else if (q.explanation) {
                feedbackEl.innerHTML = `❌ <strong>Incorrect.</strong> ${q.explanation}`;
            } else {
                feedbackEl.innerHTML = `❌ <strong>Incorrect.</strong> The correct answer was: <em>${q.options[q.answer]}</em>`;
            }
        }
    });

    const percentage = Math.round((score / total) * 100);
    const resultsEl = document.getElementById('quiz-results');
    resultsEl.style.display = 'block';
    resultsEl.innerHTML = `
        <h3>Quiz Evaluation</h3>
        <p><strong>Attempt:</strong> ${currentAttempt}</p>
        <p><strong>Score:</strong> ${score} / ${total} (${percentage}%)</p>
        <p style="font-size:0.9rem; color:#4B5563;">${percentage >= 70 ? '🎉 Great job! You have passed the quiz.' : '💡 Review the hints above and try re-answering incorrect questions.'}</p>
    `;

    // Show View Certificate Button if passed
    const certBtn = document.getElementById('view-cert-btn');
    if (certBtn) {
        certBtn.style.display = percentage >= 70 ? 'inline-block' : 'none';
    }
    
    // Setup Certificate Data
    const certScoreEl = document.getElementById('cert-score');
    if (certScoreEl) certScoreEl.textContent = `${percentage}%`;
    const certAttemptEl = document.getElementById('cert-attempt');
    if (certAttemptEl) certAttemptEl.textContent = currentAttempt;
    const certDateEl = document.getElementById('cert-date');
    if (certDateEl) certDateEl.textContent = new Date().toLocaleDateString();

    // Determine current experiment number
    let currentExpId = 1;
    if (window.location.pathname.includes('experiment2')) currentExpId = 2;
    else if (window.location.pathname.includes('experiment3')) currentExpId = 3;
    else if (window.location.pathname.includes('experiment4')) currentExpId = 4;
    else if (window.location.pathname.includes('experiment5')) currentExpId = 5;

    // Collect user answers for secure server-side evaluation
    const userAnswers = [];
    quizData.forEach((q, idx) => {
        const selected = document.querySelector(`input[name="q${idx}"]:checked`);
        if (selected) {
            userAnswers.push({ questionIndex: idx, selectedIndex: parseInt(selected.value) });
        }
    });

    // Server-Side Secure Sync
    fetch('/api/quiz/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            experimentId: currentExpId,
            userAnswers,
            attemptNumber: currentAttempt
        })
    })
    .then(res => res.ok ? res.json() : null)
    .then(data => {
        if (data && data.certificateCode) {
            const certCodeEl = document.getElementById('cert-code');
            if (certCodeEl) certCodeEl.textContent = data.certificateCode;
            if (typeof PlatformManager !== 'undefined' && typeof PlatformManager.markCompleted === 'function') {
                PlatformManager.markCompleted(currentExpId, percentage);
            }
        }
    })
    .catch(() => {});

    // Update Result tab
    const resTextEl = document.getElementById('result-text');
    if (resTextEl) {
        resTextEl.innerHTML = `
            You have completed the virtual lab exercise.<br><br>
            <strong>Final Quiz Score:</strong> ${percentage}% (Attempt ${currentAttempt})<br>
            <strong>Simulations Interacted:</strong> ${new Set(observations.map(o => o.moduleName)).size} modules.
        `;
    }
    
    if(typeof addObservation === 'function') {
        addObservation("Quiz", "Submitted Quiz", `Score: ${percentage}%`);
    }
}

// Certificate Modal Logic
document.getElementById('view-cert-btn').addEventListener('click', () => {
    document.getElementById('cert-modal').style.display = 'flex';
});

document.getElementById('close-cert').addEventListener('click', () => {
    document.getElementById('cert-modal').style.display = 'none';
});

document.getElementById('print-cert').addEventListener('click', () => {
    // Hide everything except cert-content for printing
    const originalContents = document.body.innerHTML;
    const printContents = document.getElementById('cert-content').outerHTML;
    
    document.body.innerHTML = `
        <div style="display:flex; justify-content:center; align-items:center; height:100vh;">
            ${printContents}
        </div>
    `;
    
    window.print();
    
    // Restore
    document.body.innerHTML = originalContents;
    window.location.reload(); // Quickest way to restore event listeners after innerHTML swap
});
