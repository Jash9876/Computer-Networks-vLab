// Global Device Compatibility Gate (Laptop & Desktop Only Enforcement)
(function () {
    'use strict';

    function checkDeviceCompatibility() {
        const width = window.innerWidth;
        const hasCoarsePointer = window.matchMedia('(pointer: coarse)').matches && !window.matchMedia('(pointer: fine)').matches;
        const isMobileOrTablet = width < 1024 || hasCoarsePointer;

        let blocker = document.getElementById('device-compatibility-blocker');

        if (isMobileOrTablet) {
            if (!blocker) {
                blocker = document.createElement('div');
                blocker.id = 'device-compatibility-blocker';
                blocker.style.cssText = `
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100vw;
                    height: 100vh;
                    background: #0F172A;
                    color: white;
                    z-index: 9999999;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    padding: 2rem;
                    text-align: center;
                    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    box-sizing: border-box;
                `;

                blocker.innerHTML = `
                    <div style="background: rgba(30, 41, 59, 0.85); border: 1px solid #334155; border-radius: 16px; padding: 2.5rem 2rem; max-width: 480px; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);">
                        <div style="margin-bottom: 1.5rem;">
                            <img src="assets/images/srm-logo.png" alt="SRM Logo" style="height: 52px; object-fit: contain; margin-bottom: 0.75rem;">
                            <h2 style="font-size: 1.25rem; font-weight: 700; color: #F8FAFC; margin: 0 0 0.25rem;">Computer Networks Virtual Lab</h2>
                            <p style="font-size: 0.85rem; color: #94A3B8; margin: 0;">Department of Computer Science & Engineering</p>
                        </div>
                        
                        <div style="background: #1E293B; border-radius: 12px; padding: 1.5rem; margin-bottom: 1.5rem; border: 1px solid #475569;">
                            <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">💻</div>
                            <h3 style="font-size: 1.1rem; color: #60A5FA; margin: 0 0 0.5rem;">Laptop / Desktop Required</h3>
                            <p style="font-size: 0.875rem; color: #CBD5E1; line-height: 1.5; margin: 0;">
                                This laboratory environment contains interactive Cisco IOS CLI terminals, hardware drag-and-drop canvases, and real-time packet inspection modules designed exclusively for <strong>laptop and desktop workstations</strong> (minimum 1024px width).
                            </p>
                        </div>

                        <div style="font-size: 0.8rem; color: #64748B; border-top: 1px solid #334155; padding-top: 1rem;">
                            Please access the Virtual Laboratory portal from a desktop or laptop to complete your practical exercises and viva evaluations.
                        </div>
                    </div>
                `;

                document.body.appendChild(blocker);
                document.body.style.overflow = 'hidden';
            }
            blocker.style.display = 'flex';
        } else {
            if (blocker) {
                blocker.style.display = 'none';
                document.body.style.overflow = '';
            }
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', checkDeviceCompatibility);
    } else {
        checkDeviceCompatibility();
    }

    window.addEventListener('resize', checkDeviceCompatibility);
    window.addEventListener('orientationchange', checkDeviceCompatibility);
})();
