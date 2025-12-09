import { showAlert } from './sound-and-alerts.js';

export function showPinModal(userName) {
    const pinModal = document.getElementById('pin-modal');
    const pinDisplay = document.getElementById('pin-display');
    const pinKeypad = document.getElementById('pin-keypad');
    const pinModalTitle = document.getElementById('pin-modal-title');
    const closeBtn = pinModal.querySelector('.close-btn');
    let currentPin = '';

    pinModalTitle.textContent = `Indtast PIN for ${userName}`;
    pinDisplay.textContent = '';
    pinModal.style.display = 'flex';

    return new Promise((resolve) => {
        const processKey = (key) => {
            if (!key) return;

            if (key >= '0' && key <= '9') {
                if (currentPin.length < 4) {
                    currentPin += key;
                }
            } else if (key.toLowerCase() === 'backspace') {
                currentPin = currentPin.slice(0, -1);
            } else if (key.toLowerCase() === 'clear') {
                currentPin = '';
            }
            pinDisplay.textContent = '●'.repeat(currentPin.length);
        };

        const handleKeypadClick = (event) => {
            processKey(event.target.dataset.key);
        };

        const handlePhysicalKey = (event) => {
            event.preventDefault();
            if (event.key >= '0' && event.key <= '9') {
                processKey(event.key);
            } else if (event.key === 'Backspace') {
                processKey('backspace');
            } else if (event.key === 'Enter') {
                if (currentPin.length === 4) {
                    close(currentPin);
                }
            } else if (event.key === 'Escape') {
                close(null);
            }
        };

        const close = (value) => {
            pinKeypad.removeEventListener('click', handleKeypadClick);
            document.removeEventListener('keydown', handlePhysicalKey);
            pinModal.style.display = 'none';
            resolve(value);
        };

        pinKeypad.addEventListener('click', handleKeypadClick);
        document.addEventListener('keydown', handlePhysicalKey);
        closeBtn.onclick = () => close(null);
        pinDisplay.onclick = () => {
            if (currentPin.length === 4) {
                close(currentPin);
            }
        };
    });
}

export function showAddUserModal(options = {}) {
    const {
        preferredRole = 'kunde',
        lockRole = false, // kept for backward compatibility, no visible select now
        titleOverride = null
    } = options;
    const isAdminPreferred = preferredRole === 'admin';
    const modal = document.getElementById('add-edit-user-modal');
    const title = document.getElementById('user-form-title');
    const fieldsContainer = document.getElementById('user-form-fields');
    const saveBtn = document.getElementById('save-user-btn');
    const closeBtn = modal.querySelector('.close-btn');

    title.textContent = titleOverride || (preferredRole === 'admin' ? 'Tilføj Admin' : 'Tilføj Ny Bruger');
    // Luk aktive brugermodaler, mens vi viser "tilføj bruger"-modalen
    const userModalEl = document.getElementById('user-modal');
    const adminModalEl = document.getElementById('admin-user-manager-modal');
    if (userModalEl) userModalEl.style.display = 'none';
    if (adminModalEl) adminModalEl.style.display = 'none';

    fieldsContainer.innerHTML = `
            <input type="text" id="user-name-input" placeholder="Fulde navn" required>
            ${isAdminPreferred ? `
                <input type="email" id="user-email-input" placeholder="E-mail (til login)" required>
                <input type="password" id="user-password-input" placeholder="Adgangskode" required>
            ` : `
                <input type="text" id="user-number-input" placeholder="Brugernummer (til børnelogin)">
                <input type="text" id="user-pin-input" placeholder="4-cifret PIN (til børnelogin)">
                <input type="number" id="user-balance-input" placeholder="Startsaldo (f.eks. 50.00)" step="0.01" value="0.00">
            `}
        `;
    modal.style.display = 'flex';

    const nameInput = document.getElementById('user-name-input');
    const emailInput = document.getElementById('user-email-input');
    const passwordInput = document.getElementById('user-password-input');
    const numberInput = document.getElementById('user-number-input');
    const pinInput = document.getElementById('user-pin-input');
    const balanceInput = document.getElementById('user-balance-input');

    return new Promise((resolve) => {
        saveBtn.onclick = () => {
            const name = nameInput.value.trim();
            const email = emailInput ? emailInput.value.trim() : '';
            const password = passwordInput ? passwordInput.value : '';

            if (!name || (isAdminPreferred && (!email || !password))) {
                showAlert('Udfyld venligst alle påkrævede felter for den valgte rolle.');
                return;
            }

            const userData = {
                name,
                email: email || null,
                password: password || null,
                number: numberInput ? numberInput.value : null,
                balance: balanceInput ? (parseFloat(balanceInput.value.replace(',', '.')) || 0) : 0,
                role: preferredRole,
                pin: pinInput ? pinInput.value : null,
            };
            modal.style.display = 'none'; // Skjul modal før resolve
            resolve(userData);
        };

        closeBtn.onclick = () => {
            modal.style.display = 'none';
            resolve(null); // Annulleret
        };
    });
}

export function showBalanceModal(user, mode) {
    const modal = document.getElementById('balance-modal');
    const title = document.getElementById('balance-form-title');
    const fieldsContainer = document.getElementById('balance-form-fields');
    const saveBtn = document.getElementById('save-balance-btn');
    const closeBtn = modal.querySelector('.close-btn');

    const isDeposit = mode === 'deposit';
    title.textContent = isDeposit ? 'Indbetal Penge' : 'Rediger Saldo';

    fieldsContainer.innerHTML = `
            <p>Bruger: <strong>${user.name}</strong></p>
            <p>Nuværende Saldo: <strong>${user.balance.toFixed(2)} kr.</strong></p>
            <input type="number" id="balance-amount-input" placeholder="${isDeposit ? 'Indbetalingsbeløb' : 'Ny saldo'}" step="0.01" required>
        `;
    modal.style.display = 'flex';
    setTimeout(() => {
        const input = document.getElementById('balance-amount-input');
        if (input) input.focus();
    }, 50);

    return new Promise((resolve) => {
        const close = (value) => {
            modal.style.display = 'none';
            saveBtn.onclick = null;
            document.removeEventListener('keydown', handleKeyDown); // Ryd op
            closeBtn.onclick = null;
            resolve(value);
        };

        saveBtn.onclick = () => {
            const amountInput = document.getElementById('balance-amount-input');
            const amountStr = amountInput.value;
            if (!amountStr) {
                close(null); // Annuller hvis tom
                return;
            }
            const amount = parseFloat(amountStr.replace(',', '.'));
            if (isNaN(amount)) {
                showAlert("Ugyldigt beløb.");
                close(null);
                return;
            }
            close(amount);
        };

        const handleKeyDown = (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                saveBtn.click();
            } else if (event.key === 'Escape') {
                event.preventDefault();
                close(null);
            }
        };

        closeBtn.onclick = () => close(null);
        // Add keydown listener after a short delay to avoid capturing the ENTER key that opened the modal
        setTimeout(() => {
            document.addEventListener('keydown', handleKeyDown);
        }, 100);
    });
}
