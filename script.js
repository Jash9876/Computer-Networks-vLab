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

    // Set loading placeholder for observation table and result
    const obsContainer = document.getElementById('observation-content');
    if (obsContainer) {
        obsContainer.innerHTML = '<div style="padding: 1.5rem; text-align: center; color: #64748B;">⏳ <em>Restoring your academic observation record from database...</em></div>';
    }
    const resEl = document.getElementById('result-text');
    if (resEl && !document.title.includes('Exercise 3')) {
        resEl.innerHTML = '⏳ <em>Restoring your academic record from institutional database...</em>';
    }

    // Hydrate existing offline cache as fallback
    if (observations.length > 0) {
        updateObservationTable();
        updateResultFromObservations();
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

// Global Observation Tracker with LocalStorage Persistence
function getExpKey() {
    let expId = 1;
    if (window.location.pathname.includes('experiment2')) expId = 2;
    else if (window.location.pathname.includes('experiment3')) expId = 3;
    else if (window.location.pathname.includes('experiment4')) expId = 4;
    else if (window.location.pathname.includes('experiment5')) expId = 5;
    return `vlab_obs_exp_${expId}`;
}

const observations = (function() {
    try {
        const saved = localStorage.getItem(getExpKey());
        return saved ? JSON.parse(saved) : [];
    } catch(e) {
        return [];
    }
})();

window.isHydrated = false;

window.setObservations = function(newObs) {
    if (Array.isArray(newObs)) {
        observations.length = 0;
        newObs.forEach(o => observations.push(o));
        try {
            localStorage.setItem(getExpKey(), JSON.stringify(observations));
        } catch(e) {}
        updateObservationTable();
    }
    window.isHydrated = true;
};

window.setQuizAttempt = function(num) {
    if (typeof num === 'number') {
        currentAttempt = num;
    }
};

function addObservation(moduleName, action, result) {
    observations.push({ time: new Date().toLocaleTimeString(), moduleName, action, result });
    try {
        localStorage.setItem(getExpKey(), JSON.stringify(observations));
    } catch(e) {}
    updateObservationTable();
    updateResultFromObservations();
}

function updateResultFromObservations() {
    const resTextEl = document.getElementById('result-text');
    if (!resTextEl) return;
    
    const count = observations.length;
    if (count > 0) {
        const quizObs = observations.find(o => o.moduleName === 'Quiz');
        const scoreInfo = quizObs ? ` (${quizObs.result})` : '';
        resTextEl.innerHTML = `
            <strong>Exercise Progress Recorded:</strong><br><br>
            • <strong>Total Observation Events:</strong> ${count}<br>
            • <strong>Modules Interacted:</strong> ${new Set(observations.map(o => o.moduleName)).size} module(s)<br>
            • <strong>Status:</strong> ${quizObs ? 'Quiz Completed' + scoreInfo : 'Simulations in progress. Complete the Quiz to view final score.'}
        `;
    }
}

function updateObservationTable() {
    const container = document.getElementById('observation-content');
    if (!container) return;
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
    const exportBtn = document.getElementById('export-csv');
    if (exportBtn) exportBtn.style.display = 'inline-block';
}

// CSV Export Logic
const exportCsvBtn = document.getElementById('export-csv');
if (exportCsvBtn) {
    exportCsvBtn.addEventListener('click', () => {
        if (observations.length === 0) return;
        
        let csv = 'Time,Module,Action,Result\n';
        observations.forEach(obs => {
            const mod = `"${(obs.moduleName || '').replace(/"/g, '""')}"`;
            const act = `"${(obs.action || '').replace(/"/g, '""')}"`;
            const res = `"${(obs.result || '').replace(/"/g, '""')}"`;
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
}

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

    const submitBtn = document.getElementById('submit-quiz');
    if (submitBtn) {
        if (!window.isHydrated) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Syncing record...';
        }
        submitBtn.addEventListener('click', evaluateQuiz);
    }
}

window.setHydrated = function() {
    window.isHydrated = true;
    const submitBtn = document.getElementById('submit-quiz');
    if (submitBtn && !isQuizSubmitting) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Submit Quiz';
    }
};

let isQuizSubmitting = false;

function evaluateQuiz() {
    if (isQuizSubmitting) return;

    const submitBtn = document.getElementById('submit-quiz');
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Evaluating...';
    }
    isQuizSubmitting = true;

    currentAttempt++;
    const total = experimentData.quiz.length;

    // Show neutral evaluating state across question feedback elements
    experimentData.quiz.forEach((q, index) => {
        const selected = document.querySelector(`input[name="q${index}"]:checked`);
        const feedbackEl = document.getElementById(`feedback-q${index}`);
        feedbackEl.style.display = 'block';

        if (!selected) {
            feedbackEl.className = 'quiz-feedback incorrect';
            feedbackEl.textContent = `Please select an option.`;
        } else {
            feedbackEl.className = 'quiz-feedback';
            feedbackEl.style.background = '#F1F5F9';
            feedbackEl.style.color = '#475569';
            feedbackEl.innerHTML = `⏳ <em>Evaluating with server...</em>`;
        }
    });

    const resultsEl = document.getElementById('quiz-results');
    resultsEl.style.display = 'block';
    resultsEl.innerHTML = `
        <h3>Quiz Evaluation</h3>
        <p><strong>Attempt:</strong> ${currentAttempt}</p>
        <p style="color:#64748B;">⏳ <em>Evaluating answers with server...</em></p>
    `;

    // Determine current experiment number
    let currentExpId = 1;
    if (window.location.pathname.includes('experiment2')) currentExpId = 2;
    else if (window.location.pathname.includes('experiment3')) currentExpId = 3;
    else if (window.location.pathname.includes('experiment4')) currentExpId = 4;
    else if (window.location.pathname.includes('experiment5')) currentExpId = 5;
    else if (window.location.pathname.includes('experiment6')) currentExpId = 6;

    // Collect user answers for secure server-side evaluation
    const userAnswers = [];
    const quizList = (typeof experimentData !== 'undefined' && experimentData.quiz) ? experimentData.quiz : [];
    quizList.forEach((q, idx) => {
        const selected = document.querySelector(`input[name="q${idx}"]:checked`);
        if (selected) {
            userAnswers.push({ questionIndex: idx, selectedIndex: parseInt(selected.value) });
        }
    });

    const token = localStorage.getItem('vlab_token');
    const authHeaders = {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };

    // Server-Side Secure Sync with Button State Release & Server-Authoritative Rendering
    fetch('/api/quiz/submit', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
            experimentId: currentExpId,
            userAnswers,
            attemptNumber: currentAttempt
        })
    })
    .then(res => res.ok ? res.json() : null)
    .then(data => {
        if (data && data.success) {
            const officialScore = typeof data.score === 'number' ? data.score : 0;
            const officialTotal = typeof data.totalQuestions === 'number' ? data.totalQuestions : total;
            const officialPercentage = typeof data.percentage === 'number' 
                ? data.percentage 
                : (officialTotal > 0 ? Math.round((officialScore / officialTotal) * 100) : 0);

            // 1. Authoritative Quiz Results display
            resultsEl.innerHTML = `
                <h3>Quiz Evaluation</h3>
                <p><strong>Attempt:</strong> ${currentAttempt}</p>
                <p><strong>Official Verified Score:</strong> ${officialScore} / ${officialTotal} (${officialPercentage}%)</p>
                <p style="font-size:0.9rem; color:#4B5563;">${data.passed ? '🎉 Great job! You have passed the institutional quiz.' : '💡 Review the hints above and try re-answering incorrect questions.'}</p>
            `;

            // 1b. Update question feedback boxes strictly according to server evaluation
            if (Array.isArray(data.details)) {
                data.details.forEach(det => {
                    const feedbackEl = document.getElementById(`feedback-q${det.questionIndex}`);
                    const qObj = quizList[det.questionIndex];
                    if (feedbackEl && qObj) {
                        feedbackEl.style.display = 'block';
                        if (det.correct) {
                            feedbackEl.className = 'quiz-feedback correct';
                            feedbackEl.textContent = `✔ Correct! ${qObj.explanation || ''}`;
                        } else {
                            feedbackEl.className = 'quiz-feedback incorrect';
                            if (currentAttempt === 1 && qObj.hint) {
                                feedbackEl.innerHTML = `❌ <strong>Not quite. Hint:</strong> ${qObj.hint} <br><em>Re-evaluate your choice and click Submit Quiz again.</em>`;
                            } else if (qObj.explanation) {
                                feedbackEl.innerHTML = `❌ <strong>Incorrect.</strong> ${qObj.explanation}`;
                            } else {
                                feedbackEl.innerHTML = `❌ <strong>Incorrect.</strong> The correct answer was: <em>${qObj.options[det.correctIndex]}</em>`;
                            }
                        }
                    }
                });
            }

            // 2. Authoritative Certificate Data
            if (data.certificateCode) {
                const certCodeEl = document.getElementById('cert-code');
                if (certCodeEl) certCodeEl.textContent = data.certificateCode;
                const certScoreEl = document.getElementById('cert-score');
                const certVerifiedScore = typeof data.certificateScore === 'number' ? data.certificateScore : officialPercentage;
                if (certScoreEl) certScoreEl.textContent = `${certVerifiedScore}%`;
                const certBtn = document.getElementById('view-cert-btn');
                if (certBtn) certBtn.style.display = 'inline-block';
            } else {
                // If attempt did not earn a certificate, don't show the certificate button for this failed attempt
                const certBtn = document.getElementById('view-cert-btn');
                if (certBtn && !data.passed) {
                    certBtn.style.display = 'none';
                }
            }

            // 3. Authoritative Result Tab update
            const resTextEl = document.getElementById('result-text');
            if (resTextEl) {
                resTextEl.innerHTML = `
                    <strong>Academic Lab Evaluation:</strong><br><br>
                    • <strong>Current Quiz Score:</strong> ${officialScore} / ${data.totalQuestions || total} (${officialPercentage}%)<br>
                    • <strong>Status:</strong> ${data.passed ? '<span style="color:#059669; font-weight:bold;">Completed ✔</span>' : '<span style="color:#D97706; font-weight:bold;">In Progress (Quiz Retry Required &ge; 70%)</span>'}<br>
                    • <strong>Certificate:</strong> ${data.certificateCode ? `<span style="font-family:monospace; color:#2563EB; font-weight:bold;">${data.certificateCode}</span>` : '<span style="color:#64748B;">Requires &ge; 70% Quiz Pass</span>'}<br>
                    • <strong>Interactive Modules Completed:</strong> ${new Set(observations.map(o => o.moduleName)).size} module(s).
                `;
            }

            // 4. Trigger platform server progression sync & re-sync authoritative history
            if (typeof PlatformManager !== 'undefined' && typeof PlatformManager.markCompleted === 'function' && data.passed) {
                PlatformManager.markCompleted(currentExpId, officialPercentage);
            }
            if (window.VLabSync && typeof window.VLabSync.restoreAuthoritativeHistory === 'function') {
                window.VLabSync.restoreAuthoritativeHistory();
            }
        }
    })
    .catch(() => {})
    .finally(() => {
        isQuizSubmitting = false;
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Submit Quiz';
        }
    });

    if(typeof addObservation === 'function') {
        addObservation("Quiz", "Submitted Quiz", `Attempt ${currentAttempt}`);
    }
}

// Certificate Modal Logic
const viewCertBtn = document.getElementById('view-cert-btn');
if (viewCertBtn) {
    viewCertBtn.addEventListener('click', () => {
        const modal = document.getElementById('cert-modal');
        if (modal) modal.style.display = 'flex';
    });
}

const closeCertBtn = document.getElementById('close-cert');
if (closeCertBtn) {
    closeCertBtn.addEventListener('click', () => {
        const modal = document.getElementById('cert-modal');
        if (modal) modal.style.display = 'none';
    });
}

const printCertBtn = document.getElementById('print-cert');
if (printCertBtn) {
    printCertBtn.addEventListener('click', () => {
        const certEl = document.getElementById('cert-content');
        if (!certEl) return;
        const originalContents = document.body.innerHTML;
        const printContents = certEl.outerHTML;
        
        document.body.innerHTML = `
            <div style="display:flex; justify-content:center; align-items:center; height:100vh;">
                ${printContents}
            </div>
        `;
        
        window.print();
        document.body.innerHTML = originalContents;
        window.location.reload();
    });
}
