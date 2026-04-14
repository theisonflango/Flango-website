// js/ui/theme-loader.js
// Theme loader for Flango — consolidated to Klart as only active theme.
// Aurora and Unstoppable CSS files are preserved on disk but not loaded.

const THEME_STORAGE_KEY = 'flango-ui-theme';

// CSS files that make up the Klart theme-pack
const THEME_CSS_FILES = [
    'base.css',
    'layout.css',
    'components.css',
    'products.css',
    'users.css',
    'features.css',
    'calculator.css',
];

// Mobile CSS is separate
const MOBILE_CSS_FILE = 'mobile.css';

// All valid themes (Aurora/Unstoppable kept for reference but disabled in settings)
const ALL_VALID_THEMES = ['klart', 'flango-unstoppable', 'aurora'];
const THEME_PACK_THEMES = ['klart', 'flango-unstoppable', 'aurora'];

/**
 * Check if a theme uses a theme-pack
 */
function isThemePackTheme(themeName) {
    return THEME_PACK_THEMES.includes(themeName);
}

/**
 * Create a link element for CSS
 */
function createCssLink(href, id) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.id = id;
    link.dataset.themeManaged = 'true';
    return link;
}

/**
 * Load Klart theme-pack CSS files
 */
function loadKlartThemePack() {
    const head = document.head;

    // Remove any existing theme-managed CSS
    document.querySelectorAll('link[data-theme-managed="true"]').forEach(el => el.remove());

    // Disable default CSS links
    document.querySelectorAll('link[rel="stylesheet"]').forEach(link => {
        const href = link.getAttribute('href') || '';
        const isDefaultCss = THEME_CSS_FILES.some(file => href === `css/${file}`);
        const isMobileCss = href === MOBILE_CSS_FILE;

        if (isDefaultCss || isMobileCss) {
            link.dataset.originalCss = 'true';
            link.disabled = true;
        }
    });

    // Load Klart CSS files
    THEME_CSS_FILES.forEach(file => {
        const path = `css/themes/klart/${file}`;
        const link = createCssLink(path, `theme-${file.replace('.css', '')}`);
        head.appendChild(link);
    });

    // Load Klart mobile CSS
    const mobileLink = createCssLink(`css/themes/klart/${MOBILE_CSS_FILE}`, 'theme-mobile');
    head.appendChild(mobileLink);
}

/**
 * Initialize theme on page load — always Klart
 */
export function initThemeLoader() {
    localStorage.setItem(THEME_STORAGE_KEY, 'klart');
    document.body.dataset.theme = 'klart';
    loadKlartThemePack();
}

/**
 * Theme change listeners (kept for API compatibility)
 */
/** @type {Array<() => void>} */
const themeChangeListeners = [];

export function onThemeChange(fn) {
    themeChangeListeners.push(fn);
}

/**
 * Switch theme — only klart is accepted, others are ignored
 */
export function switchTheme(themeName) {
    if (themeName !== 'klart') return; // Only klart is active
    localStorage.setItem(THEME_STORAGE_KEY, 'klart');
    document.body.dataset.theme = 'klart';
    loadKlartThemePack();
    themeChangeListeners.forEach(fn => fn());
}

/**
 * Get current theme — always klart
 */
export function getCurrentTheme() {
    return 'klart';
}

/**
 * Check if current theme is a theme-pack
 */
export function isCurrentThemePack() {
    return true;
}

// Export for use in other modules
export { ALL_VALID_THEMES, THEME_PACK_THEMES, isThemePackTheme };
