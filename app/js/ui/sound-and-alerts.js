// Ansvar: Lyde og alert-modaler

const customAlertModal = document.getElementById('custom-alert-modal');
const customAlertContent = document.getElementById('custom-alert-content');
const customAlertTitle = document.getElementById('custom-alert-title');
const customAlertBody = document.getElementById('custom-alert-body');
const customAlertOk = document.getElementById('custom-alert-ok');
const customAlertCancel = document.getElementById('custom-alert-cancel');

export function playSound(soundName) {
    const soundMap = {
        addItem: document.getElementById('audio-add-item'),
        removeItem: document.getElementById('audio-remove-item'),
        purchase: document.getElementById('audio-purchase'),
        error: document.getElementById('audio-error'),
        login: document.getElementById('audio-login'),
        logout: document.getElementById('audio-logout'),
        balanceUpdate: document.getElementById('audio-balance-update'),
        productCreate: document.getElementById('audio-product-create'),
    };
    const audio = soundMap[soundName];
    if (audio && audio.src) {
        audio.pause();
        audio.currentTime = 0;
        audio.play().catch(e => console.error("Lyd-afspilningsfejl:", e));
    }
}

export function showCustomAlert(title, body, config = 'alert') {
    const options = typeof config === 'string' ? { type: config } : (config || {});
    const {
        type = 'alert',
        okText = 'OK',
        cancelText = 'Annuller',
        showCancel = false,
        confirmKey = 'Enter',
        cancelKey = 'Escape',
        focus = 'ok'
    } = options;

    if (!customAlertModal || !customAlertOk) return Promise.resolve(false);

    customAlertTitle.textContent = title;
    customAlertBody.innerHTML = body;
    customAlertOk.textContent = okText;
    if (customAlertCancel) {
        customAlertCancel.textContent = cancelText;
        const shouldShowCancel = (type === 'confirm') || showCancel;
        customAlertCancel.style.display = shouldShowCancel ? 'inline-block' : 'none';
    }
    customAlertModal.style.display = 'flex';
    customAlertModal.classList.add('dropdown-active');
    if (customAlertContent) customAlertContent.scrollTop = 0;

    const focusTarget = (focus === 'cancel' ? customAlertCancel : customAlertOk);
    setTimeout(() => focusTarget?.focus(), 50);

    const shouldListenForCancel = () => {
        if (!customAlertCancel) return false;
        return customAlertCancel.style.display !== 'none';
    };

    return new Promise((resolve) => {
        const cleanup = (result) => {
            customAlertModal.classList.remove('dropdown-active');
            customAlertModal.style.display = 'none';
            customAlertOk.onclick = null;
            if (customAlertCancel) customAlertCancel.onclick = null;
            document.removeEventListener('keydown', handleKeydown);
            resolve(result);
        };

        const handleKeydown = (event) => {
            if (event.key === confirmKey) {
                event.preventDefault();
                customAlertOk.click();
            } else if (event.key === cancelKey || event.key === 'Escape') {
                if (shouldListenForCancel()) {
                    event.preventDefault();
                    customAlertCancel.click();
                }
            }
        };

        document.addEventListener('keydown', handleKeydown);
        customAlertOk.onclick = () => cleanup(true);
        if (customAlertCancel) {
            customAlertCancel.onclick = () => cleanup(false);
        }
    });
}

export function showAlert(message) {
    playSound('error');
    showCustomAlert('Fejl', message);
}

function renderSoundSettingsModal() {
    const soundOptionsList = document.getElementById('sound-options-list');
    soundOptionsList.innerHTML = '';
    const availableSounds = {
        'Tilføj Vare': [{ name: 'Add 1', url: 'sounds/Add%20Item/Add1.mp3' }, { name: 'Add 2', url: 'sounds/Add%20Item/Add2.mp3' }],
        'Fjern Vare': [{ name: 'Slet', url: 'sounds/Delete%20Item/Slet.mp3' }, { name: 'Slet 1', url: 'sounds/Delete%20Item/Slet1.mp3' }, { name: 'Slet 2', url: 'sounds/Delete%20Item/Slet2.mp3' }, { name: 'Slet 3', url: 'sounds/Delete%20Item/Slet3.mp3' }, { name: 'Slet 4', url: 'sounds/Delete%20Item/Slet4.mp3' }],
        'Gennemfør Køb': [{ name: 'Accept 1', url: 'sounds/Accept/accepter-1.mp3' }, { name: 'Accept 2', url: 'sounds/Accept/accepter-2.mp3' }, { name: 'Accept 3', url: 'sounds/Accept/accepter-3.mp3' }, { name: 'Accept 4', url: 'sounds/Accept/accepter-4.mp3' }, { name: 'Accept 5', url: 'sounds/Accept/accepter-5.mp3' }, { name: 'Accept 6', url: 'sounds/Accept/accepter-6.mp3' }, { name: 'Accept 7', url: 'sounds/Accept/accepter-7.mp3' }],
        'Fejl': [{ name: 'Fejl 1', url: 'sounds/Error/Fejl1.mp3' }, { name: 'Fejl 2', url: 'sounds/Error/Fejl2.mp3' }, { name: 'Fejl 3', url: 'sounds/Error/Fejl3.mp3' }],
    };
    const soundEventMap = { 'Tilføj Vare': 'addItem', 'Fjern Vare': 'removeItem', 'Gennemfør Køb': 'purchase', 'Fejl': 'error' };
    for (const [label, sounds] of Object.entries(availableSounds)) {
        const eventName = soundEventMap[label];
        const audioElement = document.getElementById(`audio-${eventName}`);
        const currentSrc = audioElement ? audioElement.src : sounds[0].url;
        const itemDiv = document.createElement('div');
        itemDiv.className = 'item';
        const selectOptions = sounds.map(s => `<option value="${s.url}" ${s.url === currentSrc ? 'selected' : ''}>${s.name}</option>`).join('');
        itemDiv.innerHTML = `<label>${label}</label><select data-event-name="${eventName}">${selectOptions}</select><span class="play-sound-btn" data-event-name="${eventName}">▶️</span>`;
        soundOptionsList.appendChild(itemDiv);
    }
    soundOptionsList.onchange = (e) => {
        if (e.target.tagName === 'SELECT') {
            const eventName = e.target.dataset.eventName;
            document.getElementById(`audio-${eventName}`).src = e.target.value;
        }
    };
    soundOptionsList.onclick = (e) => {
        if (e.target.classList.contains('play-sound-btn')) playSound(e.target.dataset.eventName);
    };
}

export function openSoundSettingsModal() {
    const soundSettingsModal = document.getElementById('sound-settings-modal');
    if (!soundSettingsModal) {
        showAlert('Lydindstillinger kan ikke åbnes.');
        return;
    }
    renderSoundSettingsModal();
    soundSettingsModal.style.display = 'flex';
}
