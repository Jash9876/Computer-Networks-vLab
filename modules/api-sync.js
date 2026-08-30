// Client Database & Event Sync Adapter
// Non-intrusively bridges client simulation events to PostgreSQL serverless API

(function () {
    'use strict';

    window.VLabSync = {
        user: null,
        experimentId: 5, // Default for Exp 5

        init(expNumber) {
            this.experimentId = expNumber || 1;
            this.hydrateUser();
            this.hookObservationLogger();
            this.restoreAuthoritativeHistory();
        },

        // 1. Hydrate User Details from API or Session Cache and verify classroom enrollment
        async hydrateUser() {
            const token = localStorage.getItem('vlab_student_token') || localStorage.getItem('vlab_token');
            if (!token) {
                window.location.href = 'index.html';
                return;
            }
            const authHeaders = { 'Authorization': `Bearer ${token}` };

            try {
                const res = await fetch('/api/auth/me', { headers: authHeaders });
                if (res.ok) {
                    const data = await res.json();
                    if (data && data.authenticated && data.user) {
                        this.user = data.user;
                        localStorage.setItem('vlab_user', JSON.stringify(this.user));
                        this.applyUserToDOM();

                        // Student Classroom Gate: Verify student is enrolled before running experiment
                        if (this.user.role === 'student') {
                            const classRes = await fetch('/api/classroom/status', { headers: authHeaders });
                            const classData = await classRes.json();
                            if (!classData || !classData.enrolled) {
                                alert('You must join a faculty classroom before accessing laboratory experiments.');
                                window.location.href = 'dashboard.html';
                                return;
                            }
                        }
                        return;
                    }
                } else if (res.status === 401) {
                    // Stale or invalid token: clean up and redirect to student login
                    localStorage.removeItem('vlab_token');
                    localStorage.removeItem('vlab_user');
                    window.location.href = 'index.html';
                    return;
                }
            } catch (e) {
                console.warn('[VLabSync] Session verification error:', e);
            }
        },

        // 2. Authoritative PostgreSQL Observation & Result Restoration
        async restoreAuthoritativeHistory() {
            const token = localStorage.getItem('vlab_student_token') || localStorage.getItem('vlab_token');
            const authHeaders = token ? { 'Authorization': `Bearer ${token}` } : {};

            try {
                const res = await fetch(`/api/events/history?experimentId=${this.experimentId}`, { headers: authHeaders });
                if (res.ok) {
                    const data = await res.json();
                    if (data && Array.isArray(data.observations)) {
                        // Server is the authoritative snapshot: update observation cache via window.setObservations
                        if (typeof window.setObservations === 'function') {
                            window.setObservations(data.observations);
                        } else if (typeof updateObservationTable === 'function') {
                            updateObservationTable();
                        }
                    }

                    // Restore Quiz Attempt Count
                    if (data.latestQuiz && typeof data.latestQuiz.attempt_number === 'number') {
                        if (typeof window.setQuizAttempt === 'function') {
                            window.setQuizAttempt(data.latestQuiz.attempt_number);
                        }
                    }

                    // Restore Certificate & Score state
                    if (data.certificate && data.certificate.certificate_code) {
                        const certCodeEl = document.getElementById('cert-code');
                        if (certCodeEl) certCodeEl.textContent = data.certificate.certificate_code;
                        const certScoreEl = document.getElementById('cert-score');
                        if (certScoreEl) certScoreEl.textContent = `${data.certificate.final_score}%`;
                        const viewCertBtn = document.getElementById('view-cert-btn');
                        if (viewCertBtn) viewCertBtn.style.display = 'inline-block';
                    }

                    // Restore Result Tab dynamically from Server
                    const resTextEl = document.getElementById('result-text');
                    if (resTextEl) {
                        const EXP_CATALOGS = {
                            1: ['CABLES_STUDIED', 'COMMANDS_EXECUTED', 'PT_UI_EXPLORED'],
                            2: ['IPV4_CONFIGURED', 'SUBNET_CALCULATED', 'PINOUT_CRIMPED', 'CABLE_TESTED'],
                            3: ['CONSOLE_CONNECTED', 'TERMINAL_CONFIGURED', 'HOSTNAME_SET', 'INTERFACES_CONFIGURED'],
                            4: ['SUBNET_DESIGNED', 'TOPOLOGY_WIRED', 'ROUTER_CONFIGURED', 'PING_VERIFIED'],
                            5: ['TOPOLOGY_CONFIGURED', 'STATIC_ROUTE_R0', 'STATIC_ROUTE_R1', 'DEFAULT_ROUTE_SET', 'CONNECTIVITY_VERIFIED'],
                            6: ['6A_TOPOLOGY_IP', '6A_STATIC_NAT', '6A_NAT_VERIFY', '6B_DYN_NAT_CFG', '6B_DYN_NAT_VERIFY']
                        };

                        const requiredList = EXP_CATALOGS[this.experimentId] || [];
                        const serverMilestones = Array.isArray(data.progress?.completed_milestones) ? data.progress.completed_milestones : [];
                        const verifiedMilestones = serverMilestones.filter(m => requiredList.includes(m));
                        const reqMilestones = requiredList.length || 5;
                        const verifiedCount = verifiedMilestones.length;
                        const isSimComplete = verifiedCount >= reqMilestones && reqMilestones > 0;
                        
                        // Inform local simulation engine about server-authoritative milestones
                        if (typeof window.setServerMilestones === 'function') {
                            window.setServerMilestones(verifiedMilestones);
                        }
                        
                        let quizDisplay = 'Not Attempted';
                        let isVivaPassed = false;
                        let vivaScore = 0;

                        if (data.latestQuiz && typeof data.latestQuiz.score === 'number') {
                            vivaScore = data.latestQuiz.total_questions > 0 
                                ? Math.round((data.latestQuiz.score / data.latestQuiz.total_questions) * 100)
                                : data.latestQuiz.score;
                            isVivaPassed = vivaScore >= 70;
                            quizDisplay = `${data.latestQuiz.score}/${data.latestQuiz.total_questions} (${vivaScore}%) ${isVivaPassed ? '✔ Passed' : '✘ Retry Required (&ge;70%)'}`;
                        } else if (data.progress && typeof data.progress.viva_score === 'number' && data.progress.viva_score > 0) {
                            vivaScore = data.progress.viva_score;
                            isVivaPassed = vivaScore >= 70;
                            quizDisplay = `${vivaScore}% ${isVivaPassed ? '✔ Passed' : '✘ Retry Required (&ge;70%)'}`;
                        } else if (data.certificate && typeof data.certificate.final_score === 'number') {
                            vivaScore = data.certificate.final_score;
                            isVivaPassed = vivaScore >= 70;
                            quizDisplay = `${vivaScore}% (Passed ✔)`;
                        }

                        // Strict Authoritative Dual Condition
                        const isAcademicComplete = isSimComplete && isVivaPassed;
                        const practicalDate = isSimComplete && data.progress && data.progress.completed_at ? new Date(data.progress.completed_at).toLocaleString() : 'In Progress';
                        const certDate = isAcademicComplete && data.certificate && data.certificate.issued_at ? new Date(data.certificate.issued_at).toLocaleString() : null;

                        resTextEl.innerHTML = `
                            <strong>Academic Laboratory Record:</strong><br><br>
                            • <strong>Overall Academic Status:</strong> ${isAcademicComplete ? '<span style="color: #059669; font-weight: bold;">Completed ✔ (100%)</span>' : '<span style="color: #D97706; font-weight: bold;">In Progress</span>'}<br>
                            • <strong>Practical Simulation:</strong> ${isSimComplete ? '<span style="color: #059669; font-weight: bold;">Completed ✔</span>' : '<span style="color: #D97706; font-weight: bold;">In Progress</span>'} (${verifiedCount}/${reqMilestones} verified milestones)<br>
                            • <strong>Viva Evaluation (Quiz):</strong> ${quizDisplay}<br>
                            • <strong>Academic Certificate:</strong> ${isAcademicComplete && data.certificate ? `<span style="font-family: monospace; color: #2563EB; font-weight: bold;">${data.certificate.certificate_code}</span>` : '<span style="color: #64748B;">Not Issued (Requires &ge; 70% Quiz Pass)</span>'}<br>
                            • <strong>Practical Completion Date:</strong> ${practicalDate}${certDate ? `<br>• <strong>Academic Certification Date:</strong> ${certDate}` : ''}
                        `;
                    }
                }
            } catch (e) {
                console.warn('[VLabSync] Could not restore server history:', e);
            } finally {
                if (typeof window.setHydrated === 'function') {
                    window.setHydrated();
                }
            }
        },

        applyUserToDOM() {
            if (!this.user) return;
            const certNameEl = document.getElementById('cert-name');
            if (certNameEl && this.user.fullName) {
                certNameEl.textContent = `${this.user.fullName} (${this.user.registerNumber})`;
            }
        },

        // 2. Log Educational Event to Serverless API
        async logEvent(stage, eventType, payload = {}) {
            try {
                const token = localStorage.getItem('vlab_token');
                const authHeaders = {
                    'Content-Type': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                };
                const res = await fetch('/api/events/log', {
                    method: 'POST',
                    headers: authHeaders,
                    body: JSON.stringify({
                        experimentId: this.experimentId,
                        stage,
                        eventType,
                        payload
                    })
                });
                return await res.json();
            } catch (err) {
                // Offline fallback - never block the client simulation
                return { status: 'offline_buffered' };
            }
        },

        // 3. Intercept and enrich observations automatically
        hookObservationLogger() {
            const originalAddObs = window.addObservation;
            if (typeof originalAddObs === 'function') {
                window.addObservation = (moduleName, action, result, evidence) => {
                    originalAddObs(moduleName, action, result);
                    
                    // Map common action keywords to verified milestone types
                    let eventType = 'CLI_COMMAND_EXECUTED';
                    const actLower = String(action || '').toLowerCase();
                    const resLower = String(result || '').toLowerCase();

                    if (actLower.includes('address') || actLower.includes('matched')) eventType = 'ADDRESSING_MATCHED';
                    else if (actLower.includes('subnet')) eventType = 'SUBNET_IDENTIFIED';
                    else if (actLower.includes('hardware') || actLower.includes('wic')) eventType = 'HARDWARE_INSTALLED';
                    else if (actLower.includes('topology')) eventType = 'TOPOLOGY_VALIDATED';
                    else if (actLower.includes('static route')) eventType = 'STATIC_ROUTE_CONFIGURED';
                    else if (actLower.includes('default route')) eventType = 'DEFAULT_ROUTE_CONFIGURED';
                    else if (actLower.includes('ping') && (resLower.includes('success') || resLower.includes('passed'))) eventType = 'PING_SUCCESS';
                    else if (actLower.includes('ping')) eventType = 'PING_FAILED';
                    else if (actLower.includes('tracert') || actLower.includes('traceroute')) eventType = 'TRACEROUTE_EXECUTED';
                    else if (actLower.includes('quiz')) eventType = 'QUIZ_SUBMITTED';

                    this.logEvent(moduleName, eventType, { action, result, evidence });
                };
            }
        }
    };

    document.addEventListener('DOMContentLoaded', () => {
        // Determine experiment number dynamically from URL
        const match = window.location.pathname.match(/experiment(\d+)/i);
        const expNum = match ? parseInt(match[1]) : 1;

        VLabSync.init(expNum);
    });
})();
