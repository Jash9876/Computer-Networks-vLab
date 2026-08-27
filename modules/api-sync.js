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

        // 1. Hydrate User Details from API or Session Cache
        async hydrateUser() {
            const token = localStorage.getItem('vlab_token');
            const authHeaders = token ? { 'Authorization': `Bearer ${token}` } : {};

            try {
                const res = await fetch('/api/auth/me', { headers: authHeaders });
                if (res.ok) {
                    const data = await res.json();
                    if (data && data.authenticated && data.user) {
                        this.user = data.user;
                        localStorage.setItem('vlab_user', JSON.stringify(this.user));
                        this.applyUserToDOM();
                        return;
                    }
                }
            } catch (e) {}

            // Fallback to local session storage
            try {
                this.user = JSON.parse(localStorage.getItem('vlab_user') || sessionStorage.getItem('vlab_user'));
                this.applyUserToDOM();
            } catch (e) {}
        },

        // 2. Authoritative PostgreSQL Observation & Result Restoration
        async restoreAuthoritativeHistory() {
            const token = localStorage.getItem('vlab_token');
            const authHeaders = token ? { 'Authorization': `Bearer ${token}` } : {};

            try {
                const res = await fetch(`/api/events/history?experimentId=${this.experimentId}`, { headers: authHeaders });
                if (res.ok) {
                    const data = await res.json();
                    if (data && Array.isArray(data.observations)) {
                        // Server is the authority: replace local cache with server records
                        if (typeof window.setObservations === 'function') {
                            window.setObservations(data.observations);
                        } else if (typeof observations !== 'undefined' && Array.isArray(observations)) {
                            observations.length = 0;
                            data.observations.forEach(o => observations.push(o));
                            if (typeof updateObservationTable === 'function') updateObservationTable();
                            if (typeof updateResultFromObservations === 'function') updateResultFromObservations();
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
                    if (data.progress && data.progress.status === 'completed') {
                        const resTextEl = document.getElementById('result-text');
                        if (resTextEl) {
                            const score = data.certificate ? data.certificate.final_score : (data.latestQuiz ? data.latestQuiz.score : 100);
                            const completedDate = data.progress.completed_at ? new Date(data.progress.completed_at).toLocaleString() : 'Recorded';
                            resTextEl.innerHTML = `
                                <strong>Academic Experiment Record Verified:</strong><br><br>
                                • <strong>Status:</strong> <span style="color: #059669; font-weight: bold;">Completed ✔</span><br>
                                • <strong>Verified Final Score:</strong> ${score}%<br>
                                • <strong>Official Completion Date:</strong> ${completedDate}<br>
                                • <strong>Academic Certificate:</strong> ${data.certificate ? `<span style="font-family: monospace; color: #2563EB;">${data.certificate.certificate_code}</span>` : 'Eligible'}<br>
                                • <strong>Milestone Events Logged:</strong> ${data.observations.length} activities.
                            `;
                        }
                    }
                }
            } catch (e) {
                console.warn('[VLabSync] Could not restore server history:', e);
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
                window.addObservation = (moduleName, action, result) => {
                    originalAddObs(moduleName, action, result);
                    
                    // Map common action keywords to verified milestone types
                    let eventType = 'CLI_COMMAND_EXECUTED';
                    const actLower = action.toLowerCase();
                    const resLower = result.toLowerCase();

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

                    this.logEvent(moduleName, eventType, { action, result });
                };
            }
        }
    };

    document.addEventListener('DOMContentLoaded', () => {
        // Determine experiment number from title or URL
        let expNum = 5;
        if (window.location.pathname.includes('experiment1')) expNum = 1;
        else if (window.location.pathname.includes('experiment2')) expNum = 2;
        else if (window.location.pathname.includes('experiment3')) expNum = 3;
        else if (window.location.pathname.includes('experiment4')) expNum = 4;
        else if (window.location.pathname.includes('experiment5')) expNum = 5;

        VLabSync.init(expNum);
    });
})();
