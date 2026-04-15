export function setupClerkLoginButton({
    adminProfile,
    supabaseClient,
    showAlert,
    showCustomAlert,
    showPinModal,
    onClerkLoggedIn,
}) {
    const selectClerkBtn = document.getElementById('select-clerk-btn');
    if (!selectClerkBtn) return;

    const userModal = document.getElementById('user-modal');
    const userListContainer = document.getElementById('modal-user-list');
    const controls = userModal?.querySelector('.modal-controls');
    const adminControls = document.getElementById('admin-controls-modal');
    const searchInput = document.getElementById('search-user-input');
    const modalTitle = document.getElementById('user-modal-title');
    const closeBtn = userModal?.querySelector('.close-btn');
    const sortBalanceHeader = document.getElementById('sort-by-balance-btn');
    const staticHeader = userModal?.querySelector('.static-header');

    if (!userModal || !userListContainer) return;

    selectClerkBtn.onclick = async () => {
        userModal.dataset.mode = 'clerkSelection';
        if (controls) controls.style.display = '';
        if (adminControls) adminControls.style.display = 'none';
        if (searchInput) searchInput.value = '';
        if (modalTitle) modalTitle.textContent = 'LOG IND SOM EKSPEDIENT';
        if (sortBalanceHeader) sortBalanceHeader.style.display = 'none';
        if (staticHeader) staticHeader.style.display = 'none';

        const { data: customers, error } = await supabaseClient
            .from('users')
            .select('*')
            .eq('role', 'kunde')
            .eq('institution_id', adminProfile.institution_id)
            .order('name');

        if (error) {
            return showAlert('Fejl ved hentning af ekspedientliste: ' + error.message);
        }

        const highlightFirstEntry = () => {
            const infos = userListContainer.querySelectorAll('.modal-entry-info');
            infos.forEach(el => el.classList.remove('highlight'));
            if (infos[0]) infos[0].classList.add('highlight');
        };

        const renderClerkList = (list) => {
            userListContainer.replaceChildren();
            if (!list || list.length === 0) {
                const p = document.createElement('p');
                p.style.textAlign = 'center';
                p.style.padding = '20px';
                p.textContent = 'Ingen børne-/ekspedient-brugere fundet.';
                userListContainer.appendChild(p);
                return;
            }

            const fragment = document.createDocumentFragment();
            list.forEach((c, i) => {
                const entry = document.createElement('div');
                entry.className = 'modal-entry';

                const info = document.createElement('div');
                info.className = `modal-entry-info ${i === 0 ? 'highlight' : ''}`.trim();
                info.dataset.userId = c.id;
                info.style.cursor = 'pointer';
                info.style.padding = '12px';
                info.style.fontWeight = '700';
                info.textContent = `${c.name}${c.number ? ` (${c.number})` : ''}`;

                entry.appendChild(info);
                fragment.appendChild(entry);
            });
            userListContainer.appendChild(fragment);
            highlightFirstEntry();
        };

        renderClerkList(customers);
        userModal.style.display = 'flex';

        const handleSearch = () => {
            const term = (searchInput?.value || '').toLowerCase().trim();
            if (!term) {
                renderClerkList(customers);
                return;
            }
            const filtered = customers.filter((c) => {
                const numberStr = c.number != null ? String(c.number).toLowerCase() : '';
                return c.name.toLowerCase().includes(term) || numberStr.includes(term);
            });
            renderClerkList(filtered);
        };

        const moveHighlight = (direction) => {
            const entries = Array.from(userListContainer.querySelectorAll('.modal-entry-info'));
            if (entries.length === 0) return;
            let currentIndex = entries.findIndex(el => el.classList.contains('highlight'));
            if (currentIndex === -1) currentIndex = 0;
            entries.forEach(el => el.classList.remove('highlight'));
            const nextIndex = Math.min(entries.length - 1, Math.max(0, currentIndex + direction));
            entries[nextIndex].classList.add('highlight');
            entries[nextIndex].scrollIntoView({ block: 'nearest' });
        };

        const handleKeyNavigation = (evt) => {
            if (evt.key === 'Enter') {
                evt.preventDefault();
                const highlighted = userListContainer.querySelector('.modal-entry-info.highlight');
                if (highlighted) highlighted.click();
            } else if (evt.key === 'ArrowDown') {
                evt.preventDefault();
                moveHighlight(1);
            } else if (evt.key === 'ArrowUp') {
                evt.preventDefault();
                moveHighlight(-1);
            }
        };

        const clerkAbort = new AbortController();
        const clerkOpts = { signal: clerkAbort.signal };

        if (searchInput) {
            searchInput.addEventListener('input', handleSearch, clerkOpts);
            searchInput.addEventListener('keydown', handleKeyNavigation, clerkOpts);
            searchInput.focus();
        }

        const handleListKeyNavigation = (evt) => {
            if (!userModal.classList.contains('clerk-mode')) return;
            handleKeyNavigation(evt);
        };
        userModal.classList.add('clerk-mode');
        document.addEventListener('keydown', handleListKeyNavigation, clerkOpts);

        const cleanup = () => {
            clerkAbort.abort();
            delete userModal.dataset.mode;
            if (controls) controls.style.display = '';
            if (adminControls) adminControls.style.display = '';
            if (modalTitle) modalTitle.textContent = 'Vælg en kunde';
            if (sortBalanceHeader) sortBalanceHeader.style.display = '';
            if (staticHeader) staticHeader.style.display = '';
            if (searchInput) searchInput.value = '';
            userModal.classList.remove('clerk-mode');
        };

        const handleClerkPick = async (evt) => {
            const target = evt.target.closest('.modal-entry-info');
            if (!target) return;
            evt.stopPropagation();

            userModal.style.display = 'none';
            cleanup();

            const selectedId = target.dataset.userId;
            const clerk = customers.find(c => c.id === selectedId);
            if (!clerk) return showAlert('Kunne ikke finde den valgte bruger.');

            const enteredPin = await showPinModal(clerk.name);
            if (enteredPin === null) return;

            const { data: isPinCorrect, error: pinError } = await supabaseClient
                .rpc('verify_customer_pin', { p_user_id: clerk.id, p_pin_attempt: enteredPin });

            if (pinError || !isPinCorrect) {
                return showAlert('Forkert PIN-kode.');
            }

            const welcomeTitle = `Velkommen, ${clerk.name}!`;
            // Tjek om bytte-timer er aktiveret for institutionen (kun eksplicit true)
            const shiftTimerEnabled = window.__flangoInstitutionSettings?.shiftTimerEnabled === true;
            const shiftTimerButtonHtml = shiftTimerEnabled ? `
                  <div style="margin-top: 16px;">
                    <button onclick="window.__flangoOpenShiftTimer?.()" style="
                      display: inline-flex;
                      align-items: center;
                      gap: 8px;
                      padding: 10px 18px;
                      background: linear-gradient(135deg, #faf5ff, #f3e8ff);
                      border: 2px solid #d8b4fe;
                      border-radius: 12px;
                      cursor: pointer;
                      font-family: 'Poppins', sans-serif;
                      font-size: 14px;
                      font-weight: 600;
                      color: #7c3aed;
                      transition: all 0.2s ease;
                      box-shadow: 0 2px 8px rgba(168,139,250,0.2);
                    ">
                      <span style="font-size: 16px;">⏱️</span>
                      Sæt bytte-timer
                    </button>
                  </div>` : '';

            // Per-enhed restaurant mode checkbox (kun vis hvis institution har RM aktiveret)
            const instData = window.__flangoGetInstitutionById?.(adminProfile.institution_id);
            const showRmCheckbox = instData?.restaurant_mode_enabled === true;
            const rmChecked = localStorage.getItem('flango_device_restaurant_mode') === 'true';
            const restaurantModeHtml = showRmCheckbox ? `
                  <label style="
                    display: flex; align-items: center; gap: 10px; margin-top: 16px;
                    padding: 10px 14px; background: linear-gradient(135deg, #eff6ff, #dbeafe);
                    border: 1.5px solid #93c5fd; border-radius: 10px; cursor: pointer;
                  ">
                    <input type="checkbox" id="clerk-restaurant-mode-checkbox" ${rmChecked ? 'checked' : ''} style="
                      width: 20px; height: 20px; cursor: pointer; accent-color: #3b82f6;
                    ">
                    <div>
                      <strong style="font-size: 14px;">🍽️ Aktivér restaurant-mode</strong>
                      <div style="font-size: 11px; color: #666; margin-top: 2px;">Bordvalg og køkkennote vises ved hvert køb</div>
                    </div>
                  </label>` : '';

            const welcomeBody = `
              <div style="display: flex; align-items: center; gap: 20px;">
                <img src="Icons/webp/Avatar/Ekspedient-mand-Flango1.webp" alt="Hr. Flango" style="width: 120px; height: auto; flex-shrink: 0;">
                <div style="text-align:left;line-height:1.5;">
                  Sejt, at du tager ansvaret for at betjene Flango i dag.<br><br>
                  Dit job er at sørge for, at kunderne betaler det rigtige – hverken mere eller mindre.<br><br>
                  Når du er logget ind, er det kun dig, der må bruge systemet. Hvis nogen laver fejl på din konto, er det dit ansvar.<br><br>
                  Husk derfor altid at logge ud, når du er færdig – Flango husker ALT! 😎<br><br>
                  Hav en super god dag i caféen! 🍪☕${shiftTimerButtonHtml}${restaurantModeHtml}
                </div>
              </div>`;
            await showCustomAlert(welcomeTitle, welcomeBody);

            // Gem per-enhed restaurant mode valg fra clerk-velkomst
            const clerkRmCheckbox = document.getElementById('clerk-restaurant-mode-checkbox');
            if (clerkRmCheckbox) {
                localStorage.setItem('flango_device_restaurant_mode', clerkRmCheckbox.checked ? 'true' : 'false');
            }

            if (typeof onClerkLoggedIn === 'function') {
                onClerkLoggedIn(clerk);
            }
        };

        const handleClose = () => {
            userModal.style.display = 'none';
            cleanup();
        };

        userListContainer.addEventListener('click', handleClerkPick, clerkOpts);
        if (closeBtn) closeBtn.addEventListener('click', handleClose, clerkOpts);
    };
}
