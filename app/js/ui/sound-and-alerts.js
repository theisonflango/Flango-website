// Ansvar: Lyde og alert-modaler
import {
    getEffectiveVolume,
    isGlobalMuted,
    setGlobalMute,
    getMasterVolume,
    setMasterVolume,
    getSoundVolume,
    setSoundVolume,
    getSoundFile,
    setSoundFile,
    getAllSoundSettings
} from '../core/sound-manager.js';

const customAlertModal = document.getElementById('custom-alert-modal');
const customAlertContent = document.getElementById('custom-alert-content');
const customAlertTitle = document.getElementById('custom-alert-title');
const customAlertBody = document.getElementById('custom-alert-body');
const customAlertOk = document.getElementById('custom-alert-ok');
const customAlertCancel = document.getElementById('custom-alert-cancel');

export function playSound(soundName) {
    // OPTIMERING: Zero-lag volume check (kun in-memory access)
    const effectiveVolume = getEffectiveVolume(soundName);
    if (effectiveVolume === null) {
        // Global mute er aktiveret
        return;
    }

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
        audio.volume = effectiveVolume; // Sæt effektiv volume
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
        focus = 'ok',
        zIndex = null
    } = options;

    if (!customAlertModal || !customAlertOk) return Promise.resolve(false);

    // Gem original z-index og sæt evt. custom z-index
    const originalZIndex = customAlertModal.style.zIndex;
    if (zIndex !== null) {
        customAlertModal.style.zIndex = String(zIndex);
    }

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
            // Gendan original z-index
            if (zIndex !== null) {
                customAlertModal.style.zIndex = originalZIndex || '';
            }
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

    // Hent nuværende lydindstillinger
    const settings = getAllSoundSettings();

    // ============ GLOBAL CONTROLS ============
    const globalControlsDiv = document.createElement('div');
    globalControlsDiv.className = 'sound-global-controls';
    globalControlsDiv.innerHTML = `
        <div class="sound-control-section">
            <h3>Globale Lydindstillinger</h3>

            <div class="sound-control-row">
                <label>
                    <input type="checkbox" id="global-mute-toggle" ${settings.globalMute ? 'checked' : ''}>
                    Mute alle lyde
                </label>
            </div>

            <div class="sound-control-row">
                <label>Master Volume: <span id="master-volume-display">${Math.round(settings.masterVolume * 100)}%</span></label>
                <input type="range" id="master-volume-slider" min="0" max="100" value="${Math.round(settings.masterVolume * 100)}">
            </div>
        </div>
        <hr>
    `;
    soundOptionsList.appendChild(globalControlsDiv);

    // Event listeners for global controls
    const muteToggle = document.getElementById('global-mute-toggle');
    const masterSlider = document.getElementById('master-volume-slider');
    const masterDisplay = document.getElementById('master-volume-display');

    if (muteToggle) {
        muteToggle.addEventListener('change', (e) => {
            setGlobalMute(e.target.checked);
        });
    }

    if (masterSlider) {
        masterSlider.addEventListener('input', (e) => {
            const volumePct = parseInt(e.target.value, 10);
            masterDisplay.textContent = `${volumePct}%`;
            setMasterVolume(volumePct / 100);
        });
    }

    // ============ SOUND FILE SELECTION + PER-SOUND VOLUME ============
    const availableSounds = {
        'Tilføj Vare': [{ name: 'Add 1', url: 'sounds/Add%20Item/Add1.mp3' }, { name: 'Add 2', url: 'sounds/Add%20Item/Add2.mp3' }],
        'Fjern Vare': [{ name: 'Slet', url: 'sounds/Delete%20Item/Slet.mp3' }, { name: 'Slet 1', url: 'sounds/Delete%20Item/Slet1.mp3' }, { name: 'Slet 2', url: 'sounds/Delete%20Item/Slet2.mp3' }, { name: 'Slet 3', url: 'sounds/Delete%20Item/Slet3.mp3' }, { name: 'Slet 4', url: 'sounds/Delete%20Item/Slet4.mp3' }],
        'Gennemfør Køb': [{ name: 'Accept 1', url: 'sounds/Accept/accepter-1.mp3' }, { name: 'Accept 2', url: 'sounds/Accept/accepter-2.mp3' }, { name: 'Accept 3', url: 'sounds/Accept/accepter-3.mp3' }, { name: 'Accept 4', url: 'sounds/Accept/accepter-4.mp3' }, { name: 'Accept 5', url: 'sounds/Accept/accepter-5.mp3' }, { name: 'Accept 6', url: 'sounds/Accept/accepter-6.mp3' }, { name: 'Accept 7', url: 'sounds/Accept/accepter-7.mp3' }],
        'Fejl': [{ name: 'Fejl 1', url: 'sounds/Error/Fejl1.mp3' }, { name: 'Fejl 2', url: 'sounds/Error/Fejl2.mp3' }, { name: 'Fejl 3', url: 'sounds/Error/Fejl3.mp3' }],
    };
    const soundEventMap = { 'Tilføj Vare': 'addItem', 'Fjern Vare': 'removeItem', 'Gennemfør Køb': 'purchase', 'Fejl': 'error' };

    for (const [label, sounds] of Object.entries(availableSounds)) {
        const eventName = soundEventMap[label];

        // Hent gemt lydfil fra localStorage (via sound-manager)
        const savedSoundFile = getSoundFile(eventName);
        const currentSrc = savedSoundFile || sounds[0].url;

        const currentVolume = getSoundVolume(eventName);

        const itemDiv = document.createElement('div');
        itemDiv.className = 'item sound-item-extended';
        const selectOptions = sounds.map(s => `<option value="${s.url}" ${s.url === currentSrc ? 'selected' : ''}>${s.name}</option>`).join('');

        itemDiv.innerHTML = `
            <div class="sound-item-header">
                <label>${label}</label>
                <div class="sound-item-controls">
                    <select data-event-name="${eventName}">${selectOptions}</select>
                    <span class="play-sound-btn" data-event-name="${eventName}">▶️</span>
                </div>
            </div>
            <div class="sound-volume-control">
                <label>Volume: <span class="sound-volume-display">${Math.round(currentVolume * 100)}%</span></label>
                <input type="range" class="sound-volume-slider" data-event-name="${eventName}" min="0" max="100" value="${Math.round(currentVolume * 100)}">
            </div>
        `;
        soundOptionsList.appendChild(itemDiv);
    }

    // Event listeners for sound file selection
    soundOptionsList.addEventListener('change', (e) => {
        if (e.target.tagName === 'SELECT') {
            const eventName = e.target.dataset.eventName;
            const newSoundFile = e.target.value;
            // Konverter camelCase til kebab-case (addItem → add-item)
            const audioId = `audio-${eventName.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`)}`;
            const audioEl = document.getElementById(audioId);
            if (audioEl) {
                audioEl.src = newSoundFile;
                // VIGTIGT: Kald load() for at tvinge browseren til at loade den nye lyd
                audioEl.load();
            }
            // GEM valget i localStorage via sound-manager
            setSoundFile(eventName, newSoundFile);
        }
    });

    // Event listeners for play buttons
    soundOptionsList.addEventListener('click', (e) => {
        if (e.target.classList.contains('play-sound-btn')) {
            playSound(e.target.dataset.eventName);
        }
    });

    // Event listeners for per-sound volume sliders
    soundOptionsList.addEventListener('input', (e) => {
        if (e.target.classList.contains('sound-volume-slider')) {
            const eventName = e.target.dataset.eventName;
            const volumePct = parseInt(e.target.value, 10);
            const display = e.target.closest('.sound-volume-control').querySelector('.sound-volume-display');
            if (display) {
                display.textContent = `${volumePct}%`;
            }
            setSoundVolume(eventName, volumePct / 100);
        }
    });
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
