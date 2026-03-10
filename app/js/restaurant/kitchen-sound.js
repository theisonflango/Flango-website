/**
 * Kitchen sound management.
 * Supports two separate sounds: new order notification + serve confirmation.
 * Sound files configurable via localStorage (kitchen settings overlay).
 */

const MUTE_KEY = 'flango_kitchen_muted';
const ORDER_SOUND_KEY = 'flango_kitchen_order_sound';
const SERVE_SOUND_KEY = 'flango_kitchen_serve_sound';

let orderAudio = null;
let serveAudio = null;
let isMuted = false;

/**
 * Initialize kitchen sounds.
 * @param {string|null} defaultSoundFile - Default sound from institution settings (fallback)
 */
export function initKitchenSound(defaultSoundFile) {
    isMuted = localStorage.getItem(MUTE_KEY) === 'true';

    // Order sound: use localStorage override, else institution default
    const orderFile = localStorage.getItem(ORDER_SOUND_KEY);
    const effectiveOrderFile = orderFile !== null ? orderFile : defaultSoundFile;
    if (effectiveOrderFile) {
        orderAudio = new Audio(effectiveOrderFile);
        orderAudio.preload = 'auto';
    }

    // Serve sound: only from localStorage (no institution default)
    const serveFile = localStorage.getItem(SERVE_SOUND_KEY);
    if (serveFile) {
        serveAudio = new Audio(serveFile);
        serveAudio.preload = 'auto';
    }
}

/**
 * Set new order sound file.
 */
export function setOrderSound(soundFile) {
    localStorage.setItem(ORDER_SOUND_KEY, soundFile || '');
    if (soundFile) {
        orderAudio = new Audio(soundFile);
        orderAudio.preload = 'auto';
    } else {
        orderAudio = null;
    }
}

/**
 * Set serve confirmation sound file.
 */
export function setServeSound(soundFile) {
    localStorage.setItem(SERVE_SOUND_KEY, soundFile || '');
    if (soundFile) {
        serveAudio = new Audio(soundFile);
        serveAudio.preload = 'auto';
    } else {
        serveAudio = null;
    }
}

/**
 * Get current order sound file path.
 */
export function getOrderSoundFile() {
    return localStorage.getItem(ORDER_SOUND_KEY) || null;
}

/**
 * Get current serve sound file path.
 */
export function getServeSoundFile() {
    return localStorage.getItem(SERVE_SOUND_KEY) || null;
}

/**
 * Update the default sound file (backward compat).
 */
export function setKitchenSound(soundFile) {
    setOrderSound(soundFile);
}

/**
 * Play the new order notification sound.
 */
export function playNewOrderSound() {
    if (isMuted || !orderAudio) return;
    orderAudio.currentTime = 0;
    orderAudio.volume = 0.8;
    orderAudio.play().catch(() => {});
}

/**
 * Play the serve confirmation sound.
 */
export function playServeSound() {
    if (isMuted || !serveAudio) return;
    serveAudio.currentTime = 0;
    serveAudio.volume = 0.6;
    serveAudio.play().catch(() => {});
}

/**
 * Toggle mute state (mutes both sounds).
 */
export function toggleMute() {
    isMuted = !isMuted;
    localStorage.setItem(MUTE_KEY, String(isMuted));
    return isMuted;
}

/**
 * @returns {boolean}
 */
export function isSoundMuted() {
    return isMuted;
}
