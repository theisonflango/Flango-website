import { supabaseClient } from '../core/config-and-supabase.js';
import { getInstitutionId } from '../domain/session-store.js';

(function initAutoImport() {
    const modal = document.getElementById('auto-import-modal');
    const fileInput = document.getElementById('auto-import-file-input');
    const errorBox = document.getElementById('auto-import-error');
    const step1 = document.getElementById('auto-import-step-1');
    const step2 = document.getElementById('auto-import-step-2');
    const fileNameLabel = document.getElementById('auto-import-selected-file-name');
    const summaryEl = document.getElementById('auto-import-summary');
    const mappingNumber = document.getElementById('auto-import-field-number');
    const mappingName = document.getElementById('auto-import-field-name');
    const mappingBalance = document.getElementById('auto-import-field-balance');
    const mappingGrade = document.getElementById('auto-import-field-grade');
    const previewEl = document.getElementById('auto-import-preview');
    const cancelBtn = document.getElementById('auto-import-cancel-btn');
    const continueBtn = document.getElementById('auto-import-continue-btn');
    const closeBtn = document.getElementById('auto-import-close-btn');
    let selectedFile = null;
    let parsedFields = [];
    let parsedRows = [];
    let mappedRows = [];

    if (!modal) return;

    const showError = (msg) => {
        if (!errorBox) return;
        if (msg) {
            errorBox.textContent = msg;
            errorBox.style.display = 'block';
        } else {
            errorBox.textContent = '';
            errorBox.style.display = 'none';
        }
    };

    const showAutoImportSuccessDialog = (count) => {
        const existing = document.getElementById('auto-import-success-dialog-backdrop');
        if (existing) existing.remove();

        const backdrop = document.createElement('div');
        backdrop.id = 'auto-import-success-dialog-backdrop';
        backdrop.style.position = 'fixed';
        backdrop.style.inset = '0';
        backdrop.style.background = 'rgba(0,0,0,0.45)';
        backdrop.style.display = 'flex';
        backdrop.style.alignItems = 'center';
        backdrop.style.justifyContent = 'center';
        backdrop.style.zIndex = '100000';

        const dialog = document.createElement('div');
        dialog.style.background = '#ffffff';
        dialog.style.borderRadius = '18px';
        dialog.style.boxShadow = '0 12px 40px rgba(15,23,42,0.35)';
        dialog.style.maxWidth = '520px';
        dialog.style.width = '90%';
        dialog.style.padding = '28px 32px 24px 32px';
        dialog.style.position = 'relative';

        const headerBar = document.createElement('div');
        headerBar.style.position = 'absolute';
        headerBar.style.top = '0';
        headerBar.style.left = '0';
        headerBar.style.right = '0';
        headerBar.style.height = '6px';
        headerBar.style.borderTopLeftRadius = '18px';
        headerBar.style.borderTopRightRadius = '18px';
        headerBar.style.background = '#f97316';
        dialog.appendChild(headerBar);

        const title = document.createElement('h2');
        title.textContent = 'Success!';
        title.style.margin = '12px 0 12px 0';
        title.style.fontSize = '24px';
        title.style.fontWeight = '700';
        title.style.color = '#f97316';
        dialog.appendChild(title);

        const message = document.createElement('p');
        message.textContent = `Saldoer opdateret for ${count} brugere.`;
        message.style.margin = '0 0 24px 0';
        message.style.fontSize = '18px';
        message.style.color = '#111827';
        dialog.appendChild(message);

        const buttonRow = document.createElement('div');
        buttonRow.style.display = 'flex';
        buttonRow.style.justifyContent = 'center';
        dialog.appendChild(buttonRow);

        const okBtn = document.createElement('button');
        okBtn.textContent = 'OK';
        okBtn.style.minWidth = '120px';
        okBtn.style.padding = '10px 24px';
        okBtn.style.border = 'none';
        okBtn.style.borderRadius = '999px';
        okBtn.style.fontSize = '16px';
        okBtn.style.fontWeight = '600';
        okBtn.style.cursor = 'pointer';
        okBtn.style.background = '#16a34a';
        okBtn.style.color = '#ffffff';
        okBtn.onmouseenter = () => { okBtn.style.background = '#15803d'; };
        okBtn.onmouseleave = () => { okBtn.style.background = '#16a34a'; };
        buttonRow.appendChild(okBtn);

        const closeDialog = () => {
            backdrop.remove();
        };

        okBtn.addEventListener('click', closeDialog);
        backdrop.addEventListener('click', (evt) => {
            if (evt.target === backdrop) {
                closeDialog();
            }
        });

        backdrop.appendChild(dialog);
        document.body.appendChild(backdrop);
    };

    const openAutoImportModal = () => {
        modal.style.display = 'flex';
        selectedFile = null;
        parsedFields = [];
        parsedRows = [];
        mappedRows = [];
        if (step1) step1.style.display = 'block';
        if (step2) step2.style.display = 'none';
        if (fileNameLabel) fileNameLabel.textContent = '';
        if (summaryEl) summaryEl.textContent = '';
        if (mappingNumber) mappingNumber.innerHTML = '';
        if (mappingName) mappingName.innerHTML = '';
        if (mappingBalance) mappingBalance.innerHTML = '';
        if (mappingGrade) mappingGrade.innerHTML = '<option value="">(Ingen)</option>';
        if (previewEl) previewEl.innerHTML = '';
        if (fileInput) fileInput.value = '';
        showError('');
    };

    const closeAutoImportModal = () => {
        modal.style.display = 'none';
        selectedFile = null;
        parsedFields = [];
        parsedRows = [];
        mappedRows = [];
        if (step1) step1.style.display = 'block';
        if (step2) step2.style.display = 'none';
        if (fileNameLabel) fileNameLabel.textContent = '';
        if (summaryEl) summaryEl.textContent = '';
        if (mappingNumber) mappingNumber.innerHTML = '';
        if (mappingName) mappingName.innerHTML = '';
        if (mappingBalance) mappingBalance.innerHTML = '';
        if (mappingGrade) mappingGrade.innerHTML = '<option value="">(Ingen)</option>';
        if (previewEl) previewEl.innerHTML = '';
        if (fileInput) fileInput.value = '';
        showError('');
    };

    const guessField = (fields, type) => {
        const checks = {
            number: ['konto', 'kontonummer', 'number', 'nr', 'id'],
            name: ['navn', 'name', 'elev', 'barn'],
            balance: ['saldo', 'balance', 'beløb', 'amount'],
            grade_level: ['klasse', 'klassetrin', 'grade', 'class', 'årgang'],
        };
        const patterns = checks[type] || [];
        const lower = fields.map(f => (f || '').toLowerCase());
        for (let i = 0; i < lower.length; i++) {
            const f = lower[i];
            if (patterns.some(p => f.includes(p))) {
                return fields[i];
            }
        }
        return null;
    };

    const populateMappings = () => {
        const selects = [mappingNumber, mappingName, mappingBalance];
        selects.forEach(sel => {
            if (sel) sel.innerHTML = '';
        });
        // Grade select: behold default "(Ingen)" option
        if (mappingGrade) {
            mappingGrade.innerHTML = '<option value="">(Ingen)</option>';
        }
        parsedFields.forEach(field => {
            selects.forEach(sel => {
                if (sel) {
                    const opt = document.createElement('option');
                    opt.value = field;
                    opt.textContent = field;
                    sel.appendChild(opt);
                }
            });
            if (mappingGrade) {
                const opt = document.createElement('option');
                opt.value = field;
                opt.textContent = field;
                mappingGrade.appendChild(opt);
            }
        });
        const guessedNumber = guessField(parsedFields, 'number');
        const guessedName = guessField(parsedFields, 'name');
        const guessedBalance = guessField(parsedFields, 'balance');
        const guessedGrade = guessField(parsedFields, 'grade_level');
        if (mappingNumber && guessedNumber) mappingNumber.value = guessedNumber;
        if (mappingName && guessedName) mappingName.value = guessedName;
        if (mappingBalance && guessedBalance) mappingBalance.value = guessedBalance;
        if (mappingGrade && guessedGrade) mappingGrade.value = guessedGrade;
    };

    const buildMappedRows = () => {
        if (!parsedRows.length) return [];
        if (!mappingNumber || !mappingBalance) return [];
        const numberField = mappingNumber.value;
        const nameField = mappingName ? mappingName.value : null;
        const balanceField = mappingBalance.value;
        const gradeField = mappingGrade ? mappingGrade.value : '';
        if (!numberField || !balanceField) return [];

        const rows = [];
        for (const raw of parsedRows) {
            const number = (raw[numberField] ?? '').toString().trim();
            const name = nameField ? (raw[nameField] ?? '').toString().trim() : '';
            let balanceRaw = (raw[balanceField] ?? '').toString().trim();
            if (!number || !balanceRaw) continue;
            balanceRaw = balanceRaw.replace(',', '.');
            const balance = Number.parseFloat(balanceRaw);
            if (Number.isNaN(balance)) continue;
            let grade_level = null;
            if (gradeField) {
                const gradeRaw = (raw[gradeField] ?? '').toString().trim().replace(/\D/g, '');
                const parsed = parseInt(gradeRaw, 10);
                if (!isNaN(parsed) && parsed >= 0 && parsed <= 9) {
                    grade_level = parsed;
                }
            }
            rows.push({ number, name, new_balance: balance, grade_level });
        }
        return rows;
    };

    const renderPreview = () => {
        if (!previewEl) return;
        previewEl.innerHTML = '';
        if (!mappedRows.length) {
            previewEl.textContent = 'Ingen gyldige rækker blev fundet med den valgte mapping.';
            return;
        }
        const maxRows = Math.min(mappedRows.length, 5);
        const table = document.createElement('table');
        table.className = 'auto-import-preview-table';
        const thead = document.createElement('thead');
        const headRow = document.createElement('tr');
        ['Kontonummer', 'Navn', 'Klasse', 'Ny saldo'].forEach(label => {
            const th = document.createElement('th');
            th.textContent = label;
            headRow.appendChild(th);
        });
        thead.appendChild(headRow);
        table.appendChild(thead);
        const tbody = document.createElement('tbody');
        for (let i = 0; i < maxRows; i++) {
            const r = mappedRows[i];
            const tr = document.createElement('tr');
            const tdNumber = document.createElement('td');
            tdNumber.textContent = r.number;
            const tdName = document.createElement('td');
            tdName.textContent = r.name || '';
            const tdGrade = document.createElement('td');
            tdGrade.textContent = r.grade_level != null ? r.grade_level + '. kl.' : '—';
            const tdBalance = document.createElement('td');
            tdBalance.textContent = r.new_balance.toFixed(2).replace('.', ',');
            tr.appendChild(tdNumber);
            tr.appendChild(tdName);
            tr.appendChild(tdGrade);
            tr.appendChild(tdBalance);
            tbody.appendChild(tr);
        }
        table.appendChild(tbody);
        previewEl.appendChild(table);
        if (mappedRows.length > maxRows) {
            const more = document.createElement('p');
            more.textContent = `… og ${mappedRows.length - maxRows} flere rækker.`;
            previewEl.appendChild(more);
        }
    };

    const runAutoImport = async () => {
        if (!mappedRows.length) {
            showError('Der er ingen gyldige rækker at importere.');
            return;
        }

        const institutionId = getInstitutionId();
        if (!institutionId) {
            console.error('Auto-import: institution_id mangler (getInstitutionId() returnerede ingenting).');
            showError('Kunne ikke finde institutionen for den aktuelle admin (institution_id mangler).');
            return;
        }

        // Byg payload til users-tabellen med institution_id og rolle 'kunde'
        const payload = mappedRows.map((r) => {
            const row = {
                institution_id: institutionId,
                number: r.number,
                name: r.name || null,
                balance: r.new_balance,
                role: 'kunde',
            };
            if (r.grade_level != null) {
                row.grade_level = r.grade_level;
            }
            return row;
        });

        if (!payload.length) {
            showError('Der blev ikke fundet nogen gyldige rækker til import.');
            return;
        }

        showError('');
        console.log('Auto-import: upserter rækker i users...', payload);

        try {
            const { data, error } = await supabaseClient
                .from('users')
                .upsert(payload, { onConflict: 'institution_id,number,role' });

            if (error) {
                console.error('Auto-import: Supabase upsert-fejl:', error);
                showError('Fejl under opdatering af brugere. Se console for detaljer.');
                return;
            }

            console.log('Auto-import gennemført, opdaterede/indsatte rækker:', data);
            // --- Success popup (klassisk Flango-style) ---
            showAutoImportSuccessDialog(mappedRows.length);
            // --- Log to historik (dispatch event) ---
            document.dispatchEvent(new CustomEvent('flango-auto-import-completed', {
                detail: {
                    count: mappedRows.length,
                    timestamp: Date.now()
                }
            }));

            // --- Trigger user-list refresh (if listener exists elsewhere) ---
            document.dispatchEvent(new Event('flango-refresh-users'));

            closeAutoImportModal();
        } catch (e) {
            console.error('Auto-import: uventet fejl:', e);
            showError('Uventet fejl under auto-import. Prøv igen, eller kontakt en administrator.');
        }
    };

    const handleContinue = () => {
        // 4. trin: hvis vi allerede har et preview og mappedRows, så kør selve importen
        if (selectedFile && parsedFields.length && parsedRows.length && mappedRows.length) {
            runAutoImport();
            return;
        }

        // 3. trin: CSV er parsed, men der er endnu ikke bygget mappedRows → byg dem og vis preview
        if (selectedFile && parsedFields.length && parsedRows.length) {
            mappedRows = buildMappedRows();
            console.log('Auto-import mapped rows:', mappedRows);
            renderPreview();
            showError('');
            return;
        }

        // 1. trin: ingen fil valgt endnu → vælg fil og gå til step 2
        if (!selectedFile) {
            if (!fileInput || fileInput.files.length === 0) {
                showError('Vælg venligst en CSV- eller Excel-fil først.');
                return;
            }
            selectedFile = fileInput.files[0];
            console.log('Auto-import fil valgt:', selectedFile);
            showError('');
            if (step1) step1.style.display = 'none';
            if (step2) step2.style.display = 'block';
            if (fileNameLabel) fileNameLabel.textContent = `Valgt fil: ${selectedFile.name}`;
            return;
        }

        // 2. trin: fil er valgt, men endnu ikke parsed → kræv CSV og parse den
        const name = (selectedFile.name || '').toLowerCase();
        if (!name.endsWith('.csv')) {
            showError('I denne første version understøtter auto-import kun CSV-filer. Gem dokumentet som CSV og prøv igen.');
            return;
        }
        showError('');
        if (summaryEl) summaryEl.textContent = '';
        if (previewEl) previewEl.innerHTML = '';
        Papa.parse(selectedFile, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                console.log('Auto-import parse result:', results);
                console.log('Auto-import fields:', results.meta?.fields);
                console.log('Auto-import row count:', results.data?.length ?? 0);
                const fieldCount = Array.isArray(results.meta?.fields) ? results.meta.fields.length : 0;
                const rowCount = Array.isArray(results.data) ? results.data.length : 0;
                parsedFields = Array.isArray(results.meta?.fields) ? results.meta.fields : [];
                parsedRows = Array.isArray(results.data) ? results.data : [];
                mappedRows = [];
                if (summaryEl) {
                    summaryEl.textContent = `Fandt ${fieldCount} kolonner og ${rowCount} rækker i filen.`;
                }
                if (previewEl) previewEl.innerHTML = '';
                populateMappings();
            },
        });
    };

    // Event delegation for open button (since it comes from a template)
    document.addEventListener('click', (e) => {
        const btn = e.target && typeof e.target.closest === 'function'
            ? e.target.closest('#auto-import-open-btn')
            : null;
        if (btn) {
            openAutoImportModal();
        }
    });

    if (cancelBtn) cancelBtn.addEventListener('click', closeAutoImportModal);
    if (closeBtn) closeBtn.addEventListener('click', closeAutoImportModal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeAutoImportModal();
        }
    });
    if (continueBtn) continueBtn.addEventListener('click', handleContinue);
})();
