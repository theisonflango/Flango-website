import { playSound } from './sound-and-alerts.js?v=3.0.67';
import {
    renderBadgeIcon,
    getStatsSummaryHTML,
    formatDurationWithSeconds,
    loadFlangoAdminStats,
    mergeRemoteStatsWithSession,
} from '../domain/stats-and-badges.js?v=3.0.67';

export const AVATAR_URLS = [
    'Icons/webp/Avatar/Ekspedient-dreng-1star.webp',
    'Icons/webp/Avatar/Ekspedient-dreng-2star.webp',
    'Icons/webp/Avatar/Ekspedient-dreng-3star.webp',
    'Icons/webp/Avatar/Ekspedient-dreng-basic1.webp',
    'Icons/webp/Avatar/Ekspedient-dreng-basic2.webp',
    'Icons/webp/Avatar/Ekspedient-default2.webp',
    'Icons/webp/Avatar/Ekspedient-pige-1star.webp',
    'Icons/webp/Avatar/Ekspedient-pige-2star.webp',
    'Icons/webp/Avatar/Ekspedient-pige-3star.webp',
    'Icons/webp/Avatar/Ekspedient-pige-3star-red.webp',
    'Icons/webp/Avatar/Ekspedient-pige-basic1.webp',
    'Icons/webp/Avatar/Ekspedient-pige-basic2.webp',
    'Icons/webp/Avatar/Ekspedient-pige-basic3.webp',
    'Icons/webp/Avatar/Ekspedient-dreng-legende1.webp',
    'Icons/webp/Avatar/Ekspedient-dreng-legende2.webp',
    'Icons/webp/Avatar/Ekspedient-pige-legende1.webp',
    'Icons/webp/Avatar/Ekspedient-legende1.webp',
    'Icons/webp/Avatar/Ekspedient-legende2.webp',
    'Icons/webp/Avatar/Ekspedient-legende3.webp',
    'Icons/webp/Avatar/Ekspedient-legende4.webp',
    'Icons/webp/Avatar/Ekspedient-legende5.webp',
    'Icons/webp/Avatar/Ekspedient-legende6.webp',
];

export async function setupAvatarPicker(options) {
    const {
        clerkProfile,
        sessionStartTime,
        getSessionSalesCount,
        updateLoggedInUserDisplay,
        updateAvatarStorage,
    } = options || {};

    const modal = document.getElementById('avatar-picker-modal');
    if (!modal || !clerkProfile || !sessionStartTime || !getSessionSalesCount || !updateLoggedInUserDisplay) {
        return;
    }

    // Importer calculateCurrentStats dynamisk for at undgå cirkulære afhængigheder, hvis det er et problem
    const { calculateCurrentStats } = await import('../domain/stats-store.js?v=3.0.67');


    const summaryContainer = modal.querySelector('#avatar-picker-summary');
    const container = modal.querySelector('#avatar-carousel-container');
    const closeBtn = modal.querySelector('.close-btn');
    if (!container || !closeBtn) return;
    let liveDurationIntervalId = null;

    const stopLiveDurationTracker = () => {
        if (liveDurationIntervalId) {
            clearTimeout(liveDurationIntervalId);
            liveDurationIntervalId = null;
        }
    };

    const startLiveDurationTracker = (baseTodayMinutes) => {
        stopLiveDurationTracker();
        const todayContainer = document.getElementById('stats-duration-today');
        if (!todayContainer) return;

        const baseTodaySeconds = Math.max(0, (baseTodayMinutes || 0) * 60);

        // OPTIMERING: Cache DOM elementer i stedet for querySelector hver gang
        const cachedElements = {
            hours: todayContainer.querySelector('[data-unit="h"]'),
            minutes: todayContainer.querySelector('[data-unit="m"]'),
            seconds: todayContainer.querySelector('[data-unit="s"]')
        };

        let lastValues = { hours: '', minutes: '', seconds: '' };

        const updateTimerValues = (totalSeconds) => {
            const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
            const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
            const seconds = String(totalSeconds % 60).padStart(2, '0');

            // OPTIMERING: Kun opdater DOM hvis værdien har ændret sig
            if (cachedElements.hours && hours !== lastValues.hours) {
                cachedElements.hours.textContent = hours;
                lastValues.hours = hours;
            }
            if (cachedElements.minutes && minutes !== lastValues.minutes) {
                cachedElements.minutes.textContent = minutes;
                lastValues.minutes = minutes;
            }
            if (cachedElements.seconds && seconds !== lastValues.seconds) {
                cachedElements.seconds.textContent = seconds;
                lastValues.seconds = seconds;
            }
        };

        const computeTodaySeconds = () => {
            const now = new Date();
            const sessionElapsedSeconds = Math.max(0, Math.round((now - sessionStartTime) / 1000));
            return baseTodaySeconds + sessionElapsedSeconds;
        };

        // Initial update
        updateTimerValues(computeTodaySeconds());

        // OPTIMERING: Brug setTimeout i stedet for setInterval for bedre kontrol
        const updateLoop = () => {
            updateTimerValues(computeTodaySeconds());
            liveDurationIntervalId = setTimeout(updateLoop, 1000);
        };
        liveDurationIntervalId = setTimeout(updateLoop, 1000);
    };

    closeBtn.onclick = () => {
        stopLiveDurationTracker();
        modal.style.display = 'none';
    };
    let avatarOptions = [];

    const AVATAR_STORAGE_PREFIX = 'flango-avatar-';
    const DEFAULT_AVATAR_URL = 'Icons/webp/Avatar/Ekspedient-default2.webp';

    const categories = [
        {
            title: 'Nybegynder Ekspedient',
            stars: '',
            keyword: 'basic',
            requiredHours: 0,
            requiredSales: 0,
            description: 'Du er i gang med at lære, hvordan man arbejder i en café.'
        },
        {
            title: 'Øvet Ekspedient',
            stars: '⭐',
            keyword: '1star',
            requiredHours: 6,
            requiredSales: 100,
            description: 'Du kan klare opgaver selvstændigt.'
        },
        {
            title: 'Expert Ekspedient',
            stars: '⭐⭐',
            keyword: '2star',
            requiredHours: 12,
            requiredSales: 200,
            description: 'Du er rutineret og har overblik.'
        },
        {
            title: 'Pro Flango Ekspedient',
            stars: '⭐⭐⭐',
            keyword: '3star',
            requiredHours: 18,
            requiredSales: 300,
            description: 'Dine evner som Flango-ekspedient sidder nu på rygraden, og du løser opgaverne naturligt og med godt overblik.'
        },
        {
            title: 'Legendarisk Ekspedient',
            stars: '👑',
            keyword: 'legende',
            requiredHours: 30,
            requiredSales: 500,
            description: 'Du har nået det højeste Level i Flango! Det kræver styrke og vedholdenhed – og ikke mindst en lyst til at hjælpe. Det er en fantastisk evne. Måske kunne dit næste mål være at hjælpe nogen med at nå hertil?'
        },
    ];

    container.innerHTML = '';
    avatarOptions = [];

    const getCurrentAvatarSrc = () => {
        const key = `${AVATAR_STORAGE_PREFIX}${clerkProfile.id}`;
        return localStorage.getItem(key) || DEFAULT_AVATAR_URL;
    };

    categories.forEach(category => {
        const row = document.createElement('div');
        row.className = 'avatar-row';

        row.addEventListener('click', (event) => {
            if (row.classList.contains('locked')) {
                const clickedOption = event.target.closest('.avatar-option');
                if (clickedOption) {
                    const lockOverlay = clickedOption.querySelector('.avatar-lock-overlay');
                    if (lockOverlay) {
                        shakeLock(lockOverlay);
                    }
                }
            }
        });

        const headerEl = document.createElement('div');
        headerEl.className = 'avatar-row-header';

        const titleEl = document.createElement('h3');
        titleEl.className = 'avatar-row-title';
        titleEl.textContent = `${category.title} ${category.stars}`;
        headerEl.appendChild(titleEl);

        if (category.description) {
            const descEl = document.createElement('p');
            descEl.className = 'avatar-row-description';
            descEl.textContent = category.description;
            headerEl.appendChild(descEl);
        }

        const carouselWrapper = document.createElement('div');
        carouselWrapper.className = 'avatar-carousel-wrapper';

        const viewport = document.createElement('div');
        viewport.className = 'avatar-scroller-viewport';

        const scroller = document.createElement('div');
        scroller.className = 'avatar-scroller';

        const categoryAvatars = AVATAR_URLS.filter(url => {
            if (url.includes(category.keyword)) return true;
            if (category.keyword === 'basic' && url.includes('default')) return true;
            return false;
        });

        categoryAvatars.forEach(url => {
            const option = document.createElement('div');
            option.className = 'avatar-option';
            option.dataset.avatarUrl = url;
            option.innerHTML = `
                        <img src="${url}" alt="Avatar">
                        <div class="avatar-lock-overlay">
                            <img src="Icons/webp/Function/Lock.webp" alt="Låst">
                        </div>
                        <button type="button" class="avatar-preview-btn" title="Se avatar">🔍</button>`;

            option.onclick = () => {
                if (row.classList.contains('locked')) {
                    shakeLock(option);
                } else {
                    selectAvatar(option, modal);
                }
            };
            const previewBtn = option.querySelector('.avatar-preview-btn');
            if (previewBtn) {
                previewBtn.addEventListener('click', (evt) => {
                    evt.stopPropagation();
                    showAvatarPreviewModal(categoryAvatars, categoryAvatars.indexOf(url));
                });
            }
            scroller.appendChild(option);
            avatarOptions.push(option);
        });

        const navLeft = document.createElement('button');
        navLeft.className = 'avatar-row-nav left';
        navLeft.innerHTML = '‹';
        navLeft.onclick = () => { scroller.scrollBy({ left: -220, behavior: 'smooth' }); };

        const navRight = document.createElement('button');
        navRight.className = 'avatar-row-nav right';
        navRight.innerHTML = '›';
        navRight.onclick = () => { scroller.scrollBy({ left: 220, behavior: 'smooth' }); };

        viewport.appendChild(scroller);
        carouselWrapper.appendChild(navLeft);
        carouselWrapper.appendChild(viewport);
        carouselWrapper.appendChild(navRight);

        row.appendChild(headerEl);
        row.appendChild(carouselWrapper);
        container.appendChild(row);
    });

    function injectTimerStyles() {
        if (document.getElementById('flango-timer-styles')) return;
        const style = document.createElement('style');
        style.id = 'flango-timer-styles';
        style.textContent = `
            /* ── Modal header ─────────────────────────────── */
            #avatar-picker-modal .modal-header {
                display: flex;
                align-items: center;
                gap: 14px;
                position: relative;
            }
            #avatar-picker-modal .header-avatar-ring {
                width: 46px;
                height: 46px;
                border-radius: 50%;
                background: linear-gradient(135deg, #f59e0b, #fb923c);
                padding: 2.5px;
                flex-shrink: 0;
                box-shadow: 0 2px 10px rgba(245,158,11,0.35);
            }
            #avatar-picker-modal .header-avatar-ring img {
                width: 100%;
                height: 100%;
                border-radius: 50%;
                object-fit: cover;
                background: #fff8ed;
                display: block;
            }
            #avatar-picker-modal .modal-header h2 {
                font-family: 'Nunito', sans-serif;
                font-size: 21px;
                font-weight: 900;
                color: #111827;
                letter-spacing: -0.3px;
                flex: 1;
                text-align: center;
            }

            /* ── Dashboard Grid Layout ────────────────────── */
            .flango-status-grid {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 12px;
            }

            /* ── Card Base Style ──────────────────────────── */
            .flango-status-card {
                border-radius: 20px;
                padding: 16px 18px;
                display: flex;
                flex-direction: column;
                gap: 10px;
                position: relative;
                overflow: hidden;
            }

            /* ── Card Eyebrow ─────────────────────────────── */
            .card-eyebrow {
                font-size: 10.5px;
                font-weight: 800;
                letter-spacing: 0.09em;
                text-transform: uppercase;
                text-align: center;
            }

            /* ── Card A: Status ───────────────────────────── */
            .flango-status-card.card-a {
                background: linear-gradient(150deg, #fffbeb 0%, #fef3c7 55%, #fde68a 100%);
                border: 1.5px solid #fcd34d;
                box-shadow: 0 2px 12px rgba(251,191,36,0.18), inset 0 1px 0 rgba(255,255,255,0.8);
            }
            .flango-status-card.card-a .card-eyebrow { color: #b45309; margin-bottom: 4px; }

            .level-pill {
                display: inline-flex;
                align-items: center;
                gap: 7px;
                background: linear-gradient(135deg, #f59e0b, #fbbf24);
                border-radius: 999px;
                padding: 7px 16px 7px 10px;
                width: fit-content;
                box-shadow: 0 4px 14px rgba(245,158,11,0.35);
                margin-bottom: 2px;
                align-self: center;
            }
            .level-pill-stars { font-size: 16px; line-height: 1; }
            .level-pill-name {
                font-family: 'Nunito', sans-serif;
                font-size: 17px;
                font-weight: 900;
                color: #fff;
                letter-spacing: -0.3px;
                text-shadow: 0 1px 3px rgba(0,0,0,0.18);
            }

            .progress-wrap { display: flex; flex-direction: column; gap: 5px; }
            .progress-row { display: flex; justify-content: space-between; align-items: center; }
            .progress-label { font-size: 11px; font-weight: 600; color: #78350f; }
            .progress-pct {
                font-family: 'Nunito', sans-serif;
                font-size: 12px;
                font-weight: 900;
                color: #d97706;
            }
            .progress-track {
                height: 8px;
                background: rgba(180,83,9,0.12);
                border-radius: 999px;
                overflow: hidden;
            }
            .progress-fill {
                height: 100%;
                background: linear-gradient(90deg, #f59e0b 0%, #fbbf24 60%, #fde68a 100%);
                border-radius: 999px;
                box-shadow: 0 0 8px rgba(245,158,11,0.6);
                animation: prog-in 1.2s cubic-bezier(0.22,0.61,0.36,1) both;
            }
            @keyframes prog-in { from { width: 0%; } }
            .progress-hint { font-size: 10.5px; color: #92400e; opacity: 0.75; }

            .speaker {
                display: flex;
                align-items: flex-end;
                gap: 10px;
                margin-top: 4px;
            }
            .speaker-avatar {
                width: 96px;
                height: 110px;
                flex-shrink: 0;
                object-fit: cover;
                object-position: center top;
                filter: drop-shadow(0 4px 10px rgba(0,0,0,0.16));
            }
            .speech-bubble {
                background: rgba(255,255,255,0.82);
                border: 1.5px solid rgba(251,191,36,0.4);
                border-radius: 4px 16px 16px 16px;
                padding: 9px 12px;
                font-size: 12px;
                font-style: italic;
                color: #78350f;
                line-height: 1.55;
                box-shadow: 0 2px 10px rgba(0,0,0,0.06);
                flex: 1;
            }

            /* ── Card B: Badges ───────────────────────────── */
            .flango-status-card.card-b {
                background: linear-gradient(150deg, #f0f9ff 0%, #e0f2fe 55%, #bae6fd 100%);
                border: 1.5px solid #7dd3fc;
                box-shadow: 0 2px 12px rgba(14,165,233,0.12), inset 0 1px 0 rgba(255,255,255,0.8);
            }
            .flango-status-card.card-b .card-eyebrow { color: #0369a1; }

            .badge-panel {
                flex-grow: 1;
                display: flex;
                flex-direction: column;
            }
            .badge-panel .badge-coverflow, .badge-panel .simple-badge-row {
                flex-grow: 1;
                display: flex;
                align-items: center;
                justify-content: center;
            }

            /* Coverflow nav override for badges card */
            .flango-status-card.card-b .coverflow-nav {
                width: 32px;
                height: 32px;
                border-radius: 50%;
                border: 1.5px solid #7dd3fc;
                background: rgba(255,255,255,0.85);
                color: #0284c7;
                font-size: 18px;
                cursor: pointer;
                flex-shrink: 0;
                box-shadow: 0 2px 8px rgba(2,132,199,0.14);
                transition: all 0.15s;
            }
            .flango-status-card.card-b .coverflow-nav:hover {
                background: #fff;
                transform: scale(1.1);
            }

            /* ── Card C: I dag ────────────────────────────── */
            .flango-status-card.card-c {
                background: linear-gradient(150deg, #f0fdf4 0%, #dcfce7 55%, #bbf7d0 100%);
                border: 1.5px solid #6ee7b7;
                box-shadow: 0 2px 12px rgba(16,185,129,0.12), inset 0 1px 0 rgba(255,255,255,0.8);
                overflow-y: auto;
                max-height: 280px;
            }
            .flango-status-card.card-c .card-eyebrow { color: #065f46; }
            .flango-status-card.card-c::-webkit-scrollbar { width: 3px; }
            .flango-status-card.card-c::-webkit-scrollbar-thumb { background: #6ee7b7; border-radius: 99px; }

            /* Timer box */
            .timer-box {
                display: inline-flex;
                align-items: center;
                background: rgba(255,255,255,0.70);
                border: 1.5px solid rgba(255,255,255,0.9);
                border-radius: 14px;
                padding: 10px 16px;
                box-shadow: 0 2px 12px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.9);
                width: fit-content;
                align-self: center;
            }
            .tseg { display: flex; flex-direction: column; align-items: center; gap: 1px; min-width: 46px; }
            .tval {
                font-family: 'Nunito', sans-serif;
                font-size: 32px;
                font-weight: 900;
                color: #065f46;
                line-height: 1;
                font-variant-numeric: tabular-nums;
                letter-spacing: -1px;
            }
            .tlbl {
                font-size: 8.5px;
                font-weight: 800;
                text-transform: uppercase;
                letter-spacing: 0.06em;
                color: #059669;
                opacity: 0.75;
            }
            .tcolon {
                font-family: 'Nunito', sans-serif;
                font-size: 26px;
                font-weight: 900;
                color: #6ee7b7;
                padding: 0 2px;
                margin-bottom: 10px;
                animation: blink 1s step-start infinite;
            }
            @keyframes blink {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.2; }
            }

            /* Stat chips */
            .chips {
                display: grid;
                grid-template-columns: repeat(3, 1fr);
                gap: 7px;
            }
            .chip {
                background: rgba(255,255,255,0.65);
                border: 1.5px solid rgba(255,255,255,0.9);
                border-radius: 12px;
                padding: 9px 6px 7px;
                text-align: center;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                gap: 2px;
                box-shadow: 0 1px 4px rgba(0,0,0,0.04);
                min-height: 62px;
            }
            .chip-val {
                font-family: 'Nunito', sans-serif;
                font-size: 22px;
                font-weight: 900;
                line-height: 1;
                color: #065f46;
                height: 24px;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            .chip-val.kr { font-size: 16px; }
            .chip-lbl {
                font-size: 9.5px;
                font-weight: 700;
                letter-spacing: 0.07em;
                text-transform: uppercase;
                color: #374151;
                opacity: 0.45;
            }

            /* Product rows */
            .product-rows { display: flex; flex-direction: column; }
            .prow {
                display: grid;
                grid-template-columns: 38px 20px 1fr auto;
                gap: 6px;
                align-items: center;
                padding: 5px 2px;
                border-bottom: 1px dashed rgba(0,0,0,0.07);
                font-size: 12.5px;
            }
            .prow:last-child { border-bottom: none; }
            .pqty { font-size: 11px; font-weight: 700; color: #6b7280; white-space: nowrap; }
            .pname { color: #1f2937; }
            .pprice { font-weight: 700; color: #374151; text-align: right; white-space: nowrap; }
            .empty-msg {
                font-size: 12px;
                color: #9ca3af;
                font-style: italic;
                text-align: center;
                padding: 6px 0 2px;
            }

            /* ── Card D: Sammenlagt ───────────────────────── */
            .flango-status-card.card-d {
                background: linear-gradient(150deg, #faf5ff 0%, #ede9fe 55%, #ddd6fe 100%);
                border: 1.5px solid #c4b5fd;
                box-shadow: 0 2px 12px rgba(124,58,237,0.10), inset 0 1px 0 rgba(255,255,255,0.8);
                overflow-y: auto;
                max-height: 280px;
            }
            .flango-status-card.card-d .card-eyebrow { color: #4c1d95; }
            .flango-status-card.card-d::-webkit-scrollbar { width: 3px; }
            .flango-status-card.card-d::-webkit-scrollbar-thumb { background: #c4b5fd; border-radius: 99px; }
            .flango-status-card.card-d .chip-val { color: #4c1d95; }

            .hours-pill {
                display: inline-flex;
                align-items: center;
                gap: 6px;
                background: rgba(255,255,255,0.65);
                border: 1.5px solid rgba(255,255,255,0.9);
                border-radius: 999px;
                padding: 5px 12px;
                font-size: 12.5px;
                font-weight: 600;
                color: #4c1d95;
                box-shadow: 0 1px 4px rgba(0,0,0,0.05);
            }

            /* ── Section Divider ──────────────────────────── */
            .flango-section-divider {
                display: flex;
                align-items: center;
                gap: 10px;
                margin: 8px 0 4px;
            }
            .flango-section-divider .divider-line {
                flex: 1;
                height: 1px;
                background: #e5e7eb;
            }
            .flango-section-divider .divider-label {
                font-size: 10.5px;
                font-weight: 800;
                letter-spacing: 0.09em;
                text-transform: uppercase;
                color: #9ca3af;
                white-space: nowrap;
            }

            /* ── Responsive Grid ──────────────────────────── */
            @media (max-width: 1024px) {
                .flango-status-grid {
                    grid-template-columns: 1fr;
                }
                .flango-status-card.card-c,
                .flango-status-card.card-d {
                    max-height: 300px;
                }
            }

            /* ── No badges message ────────────────────────── */
            .no-badges-message {
                font-size: 12px;
                color: #64748b;
                text-align: center;
                line-height: 1.55;
                padding: 8px 4px;
            }

            /* ── Backward compat: logout accordion stats ── */
            .stats-grid {
                display: grid;
                grid-template-columns: repeat(3, 1fr);
                gap: 8px;
                margin: 12px 0;
                text-align: center;
            }
            .stat-item {
                background: rgba(255,255,255,0.65);
                border-radius: 12px;
                padding: 9px 6px 7px;
                border: 1.5px solid rgba(255,255,255,0.9);
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                gap: 2px;
                box-shadow: 0 1px 4px rgba(0,0,0,0.04);
            }
            .stat-value {
                font-family: 'Nunito', sans-serif;
                font-size: 22px;
                font-weight: 900;
                line-height: 1;
                color: #065f46;
            }
            .stat-label {
                font-size: 9.5px;
                font-weight: 700;
                letter-spacing: 0.07em;
                text-transform: uppercase;
                color: #374151;
                opacity: 0.45;
            }
            .product-summary-line {
                font-size: 12.5px;
                display: grid;
                grid-template-columns: 38px 20px 1fr auto;
                gap: 6px;
                align-items: center;
                padding: 5px 2px;
                border-bottom: 1px dashed rgba(0,0,0,0.07);
            }
            .product-summary-line:last-child { border-bottom: none; }
            .product-summary-line .summary-price {
                font-weight: 700;
                color: #374151;
                text-align: right;
            }

            /* ── Logout status layout ─────────────────────── */
            .logout-status-layout {
                display: flex;
                flex-direction: column;
                gap: 16px;
            }
        `;
        document.head.appendChild(style);
    }

    const updateSelectedAvatarUI = () => {
        const current = getCurrentAvatarSrc();
        avatarOptions.forEach(option => {
            option.classList.toggle('selected', option.dataset.avatarUrl === current);
        });
    };

    window.__flangoOpenAvatarPicker = async () => {
        injectTimerStyles();

        // Opdater modal-headeren med avatar-ring og titel
        const modalHeader = modal.querySelector('.modal-header');
        if (modalHeader) {
            const headerTitle = modalHeader.querySelector('h2');
            if (headerTitle) {
                headerTitle.textContent = 'Min Flango';
            }
            // Fjern eventuel gammel avatar-ring/avatar og tilføj ny ring
            modalHeader.querySelector('.header-avatar-ring')?.remove();
            modalHeader.querySelector('.header-avatar')?.remove();
            const ring = document.createElement('div');
            ring.className = 'header-avatar-ring';
            const avatarImg = document.createElement('img');
            avatarImg.src = getCurrentAvatarSrc();
            avatarImg.alt = 'Avatar';
            ring.appendChild(avatarImg);
            modalHeader.prepend(ring);
        }

        const remoteStatsRaw = await loadFlangoAdminStats();
        const currentStats = calculateCurrentStats({
            clerkProfile,
            sessionStartTime,
            sessionSalesCount: getSessionSalesCount(),
            remoteStats: remoteStatsRaw,
        });

        if (summaryContainer) {
            summaryContainer.innerHTML = getStatsSummaryHTML(currentStats, {
                badgeDisplay: 'coverflow',
                remoteStats: remoteStatsRaw
            }, clerkProfile);
            hydrateBadgeCarousels(summaryContainer);

            const backendTodayMinutes = remoteStatsRaw?.today?.minutes_worked ?? 0;
            startLiveDurationTracker(backendTodayMinutes);
        }

        const avatarRows = container.querySelectorAll('.avatar-row');
        avatarRows.forEach((row, index) => {
            const category = categories[index];
            const isUnlocked = currentStats.totalHours >= category.requiredHours || currentStats.totalSales >= category.requiredSales;

            if (isUnlocked) {
                row.classList.remove('locked');
                row.querySelectorAll('.avatar-option').forEach(option => {
                    option.querySelector('.avatar-lock-overlay').style.display = 'none';
                    option.onclick = () => selectAvatar(option, modal);
                });

            } else {
                row.classList.add('locked');
                row.querySelectorAll('.avatar-option').forEach(option => {
                    option.querySelector('.avatar-lock-overlay').style.display = 'flex';
                    option.onclick = () => shakeLock(option);
                });
            }
        });

        modal.style.display = 'flex';
        updateSelectedAvatarUI();
    };

    function hydrateBadgeCarousels(scope) {
        const coverflows = scope.querySelectorAll('.badge-coverflow');
        coverflows.forEach(flow => {
            const badgeAttr = flow.dataset.badges || '';
            const badges = badgeAttr ? badgeAttr.split(',').map(decodeURIComponent).filter(Boolean) : [];
            if (badges.length === 0) return;
            const track = flow.querySelector('.coverflow-track');
            const stage = flow.querySelector('.coverflow-stage');
            if (!track || !stage) return;

            track.innerHTML = '';
            const slides = badges.map(badge => {
                const slide = document.createElement('div');
                slide.className = 'coverflow-slide';
                slide.innerHTML = renderBadgeIcon(badge);
                slide.dataset.badge = badge;
                track.appendChild(slide);
                return slide;
            });

            let currentIndex = 0;
            const total = slides.length;

            const updateSlides = () => {
                slides.forEach((slide, idx) => {
                    const offset = (idx - currentIndex + total) % total;
                    const isCenter = offset === 0;
                    let isLeft = false;
                    let isRight = false;
                    if (total >= 3) {
                        isLeft = offset === (total - 1);
                        isRight = offset === 1;
                    } else if (total === 2) {
                        isRight = offset === 1;
                    }

                    slide.classList.toggle('state-center', isCenter);
                    slide.classList.toggle('state-left', isLeft);
                    slide.classList.toggle('state-right', isRight);
                    slide.classList.toggle('state-hidden', !isCenter && !isLeft && !isRight);
                });
            };
            const shift = (dir) => {
                currentIndex = (currentIndex + dir + total) % total;
                updateSlides();
            };
            flow.querySelectorAll('.coverflow-nav').forEach(btn => {
                btn.onclick = () => {
                    const dir = parseInt(btn.dataset.dir, 10) || 0;
                    if (!dir) return;
                    shift(dir);
                };
            });
            let pointerActive = false;
            let startX = 0;
            const pointerDown = (evt) => {
                pointerActive = true;
                startX = evt.clientX ?? evt.touches?.[0]?.clientX ?? 0;
            };
            const pointerUp = (evt) => {
                if (!pointerActive) return;
                const endX = evt.clientX ?? evt.changedTouches?.[0]?.clientX ?? 0;
                const delta = endX - startX;
                if (Math.abs(delta) > 30) {
                    shift(delta < 0 ? 1 : -1);
                }
                pointerActive = false;
            };
            const pointerMove = (evt) => {
                if (!pointerActive) return;
                evt.preventDefault();
            };
            stage.addEventListener('pointerdown', pointerDown);
            stage.addEventListener('pointerup', pointerUp);
            stage.addEventListener('pointerleave', pointerUp);
            stage.addEventListener('pointermove', pointerMove);
            updateSlides();
        });
    }

    function selectAvatar(option, modalEl) {
        const img = option.querySelector('img');
        if (!img) return;
        // Brug den relative URL fra dataset i stedet for img.src (som er absolut)
        // Dette sikrer at URL'en matcher i updateSelectedAvatarUI()
        const avatarUrl = option.dataset.avatarUrl || img.src;
        // OPTIMERING: Brug updateAvatarStorage til at opdatere både localStorage og cache
        if (updateAvatarStorage) {
            updateAvatarStorage(clerkProfile.id, avatarUrl);
        } else {
            // Fallback hvis updateAvatarStorage ikke er tilgængelig
            localStorage.setItem(`${AVATAR_STORAGE_PREFIX}${clerkProfile.id}`, avatarUrl);
        }
        updateLoggedInUserDisplay();
        updateSelectedAvatarUI();

        // Opdater også avataren i "Min Flango"-vinduets header med det samme.
        const modalHeaderAvatar = modal.querySelector('.header-avatar-ring img') || modal.querySelector('.header-avatar');
        if (modalHeaderAvatar) {
            modalHeaderAvatar.src = avatarUrl;
        }
    }

    function showAvatarPreviewModal(imageUrls, startIndex = 0) {
        const previewModal = document.createElement('div');
        previewModal.className = 'avatar-preview-modal';
        previewModal.innerHTML = `
                <div class="avatar-preview-backdrop"></div>
                <div class="avatar-preview-content">
                    <button class="avatar-preview-nav prev" aria-label="Forrige avatar">‹</button>
                    <img src="" alt="Avatar i fuld størrelse" class="avatar-preview-full">
                    <button class="avatar-preview-nav next" aria-label="Næste avatar">›</button>
                    <button class="close-btn" aria-label="Luk">×</button>
                </div>
            `;
        document.body.appendChild(previewModal);

        const imgEl = previewModal.querySelector('.avatar-preview-full');
        let currentIndex = ((startIndex % imageUrls.length) + imageUrls.length) % imageUrls.length;

        const updateImage = () => {
            imgEl.src = imageUrls[currentIndex];
        };

        const navigate = (direction) => {
            currentIndex = (currentIndex + direction + imageUrls.length) % imageUrls.length;
            updateImage();
        };

        const closeModal = () => {
            document.removeEventListener('keydown', handleKeydown);
            previewModal.remove();
        };

        const handleKeydown = (evt) => {
            if (evt.key === 'ArrowRight') {
                navigate(1);
            } else if (evt.key === 'ArrowLeft') {
                navigate(-1);
            } else if (evt.key === 'Escape') {
                closeModal();
            }
        };

        previewModal.querySelector('.avatar-preview-nav.prev').onclick = (evt) => {
            evt.stopPropagation();
            navigate(-1);
        };
        previewModal.querySelector('.avatar-preview-nav.next').onclick = (evt) => {
            evt.stopPropagation();
            navigate(1);
        };
        previewModal.querySelector('.close-btn').onclick = closeModal;
        previewModal.querySelector('.avatar-preview-backdrop').onclick = closeModal;

        document.addEventListener('keydown', handleKeydown);
        updateImage();
        previewModal.style.display = 'flex';
    }

    function shakeLock(overlay) {
        playSound('error');
        overlay.classList.add('shake');
        overlay.addEventListener('animationend', () => {
            overlay.classList.remove('shake');
        }, { once: true });
    }
}
