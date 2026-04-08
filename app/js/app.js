import { showAlert } from './ui/sound-and-alerts.js?v=3.0.63';
import {
    initFlangoTheme,
    setupThemePickerUI,
    setupToolbarGearMenu,
    setupToolbarHistoryButton,
    setupToolbarShortcutButtons,
    setupSettingsModal,
    setupHelpButton,
    initToolbarSettings,
} from './ui/shell-and-theme.js?v=3.0.63';
import { supabaseClient } from './core/config-and-supabase.js?v=3.0.63';
import { getCurrentUserProfile } from './domain/auth-and-session.js?v=3.0.63';
import { ensureActiveInstitution, fetchInstitutions } from './domain/institution-store.js?v=3.0.63';
import { setupFullLoginScreen, setupDeviceUnlockScreen } from './domain/login-flow.js?v=3.0.63';
import { hasDeviceUsers } from './domain/device-trust.js?v=3.0.63';
import { startApp, setupAdminLoginScreen } from './domain/app-main.js?v=3.0.63';
import { initUpdateChip, startVersionChecking } from './core/version-check.js?v=3.0.63';

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
            await fetchInstitutions();

            const { data: { session } } = await supabaseClient.auth.getSession();

            if (session) {
                // Active admin session exists
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
