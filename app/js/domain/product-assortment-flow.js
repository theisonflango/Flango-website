import { getCurrentCustomer } from './cafe-session-store.js';
import { applyProductLimitsToButtons, getProductIconInfo } from './products-and-cart.js';

export function setupProductAssortmentFlow({
    adminProfile,
    supabaseClient,
    showAlert,
    getAllProducts,
    setAllProducts,
    getCurrentOrder,
    productsContainer,
    orderList,
    totalPriceEl,
    updateSelectedUserInfo,
    renderProductsGrid,
    renderProductsInModal,
    modalProductList,
    assortmentModal,
    parentPortalAdminUI,
    addToOrder,
}) {
    async function fetchAndRenderProducts() {
        const { data, error } = await supabaseClient
            .from('products')
            .select('*')
            .eq('institution_id', adminProfile.institution_id)
            .order('sort_order');
        if (error) {
            showAlert('Fejl ved hentning af produkter: ' + error.message);
            return;
        }
        setAllProducts(data);
        const allProducts = getAllProducts();
        const childId = getCurrentCustomer()?.id || null;
        renderProductsGrid(
            allProducts,
            productsContainer,
            async (product, evt) => {
                const result = await addToOrder(product, getCurrentOrder(), orderList, totalPriceEl, updateSelectedUserInfo, { sourceEvent: evt });
                // VIGTIGT: Brug altid den opdaterede kurv her, og hent childId på ny.
                const currentChildId = getCurrentCustomer()?.id || null;
                await applyProductLimitsToButtons(allProducts, productsContainer, getCurrentOrder(), currentChildId);
                return result;
            }
        );
        // Sørg for at alle knapper har et låse-overlay, så CSS kan virke
        productsContainer.querySelectorAll('.product-btn').forEach(btn => {
            if (!btn.querySelector('.product-lock-overlay')) {
                const overlay = document.createElement('div');
                // Brug BEGGE klasser for at matche både avatar- og produkt-specifikke regler
                overlay.className = 'avatar-lock-overlay product-lock-overlay';
                btn.appendChild(overlay);
            }
        });
        await applyProductLimitsToButtons(allProducts, productsContainer, getCurrentOrder(), childId);
        renderProductsInModal(allProducts, modalProductList);
    }

    function renderAssortmentModal() {
        const assortmentSettings = document.getElementById('assortment-settings');
        const assortmentList = document.getElementById('assortment-list');
        assortmentList.innerHTML = '';
        const sortedProducts = [...getAllProducts()].sort((a, b) => a.sort_order - b.sort_order);
        sortedProducts.forEach(product => {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'item';
            itemDiv.dataset.productId = product.id;
            const iconInfo = getProductIconInfo(product);
            const visualMarkup = iconInfo
                ? `<img src="${iconInfo.path}" alt="${product.name || 'Produkt'}" class="product-icon-small">`
                : `<span class="assortment-emoji">${product.emoji || '❓'}</span>`;
            itemDiv.innerHTML = `<label for="assortment-${product.id}">${visualMarkup} ${product.name}</label><input type="checkbox" id="assortment-${product.id}" data-product-id="${product.id}" ${product.is_visible !== false ? 'checked' : ''}>`;
            assortmentList.appendChild(itemDiv);
        });

        new Sortable(assortmentList, {
            animation: 150,
            ghostClass: 'sortable-ghost',
            onEnd: async (evt) => {
                const reorderedIds = Array.from(evt.target.children).map(item => item.dataset.productId);
                const updates = reorderedIds.map((id, index) => supabaseClient.from('products').update({ sort_order: index }).eq('id', id));
                await Promise.all(updates);
                await fetchAndRenderProducts();
            }
        });

        assortmentList.onclick = async (e) => {
            if (e.target.matches('input[type="checkbox"]')) {
                const productId = e.target.dataset.productId;
                const isVisible = e.target.checked;
                await supabaseClient.from('products').update({ is_visible: isVisible }).eq('id', productId);
                await fetchAndRenderProducts();
            }
        };
    }

    window.__flangoOpenAssortmentModal = () => {
        const assortmentSettings = document.getElementById('assortment-settings');
        if (!assortmentModal) {
            showAlert('Dagens sortiment kan ikke åbnes.');
            return;
        }
        if (parentPortalAdminUI && assortmentSettings) {
            parentPortalAdminUI.setupParentPortalSettings(assortmentSettings);
        }
        renderAssortmentModal();
        assortmentModal.style.display = 'flex';
    };

    return {
        fetchAndRenderProducts,
    };
}
