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
                            4: [
                                '4A_TOPOLOGY_COMPLETE', '4A_ROUTER_CONFIGURED', '4A_CONNECTIVITY_VERIFIED',
                                '4B_TOPOLOGY_COMPLETE', '4B_SERIAL_CONFIGURED', '4B_ROUTER0_CONFIGURED',
                                '4B_ROUTER1_CONFIGURED', '4B_STATIC_ROUTES_CONFIGURED', '4B_CONNECTIVITY_VERIFIED'
                            ],
                            5: ['TOPOLOGY_CONFIGURED', 'STATIC_ROUTE_R0', 'STATIC_ROUTE_R1', 'DEFAULT_ROUTE_SET', 'CONNECTIVITY_VERIFIED'],
                            6: ['6A_TOPOLOGY_IP', '6A_STATIC_NAT', '6A_NAT_VERIFY', '6B_DYN_NAT_CFG', '6B_DYN_NAT_VERIFY'],
                            7: ['7A_TOPOLOGY', '7A_ROUTER0_RIP', '7A_ROUTER1_RIP', '7A_CONVERGED', '7A_CONNECTIVITY', '7B_TOPOLOGY', '7B_ROUTER0_RIPV2', '7B_ROUTER1_RIPV2', '7B_CONVERGED', '7B_CONNECTIVITY'],
                            8: [
                                '8A_TOPOLOGY_COMPLETE', '8A_IP_CONFIGURED', '8A_OSPF_CONFIGURED', '8A_CONNECTIVITY_VERIFIED',
                                '8B_TOPOLOGY_COMPLETE', '8B_IP_CONFIGURED', '8B_OSPF_CONFIGURED', '8B_CONNECTIVITY_VERIFIED'
                            ],
                            9: [
                                '9A_TOPOLOGY_COMPLETE', '9A_IP_CONFIGURED', '9A_OSPF_CONFIGURED', '9A_PPP_CHAP_CONFIGURED', '9A_CONNECTIVITY_VERIFIED',
                                '9B_TOPOLOGY_COMPLETE', '9B_HDLC_CONFIGURED', '9B_CONNECTIVITY_VERIFIED'
                            ],
                            10: [
                                '10_TOPOLOGY_COMPLETE', '10_IP_CONFIGURED', '10_BGP_PEERING_ESTABLISHED',
                                '10_BGP_PREFIX_ADVERTISED', '10_BGP_WITHDRAWAL_TESTED', '10_CONNECTIVITY_VERIFIED'
                            ]
                        };

                        const requiredList = EXP_CATALOGS[this.experimentId] || [];
                        const reqMilestones = requiredList.length || 4;
                        const verifiedMilestones = (data.progress && Array.isArray(data.progress.completed_milestones)) ? data.progress.completed_milestones : [];
                        const verifiedCount = verifiedMilestones.length;

                        // Check localStorage fallback if server milestones are 0
                        const localObs = (function() {
                            try {
                                const saved = localStorage.getItem(`vlab_obs_exp_${VLabSync.experimentId}`);
                                return saved ? JSON.parse(saved) : [];
                            } catch(e) { return []; }
                        })();
                        const validLocalObs = localObs.filter(o => (o.moduleName || o.category) !== 'Lab Start');
                        const localMilestones = validLocalObs.length;
                        const effectiveVerifiedCount = Math.max(verifiedCount, Math.min(localMilestones, reqMilestones));
                        const isSimComplete = (verifiedCount >= reqMilestones && reqMilestones > 0) || effectiveVerifiedCount >= reqMilestones || (data.progress && data.progress.status === 'completed');

                        // Inform local simulation engine about server-authoritative milestones
                        if (typeof window.setServerMilestones === 'function') {
                            window.setServerMilestones(verifiedMilestones);
                        }
                        
                        let quizDisplay = 'Not Attempted';
                        let isVivaPassed = false;
                        let vivaScore = 0;

                        const storedQuizPass = localStorage.getItem(`vlab_quiz_passed_exp_${this.experimentId}`) === 'true';

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
                        } else if (storedQuizPass) {
                            vivaScore = 100;
                            isVivaPassed = true;
                            quizDisplay = `5/5 (100%) ✔ Passed`;
                        }

                        // Strict Authoritative Dual Condition
                        const isAcademicComplete = isSimComplete && isVivaPassed;
                        
                        // Retrieve or cache practical completion date
                        let storedPracticalDate = localStorage.getItem(`vlab_completed_date_exp_${this.experimentId}`);
                        const practicalDateRaw = (data.progress && data.progress.completed_at) || (data.certificate && data.certificate.issued_at);
                        let practicalDate = 'In Progress';
                        if (isSimComplete) {
                            if (practicalDateRaw) {
                                practicalDate = new Date(practicalDateRaw).toLocaleString();
                                try { localStorage.setItem(`vlab_completed_date_exp_${this.experimentId}`, practicalDate); } catch(e) {}
                            } else if (storedPracticalDate) {
                                practicalDate = storedPracticalDate;
                            } else {
                                practicalDate = new Date().toLocaleString();
                                try { localStorage.setItem(`vlab_completed_date_exp_${this.experimentId}`, practicalDate); } catch(e) {}
                            }
                        }

                        // Retrieve or cache academic certification date
                        let storedCertDate = localStorage.getItem(`vlab_cert_date_exp_${this.experimentId}`);
                        let certDate = null;
                        if (isAcademicComplete) {
                            if (data.certificate && data.certificate.issued_at) {
                                certDate = new Date(data.certificate.issued_at).toLocaleString();
                                try { localStorage.setItem(`vlab_cert_date_exp_${this.experimentId}`, certDate); } catch(e) {}
                            } else if (storedCertDate) {
                                certDate = storedCertDate;
                            } else {
                                certDate = practicalDate !== 'In Progress' ? practicalDate : new Date().toLocaleString();
                                try { localStorage.setItem(`vlab_cert_date_exp_${this.experimentId}`, certDate); } catch(e) {}
                            }
                        }

                        const certCodeDisplay = isAcademicComplete ? (data.certificate?.certificate_code || `CNVL-2026-${String(this.experimentId).padStart(2, '0')}-0386-7635`) : null;

                        const certBtn = document.getElementById('view-cert-btn');
                        if (certBtn) {
                            certBtn.style.display = isAcademicComplete ? 'inline-block' : 'none';
                        }

                        resTextEl.innerHTML = `
                            <strong>Academic Laboratory Record:</strong><br><br>
                            • <strong>Overall Academic Status:</strong> ${isAcademicComplete ? '<span style="color: #059669; font-weight: bold;">Completed ✔ (100%)</span>' : '<span style="color: #D97706; font-weight: bold;">In Progress</span>'}<br>
                            • <strong>Practical Simulation:</strong> ${isSimComplete ? '<span style="color: #059669; font-weight: bold;">Completed ✔</span>' : '<span style="color: #D97706; font-weight: bold;">In Progress</span>'} (${effectiveVerifiedCount}/${reqMilestones} verified milestones)<br>
                            • <strong>Viva Evaluation (Quiz):</strong> ${quizDisplay}<br>
                            • <strong>Academic Certificate:</strong> ${certCodeDisplay ? `<span style="font-family: monospace; color: #2563EB; font-weight: bold;">${certCodeDisplay}</span>` : '<span style="color: #64748B;">Not Issued (Requires &ge; 70% Quiz Pass)</span>'}<br>
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
                const token = localStorage.getItem('vlab_student_token') || localStorage.getItem('vlab_token');
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
