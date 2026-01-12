// Enkle helpers til generiske confirm-modaler og kr-format
export function formatKr(amount) {
    const num = Number(amount) || 0;
    return num.toFixed(2).replace('.', ',') + ' kr';
}

export function buildAdjustmentTexts(customerName, delta) {
    const absDelta = Math.abs(delta);
    const baseTitle = 'Bekræft justering';
    if (delta < 0) {
        return {
            title: baseTitle,
            message: `Du er ved at rette et tidligere køb.\nJusteringen giver ${customerName} ${formatKr(absDelta)} retur på saldoen.\n\nVil du fortsætte?`,
            confirmLabel: 'OK',
            cancelLabel: 'Annuller',
        };
    }
    if (delta > 0) {
        return {
            title: baseTitle,
            message: `Du er ved at rette et tidligere køb.\nJusteringen trækker ${formatKr(delta)} ekstra fra ${customerName}s saldo.\n\nVil du fortsætte?`,
            confirmLabel: 'OK',
            cancelLabel: 'Annuller',
        };
    }
    return {
        title: 'Ingen ændring',
        message: `${customerName}s saldo bliver ikke ændret af denne justering.\n\nVil du fortsætte alligevel?`,
        confirmLabel: 'OK',
        cancelLabel: 'Annuller',
    };
}

function ensureConfirmModal() {
    let backdrop = document.getElementById('flango-confirm-backdrop');
    if (!backdrop) {
        backdrop = document.createElement('div');
        backdrop.id = 'flango-confirm-backdrop';
        backdrop.style.position = 'fixed';
        backdrop.style.inset = '0';
        backdrop.style.display = 'none';
        backdrop.style.alignItems = 'center';
        backdrop.style.justifyContent = 'center';
        backdrop.style.background = 'rgba(0,0,0,0.35)';
        backdrop.style.zIndex = '99999';

        const dialog = document.createElement('div');
        dialog.className = 'flango-confirm-dialog';
        dialog.style.background = '#fff';
        dialog.style.borderRadius = '12px';
        dialog.style.padding = '20px 24px';
        dialog.style.maxWidth = '480px';
        dialog.style.width = 'min(90vw, 480px)';
        dialog.style.boxShadow = '0 8px 24px rgba(0,0,0,0.18)';
        dialog.style.display = 'flex';
        dialog.style.flexDirection = 'column';
        dialog.style.gap = '12px';

        const titleEl = document.createElement('h2');
        titleEl.className = 'flango-confirm-title';
        titleEl.style.margin = '0';

        const messageEl = document.createElement('div');
        messageEl.className = 'flango-confirm-message';
        messageEl.style.whiteSpace = 'pre-line';

        const actions = document.createElement('div');
        actions.className = 'confirm-modal-actions';
        actions.style.display = 'flex';
        actions.style.justifyContent = 'flex-end';
        actions.style.gap = '10px';

        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'secondary-btn flango-confirm-cancel';
        const okBtn = document.createElement('button');
        okBtn.className = 'primary-btn flango-confirm-ok';

        actions.append(cancelBtn, okBtn);
        dialog.append(titleEl, messageEl, actions);
        backdrop.appendChild(dialog);
        document.body.appendChild(backdrop);
    }
    return document.getElementById('flango-confirm-backdrop');
}

export function showConfirmModal({ title, message, confirmText = 'OK', cancelText = 'Annuller' }) {
    const backdrop = ensureConfirmModal();
    const dialog = backdrop.querySelector('.flango-confirm-dialog');
    const titleEl = dialog.querySelector('.flango-confirm-title');
    const messageEl = dialog.querySelector('.flango-confirm-message');
    const cancelBtn = dialog.querySelector('.flango-confirm-cancel');
    const okBtn = dialog.querySelector('.flango-confirm-ok');

    titleEl.textContent = title || 'Bekræft';
    messageEl.textContent = message || '';
    cancelBtn.textContent = cancelText || 'Annuller';
    okBtn.textContent = confirmText || 'OK';

    return new Promise((resolve) => {
        const closeModal = (result) => {
            backdrop.style.display = 'none';
            document.removeEventListener('keydown', escHandler);
            resolve(result);
        };

        const escHandler = (evt) => {
            if (evt.key === 'Escape') {
                closeModal(false);
            }
        };

        cancelBtn.onclick = () => closeModal(false);
        okBtn.onclick = () => closeModal(true);
        backdrop.onclick = (e) => {
            if (e.target === backdrop) closeModal(false);
        };
        document.addEventListener('keydown', escHandler);

        backdrop.style.display = 'flex';
    });
}
