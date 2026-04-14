import { showAlert } from './ui/sound-and-alerts.js?v=3.0.76';
import {
    initFlangoTheme,
    setupThemePickerUI,
    setupToolbarGearMenu,
    setupToolbarHistoryButton,
    setupToolbarShortcutButtons,
    setupSettingsModal,
    setupHelpButton,
    initToolbarSettings,
} from './ui/shell-and-theme.js?v=3.0.76';
import { supabaseClient } from './core/config-and-supabase.js?v=3.0.76';
import { getCurrentUserProfile } from './domain/auth-and-session.js?v=3.0.76';
import { ensureActiveInstitution, fetchInstitutions } from './domain/institution-store.js?v=3.0.76';
import { setupFullLoginScreen, setupDeviceUnlockScreen } from './domain/login-flow.js?v=3.0.76';
import { hasDeviceUsers } from './domain/device-trust.js?v=3.0.76';
import { startApp, setupAdminLoginScreen } from './domain/app-main.js?v=3.0.76';
import { initUpdateChip, startVersionChecking } from './core/version-check.js?v=3.0.76';

document.addEventListener('DOMContentLoaded', () => {
    // INIT tema første gang siden indlæses
    initFlangoTheme();
    setupThemePickerUI();

    // Add BETA ribbon on /app-beta only
    if (location.pathname.includes('/app-beta')) {
        const logoBtn = document.getElementById('flango-logo-button');
        if (logoBtn) {
            const ribbon = document.createElement('span');
            ribbon.className = 'beta-ribbon';
            ribbon.textContent = 'BETA';
            logoBtn.appendChild(ribbon);
        }

        // Add BETA sticker on login screens (under logo, above icon/title)
        const addBetaStickersToLoginScreens = () => {
            const loginContainers = document.querySelectorAll('.login-container');
            loginContainers.forEach((container) => {
                const logo = container.querySelector('.login-logo');
                if (!logo) return;
                if (container.querySelector('.beta-login-sticker')) return;

                const sticker = document.createElement('div');
                sticker.className = 'beta-login-sticker';
                sticker.textContent = 'BETA';
                logo.insertAdjacentElement('afterend', sticker);
            });
        };
        addBetaStickersToLoginScreens();
    }

    // =================================================================
    // KONFIGURATION
    // =================================================================
    // Robust funktion til at kopiere indhold fra templates
    const copyFromTemplate = (toId, tplId) => {
        const to = document.getElementById(toId);
        const tpl = document.getElementById(tplId);
        if (to && tpl) {
            to.innerHTML = tpl.innerHTML;
        }
    };

    // Befolk modals fra templates ved applikationens start
    copyFromTemplate('login-modal', 'login-modal-template');
    copyFromTemplate('user-modal', 'user-modal-template');
    copyFromTemplate('avatar-picker-modal', 'avatar-picker-modal-template');
    copyFromTemplate('admin-user-manager-modal', 'admin-user-manager-modal-template');
    copyFromTemplate('add-edit-product-modal', 'add-edit-product-modal-template');
    copyFromTemplate('quick-login-modal', 'quick-login-modal-template');
    copyFromTemplate('add-edit-user-modal', 'add-edit-user-modal-template');
    copyFromTemplate('balance-modal', 'balance-modal-template');
    copyFromTemplate('edit-user-detail-modal', 'edit-user-detail-modal-template');
    copyFromTemplate('assign-badge-modal', 'assign-badge-modal-template');
    copyFromTemplate('event-admin-modal', 'event-admin-modal-template');

    const customAlertModal = document.getElementById('custom-alert-modal');
    // Ensure custom alert modal is always on top
    if (customAlertModal) {
        customAlertModal.style.zIndex = '2000';
    }

    // =================================================================
    // HJÆLPEFUNKTIONER (Globale)
    // =================================================================
    window.__flangoShowAlert = showAlert;
    // __flangoRawSupabaseClient is exposed from config-and-supabase.js at module eval time
    // __flangoGetInstitutionId: portal-data.js reads localStorage directly as fallback
    setupToolbarGearMenu();
    setupToolbarHistoryButton();
    setupToolbarShortcutButtons();
    initToolbarSettings();
    setupSettingsModal();
    setupHelpButton();

    // Version check og opdaterings-chip
    initUpdateChip();
    startVersionChecking();

    // =================================================================
    // APP-OPSTART
    // =================================================================
    async function initializeApp() {
        try {
            // ── Support-mode: fjernstyring fra super-admin panel ──
            const _urlParams = new URLSearchParams(window.location.search);
            const _supportToken = _urlParams.get('support_token');
            const _supportRefresh = _urlParams.get('support_refresh');
            if (_supportToken && _supportRefresh) {
                // Remove tokens from URL immediately (security)
                window.history.replaceState(null, '', window.location.pathname);
                const { data: supportData, error: supportErr } = await supabaseClient.auth.setSession({
                    access_token: _supportToken,
                    refresh_token: _supportRefresh,
                });
                if (supportData?.session && !supportErr) {
                    window.__flangoSupportMode = true;
                    await fetchInstitutions(true);
                    const adminProfile = await getCurrentUserProfile(supportData.session);
                    if (adminProfile && adminProfile.role === 'admin') {
                        if (adminProfile.institution_id) {
                            await ensureActiveInstitution();
                        }
                        setupAdminLoginScreen(adminProfile);
                        return;
                    }
                }
                // Fall through to normal login if support session failed
            }

            await fetchInstitutions();

            const { data: { session } } = await supabaseClient.auth.getSession();

            if (session) {
                // Active admin session exists — re-fetch med fuld data (authed)
                await fetchInstitutions(true);
                const adminProfile = await getCurrentUserProfile(session);
                if (adminProfile && adminProfile.role === 'admin') {
                    // Ensure institution is remembered
                    if (adminProfile.institution_id) {
                        await ensureActiveInstitution();
                    }
                    setupAdminLoginScreen(adminProfile);
                } else {
                    await supabaseClient.auth.signOut();
                    _showLoginScreen();
                }
            } else {
                _showLoginScreen();
            }
        } catch (err) {
            const isAbort = err?.name === 'AbortError' || (err?.message || '').includes('aborted');
            if (isAbort) {
                console.warn('[app] initializeApp AbortError – venter og prøver igen...');
                await new Promise(r => setTimeout(r, 500));
                try {
                    await fetchInstitutions(true);
                    const { data: { session } } = await supabaseClient.auth.getSession();
                    if (session) {
                        const adminProfile = await getCurrentUserProfile(session);
                        if (adminProfile && adminProfile.role === 'admin') {
                            setupAdminLoginScreen(adminProfile);
                            return;
                        }
                    }
                } catch (retryErr) {
                    console.error('[app] initializeApp retry fejl:', retryErr?.message);
                }
            }
            console.error('[app] initializeApp fejl:', err?.message || err);
            await supabaseClient.auth.signOut().catch(() => {});
            _showLoginScreen();
        }
    }

    /**
     * Show the appropriate login screen:
     * - If device has registered users → admin-picker + PIN (State 2)
     * - Otherwise → full email+password login (State 1)
     */
    function _showLoginScreen() {
        if (hasDeviceUsers()) {
            setupDeviceUnlockScreen();
        } else {
            setupFullLoginScreen();
        }
    }

    initializeApp().catch((err) => {
        console.error('[app] initializeApp afvist:', err?.message || err);
        _showLoginScreen();
    });
});
