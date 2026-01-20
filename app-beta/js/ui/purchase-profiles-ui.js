/**
 * Purchase Profiles (Købsprofiler) - UI Module
 * 
 * Renders the user picker and 3D bar chart for purchase profiles.
 */

import {
    initPurchaseProfiles,
    getSelectedUserId,
    setSelectedUserId,
    getPeriod,
    setPeriod,
    getSortBy,
    setSortBy,
    getChartData,
    formatKr
} from '../domain/purchase-profiles.js';

// ============================================================
// STATE
// ============================================================================================
let _getAllUsers = null;
let _isInitialized = false;

// ============================================================
// INITIALIZATION
// ============================================================

/**
 * Initialize the Purchase Profiles UI module
 * @param {object} options - Configuration options
 * @param {function} options.getAllUsers - Function to get all users
 * @param {string} options.institutionId - Institution ID
 */
export function setupPurchaseProfilesUI({ getAllUsers, institutionId }) {
    if (!getAllUsers || !institutionId) {
        console.warn('[purchase-profiles-ui] Missing required options');
        return;
    }
    
    _getAllUsers = getAllUsers;
    initPurchaseProfiles(institutionId);
    _isInitialized = true;
    
    // Set up event listeners
    setupEventListeners();
    
    console.log('[purchase-profiles-ui] Initialized');
}

/**
 * Set up DOM event listeners
 */
function setupEventListeners() {
    // User dropdown selector
    const userSelect = document.getElementById('purchase-profiles-user-select');
    if (userSelect) {
        userSelect.addEventListener('change', async () => {
            const userId = userSelect.value;
            if (userId) {
                const allUsers = _getAllUsers ? _getAllUsers() : [];
                const user = allUsers.find(u => u.id === userId);
                if (user) {
                    await selectUser(user);
                }
            } else {
                // No user selected - show empty state
                setSelectedUserId(null);
                showEmptyState();
            }
        });
    }

    // Period selector
    const periodSelect = document.getElementById('purchase-profiles-period-select');
    if (periodSelect) {
        periodSelect.addEventListener('change', async () => {
            setPeriod(periodSelect.value);
            await refreshChart();
        });
    }

    // Sort toggle buttons
    const sortAntalBtn = document.getElementById('purchase-profiles-sort-antal');
    const sortKrBtn = document.getElementById('purchase-profiles-sort-kr');

    if (sortAntalBtn) {
        sortAntalBtn.addEventListener('click', async () => {
            if (getSortBy() !== 'antal') {
                setSortBy('antal');
                sortAntalBtn.classList.add('active');
                sortKrBtn?.classList.remove('active');
                await refreshChart();
            }
        });
    }

    if (sortKrBtn) {
        sortKrBtn.addEventListener('click', async () => {
            if (getSortBy() !== 'kr') {
                setSortBy('kr');
                sortKrBtn.classList.add('active');
                sortAntalBtn?.classList.remove('active');
                await refreshChart();
            }
        });
    }

    // Andre varer modal close
    const andreVarerModal = document.getElementById('andre-varer-modal');
    if (andreVarerModal) {
        const closeBtn = andreVarerModal.querySelector('.close-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                andreVarerModal.style.display = 'none';
            });
        }
        andreVarerModal.addEventListener('click', (e) => {
            if (e.target === andreVarerModal) {
                andreVarerModal.style.display = 'none';
            }
        });
    }
}

// ============================================================
// VIEW MANAGEMENT
// ============================================================

/**
 * Open the Purchase Profiles view
 */
export function openPurchaseProfilesView() {
    if (!_isInitialized) {
        console.warn('[purchase-profiles-ui] Not initialized');
        return;
    }

    const container = document.getElementById('purchase-profiles-view-container');
    if (!container) return;

    container.style.display = 'block';

    // Reset state
    setSelectedUserId(null);
    setPeriod('all');
    setSortBy('antal');

    // Reset UI
    const periodSelect = document.getElementById('purchase-profiles-period-select');
    if (periodSelect) periodSelect.value = 'all';

    const sortAntalBtn = document.getElementById('purchase-profiles-sort-antal');
    const sortKrBtn = document.getElementById('purchase-profiles-sort-kr');
    if (sortAntalBtn) sortAntalBtn.classList.add('active');
    if (sortKrBtn) sortKrBtn.classList.remove('active');

    // Populate user dropdown
    populateUserDropdown();

    // Reset user selection and show empty state
    const userSelect = document.getElementById('purchase-profiles-user-select');
    if (userSelect) userSelect.value = '';

    // Reset total
    const totalAmountEl = document.getElementById('purchase-profiles-total-amount');
    if (totalAmountEl) totalAmountEl.textContent = '0,00 kr';

    // Show empty state
    showEmptyState();
}

/**
 * Close/hide the Purchase Profiles view
 */
export function closePurchaseProfilesView() {
    const container = document.getElementById('purchase-profiles-view-container');
    if (container) {
        container.style.display = 'none';
    }
}

/**
 * Populate the user dropdown with all users
 */
function populateUserDropdown() {
    const userSelect = document.getElementById('purchase-profiles-user-select');
    if (!userSelect || !_getAllUsers) return;

    const allUsers = _getAllUsers();
    // Filter out admins, sort by name
    const users = allUsers
        .filter(u => u && u.role !== 'admin')
        .sort((a, b) => (a.name || '').localeCompare(b.name || ''));

    // Build options HTML
    let optionsHtml = '<option value="">Vælg bruger...</option>';
    users.forEach(user => {
        const name = user.name || 'Uden navn';
        const number = user.number ? ` #${user.number}` : '';
        optionsHtml += `<option value="${user.id}">${name}${number}</option>`;
    });

    userSelect.innerHTML = optionsHtml;
}

/**
 * Show the empty/initial state
 */
function showEmptyState() {
    const chartContainer = document.getElementById('purchase-profiles-chart');
    const emptyState = document.getElementById('purchase-profiles-empty');

    if (chartContainer) {
        chartContainer.style.display = 'none';
        chartContainer.innerHTML = '';
    }
    if (emptyState) {
        emptyState.style.display = 'flex';
    }
}

// ============================================================
// USER SELECTION
// ============================================================

/**
 * Select a user and show their purchase profile
 * @param {object} user - User object
 */
async function selectUser(user) {
    if (!user || !user.id) return;

    setSelectedUserId(user.id);

    // Fetch and render chart
    await refreshChart();
}

// ============================================================
// CHART RENDERING
// ============================================================

/**
 * Refresh the chart with current settings
 */
async function refreshChart() {
    const userId = getSelectedUserId();
    if (!userId) return;
    
    const period = getPeriod();
    const sortBy = getSortBy();
    
    const chartContainer = document.getElementById('purchase-profiles-chart');
    const emptyState = document.getElementById('purchase-profiles-empty');
    const totalAmountEl = document.getElementById('purchase-profiles-total-amount');
    
    // Show loading state
    if (chartContainer) {
        chartContainer.innerHTML = '<div class="purchase-profiles-loading">Henter data...</div>';
        chartContainer.style.display = 'flex';
    }
    if (emptyState) emptyState.style.display = 'none';
    
    // Fetch data
    const { total, chartData, error } = await getChartData(userId, period, sortBy);
    
    // Update total
    if (totalAmountEl) {
        totalAmountEl.textContent = formatKr(total);
    }
    
    if (error) {
        if (chartContainer) {
            chartContainer.innerHTML = `<div class="purchase-profiles-error">Fejl: ${error}</div>`;
        }
        return;
    }
    
    if (chartData.length === 0) {
        // Show empty state
        if (chartContainer) chartContainer.style.display = 'none';
        if (emptyState) emptyState.style.display = 'flex';
        return;
    }
    
    // Render chart
    renderChart(chartData, sortBy);
}

/**
 * Render the 3D bar chart
 * @param {Array} chartData - Array of chart items
 * @param {string} sortBy - 'antal' | 'kr'
 */
function renderChart(chartData, sortBy) {
    const container = document.getElementById('purchase-profiles-chart');
    const emptyState = document.getElementById('purchase-profiles-empty');
    
    if (!container) {
        console.error('[purchase-profiles] Chart container not found!');
        return;
    }
    
    if (emptyState) emptyState.style.display = 'none';
    
    // Apply container styles directly to ensure layout
    container.style.cssText = `
        display: flex !important;
        flex-direction: row !important;
        align-items: flex-end !important;
        justify-content: center !important;
        gap: 20px;
        padding: 40px 30px 100px;
        min-height: 380px;
        background: linear-gradient(180deg, #f8fafc 0%, #ffffff 100%);
        border-radius: 20px;
        border: 1px solid #e2e8f0;
    `;
    container.innerHTML = '';
    
    const fragment = document.createDocumentFragment();
    
    chartData.forEach((item, index) => {
        const bar = createChartBar(item, sortBy, index);
        fragment.appendChild(bar);
    });
    
    container.appendChild(fragment);
    
    // Trigger animation after DOM is ready
    // Use double requestAnimationFrame to ensure DOM has fully painted
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            const bars = container.querySelectorAll('.purchase-profiles-bar');
            bars.forEach((bar, i) => {
                setTimeout(() => {
                    // Get the final height from the CSS custom property
                    const finalHeight = bar.style.getPropertyValue('--final-height');
                    bar.style.height = finalHeight;
                    bar.classList.add('animate-in');
                }, i * 80);
            });
        });
    });
}

/**
 * Create a single bar element for the chart
 * @param {object} item - Chart item data
 * @param {string} sortBy - 'antal' | 'kr'
 * @param {number} index - Bar index for animation delay
 * @returns {HTMLElement}
 */
function createChartBar(item, sortBy, index) {
    const barWrapper = document.createElement('div');
    barWrapper.className = 'purchase-profiles-bar-wrapper';
    // Inline styles as fallback to ensure layout works
    barWrapper.style.cssText = `
        display: flex;
        flex-direction: column;
        align-items: center;
        position: relative;
        min-width: 55px;
        max-width: 80px;
        flex: 1;
    `;

    // Value label (above bar)
    const valueLabel = document.createElement('div');
    valueLabel.className = 'purchase-profiles-bar-value';
    valueLabel.textContent = item.displayValue;
    valueLabel.style.cssText = `
        font-size: 14px;
        font-weight: 800;
        color: #1e293b;
        margin-bottom: 8px;
        white-space: nowrap;
    `;

    // Calculate bar height: min 30px, max 200px based on normalized value
    const minHeight = 30;
    const maxHeight = 200;
    const calculatedHeight = minHeight + (item.normalizedHeight / 100) * (maxHeight - minHeight);

    // Cylinder color palettes for 3D effect
    const cylinderColors = [
        { bg: 'linear-gradient(90deg, #00838f 0%, #00bcd4 35%, #4dd0e1 50%, #00bcd4 65%, #00838f 100%)', shadow: '#006064', cap: 'linear-gradient(180deg, #80deea 0%, #26c6da 100%)' },
        { bg: 'linear-gradient(90deg, #1565c0 0%, #2196f3 35%, #64b5f6 50%, #2196f3 65%, #1565c0 100%)', shadow: '#0d47a1', cap: 'linear-gradient(180deg, #90caf9 0%, #42a5f5 100%)' },
        { bg: 'linear-gradient(90deg, #f9a825 0%, #ffc107 35%, #ffeb3b 50%, #ffc107 65%, #f9a825 100%)', shadow: '#f57f17', cap: 'linear-gradient(180deg, #fff59d 0%, #ffca28 100%)' },
        { bg: 'linear-gradient(90deg, #c2185b 0%, #e91e63 35%, #f06292 50%, #e91e63 65%, #c2185b 100%)', shadow: '#880e4f', cap: 'linear-gradient(180deg, #f8bbd9 0%, #ec407a 100%)' },
        { bg: 'linear-gradient(90deg, #6a1b9a 0%, #9c27b0 35%, #ba68c8 50%, #9c27b0 65%, #6a1b9a 100%)', shadow: '#4a148c', cap: 'linear-gradient(180deg, #ce93d8 0%, #ab47bc 100%)' },
        { bg: 'linear-gradient(90deg, #512da8 0%, #673ab7 35%, #9575cd 50%, #673ab7 65%, #512da8 100%)', shadow: '#311b92', cap: 'linear-gradient(180deg, #b39ddb 0%, #7e57c2 100%)' },
        { bg: 'linear-gradient(90deg, #00796b 0%, #009688 35%, #4db6ac 50%, #009688 65%, #00796b 100%)', shadow: '#004d40', cap: 'linear-gradient(180deg, #80cbc4 0%, #26a69a 100%)' },
        { bg: 'linear-gradient(90deg, #0277bd 0%, #03a9f4 35%, #4fc3f7 50%, #03a9f4 65%, #0277bd 100%)', shadow: '#01579b', cap: 'linear-gradient(180deg, #81d4fa 0%, #29b6f6 100%)' },
        { bg: 'linear-gradient(90deg, #ef6c00 0%, #ff9800 35%, #ffb74d 50%, #ff9800 65%, #ef6c00 100%)', shadow: '#e65100', cap: 'linear-gradient(180deg, #ffcc80 0%, #ffa726 100%)' },
        { bg: 'linear-gradient(90deg, #c62828 0%, #f44336 35%, #e57373 50%, #f44336 65%, #c62828 100%)', shadow: '#b71c1c', cap: 'linear-gradient(180deg, #ef9a9a 0%, #ef5350 100%)' },
        { bg: 'linear-gradient(90deg, #546e7a 0%, #78909c 35%, #b0bec5 50%, #78909c 65%, #546e7a 100%)', shadow: '#37474f', cap: 'linear-gradient(180deg, #cfd8dc 0%, #90a4ae 100%)' }
    ];
    const colorIndex = index % cylinderColors.length;
    const colors = cylinderColors[colorIndex];

    // The 3D bar (cylinder body)
    const bar = document.createElement('div');
    bar.className = 'purchase-profiles-bar';
    // Set the final height as a CSS custom property for animation
    bar.style.setProperty('--final-height', `${Math.round(calculatedHeight)}px`);
    // Apply base cylinder styles inline with color
    bar.style.cssText = `
        position: relative;
        width: 44px;
        height: 0;
        border-radius: 22px 22px 6px 6px;
        transition: height 0.8s cubic-bezier(0.34, 1.56, 0.64, 1);
        background: ${colors.bg};
        box-shadow: 4px 0 0 ${colors.shadow}, 0 8px 20px rgba(0,0,0,0.2);
        --final-height: ${Math.round(calculatedHeight)}px;
    `;

    // Add 3D cap (top ellipse)
    const cap = document.createElement('div');
    cap.style.cssText = `
        position: absolute;
        top: -8px;
        left: 0;
        width: 44px;
        height: 16px;
        border-radius: 50%;
        background: ${colors.cap};
        z-index: 3;
    `;
    bar.appendChild(cap);
    
    // Special click handler for "Andre varer"
    if (item.isAndreVarer) {
        bar.style.cursor = 'pointer';
        bar.addEventListener('click', () => openAndreVarerModal(item.subProducts));
    }
    
    // Tooltip (shown on hover)
    const tooltip = document.createElement('div');
    tooltip.className = 'purchase-profiles-bar-tooltip';
    tooltip.style.cssText = `
        position: absolute;
        bottom: calc(100% + 20px);
        left: 50%;
        transform: translateX(-50%);
        background: #1e293b;
        color: white;
        padding: 12px 16px;
        border-radius: 12px;
        font-size: 13px;
        white-space: nowrap;
        opacity: 0;
        visibility: hidden;
        pointer-events: none;
        transition: all 0.2s ease;
        z-index: 100;
        box-shadow: 0 10px 25px rgba(0,0,0,0.25);
    `;
    tooltip.innerHTML = `
        <div style="font-weight: 800; border-bottom: 1px solid rgba(255,255,255,0.2); padding-bottom: 4px; margin-bottom: 4px;">${item.name}</div>
        <div style="display: flex; justify-content: space-between; gap: 15px;"><span>Antal:</span> <span style="font-weight: 700;">${item.antal}</span></div>
        <div style="display: flex; justify-content: space-between; gap: 15px;"><span>Beløb:</span> <span style="font-weight: 700;">${formatKr(item.kr)}</span></div>
    `;
    bar.appendChild(tooltip);

    // Add hover effect for tooltip
    bar.addEventListener('mouseenter', () => {
        tooltip.style.opacity = '1';
        tooltip.style.visibility = 'visible';
    });
    bar.addEventListener('mouseleave', () => {
        tooltip.style.opacity = '0';
        tooltip.style.visibility = 'hidden';
    });
    
    // Product icon (below cylinder body)
    const iconContainer = document.createElement('div');
    iconContainer.className = 'purchase-profiles-bar-icon';
    iconContainer.style.cssText = `
        margin-top: 12px;
        width: 36px;
        height: 36px;
        background: white;
        border-radius: 10px;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 3px 10px rgba(0,0,0,0.08);
        border: 1px solid #e2e8f0;
    `;

    if (item.isDagensRet) {
        iconContainer.innerHTML = '<span style="font-size: 22px; line-height: 1;">🍽️</span>';
    } else if (item.isAndreVarer) {
        iconContainer.innerHTML = '<span style="font-size: 22px; line-height: 1;">📦</span>';
    } else if (item.icon) {
        // Use product icon
        if (item.icon.startsWith('http') || item.icon.startsWith('/') || item.icon.includes('.webp') || item.icon.includes('.png')) {
            iconContainer.innerHTML = `<img src="${item.icon}" alt="${item.name}" style="width: 26px; height: 26px; object-fit: contain;">`;
        } else {
            // Emoji
            iconContainer.innerHTML = `<span style="font-size: 22px; line-height: 1;">${item.icon}</span>`;
        }
    } else {
        iconContainer.innerHTML = '<span style="font-size: 22px; line-height: 1;">🛒</span>';
    }

    // Product name label (below icon)
    const nameLabel = document.createElement('div');
    nameLabel.className = 'purchase-profiles-bar-name';
    nameLabel.textContent = item.name;
    nameLabel.title = item.name;
    nameLabel.style.cssText = `
        margin-top: 8px;
        font-size: 12px;
        font-weight: 700;
        color: #475569;
        text-align: center;
        max-width: 70px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    `;
    
    // Append in order: value -> bar -> icon -> name
    barWrapper.appendChild(valueLabel);
    barWrapper.appendChild(bar);
    barWrapper.appendChild(iconContainer);
    barWrapper.appendChild(nameLabel);
    
    return barWrapper;
}

// ============================================================
// ANDRE VARER MODAL
// ============================================================

/**
 * Open the "Andre varer" detail modal
 * @param {Array} subProducts - Array of products in "Andre varer"
 */
function openAndreVarerModal(subProducts) {
    const modal = document.getElementById('andre-varer-modal');
    const listContainer = document.getElementById('andre-varer-list');
    
    if (!modal || !listContainer) return;
    
    if (!subProducts || subProducts.length === 0) {
        listContainer.innerHTML = '<p>Ingen produkter at vise.</p>';
    } else {
        // Sort by antal descending
        const sorted = [...subProducts].sort((a, b) => b.antal - a.antal);
        
        const html = sorted.map(p => `
            <div class="andre-varer-item">
                <span class="andre-varer-item-name">${p.name}</span>
                <span class="andre-varer-item-antal">Antal: ${p.antal}</span>
                <span class="andre-varer-item-kr">${formatKr(p.kr)}</span>
            </div>
        `).join('');
        
        listContainer.innerHTML = html;
    }
    
    modal.style.display = 'flex';
}

