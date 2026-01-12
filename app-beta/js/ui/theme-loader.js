// js/ui/theme-loader.js
// Theme Pack Loader for Flango Unstoppable
// Swaps between default CSS and Unstoppable theme-pack CSS files

const THEME_STORAGE_KEY = 'flango-ui-theme';

// CSS files that make up a complete theme-pack
const THEME_CSS_FILES = [
    'base.css',
    'layout.css',
    'components.css',
    'products.css',
    'users.css',
    'features.css',
];

// Mobile CSS is separate
const MOBILE_CSS_FILE = 'mobile.css';

// Themes that use a complete theme-pack (CSS file replacement)
const THEME_PACK_THEMES = ['flango-unstoppable'];

// All valid themes
const ALL_VALID_THEMES = ['flango-unstoppable'];

/**
 * Check if a theme uses a theme-pack (complete CSS replacement)
 */
function isThemePackTheme(themeName) {
    return THEME_PACK_THEMES.includes(themeName);
}

/**
 * Get the CSS path for a theme
 * @param {string} themeName
 * @param {string} cssFile
 * @returns {string} Full path to CSS file
 */
function getThemeCssPath(themeName, cssFile) {
    if (isThemePackTheme(themeName)) {
        return `css/themes/${themeName}/${cssFile}`;
    }
    // Default path
    if (cssFile === MOBILE_CSS_FILE) {
        return cssFile; // mobile.css is in root
    }
    return `css/${cssFile}`;
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
 * Load theme-pack CSS files
 * Replaces the default CSS with theme-specific CSS
 */
function loadThemePack(themeName) {
    const head = document.head;

    // Remove any existing theme-managed CSS
    document.querySelectorAll('link[data-theme-managed="true"]').forEach(el => el.remove());

    // Also remove default CSS links if loading a theme-pack
    if (isThemePackTheme(themeName)) {
        // Find and disable default CSS
        document.querySelectorAll('link[rel="stylesheet"]').forEach(link => {
            const href = link.getAttribute('href') || '';
            // Check if it's a default CSS file we need to replace
            const isDefaultCss = THEME_CSS_FILES.some(file => href === `css/${file}`);
            const isMobileCss = href === MOBILE_CSS_FILE;
            const isThemeCss = href.includes('css/themes/') && !href.includes(themeName);

            if (isDefaultCss || isMobileCss) {
                link.dataset.originalCss = 'true';
                link.disabled = true;
            }

            // Disable other theme CSS files
            if (isThemeCss) {
                link.disabled = true;
            }
        });

        // Load theme-pack CSS files
        THEME_CSS_FILES.forEach(file => {
            const path = getThemeCssPath(themeName, file);
            const link = createCssLink(path, `theme-${file.replace('.css', '')}`);
            head.appendChild(link);
        });

        // Load theme-pack mobile CSS
        const mobilePath = getThemeCssPath(themeName, MOBILE_CSS_FILE);
        const mobileLink = createCssLink(mobilePath, 'theme-mobile');
        head.appendChild(mobileLink);
    } else {
        // Re-enable default CSS for non-theme-pack themes
        document.querySelectorAll('link[data-original-css="true"]').forEach(link => {
            link.disabled = false;
        });

        // For pos-pro theme, make sure its CSS is loaded
        if (themeName === 'pos-pro') {
            const posPro = document.querySelector('link[href*="pos-pro.css"]');
            if (posPro) posPro.disabled = false;
        }
    }
}

/**
 * Initialize theme on page load
 */
export function initThemeLoader() {
    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    const themeName = ALL_VALID_THEMES.includes(savedTheme) ? savedTheme : 'flango-unstoppable';

    // Set data-theme attribute
    document.body.dataset.theme = themeName;

    // Load theme-pack if needed
    if (isThemePackTheme(themeName)) {
        loadThemePack(themeName);
    }
}

/**
 * Switch to a different theme
 */
export function switchTheme(themeName) {
    if (!ALL_VALID_THEMES.includes(themeName)) {
        themeName = 'flango-unstoppable';
    }

    // Save to localStorage
    localStorage.setItem(THEME_STORAGE_KEY, themeName);

    // For theme-pack themes, we need to reload the page
    // to properly swap all CSS files
    if (isThemePackTheme(themeName) || isThemePackTheme(document.body.dataset.theme)) {
        // Set theme before reload so it loads correctly
        document.body.dataset.theme = themeName;

        // Reload page to swap CSS
        window.location.reload();
        return;
    }

    // For non-theme-pack themes (default, pastel-pop, pos-pro)
    // Just change the data-theme attribute
    document.body.dataset.theme = themeName;
}

/**
 * Get current theme name
 */
export function getCurrentTheme() {
    return document.body.dataset.theme || 'flango-unstoppable';
}

/**
 * Check if current theme is a theme-pack
 */
export function isCurrentThemePack() {
    return isThemePackTheme(getCurrentTheme());
}

// Export for use in other modules
export { ALL_VALID_THEMES, THEME_PACK_THEMES, isThemePackTheme };
