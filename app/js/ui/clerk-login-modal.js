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
            if (!list || list.length === 0) {
                userListContainer.innerHTML = '<p style="text-align:center; padding: 20px;">Ingen børne-/ekspedient-brugere fundet.</p>';
                return;
            }
            userListContainer.innerHTML = list.map((c, i) => `
              <div class="modal-entry">
                <div class="modal-entry-info ${i===0 ? 'highlight' : ''}" data-user-id="${c.id}" style="cursor:pointer; padding: 12px; font-weight:700;">
                  ${c.name} ${c.number ? `(${c.number})` : ''}
                </div>
              </div>
            `).join('');
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

        if (searchInput) {
            searchInput.addEventListener('input', handleSearch);
            searchInput.addEventListener('keydown', handleKeyNavigation);
            setTimeout(() => searchInput.focus(), 50);
        }

        const handleListKeyNavigation = (evt) => {
            if (!userModal.classList.contains('clerk-mode')) return;
            handleKeyNavigation(evt);
        };
        userModal.classList.add('clerk-mode');
        document.addEventListener('keydown', handleListKeyNavigation);

        const cleanup = () => {
            delete userModal.dataset.mode;
            if (controls) controls.style.display = '';
            if (adminControls) adminControls.style.display = '';
            if (modalTitle) modalTitle.textContent = 'Vælg en kunde';
            if (sortBalanceHeader) sortBalanceHeader.style.display = '';
            if (staticHeader) staticHeader.style.display = '';
            if (searchInput) {
                searchInput.removeEventListener('input', handleSearch);
                searchInput.removeEventListener('keydown', handleKeyNavigation);
                searchInput.value = '';
            }
            document.removeEventListener('keydown', handleListKeyNavigation);
            userModal.classList.remove('clerk-mode');
            userListContainer.removeEventListener('click', handleClerkPick);
            if (closeBtn) closeBtn.removeEventListener('click', handleClose);
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
            const welcomeBody = `
              <div style="display: flex; align-items: center; gap: 20px;">
                <img src="https://jbknjgbpghrbrstqwoxj.supabase.co/storage/v1/object/public/Avatar/Ekspedient-mand-Flango1.png" alt="Hr. Flango" style="width: 120px; height: auto; flex-shrink: 0;">
                <div style="text-align:left;line-height:1.5;">
                  Sejt, at du tager ansvaret for at betjene Flango i dag.<br><br>
                  Dit job er at sørge for, at kunderne betaler det rigtige – hverken mere eller mindre.<br><br>
                  Når du er logget ind, er det kun dig, der må bruge systemet. Hvis nogen laver fejl på din konto, er det dit ansvar.<br><br>
                  Husk derfor altid at logge ud, når du er færdig – Flango husker ALT! 😎<br><br>
                  Hav en super god dag i caféen! 🍪☕
                </div>
              </div>`;
            await showCustomAlert(welcomeTitle, welcomeBody);
            if (typeof onClerkLoggedIn === 'function') {
                onClerkLoggedIn(clerk);
            }
        };

        const handleClose = () => {
            userModal.style.display = 'none';
            cleanup();
        };

        userListContainer.addEventListener('click', handleClerkPick);
        if (closeBtn) closeBtn.addEventListener('click', handleClose);
    };
}
