import { showAlert } from './ui/sound-and-alerts.js';
import {
    initFlangoTheme,
    setupThemePickerUI,
    setupToolbarGearMenu,
    setupToolbarHistoryButton,
    setupSettingsModal,
    setupHelpButton,
} from './ui/shell-and-theme.js';
import { supabaseClient } from './core/config-and-supabase.js';
import { getCurrentUserProfile } from './domain/auth-and-session.js';
import { ensureActiveInstitution, fetchInstitutions } from './domain/institution-store.js';
import { setupClubLoginScreen, setupLockedScreen } from './domain/club-login.js';
import { startApp, setupAdminLoginScreen } from './domain/app-main.js';
import { initUpdateChip, startVersionChecking } from './core/version-check.js';

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

    const customAlertModal = document.getElementById('custom-alert-modal');
    // Ensure custom alert modal is always on top
    if (customAlertModal) {
        customAlertModal.style.zIndex = '2000';
    }

    // =================================================================
    // HJÆLPEFUNKTIONER (Globale)
    // =================================================================
    window.__flangoShowAlert = showAlert;
    setupToolbarGearMenu();
    setupToolbarHistoryButton();
    setupSettingsModal();
    setupHelpButton();

    // Version check og opdaterings-chip
    initUpdateChip();
    startVersionChecking();

    // =================================================================
    // APP-OPSTART
    // =================================================================
    async function initializeApp() {
        await fetchInstitutions();
        const hasInstitution = await ensureActiveInstitution();
        if (!hasInstitution) {
            await supabaseClient.auth.signOut();
            await setupClubLoginScreen();
            return;
        }

        const { data: { session } } = await supabaseClient.auth.getSession();

        if (session) {
            // Der er en aktiv admin-session
            const adminProfile = await getCurrentUserProfile(session);
            if (adminProfile && adminProfile.role === 'admin') {
                setupAdminLoginScreen(adminProfile);
            } else {
                // Sessionen er ugyldig eller ikke en admin, log ud
                await supabaseClient.auth.signOut();
                setupLockedScreen();
            }
        } else {
            // Ingen session, vis den låste skærm
            setupLockedScreen();
        }
    }

    initializeApp();
});
