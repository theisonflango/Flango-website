// Ikonpakker for café-fladen.
//
// Et ikon er defineret ÉT sted — her — og hentes to steder fra: markup via
// data-icon på en .flango-icon-slot, og TOOLBAR_MAPPING via iconKey. Stod det
// også i index.html, ville de to kopier drive fra hinanden.
//
// En pakke behøver ikke være komplet. Manglende nøgler falder tilbage til
// 'klassisk', så et halvfærdigt sæt aldrig efterlader et tomt ikonfelt.
//
// Skifte pakke: ?icons=klassisk i URL'en, eller flangoIconPack('klassisk')
// i konsollen. Valget huskes i localStorage.
(function () {
    'use strict';

    const PACKS = {
        klassisk: {
            // Historik
            chart: `<svg viewBox="0 0 16 16" fill="#c77ddb" stroke="none" role="img" aria-label="Historik"><rect x="2.5" y="7.5" width="3" height="6" rx="0.8"/><rect x="6.5" y="3.5" width="3" height="10" rx="0.8"/><rect x="10.5" y="9.5" width="3" height="4" rx="0.8"/></svg>`,
            // Ugeplan
            calendar: `<svg viewBox="0 0 16 16" fill="none" stroke="#7aa87a" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" role="img" aria-label="Ugeplan"><rect x="1.8" y="3" width="12.4" height="10.5" rx="1.6"/><path d="M1.8 6.4h12.4M5.2 1.8v2.4M10.8 1.8v2.4"/><path d="M4.4 9h2M7.2 9h2M10 9h1.6M4.4 11.2h2M7.2 11.2h2"/></svg>`,
            // Lommeregner
            calculator: `🧮`,
            // Køkkenskærm
            utensils: `🍽️`,
            // Produktoversigt + salgstæller
            grid: `<svg viewBox="0 0 16 16" fill="none" stroke="#e8734a" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" role="img" aria-label="Produktoversigt"><rect x="3" y="3" width="4.5" height="4.5" rx="1"/><rect x="9.5" y="3" width="4.5" height="4.5" rx="1"/><rect x="3" y="9.5" width="4.5" height="4.5" rx="1"/><rect x="9.5" y="9.5" width="4.5" height="4.5" rx="1"/></svg>`,
            // Opret produkt
            plus_circle: `<svg viewBox="0 0 16 16" fill="none" stroke="#5dca7a" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" role="img" aria-label="Opret nyt produkt"><rect x="2.5" y="2.5" width="11" height="11" rx="3"/><path d="M8 5.3v5.4M5.3 8h5.4"/></svg>`,
            // Brugerpanel
            users: `<svg viewBox="0 0 16 16" fill="none" stroke="#5dca7a" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" role="img" aria-label="Brugerpanel"><circle cx="6" cy="5.5" r="2.5"/><path d="M1.5 14c0-2.5 2-4.5 4.5-4.5s4.5 2 4.5 4.5"/><path d="M11 7h4M13 5v4"/></svg>`,
            // Fuldskærm
            fullscreen: `⛶`,
            // Indstillinger
            settings: `<img src="Icons/webp/Function/Gear2.webp" alt="Indstillinger">`,
            // Log ud
            logout: `<svg viewBox="0 0 16 16" fill="none" stroke="#e85a6f" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" role="img" aria-label="Log ud"><path d="M9.5 14H4.5a1.5 1.5 0 01-1.5-1.5v-9A1.5 1.5 0 014.5 2h5"/><path d="M7 8h7M12 5.5L14.5 8 12 10.5"/></svg>`,
            // Hjælp
            help: `<img src="Icons/webp/Assets/FlangoFruitLogo.webp" alt="Flango Logo">`,
            // Min Flango
            user: `👤`,
            // Bytte-timer
            timer: `<svg viewBox="0 0 16 16" fill="none" stroke="#f59e0b" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" role="img" aria-label="Bytte-timer"><circle cx="8" cy="9.5" r="5"/><path d="M8 9.5V6"/><path d="M6.5 2.5h3M8 2.5v2"/><path d="M12.4 5.1l1-1"/></svg>`,
            // DB-Historik
            db_history: `<img src="Icons/webp/Function/Gear2.webp" alt="DB-Historik">`,
            // Papirkurv-notifikation
            warning: `<svg viewBox="0 0 16 16" fill="none" stroke="#e85a6f" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" role="img" aria-label="Papirkurv-notifikation"><path d="M8 2.5L14.5 13.5H1.5L8 2.5Z"/><path d="M8 6.5v3.2"/><circle cx="8" cy="11.6" r="0.5" fill="#e85a6f" stroke="none"/></svg>`,
            // Sletningsanmodninger
            trash: `🗑️`,
            // Billeder til godkendelse
            camera: `📷`,
        },

        duotone: {
            // Historik
            chart: `<svg class="flango-icon" viewBox="0 0 24 24"><line class="f-base" x1="6" y1="20" x2="6" y2="14"></line><line class="f-base" x1="18" y1="20" x2="18" y2="10"></line><line class="f-base" x1="12" y1="20" x2="12" y2="4"></line><circle class="f-accent-fill" cx="12" cy="4" r="2"></circle></svg>`,
            // Ugeplan
            calendar: `<svg class="flango-icon" viewBox="0 0 24 24"> <rect class="f-base" x="3" y="4" width="18" height="18" rx="2" ry="2"></rect> <line class="f-base" x1="16" y1="2" x2="16" y2="6"></line> <line class="f-base" x1="8" y1="2" x2="8" y2="6"></line> <line class="f-base" x1="3" y1="10" x2="21" y2="10"></line> <circle class="f-accent-fill" cx="16" cy="15" r="2"></circle> </svg>`,
            // Lommeregner
            calculator: `<svg class="flango-icon" viewBox="0 0 24 24"><rect class="f-base" width="16" height="20" x="4" y="2" rx="4"></rect><rect class="f-base" x="7" y="5.5" width="10" height="3.5" rx="1.2"></rect><circle class="f-base" cx="8" cy="14" r="1"></circle><circle class="f-base" cx="12" cy="14" r="1"></circle><circle class="f-base" cx="16" cy="14" r="1"></circle><circle class="f-base" cx="8" cy="18" r="1"></circle><circle class="f-base" cx="12" cy="18" r="1"></circle><circle class="f-accent-fill" cx="16" cy="18" r="1.7"></circle></svg>`,
            // Køkkenskærm
            utensils: `<svg class="flango-icon" viewBox="0 0 24 24"> <path class="f-base" d="M7 2v20"></path> <path class="f-base" d="M4 2v7a3 3 0 0 0 6 0V2"></path> <path class="f-accent-stroke" d="M19 13V2c-2.5 0-4 1.5-4 5v6"></path> <path class="f-base" d="M17 13v9"></path> </svg>`,
            // Produktoversigt + salgstæller
            grid: `<svg class="flango-icon" viewBox="0 0 24 24"> <rect class="f-base" x="4" y="4" width="6" height="6" rx="2"></rect> <rect class="f-base" x="4" y="14" width="6" height="6" rx="2"></rect> <rect class="f-base" x="14" y="14" width="6" height="6" rx="2"></rect> <rect class="f-accent-fill" x="14" y="4" width="6" height="6" rx="2"></rect> </svg>`,
            // Opret produkt
            plus_circle: `<svg class="flango-icon" viewBox="0 0 24 24"><circle class="f-base" cx="12" cy="12" r="10"></circle><path class="f-accent-stroke" d="M12 8v8M8 12h8"></path></svg>`,
            // Brugerpanel
            users: `<svg class="flango-icon" viewBox="0 0 24 24"> <path class="f-base" d="M15 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path> <circle class="f-base" cx="8" cy="7" r="4"></circle> <path class="f-accent-stroke" d="M19 8v6M16 11h6"></path> </svg>`,
            // Fuldskærm
            fullscreen: `<svg class="flango-icon" viewBox="0 0 24 24"><path class="f-base" d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path><circle class="f-accent-fill" cx="12" cy="12" r="1.5"></circle></svg>`,
            // Indstillinger
            settings: `<svg class="flango-icon" viewBox="0 0 24 24"> <circle class="f-base" cx="12" cy="12" r="3"></circle> <path class="f-base" d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.26.6.8 1 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path> <circle class="f-accent-fill" cx="12" cy="12" r="1.5"></circle> </svg>`,
            // Log ud
            logout: `<svg class="flango-icon" viewBox="0 0 24 24"><path class="f-base" d="M10 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5"></path><path class="f-base" d="M20 12H8"></path><path class="f-accent-stroke" d="m15 17 5-5-5-5"></path></svg>`,
            // Hjælp
            help: `<svg class="flango-icon" viewBox="0 0 24 24"><circle class="f-base" cx="12" cy="12" r="10"></circle><path class="f-base" d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><circle class="f-accent-fill" cx="12" cy="17" r="1.5"></circle></svg>`,
            // Min Flango
            user: `<svg class="flango-icon" viewBox="0 0 24 24"> <path class="f-base" d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path> <circle class="f-base" cx="12" cy="7" r="4"></circle> <circle class="f-accent-fill" cx="15" cy="10" r="1.5"></circle> </svg>`,
            // Bytte-timer
            timer: `<svg class="flango-icon" viewBox="0 0 24 24"> <circle class="f-base" cx="12" cy="14" r="8"></circle> <path class="f-accent-stroke" d="M12 14l3-3"></path> <line class="f-base" x1="10" x2="14" y1="2" y2="2"></line> <line class="f-base" x1="12" x2="12" y1="2" y2="6"></line> </svg>`,
            // DB-Historik
            db_history: `<svg class="flango-icon" viewBox="0 0 24 24"><ellipse class="f-base" cx="12" cy="5.5" rx="7" ry="2.5"></ellipse><path class="f-base" d="M5 5.5v13c0 1.38 3.13 2.5 7 2.5s7-1.12 7-2.5v-13"></path><path class="f-base" d="M5 12c0 1.38 3.13 2.5 7 2.5s7-1.12 7-2.5"></path><circle class="f-accent-fill" cx="12" cy="17.8" r="1.6"></circle></svg>`,
            // Papirkurv-notifikation
            warning: `<svg class="flango-icon" viewBox="0 0 24 24"><path class="f-base" d="M12 3.5 21.5 20h-19L12 3.5Z"></path><path class="f-base" d="M12 10v4"></path><circle class="f-accent-fill" cx="12" cy="17.2" r="1.5"></circle></svg>`,
            // Sletningsanmodninger
            trash: `<svg class="flango-icon" viewBox="0 0 24 24"><path class="f-base" d="M6 7.5v11.5a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7.5"></path><path class="f-base" d="M9.5 6V4.5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1V6"></path><path class="f-base" d="M10 11.5v6M14 11.5v6"></path><path class="f-accent-stroke" d="M4 6.5h16"></path></svg>`,
            // Billeder til godkendelse
            camera: `<svg class="flango-icon" viewBox="0 0 24 24"><path class="f-base" d="M3 9a2 2 0 0 1 2-2h2.3l1.3-2.2h6.8L17 7h2a2 2 0 0 1 2 2v8.5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"></path><circle class="f-base" cx="12" cy="13.2" r="3.5"></circle><circle class="f-accent-fill" cx="12" cy="13.2" r="1.5"></circle></svg>`,
        },
    };

    const DEFAULT_PACK = 'duotone';
    const FALLBACK_PACK = 'klassisk';
    const STORAGE_KEY = 'flango_icon_pack';

    // Caféen kører på iPads uden konsol — derfor er URL'en også en kontakt,
    // og valget skal overleve det næste sideskift.
    function initialPack() {
        try {
            const fromUrl = new URLSearchParams(location.search).get('icons');
            if (fromUrl && PACKS[fromUrl]) {
                localStorage.setItem(STORAGE_KEY, fromUrl);
                return fromUrl;
            }
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored && PACKS[stored]) return stored;
        } catch (_) {
            // Privat browsing spærrer for localStorage; standarden er stadig gyldig.
        }
        return DEFAULT_PACK;
    }

    let active = initialPack();

    function icon(key) {
        return PACKS[active][key] || PACKS[FALLBACK_PACK][key] || '';
    }

    function applyIcons(root) {
        (root || document).querySelectorAll('.flango-icon-slot[data-icon]')
            .forEach(slot => { slot.innerHTML = icon(slot.dataset.icon); });
    }

    window.flangoIcon = icon;
    window.flangoApplyIcons = applyIcons;
    window.flangoIconPacks = () => Object.keys(PACKS);
    window.flangoIconPack = function (name) {
        if (name && PACKS[name]) {
            active = name;
            try { localStorage.setItem(STORAGE_KEY, name); } catch (_) {}
            applyIcons();
        }
        return active;
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => applyIcons());
    } else {
        applyIcons();
    }
})();
