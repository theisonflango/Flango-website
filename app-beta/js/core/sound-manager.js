// js/core/sound-manager.js
// Professional sound management system med zero-lag playback og granular volume control

const SOUND_SETTINGS_KEY = 'flango_sound_settings_v1';

// Default lydindstillinger
const DEFAULT_SOUND_SETTINGS = {
    globalMute: false,
    masterVolume: 1.0, // 0-1 range
    perSound: {
        addItem: 1.0,
        removeItem: 1.0,
        purchase: 1.0,
        error: 1.0,
        login: 1.0,
        logout: 1.0,
        balanceUpdate: 1.0,
        productCreate: 1.0
    },
    soundFiles: {
        addItem: 'sounds/Add%20Item/Add1.mp3',
        removeItem: 'sounds/Delete%20Item/Slet.mp3',
        purchase: 'sounds/Accept/accepter-1.mp3',
        error: 'sounds/Error/Fejl1.mp3'
    }
};

// In-memory cache for zero-lag playback
let soundSettings = {
    ...DEFAULT_SOUND_SETTINGS,
    perSound: { ...DEFAULT_SOUND_SETTINGS.perSound },
    soundFiles: { ...DEFAULT_SOUND_SETTINGS.soundFiles }
};

/**
 * Initialiser lydindstillinger fra localStorage (kald ved app start)
 */
export function initializeSoundSettings() {
    try {
        const saved = localStorage.getItem(SOUND_SETTINGS_KEY);
        if (saved) {
            const parsed = JSON.parse(saved);
            // Merge saved settings med defaults for at håndtere nye lyde
            soundSettings = {
                globalMute: parsed.globalMute ?? DEFAULT_SOUND_SETTINGS.globalMute,
                masterVolume: parsed.masterVolume ?? DEFAULT_SOUND_SETTINGS.masterVolume,
                perSound: {
                    ...DEFAULT_SOUND_SETTINGS.perSound,
                    ...parsed.perSound
                },
                soundFiles: {
                    ...DEFAULT_SOUND_SETTINGS.soundFiles,
                    ...parsed.soundFiles
                }
            };

            // Sæt gemte lydfiler på audio elementer ved app start
            applyStoredSoundFiles();
        }
    } catch (err) {
        console.warn('[sound-manager] Kunne ikke indlæse lydindstillinger:', err);
        soundSettings = {
            ...DEFAULT_SOUND_SETTINGS,
            perSound: { ...DEFAULT_SOUND_SETTINGS.perSound },
            soundFiles: { ...DEFAULT_SOUND_SETTINGS.soundFiles }
        };
    }
}

/**
 * Konverter camelCase til kebab-case (addItem → add-item)
 */
function camelToKebab(str) {
    return str.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`);
}

/**
 * Anvend gemte lydfiler på audio elementer (kaldes ved app start)
 */
function applyStoredSoundFiles() {
    Object.entries(soundSettings.soundFiles).forEach(([soundName, filePath]) => {
        // Konverter camelCase til kebab-case for at matche HTML ID'er
        const audioId = `audio-${camelToKebab(soundName)}`;
        const audioEl = document.getElementById(audioId);
        if (audioEl && filePath) {
            audioEl.src = filePath;
            audioEl.load();
        }
    });
}

/**
 * Gem lydindstillinger til localStorage
 */
function saveSoundSettings() {
    try {
        localStorage.setItem(SOUND_SETTINGS_KEY, JSON.stringify(soundSettings));
    } catch (err) {
        console.error('[sound-manager] Kunne ikke gemme lydindstillinger:', err);
    }
}

/**
 * Beregn effektiv volume for en lyd (zero-lag - kun in-memory access)
 * @param {string} soundName - Navn på lyden
 * @returns {number} Effektiv volume (0-1) eller null hvis muted
 */
export function getEffectiveVolume(soundName) {
    if (soundSettings.globalMute) {
        return null; // Muted
    }

    const perSoundVolume = soundSettings.perSound[soundName] ?? 1.0;
    const effectiveVolume = soundSettings.masterVolume * perSoundVolume;

    return effectiveVolume;
}

/**
 * Hent global mute status
 */
export function isGlobalMuted() {
    return soundSettings.globalMute;
}

/**
 * Sæt global mute
 */
export function setGlobalMute(muted) {
    soundSettings.globalMute = Boolean(muted);
    saveSoundSettings();
}

/**
 * Hent master volume (0-1)
 */
export function getMasterVolume() {
    return soundSettings.masterVolume;
}

/**
 * Sæt master volume (0-1)
 */
export function setMasterVolume(volume) {
    soundSettings.masterVolume = Math.max(0, Math.min(1, volume));
    saveSoundSettings();
}

/**
 * Hent volume for en specifik lyd (0-1)
 */
export function getSoundVolume(soundName) {
    return soundSettings.perSound[soundName] ?? 1.0;
}

/**
 * Sæt volume for en specifik lyd (0-1)
 */
export function setSoundVolume(soundName, volume) {
    soundSettings.perSound[soundName] = Math.max(0, Math.min(1, volume));
    saveSoundSettings();
}

/**
 * Hent gemt lydfil for en specifik lyd
 */
export function getSoundFile(soundName) {
    return soundSettings.soundFiles[soundName] ?? DEFAULT_SOUND_SETTINGS.soundFiles[soundName] ?? null;
}

/**
 * Sæt lydfil for en specifik lyd og gem i localStorage
 */
export function setSoundFile(soundName, filePath) {
    console.log(`[sound-manager] setSoundFile(${soundName}, ${filePath})`);
    soundSettings.soundFiles[soundName] = filePath;
    saveSoundSettings();
    console.log('[sound-manager] Saved settings:', JSON.stringify(soundSettings, null, 2));
}

/**
 * Hent alle lydindstillinger (til UI rendering)
 */
export function getAllSoundSettings() {
    return {
        globalMute: soundSettings.globalMute,
        masterVolume: soundSettings.masterVolume,
        perSound: { ...soundSettings.perSound },
        soundFiles: { ...soundSettings.soundFiles }
    };
}

/**
 * Nulstil til standardindstillinger
 */
export function resetToDefaults() {
    soundSettings = {
        ...DEFAULT_SOUND_SETTINGS,
        perSound: { ...DEFAULT_SOUND_SETTINGS.perSound },
        soundFiles: { ...DEFAULT_SOUND_SETTINGS.soundFiles }
    };
    saveSoundSettings();
}
