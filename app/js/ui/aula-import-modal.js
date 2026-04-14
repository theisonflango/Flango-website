/**
 * aula-import-modal.js
 * Bulk-import af profilbilleder fra Aula.
 * Matcher filnavne (format: "Fornavn E. (3A).webp") mod eksisterende brugere.
 *
 * Matching-strategi (prioriteret):
 *  1. Eksakt: fornavn + efternavn-initial + klassetrin → 100% match
 *  2. Fuzzy: fornavn-only (bruger har kun fornavn i DB) + klassetrin → kræver godkendelse
 *  3. Fuzzy: fornavn med bindestreg/mellemrum-normalisering + klassetrin → kræver godkendelse
 */

import { supabaseClient } from '../core/config-and-supabase.js?v=3.0.76';
import { getInstitutionId } from '../domain/session-store.js?v=3.0.76';
import { processImageForProfilePicture, uploadProfilePicture, saveToLibrary } from '../core/profile-picture-utils.js?v=3.0.76';
import { invalidateProfilePictureCache } from '../core/profile-picture-cache.js?v=3.0.76';
import { runWithAuthRetry } from '../core/auth-retry.js?v=3.0.76';

const BUCKET = 'profile-pictures';

/**
 * Parse Aula filename to extract matching info.
 * "Adrian H. (3A).webp" → { firstName: "Adrian", lastInitial: "H", gradeLevel: 3 }
 */
function parseAulaFilename(filename) {
    // Normalize to NFC — macOS filenames use NFD (decomposed accents), DB uses NFC
    const name = filename.normalize('NFC').replace(/\.(webp|jpg|jpeg|png)$/i, '');
    const match = name.match(/^(.+?)\s+(\p{L})\.\s*\((\d+)([A-Za-z]?)\)$/u);
    if (!match) return null;

    return {
        firstName: match[1].trim(),
        lastInitial: match[2].toUpperCase(),
        gradeLevel: parseInt(match[3], 10),
        classLetter: match[4]?.toUpperCase() || null,
        originalFilename: filename,
    };
}

/** Normalize name for comparison: NFC unicode, lowercase, replace hyphens with spaces, collapse whitespace */
function normalizeName(name) {
    return name.normalize('NFC').toLowerCase().replace(/-/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Match parsed file info against users list.
 * Returns: { type: 'exact'|'fuzzy'|'ambiguous'|'none', candidates: [], fuzzyReason?: string }
 */
function matchFileToUsers(parsed, users) {
    const parsedFirstNorm = normalizeName(parsed.firstName);

    // Pass 1: Exact match — fornavn + efternavn-initial + grade
    const exactCandidates = users.filter(u => {
        if (!u.name) return false;
        const parts = u.name.normalize('NFC').trim().split(/\s+/);
        if (parts.length < 2) return false;

        const userFirstName = parts[0].toLowerCase();
        if (userFirstName !== parsedFirstNorm.split(' ')[0] && normalizeName(parts[0]) !== parsedFirstNorm) return false;

        const userLastInitial = parts[parts.length - 1].charAt(0).toUpperCase();
        if (userLastInitial !== parsed.lastInitial) return false;

        if (u.grade_level != null && u.grade_level !== parsed.gradeLevel) return false;
        return true;
    });

    if (exactCandidates.length === 1) return { type: 'exact', candidates: exactCandidates };
    if (exactCandidates.length > 1) return { type: 'ambiguous', candidates: exactCandidates };

    // Pass 2: Fuzzy — bruger har kun fornavn (intet efternavn), match på fornavn + grade
    const firstNameOnlyCandidates = users.filter(u => {
        if (!u.name) return false;
        const parts = u.name.normalize('NFC').trim().split(/\s+/);
        if (parts.length !== 1) return false; // Kun brugere med ét navn-ord

        if (normalizeName(parts[0]) !== parsedFirstNorm.split(' ')[0]) return false;
        if (u.grade_level != null && u.grade_level !== parsed.gradeLevel) return false;
        return true;
    });

    if (firstNameOnlyCandidates.length === 1) {
        return { type: 'fuzzy', candidates: firstNameOnlyCandidates, fuzzyReason: 'Kun fornavn i DB' };
    }
    if (firstNameOnlyCandidates.length > 1) {
        return { type: 'ambiguous', candidates: firstNameOnlyCandidates, fuzzyReason: 'Flere med samme fornavn' };
    }

    // Pass 3: Fuzzy — bindestreg/mellemrum-normalisering for flerdelte fornavne
    const normalizedCandidates = users.filter(u => {
        if (!u.name) return false;
        const parts = u.name.normalize('NFC').trim().split(/\s+/);
        if (parts.length < 2) return false;

        // Sammenlign normaliseret fornavn (kan spænde flere ord)
        // Fx parsed "Francesca-Ioana" vs DB "Francesca ioana arghirescu"
        const possibleFirstNames = [];
        for (let i = 1; i <= Math.min(parts.length - 1, 3); i++) {
            possibleFirstNames.push(normalizeName(parts.slice(0, i).join(' ')));
        }

        if (!possibleFirstNames.includes(parsedFirstNorm)) return false;

        const userLastInitial = parts[parts.length - 1].charAt(0).toUpperCase();
        if (userLastInitial !== parsed.lastInitial) return false;

        if (u.grade_level != null && u.grade_level !== parsed.gradeLevel) return false;
        return true;
    });

    if (normalizedCandidates.length === 1) {
        return { type: 'fuzzy', candidates: normalizedCandidates, fuzzyReason: 'Navn-normalisering' };
    }
    if (normalizedCandidates.length > 1) {
        return { type: 'ambiguous', candidates: normalizedCandidates };
    }

    return { type: 'none', candidates: [] };
}

/**
 * Open the Aula import modal.
 */
export async function openAulaImportModal() {
    const institutionId = getInstitutionId();
    if (!institutionId) return;

    // Check om upload er aktiveret for institutionen
    const inst = window.__flangoGetInstitutionById?.(institutionId);
    const types = inst?.profile_picture_types || ['upload', 'camera', 'library'];
    if (!types.includes('upload')) {
        alert('Upload af profilbilleder er ikke aktiveret for denne institution.');
        return;
    }

    const { data: users, error } = await supabaseClient
        .from('users')
        .select('id, name, number, grade_level, role, profile_picture_url, profile_picture_type, profile_picture_opt_out_aula')
        .eq('institution_id', institutionId)
        .eq('role', 'kunde')
        .order('name');

    if (error) {
        console.error('[aula-import] Fejl ved hentning af brugere:', error);
        return;
    }

    let modal = document.getElementById('aula-import-modal');
    if (modal) modal.remove();

    modal = document.createElement('div');
    modal.id = 'aula-import-modal';
    modal.className = 'modal';
    modal.style.display = 'flex';
    modal.innerHTML = buildModalHTML();
    document.body.appendChild(modal);

    // State
    let matchResults = []; // { file, parsed, match, status, selectedUserId, approved, fuzzyReason }

    // Close handlers
    modal.querySelector('.close-btn').onclick = () => modal.remove();
    modal.querySelector('#aula-import-back-btn').onclick = () => modal.remove();
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });

    // File input / drag-drop
    const dropZone = modal.querySelector('#aula-import-drop-zone');
    const fileInput = modal.querySelector('#aula-import-file-input');

    dropZone.onclick = () => fileInput.click();
    dropZone.ondragover = (e) => { e.preventDefault(); dropZone.style.borderColor = '#4CAF50'; dropZone.style.background = '#e8f5e9'; };
    dropZone.ondragleave = () => { dropZone.style.borderColor = '#ccc'; dropZone.style.background = '#fafafa'; };
    dropZone.ondrop = (e) => {
        e.preventDefault();
        dropZone.style.borderColor = '#ccc';
        dropZone.style.background = '#fafafa';
        handleFiles(e.dataTransfer.files);
    };
    fileInput.onchange = () => handleFiles(fileInput.files);

    function handleFiles(files) {
        const validFiles = Array.from(files).filter(f =>
            /\.(webp|jpg|jpeg|png)$/i.test(f.name)
        );
        if (validFiles.length === 0) return;

        matchResults = validFiles.map(file => {
            const parsed = parseAulaFilename(file.name);
            if (!parsed) {
                return { file, parsed: null, match: { type: 'none', candidates: [] }, status: 'no_parse', selectedUserId: null, approved: false, fuzzyReason: null };
            }

            const match = matchFileToUsers(parsed, users);
            let status;
            let selectedUserId = null;
            let approved = false;
            const fuzzyReason = match.fuzzyReason || null;

            if (match.type === 'exact') {
                const user = match.candidates[0];
                if (user.profile_picture_opt_out_aula) {
                    status = 'opt_out';
                } else if (user.profile_picture_url) {
                    status = 'has_picture';
                } else {
                    status = 'ready';
                }
                selectedUserId = user.id;
                approved = true; // Exact matches are auto-approved
            } else if (match.type === 'fuzzy') {
                const user = match.candidates[0];
                if (user.profile_picture_opt_out_aula) {
                    status = 'opt_out';
                    approved = false;
                } else if (user.profile_picture_url) {
                    status = 'has_picture_fuzzy';
                } else {
                    status = 'ready_fuzzy';
                }
                selectedUserId = user.id;
                approved = false; // Fuzzy matches require manual approval
            } else if (match.type === 'ambiguous') {
                status = 'ambiguous';
            } else {
                status = 'no_match';
            }

            return { file, parsed, match, status, selectedUserId, approved, fuzzyReason };
        });

        renderReview();
    }

    function renderReview() {
        const reviewSection = modal.querySelector('#aula-import-review');
        const dropSection = modal.querySelector('#aula-import-drop-section');
        const importBtn = modal.querySelector('#aula-import-confirm-btn');

        dropSection.style.display = 'none';
        reviewSection.style.display = 'block';

        // Stats
        const stats = modal.querySelector('#aula-import-stats');
        const total = matchResults.length;
        const exact = matchResults.filter(r => r.status === 'ready' || r.status === 'has_picture').length;
        const fuzzy = matchResults.filter(r => r.status === 'ready_fuzzy' || r.status === 'has_picture_fuzzy').length;
        const ambiguous = matchResults.filter(r => r.status === 'ambiguous').length;
        const noMatch = matchResults.filter(r => r.status === 'no_match' || r.status === 'no_parse').length;
        const optOut = matchResults.filter(r => r.status === 'opt_out').length;

        stats.innerHTML = `
            <div style="display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 16px; font-size: 13px;">
                <span style="padding: 4px 10px; background: #e8f5e9; border-radius: 12px;">✅ ${exact} match</span>
                ${fuzzy > 0 ? `<span style="padding: 4px 10px; background: #fff3e0; border-radius: 12px;">🔶 ${fuzzy} usikker match</span>` : ''}
                ${ambiguous > 0 ? `<span style="padding: 4px 10px; background: #fff8e1; border-radius: 12px;">⚠️ ${ambiguous} tvivlsom</span>` : ''}
                ${noMatch > 0 ? `<span style="padding: 4px 10px; background: #fce4ec; border-radius: 12px;">❌ ${noMatch} ingen match</span>` : ''}
                ${optOut > 0 ? `<span style="padding: 4px 10px; background: #f3e5f5; border-radius: 12px;">🚫 ${optOut} opt-out</span>` : ''}
                <span style="padding: 4px 10px; background: #f5f5f5; border-radius: 12px;">${total} filer</span>
            </div>
        `;

        // Sort: fuzzy first (needs attention), then exact, then errors
        const sortOrder = { ready_fuzzy: 0, has_picture_fuzzy: 1, ambiguous: 2, ready: 3, has_picture: 4, opt_out: 5, no_match: 6, no_parse: 7 };
        const sorted = [...matchResults].sort((a, b) => (sortOrder[a.status] ?? 99) - (sortOrder[b.status] ?? 99));

        const tbody = modal.querySelector('#aula-import-tbody');
        tbody.innerHTML = sorted.map((r) => {
            const origIdx = matchResults.indexOf(r);
            return buildRow(r, origIdx);
        }).join('');

        // Bind checkboxes for fuzzy matches
        modal.querySelectorAll('.aula-import-approve-cb').forEach(cb => {
            cb.onchange = () => {
                const idx = parseInt(cb.dataset.index, 10);
                matchResults[idx].approved = cb.checked;
                updateImportButton();
            };
        });

        // Bind ambiguous dropdowns
        modal.querySelectorAll('.aula-import-ambiguous-select').forEach(sel => {
            sel.onchange = () => {
                const idx = parseInt(sel.dataset.index, 10);
                const userId = sel.value;
                matchResults[idx].selectedUserId = userId || null;
                matchResults[idx].approved = !!userId;

                if (userId) {
                    const user = users.find(u => u.id === userId);
                    if (user?.profile_picture_opt_out_aula) {
                        matchResults[idx].status = 'opt_out';
                        matchResults[idx].approved = false;
                    } else if (user?.profile_picture_url) {
                        matchResults[idx].status = 'has_picture_fuzzy';
                    } else {
                        matchResults[idx].status = 'ready_fuzzy';
                    }
                } else {
                    matchResults[idx].status = 'ambiguous';
                    matchResults[idx].approved = false;
                }
                renderReview();
            };
        });

        updateImportButton();

        // Re-upload button
        const reuploadBtn = modal.querySelector('#aula-import-reupload-btn');
        reuploadBtn.style.display = 'inline-block';
        reuploadBtn.onclick = () => {
            matchResults = [];
            dropSection.style.display = 'block';
            reviewSection.style.display = 'none';
            importBtn.style.display = 'none';
            reuploadBtn.style.display = 'none';
            fileInput.value = '';
        };
    }

    function buildRow(r, idx) {
        const isFuzzy = r.status === 'ready_fuzzy' || r.status === 'has_picture_fuzzy';
        const isExact = r.status === 'ready' || r.status === 'has_picture';
        const isAmbiguous = r.status === 'ambiguous';
        const isError = r.status === 'no_match' || r.status === 'no_parse';
        const isOptOut = r.status === 'opt_out';

        // Status column content
        let statusHTML;
        if (isExact) {
            const label = r.status === 'ready' ? 'Sættes aktivt' : 'Til bibliotek';
            const icon = r.status === 'ready' ? '✅' : '📎';
            statusHTML = `${icon} ${label}`;
        } else if (isFuzzy) {
            const label = r.status === 'ready_fuzzy' ? 'Sættes aktivt' : 'Til bibliotek';
            statusHTML = `🔶 ${label}`;
        } else if (isAmbiguous) {
            statusHTML = '⚠️ Vælg bruger';
        } else if (isOptOut) {
            statusHTML = '🚫 Fravalgt af forælder';
        } else if (r.status === 'no_parse') {
            statusHTML = '❌ Kan ikke parse filnavn';
        } else {
            statusHTML = '❌ Ingen match';
        }

        // User name column
        let userHTML;
        if (r.match.candidates.length === 1) {
            const u = r.match.candidates[0];
            const reason = r.fuzzyReason ? `<span style="font-size: 11px; color: #e65100; margin-left: 4px;">(${r.fuzzyReason})</span>` : '';
            const grade = u.grade_level != null ? `<span style="font-size: 11px; color: #666; margin-left: 4px;">${u.grade_level}. kl.</span>` : '';
            userHTML = `${u.name} (#${u.number || '?'}) ${grade}${reason}`;
        } else if (isAmbiguous) {
            userHTML = buildAmbiguousDropdown(r, idx);
        } else {
            userHTML = '<span style="color: #999;">—</span>';
        }

        // Approve checkbox column (only for fuzzy and ambiguous-resolved)
        let approveHTML;
        if (isFuzzy || (isAmbiguous && r.selectedUserId)) {
            approveHTML = `<input type="checkbox" class="aula-import-approve-cb" data-index="${idx}" ${r.approved ? 'checked' : ''} style="width: 18px; height: 18px; cursor: pointer; accent-color: #4CAF50;">`;
        } else if (isExact) {
            approveHTML = `<span style="color: #4CAF50; font-size: 16px;" title="Auto-godkendt">✓</span>`;
        } else {
            approveHTML = '';
        }

        // Row background
        const rowBg = isExact ? '#f1f8e9'
            : isFuzzy ? (r.approved ? '#e8f5e9' : '#fff3e0')
            : isAmbiguous ? '#fff8e1'
            : isOptOut ? '#fce4ec'
            : '#fff';

        return `<tr style="background: ${rowBg};">
            <td style="padding: 8px 10px; text-align: center; width: 40px;">${approveHTML}</td>
            <td style="padding: 8px 10px; font-size: 12px; max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${r.file.name}">${r.file.name}</td>
            <td style="padding: 8px 10px; font-size: 13px;">${userHTML}</td>
            <td style="padding: 8px 10px; font-size: 13px; white-space: nowrap;">${statusHTML}</td>
        </tr>`;
    }

    function buildAmbiguousDropdown(result, index) {
        const options = result.match.candidates.map(u =>
            `<option value="${u.id}" ${u.id === result.selectedUserId ? 'selected' : ''}>${u.name} (#${u.number || '?'}) ${u.grade_level != null ? `${u.grade_level}. kl.` : ''}</option>`
        ).join('');

        return `<select class="aula-import-ambiguous-select" data-index="${index}" style="padding: 4px 8px; border-radius: 4px; border: 1px solid #ff9800; font-size: 12px;">
            <option value="">— Vælg bruger —</option>
            ${options}
        </select>`;
    }

    function updateImportButton() {
        const importBtn = modal.querySelector('#aula-import-confirm-btn');
        const count = matchResults.filter(r => r.approved && r.selectedUserId && r.status !== 'opt_out').length;
        importBtn.textContent = `Importér ${count} billeder`;
        importBtn.disabled = count === 0;
        importBtn.style.display = 'block';
        importBtn.onclick = () => runImport();
    }

    async function runImport() {
        const importable = matchResults.filter(r =>
            r.approved && r.selectedUserId && r.status !== 'opt_out'
        );

        if (importable.length === 0) return;

        const importBtn = modal.querySelector('#aula-import-confirm-btn');
        const progressDiv = modal.querySelector('#aula-import-progress');
        importBtn.disabled = true;
        importBtn.textContent = 'Importerer...';
        progressDiv.style.display = 'block';

        let done = 0;
        let failed = 0;

        for (const item of importable) {
            progressDiv.textContent = `${done + 1} / ${importable.length} — ${item.parsed?.firstName || item.file.name}...`;

            try {
                const blob = await processImageForProfilePicture(item.file);
                const user = users.find(u => u.id === item.selectedUserId);
                const setActive = item.status === 'ready' || item.status === 'ready_fuzzy';

                if (setActive) {
                    // Use 'upload' as picture_type for RPC (must be in institution's allowed types)
                    // Library entry uses 'aula' to distinguish source
                    const result = await uploadProfilePicture(blob, institutionId, item.selectedUserId, 'upload', user?.name || '');
                    if (!result.success) throw new Error(result.error);
                    // Update library entry to mark as aula source
                    await supabaseClient
                        .from('profile_picture_library')
                        .update({ picture_type: 'aula' })
                        .eq('user_id', item.selectedUserId)
                        .eq('is_active', true);
                } else {
                    const storagePath = `${institutionId}/${item.selectedUserId}_${Date.now()}.webp`;
                    const { error: uploadError } = await supabaseClient.storage
                        .from(BUCKET)
                        .upload(storagePath, blob, {
                            contentType: 'image/webp',
                            cacheControl: '31536000',
                        });
                    if (uploadError) throw new Error(uploadError.message);

                    await saveToLibrary({
                        institutionId,
                        userId: item.selectedUserId,
                        userName: user?.name || '',
                        storagePath,
                        pictureType: 'aula',
                        isActive: false,
                    });
                }

                done++;
            } catch (err) {
                console.error(`[aula-import] Fejl for ${item.file.name}:`, err);
                failed++;
            }
        }

        progressDiv.textContent = `Færdig! ${done} importeret${failed > 0 ? `, ${failed} fejlede` : ''}.`;
        importBtn.textContent = '✓ Import fuldført';
        importBtn.style.background = '#2e7d32';

        setTimeout(() => {
            importBtn.textContent = 'Luk';
            importBtn.style.background = '#666';
            importBtn.disabled = false;
            importBtn.onclick = () => modal.remove();
        }, 2000);
    }
}

function buildModalHTML() {
    return `
        <div class="modal-content" style="max-width: 800px; width: 95%; max-height: 90vh; display: flex; flex-direction: column;">
            <div class="modal-header">
                <h2>📥 Auto-import fra Aula</h2>
                <span class="close-btn">&times;</span>
            </div>
            <div style="padding: 16px 20px; flex: 1; overflow-y: auto;">
                <p style="font-size: 13px; color: #666; margin: 0 0 16px 0;">
                    Upload profilbilleder hentet fra Aula. Filnavnet bruges til at matche med eksisterende brugere.<br>
                    <strong>Format:</strong> <code>Fornavn E. (3A).webp</code> — fornavn, efternavn-initial og klassetrin.
                </p>

                <!-- Drop zone -->
                <div id="aula-import-drop-section">
                    <div id="aula-import-drop-zone" style="
                        border: 2px dashed #ccc; border-radius: 12px; padding: 40px 20px;
                        text-align: center; cursor: pointer; background: #fafafa;
                        transition: border-color 0.2s, background 0.2s;">
                        <div style="font-size: 40px; margin-bottom: 8px;">📁</div>
                        <div style="font-size: 15px; font-weight: 600;">Træk billeder hertil</div>
                        <div style="font-size: 13px; color: #888; margin-top: 4px;">eller klik for at vælge filer (webp, jpg, png)</div>
                    </div>
                    <input type="file" id="aula-import-file-input" multiple accept=".webp,.jpg,.jpeg,.png" style="display: none;">
                </div>

                <!-- Review section -->
                <div id="aula-import-review" style="display: none;">
                    <div id="aula-import-stats"></div>
                    <div style="overflow-x: auto; max-height: 50vh; overflow-y: auto; border: 1px solid #e0e0e0; border-radius: 8px;">
                        <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                            <thead>
                                <tr style="background: #f5f5f5; position: sticky; top: 0; z-index: 1;">
                                    <th style="padding: 8px 10px; text-align: center; width: 40px;">Godkend</th>
                                    <th style="padding: 8px 10px; text-align: left; font-weight: 600;">Filnavn</th>
                                    <th style="padding: 8px 10px; text-align: left; font-weight: 600;">Matchet bruger</th>
                                    <th style="padding: 8px 10px; text-align: left; font-weight: 600;">Status</th>
                                </tr>
                            </thead>
                            <tbody id="aula-import-tbody"></tbody>
                        </table>
                    </div>
                    <div id="aula-import-progress" style="display: none; margin-top: 12px; padding: 10px; background: #e3f2fd; border-radius: 8px; font-size: 13px; text-align: center;"></div>
                </div>
            </div>
            <div class="modal-footer" style="padding: 12px 20px; border-top: 1px solid #eee; display: flex; gap: 10px; justify-content: space-between; flex-shrink: 0;">
                <div style="display: flex; gap: 8px;">
                    <button id="aula-import-back-btn" style="padding: 10px 20px; background: #666; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">← Tilbage</button>
                    <button id="aula-import-reupload-btn" style="display: none; padding: 10px 20px; background: #2196F3; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">🔄 Vælg nye filer</button>
                </div>
                <button id="aula-import-confirm-btn" style="display: none; padding: 10px 24px; background: #4CAF50; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 14px;">Importér</button>
            </div>
        </div>
    `;
}
