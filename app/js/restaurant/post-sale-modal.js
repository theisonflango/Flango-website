/**
 * Post-sale modal for Restaurant Mode.
 * Shows after a successful sale when restaurant_mode_enabled = true.
 * Allows waiter to add table number and kitchen note.
 */
import { supabaseClient } from '../core/config-and-supabase.js?v=3.0.69';
import { escapeHtml } from '../core/escape-html.js?v=3.0.69';
import { getProductIconInfo } from '../domain/products-and-cart.js?v=3.0.69';

/**
 * Show the restaurant post-sale modal if restaurant mode is enabled.
 * @param {string} institutionId
 * @param {object} customer - { id, name, emoji, ... }
 * @param {Array} orderSnapshot - order items with name, price, quantity, emoji, etc.
 * @returns {Promise<void>}
 */
export async function showRestaurantPostSaleModal(institutionId, customer, orderSnapshot) {
    // Check if restaurant mode is enabled (institution + per-enhed)
    const inst = window.__flangoGetInstitutionById?.(institutionId);
    const deviceRestaurantMode = localStorage.getItem('flango_device_restaurant_mode') === 'true';
    if (!inst?.restaurant_mode_enabled || !deviceRestaurantMode) return;

    // Fetch the most recent sale for this customer to get sale_id
    const { data: recentSale } = await supabaseClient
        .from('sales')
        .select('id')
        .eq('institution_id', institutionId)
        .eq('customer_id', customer.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

    const saleId = recentSale?.id;
    if (!saleId) {
        console.warn('[restaurant] Could not find recent sale for post-sale modal');
        return;
    }

    const showTableNumber = inst.restaurant_table_numbers_enabled === true;

    return new Promise((resolve) => {
        // Build modal DOM
        const backdrop = document.createElement('div');
        backdrop.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:10000;display:flex;align-items:center;justify-content:center;padding:16px;';

        const modal = document.createElement('div');
        modal.style.cssText = 'background:white;border-radius:20px;max-width:420px;width:100%;max-height:90vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,0.3);';

        // Header
        const header = document.createElement('div');
        header.style.cssText = 'padding:20px 24px 12px;text-align:center;';
        header.innerHTML = `
            <div style="font-size:28px;margin-bottom:4px;">🍽️</div>
            <div style="font-size:18px;font-weight:700;color:#1f2937;">Send til køkkenet</div>
            <div style="font-size:14px;color:#6b7280;margin-top:4px;">${escapeHtml(customer.name || 'Ukendt kunde')}</div>
        `;

        // Order summary
        const itemsSummary = document.createElement('div');
        itemsSummary.style.cssText = 'padding:0 24px 12px;';

        // Group items by product
        const grouped = {};
        for (const item of orderSnapshot) {
            const key = item.product_id || item.id || item.name;
            if (!grouped[key]) {
                grouped[key] = { ...item, quantity: 0 };
            }
            grouped[key].quantity += (item.quantity || 1);
        }

        let itemsHtml = '<div style="display:flex;flex-direction:column;gap:6px;">';
        for (const item of Object.values(grouped)) {
            const iconInfo = getProductIconInfo?.(item) || {};
            const iconHtml = iconInfo.iconUrl
                ? `<img src="${iconInfo.iconUrl}" style="width:24px;height:24px;border-radius:4px;" alt="">`
                : `<span style="font-size:18px;">${item.emoji || '🍽️'}</span>`;
            const qty = item.quantity > 1 ? ` x${item.quantity}` : '';
            itemsHtml += `<div style="display:flex;align-items:center;gap:8px;padding:6px 10px;background:#f9fafb;border-radius:8px;">
                ${iconHtml}
                <span style="flex:1;font-size:14px;color:#374151;">${escapeHtml(item.name || 'Produkt')}${qty}</span>
            </div>`;
        }
        itemsHtml += '</div>';
        itemsSummary.innerHTML = itemsHtml;

        // Form fields
        const form = document.createElement('div');
        form.style.cssText = 'padding:8px 24px 16px;display:flex;flex-direction:column;gap:12px;';

        let formHtml = '';
        if (showTableNumber) {
            formHtml += `
                <div>
                    <label style="font-size:13px;font-weight:600;color:#374151;margin-bottom:4px;display:block;">Bordnummer</label>
                    <input type="text" id="restaurant-table-input" maxlength="20" placeholder="Bordnummer (valgfrit)"
                        style="width:100%;padding:12px 14px;border:2px solid #e5e7eb;border-radius:10px;font-size:15px;box-sizing:border-box;outline:none;transition:border-color 0.2s;"
                        onfocus="this.style.borderColor='#f59e0b'" onblur="this.style.borderColor='#e5e7eb'">
                </div>`;
        }
        formHtml += `
            <div>
                <label style="font-size:13px;font-weight:600;color:#374151;margin-bottom:4px;display:block;">Besked til køkkenet</label>
                <textarea id="restaurant-note-input" maxlength="200" rows="2" placeholder="Besked til køkkenet (valgfrit)"
                    style="width:100%;padding:12px 14px;border:2px solid #e5e7eb;border-radius:10px;font-size:15px;box-sizing:border-box;resize:none;outline:none;transition:border-color 0.2s;font-family:inherit;"
                    onfocus="this.style.borderColor='#f59e0b'" onblur="this.style.borderColor='#e5e7eb'"></textarea>
            </div>`;
        form.innerHTML = formHtml;

        // Buttons
        const buttons = document.createElement('div');
        buttons.style.cssText = 'padding:8px 24px 24px;display:flex;gap:10px;';
        buttons.innerHTML = `
            <button id="restaurant-skip-btn" style="flex:1;padding:14px;background:#f3f4f6;color:#4b5563;border:none;border-radius:12px;font-size:15px;font-weight:600;cursor:pointer;">Spring over</button>
            <button id="restaurant-send-btn" style="flex:1;padding:14px;background:linear-gradient(135deg,#f59e0b,#d97706);color:white;border:none;border-radius:12px;font-size:15px;font-weight:700;cursor:pointer;">Send til køkken</button>
        `;

        modal.appendChild(header);
        modal.appendChild(itemsSummary);
        modal.appendChild(form);
        modal.appendChild(buttons);
        backdrop.appendChild(modal);
        document.body.appendChild(backdrop);

        // Auto-focus table number or note
        requestAnimationFrame(() => {
            const firstInput = modal.querySelector('#restaurant-table-input') || modal.querySelector('#restaurant-note-input');
            if (firstInput) firstInput.focus();
        });

        const cleanup = () => {
            backdrop.remove();
            resolve();
        };

        // Skip button
        modal.querySelector('#restaurant-skip-btn').addEventListener('click', cleanup);

        // Send button
        modal.querySelector('#restaurant-send-btn').addEventListener('click', async () => {
            const sendBtn = modal.querySelector('#restaurant-send-btn');
            sendBtn.disabled = true;
            sendBtn.textContent = 'Sender...';

            const tableNumber = modal.querySelector('#restaurant-table-input')?.value?.trim() || null;
            const kitchenNote = modal.querySelector('#restaurant-note-input')?.value?.trim() || null;

            if (tableNumber || kitchenNote) {
                try {
                    await supabaseClient.rpc('update_sale_restaurant_info', {
                        p_sale_id: saleId,
                        p_institution_id: institutionId,
                        p_table_number: tableNumber,
                        p_kitchen_note: kitchenNote,
                    });
                } catch (err) {
                    console.error('[restaurant] Error updating sale info:', err);
                }
            }

            // Brief confirmation
            sendBtn.textContent = '✓ Sendt!';
            sendBtn.style.background = 'linear-gradient(135deg, #10b981, #059669)';
            setTimeout(cleanup, 600);
        });

        // Escape key
        const onKey = (e) => {
            if (e.key === 'Escape') {
                document.removeEventListener('keydown', onKey);
                cleanup();
            }
        };
        document.addEventListener('keydown', onKey);
    });
}
