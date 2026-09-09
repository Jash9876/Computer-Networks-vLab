// Main application script

document.addEventListener('DOMContentLoaded', () => {
    // 1. Load Data
    loadData();

    // 2. Setup Navigation
    setupNavigation();
});

function loadData() {
    if (typeof experimentData === 'undefined') {
        console.error("Experiment data not found. Ensure the experiment data file is loaded.");
        return;
    }

    // Aim
    const aimEl = document.getElementById('aim-text');
    if (aimEl) aimEl.innerHTML = experimentData.aim;
    
    // Objectives
    const objList = document.getElementById('objectives-list');
    if (objList && Array.isArray(experimentData.objectives)) {
        objList.innerHTML = '';
        experimentData.objectives.forEach(obj => {
            const li = document.createElement('li');
            li.textContent = obj;
            objList.appendChild(li);
        });
    }

    // Components List
    const compContainer = document.getElementById('components-container') || document.getElementById('components-list');
    if (compContainer) {
        if (experimentData.componentsHTML) {
            compContainer.innerHTML = experimentData.componentsHTML;
        } else if (Array.isArray(experimentData.components)) {
            compContainer.innerHTML = '';
            experimentData.components.forEach(comp => {
                const li = document.createElement('li');
                li.innerHTML = `<strong>${comp.name}</strong> &times; ${comp.count}`;
                compContainer.appendChild(li);
            });
        }
    }

    // Theory
    const theoryEl = document.getElementById('theory-content');
    if (theoryEl) theoryEl.innerHTML = experimentData.theory;

    // Procedure
    const procEl = document.getElementById('procedure-content');
    if (procEl) procEl.innerHTML = experimentData.procedure;

    // Static Observation / Expected Results content (if provided by the data file)
    const obsStaticEl = document.getElementById('observation-static-content');
    if (obsStaticEl && experimentData.observations) {
        obsStaticEl.innerHTML = experimentData.observations;
    }

    // Set loading placeholder for simulation observation table and result
    const obsContainer = document.getElementById('observation-content');
    if (obsContainer) {
        obsContainer.innerHTML = '<div style="padding: 1.5rem; text-align: center; color: #64748B;">⏳ <em>Restoring your academic observation record from database...</em></div>';
    }
    const resEl = document.getElementById('result-text');
    if (resEl) {
        resEl.innerHTML = '⏳ <em>Restoring your academic record from institutional database...</em>';
    }

    // Hydrate existing offline cache as fallback
    updateObservationTable();

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
            const targetSec = document.getElementById(targetId);
            if (targetSec) targetSec.classList.add('active');
            if (targetId === 'observation') {
                updateObservationTable();
            }
        });
    });
}

// Global Observation Tracker with LocalStorage Persistence (Experiment-Agnostic)
function getExpKey() {
    const match = window.location.pathname.match(/experiment(\d+)/i);
    const expId = match ? parseInt(match[1]) : 1;
    return `vlab_obs_exp_${expId}`;
}

const observations = (function() {
    try {
        const saved = localStorage.getItem(getExpKey());
        if (!saved) return [];
        const parsed = JSON.parse(saved);
        if (!Array.isArray(parsed)) return [];
        return parsed.map(item => ({
            time: item.time || new Date().toLocaleTimeString(),
            moduleName: item.moduleName || item.category || "Simulation",
            action: item.action || item.detail || "",
            result: item.result || item.outcome || "OK"
        })).filter(o => o.moduleName !== 'Lab Start');
    } catch(e) {
        return [];
    }
})();

window.observations = observations;
window.isHydrated = false;

window.setObservations = function(newObs) {
    if (Array.isArray(newObs)) {
        const validNew = newObs.filter(o => (o.moduleName || o.category) !== 'Lab Start');
        if (validNew.length > 0) {
            // Merge authoritative records with local observations, avoiding duplicates
            const existingKeys = new Set();
            const merged = [];
            validNew.forEach(o => {
                const key = `${o.time}_${o.moduleName || o.category}_${o.action || o.detail}`;
                existingKeys.add(key);
                merged.push({
                    time: o.time || new Date().toLocaleTimeString(),
                    moduleName: o.moduleName || o.category || "Simulation",
                    action: o.action || o.detail || "",
                    result: o.result || o.outcome || "OK"
                });
            });
            observations.forEach(o => {
                const key = `${o.time}_${o.moduleName || o.category}_${o.action || o.detail}`;
                if (!existingKeys.has(key)) {
                    existingKeys.add(key);
                    merged.push(o);
                }
            });
            observations.length = 0;
            merged.forEach(o => observations.push(o));
            try {
                localStorage.setItem(getExpKey(), JSON.stringify(observations));
            } catch(e) {}
            updateObservationTable();
        } else if (observations.length > 0) {
            // Keep local observations if server returns empty
            updateObservationTable();
        } else {
            updateObservationTable();
        }
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
}

window.addObservation = addObservation;
window.updateObservationTable = updateObservationTable;
window.getExpKey = getExpKey;

function updateObservationTable() {
    const container = document.getElementById('observation-content');
    if (!container) return;
    
    // Filter out any artificial/fake initial entries
    const validObservations = observations.filter(obs => {
        const mod = obs.moduleName || obs.category || '';
        return mod !== 'Lab Start';
    });

    if (validObservations.length === 0) {
        container.innerHTML = "<p>No observations recorded yet. Start interacting with the Simulation.</p>";
        const exportBtn = document.getElementById('export-csv');
        if (exportBtn) exportBtn.style.display = 'none';
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

    validObservations.forEach(obs => {
        const mod = obs.moduleName || obs.category || 'Simulation';
        const act = obs.action || obs.detail || '';
        const res = obs.result || obs.outcome || 'OK';
        html += `
            <tr>
                <td>${obs.time}</td>
                <td>${mod}</td>
                <td>${act}</td>
                <td>${res}</td>
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
        const validObservations = observations.filter(obs => {
            const mod = obs.moduleName || obs.category || '';
            return mod !== 'Lab Start';
        });
        if (validObservations.length === 0) return;
        
        let csv = 'Time,Module,Action,Result / Output\n';
        validObservations.forEach(obs => {
            const mod = `"${(obs.moduleName || obs.category || '').replace(/"/g, '""')}"`;
            const act = `"${(obs.action || obs.detail || '').replace(/"/g, '""')}"`;
            const res = `"${(obs.result || obs.outcome || '').replace(/"/g, '""')}"`;
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

    // Determine current experiment number dynamically from URL
    const match = window.location.pathname.match(/experiment(\d+)/i);
    const currentExpId = match ? parseInt(match[1]) : 1;

    // Collect user answers for secure server-side evaluation
    const userAnswers = [];
    const quizList = (typeof experimentData !== 'undefined' && experimentData.quiz) ? experimentData.quiz : [];
    quizList.forEach((q, idx) => {
        const selected = document.querySelector(`input[name="q${idx}"]:checked`);
        if (selected) {
            userAnswers.push({ questionIndex: idx, selectedIndex: parseInt(selected.value) });
        }
    });

    const token = localStorage.getItem('vlab_student_token') || localStorage.getItem('vlab_token');
    const authHeaders = {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };

    function renderLocalEvaluationFallback() {
        let localScore = 0;
        const totalQ = quizList.length || 5;
        const localDetails = [];

        quizList.forEach((q, idx) => {
            const selected = document.querySelector(`input[name="q${idx}"]:checked`);
            const selectedVal = selected ? parseInt(selected.value) : -1;
            const isCorrect = selectedVal === q.correct;
            if (isCorrect) localScore++;
            localDetails.push({
                questionIndex: idx,
                correct: isCorrect,
                correctIndex: q.correct
            });
        });

        const pct = totalQ > 0 ? Math.round((localScore / totalQ) * 100) : 0;
        const passed = pct >= 70;

        resultsEl.innerHTML = `
            <h3>Quiz Evaluation</h3>
            <p><strong>Attempt:</strong> ${currentAttempt}</p>
            <p><strong>Score:</strong> ${localScore} / ${totalQ} (${pct}%)</p>
            <p style="font-size:0.9rem; color:#4B5563;">${passed ? '🎉 Great job! You have passed the quiz with ' + pct + '% (Minimum 70% required).' : '💡 You scored ' + pct + '%. A minimum of 70% (4 correct out of 5) is required to pass. Please review the theory and retry.'}</p>
        `;

        localDetails.forEach(det => {
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

        const resTextEl = document.getElementById('result-text');
        if (resTextEl) {
            resTextEl.innerHTML = `
                <strong>Academic Lab Evaluation:</strong><br><br>
                • <strong>Current Quiz Score:</strong> ${localScore} / ${totalQ} (${pct}%)<br>
                • <strong>Status:</strong> ${passed ? '<span style="color:#059669; font-weight:bold;">Passed ✔</span>' : '<span style="color:#D97706; font-weight:bold;">In Progress (Quiz Retry Required &ge; 70%)</span>'}<br>
                • <strong>Passing Requirement:</strong> &ge; 70% (4 correct out of 5)<br>
                • <strong>Interactive Modules Completed:</strong> ${typeof observations !== 'undefined' ? new Set(observations.map(o => o.moduleName)).size : 0} module(s).
            `;
        }

        const certBtn = document.getElementById('view-cert-btn');
        if (certBtn) {
            certBtn.style.display = passed ? 'inline-block' : 'none';
        }
    }

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
                <p style="font-size:0.9rem; color:#4B5563;">${data.passed ? '🎉 Great job! You have passed the institutional quiz (' + officialPercentage + '% &ge; 70%).' : '💡 You scored ' + officialPercentage + '%. A minimum of 70% is required to pass. Review the hints above and try re-answering incorrect questions.'}</p>
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
                // If attempt did not earn a certificate, show button only if passed
                const certBtn = document.getElementById('view-cert-btn');
                if (certBtn) {
                    certBtn.style.display = data.passed ? 'inline-block' : 'none';
                }
            }

            // 3. Authoritative Result Tab update
            const resTextEl = document.getElementById('result-text');
            if (resTextEl) {
                resTextEl.innerHTML = `
                    <strong>Academic Lab Evaluation:</strong><br><br>
                    • <strong>Current Quiz Score:</strong> ${officialScore} / ${data.totalQuestions || total} (${officialPercentage}%)<br>
                    • <strong>Status:</strong> ${data.passed ? '<span style="color:#059669; font-weight:bold;">Completed ✔</span>' : '<span style="color:#D97706; font-weight:bold;">In Progress (Quiz Retry Required &ge; 70%)</span>'}<br>
                    • <strong>Certificate:</strong> ${data.certificateCode ? `<span style="font-family:monospace; color:#2563EB; font-weight:bold;">${data.certificateCode}</span>` : (data.passed ? '<span style="color:#059669;">Passed (&ge; 70%)</span>' : '<span style="color:#64748B;">Requires &ge; 70% Quiz Pass</span>')}<br>
                    • <strong>Interactive Modules Completed:</strong> ${typeof observations !== 'undefined' ? new Set(observations.map(o => o.moduleName)).size : 0} module(s).
                `;
            }

            // 4. Trigger platform server progression sync & re-sync authoritative history
            if (typeof PlatformManager !== 'undefined' && typeof PlatformManager.markCompleted === 'function' && data.passed) {
                PlatformManager.markCompleted(currentExpId, officialPercentage);
            }
            if (window.VLabSync && typeof window.VLabSync.restoreAuthoritativeHistory === 'function') {
                window.VLabSync.restoreAuthoritativeHistory();
            }
        } else {
            // If server returned non-success (e.g. guest or untracked), gracefully render local evaluation
            renderLocalEvaluationFallback();
        }
    })
    .catch(() => {
        renderLocalEvaluationFallback();
    })
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
