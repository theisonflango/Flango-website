/**
 * Cookie-banner — informationsbanner om cookies
 *
 * Flango bruger kun nødvendige cookies (Supabase Auth session).
 * Ingen tracking- eller markedsføringscookies.
 * Banneret vises én gang og huskes i localStorage.
 */

const STORAGE_KEY = 'flango_cookie_banner_dismissed';

function initCookieBanner() {
    if (localStorage.getItem(STORAGE_KEY)) return;

    const banner = document.createElement('div');
    banner.id = 'flango-cookie-banner';
    banner.setAttribute('role', 'status');
    banner.setAttribute('aria-live', 'polite');
    banner.innerHTML = `
        <span class="cookie-banner-text">
            🍪 Flango bruger kun nødvendige cookies til at holde dig logget ind.
            Vi bruger ikke tracking- eller markedsføringscookies.
        </span>
        <button class="cookie-banner-btn" id="cookie-banner-dismiss" aria-label="Luk cookiebanner">
            Forstået
        </button>
    `;

    const style = document.createElement('style');
    style.textContent = `
        #flango-cookie-banner {
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            z-index: 99999;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 1rem;
            padding: 0.75rem 1.25rem;
            background: rgba(15, 17, 28, 0.96);
            border-top: 1px solid rgba(255,255,255,0.1);
            backdrop-filter: blur(8px);
            -webkit-backdrop-filter: blur(8px);
            font-family: Arial, sans-serif;
            font-size: 0.8rem;
            color: rgba(255,255,255,0.8);
            box-shadow: 0 -2px 12px rgba(0,0,0,0.3);
            animation: cookieBannerSlideIn 0.3s ease-out;
        }
        @keyframes cookieBannerSlideIn {
            from { transform: translateY(100%); opacity: 0; }
            to   { transform: translateY(0);    opacity: 1; }
        }
        .cookie-banner-text {
            flex: 1;
            line-height: 1.4;
        }
        .cookie-banner-btn {
            flex-shrink: 0;
            background: rgba(255,255,255,0.12);
            border: 1px solid rgba(255,255,255,0.2);
            color: #fff;
            font-size: 0.8rem;
            font-family: inherit;
            padding: 0.35rem 0.9rem;
            border-radius: 6px;
            cursor: pointer;
            white-space: nowrap;
            transition: background 0.15s;
        }
        .cookie-banner-btn:hover {
            background: rgba(255,255,255,0.22);
        }
        @media (max-width: 500px) {
            #flango-cookie-banner {
                flex-direction: column;
                align-items: flex-start;
                gap: 0.5rem;
            }
        }
    `;

    document.head.appendChild(style);
    document.body.appendChild(banner);

    document.getElementById('cookie-banner-dismiss').addEventListener('click', () => {
        localStorage.setItem(STORAGE_KEY, '1');
        banner.style.animation = 'cookieBannerSlideIn 0.2s ease-in reverse';
        setTimeout(() => banner.remove(), 200);
    });
}

// Vent til DOM er klar
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCookieBanner);
} else {
    initCookieBanner();
}
