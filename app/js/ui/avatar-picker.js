import { playSound } from './sound-and-alerts.js';
import {
    renderBadgeIcon,
    getStatsSummaryHTML,
    formatDurationWithSeconds,
    loadFlangoAdminStats,
    mergeRemoteStatsWithSession,
} from '../domain/stats-and-badges.js';

const AVATAR_URLS = [
    'https://jbknjgbpghrbrstqwoxj.supabase.co/storage/v1/object/public/Avatar/Ekspedient-dreng-1star.png',
    'https://jbknjgbpghrbrstqwoxj.supabase.co/storage/v1/object/public/Avatar/Ekspedient-dreng-2star.png',
    'https://jbknjgbpghrbrstqwoxj.supabase.co/storage/v1/object/public/Avatar/Ekspedient-dreng-3star.png',
    'https://jbknjgbpghrbrstqwoxj.supabase.co/storage/v1/object/public/Avatar/Ekspedient-dreng-basic1.png',
    'https://jbknjgbpghrbrstqwoxj.supabase.co/storage/v1/object/public/Avatar/Ekspedient-dreng-basic2.png',
    'https://jbknjgbpghrbrstqwoxj.supabase.co/storage/v1/object/public/Avatar/Ekspedient-default2.png',
    'https://jbknjgbpghrbrstqwoxj.supabase.co/storage/v1/object/public/Avatar/Ekspedient-pige-1star.png',
    'https://jbknjgbpghrbrstqwoxj.supabase.co/storage/v1/object/public/Avatar/Ekspedient-pige-2star.png',
    'https://jbknjgbpghrbrstqwoxj.supabase.co/storage/v1/object/public/Avatar/Ekspedient-pige-3star.png',
    'https://jbknjgbpghrbrstqwoxj.supabase.co/storage/v1/object/public/Avatar/Ekspedient-pige-3star-red.png',
    'https://jbknjgbpghrbrstqwoxj.supabase.co/storage/v1/object/public/Avatar/Ekspedient-pige-basic1.png',
    'https://jbknjgbpghrbrstqwoxj.supabase.co/storage/v1/object/public/Avatar/Ekspedient-pige-basic2.png',
    'https://jbknjgbpghrbrstqwoxj.supabase.co/storage/v1/object/public/Avatar/Ekspedient-pige-basic3.png',
    'https://jbknjgbpghrbrstqwoxj.supabase.co/storage/v1/object/public/Avatar/Ekspedient-dreng-legende1.png',
    'https://jbknjgbpghrbrstqwoxj.supabase.co/storage/v1/object/public/Avatar/Ekspedient-dreng-legende2.png',
    'https://jbknjgbpghrbrstqwoxj.supabase.co/storage/v1/object/public/Avatar/Ekspedient-pige-legende1.png',
    'https://jbknjgbpghrbrstqwoxj.supabase.co/storage/v1/object/public/Avatar/Ekspedient-legende1.png',
    'https://jbknjgbpghrbrstqwoxj.supabase.co/storage/v1/object/public/Avatar/Ekspedient-legende2.png',
    'https://jbknjgbpghrbrstqwoxj.supabase.co/storage/v1/object/public/Avatar/Ekspedient-legende3.png',
    'https://jbknjgbpghrbrstqwoxj.supabase.co/storage/v1/object/public/Avatar/Ekspedient-legende4.png',
    'https://jbknjgbpghrbrstqwoxj.supabase.co/storage/v1/object/public/Avatar/Ekspedient-legende5.png',
    'https://jbknjgbpghrbrstqwoxj.supabase.co/storage/v1/object/public/Avatar/Ekspedient-legende6.png',
];

export async function setupAvatarPicker(options) {
    const {
        clerkProfile,
        sessionStartTime,
        getSessionSalesCount,
        updateLoggedInUserDisplay,
    } = options || {};

    const modal = document.getElementById('avatar-picker-modal');
    if (!modal || !clerkProfile || !sessionStartTime || !getSessionSalesCount || !updateLoggedInUserDisplay) {
        return;
    }

    // Importer calculateCurrentStats dynamisk for at undgå cirkulære afhængigheder, hvis det er et problem
    const { calculateCurrentStats } = await import('../domain/stats-store.js');


    const summaryContainer = modal.querySelector('#avatar-picker-summary');
    const container = modal.querySelector('#avatar-carousel-container');
    const closeBtn = modal.querySelector('.close-btn');
    if (!container || !closeBtn) return;
    let liveDurationIntervalId = null;

    const stopLiveDurationTracker = () => {
        if (liveDurationIntervalId) {
            clearInterval(liveDurationIntervalId);
            liveDurationIntervalId = null;
        }
    };

    const startLiveDurationTracker = (baseTodayMinutes) => {
        stopLiveDurationTracker();
        const todayContainer = document.getElementById('stats-duration-today');
        if (!todayContainer) return;

        const baseTodaySeconds = Math.max(0, (baseTodayMinutes || 0) * 60);

        const updateTimerValues = (container, totalSeconds) => {
            const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
            const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
            const seconds = String(totalSeconds % 60).padStart(2, '0');
            container.querySelector('[data-unit="h"]').textContent = hours;
            container.querySelector('[data-unit="m"]').textContent = minutes;
            container.querySelector('[data-unit="s"]').textContent = seconds;
        };

        const computeTodaySeconds = () => {
            const now = new Date();
            const sessionElapsedSeconds = Math.max(0, Math.round((now - sessionStartTime) / 1000));
            return baseTodaySeconds + sessionElapsedSeconds;
        };

        updateTimerValues(todayContainer, computeTodaySeconds());

        liveDurationIntervalId = setInterval(() => {
            updateTimerValues(todayContainer, computeTodaySeconds());
        }, 1000);
    };

    closeBtn.onclick = () => {
        stopLiveDurationTracker();
        modal.style.display = 'none';
    };
    let avatarOptions = [];

    const AVATAR_STORAGE_PREFIX = 'flango-avatar-';
    const DEFAULT_AVATAR_URL = 'https://jbknjgbpghrbrstqwoxj.supabase.co/storage/v1/object/public/Avatar/Ekspedient-default2.png';

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
                            <img src="https://jbknjgbpghrbrstqwoxj.supabase.co/storage/v1/object/public/Function/Lock.png" alt="Låst">
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
            .duration-display-container {
                display: flex;
                flex-direction: column;
                align-items: flex-start;
                gap: 4px;
            }
            .live-timer {
                display: flex;
                gap: 4px;
                align-items: baseline;
                font-family: 'Roboto Mono', monospace;
                background-color: var(--background-color-offset);
                padding: 4px 8px;
                border-radius: 6px;
                border: 1px solid var(--border-color);
            }
            .time-segment {
                display: flex;
                flex-direction: column;
                align-items: center;
                line-height: 1;
            }
            .time-value {
                font-size: 1.4em;
                font-weight: 700;
                color: var(--primary-color);
            }
            .time-label {
                font-size: 0.7em;
                text-transform: uppercase;
                color: var(--text-color-muted);
            }
            .time-separator {
                font-size: 1.2em;
                font-weight: 700;
                color: var(--primary-color);
            }
            /* Ny stil for modal-headeren */
            #avatar-picker-modal .modal-header {
                display: flex;
                align-items: center;
                gap: 12px;
            }
            #avatar-picker-modal .header-avatar {
                width: 40px;
                height: 40px;
                border-radius: 50%;
                object-fit: cover;
                border: 2px solid var(--primary-color);
                background-color: var(--background-color);
            }

            /* --- Dashboard Grid Layout --- */
            .flango-status-grid {
                display: grid;
                grid-template-columns: 1fr 1fr;
                grid-auto-rows: 1fr; /* Sørger for at rækker har samme højde */
                gap: 20px;
                height: 78vh; /* Justerbar højde for hele dashboardet */
            }

            /* --- Card Base Style --- */
            .flango-status-card {
                background-color: var(--background-color);
                border: 1px solid var(--border-color);
                border-radius: 12px;
                padding: 16px;
                display: flex;
                flex-direction: column;
                box-shadow: 0 4px 12px rgba(0,0,0,0.05);
                transition: transform 0.2s ease-in-out;
            }
            .flango-status-card h3, .flango-status-card h4 {
                margin-top: 0;
            }

            /* --- Card Color Variations --- */
            .flango-status-card.card-a { background-color: #fff4e3; } /* Lys orange */
            .flango-status-card.card-b { background-color: #e3f2fd; } /* Lys blå */
            .flango-status-card.card-c { background-color: #e8f5e9; } /* Lys grøn */
            .flango-status-card.card-d { background-color: #f3e5f5; } /* Lys lilla */

            /* --- Scrollable Card Rules --- */
            .flango-status-card.scrollable {
                overflow-y: auto;
                max-height: 40vh; /* Max højde for de nederste kort */
            }

            /* --- Responsive Grid --- */
            @media (max-width: 1024px) {
                .flango-status-grid {
                    grid-template-columns: 1fr; /* Enkelt kolonne på mindre skærme */
                    height: auto;
                }
                .flango-status-card.scrollable {
                    max-height: 300px; /* Juster max-højde for scroll på mindre skærme */
                }
            }

            /* --- Specific Content Styling --- */
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
            .status-header-section {
                display: flex;
                align-items: flex-start;
                gap: 20px;
            }
            .status-header-section.vertical {
                flex-direction: column;
                align-items: center;
                text-align: center;
            }
            .status-avatar {
                width: 100px;
                height: 100px;
                object-fit: contain;
                flex-shrink: 0;
            }
            .status-avatar.hr-flango {
                margin-top: 16px;
            }
            .status-header-text {
                flex-grow: 1;
            }
            .status-header-text p {
                margin: 0 0 8px 0;
            }
            .stats-grid {
                display: grid;
                grid-template-columns: repeat(3, 1fr);
                gap: 8px;
                margin: 12px 0;
                text-align: center;
            }
            .stat-item {
                background-color: var(--background-color-offset);
                border-radius: 8px;
                padding: 8px;
                border: 1px solid var(--border-color);
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
            }
            .stat-value {
                font-size: 1.5em;
                font-weight: 700;
                color: var(--primary-color);
                line-height: 1.2;
            }
            .stat-label {
                font-size: 0.8em;
                color: var(--text-color-muted);
                text-transform: uppercase;
            }
            .product-summary-line {
                font-size: 0.9em;
                display: grid;
                grid-template-columns: 50px 25px 1fr auto;
                gap: 8px;
                align-items: center;
                padding: 4px 0;
                border-bottom: 1px solid var(--background-color-offset);
            }
            .product-summary-line .summary-price {
                font-weight: 600;
                text-align: right;
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

        // Opdater modal-titlen til "Min Flango" og indsæt den valgte avatar
        const modalHeader = modal.querySelector('.modal-header');
        if (modalHeader) {
            const headerTitle = modalHeader.querySelector('h2');
            if (headerTitle) {
                headerTitle.textContent = 'Min Flango';
            }
            // Fjern eventuel gammel avatar og tilføj den nye
            modalHeader.querySelector('.header-avatar')?.remove();
            const avatarImg = document.createElement('img');
            avatarImg.src = getCurrentAvatarSrc();
            avatarImg.className = 'header-avatar';
            modalHeader.prepend(avatarImg);
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
        localStorage.setItem(`${AVATAR_STORAGE_PREFIX}${clerkProfile.id}`, img.src);
        updateLoggedInUserDisplay();
        updateSelectedAvatarUI();

        // Opdater også avataren i "Min Flango"-vinduets header med det samme.
        const modalHeaderAvatar = modal.querySelector('.header-avatar');
        if (modalHeaderAvatar) {
            modalHeaderAvatar.src = img.src;
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
