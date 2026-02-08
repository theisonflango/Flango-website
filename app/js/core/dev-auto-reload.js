/**
 * Development Auto-Reload
 * Automatisk browser refresh når filer ændres (kun i development)
 * 
 * Dette script kører kun når:
 * - Host er localhost eller 127.0.0.1
 * - ELLER localStorage har 'dev-auto-reload' sat til 'true'
 */

(function() {
    'use strict';

    // Tjek om vi er i development mode
    const isDev = window.location.hostname === 'localhost' || 
                  window.location.hostname === '127.0.0.1' ||
                  localStorage.getItem('dev-auto-reload') === 'true';

    if (!isDev) {
        return; // Ikke i dev mode - gør intet
    }

    const POLL_INTERVAL = 500; // Tjek hvert 500ms for hurtigere response
    const RELOAD_DELAY = 100; // Vent 100ms før reload (undgå flere reloads)

    let reloadPending = false;
    let lastModified = null;

    /**
     * Tjek for filændringer via dev-server endpoint
     */
    async function checkForChanges() {
        if (reloadPending) return;

        try {
            const response = await fetch('/__dev_reload_check', {
                cache: 'no-cache',
                headers: {
                    'Cache-Control': 'no-cache'
                }
            });

            if (!response.ok) {
                // Endpoint ikke tilgængelig - fallback til document.lastModified
                checkDocumentModified();
                return;
            }

            const data = await response.json();
            
            if (data.changed) {
                console.log('[dev-auto-reload] ✅ Fil ændret - genindlæser siden om 2 sekunder...');
                console.log('[dev-auto-reload] ⚠️  Bemærk: Du kan miste din session ved reload');
                reloadPending = true;
                
                // Vis notifikation (valgfri - kan slettes)
                if (typeof showCustomAlert === 'function') {
                    showCustomAlert('Auto-Reload', 'Fil ændret - siden genindlæses om 2 sekunder...');
                }
                
                // Delay lidt længere så bruger kan se beskeden
                setTimeout(() => {
                    console.log('[dev-auto-reload] 🔄 Genindlæser nu...');
                    // Brug location.reload() med cache-bust
                    window.location.reload(true);
                }, 2000); // 2 sekunder i stedet for 100ms
            }

        } catch (error) {
            // Endpoint ikke tilgængelig - brug fallback
            checkDocumentModified();
        }
    }

    /**
     * Alternativ metode: Tjek document.lastModified
     * Dette virker bedre med nogle servere
     */
    function checkDocumentModified() {
        if (reloadPending) return;

        // Første gang - gem timestamp
        if (!lastModified) {
            lastModified = document.lastModified || Date.now();
            return;
        }

        // Tjek om document.lastModified er ændret
        const currentModified = document.lastModified || Date.now();
        if (currentModified !== lastModified) {
            console.log('[dev-auto-reload] ✅ Fil ændret (via document.lastModified) - genindlæser om 2 sekunder...');
            reloadPending = true;
            
            setTimeout(() => {
                console.log('[dev-auto-reload] 🔄 Genindlæser nu...');
                window.location.reload(true);
            }, 2000);
        }
    }

    /**
     * Start polling
     */
    function startPolling() {
        console.log('[dev-auto-reload] Auto-reload aktiveret (development mode)');
        console.log('[dev-auto-reload] Polling hvert', POLL_INTERVAL, 'ms');

        // Initialiser document.lastModified
        lastModified = document.lastModified || Date.now();

        // Prøv begge metoder
        setInterval(async () => {
            await checkForChanges();
            checkDocumentModified();
        }, POLL_INTERVAL);
    }

    // Start når DOM er klar
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', startPolling);
    } else {
        startPolling();
    }
})();
