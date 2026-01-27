// UI-modul: Café Event Mini-Strip
// Viser arrangementer som små kort over produktgrid.

import { escapeHtml } from '../core/escape-html.js';
import {
    fetchCafeEventsForChild,
    invalidateCafeEventsCache,
    getCafeEventSettings,
    cafeRegisterForEvent,
    cafePayExistingRegistration,
    formatTime,
} from '../domain/cafe-events.js';
import { showCustomAlert } from './sound-and-alerts.js';
import { updateCustomerBalanceGlobally } from '../core/balance-manager.js';

// ============================================================================
// State
// ============================================================================
let currentEvents = [];
let currentChildId = null;
let currentInstitutionId = null;
let stripVisible = false;

// Callback til at tilføje event til kurv (sættes fra app-main)
let onEventAddedToCart = null;
let onEventRegistered = null;

// ============================================================================
// Formatering
// ============================================================================

function formatDateShort(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T00:00:00');
    const day = d.getDate();
    const months = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
    return `${day}. ${months[d.getMonth()]}`;
}

function formatPriceShort(price) {
    const p = parseFloat(price);
    if (!p || p === 0) return 'Gratis';
    return `${p.toFixed(0)} kr.`;
}

function renderProgressBar(registered, capacity) {
    if (!capacity || capacity <= 0) {
        return `<span class="cafe-event-capacity-text">${registered} tilmeldt</span>`;
    }
    const pct = Math.min(100, Math.round((registered / capacity) * 100));
    const remaining = Math.max(0, capacity - registered);
    const barClass = remaining === 0 ? 'full' : pct >= 80 ? 'almost-full' : '';
    return `
        <div class="cafe-event-progress">
            <div class="cafe-event-progress-bar ${barClass}" style="width: ${pct}%"></div>
        </div>
        <span class="cafe-event-capacity-text">${registered}/${capacity}</span>
    `;
}

// ============================================================================
// Render
// ============================================================================

function renderStrip(events, container) {
    container.innerHTML = '';

    if (!events || events.length === 0) {
        hideStrip();
        return;
    }

    const fragment = document.createDocumentFragment();

    events.forEach(event => {
        const card = document.createElement('div');
        card.className = 'cafe-event-card';
        card.dataset.eventId = event.id;

        // States
        const isRegistered = event.is_registered;
        const isFull = event.is_full;
        const payStatus = event.child_registration?.payment_status;
        const isAwaitingPayment = isRegistered && payStatus === 'not_paid';
        const isPaidOrFree = isRegistered && !isAwaitingPayment;
        // Awaiting payment = orange + clickable, paid = green + disabled, full = grey + disabled
        const isDisabled = isPaidOrFree || (isFull && !isRegistered);

        if (isAwaitingPayment) card.classList.add('awaiting-payment');
        else if (isPaidOrFree) card.classList.add('registered');
        if (isFull && !isRegistered) card.classList.add('full');
        if (isDisabled) card.classList.add('disabled');

        // Badge
        let badgeHtml = '';
        if (isAwaitingPayment) {
            badgeHtml = `<span class="cafe-event-badge awaiting-payment">Afventer betaling</span>`;
        } else if (isPaidOrFree) {
            badgeHtml = `<span class="cafe-event-badge registered">Tilmeldt · Betalt</span>`;
        } else if (isFull) {
            badgeHtml = `<span class="cafe-event-badge full">Fuldt</span>`;
        }

        const priceText = formatPriceShort(event.price);
        const dateText = formatDateShort(event.event_date);
        const timeText = formatTime(event.start_time);

        card.innerHTML = `
            <div class="cafe-event-card-top">
                <span class="cafe-event-title">${escapeHtml(event.title)}</span>
                ${badgeHtml}
            </div>
            <div class="cafe-event-card-mid">
                <span class="cafe-event-datetime">${dateText} kl. ${timeText}</span>
                <span class="cafe-event-price">${priceText}</span>
            </div>
            <div class="cafe-event-card-bottom">
                ${renderProgressBar(event.registered_count, event.capacity)}
            </div>
        `;

        fragment.appendChild(card);
    });

    container.appendChild(fragment);
    showStrip();
}

function showStrip() {
    const strip = document.getElementById('cafe-event-strip');
    const productsArea = document.getElementById('products-area');
    if (strip) strip.classList.add('visible');
    if (productsArea) productsArea.classList.add('event-strip-active');
    stripVisible = true;
}

function hideStrip() {
    const strip = document.getElementById('cafe-event-strip');
    const productsArea = document.getElementById('products-area');
    if (strip) {
        strip.classList.remove('visible');
        strip.innerHTML = '';
    }
    if (productsArea) productsArea.classList.remove('event-strip-active');
    stripVisible = false;
}

// ============================================================================
// Event handlers
// ============================================================================

async function handleEventCardClick(event) {
    const card = event.target.closest('.cafe-event-card');
    if (!card || card.classList.contains('disabled')) return;

    const eventId = card.dataset.eventId;
    const eventData = currentEvents.find(e => e.id === eventId);
    if (!eventData) return;

    // Tilføj event som item i kurven
    if (onEventAddedToCart) {
        const isAwaitingPayment = eventData.is_registered && eventData.child_registration?.payment_status === 'not_paid';
        onEventAddedToCart({
            type: 'event',
            eventId: eventData.id,
            name: eventData.title,
            price: parseFloat(eventData.price) || 0,
            event_date: eventData.event_date,
            start_time: eventData.start_time,
            capacity: eventData.capacity,
            registered_count: eventData.registered_count,
            // Hvis allerede tilmeldt men ikke betalt: send registration_id til payment-only flow
            paymentOnly: isAwaitingPayment,
            registrationId: isAwaitingPayment ? eventData.child_registration?.registration_id : null,
        });
    }
}

// ============================================================================
// Checkout: Håndter event items fra kurven
// ============================================================================

/**
 * Processerer event-items fra kurven separat fra normalvarer.
 * Viser dialog pr event: "Betal nu" eller "Betal senere"
 *
 * @param {Array} eventItems - Event items fra kurven [{ type:'event', eventId, name, price }]
 * @param {object} customer - Valgt barn
 * @returns {Promise<{ processed: Array, errors: Array }>}
 */
export async function processEventItemsInCheckout(eventItems, customer) {
    const processed = [];
    const errors = [];

    for (const item of eventItems) {
        const price = parseFloat(item.price) || 0;
        const isFree = price === 0;

        // === PAYMENT-ONLY: Allerede tilmeldt, mangler kun betaling ===
        if (item.paymentOnly && item.registrationId) {
            const confirmed = await showCustomAlert(
                `Betal: ${escapeHtml(item.name)}`,
                `<strong>${escapeHtml(customer.name)}</strong> er allerede tilmeldt "${escapeHtml(item.name)}".<br><br>` +
                `Pris: <strong>${price.toFixed(2)} kr.</strong><br><br>` +
                `Vil du betale nu (trækkes fra saldo)?`,
                { type: 'confirm', okText: 'Betal Nu', cancelText: 'Annuller' }
            );
            if (!confirmed) continue;

            const payResult = await cafePayExistingRegistration(item.registrationId);

            if (!payResult.success) {
                errors.push({ item, error: payResult.error });
                await showCustomAlert('Fejl', `Betaling for "${escapeHtml(item.name)}" fejlede: ${escapeHtml(payResult.error || 'Ukendt fejl')}`);
                continue;
            }

            if (payResult.new_balance !== undefined) {
                updateCustomerBalanceGlobally(customer.id, payResult.new_balance, -price, 'event-payment', { status: 'confirmed' });
            }

            processed.push({ item, result: payResult });
            await showCustomAlert('Betalt', `${escapeHtml(customer.name)} har betalt for "${escapeHtml(item.name)}".`);
            continue;
        }

        // === NY TILMELDING ===
        let payNow = false;

        if (isFree) {
            // Gratis event: registrer direkte
            payNow = true;
        } else {
            // Vis dialog: betal nu eller senere?
            const choice = await showCustomAlert(
                `Tilmelding: ${escapeHtml(item.name)}`,
                `<strong>${escapeHtml(customer.name)}</strong> tilmeldes "${escapeHtml(item.name)}".<br><br>` +
                `Pris: <strong>${price.toFixed(2)} kr.</strong><br><br>` +
                `Vil du betale nu (trækkes fra saldo) eller senere?`,
                { type: 'confirm', okText: 'Betal Nu', cancelText: 'Betal Senere' }
            );
            payNow = choice === true;
        }

        // Registrer
        const result = await cafeRegisterForEvent(item.eventId, customer.id, payNow);

        if (!result.success) {
            errors.push({ item, error: result.error });
            await showCustomAlert('Fejl', `Kunne ikke tilmelde ${escapeHtml(customer.name)} til "${escapeHtml(item.name)}": ${escapeHtml(result.error || 'Ukendt fejl')}`);
            continue;
        }

        // Opdater saldo hvis betalt
        if (result.payment_status === 'paid' && result.new_balance !== undefined) {
            updateCustomerBalanceGlobally(customer.id, result.new_balance, -price, 'event-payment', { status: 'confirmed' });
        } else if (result.payment_error) {
            await showCustomAlert(
                'Tilmeldt (betaling fejlede)',
                `${escapeHtml(customer.name)} er tilmeldt "${escapeHtml(item.name)}", men betalingen fejlede: ${escapeHtml(result.payment_error)}<br>Betalingsstatus: Afventer.`
            );
        }

        processed.push({ item, result });

        // Vis bekræftelse
        const statusText = isFree ? 'tilmeldt' : result.payment_status === 'paid' ? 'tilmeldt og betalt' : 'tilmeldt (betaling afventer)';
        await showCustomAlert('Tilmeldt', `${escapeHtml(customer.name)} er ${statusText} til "${escapeHtml(item.name)}".`);
    }

    // Invalidér cache (strip skjules af purchaseHandler, så refresh er unødvendig her)
    invalidateCafeEventsCache(customer.id);

    return { processed, errors };
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Initialiserer café event strip.
 * @param {object} config
 * @param {function} config.onEventAddedToCart - Callback når event tilføjes kurv
 * @param {function} config.onEventRegistered - Callback efter event er registreret
 */
export function initCafeEventStrip(config = {}) {
    onEventAddedToCart = config.onEventAddedToCart || null;
    onEventRegistered = config.onEventRegistered || null;

    const strip = document.getElementById('cafe-event-strip');
    if (strip) {
        strip.addEventListener('click', handleEventCardClick);
    }
}

/**
 * Refresher event strip for et valgt barn.
 * @param {object} params
 * @param {string} params.institutionId
 * @param {string} params.childId
 * @param {number|null} params.childGradeLevel
 */
export async function refreshCafeEventStrip({ institutionId, childId, childGradeLevel }) {
    const strip = document.getElementById('cafe-event-strip');
    if (!strip) return;

    currentChildId = childId;
    currentInstitutionId = institutionId;

    if (!childId || !institutionId) {
        hideStrip();
        currentEvents = [];
        return;
    }

    // Tjek om feature er slået til
    const settings = await getCafeEventSettings(institutionId);
    if (!settings.cafe_events_enabled) {
        hideStrip();
        currentEvents = [];
        return;
    }

    const { events, error } = await fetchCafeEventsForChild({
        institutionId,
        childId,
        childGradeLevel,
        daysAhead: settings.cafe_events_days_ahead,
    });

    if (error) {
        console.warn('[cafe-event-strip] Fejl ved hentning af events:', error);
        hideStrip();
        currentEvents = [];
        return;
    }

    currentEvents = events;
    renderStrip(events, strip);
}

/**
 * Skjuler event strip (fx når ingen bruger er valgt).
 */
export function hideCafeEventStrip() {
    hideStrip();
    currentEvents = [];
    currentChildId = null;
}

/**
 * Returnerer om strip er synlig.
 */
export function isCafeEventStripVisible() {
    return stripVisible;
}
