import { playSound, showAlert, showCustomAlert } from '../ui/sound-and-alerts.js';
import { logDebugEvent } from '../core/debug-flight-recorder.js';
import { supabaseClient } from '../core/config-and-supabase.js';
import {
    calculateCurrentStats,
    loadFlangoAdminStats,
    mergeRemoteStatsWithSession,
    getStatsSummaryHTML,
    addWorkMinutesForToday, getStatsAccordionSectionsHTML,
} from './stats-and-badges.js';
import { clearCurrentCustomer } from './cafe-session-store.js';
import { showScreen } from '../ui/shell-and-theme.js';
import { handlePrintAllBalances } from './history-and-reports.js';
import { resetShiftTimer } from './shift-timer.js';
import { stopRealtimeSync } from '../core/realtime-sync.js';
import { clearAllToasts } from '../ui/toast-notifications.js';

export function setupLogoutFlow({ clerkProfile, sessionStartTime, getSessionSalesCount, logoutBtn, settingsLogoutBtn }) {
    if (logoutBtn) logoutBtn.onclick = async () => {
        let shouldFinalizeLogout = false;
        try {
            // Flight recorder: log logout attempt
            logDebugEvent('logout_started', {
                clerkId: clerkProfile?.id,
                clerkName: clerkProfile?.name,
                role: clerkProfile?.role,
            });
            playSound('logout');

            const sessionEndTime = new Date();
            const sessionDurationMinutes = Math.max(
                0,
                Math.round((sessionEndTime - sessionStartTime) / (1000 * 60))
            );
            const sessionSalesCount = getSessionSalesCount();
            
            const isAdmin = clerkProfile.role === 'admin';
            const feedbackPrompt = isAdmin
                ? 'Tak fordi du bruger Flango – jeg håber, systemet gjorde hverdagen lidt lettere.<br>Hvis du har idéer, fejlmeldinger eller forslag til forbedringer, vil jeg rigtig gerne høre dem.'
                : 'Jeg håber, du havde en sjov dag i caféen, og at det var let at bruge Flango.<br>Hvis du har idéer til, hvordan jeg kan blive endnu bedre, må du meget gerne dele dem med mig her:';

            const feedbackFormHTML = `
                <style>
                    .feedback-section.two-column {
                        display: grid;
                        grid-template-columns: 1fr 1fr;
                        gap: 20px;
                        align-items: start;
                        margin-top: 0; /* Reducer luft over sektionen */
                    }
                    .feedback-section .feedback-prompt {
                        text-align: left; /* Juster tekst til venstre */
                    }
                </style>
                <div class="feedback-section two-column">
                    <p class="feedback-prompt">${feedbackPrompt}</p>
                    <div class="sticky-note">
                        <textarea id="logout-feedback-textarea" class="sticky-note-textarea" placeholder="skriv dit foreslag her..."></textarea>
                        <button id="send-feedback-btn" class="sticky-note-button">Send</button>
                        <p id="feedback-status-msg" class="sticky-note-text" style="display: none; margin-top: 8px;"></p>
                    </div>
                </div>
                <hr style="margin: 12px 0; border-color: #eee;">
            `;

            const title = `Tak for i dag, ${clerkProfile.name}!`;
            let finalBody = '';

            // ### Admin vs. Bruger Branching ###
            // Her skelnes der mellem, om det er en admin eller en almindelig bruger, der logger ud.
            if (isAdmin) {
                // For en admin bygges finalBody KUN med feedback-formularen.
                // Ingen statistik eller ekstra layout er nødvendigt.
                finalBody = feedbackFormHTML;
            } else {
                // For en almindelig bruger hentes statistik og layout som før.
                // ### Byg Accordion Layout ###
                // Først hentes og beregnes al statistik.
                const remoteStatsRaw = await loadFlangoAdminStats();
                const currentStats = calculateCurrentStats({
                    clerkProfile, sessionStartTime, sessionSalesCount,
                    remoteStats: remoteStatsRaw,
                });

                // ### Fordel stats i 4 sektioner ###
                // Den nye helper-funktion returnerer HTML for hver af de 4 sektioner.
                const statsSections = getStatsAccordionSectionsHTML(currentStats, { remoteStats: remoteStatsRaw }, clerkProfile);

                // CSS tilføjes for at style accordion-elementerne.
                const accordionStyle = `
                    <style>
                        .logout-accordion {
                            display: flex;
                            flex-direction: column;
                            gap: 8px;
                        }
                        .logout-accordion-item {
                            overflow: hidden;
                            border-radius: 8px;
                            border: 1px solid rgba(0,0,0,0.05);
                        }
                        .logout-accordion-header {
                            display: flex;
                            align-items: center;
                            gap: 10px;
                            padding: 12px 16px;
                            cursor: pointer;
                            font-weight: 600;
                            user-select: none;
                            border-radius: 8px;
                            box-shadow: 0 2px 5px rgba(0,0,0,0.05);
                            transition: border-radius 0.2s ease-in-out;
                            /* Hover-effekt: Blød overgang for transform og filter */
                            transition: transform 0.15s ease-out, filter 0.15s ease-out;
                        }
                        /* Hover-effekt: Zoom og let mørkning ved hover */
                        .logout-accordion-header:hover {
                            transform: scale(1.01);
                            filter: brightness(0.98);
                        }
                        .logout-accordion-header .accordion-icon {
                            width: 24px;
                            height: 24px;
                            object-fit: contain;
                        }
                        .logout-accordion-header .accordion-toggle-icon {
                            font-size: 20px;
                            font-weight: bold;
                            line-height: 1;
                            width: 20px;
                            text-align: center;
                        }
                        .logout-accordion-header .accordion-toggle-icon::before {
                            content: '+';
                        }
                        .logout-accordion-body {
                            display: none;
                            padding: 16px;
                            border-top: 1px solid var(--border-color);
                            background-color: var(--background-color-offset);
                        }
                        .logout-accordion-item.active .logout-accordion-body {
                            display: block;
                        }
                        .logout-accordion-item.active .logout-accordion-header {
                            border-bottom-left-radius: 0;
                            border-bottom-right-radius: 0;
                        }
                        .logout-accordion-item.active .accordion-toggle-icon::before {
                            content: '−';
                        }
                        /* --- Farve-matching for Header og Body --- */
                        /* Kort A: Lys orange */
                        .logout-accordion-item.card-a .logout-accordion-header { background-color: #fff4e3; }
                        .logout-accordion-item.card-a .logout-accordion-body { background-color: #fff9f0; }
                        /* Kort B: Lys blå */
                        .logout-accordion-item.card-b .logout-accordion-header { background-color: #e3f2fd; }
                        .logout-accordion-item.card-b .logout-accordion-body { background-color: #eef7ff; }
                        /* Kort C: Lys grøn */
                        .logout-accordion-item.card-c .logout-accordion-header { background-color: #e8f5e9; }
                        .logout-accordion-item.card-c .logout-accordion-body { background-color: #f1f9f1; }
                        /* Kort D: Lys lilla */
                        .logout-accordion-item.card-d .logout-accordion-header { background-color: #f3e5f5; }
                        .logout-accordion-item.card-d .logout-accordion-body { background-color: #f9f0fa; }
                    </style>
                `;

                // Selve HTML-strukturen for de 4 accordion-rækker.
                const accordionHTML = `
                    <div class="logout-accordion">
                        <div class="logout-accordion-item card-a">
                            <div class="logout-accordion-header">
                                <span class="accordion-toggle-icon"></span>
                                <img src="Icons/webp/Avatar/Ekspedient-mand-Flango1.webp" class="accordion-icon">
                                Se din status her
                            </div>
                            <div class="logout-accordion-body">${statsSections.status}</div>
                        </div>
                        <div class="logout-accordion-item card-b">
                            <div class="logout-accordion-header"><span class="accordion-toggle-icon"></span>Se dine badges her</div>
                            <div class="logout-accordion-body">${statsSections.badges}</div>
                        </div>
                        <div class="logout-accordion-item card-c">
                            <div class="logout-accordion-header"><span class="accordion-toggle-icon"></span>Se hvor meget du har solgt i dag</div>
                            <div class="logout-accordion-body">${statsSections.today}</div>
                        </div>
                        <div class="logout-accordion-item card-d">
                            <div class="logout-accordion-header"><span class="accordion-toggle-icon"></span>Se hvor meget du har solgt i alt</div>
                            <div class="logout-accordion-body">${statsSections.total}</div>
                        </div>
                    </div>
                `;

                finalBody = feedbackFormHTML + accordionStyle + accordionHTML;
            }

            const alertPromise = showCustomAlert(title, finalBody, {
                type: 'confirm',
                okText: 'Log Ud',
                cancelText: 'Tilbage',
                confirmKey: 'Enter',
                cancelKey: 'Backspace'
            });

            // Tilføj event listener EFTER alerten er vist og DOM'en er opdateret
            // Denne del håndterer accordion-funktionaliteten.
            const accordionHeaders = document.querySelectorAll('.logout-accordion-header');
            if (accordionHeaders) {
                accordionHeaders.forEach(header => {
                    header.onclick = () => {
                        header.parentElement.classList.toggle('active');
                    };
                });
            }
            const sendFeedbackBtn = document.getElementById('send-feedback-btn');
            const feedbackTextarea = document.getElementById('logout-feedback-textarea');
            const feedbackStatusMsg = document.getElementById('feedback-status-msg');

            if (sendFeedbackBtn && feedbackTextarea && feedbackStatusMsg) {
                sendFeedbackBtn.onclick = async () => {
                    const content = feedbackTextarea.value.trim();
                    if (!content) return;

                    sendFeedbackBtn.disabled = true;
                    sendFeedbackBtn.textContent = 'Sender...';

                    const feedbackPayload = {
                        content,
                        user_id: clerkProfile.user_id || clerkProfile.id || null,
                        user_name: clerkProfile.name,
                        user_role: clerkProfile.role
                    };
                    const { error: feedbackError } = await supabaseClient.from('feedback').insert(feedbackPayload);

                    sendFeedbackBtn.style.display = 'none';
                    feedbackTextarea.style.display = 'none';
                    feedbackStatusMsg.textContent = feedbackError ? 'Fejl: Kunne ikke sende feedback.' : 'Tak for din feedback!';
                    feedbackStatusMsg.style.display = 'block';
                };
            }

            const confirmedLogout = await alertPromise;
            if (!confirmedLogout) {
                logDebugEvent('logout_cancelled', { clerkId: clerkProfile?.id });
                return; // Brugeren vil tilbage til caféen
            }
            logDebugEvent('logout_confirmed', { clerkId: clerkProfile?.id });

            await addWorkMinutesForToday(sessionDurationMinutes);

            // Atomisk opdatering af stats via RPC
            const { error } = await supabaseClient.rpc(
                'increment_user_stats',
                {
                    p_user_id: clerkProfile.id,
                    p_add_minutes: sessionDurationMinutes,
                    p_add_sales: sessionSalesCount
                }
            );

            if (error) throw error;
            shouldFinalizeLogout = true;

        } catch (e) {
            console.error(e);
            showAlert('Fejl: Kunne ikke gemme din statistik. ' + (e.message || e));
        } finally {
            if (shouldFinalizeLogout) {
                clearCurrentCustomer();

                // Skjul valgt bruger UI
                const userInfoEl = document.getElementById('selected-user-info');
                if (userInfoEl) {
                    userInfoEl.style.display = 'none';
                }

                window.__flangoAppStarted = false; // Nulstil guard
                window.__flangoCurrentClerkRole = null;
                window.__flangoCurrentClerkProfile = null;
                window.__flangoCurrentAdminProfile = null;
                window.currentUserIsAdmin = false;
                // Nulstil bytte-timer, realtime-kanaler og toast-notifikationer ved logout
                resetShiftTimer();
                stopRealtimeSync();
                clearAllToasts();
                showScreen('screen-admin-login');
            }
        }
    };

    if (settingsLogoutBtn) {
        settingsLogoutBtn.onclick = () => {
            if (logoutBtn) {
                logoutBtn.click();
            }
        };
    }

    const lockCafeBtn = document.getElementById('lock-cafe-btn');
    if (lockCafeBtn && !lockCafeBtn.dataset.allBalancesHooked) {
        const originalLockHandler = lockCafeBtn.onclick;
        lockCafeBtn.onclick = async (event) => {
            try {
                handlePrintAllBalances();
            } catch (err) {
                console.error('Kunne ikke gemme saldo-liste ved låsning af café:', err);
            }
            if (typeof originalLockHandler === 'function') {
                return originalLockHandler.call(lockCafeBtn, event);
            }
            return undefined;
        };
        lockCafeBtn.dataset.allBalancesHooked = 'true';
    }
}
