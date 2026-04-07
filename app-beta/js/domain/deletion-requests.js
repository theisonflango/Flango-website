/**
 * Deletion Requests — GDPR sletningsanmodninger fra forældre
 *
 * Håndterer badge i header, alert ved login, og modal med behandlings-UI.
 */

let _pendingRequests = [];
let _supabaseClient = null;
let _institutionId = null;
let _showCustomAlert = null;

export function initDeletionRequests({ supabaseClient, institutionId, showCustomAlert }) {
  _supabaseClient = supabaseClient;
  _institutionId = institutionId;
  _showCustomAlert = showCustomAlert;

  // Bind button and modal events
  const btn = document.getElementById('deletion-requests-btn');
  if (btn) btn.addEventListener('click', openDeletionModal);

  const closeBtn = document.getElementById('deletion-requests-close');
  if (closeBtn) closeBtn.addEventListener('click', closeDeletionModal);

  const backdrop = document.getElementById('deletion-requests-modal');
  if (backdrop) backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) closeDeletionModal();
  });
}

export async function checkPendingDeletionRequests() {
  if (!_supabaseClient || !_institutionId) return;

  try {
    const { data, error } = await _supabaseClient.rpc('get_pending_deletion_requests', {
      p_institution_id: _institutionId,
    });

    if (error) {
      console.error('[DeletionRequests] RPC fejl:', error.message);
      return;
    }

    _pendingRequests = data || [];
    updateBadge();

    // Show alert at login if there are pending requests
    if (_pendingRequests.length > 0 && _showCustomAlert) {
      const count = _pendingRequests.length;
      const minDays = Math.min(..._pendingRequests.map(r => r.days_remaining));
      _showCustomAlert(
        '🗑️ Sletningsanmodninger',
        `<p>Der er <strong>${count}</strong> sletningsanmodning${count > 1 ? 'er' : ''} der afventer behandling.</p>` +
        `<p style="margin-top:8px;font-size:13px;color:#78350f;">Korteste frist: <strong>${minDays} dage</strong> tilbage.</p>` +
        `<p style="margin-top:8px;font-size:13px;">Klik på 🗑️-ikonet i menuen for at se anmodningerne.</p>`,
        'alert'
      );
    }
  } catch (err) {
    console.error('[DeletionRequests] Fejl:', err);
  }
}

function updateBadge() {
  const btn = document.getElementById('deletion-requests-btn');
  const badge = document.getElementById('deletion-badge');
  if (!btn || !badge) return;

  if (_pendingRequests.length > 0) {
    btn.style.display = '';
    badge.textContent = _pendingRequests.length;
  } else {
    btn.style.display = 'none';
  }
}

function openDeletionModal() {
  const modal = document.getElementById('deletion-requests-modal');
  if (modal) modal.style.display = '';
  renderRequestsList();
}

function closeDeletionModal() {
  const modal = document.getElementById('deletion-requests-modal');
  if (modal) modal.style.display = 'none';
}

function renderRequestsList() {
  const container = document.getElementById('deletion-requests-list');
  if (!container) return;

  if (_pendingRequests.length === 0) {
    container.innerHTML = '<div style="text-align:center;padding:24px;color:#78716c;">Ingen ventende anmodninger.</div>';
    return;
  }

  container.innerHTML = _pendingRequests.map(req => {
    const requestedDate = new Date(req.requested_at).toLocaleDateString('da-DK', { day: 'numeric', month: 'short', year: 'numeric' });
    const lastSaleDate = req.last_sale_at
      ? new Date(req.last_sale_at).toLocaleDateString('da-DK', { day: 'numeric', month: 'short', year: 'numeric' })
      : 'Ingen køb registreret';
    const daysLeft = req.days_remaining;
    const recentlyActive = req.recently_active;

    const urgencyColor = daysLeft <= 7 ? '#dc2626' : daysLeft <= 14 ? '#f59e0b' : '#16a34a';
    const urgencyBg = daysLeft <= 7 ? '#fef2f2' : daysLeft <= 14 ? '#fefce8' : '#f0fdf4';

    return `
      <div style="border:1px solid #e5e7eb;border-radius:10px;padding:16px;background:#fff;" data-request-id="${req.id}">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;">
          <div>
            <div style="font-weight:700;font-size:15px;">${escHtml(req.child_name)}</div>
            <div style="font-size:12px;color:#78716c;">Kontonr. ${req.child_number || '—'} · Saldo: ${req.child_balance != null ? req.child_balance + ' kr' : '—'}</div>
          </div>
          <div style="background:${urgencyBg};color:${urgencyColor};font-size:12px;font-weight:700;padding:4px 10px;border-radius:12px;white-space:nowrap;">
            ${daysLeft} dage tilbage
          </div>
        </div>

        <div style="font-size:13px;color:#57534e;line-height:1.6;margin-bottom:10px;">
          <div>📅 Anmodet: ${requestedDate}</div>
          <div>👤 Af: ${escHtml(req.parent_email)}</div>
          <div>🛒 Seneste aktivitet i caféen: ${lastSaleDate} (${req.total_sales || 0} køb i alt)</div>
          ${req.reason ? `<div>💬 Begrundelse: "${escHtml(req.reason)}"</div>` : ''}
        </div>

        ${recentlyActive ? `
          <div style="background:#fef3c7;border:1px solid #f59e0b;border-radius:6px;padding:8px 12px;margin-bottom:10px;font-size:12px;color:#78350f;">
            <strong>⚠️ Barnet var aktivt i caféen for nylig!</strong><br>
            Det kan tyde på en fejl. Kontakt forældrene via Aula (aula.dk) for at bekræfte anmodningen.
          </div>
        ` : `
          <div style="background:#eff6ff;border:1px solid #93c5fd;border-radius:6px;padding:8px 12px;margin-bottom:10px;font-size:12px;color:#1e3a5f;">
            💡 Kontakt forældrene via Aula (aula.dk) for at bekræfte anmodningen inden sletning.
          </div>
        `}

        <div style="display:flex;gap:8px;justify-content:flex-end;">
          <button onclick="window.__flangoDeletionReject('${req.id}', '${escHtml(req.child_name)}')" style="padding:8px 16px;border:1px solid #d1d5db;border-radius:6px;background:#fff;color:#374151;font-size:13px;cursor:pointer;">Afvis</button>
          <button onclick="window.__flangoDeletionComplete('${req.id}', '${escHtml(req.child_name)}')" style="padding:8px 16px;border:none;border-radius:6px;background:#dc2626;color:#fff;font-size:13px;font-weight:600;cursor:pointer;">Gennemfør sletning</button>
        </div>
      </div>
    `;
  }).join('');
}

// Global handlers (needed for onclick in rendered HTML)
window.__flangoDeletionComplete = async function (requestId, childName) {
  if (!_showCustomAlert) return;

  // Confirmation with name match
  const confirmed = await new Promise(resolve => {
    const div = document.createElement('div');
    div.innerHTML = `
      <p>Du er ved at slette <strong>alle data</strong> for <strong>${escHtml(childName)}</strong>. Dette kan ikke fortrydes.</p>
      <p style="margin-top:12px;font-weight:600;">Skriv barnets navn for at bekræfte:</p>
      <input type="text" id="deletion-confirm-input" placeholder="${escHtml(childName)}" style="width:100%;padding:8px 12px;border:1.5px solid #d1d5db;border-radius:6px;font-size:14px;margin-top:8px;box-sizing:border-box;">
      <div id="deletion-confirm-error" style="display:none;color:#dc2626;font-size:12px;margin-top:4px;"></div>
      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px;">
        <button id="deletion-confirm-cancel" style="padding:8px 16px;border:1px solid #d1d5db;border-radius:6px;background:#fff;cursor:pointer;">Annuller</button>
        <button id="deletion-confirm-ok" style="padding:8px 16px;border:none;border-radius:6px;background:#dc2626;color:#fff;font-weight:600;cursor:pointer;">Slet permanent</button>
      </div>
    `;

    const backdrop = document.createElement('div');
    backdrop.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:10001;display:flex;align-items:center;justify-content:center;';
    const box = document.createElement('div');
    box.style.cssText = 'background:#fff;border-radius:12px;padding:24px;max-width:420px;width:90%;box-shadow:0 8px 32px rgba(0,0,0,0.2);';
    box.appendChild(div);
    backdrop.appendChild(box);
    document.body.appendChild(backdrop);

    div.querySelector('#deletion-confirm-cancel').onclick = () => { backdrop.remove(); resolve(false); };
    backdrop.onclick = (e) => { if (e.target === backdrop) { backdrop.remove(); resolve(false); } };
    div.querySelector('#deletion-confirm-ok').onclick = () => {
      const typed = div.querySelector('#deletion-confirm-input').value.trim().toLowerCase();
      if (typed !== childName.toLowerCase()) {
        div.querySelector('#deletion-confirm-error').textContent = 'Navnet matcher ikke. Prøv igen.';
        div.querySelector('#deletion-confirm-error').style.display = '';
        return;
      }
      backdrop.remove();
      resolve(true);
    };

    div.querySelector('#deletion-confirm-input').focus();
  });

  if (!confirmed) return;

  try {
    const { data, error } = await _supabaseClient.rpc('process_deletion_request', {
      p_request_id: requestId,
      p_action: 'complete',
    });
    if (error) throw error;
    if (data && data.success === false) throw new Error(data.error);

    // Refresh
    await checkPendingDeletionRequests();
    renderRequestsList();

    if (_showCustomAlert) {
      const receipt = data?.receipt || {};
      _showCustomAlert('✅ Sletning gennemført',
        `<p>Alle data for <strong>${escHtml(childName)}</strong> er slettet.</p>` +
        `<p style="margin-top:8px;font-size:13px;color:#57534e;">Slettet: ${receipt.users || 0} bruger, ${receipt.sales || 0} salg, ${receipt.sale_items || 0} varelinjer, ${receipt.event_registrations || 0} tilmeldinger.</p>`,
        'alert'
      );
    }
  } catch (err) {
    console.error('[DeletionRequests] Complete fejl:', err);
    if (_showCustomAlert) _showCustomAlert('Fejl', `<p>Kunne ikke gennemføre sletningen: ${escHtml(err.message || 'Ukendt fejl')}</p>`, 'alert');
  }
};

window.__flangoDeletionReject = async function (requestId, childName) {
  const reason = await new Promise(resolve => {
    const div = document.createElement('div');
    div.innerHTML = `
      <p>Afvis sletningsanmodning for <strong>${escHtml(childName)}</strong>.</p>
      <p style="margin-top:8px;font-weight:600;">Angiv begrundelse (forælderen kan se den):</p>
      <textarea id="deletion-reject-reason" rows="3" placeholder="Fx: Barnet er stadig aktivt i caféen. Kontakt os via Aula hvis du ønsker at fortsætte." style="width:100%;padding:8px 12px;border:1.5px solid #d1d5db;border-radius:6px;font-size:14px;margin-top:8px;box-sizing:border-box;resize:vertical;font-family:inherit;"></textarea>
      <div id="deletion-reject-error" style="display:none;color:#dc2626;font-size:12px;margin-top:4px;"></div>
      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px;">
        <button id="deletion-reject-cancel" style="padding:8px 16px;border:1px solid #d1d5db;border-radius:6px;background:#fff;cursor:pointer;">Annuller</button>
        <button id="deletion-reject-ok" style="padding:8px 16px;border:1px solid #d1d5db;border-radius:6px;background:#f5f5f4;font-weight:600;cursor:pointer;">Afvis anmodning</button>
      </div>
    `;

    const backdrop = document.createElement('div');
    backdrop.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:10001;display:flex;align-items:center;justify-content:center;';
    const box = document.createElement('div');
    box.style.cssText = 'background:#fff;border-radius:12px;padding:24px;max-width:420px;width:90%;box-shadow:0 8px 32px rgba(0,0,0,0.2);';
    box.appendChild(div);
    backdrop.appendChild(box);
    document.body.appendChild(backdrop);

    div.querySelector('#deletion-reject-cancel').onclick = () => { backdrop.remove(); resolve(null); };
    backdrop.onclick = (e) => { if (e.target === backdrop) { backdrop.remove(); resolve(null); } };
    div.querySelector('#deletion-reject-ok').onclick = () => {
      const val = div.querySelector('#deletion-reject-reason').value.trim();
      if (!val) {
        div.querySelector('#deletion-reject-error').textContent = 'Begrundelse er påkrævet.';
        div.querySelector('#deletion-reject-error').style.display = '';
        return;
      }
      backdrop.remove();
      resolve(val);
    };

    div.querySelector('#deletion-reject-reason').focus();
  });

  if (!reason) return;

  try {
    const { data, error } = await _supabaseClient.rpc('process_deletion_request', {
      p_request_id: requestId,
      p_action: 'reject',
      p_rejection_reason: reason,
    });
    if (error) throw error;
    if (data && data.success === false) throw new Error(data.error);

    // Refresh
    await checkPendingDeletionRequests();
    renderRequestsList();

    if (_showCustomAlert) {
      _showCustomAlert('Anmodning afvist', `<p>Sletningsanmodningen for <strong>${escHtml(childName)}</strong> er afvist.</p><p style="margin-top:8px;font-size:13px;">Forælderen kan se begrundelsen i portalen.</p>`, 'alert');
    }
  } catch (err) {
    console.error('[DeletionRequests] Reject fejl:', err);
    if (_showCustomAlert) _showCustomAlert('Fejl', `<p>Kunne ikke afvise: ${escHtml(err.message || 'Ukendt fejl')}</p>`, 'alert');
  }
};

function escHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
