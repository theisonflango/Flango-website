/**
 * MobilePay CSV Import Module for Flango
 * =========================================
 * Robust parsing, header inference, matching, og idempotent import
 *
 * Dependencies: PapaParse (loaded via CDN in HTML)
 */

import { supabaseClient } from '../core/config-and-supabase.js';
import { showAlert, showCustomAlert } from '../ui/sound-and-alerts.js';
import { showConfirmModal } from '../ui/confirm-modals.js';

// ============================================================================
// KONFIGURATION
// ============================================================================

const CONFIG = {
    // Reference code patterns i beskeder (kan udvides)
    referencePatterns: [
        /(ST|FLANGO)[:\-\s]?([A-Z0-9]{3,10})/i,      // ST-1234, FLANGO:ABCD
        /(?:^|\s)([A-Z]{2,4}[\-:]?\d{3,6})(?:\s|$)/i, // AB-123, XY:1234
        /(?:barn|child|elev)[\s:]+([A-Za-z]+)/i,      // "Barn: Anders"
    ],

    // Header inference keywords (lowercase)
    headerKeywords: {
        date: ['dato', 'date', 'tid', 'time', 'timestamp', 'tidspunkt', 'betalt', 'paid'],
        amount: ['beløb', 'amount', 'kr', 'dkk', 'sum', 'pris', 'price', 'værdi'],
        name: ['navn', 'name', 'sender', 'afsender', 'fra', 'from', 'betaler', 'payer'],
        message: ['tekst', 'message', 'besked', 'note', 'kommentar', 'comment', 'reference', 'ref'],
        phone: ['telefon', 'phone', 'mobile', 'mobil', 'nummer', 'tlf', 'cell'],
        externalId: ['id', 'transaction', 'transaktion', 'reference', 'payment', 'ordre', 'order']
    },

    // Amount parsing
    amountDecimalSeparators: [',', '.'],
    amountThousandSeparators: ['.', ',', ' ', "'"],
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Parse amount string til øre (heltal)
 * Håndterer: "123,45", "123.45", "1.234,56", "1,234.56", "123"
 */
function parseAmountToOre(value) {
    if (value == null) return null;

    let str = String(value).trim();
    if (!str) return null;

    // Fjern currency symbols og whitespace
    str = str.replace(/[kr\.dkk€$]/gi, '').trim();

    // Detect decimal separator (sidste forekomst af , eller .)
    const lastComma = str.lastIndexOf(',');
    const lastDot = str.lastIndexOf('.');

    let decimalSep = null;
    if (lastComma > lastDot && str.length - lastComma <= 3) {
        decimalSep = ',';
    } else if (lastDot > lastComma && str.length - lastDot <= 3) {
        decimalSep = '.';
    }

    // Fjern thousand separators og normaliser decimal
    if (decimalSep === ',') {
        str = str.replace(/\./g, '').replace(',', '.');
    } else if (decimalSep === '.') {
        str = str.replace(/,/g, '');
    } else {
        // Ingen decimal - fjern alt undtagen cifre og minus
        str = str.replace(/[^\d\-]/g, '');
    }

    const num = parseFloat(str);
    if (!Number.isFinite(num)) return null;

    // Konverter til øre (heltal)
    return Math.round(num * 100);
}

/**
 * Parse dato/tid til ISO string
 * Håndterer: "01-12-2024", "2024-12-01", "01/12/2024 14:30", osv.
 */
function parseDateToISO(value) {
    if (value == null) return null;

    const str = String(value).trim();
    if (!str) return null;

    // Prøv forskellige formater
    const patterns = [
        // ISO format
        /^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2})(?::(\d{2}))?)?/,
        // DK format: DD-MM-YYYY eller DD/MM/YYYY
        /^(\d{2})[-\/](\d{2})[-\/](\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?/,
        // US format: MM/DD/YYYY
        /^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?/,
    ];

    for (const pattern of patterns) {
        const match = str.match(pattern);
        if (match) {
            let year, month, day, hour = 0, min = 0, sec = 0;

            if (pattern === patterns[0]) {
                // ISO
                [, year, month, day, hour, min, sec] = match;
            } else if (pattern === patterns[1]) {
                // DK: DD-MM-YYYY
                [, day, month, year, hour, min, sec] = match;
            } else {
                // US: MM/DD/YYYY - men vi antager DK format primært
                [, day, month, year, hour, min, sec] = match;
            }

            const date = new Date(
                parseInt(year),
                parseInt(month) - 1,
                parseInt(day),
                parseInt(hour || 0),
                parseInt(min || 0),
                parseInt(sec || 0)
            );

            if (!isNaN(date.getTime())) {
                return date.toISOString();
            }
        }
    }

    // Fallback: prøv native Date parsing
    const date = new Date(str);
    if (!isNaN(date.getTime())) {
        return date.toISOString();
    }

    return null;
}

/**
 * Udtræk sidste 4 cifre fra telefonnummer
 */
function extractPhoneSuffix(value) {
    if (value == null) return null;

    const str = String(value).trim();
    // Find alle cifre
    const digits = str.replace(/\D/g, '');

    if (digits.length >= 4) {
        return digits.slice(-4);
    }
    return null;
}

/**
 * Normaliser besked/tekst
 */
function normalizeMessage(value) {
    if (value == null) return null;

    return String(value)
        .trim()
        .replace(/\s+/g, ' ')  // Collapse whitespace
        .substring(0, 500);    // Max længde
}

/**
 * Generer SHA-256 fingerprint
 */
async function generateFingerprint(data) {
    const str = typeof data === 'string' ? data : JSON.stringify(data);
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(str);
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Round timestamp til nærmeste minut (for fingerprint)
 */
function roundToMinute(isoString) {
    if (!isoString) return null;
    const date = new Date(isoString);
    date.setSeconds(0, 0);
    return date.toISOString();
}

// ============================================================================
// CSV PARSING & HEADER INFERENCE
// ============================================================================

/**
 * Infer header kolonner fra CSV headers
 */
function inferHeaders(headers) {
    const mapping = {
        date: null,
        amount: null,
        name: null,
        message: null,
        phone: null,
        externalId: null
    };

    const headersLower = headers.map(h => (h || '').toLowerCase().trim());

    for (const [field, keywords] of Object.entries(CONFIG.headerKeywords)) {
        for (let i = 0; i < headersLower.length; i++) {
            const header = headersLower[i];
            for (const keyword of keywords) {
                if (header.includes(keyword)) {
                    // Prioriter eksakte matches
                    if (mapping[field] === null || header === keyword) {
                        mapping[field] = i;
                    }
                    break;
                }
            }
        }
    }

    return mapping;
}

/**
 * Parse CSV fil og returner normaliserede rækker
 */
export async function parseCSV(file) {
    return new Promise((resolve, reject) => {
        if (typeof Papa === 'undefined') {
            reject(new Error('PapaParse er ikke loaded. Tilføj <script src="https://unpkg.com/papaparse@5/papaparse.min.js"></script>'));
            return;
        }

        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            encoding: 'UTF-8',
            complete: async (results) => {
                try {
                    const { data, meta } = results;

                    if (!data || data.length === 0) {
                        reject(new Error('CSV filen er tom'));
                        return;
                    }

                    // Infer headers
                    const headers = meta.fields || [];
                    const headerMapping = inferHeaders(headers);

                    console.log('[mobilepay-import] Header mapping:', headerMapping, 'from headers:', headers);

                    // Normaliser hver række
                    const normalizedRows = [];
                    const duplicatesInFile = new Set();
                    const seenFingerprints = new Set();

                    for (let i = 0; i < data.length; i++) {
                        const row = data[i];
                        const rowValues = Object.values(row);

                        // Udtræk felter baseret på mapping
                        const getValue = (field) => {
                            const idx = headerMapping[field];
                            if (idx !== null && idx !== undefined) {
                                const key = headers[idx];
                                return row[key];
                            }
                            return null;
                        };

                        // Parse felter
                        const amountOre = parseAmountToOre(getValue('amount'));
                        const paidAt = parseDateToISO(getValue('date'));
                        const senderName = normalizeMessage(getValue('name'));
                        const message = normalizeMessage(getValue('message'));
                        const phoneSuffix = extractPhoneSuffix(getValue('phone'));
                        const externalId = normalizeMessage(getValue('externalId'));

                        // Valider: skal have beløb
                        if (amountOre === null || amountOre <= 0) {
                            // Skip rækker uden gyldigt positivt beløb (kan være header eller refund)
                            if (amountOre !== null && amountOre < 0) {
                                // Negativ = refund, gem som skipped
                                normalizedRows.push({
                                    rowIndex: i,
                                    isRefund: true,
                                    amountOre: amountOre,
                                    skipReason: 'Negativ beløb (refund)'
                                });
                            }
                            continue;
                        }

                        // Generer fingerprint
                        let fingerprintSource;
                        if (externalId) {
                            fingerprintSource = `ext:${externalId}`;
                        } else {
                            const roundedTime = roundToMinute(paidAt) || 'unknown';
                            fingerprintSource = [
                                roundedTime,
                                amountOre,
                                phoneSuffix || '',
                                message || '',
                                senderName || ''
                            ].join('|');
                        }

                        const fingerprint = await generateFingerprint(fingerprintSource);

                        // Check for duplicates i samme fil
                        if (seenFingerprints.has(fingerprint)) {
                            duplicatesInFile.add(i);
                            continue;
                        }
                        seenFingerprints.add(fingerprint);

                        normalizedRows.push({
                            rowIndex: i,
                            externalId: externalId || null,
                            fingerprint,
                            amountOre,
                            paidAt,
                            senderName,
                            phoneSuffix,
                            message,
                            rawRow: row,
                            hasTime: paidAt && paidAt.includes('T') && !paidAt.includes('T00:00:00'),
                            matchedUserId: null,
                            matchMethod: null,
                            matchConfidence: null,
                            matchedUserName: null
                        });
                    }

                    resolve({
                        rows: normalizedRows,
                        headerMapping,
                        headers,
                        totalRawRows: data.length,
                        duplicatesInFile: duplicatesInFile.size
                    });

                } catch (err) {
                    reject(err);
                }
            },
            error: (err) => {
                reject(new Error('CSV parsing fejl: ' + err.message));
            }
        });
    });
}

// ============================================================================
// MATCHING LOGIC
// ============================================================================

/**
 * Udtræk reference kode fra besked
 */
function extractReferenceCode(message) {
    if (!message) return null;

    for (const pattern of CONFIG.referencePatterns) {
        const match = message.match(pattern);
        if (match) {
            // Returner hele match eller capture group
            return (match[2] || match[1] || match[0]).toUpperCase();
        }
    }
    return null;
}

/**
 * Match rækker mod brugere i databasen
 * Returnerer rows med matchedUserId udfyldt hvor muligt
 */
export async function matchRowsToUsers(rows, institutionId) {
    // Hent alle brugere for institutionen
    const { data: users, error } = await supabaseClient
        .from('users')
        .select('id, name, number, role, parent_phone')
        .eq('institution_id', institutionId);

    if (error) {
        console.error('[mobilepay-import] Fejl ved hentning af brugere:', error);
        throw new Error('Kunne ikke hente brugere');
    }

    // Byg lookup maps
    const usersByNumber = new Map();      // number -> user
    const usersByPhoneSuffix = new Map(); // last 4 digits of parent_phone -> user[]
    const usersByName = new Map();        // lowercase name -> user[]

    for (const user of users) {
        // Skip admin users (de får typisk ikke top-ups)
        if (user.role === 'admin') continue;

        // By number/code
        if (user.number) {
            usersByNumber.set(user.number.toUpperCase(), user);
        }

        // By parent phone suffix
        if (user.parent_phone) {
            const suffix = extractPhoneSuffix(user.parent_phone);
            if (suffix) {
                if (!usersByPhoneSuffix.has(suffix)) {
                    usersByPhoneSuffix.set(suffix, []);
                }
                usersByPhoneSuffix.get(suffix).push(user);
            }
        }

        // By name (for fuzzy matching)
        const nameLower = (user.name || '').toLowerCase().trim();
        if (nameLower) {
            if (!usersByName.has(nameLower)) {
                usersByName.set(nameLower, []);
            }
            usersByName.get(nameLower).push(user);
        }
    }

    // Match hver række
    for (const row of rows) {
        if (row.isRefund || row.skipReason) continue;

        // 1) Reference code i besked
        const refCode = extractReferenceCode(row.message);
        if (refCode) {
            const user = usersByNumber.get(refCode);
            if (user) {
                row.matchedUserId = user.id;
                row.matchedUserName = user.name;
                row.matchMethod = 'reference_code';
                row.matchConfidence = 'high';
                continue;
            }
        }

        // 2) Phone suffix match
        if (row.phoneSuffix) {
            const matches = usersByPhoneSuffix.get(row.phoneSuffix) || [];
            if (matches.length === 1) {
                row.matchedUserId = matches[0].id;
                row.matchedUserName = matches[0].name;
                row.matchMethod = 'phone';
                row.matchConfidence = 'medium';
                continue;
            } else if (matches.length > 1) {
                // Flere matches - needs manual resolution
                row.possibleMatches = matches.map(u => ({ id: u.id, name: u.name }));
                row.matchMethod = 'phone_ambiguous';
                continue;
            }
        }

        // 3) Sender name match
        if (row.senderName) {
            const nameLower = row.senderName.toLowerCase();

            // Exact match
            const exactMatches = usersByName.get(nameLower) || [];
            if (exactMatches.length === 1) {
                row.matchedUserId = exactMatches[0].id;
                row.matchedUserName = exactMatches[0].name;
                row.matchMethod = 'name_exact';
                row.matchConfidence = 'medium';
                continue;
            }

            // Fuzzy match: check if sender name contains a user name or vice versa
            const fuzzyMatches = [];
            for (const [userName, userList] of usersByName) {
                if (nameLower.includes(userName) || userName.includes(nameLower)) {
                    fuzzyMatches.push(...userList);
                }
            }

            if (fuzzyMatches.length === 1) {
                row.matchedUserId = fuzzyMatches[0].id;
                row.matchedUserName = fuzzyMatches[0].name;
                row.matchMethod = 'name_fuzzy';
                row.matchConfidence = 'low';
                continue;
            } else if (fuzzyMatches.length > 1) {
                row.possibleMatches = fuzzyMatches.map(u => ({ id: u.id, name: u.name }));
                row.matchMethod = 'name_ambiguous';
                continue;
            }
        }

        // Ingen match fundet
        row.matchMethod = 'none';
    }

    return rows;
}

// ============================================================================
// IMPORT FUNCTIONS
// ============================================================================

/**
 * Kategoriser rækker efter match status
 */
export function categorizeRows(rows) {
    const ready = [];       // Har match, klar til import
    const needsMatch = [];  // Ingen match eller ambiguous
    const skipped = [];     // Refunds eller invalid

    for (const row of rows) {
        if (row.isRefund || row.skipReason) {
            skipped.push(row);
        } else if (row.matchedUserId) {
            ready.push(row);
        } else {
            needsMatch.push(row);
        }
    }

    return { ready, needsMatch, skipped };
}

/**
 * Udfør import via RPC
 */
export async function importRows(rows, institutionId) {
    // Forbered payload
    const payload = rows
        .filter(r => r.matchedUserId && !r.isRefund && !r.skipReason)
        .map(r => ({
            external_id: r.externalId,
            fingerprint: r.fingerprint,
            amount_ore: r.amountOre,
            paid_at: r.paidAt,
            sender_name: r.senderName,
            phone_suffix: r.phoneSuffix,
            message: r.message,
            matched_user_id: r.matchedUserId,
            match_method: r.matchMethod,
            match_confidence: r.matchConfidence,
            raw_row: r.rawRow
        }));

    if (payload.length === 0) {
        return {
            success: true,
            inserted_count: 0,
            skipped_count: 0,
            needs_match_count: 0,
            error_count: 0,
            errors: [],
            total_rows: 0
        };
    }

    const { data, error } = await supabaseClient.rpc('import_mobilepay_topups', {
        p_institution_id: institutionId,
        p_rows: payload
    });

    if (error) {
        console.error('[mobilepay-import] RPC error:', error);
        throw new Error('Import fejl: ' + error.message);
    }

    return data;
}

/**
 * Importér needs_match rækker (efter manuel matching)
 */
export async function importNeedsMatchRows(rows, institutionId) {
    // Filter til kun dem med matchedUserId sat
    const toImport = rows.filter(r => r.matchedUserId);
    return importRows(toImport, institutionId);
}

// ============================================================================
// UI HELPERS
// ============================================================================

/**
 * Format beløb fra øre til kr string
 */
export function formatAmountKr(amountOre) {
    return (amountOre / 100).toFixed(2).replace('.', ',') + ' kr';
}

/**
 * Format dato til dansk format
 */
export function formatDate(isoString) {
    if (!isoString) return '—';
    const date = new Date(isoString);
    return date.toLocaleDateString('da-DK', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

/**
 * Byg HTML for import preview
 */
export function buildImportPreviewHTML(categories, allUsers) {
    const { ready, needsMatch, skipped } = categories;

    let html = '<div class="mobilepay-import-preview">';

    // Summary
    html += `
        <div class="import-summary">
            <div class="summary-item ready">
                <span class="count">${ready.length}</span>
                <span class="label">Klar til import</span>
            </div>
            <div class="summary-item needs-match">
                <span class="count">${needsMatch.length}</span>
                <span class="label">Kræver match</span>
            </div>
            <div class="summary-item skipped">
                <span class="count">${skipped.length}</span>
                <span class="label">Springes over</span>
            </div>
        </div>
    `;

    // Ready rows
    if (ready.length > 0) {
        html += `
            <div class="import-section">
                <h4>Klar til import (${ready.length})</h4>
                <table class="import-table">
                    <thead>
                        <tr>
                            <th>Beløb</th>
                            <th>Dato</th>
                            <th>Afsender</th>
                            <th>Besked</th>
                            <th>Matchet bruger</th>
                            <th>Metode</th>
                        </tr>
                    </thead>
                    <tbody>
        `;
        for (const row of ready.slice(0, 50)) {
            const confidence = row.matchConfidence === 'high' ? '✓' :
                               row.matchConfidence === 'medium' ? '~' : '?';
            html += `
                <tr data-fingerprint="${row.fingerprint}">
                    <td class="amount">${formatAmountKr(row.amountOre)}</td>
                    <td>${formatDate(row.paidAt)}</td>
                    <td>${row.senderName || '—'}</td>
                    <td class="message">${row.message || '—'}</td>
                    <td class="matched-user">${row.matchedUserName || '—'}</td>
                    <td class="method">${confidence} ${row.matchMethod || ''}</td>
                </tr>
            `;
        }
        if (ready.length > 50) {
            html += `<tr><td colspan="6" class="more">...og ${ready.length - 50} flere</td></tr>`;
        }
        html += '</tbody></table></div>';
    }

    // Needs match rows
    if (needsMatch.length > 0) {
        html += `
            <div class="import-section needs-match-section">
                <h4>Kræver manuel match (${needsMatch.length})</h4>
                <table class="import-table">
                    <thead>
                        <tr>
                            <th>Beløb</th>
                            <th>Dato</th>
                            <th>Afsender</th>
                            <th>Besked</th>
                            <th>Telefon</th>
                            <th>Vælg bruger</th>
                        </tr>
                    </thead>
                    <tbody>
        `;
        for (const row of needsMatch.slice(0, 50)) {
            const possibleOptions = row.possibleMatches
                ? row.possibleMatches.map(m => `<option value="${m.id}">${m.name}</option>`).join('')
                : '';

            html += `
                <tr data-fingerprint="${row.fingerprint}" class="needs-match-row">
                    <td class="amount">${formatAmountKr(row.amountOre)}</td>
                    <td>${formatDate(row.paidAt)}</td>
                    <td>${row.senderName || '—'}</td>
                    <td class="message">${row.message || '—'}</td>
                    <td>${row.phoneSuffix ? '...' + row.phoneSuffix : '—'}</td>
                    <td>
                        <select class="user-match-select" data-fingerprint="${row.fingerprint}">
                            <option value="">-- Vælg bruger --</option>
                            ${possibleOptions}
                            <optgroup label="Alle brugere">
                                ${allUsers.map(u => `<option value="${u.id}">${u.name}</option>`).join('')}
                            </optgroup>
                        </select>
                    </td>
                </tr>
            `;
        }
        if (needsMatch.length > 50) {
            html += `<tr><td colspan="6" class="more">...og ${needsMatch.length - 50} flere</td></tr>`;
        }
        html += '</tbody></table></div>';
    }

    // Skipped rows
    if (skipped.length > 0) {
        html += `
            <div class="import-section skipped-section">
                <h4>Springes over (${skipped.length})</h4>
                <table class="import-table">
                    <thead>
                        <tr>
                            <th>Beløb</th>
                            <th>Årsag</th>
                        </tr>
                    </thead>
                    <tbody>
        `;
        for (const row of skipped.slice(0, 20)) {
            html += `
                <tr class="skipped-row">
                    <td class="amount ${row.amountOre < 0 ? 'negative' : ''}">${formatAmountKr(row.amountOre || 0)}</td>
                    <td>${row.skipReason || 'Ukendt'}</td>
                </tr>
            `;
        }
        if (skipped.length > 20) {
            html += `<tr><td colspan="2" class="more">...og ${skipped.length - 20} flere</td></tr>`;
        }
        html += '</tbody></table></div>';
    }

    html += '</div>';
    return html;
}

/**
 * Byg import result HTML
 */
export function buildImportResultHTML(result) {
    const totalImported = result.inserted_count || 0;
    const totalSkipped = result.skipped_count || 0;
    const totalErrors = result.error_count || 0;
    const totalNeedsMatch = result.needs_match_count || 0;

    let html = `
        <div class="import-result">
            <h4>Import fuldført</h4>
            <div class="result-summary">
                <div class="result-item success">
                    <span class="icon">✓</span>
                    <span class="count">${totalImported}</span>
                    <span class="label">importeret</span>
                </div>
    `;

    if (totalSkipped > 0) {
        html += `
                <div class="result-item skipped">
                    <span class="icon">↷</span>
                    <span class="count">${totalSkipped}</span>
                    <span class="label">allerede importeret</span>
                </div>
        `;
    }

    if (totalNeedsMatch > 0) {
        html += `
                <div class="result-item warning">
                    <span class="icon">?</span>
                    <span class="count">${totalNeedsMatch}</span>
                    <span class="label">kræver match</span>
                </div>
        `;
    }

    if (totalErrors > 0) {
        html += `
                <div class="result-item error">
                    <span class="icon">✕</span>
                    <span class="count">${totalErrors}</span>
                    <span class="label">fejl</span>
                </div>
        `;
    }

    html += '</div>';

    // Vis fejl detaljer
    if (result.errors && result.errors.length > 0) {
        html += '<div class="error-details"><h5>Fejl:</h5><ul>';
        for (const err of result.errors.slice(0, 10)) {
            html += `<li>Række ${err.row_index}: ${err.error}</li>`;
        }
        html += '</ul></div>';
    }

    html += '</div>';
    return html;
}

// ============================================================================
// CSS STYLES
// ============================================================================

export function injectStyles() {
    if (document.getElementById('mobilepay-import-styles')) return;

    const style = document.createElement('style');
    style.id = 'mobilepay-import-styles';
    style.textContent = `
        .mobilepay-import-preview {
            max-height: 60vh;
            overflow-y: auto;
        }

        .import-summary {
            display: flex;
            gap: 20px;
            margin-bottom: 20px;
            padding: 15px;
            background: #f8f9fa;
            border-radius: 8px;
        }

        .summary-item {
            display: flex;
            flex-direction: column;
            align-items: center;
            padding: 10px 20px;
            border-radius: 6px;
        }

        .summary-item .count {
            font-size: 24px;
            font-weight: 700;
        }

        .summary-item .label {
            font-size: 12px;
            color: #666;
        }

        .summary-item.ready { background: #d4edda; color: #155724; }
        .summary-item.needs-match { background: #fff3cd; color: #856404; }
        .summary-item.skipped { background: #e2e3e5; color: #383d41; }

        .import-section {
            margin-bottom: 20px;
        }

        .import-section h4 {
            margin: 0 0 10px;
            padding-bottom: 8px;
            border-bottom: 2px solid #dee2e6;
        }

        .import-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 13px;
        }

        .import-table th,
        .import-table td {
            padding: 8px;
            text-align: left;
            border-bottom: 1px solid #eee;
        }

        .import-table th {
            background: #f8f9fa;
            font-weight: 600;
        }

        .import-table .amount {
            font-family: monospace;
            font-weight: 600;
        }

        .import-table .amount.negative {
            color: #dc3545;
        }

        .import-table .message {
            max-width: 200px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        .import-table .matched-user {
            color: #28a745;
            font-weight: 500;
        }

        .import-table .method {
            font-size: 11px;
            color: #666;
        }

        .import-table .more {
            text-align: center;
            font-style: italic;
            color: #666;
        }

        .needs-match-row {
            background: #fffbea;
        }

        .user-match-select {
            width: 100%;
            padding: 4px 8px;
            border: 1px solid #ced4da;
            border-radius: 4px;
        }

        .skipped-row {
            opacity: 0.6;
        }

        .import-result {
            text-align: center;
            padding: 20px;
        }

        .result-summary {
            display: flex;
            justify-content: center;
            gap: 30px;
            margin: 20px 0;
        }

        .result-item {
            display: flex;
            flex-direction: column;
            align-items: center;
            padding: 15px 25px;
            border-radius: 8px;
        }

        .result-item .icon {
            font-size: 24px;
            margin-bottom: 5px;
        }

        .result-item .count {
            font-size: 28px;
            font-weight: 700;
        }

        .result-item .label {
            font-size: 12px;
            opacity: 0.8;
        }

        .result-item.success { background: #d4edda; color: #155724; }
        .result-item.skipped { background: #e2e3e5; color: #383d41; }
        .result-item.warning { background: #fff3cd; color: #856404; }
        .result-item.error { background: #f8d7da; color: #721c24; }

        .error-details {
            text-align: left;
            margin-top: 20px;
            padding: 15px;
            background: #f8d7da;
            border-radius: 8px;
        }

        .error-details h5 {
            margin: 0 0 10px;
            color: #721c24;
        }

        .error-details ul {
            margin: 0;
            padding-left: 20px;
        }
    `;
    document.head.appendChild(style);
}

// ============================================================================
// MAIN CONTROLLER
// ============================================================================

/**
 * Hovedklasse til MobilePay import UI
 */
export class MobilePayImportController {
    constructor(container, institutionId) {
        this.container = container;
        this.institutionId = institutionId;
        this.parsedRows = [];
        this.categories = { ready: [], needsMatch: [], skipped: [] };
        this.allUsers = [];

        injectStyles();
        this.render();
    }

    async loadUsers() {
        const { data, error } = await supabaseClient
            .from('users')
            .select('id, name, role')
            .eq('institution_id', this.institutionId)
            .neq('role', 'admin')
            .order('name');

        if (error) {
            console.error('[mobilepay-import] Error loading users:', error);
            return [];
        }
        return data || [];
    }

    render() {
        this.container.innerHTML = `
            <div class="mobilepay-import-container">
                <div class="upload-section">
                    <h3>Importér MobilePay CSV</h3>
                    <p class="description">Upload en CSV-fil eksporteret fra MobilePay. Systemet matcher automatisk betalinger til brugere.</p>
                    <div class="file-upload">
                        <input type="file" id="csv-file-input" accept=".csv,.txt" />
                        <label for="csv-file-input" class="upload-btn">
                            <span>Vælg CSV fil</span>
                        </label>
                        <span class="file-name"></span>
                    </div>
                </div>
                <div class="preview-section" style="display: none;"></div>
                <div class="actions-section" style="display: none;">
                    <button class="btn-import primary">Importér matchede</button>
                    <button class="btn-cancel secondary">Annuller</button>
                </div>
                <div class="result-section" style="display: none;"></div>
            </div>
        `;

        this.bindEvents();
    }

    bindEvents() {
        const fileInput = this.container.querySelector('#csv-file-input');
        const importBtn = this.container.querySelector('.btn-import');
        const cancelBtn = this.container.querySelector('.btn-cancel');

        fileInput.addEventListener('change', (e) => this.handleFileSelect(e));
        importBtn.addEventListener('click', () => this.handleImport());
        cancelBtn.addEventListener('click', () => this.reset());
    }

    async handleFileSelect(event) {
        const file = event.target.files[0];
        if (!file) return;

        // Vis filnavn
        this.container.querySelector('.file-name').textContent = file.name;

        try {
            // Parse CSV
            const result = await parseCSV(file);
            console.log('[mobilepay-import] Parsed:', result);

            // Hent brugere
            this.allUsers = await this.loadUsers();

            // Match rækker
            this.parsedRows = await matchRowsToUsers(result.rows, this.institutionId);

            // Kategoriser
            this.categories = categorizeRows(this.parsedRows);

            // Vis preview
            this.showPreview();

        } catch (err) {
            console.error('[mobilepay-import] Parse error:', err);
            showCustomAlert('Fejl', 'Kunne ikke læse CSV fil: ' + err.message);
        }
    }

    showPreview() {
        const previewSection = this.container.querySelector('.preview-section');
        const actionsSection = this.container.querySelector('.actions-section');

        previewSection.innerHTML = buildImportPreviewHTML(this.categories, this.allUsers);
        previewSection.style.display = 'block';
        actionsSection.style.display = 'flex';

        // Bind user select handlers
        const selects = previewSection.querySelectorAll('.user-match-select');
        selects.forEach(select => {
            select.addEventListener('change', (e) => this.handleUserMatch(e));
        });
    }

    handleUserMatch(event) {
        const fingerprint = event.target.dataset.fingerprint;
        const userId = event.target.value;

        // Find row og opdater
        const row = this.parsedRows.find(r => r.fingerprint === fingerprint);
        if (row && userId) {
            row.matchedUserId = userId;
            const user = this.allUsers.find(u => u.id === userId);
            row.matchedUserName = user?.name || '';
            row.matchMethod = 'manual';
            row.matchConfidence = 'manual';

            // Flyt fra needsMatch til ready
            this.categories = categorizeRows(this.parsedRows);

            // Opdater UI
            this.showPreview();
        }
    }

    async handleImport() {
        const { ready } = this.categories;

        if (ready.length === 0) {
            showCustomAlert('Info', 'Ingen rækker klar til import. Match venligst brugere først.');
            return;
        }

        const confirmed = await showConfirmModal({
            title: 'Bekræft import',
            message: `Er du sikker på at du vil importere ${ready.length} betalinger?\n\n` +
                     `Total beløb: ${formatAmountKr(ready.reduce((sum, r) => sum + r.amountOre, 0))}`,
            confirmText: 'Ja, importér',
            cancelText: 'Annuller'
        });

        if (!confirmed) return;

        try {
            const result = await importRows(ready, this.institutionId);
            console.log('[mobilepay-import] Import result:', result);

            // Vis resultat
            const resultSection = this.container.querySelector('.result-section');
            const previewSection = this.container.querySelector('.preview-section');
            const actionsSection = this.container.querySelector('.actions-section');

            resultSection.innerHTML = buildImportResultHTML(result);
            resultSection.style.display = 'block';
            previewSection.style.display = 'none';
            actionsSection.style.display = 'none';

            // Tilføj "Luk" knap
            resultSection.innerHTML += `
                <button class="btn-close primary" style="margin-top: 20px;">Luk</button>
            `;
            resultSection.querySelector('.btn-close').addEventListener('click', () => this.reset());

        } catch (err) {
            console.error('[mobilepay-import] Import error:', err);
            showCustomAlert('Fejl', 'Import fejlede: ' + err.message);
        }
    }

    reset() {
        this.parsedRows = [];
        this.categories = { ready: [], needsMatch: [], skipped: [] };
        this.render();
    }
}

// ============================================================================
// INIT FUNCTION (til brug i settings page)
// ============================================================================

export function initMobilePayImport(containerId, institutionId) {
    const container = document.getElementById(containerId);
    if (!container) {
        console.error('[mobilepay-import] Container not found:', containerId);
        return null;
    }
    return new MobilePayImportController(container, institutionId);
}
