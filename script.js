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
    document.getElementById('result-text').textContent = "Complete the simulations and quiz to view the final result.";

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
            feedbackEl.textContent = `Please select an answer.`;
            return;
        }

        const selectedVal = parseInt(selected.value);
        if (selectedVal === q.answer) {
            score++;
            feedbackEl.className = 'quiz-feedback correct';
            feedbackEl.textContent = `Correct! ${q.explanation}`;
        } else {
            feedbackEl.className = 'quiz-feedback incorrect';
            feedbackEl.textContent = `Incorrect. The correct answer was "${q.options[q.answer]}". ${q.explanation}`;
        }
    });

    const percentage = (score / total) * 100;
    const resultsEl = document.getElementById('quiz-results');
    resultsEl.style.display = 'block';
    resultsEl.innerHTML = `
        <h3>Quiz Complete!</h3>
        <p><strong>Attempt:</strong> ${currentAttempt}</p>
        <p><strong>Score:</strong> ${score} / ${total} (${percentage}%)</p>
    `;

    // Show View Certificate Button if passed (or just finished)
    const certBtn = document.getElementById('view-cert-btn');
    certBtn.style.display = 'inline-block';
    
    // Setup Certificate Data
    document.getElementById('cert-score').textContent = `${percentage}%`;
    document.getElementById('cert-attempt').textContent = currentAttempt;
    document.getElementById('cert-date').textContent = new Date().toLocaleDateString();

    // Update Result tab
    document.getElementById('result-text').innerHTML = `
        You have completed the virtual lab exercise.<br><br>
        <strong>Final Quiz Score:</strong> ${percentage}% (Attempt ${currentAttempt})<br>
        <strong>Simulations Interacted:</strong> ${new Set(observations.map(o => o.moduleName)).size} modules.
    `;
    
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
