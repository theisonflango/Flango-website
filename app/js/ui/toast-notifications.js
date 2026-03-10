// js/ui/toast-notifications.js
// Toast notification system for live balance deposits (stack/queue, auto-dismiss).

const MAX_VISIBLE_TOASTS = 3;
const AUTO_DISMISS_MS = 10000; // 10 sekunder

let toastQueue = [];
let visibleToasts = [];
let container = null;

function ensureContainer() {
    if (container) return container;
    container = document.createElement('div');
    container.id = 'toast-notifications-container';
    container.className = 'toast-notifications-container';
    document.body.appendChild(container);
    return container;
}

function formatAmount(amount) {
    const num = Number(amount);
    if (!Number.isFinite(num)) return String(amount);
    return Math.abs(num).toFixed(0) + ' kr';
}

function formatBalance(balance) {
    const num = Number(balance);
    if (!Number.isFinite(num)) return null;
    return num.toFixed(0) + ' kr';
}

function createToastElement({ userId, userName, delta, newBalance, variant }) {
    const toast = document.createElement('div');
    toast.className = 'toast-notification';
    toast.dataset.userId = userId;
    toast.dataset.toastId = `${userId}-${Date.now()}-${Math.random()}`;

    const isParentDeposit = variant === 'parent';
    const mainText = isParentDeposit
        ? `${userName}s forældre har sendt ${formatAmount(delta)}`
        : `${userName} fik indbetalt ${formatAmount(delta)}`;

    const balanceText = newBalance != null ? formatBalance(newBalance) : null;

    toast.innerHTML = `
        <div class="toast-content">
            <div class="toast-main-text">${mainText}</div>
            ${balanceText ? `<div class="toast-sub-text">Saldo nu: ${balanceText}</div>` : ''}
        </div>
        <button class="toast-close" aria-label="Luk">&times;</button>
    `;

    const closeBtn = toast.querySelector('.toast-close');
    closeBtn.onclick = (e) => {
        e.stopPropagation();
        dismissToast(toast, true);
    };

    return toast;
}

function showNextToast() {
    if (visibleToasts.length >= MAX_VISIBLE_TOASTS || toastQueue.length === 0) return;

    const item = toastQueue.shift();
    const toast = createToastElement(item);
    visibleToasts.push({ toast, item });

    const cont = ensureContainer();
    cont.appendChild(toast);

    // Trigger slide-in animation
    requestAnimationFrame(() => {
        toast.classList.add('toast-visible');
    });

    // Auto-dismiss
    const timeoutId = setTimeout(() => {
        dismissToast(toast, false);
    }, AUTO_DISMISS_MS);

    toast.dataset.timeoutId = timeoutId;
}

function dismissToast(toast, immediate = false) {
    const timeoutId = toast.dataset.timeoutId;
    if (timeoutId) {
        clearTimeout(timeoutId);
        delete toast.dataset.timeoutId;
    }

    const idx = visibleToasts.findIndex((v) => v.toast === toast);
    if (idx === -1) return;

    visibleToasts.splice(idx, 1);

    toast.classList.remove('toast-visible');
    toast.classList.add('toast-dismissing');

    const onTransitionEnd = () => {
        toast.remove();
        showNextToast();
    };

    if (immediate) {
        toast.style.transition = 'none';
        toast.remove();
        showNextToast();
    } else {
        toast.addEventListener('transitionend', onTransitionEnd, { once: true });
        setTimeout(() => {
            if (toast.parentNode) {
                toast.removeEventListener('transitionend', onTransitionEnd);
                toast.remove();
                showNextToast();
            }
        }, 300);
    }
}

function updateToastBalance(userId, newBalance) {
    const visible = visibleToasts.find((v) => v.item.userId === userId);
    if (!visible) return;

    const toast = visible.toast;
    const subTextEl = toast.querySelector('.toast-sub-text');
    const balanceText = formatBalance(newBalance);

    if (balanceText) {
        if (subTextEl) {
            subTextEl.textContent = `Saldo nu: ${balanceText}`;
        } else {
            const content = toast.querySelector('.toast-content');
            if (content) {
                const sub = document.createElement('div');
                sub.className = 'toast-sub-text';
                sub.textContent = `Saldo nu: ${balanceText}`;
                content.appendChild(sub);
            }
        }
    }

    visible.item.newBalance = newBalance;
}

/**
 * Show a balance deposit toast notification.
 * @param {Object} opts
 * @param {string} opts.userId - User ID
 * @param {string} opts.userName - User display name
 * @param {number} opts.delta - Deposit amount (positive)
 * @param {number|null} [opts.newBalance] - New balance (optional, can be updated later)
 * @param {'parent'|'admin'} [opts.variant='admin'] - 'parent' for stripe_portal, 'admin' otherwise
 */
export function showBalanceToast({ userId, userName, delta, newBalance = null, variant = 'admin' }) {
    if (!userId || !userName || delta == null) {
        console.warn('[toast] Missing required params:', { userId, userName, delta });
        return;
    }

    const item = { userId, userName, delta, newBalance, variant };

    // Check if user already has a visible toast - update it instead of queuing
    const existing = visibleToasts.find((v) => v.item.userId === userId);
    if (existing) {
        // Update existing toast with new deposit (accumulate delta)
        existing.item.delta += delta;
        existing.item.newBalance = newBalance;
        const toast = existing.toast;
        const mainTextEl = toast.querySelector('.toast-main-text');
        if (mainTextEl) {
            const isParent = existing.item.variant === 'parent';
            mainTextEl.textContent = isParent
                ? `${userName}s forældre har sendt ${formatAmount(existing.item.delta)}`
                : `${userName} fik indbetalt ${formatAmount(existing.item.delta)}`;
        }
        if (newBalance != null) {
            updateToastBalance(userId, newBalance);
        }
        // Reset auto-dismiss timer
        const timeoutId = toast.dataset.timeoutId;
        if (timeoutId) clearTimeout(timeoutId);
        const newTimeoutId = setTimeout(() => dismissToast(toast, false), AUTO_DISMISS_MS);
        toast.dataset.timeoutId = newTimeoutId;
        return;
    }

    toastQueue.push(item);
    showNextToast();
}

/**
 * Update balance for a user's toast (called when users UPDATE arrives).
 * @param {string} userId
 * @param {number} newBalance
 */
export function updateBalanceForToast(userId, newBalance) {
    updateToastBalance(userId, newBalance);
    // Also update queued items
    toastQueue.forEach((item) => {
        if (item.userId === userId && item.newBalance == null) {
            item.newBalance = newBalance;
        }
    });
}

/**
 * Initialize toast system (creates container, adds CSS if needed).
 */
export function initToastNotifications() {
    ensureContainer();
    // CSS will be added via inline styles or separate CSS file
    if (!document.getElementById('toast-notifications-styles')) {
        const style = document.createElement('style');
        style.id = 'toast-notifications-styles';
        style.textContent = `
            .toast-notifications-container {
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 10000;
                display: flex;
                flex-direction: column;
                gap: 12px;
                pointer-events: none;
            }
            .toast-notification {
                background: #fff;
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                padding: 16px 20px;
                min-width: 300px;
                max-width: 400px;
                display: flex;
                align-items: flex-start;
                justify-content: space-between;
                gap: 12px;
                pointer-events: auto;
                transform: translateX(400px);
                opacity: 0;
                transition: transform 0.3s ease-out, opacity 0.3s ease-out;
            }
            .toast-notification.toast-visible {
                transform: translateX(0);
                opacity: 1;
            }
            .toast-notification.toast-dismissing {
                transform: translateX(400px);
                opacity: 0;
            }
            .toast-content {
                flex: 1;
            }
            .toast-main-text {
                font-weight: 600;
                font-size: 15px;
                color: #333;
                margin-bottom: 4px;
            }
            .toast-sub-text {
                font-size: 13px;
                color: #666;
            }
            .toast-close {
                background: none;
                border: none;
                font-size: 24px;
                line-height: 1;
                color: #999;
                cursor: pointer;
                padding: 0;
                width: 24px;
                height: 24px;
                display: flex;
                align-items: center;
                justify-content: center;
                flex-shrink: 0;
            }
            .toast-close:hover {
                color: #333;
            }
        `;
        document.head.appendChild(style);
    }
}

/**
 * Clear all toasts (e.g. on logout).
 */
export function clearAllToasts() {
    visibleToasts.forEach((v) => {
        const timeoutId = v.toast.dataset.timeoutId;
        if (timeoutId) clearTimeout(timeoutId);
        v.toast.remove();
    });
    visibleToasts = [];
    toastQueue = [];
}
