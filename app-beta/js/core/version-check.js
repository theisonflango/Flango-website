// js/core/version-check.js
// Version check and update notification system

import { FLANGO_VERSION } from './config-and-supabase.js';

const VERSION_CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutter
const CACHE_PROBLEM_THRESHOLD = 24 * 60 * 60 * 1000; // 24 timer
const UPDATE_FIRST_SEEN_KEY = 'flango_update_first_seen';
const UPDATE_VERSION_KEY = 'flango_update_version';

let checkIntervalId = null;
let latestRemoteVersion = null;
let updateAvailable = false;
let lastSuccessfulCheck = null;

/**
 * Sammenlign to semantic versioner (x.y.z)
 * @returns {number} -1 hvis a < b, 0 hvis a == b, 1 hvis a > b
 */
function compareVersions(a, b) {
    const partsA = a.split('.').map(Number);
    const partsB = b.split('.').map(Number);

    for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
        const numA = partsA[i] || 0;
        const numB = partsB[i] || 0;
        if (numA < numB) return -1;
        if (numA > numB) return 1;
    }
    return 0;
}

/**
 * Fetch version.json med cache-busting
 */
async function fetchRemoteVersion() {
    try {
        const timestamp = Date.now();
        const response = await fetch(`/version.json?_=${timestamp}`, {
            cache: 'no-store',
            headers: {
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache'
            }
        });

        if (!response.ok) {
            console.warn('[version-check] version.json ikke tilgængelig:', response.status);
            return null;
        }

        const data = await response.json();
        lastSuccessfulCheck = Date.now();
        return data;
    } catch (error) {
        console.warn('[version-check] Fejl ved hentning af version:', error);
        return null;
    }
}

/**
 * Check for updates
 */
async function checkForUpdates() {
    const remoteData = await fetchRemoteVersion();

    if (!remoteData?.version) {
        return { hasUpdate: false, error: 'Kunne ikke hente version' };
    }

    latestRemoteVersion = remoteData.version;
    const comparison = compareVersions(FLANGO_VERSION, remoteData.version);

    updateAvailable = comparison < 0;

    // Track når vi først så denne opdatering (for cache-problem detection)
    if (updateAvailable) {
        const storedVersion = localStorage.getItem(UPDATE_VERSION_KEY);
        const storedFirstSeen = localStorage.getItem(UPDATE_FIRST_SEEN_KEY);

        if (storedVersion !== remoteData.version || !storedFirstSeen) {
            // Ny version opdaget - gem tidspunkt
            localStorage.setItem(UPDATE_VERSION_KEY, remoteData.version);
            localStorage.setItem(UPDATE_FIRST_SEEN_KEY, Date.now().toString());
        }
    } else {
        // Ingen opdatering - ryd stored data
        localStorage.removeItem(UPDATE_VERSION_KEY);
        localStorage.removeItem(UPDATE_FIRST_SEEN_KEY);
    }

    console.log(`[version-check] Lokal: ${FLANGO_VERSION}, Remote: ${remoteData.version}, Update: ${updateAvailable}`);

    // Opdater UI
    updateChipVisibility();

    return {
        hasUpdate: updateAvailable,
        localVersion: FLANGO_VERSION,
        remoteVersion: remoteData.version,
        buildDate: remoteData.buildDate
    };
}

/**
 * Opdater chip visibility i DOM
 */
function updateChipVisibility() {
    const chip = document.getElementById('flango-update-chip');
    if (!chip) return;

    if (updateAvailable) {
        chip.style.display = 'inline-flex';
        chip.title = `Opdatering tilgængelig: v${latestRemoteVersion}`;
    } else {
        chip.style.display = 'none';
    }
}

/**
 * Detect cache problems (version mismatch over tid)
 * Returnerer true hvis der har været en opdatering tilgængelig i over 24 timer
 */
function detectCacheProblem() {
    // Tjek localStorage for hvornår vi først så opdateringen
    const firstSeenStr = localStorage.getItem(UPDATE_FIRST_SEEN_KEY);
    if (!firstSeenStr) return false;

    const firstSeen = parseInt(firstSeenStr, 10);
    if (isNaN(firstSeen)) return false;

    const timeSinceFirstSeen = Date.now() - firstSeen;

    // Hvis opdateringen har været tilgængelig i over 24 timer
    // og brugeren stadig kører gammel version, er der sandsynligvis et cache-problem
    if (timeSinceFirstSeen > CACHE_PROBLEM_THRESHOLD) {
        console.warn('[version-check] Cache-problem detekteret: Opdatering har været tilgængelig i over 24 timer');
        return true;
    }

    return false;
}

/**
 * Perform full refresh: clear localStorage, unregister SW, cache-bust reload
 */
export async function performFullRefresh() {
    console.log('[version-check] Performing full refresh...');

    try {
        // 1. Gem vigtige værdier der skal bevares
        const institutionId = localStorage.getItem('flango_institution_id');
        const institutionName = localStorage.getItem('flango_institution_name');

        // 2. Ryd localStorage (behold kun institution info)
        const keysToKeep = ['flango_institution_id', 'flango_institution_name'];
        const allKeys = Object.keys(localStorage);

        allKeys.forEach(key => {
            if (!keysToKeep.includes(key)) {
                localStorage.removeItem(key);
            }
        });

        // Ryd også update tracking keys eksplicit
        localStorage.removeItem(UPDATE_FIRST_SEEN_KEY);
        localStorage.removeItem(UPDATE_VERSION_KEY);

        console.log('[version-check] localStorage ryddet (bevarede institution)');

        // 3. Unregister service workers
        if ('serviceWorker' in navigator) {
            const registrations = await navigator.serviceWorker.getRegistrations();
            for (const registration of registrations) {
                await registration.unregister();
                console.log('[version-check] Service worker afregistreret');
            }
        }

        // 4. Clear caches
        if ('caches' in window) {
            const cacheNames = await caches.keys();
            for (const cacheName of cacheNames) {
                await caches.delete(cacheName);
                console.log('[version-check] Cache slettet:', cacheName);
            }
        }

        // 5. Cache-bust reload
        const timestamp = Date.now();
        const newUrl = new URL(window.location.href);
        newUrl.searchParams.set('_refresh', timestamp.toString());

        // Brug location.replace for at undgå back-button problemer
        window.location.replace(newUrl.toString());

    } catch (error) {
        console.error('[version-check] Fejl under refresh:', error);
        // Fallback: simpel reload
        window.location.reload(true);
    }
}

/**
 * Get current version info
 */
export function getVersionInfo() {
    return {
        localVersion: FLANGO_VERSION,
        remoteVersion: latestRemoteVersion,
        updateAvailable,
        lastCheck: lastSuccessfulCheck,
        hasCacheProblem: detectCacheProblem()
    };
}

/**
 * Create the update chip HTML element
 */
export function createUpdateChip() {
    const chip = document.createElement('button');
    chip.id = 'flango-update-chip';
    chip.className = 'flango-update-chip';
    chip.innerHTML = `
        <span class="update-chip-icon">&#x21bb;</span>
        <span class="update-chip-text">Opdater</span>
    `;
    chip.style.display = 'none'; // Skjult som default
    chip.title = 'Klik for at opdatere Flango';

    chip.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();

        // Bekræft inden refresh
        const confirmed = confirm(
            `En ny version af Flango er tilgængelig (v${latestRemoteVersion}).\n\n` +
            'Vil du opdatere nu? Dette vil genindlæse siden.'
        );

        if (confirmed) {
            await performFullRefresh();
        }
    });

    return chip;
}

/**
 * Create version info panel for settings
 */
export function createVersionInfoPanel() {
    const info = getVersionInfo();

    const panel = document.createElement('div');
    panel.className = 'version-info-panel';

    let statusText = '';
    let statusClass = '';

    if (info.updateAvailable) {
        statusText = `Opdatering tilgængelig: v${info.remoteVersion}`;
        statusClass = 'status-update';
    } else if (info.hasCacheProblem) {
        statusText = 'Muligt cache-problem detekteret';
        statusClass = 'status-warning';
    } else {
        statusText = 'Du kører den nyeste version';
        statusClass = 'status-ok';
    }

    panel.innerHTML = `
        <div class="version-info-row">
            <span class="version-label">Installeret version:</span>
            <span class="version-value">v${info.localVersion}</span>
        </div>
        ${info.remoteVersion ? `
        <div class="version-info-row">
            <span class="version-label">Nyeste version:</span>
            <span class="version-value">v${info.remoteVersion}</span>
        </div>
        ` : ''}
        <div class="version-info-row">
            <span class="version-label">Status:</span>
            <span class="version-value ${statusClass}">${statusText}</span>
        </div>
        ${info.lastCheck ? `
        <div class="version-info-row">
            <span class="version-label">Sidst tjekket:</span>
            <span class="version-value">${formatTime(info.lastCheck)}</span>
        </div>
        ` : ''}
    `;

    // Tilføj opdater-knap
    const refreshBtn = document.createElement('button');
    refreshBtn.className = 'version-refresh-btn';
    refreshBtn.textContent = info.updateAvailable ? 'Opdater nu' : 'Genindlæs app';
    refreshBtn.addEventListener('click', async () => {
        refreshBtn.disabled = true;
        refreshBtn.textContent = 'Opdaterer...';
        await performFullRefresh();
    });

    panel.appendChild(refreshBtn);

    // Tilføj "Tjek for opdateringer" knap
    const checkBtn = document.createElement('button');
    checkBtn.className = 'version-check-btn';
    checkBtn.textContent = 'Tjek for opdateringer';
    checkBtn.addEventListener('click', async () => {
        checkBtn.disabled = true;
        checkBtn.textContent = 'Tjekker...';
        await checkForUpdates();
        // Genopbyg panel med nye data
        const newPanel = createVersionInfoPanel();
        panel.replaceWith(newPanel);
    });

    panel.appendChild(checkBtn);

    return panel;
}

/**
 * Format timestamp til læsbar tid
 */
function formatTime(timestamp) {
    const date = new Date(timestamp);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
}

/**
 * Start periodic version checking
 */
export function startVersionChecking() {
    // Initial check
    checkForUpdates();

    // Periodic checks
    if (checkIntervalId) {
        clearInterval(checkIntervalId);
    }

    checkIntervalId = setInterval(() => {
        checkForUpdates();
    }, VERSION_CHECK_INTERVAL);

    console.log('[version-check] Version checking started');
}

/**
 * Stop periodic version checking
 */
export function stopVersionChecking() {
    if (checkIntervalId) {
        clearInterval(checkIntervalId);
        checkIntervalId = null;
    }
}

/**
 * Initialize the update chip in the DOM
 */
export function initUpdateChip() {
    const sessionBanner = document.getElementById('user-session-banner');
    if (!sessionBanner) {
        console.warn('[version-check] user-session-banner ikke fundet');
        return;
    }

    // Tjek om chip allerede eksisterer
    if (document.getElementById('flango-update-chip')) {
        return;
    }

    const chip = createUpdateChip();
    sessionBanner.appendChild(chip);

    console.log('[version-check] Update chip tilføjet til status banner');
}

// Expose for Settings modal
window.__flangoVersionCheck = {
    getVersionInfo,
    createVersionInfoPanel,
    checkForUpdates,
    performFullRefresh
};
