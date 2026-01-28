import { supabaseClient } from '../core/config-and-supabase.js';
import { rememberInstitution, clearSavedInstitution, ensureActiveInstitution, fetchInstitutions } from './institution-store.js';
import { performLogin } from './auth-and-session.js';
import { fetchAdminsForInstitution } from './users-and-admin.js';
import { showScreen } from '../ui/shell-and-theme.js';

const CLUB_LOGIN_CODE_KEY = 'flango_club_login_code';
let lastClubLoginCode = null;

export async function setupClubLoginScreen() {
    const institutions = await fetchInstitutions();
    showScreen('screen-club-login');
    const selectEl = document.getElementById('club-institution-select');
    const codeInput = document.getElementById('club-code-input');
    const loginBtn = document.getElementById('club-login-btn');
    const errorEl = document.getElementById('club-login-error');
    if (!selectEl || !codeInput || !loginBtn || !errorEl) return;

    errorEl.textContent = '';
    lastClubLoginCode = null;
    try {
        sessionStorage.removeItem(CLUB_LOGIN_CODE_KEY);
    } catch {}
    codeInput.value = '';
    loginBtn.disabled = true;
    loginBtn.textContent = 'Fortsæt';
    selectEl.innerHTML = '<option value="">Henter institutioner...</option>';

    if (!institutions || !institutions.length) {
        selectEl.innerHTML = '<option value="">Ingen institutioner fundet</option>';
        errorEl.textContent = 'Kunne ikke hente institutioner. Prøv igen senere.';
        return;
    }

    selectEl.innerHTML = '<option value="">— Vælg institution —</option>';
    institutions.forEach(inst => {
        const opt = document.createElement('option');
        opt.value = inst.id;
        opt.textContent = inst.name;
        selectEl.appendChild(opt);
    });

    loginBtn.disabled = false;

    loginBtn.onclick = async () => {
        errorEl.textContent = '';
        const chosenId = selectEl.value;
        const code = (codeInput.value || '').trim();

        if (!chosenId) {
            errorEl.textContent = 'Vælg institution først.';
            return;
        }
        if (!code) {
            errorEl.textContent = 'Indtast klubbens login-kode.';
            return;
        }
        const inst = institutions.find(i => String(i.id) === String(chosenId));
        if (!inst) {
            errorEl.textContent = 'Vælg institution først.';
            return;
        }

        // SIKKERHED: login_code må ikke ligge i klienten. Verificér via RPC.
        try {
            const { data: ok, error } = await supabaseClient.rpc('verify_club_login', {
                p_institution_id: inst.id,
                p_code: code,
            });
            if (error || ok !== true) {
                errorEl.textContent = 'Forkert klubkode. Prøv igen, eller spørg en voksen i klubben.';
                return;
            }
        } catch (e) {
            errorEl.textContent = 'Kunne ikke bekræfte klubkoden. Prøv igen.';
            return;
        }

        // Gem kode til admin-email autofill og send den videre til locked screen
        lastClubLoginCode = code;
        try {
            sessionStorage.setItem(CLUB_LOGIN_CODE_KEY, code);
        } catch {}
        rememberInstitution(inst);
        await setupLockedScreen(code);
    };
}

export async function setupLockedScreen(clubLoginCode = null) {
    const club = await ensureActiveInstitution();
    if (!club) {
        await supabaseClient.auth.signOut();
        return setupClubLoginScreen();
    }
    showScreen('screen-locked');
    const emailInput = document.getElementById('admin-email-input');
    const passwordInput = document.getElementById('admin-password-input');
    const loginBtn = document.getElementById('admin-login-btn');
    const developerLoginBtn = document.getElementById('developer-login-btn');
    const errorEl = document.getElementById('locked-screen-error');
    const clubLabel = document.getElementById('active-club-label');
    const switchClubBtn = document.getElementById('switch-club-btn');
    const adminSelect = document.getElementById('admin-user-select');

    if (clubLabel) {
        clubLabel.textContent = `Aktiv klub: ${club.name}`;
    }
    if (switchClubBtn) {
        switchClubBtn.style.display = 'inline-block';
        switchClubBtn.onclick = async () => {
            clearSavedInstitution();
            try {
                sessionStorage.removeItem(CLUB_LOGIN_CODE_KEY);
            } catch {}
            await supabaseClient.auth.signOut();
            await fetchInstitutions(true);
            await setupClubLoginScreen();
        };
    }

    if (adminSelect) {
        adminSelect.disabled = true;
        adminSelect.innerHTML = '<option value="">Henter administratorer...</option>';
        if (clubLoginCode) {
            lastClubLoginCode = clubLoginCode;
            try {
                sessionStorage.setItem(CLUB_LOGIN_CODE_KEY, clubLoginCode);
            } catch {}
        } else if (!lastClubLoginCode) {
            try {
                lastClubLoginCode = sessionStorage.getItem(CLUB_LOGIN_CODE_KEY);
            } catch {}
        }
        fetchAdminsForInstitution(club.id, { loginCode: lastClubLoginCode }).then(async (admins) => {
            if (!adminSelect) return;
            if (!admins || !admins.length) {
                adminSelect.innerHTML = '<option value="">Ingen administratorer fundet</option>';
                adminSelect.disabled = true;
                emailInput.value = '';
                return;
            }
            
            // KRITISK FIX: RPC'en get_admin_directory_for_login burde returnere emails hvis loginCode er sat
            // Men hvis den ikke gør, kan vi ikke hente emails fra users tabellen (401 Unauthorized)
            // Så vi bruger admins direkte og henter email dynamisk når admin vælges via RPC
            const adminsWithEmail = admins; // Brug admins direkte - email hentes senere når admin vælges
            
            adminSelect.disabled = false;
            adminSelect.innerHTML = '<option value="">— Vælg administrator —</option>';
            // Gem admin-objekter i et map for nem adgang til email
            const adminMap = new Map();
            console.log('[club-login] Admins received:', adminsWithEmail.map(a => ({ 
                id: a.id, 
                name: a.name, 
                email: a.email,
                allKeys: Object.keys(a)
            })));
            adminsWithEmail.forEach(admin => {
                const opt = document.createElement('option');
                // KRITISK FIX: Tjek om email findes i admin objektet, ellers brug id
                const email = admin.email || admin.user_email || admin.email_address || '';
                opt.value = email || admin.id || '';
                opt.textContent = admin.name || admin.email || admin.user_email || 'Admin';
                adminSelect.appendChild(opt);
                // Gem admin-objektet med email som nøgle (eller id hvis ingen email)
                // Gem også med id som nøgle for at sikre vi kan finde det senere
                adminMap.set(opt.value, admin);
                if (admin.id && opt.value !== admin.id) {
                    adminMap.set(admin.id, admin);
                }
                // Gem også med email hvis den findes
                if (email) {
                    adminMap.set(email, admin);
                }
                console.log('[club-login] Added admin to map:', { 
                    optValue: opt.value, 
                    adminId: admin.id, 
                    adminEmail: admin.email || admin.user_email || admin.email_address,
                    adminName: admin.name,
                    adminObject: admin
                });
            });
            
            // Funktion til at udfylde email baseret på valgt admin
            const fillEmailFromSelectedAdmin = async () => {
                const selectedValue = adminSelect.value;
                
                if (selectedValue) {
                    // Find admin-objektet og udfyld e-mail automatisk hvis den findes
                    let selectedAdmin = adminMap.get(selectedValue);
                    
                    // Fallback: Hvis adminMap ikke virker, søg direkte i adminsWithEmail arrayet
                    if (!selectedAdmin) {
                        const allAdmins = Array.from(adminMap.values());
                        selectedAdmin = allAdmins.find(a => 
                            (a.email && a.email === selectedValue) || 
                            (a.id && a.id === selectedValue)
                        );
                    }
                    
                    // KRITISK FIX: Tjek om selectedAdmin har email i forskellige felter
                    const adminEmail = selectedAdmin?.email || selectedAdmin?.user_email || selectedAdmin?.email_address || '';
                    if (selectedAdmin && adminEmail) {
                        emailInput.value = adminEmail;
                        passwordInput.focus();
                        return true;
                    } else if (selectedValue.includes('@')) {
                        // Fallback: hvis værdien er en e-mail, brug den direkte
                        emailInput.value = selectedValue;
                        passwordInput.focus();
                        return true;
                    } else if (selectedAdmin && selectedAdmin.id) {
                        // KRITISK FIX: Hent email via RPC get_admin_directory_for_login i stedet for direkte fra users tabellen
                        // Dette virker fordi vi har loginCode og RPC'en har adgang til emails
                        // Hent loginCode fra sessionStorage hvis lastClubLoginCode ikke er sat
                        let loginCodeToUse = lastClubLoginCode;
                        if (!loginCodeToUse) {
                            try {
                                loginCodeToUse = sessionStorage.getItem(CLUB_LOGIN_CODE_KEY);
                            } catch {}
                        }
                        
                        if (loginCodeToUse) {
                            try {
                                const { data: adminData, error: rpcError } = await supabaseClient.rpc('get_admin_directory_for_login', {
                                    p_institution_id: club.id,
                                    p_code: loginCodeToUse
                                });
                                
                                if (!rpcError && adminData) {
                                    const adminWithEmail = adminData.find(a => a.id === selectedAdmin.id);
                                    if (adminWithEmail && adminWithEmail.email) {
                                        emailInput.value = adminWithEmail.email;
                                        passwordInput.focus();
                                        return true;
                                    }
                                }
                            } catch (e) {
                                console.warn('[club-login] Could not fetch email via RPC:', e);
                            }
                        }
                    }
                    
                    // Ingen e-mail fundet, ryd feltet og fokuser
                    emailInput.value = '';
                    emailInput.focus();
                    return false;
                } else {
                    emailInput.value = '';
                    emailInput.focus();
                    return false;
                }
            };
            
            // KRITISK FIX: Sæt onchange handler FØR automatisk valg, så den virker når brugeren manuelt vælger
            // Brug både onchange property og addEventListener for at sikre kompatibilitet
            // Wrapper for at håndtere async funktion i event handler
            const handleAdminChange = () => {
                fillEmailFromSelectedAdmin().catch(err => {
                    console.error('[club-login] Error in fillEmailFromSelectedAdmin:', err);
                });
            };
            adminSelect.onchange = handleAdminChange;
            adminSelect.addEventListener('change', handleAdminChange);
            
            // Ingen automatisk valg - dropdown'en skal altid starte med "vælg administrator"
        });
    }

    emailInput.focus();

    loginBtn.onclick = async () => {
        errorEl.textContent = '';
        const email = emailInput.value;
        const password = passwordInput.value;
        if (!email.trim() || !password.trim()) {
            errorEl.textContent = 'Indtast venligst både e-mail og adgangskode.';
            return;
        }

        // Gem valgt email til næste gang
        try {
            sessionStorage.setItem('flango_last_selected_admin_email', email);
        } catch (e) {
            // Ignorer fejl ved sessionStorage
        }

        loginBtn.disabled = true;
        loginBtn.textContent = 'Logger ind...';

        const { success } = await performLogin(email, password);

        if (success) {
            location.reload();
        } else {
            errorEl.textContent = 'Forkert adgangskode. Prøv igen.';
            loginBtn.disabled = false;
            loginBtn.textContent = 'Lås op & Log ind';
        }
    };

    developerLoginBtn.onclick = async () => {
        errorEl.textContent = '';
        developerLoginBtn.disabled = true;
        developerLoginBtn.textContent = 'Logger ind...';

        const { success } = await performLogin('authadmin@flango.dk', '123456');

        if (success) {
            location.reload();
        } else {
            errorEl.textContent = 'Developer login fejlede. Er brugeren oprettet?';
            developerLoginBtn.disabled = false;
            developerLoginBtn.textContent = 'Developer Login';
        }
    };
}
