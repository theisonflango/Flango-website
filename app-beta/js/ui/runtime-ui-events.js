export function setupRuntimeUIEvents({
    salesHistoryBtn,
    settingsHistoryBtn,
    assortmentModal,
    assortmentModalCloseBtn,
    soundSettingsModal,
    soundSettingsModalCloseBtn,
    editMenuOriginalBtn,
    productModal,
    modalProductList,
    getAllProducts,
    renderProductsInModal,
    openSoundSettingsModal,
    showSalesHistory,
    settingsMinFlangoStatusBtn,
    showAlert,
}) {
    if (salesHistoryBtn) {
        salesHistoryBtn.addEventListener('click', showSalesHistory);
    }
    if (settingsHistoryBtn) {
        settingsHistoryBtn.addEventListener('click', () => showSalesHistory());
    }

    if (assortmentModal && assortmentModalCloseBtn) {
        assortmentModalCloseBtn.addEventListener('click', () => assortmentModal.style.display = 'none');
        assortmentModal.addEventListener('click', (event) => {
            if (event.target === assortmentModal) {
                assortmentModal.style.display = 'none';
            }
        });
    }
    if (soundSettingsModal && soundSettingsModalCloseBtn) {
        soundSettingsModalCloseBtn.addEventListener('click', () => soundSettingsModal.style.display = 'none');
        soundSettingsModal.addEventListener('click', (event) => {
            if (event.target === soundSettingsModal) {
                soundSettingsModal.style.display = 'none';
            }
        });
    }

    if (editMenuOriginalBtn && productModal && renderProductsInModal && getAllProducts) {
        editMenuOriginalBtn.addEventListener('click', () => {
            renderProductsInModal(getAllProducts(), modalProductList);
            productModal.style.display = 'flex';
        });
    }

    const openFlangoStatusModal = () => {
        if (typeof window.__flangoOpenAvatarPicker === 'function') {
            window.__flangoOpenAvatarPicker();
        } else if (showAlert) {
            showAlert('Status-visningen er ikke klar.');
        }
    };
    if (settingsMinFlangoStatusBtn) {
        settingsMinFlangoStatusBtn.addEventListener('click', () => openFlangoStatusModal());
    }

    window.__flangoOpenSoundSettingsModal = () => {
        openSoundSettingsModal();
    };
    window.__flangoOpenSalesHistory = () => showSalesHistory();
}
