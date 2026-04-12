/**
 * Flango Settings Sections — Content renderers for all sidebar items.
 * Each section has a render(ctx) → HTML string, and wire(container, ctx) for events.
 * Exposes window.FlangoSettingsSections.render(key, ctx) and .wire(key, container, ctx)
 */

(function () {
  'use strict';

  // Section renderers keyed by sidebar label
  const sections = {};

  // ── Shared SVG fragments ──
  const chevronUp = '<svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><path d="M2 6.5L5 3.5 8 6.5"/></svg>';
  const chevronDown = '<svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><path d="M2 3.5L5 6.5 8 3.5"/></svg>';

  // ── Shared wiring helpers ──

  /** Set content alignItems to flex-start (for page-style sections) */
  function pageAlign(container) {
    container.style.alignItems = 'flex-start';
  }

  /** Wire all fsp-toggle elements with data-field to dirty-tracking */
  function wireToggles(container, ctx) {
    container.querySelectorAll('.fsp-toggle[data-field]').forEach(toggle => {
      toggle.addEventListener('click', () => {
        toggle.classList.toggle('on');
        ctx.markDirty(toggle.dataset.field, toggle.classList.contains('on'));
      });
    });
  }

  // ─── Mapping: data-field → module_key (for felter wireToggles ikke kender) ───
  const FIELD_MODULE_OVERRIDES = {
    // AI provider toggles bruger data-ai-provider, ikke data-field
  };
  const AI_PROVIDER_MODULE = {
    openai: 'profile_pic_ai_openai',
    flux: 'profile_pic_ai_flux',
  };

  /**
   * Lås alle toggles der er låst af superadmin.
   * Kører EFTER wireToggles/wireRadios — disabler og tilføjer 🔒-ikon.
   */
  function applyFeatureLocks(container, ctx) {
    const FM = window.FeatureModules;
    const flags = ctx.featureFlags;
    if (!FM || !flags) return;

    // Lås toggle hvis superadmin har låst modulet
    function applyFlag(toggle, moduleKey) {
      if (!FM.isModuleLocked(flags, moduleKey)) return;
      const flag = FM.getModuleFlag(flags, moduleKey);
      {
        const reason = flag.lock_reason || 'Låst af administrator';
        toggle.classList.add('superadmin-locked');
        toggle.style.opacity = '0.5';
        toggle.style.pointerEvents = 'none';
        // Fjern click handlers ved at erstatte elementet
        const clone = toggle.cloneNode(true);
        clone.style.opacity = '0.5';
        clone.style.pointerEvents = 'none';
        toggle.replaceWith(clone);
        // Tilføj 🔒 + årsag som synlig tekst-blok
        const row = clone.closest('.fsp-row, .fsp-role, .fsp-main-toggle, [style*="display:flex"]');
        if (row && !row.parentElement?.querySelector('.fsp-lock-reason')) {
          const lockBlock = document.createElement('div');
          lockBlock.className = 'fsp-lock-reason';
          lockBlock.style.cssText = 'display:flex;align-items:center;gap:6px;margin-top:6px;padding:6px 10px;border-radius:6px;background:rgba(217,119,6,0.1);border:1px solid rgba(217,119,6,0.2);font-size:12px;color:#d97706;';
          lockBlock.innerHTML = `<span style="font-size:14px">🔒</span><span>${reason}</span>`;
          row.after(lockBlock);
        }
      }
    }

    // 1. Standard data-field toggles
    container.querySelectorAll('.fsp-toggle[data-field]').forEach(toggle => {
      const field = toggle.dataset.field;
      const moduleKey = FM.FIELD_TO_MODULE?.[field];
      if (moduleKey) applyFlag(toggle, moduleKey);
    });

    // 2. AI provider toggles (data-ai-provider)
    container.querySelectorAll('[data-ai-provider]').forEach(toggle => {
      const provider = toggle.dataset.aiProvider;
      const moduleKey = AI_PROVIDER_MODULE[provider];
      if (moduleKey) applyFlag(toggle, moduleKey);
    });

    // 3. Radio buttons (data-field)
    container.querySelectorAll('.fsp-radio[data-field]').forEach(radio => {
      const field = radio.dataset.field;
      const moduleKey = FM.FIELD_TO_MODULE?.[field];
      if (moduleKey && FM.isModuleLocked(flags, moduleKey)) {
        radio.style.opacity = '0.5';
        radio.style.pointerEvents = 'none';
        const clone = radio.cloneNode(true);
        clone.style.opacity = '0.5';
        clone.style.pointerEvents = 'none';
        radio.replaceWith(clone);
      }
    });
  }

  /** Wire all fsp-radio elements with data-field + data-value */
  function wireRadios(container, ctx) {
    container.querySelectorAll('.fsp-radio[data-field]').forEach(radio => {
      radio.addEventListener('click', () => {
        const field = radio.dataset.field;
        // Deselect siblings with same field
        container.querySelectorAll(`.fsp-radio[data-field="${field}"]`).forEach(r => r.classList.remove('on'));
        radio.classList.add('on');
        ctx.markDirty(field, radio.dataset.value);
      });
    });
  }

  /** Wire all number inputs with data-field to dirty-tracking */
  function wireNumberInputs(container, ctx) {
    container.querySelectorAll('input[type="number"][data-field]').forEach(input => {
      input.addEventListener('change', () => {
        const val = parseInt(input.value) || 0;
        ctx.markDirty(input.dataset.field, val);
      });
    });
  }

  /** Wire step buttons (data-step-target + data-step) */
  function wireStepButtons(container) {
    container.querySelectorAll('[data-step-target]').forEach(btn => {
      btn.addEventListener('click', () => {
        const target = container.querySelector(`input[data-field="${btn.dataset.stepTarget}"]`);
        if (!target) return;
        const delta = parseInt(btn.dataset.step) || 0;
        const allowNeg = btn.dataset.allowNegative === 'true';
        const newVal = allowNeg ? (parseInt(target.value) || 0) + delta : Math.max(0, (parseInt(target.value) || 0) + delta);
        target.value = newVal;
        target.dispatchEvent(new Event('change'));
      });
    });
  }

  /** Wire save button to saveAllDirty */
  function wireSaveButton(container, ctx) {
    container.querySelector('[data-action="save-settings"]')?.addEventListener('click', () => {
      ctx.saveAllDirty();
    });
  }

  // ═══════════════════════════════════════════════════
  // HOVEDMENU
  // ═══════════════════════════════════════════════════

  // ── Produkter & Indbetalinger (big-card launcher) ──
  sections['Produkter & Indbetalinger'] = {
    render(ctx) {
      const cards = [
        { l: 'Produktoversigt', c: '#e8734a', d: 'Opret & rediger produkter' },
        { l: 'Brugerpanel', c: '#5dca7a', d: 'Indbetal penge og administrer brugere' }
      ];
      return `<div class="fsp-big-cards">${cards.map(card =>
        `<div class="fsp-big-card" data-card="${card.l}">
          <div class="fsp-big-card-label">${card.l}</div>
          <div class="fsp-big-card-icon" style="background:${card.c}22">${ctx.bigIc(card.l, card.c)}</div>
          <div class="fsp-big-card-desc">${card.d}</div>
        </div>`
      ).join('')}</div>`;
    },
    wire(container, ctx) {
      container.querySelectorAll('.fsp-big-card').forEach(card => {
        card.addEventListener('click', () => {
          const label = card.dataset.card;
          window.FlangoSettings.close();
          if (label === 'Produktoversigt') {
            window.openSugarPolicyModal?.();
          } else if (label === 'Brugerpanel') {
            window.openUserAdminPanel?.();
          }
        });
      });
    }
  };

  // ── Tilmelding / Arrangementer (event list + slide panel + settings) ──
  sections['Tilmelding'] = {
    render(ctx) {
      const inst = ctx.institutionData || {};
      const eventsOn = !!inst.cafe_events_enabled;
      const daysAhead = inst.cafe_events_days_ahead ?? 7;
      return `<div class="fsp-page">
        <div class="fsp-page-title" style="margin-bottom:28px">Arrangementer</div>
        <div class="fsp-arr-tabs">
          <div class="fsp-arr-tab active">Kommende<span class="fsp-arr-badge">0</span></div>
          <div class="fsp-arr-tab">Afsluttede / Aflyste<span class="fsp-arr-badge">0</span></div>
        </div>
        <div class="fsp-arr-create" data-action="open-slide">
          <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><path d="M8 3v10M3 8h10"/></svg>
          Opret arrangement
        </div>
        <div data-events-list>
          <div class="fsp-arr-section-title">Kommende arrangementer</div>
          <div style="text-align:center;padding:20px;color:var(--fsp-txt3);font-size:13px">Indl\u00e6ser arrangementer...</div>
        </div>
        <div class="fsp-section" style="margin-top:28px">
          <div class="fsp-collapse-btn" data-action="toggle-event-settings">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6 4l4 4-4 4"/></svg>
            <span>Visningsindstillinger</span>
          </div>
          <div class="fsp-collapse-body" data-collapse="event-settings">
            <div class="fsp-collapse-body-inner">
              <div class="fsp-arr-setting" style="flex-direction:column;align-items:stretch">
                <div style="display:flex;align-items:center;justify-content:space-between;gap:16px">
                  <div><div class="fsp-row-title">Vis kommende arrangementer i caf\u00e9en</div><div class="fsp-row-desc">Viser en liste over kommende begivenheder p\u00e5 caf\u00e9-sk\u00e6rmen, s\u00e5 b\u00f8rnene kan se og tilmelde sig arrangementer. Vises kun for b\u00f8rn med matchende klassetrin.</div></div>
                  <div class="fsp-toggle${eventsOn ? ' on' : ''}" data-field="cafe_events_enabled" data-expand="ev-display-body"></div>
                </div>
                <div class="fsp-expand${eventsOn ? ' open' : ''}" data-expand-target="ev-display-body" style="max-height:${eventsOn ? '400px' : '0'}">
                  <div style="padding-top:16px">
                    <div style="font-size:13px;color:var(--fsp-txt3);margin-bottom:16px;line-height:1.5">V\u00e6lg hvordan kommende arrangementer skal vises i caf\u00e9en.</div>
                    <div class="fsp-sub" data-ev-display="products">
                      <div><div class="fsp-sub-title">Vis arrangementer som produkter</div><div class="fsp-sub-hint">Tydeligt \u2013 vises som produktkort i caf\u00e9en</div></div>
                      <div class="fsp-radio on" data-field="cafe_events_display_mode" data-value="products"></div>
                    </div>
                    <div class="fsp-sub" data-ev-display="strip">
                      <div><div class="fsp-sub-title">Vis arrangementer over produkterne</div><div class="fsp-sub-hint">Diskret \u2013 vises som banner \u00f8verst</div></div>
                      <div class="fsp-radio" data-field="cafe_events_display_mode" data-value="strip"></div>
                    </div>
                    <div style="display:flex;align-items:center;gap:12px;padding:14px 18px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.04);border-radius:10px">
                      <label style="font-size:13px;font-weight:500;color:var(--fsp-txt);white-space:nowrap">Vis events indenfor</label>
                      <div class="fsp-num-wrap" style="width:64px">
                        <input type="number" data-field="cafe_events_days_ahead" value="${daysAhead}" min="1" max="90" style="padding:7px 10px;font-size:14px;font-weight:500;text-align:center">
                      </div>
                      <span style="font-size:13px;color:var(--fsp-txt3)">dage</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>`;
    },
    wire(container, ctx) {
      pageAlign(container);
      wireToggles(container, ctx);
      wireNumberInputs(container, ctx);
      wireStepButtons(container);

      wireRadios(container, ctx);
      // Collapse toggle for settings
      const settingsToggle = container.querySelector('[data-action="toggle-event-settings"]');
      const settingsBody = container.querySelector('[data-collapse="event-settings"]');
      settingsToggle?.addEventListener('click', () => {
        settingsToggle.classList.toggle('open');
        settingsBody?.classList.toggle('open');
      });
      // Expand/collapse for display options under toggle
      container.querySelectorAll('[data-expand]').forEach(toggle => {
        toggle.addEventListener('click', () => {
          const target = container.querySelector(`[data-expand-target="${toggle.dataset.expand}"]`);
          if (target) {
            const isOpen = toggle.classList.contains('on');
            target.classList.toggle('open', isOpen);
            target.style.maxHeight = isOpen ? '400px' : '0';
          }
        });
      });

      // Open slide panel for creating event
      container.querySelector('[data-action="open-slide"]')?.addEventListener('click', () => {
        const overlay = ctx.overlay;
        const slideOverlay = overlay.querySelector('#fsp-slide-overlay');
        const slidePanel = overlay.querySelector('#fsp-slide-panel');
        if (!slideOverlay || !slidePanel) return;

        const today = new Date().toISOString().split('T')[0];
        slidePanel.innerHTML = `
          <div class="fsp-slide-hdr"><h2>Opret arrangement</h2><button class="fsp-slide-close" data-action="close-slide"><svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M3 3l8 8M11 3l-8 8"/></svg></button></div>
          <div class="fsp-slide-body">
            <div class="fsp-form-group"><div class="fsp-form-label">Titel</div><input class="fsp-input" type="text" placeholder="f.eks. FIFA-turnering" data-event-title></div>
            <div class="fsp-form-group"><div class="fsp-form-label">Beskrivelse</div><textarea class="fsp-input" placeholder="Beskriv arrangementet..." data-event-desc></textarea></div>
            <div class="fsp-form-row">
              <div class="fsp-form-group"><div class="fsp-form-label">Pris</div><div class="fsp-num-wrap"><input type="number" placeholder="0 kr" data-event-price><div class="fsp-num-btns"><button class="fsp-num-btn" data-sp="price" data-sd="5">${chevronUp}</button><button class="fsp-num-btn" data-sp="price" data-sd="-5">${chevronDown}</button></div></div></div>
              <div class="fsp-form-group"><div class="fsp-form-label">Kapacitet</div><div class="fsp-num-wrap"><input type="number" placeholder="f.eks. 20" data-event-cap><div class="fsp-num-btns"><button class="fsp-num-btn" data-sp="cap" data-sd="1">${chevronUp}</button><button class="fsp-num-btn" data-sp="cap" data-sd="-1">${chevronDown}</button></div></div></div>
            </div>
            <div class="fsp-form-group"><div class="fsp-form-label">Start</div><div class="fsp-dt-block"><div class="fsp-dt-row"><input type="date" value="${today}" data-event-start-date><input type="time" value="14:00" data-event-start-time></div></div></div>
            <div class="fsp-form-group"><div class="fsp-form-label">Slut</div><div class="fsp-dt-block"><div class="fsp-dt-row"><input type="date" value="${today}" data-event-end-date><input type="time" value="16:00" data-event-end-time></div></div></div>
            <div class="fsp-form-group"><div class="fsp-form-label">M\u00e5lgruppe</div><div style="display:flex;flex-wrap:wrap;gap:6px" data-event-chips></div><div class="fsp-form-hint">Ingen valgt = alle klassetrin kan se arrangementet</div></div>
          </div>
          <div class="fsp-slide-footer"><button class="fsp-btn fsp-btn-ghost" data-action="close-slide">Annuller</button><button class="fsp-btn fsp-btn-primary" data-action="create-event">Opret arrangement</button></div>`;

        // Build grade chips (0-9)
        const chipsEl = slidePanel.querySelector('[data-event-chips]');
        for (let i = 0; i <= 9; i++) {
          const chip = document.createElement('div');
          chip.className = 'fsp-chip';
          chip.textContent = i + '. kl';
          chip.dataset.grade = i;
          chip.addEventListener('click', () => chip.classList.toggle('on'));
          chipsEl.appendChild(chip);
        }

        // Step buttons inside slide panel
        slidePanel.querySelectorAll('[data-sp]').forEach(btn => {
          btn.addEventListener('click', () => {
            const input = slidePanel.querySelector(`[data-event-${btn.dataset.sp}]`);
            if (input) input.value = Math.max(0, (parseInt(input.value) || 0) + parseInt(btn.dataset.sd));
          });
        });

        // Close slide
        slidePanel.querySelectorAll('[data-action="close-slide"]').forEach(btn => {
          btn.addEventListener('click', () => {
            slideOverlay.classList.remove('open');
            slidePanel.classList.remove('open');
          });
        });
        slideOverlay.addEventListener('click', () => {
          slideOverlay.classList.remove('open');
          slidePanel.classList.remove('open');
        });

        // Create event
        slidePanel.querySelector('[data-action="create-event"]')?.addEventListener('click', () => {
          // Close slide and open existing event admin for actual creation
          slideOverlay.classList.remove('open');
          slidePanel.classList.remove('open');
          window.FlangoSettings.close();
          window.__flangoOpenEventAdmin?.();
        });

        // Open slide
        slideOverlay.classList.add('open');
        slidePanel.classList.add('open');
      });

      // Load events (async)
      loadEvents(container, ctx);
    }
  };

  async function loadEvents(container, ctx) {
    const listEl = container.querySelector('[data-events-list]');
    if (!listEl) return;
    try {
      const client = window.__flangoSupabaseClient;
      const instId = window.getInstitutionId?.();
      if (!client || !instId) {
        listEl.innerHTML = '<div class="fsp-arr-section-title">Kommende arrangementer</div><div style="text-align:center;padding:20px;color:var(--fsp-txt3);font-size:13px">Ingen forbindelse til database.</div>';
        return;
      }
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await client
        .from('club_events')
        .select('id, title, event_date, start_time, end_time, capacity, status')
        .eq('institution_id', instId)
        .eq('status', 'active')
        .gte('event_date', today)
        .order('event_date', { ascending: true })
        .limit(20);

      if (error) throw error;

      // Update badge count
      const badge = container.querySelector('.fsp-arr-tab.active .fsp-arr-badge');
      if (badge) badge.textContent = data?.length || 0;

      if (!data || data.length === 0) {
        listEl.innerHTML = '<div class="fsp-arr-section-title">Kommende arrangementer</div><div style="text-align:center;padding:20px;color:var(--fsp-txt3);font-size:13px">Ingen kommende arrangementer.</div>';
        return;
      }

      const colors = ['#5dca7a', '#5ba0d8', '#c77ddb', '#e8734a', '#f4a261', '#e85a6f'];
      listEl.innerHTML = '<div class="fsp-arr-section-title">Kommende arrangementer</div>' +
        data.map((ev, i) => {
          const d = new Date(ev.event_date);
          const dateStr = d.toLocaleDateString('da-DK', { weekday: 'long', day: 'numeric', month: 'short' });
          const timeStr = (ev.start_time || '').slice(0, 5) + (ev.end_time ? ' \u2013 ' + ev.end_time.slice(0, 5) : '');
          return `<div class="fsp-arr-card">
            <div class="fsp-arr-card-dot" style="background:${colors[i % colors.length]}"></div>
            <div style="flex:1"><div class="fsp-arr-card-name">${ev.title}</div><div class="fsp-arr-card-meta">${dateStr} \u00b7 ${timeStr}</div></div>
            ${ev.capacity ? `<div class="fsp-arr-card-count">/ ${ev.capacity}</div>` : ''}
          </div>`;
        }).join('');
    } catch (e) {
      listEl.innerHTML = '<div class="fsp-arr-section-title">Kommende arrangementer</div><div style="text-align:center;padding:20px;color:var(--fsp-txt3);font-size:13px">Kunne ikke hente arrangementer.</div>';
    }
  }

  // ── Restaurant Mode (settings section) ──
  sections['Restaurant Mode'] = {
    render(ctx) {
      const inst = ctx.institutionData || {};
      const enabled = !!inst.restaurant_mode_enabled;
      const tableOn = !!inst.restaurant_table_numbers_enabled;
      const tableCount = inst.restaurant_table_count ?? 8;
      const deviceOn = !!localStorage.getItem('flango_device_restaurant_mode');
      return `<div class="fsp-page">
        <div class="fsp-page-title">Restaurant Mode</div>
        <div class="fsp-page-desc">Restaurant Mode sender caf\u00e9-k\u00f8b til en k\u00f8kkensk\u00e6rm der viser ordrer i realtid. For hvert salg kan tjeneren tilf\u00f8je bordnummer, varianter, og besked til k\u00f8kkenet.</div>
        <div class="fsp-main-toggle">
          <div style="flex:1"><div class="fsp-main-title">Aktiv\u00e9r Restaurant Mode</div><div class="fsp-main-desc">G\u00f8r restaurant mode tilg\u00e6ngelig for alle enheder p\u00e5 denne institution.</div></div>
          <div class="fsp-toggle${enabled ? ' on' : ''}" data-field="restaurant_mode_enabled" data-expand="rm-body"></div>
        </div>
        <div class="fsp-body${enabled ? ' open' : ''}" data-expand-target="rm-body">
          <div class="fsp-section" style="margin-bottom:20px">
            <a href="restaurant.html" target="_blank" style="display:flex;align-items:center;justify-content:center;gap:10px;padding:14px 24px;border-radius:12px;background:var(--fsp-accent-g);color:#fff;font-size:15px;font-weight:600;text-decoration:none;transition:opacity .15s;letter-spacing:-0.2px">
              <svg width="20" height="20" viewBox="0 0 16 16" fill="none" stroke="#fff" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 3v10"/><path d="M2.5 3v3c0 1 .7 1.7 1.5 1.7S5.5 7 5.5 6V3"/><path d="M11 3v5.5c0 .5.2.8.5 1h1c.3-.2.5-.5.5-1V4.5C13 3.5 12.2 3 11 3z"/><path d="M11.5 9.5V13"/></svg>
              Vis K\u00f8kkensk\u00e6rm
            </a>
          </div>
          <div class="fsp-section"><div class="fsp-device-row">
            <div class="fsp-device-emoji">\uD83C\uDF7D\uFE0F</div>
            <div class="fsp-device-left"><div class="fsp-device-title">Denne enhed skal sende ordrer til k\u00f8kkenet</div></div>
            <div class="fsp-toggle${deviceOn ? ' on' : ''}" data-action="toggle-device-rm"></div>
          </div></div>
          <div class="fsp-section"><div class="fsp-block">
            <div class="fsp-row"><div style="flex:1"><div class="fsp-row-title">Vis bordnummer-knapper ved k\u00f8bsbekr\u00e6ftelse</div><div class="fsp-row-desc">Vises p\u00e5 tjenerens enhed, s\u00e5 hvert k\u00f8b kan knyttes til et bord.</div></div><div class="fsp-toggle${tableOn ? ' on' : ''}" data-field="restaurant_table_numbers_enabled"></div></div>
            <div class="fsp-num-row"><label>Antal borde:</label><div class="fsp-num-wrap" style="width:120px"><input type="number" data-field="restaurant_table_count" value="${tableCount}" style="padding:8px 12px;font-size:13px"><div class="fsp-num-btns"><button class="fsp-num-btn" data-step-target="restaurant_table_count" data-step="1">${chevronUp}</button><button class="fsp-num-btn" data-step-target="restaurant_table_count" data-step="-1">${chevronDown}</button></div></div></div>
          </div></div>
          <div class="fsp-section"><div class="fsp-block">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px"><span style="font-size:16px">\uD83D\uDD14</span><div class="fsp-row-title">Lyd ved ny ordre</div><button class="fsp-rm-play" data-action="play-new-order" style="margin-left:auto;width:32px;height:32px;border-radius:50%;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.04);display:flex;align-items:center;justify-content:center;cursor:pointer"><svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><polygon points="5,3 13,8 5,13"/></svg></button></div>
            <div class="fsp-rm-sound" data-sound-group="new_order" style="display:flex;flex-wrap:wrap;gap:6px">
              ${['Ingen lyd', 'Ding', 'Bell', 'Chime', 'Pop', 'Alert', 'Soft ping', 'Kitchen bell'].map((s, i) => `<div class="fsp-rm-schip${(inst.restaurant_sound === s || (!inst.restaurant_sound && i === 0)) ? ' on' : ''}" data-sound-value="${s}">${s}</div>`).join('')}
            </div>
          </div></div>
          <div class="fsp-section"><div class="fsp-block">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px"><span style="font-size:16px">\u2705</span><div class="fsp-row-title">Lyd ved godkendt servering</div><button class="fsp-rm-play" data-action="play-served" style="margin-left:auto;width:32px;height:32px;border-radius:50%;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.04);display:flex;align-items:center;justify-content:center;cursor:pointer"><svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><polygon points="5,3 13,8 5,13"/></svg></button></div>
            <div class="fsp-rm-sound" data-sound-group="served" style="display:flex;flex-wrap:wrap;gap:6px">
              ${['Ingen lyd', 'Ding', 'Bell', 'Chime', 'Pop', 'Alert', 'Soft ping', 'Kitchen bell'].map((s, i) => `<div class="fsp-rm-schip${(inst.restaurant_served_sound === s || (!inst.restaurant_served_sound && i === 0)) ? ' on' : ''}" data-sound-value="${s}">${s}</div>`).join('')}
            </div>
          </div></div>
          <div class="fsp-save-row"><button class="fsp-save-btn" data-action="save-settings">Gem indstillinger</button></div>
        </div>
      </div>`;
    },
    wire(container, ctx) {
      pageAlign(container);
      wireToggles(container, ctx);
      wireNumberInputs(container, ctx);
      wireStepButtons(container);
      wireSaveButton(container, ctx);
      // Sound chip radio-style selection
      container.querySelectorAll('.fsp-rm-sound').forEach(group => {
        group.querySelectorAll('.fsp-rm-schip').forEach(chip => {
          chip.addEventListener('click', () => {
            group.querySelectorAll('.fsp-rm-schip').forEach(c => c.classList.remove('on'));
            chip.classList.add('on');
            const field = group.dataset.soundGroup === 'new_order' ? 'restaurant_sound' : 'restaurant_served_sound';
            ctx.markDirty(field, chip.dataset.soundValue);
          });
        });
      });
      // Expand/collapse
      const mainToggle = container.querySelector('[data-expand="rm-body"]');
      mainToggle?.addEventListener('click', () => {
        const target = container.querySelector('[data-expand-target="rm-body"]');
        if (target) target.classList.toggle('open', mainToggle.classList.contains('on'));
        ctx.setRmActive(mainToggle.classList.contains('on'));
      });
      // Device toggle (localStorage, not dirty-tracked)
      container.querySelector('[data-action="toggle-device-rm"]')?.addEventListener('click', function () {
        this.classList.toggle('on');
        if (this.classList.contains('on')) {
          localStorage.setItem('flango_device_restaurant_mode', 'true');
        } else {
          localStorage.removeItem('flango_device_restaurant_mode');
        }
      });
    }
  };

  // Note: Historik is a TRIGGER — handled in settings-panel.js, not here.

  // ═══════════════════════════════════════════════════
  // INSTITUTIONENS PRÆFERENCER
  // ═══════════════════════════════════════════════════

  // ── Toolbar (NEW FEATURE — drag-drop + preview) ──
  sections['Toolbar'] = {
    _items: null,
    _getItems(ctx) {
      if (this._items) return this._items;
      const inst = ctx.institutionData || {};
      this._items = [
        { key: 'toolbar_shift_timer', e: '\u23F1\uFE0F', n: 'Bytte-Timer', d: 'Vis bytte-timer genvej', on: inst.toolbar_shift_timer !== false },
        { key: 'toolbar_calculator', e: '\uD83E\uDDEE', n: 'Lommeregner', d: 'Vis lommeregner genvej', on: inst.toolbar_calculator !== false },
        { key: 'toolbar_kitchen', e: '\uD83C\uDF7D\uFE0F', n: 'K\u00f8kkensk\u00e6rm', d: 'Vis k\u00f8kkensk\u00e6rm genvej', note: 'Kr\u00e6ver Restaurant Mode', on: !!inst.toolbar_kitchen && ctx.rmActive },
        { key: 'toolbar_products', e: '\uD83D\uDED2', n: 'Produktoversigt', d: 'Vis produktoversigt genvej', on: inst.toolbar_products !== false },
        { key: 'toolbar_deposit', e: '\uD83D\uDCB0', n: 'Brugerpanel', d: 'Vis brugerpanel genvej', on: inst.toolbar_deposit !== false },
        { key: 'toolbar_history', e: '\uD83D\uDCCB', n: 'Historik', d: 'Vis historik genvej', on: !!inst.toolbar_history },
        { key: 'toolbar_help', e: '\u2753', n: 'Hj\u00e6lp', d: 'Vis hj\u00e6lp genvej', on: !!inst.toolbar_help },
        { key: 'toolbar_min_flango', e: '\uD83D\uDC64', n: 'Min Flango', d: 'Vis avatar/profil genvej', on: inst.toolbar_min_flango !== false },
        { key: 'toolbar_logout', e: '\uD83D\uDEAA', n: 'Log ud', d: 'Vis log ud genvej', on: inst.toolbar_logout !== false }
      ];
      return this._items;
    },
    render(ctx) {
      const items = this._getItems(ctx);
      return `<div class="fsp-page">
        <div class="fsp-page-title">Toolbar</div>
        <div class="fsp-page-desc">V\u00e6lg hvilke genvejsknapper der vises som ikoner i toolbaren over indk\u00f8bskurven. Tr\u00e6k for at \u00e6ndre r\u00e6kkef\u00f8lgen.</div>
        <div class="fsp-tb-preview" data-tb-preview>
          <div class="fsp-tb-preview-label">Forh\u00e5ndsvisning</div>
          ${items.map(it => `<div class="fsp-tb-preview-icon${it.on ? ' vis' : ''}" data-preview-key="${it.key}">${it.e}</div>`).join('')}
        </div>
        <div data-tb-items>
          ${items.map((it, i) => `<div class="fsp-tb-item" draggable="true" data-tb-idx="${i}" data-tb-key="${it.key}">
            <div class="fsp-tb-item-drag"><span></span><span></span><span></span></div>
            <div class="fsp-tb-item-emoji">${it.e}</div>
            <div class="fsp-tb-item-info">
              <div class="fsp-tb-item-name">${it.n}</div>
              <div class="fsp-tb-item-desc">${it.d}</div>
              ${it.note ? `<div class="fsp-tb-item-note">${it.note}</div>` : ''}
            </div>
            <div class="fsp-toggle${it.on ? ' on' : ''}" data-tb-toggle="${it.key}"></div>
          </div>`).join('')}
        </div>
        <div class="fsp-save-row"><button class="fsp-save-btn" data-action="save-settings">Gem indstillinger</button></div>
      </div>`;
    },
    wire(container, ctx) {
      pageAlign(container);
      wireSaveButton(container, ctx);
      const items = this._getItems(ctx);

      // Toggle visibility
      container.querySelectorAll('[data-tb-toggle]').forEach(toggle => {
        toggle.addEventListener('click', () => {
          toggle.classList.toggle('on');
          const key = toggle.dataset.tbToggle;
          const isOn = toggle.classList.contains('on');
          ctx.markDirty(key, isOn);
          // Update preview
          const preview = container.querySelector(`[data-preview-key="${key}"]`);
          if (preview) preview.classList.toggle('vis', isOn);
          // Update items array
          const item = items.find(it => it.key === key);
          if (item) item.on = isOn;
        });
      });

      // Drag and drop reorder
      let dragIdx = null;
      const itemsContainer = container.querySelector('[data-tb-items]');
      itemsContainer?.addEventListener('dragstart', (e) => {
        const item = e.target.closest('[data-tb-idx]');
        if (!item) return;
        dragIdx = parseInt(item.dataset.tbIdx);
        item.classList.add('dragging');
      });
      itemsContainer?.addEventListener('dragend', (e) => {
        e.target.closest?.('.fsp-tb-item')?.classList.remove('dragging');
      });
      itemsContainer?.addEventListener('dragover', (e) => {
        e.preventDefault();
        const item = e.target.closest('[data-tb-idx]');
        if (item) item.classList.add('drag-over');
      });
      itemsContainer?.addEventListener('dragleave', (e) => {
        e.target.closest?.('.fsp-tb-item')?.classList.remove('drag-over');
      });
      itemsContainer?.addEventListener('drop', (e) => {
        e.preventDefault();
        const target = e.target.closest('[data-tb-idx]');
        if (!target || dragIdx === null) return;
        target.classList.remove('drag-over');
        const dropIdx = parseInt(target.dataset.tbIdx);
        if (dragIdx === dropIdx) return;
        // Reorder items array
        const [moved] = items.splice(dragIdx, 1);
        items.splice(dropIdx, 0, moved);
        // Mark all toolbar order fields dirty
        items.forEach((it, i) => {
          ctx.markDirty(it.key + '_order', i);
        });
        // Re-render items
        this._items = items;
        const parent = container.querySelector('.fsp-content') || container;
        // Simple re-render of just the items list
        const newHtml = items.map((it, i) => `<div class="fsp-tb-item" draggable="true" data-tb-idx="${i}" data-tb-key="${it.key}">
          <div class="fsp-tb-item-drag"><span></span><span></span><span></span></div>
          <div class="fsp-tb-item-emoji">${it.e}</div>
          <div class="fsp-tb-item-info">
            <div class="fsp-tb-item-name">${it.n}</div>
            <div class="fsp-tb-item-desc">${it.d}</div>
            ${it.note ? `<div class="fsp-tb-item-note">${it.note}</div>` : ''}
          </div>
          <div class="fsp-toggle${it.on ? ' on' : ''}" data-tb-toggle="${it.key}"></div>
        </div>`).join('');
        itemsContainer.innerHTML = newHtml;
        // Re-wire toggles
        container.querySelectorAll('[data-tb-toggle]').forEach(toggle => {
          toggle.addEventListener('click', () => {
            toggle.classList.toggle('on');
            const key = toggle.dataset.tbToggle;
            ctx.markDirty(key, toggle.classList.contains('on'));
            const preview = container.querySelector(`[data-preview-key="${key}"]`);
            if (preview) preview.classList.toggle('vis', toggle.classList.contains('on'));
          });
        });
        // Update preview order
        const previewEl = container.querySelector('[data-tb-preview]');
        if (previewEl) {
          const label = previewEl.querySelector('.fsp-tb-preview-label');
          previewEl.innerHTML = '';
          if (label) previewEl.appendChild(label);
          items.forEach(it => {
            const icon = document.createElement('div');
            icon.className = 'fsp-tb-preview-icon' + (it.on ? ' vis' : '');
            icon.dataset.previewKey = it.key;
            icon.textContent = it.e;
            previewEl.appendChild(icon);
          });
        }
        dragIdx = null;
      });
    }
  };

  // ── Beløbsgrænse (settings section with dirty-tracking) ──
  sections['Beløbsgrænse'] = {
    render(ctx) {
      const inst = ctx.institutionData || {};
      const spendOn = !!inst.spending_limit_enabled;
      const spendAmt = inst.spending_limit_amount ?? 20;
      const spendReg = inst.spending_limit_applies_to_regular_users !== false;
      const spendAdm = !!inst.spending_limit_applies_to_admins;
      const spendTest = !!inst.spending_limit_applies_to_test_users;
      const balOn = inst.balance_limit_enabled !== false;
      const balAmt = inst.balance_limit_amount ?? 0;
      const balAdm = !!inst.balance_limit_exempt_admins;
      const balTest = !!inst.balance_limit_exempt_test_users;
      return `<div class="fsp-page">
        <div class="fsp-page-title">Bel\u00f8bsgr\u00e6nse</div>
        <div class="fsp-page-desc">S\u00e6t gr\u00e6nser for dagligt forbrug og minimum saldo for at beskytte mod overforbrug.</div>

        <div class="fsp-section"><div class="fsp-block" style="margin-bottom:0">
          <div class="fsp-row" style="margin-bottom:16px">
            <div style="flex:1"><div class="fsp-row-title">Daglig forbrugsgr\u00e6nse</div><div class="fsp-row-desc">Begr\u00e6ns hvor meget der kan bruges per dag.</div></div>
            <div class="fsp-toggle${spendOn ? ' on' : ''}" data-field="spending_limit_enabled" data-expand="spend-body"></div>
          </div>
          <div class="fsp-expand${spendOn ? ' open' : ''}" data-expand-target="spend-body">
            <div style="padding-top:12px;border-top:1px solid rgba(255,255,255,0.04)">
              <div style="display:flex;align-items:center;gap:12px;margin-bottom:18px">
                <label style="font-size:13px;font-weight:500;color:var(--fsp-txt2);white-space:nowrap">Maksimalt forbrug per dag:</label>
                <div class="fsp-num-wrap" style="width:130px">
                  <input type="number" data-field="spending_limit_amount" value="${spendAmt}" style="padding:8px 12px;font-size:13px">
                  <div class="fsp-num-btns">
                    <button class="fsp-num-btn" data-step-target="spending_limit_amount" data-step="5">${chevronUp}</button>
                    <button class="fsp-num-btn" data-step-target="spending_limit_amount" data-step="-5">${chevronDown}</button>
                  </div>
                </div>
                <span style="font-size:13px;color:var(--fsp-txt3)">kr</span>
              </div>
              <div style="font-size:12px;font-weight:600;color:var(--fsp-txt3);text-transform:uppercase;letter-spacing:0.6px;margin-bottom:10px">G\u00e6lder for</div>
              <div class="fsp-role"><div class="fsp-role-left"><div class="fsp-role-emoji">\uD83D\uDC67</div><div><div class="fsp-role-name">Almindelige brugere (b\u00f8rn)</div></div></div><div class="fsp-toggle${spendReg ? ' on' : ''}" data-field="spending_limit_applies_to_regular_users"></div></div>
              <div class="fsp-role"><div class="fsp-role-left"><div class="fsp-role-emoji">\uD83D\uDC68\u200D\uD83C\uDFEB</div><div><div class="fsp-role-name">Admins (voksne)</div></div></div><div class="fsp-toggle${spendAdm ? ' on' : ''}" data-field="spending_limit_applies_to_admins"></div></div>
              <div class="fsp-role"><div class="fsp-role-left"><div class="fsp-role-emoji">\uD83E\uDDEA</div><div><div class="fsp-role-name">Testbrugere</div></div></div><div class="fsp-toggle${spendTest ? ' on' : ''}" data-field="spending_limit_applies_to_test_users"></div></div>
            </div>
          </div>
        </div></div>

        <div class="fsp-section"><div class="fsp-block" style="margin-bottom:0">
          <div class="fsp-row" style="margin-bottom:16px">
            <div style="flex:1"><div class="fsp-row-title">Saldogr\u00e6nse</div><div class="fsp-row-desc">K\u00f8b blokeres hvis saldo kommer under den angivne gr\u00e6nse.</div></div>
            <div class="fsp-toggle${balOn ? ' on' : ''}" data-field="balance_limit_enabled" data-expand="bal-body"></div>
          </div>
          <div class="fsp-expand${balOn ? ' open' : ''}" data-expand-target="bal-body">
            <div style="padding-top:12px;border-top:1px solid rgba(255,255,255,0.04)">
              <div style="display:flex;align-items:center;gap:12px;margin-bottom:18px">
                <label style="font-size:13px;font-weight:500;color:var(--fsp-txt2);white-space:nowrap">Saldo m\u00e5 ikke komme under:</label>
                <div class="fsp-num-wrap" style="width:130px">
                  <input type="number" data-field="balance_limit_amount" value="${balAmt}" style="padding:8px 12px;font-size:13px">
                  <div class="fsp-num-btns">
                    <button class="fsp-num-btn" data-step-target="balance_limit_amount" data-step="5" data-allow-negative="true">${chevronUp}</button>
                    <button class="fsp-num-btn" data-step-target="balance_limit_amount" data-step="-5" data-allow-negative="true">${chevronDown}</button>
                  </div>
                </div>
                <span style="font-size:13px;color:var(--fsp-txt3)">kr</span>
              </div>
              <div style="font-size:12px;font-weight:600;color:var(--fsp-txt3);text-transform:uppercase;letter-spacing:0.6px;margin-bottom:10px">G\u00e6lder for</div>
              <div class="fsp-role"><div class="fsp-role-left"><div class="fsp-role-emoji">\uD83D\uDC67</div><div><div class="fsp-role-name">Almindelige brugere (b\u00f8rn)</div></div></div><div class="fsp-toggle on" data-field="balance_limit_applies_to_regular_users"></div></div>
              <div class="fsp-role"><div class="fsp-role-left"><div class="fsp-role-emoji">\uD83D\uDC68\u200D\uD83C\uDFEB</div><div><div class="fsp-role-name">Admins (voksne)</div></div></div><div class="fsp-toggle${balAdm ? ' on' : ''}" data-field="balance_limit_exempt_admins"></div></div>
              <div class="fsp-role"><div class="fsp-role-left"><div class="fsp-role-emoji">\uD83E\uDDEA</div><div><div class="fsp-role-name">Testbrugere</div></div></div><div class="fsp-toggle${balTest ? ' on' : ''}" data-field="balance_limit_exempt_test_users"></div></div>
            </div>
          </div>
        </div></div>

        <div class="fsp-save-row"><button class="fsp-save-btn" data-action="save-settings">Gem indstillinger</button></div>
      </div>`;
    },
    wire(container, ctx) {
      pageAlign(container);
      wireToggles(container, ctx);
      wireNumberInputs(container, ctx);
      wireStepButtons(container);
      wireSaveButton(container, ctx);
      // Expand/collapse toggles
      container.querySelectorAll('[data-expand]').forEach(toggle => {
        toggle.addEventListener('click', () => {
          const target = container.querySelector(`[data-expand-target="${toggle.dataset.expand}"]`);
          if (target) target.classList.toggle('open', toggle.classList.contains('on'));
        });
      });
    }
  };

  // ── Sukkerpolitik (settings section with dirty-tracking) ──
  sections['Sukkerpolitik'] = {
    render(ctx) {
      const inst = ctx.institutionData || {};
      const enabled = !!inst.sugar_policy_enabled;
      const perEnabled = !!inst.sugar_policy_max_per_product_enabled;
      const totEnabled = !!inst.sugar_policy_max_unhealthy_enabled;
      const perAmt = inst.sugar_policy_max_per_product_per_day ?? 1;
      const totAmt = inst.sugar_policy_max_unhealthy_per_day ?? 1;
      return `<div class="fsp-page">
        <div class="fsp-page-title">Sukkerpolitik</div>
        <div class="fsp-page-desc">Hvis klubben tilbyder mindre sunde produkter kan disse begr\u00e6nses, hvis produkterne markeres som \u2018usunde\u2019 i produktoversigten. Alternativt kan du s\u00e6tte k\u00f8bsgr\u00e6nser for de enkelte produkter, i produktoversigten.</div>
        <div class="fsp-main-toggle">
          <div style="flex:1"><div class="fsp-main-title">Aktiv\u00e9r sukkerpolitik</div><div class="fsp-main-desc">Begr\u00e6ns k\u00f8b af produkter markeret som usunde.</div></div>
          <div class="fsp-toggle${enabled ? ' on' : ''}" data-field="sugar_policy_enabled"></div>
        </div>
        <div data-body="sp-body" class="${enabled ? '' : 'fsp-off'}">
          <div class="fsp-section"><div class="fsp-block">
            <div class="fsp-row" style="margin-bottom:14px">
              <div style="flex:1"><div class="fsp-row-title">Begr\u00e6ns antal af hvert usundt produkt per dag</div><div class="fsp-row-desc">Begr\u00e6ns k\u00f8b til maks antal af hvert usundt produkt per dag.</div></div>
              <div class="fsp-toggle${perEnabled ? ' on' : ''}" data-field="sugar_policy_max_per_product_enabled"></div>
            </div>
            <div style="display:flex;align-items:center;gap:12px;padding-top:14px;border-top:1px solid rgba(255,255,255,0.04)">
              <label style="font-size:13px;font-weight:500;color:var(--fsp-txt2);white-space:nowrap">Maks per produkt:</label>
              <div class="fsp-num-wrap" style="width:100px">
                <input type="number" data-field="sugar_policy_max_per_product_per_day" value="${perAmt}" style="padding:8px 12px;font-size:13px">
                <div class="fsp-num-btns">
                  <button class="fsp-num-btn" data-step-target="sugar_policy_max_per_product_per_day" data-step="1">${chevronUp}</button>
                  <button class="fsp-num-btn" data-step-target="sugar_policy_max_per_product_per_day" data-step="-1">${chevronDown}</button>
                </div>
              </div>
              <span style="font-size:13px;color:var(--fsp-txt3)">stk.</span>
            </div>
          </div></div>
          <div class="fsp-section"><div class="fsp-block">
            <div class="fsp-row" style="margin-bottom:14px">
              <div style="flex:1"><div class="fsp-row-title">Maks antal usunde produkter per dag</div><div class="fsp-row-desc">Hvis der p\u00e5 samme dag tilbydes flere produkter markeret som usunde, m\u00e5 barnet prioritere hvilket produkt de vil bruge deres kvote p\u00e5.</div></div>
              <div class="fsp-toggle${totEnabled ? ' on' : ''}" data-field="sugar_policy_max_unhealthy_enabled"></div>
            </div>
            <div style="display:flex;align-items:center;gap:12px;padding-top:14px;border-top:1px solid rgba(255,255,255,0.04)">
              <label style="font-size:13px;font-weight:500;color:var(--fsp-txt2);white-space:nowrap">Maks i alt per dag:</label>
              <div class="fsp-num-wrap" style="width:100px">
                <input type="number" data-field="sugar_policy_max_unhealthy_per_day" value="${totAmt}" style="padding:8px 12px;font-size:13px">
                <div class="fsp-num-btns">
                  <button class="fsp-num-btn" data-step-target="sugar_policy_max_unhealthy_per_day" data-step="1">${chevronUp}</button>
                  <button class="fsp-num-btn" data-step-target="sugar_policy_max_unhealthy_per_day" data-step="-1">${chevronDown}</button>
                </div>
              </div>
              <span style="font-size:13px;color:var(--fsp-txt3)">stk.</span>
            </div>
          </div></div>
        </div>
        <div class="fsp-save-row"><button class="fsp-save-btn" data-action="save-settings">Gem indstillinger</button></div>
      </div>`;
    },
    wire(container, ctx) {
      pageAlign(container);
      wireToggles(container, ctx);
      wireNumberInputs(container, ctx);
      wireStepButtons(container);
      wireSaveButton(container, ctx);
      // Main toggle grey-out
      const mainToggle = container.querySelector('[data-field="sugar_policy_enabled"]');
      const body = container.querySelector('[data-body="sp-body"]');
      if (mainToggle && body) {
        mainToggle.addEventListener('click', () => {
          body.classList.toggle('fsp-off', !mainToggle.classList.contains('on'));
        });
      }
    }
  };

  // ═══════════════════════════════════════════════════
  // ADMINISTRATION
  // ═══════════════════════════════════════════════════

  // ── Forældreportal (big-card launcher) ──
  sections['Forældreportal'] = {
    render(ctx) {
      const gearIcon = '<svg width="84" height="84" viewBox="0 0 16 16" fill="none" stroke="{COLOR}" stroke-width="0.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="2"/><path d="M8 3v1M8 12v1M12.5 5.5l-.9.5M4.4 10l-.9.5M12.5 10.5l-.9-.5M4.4 6l-.9-.5M11 3.8l-.5.9M5.5 11.3l-.5.9M11 12.2l-.5-.9M5.5 4.7l-.5-.9"/></svg>';
      const monitorIcon = '<svg width="84" height="84" viewBox="0 0 16 16" fill="none" stroke="{COLOR}" stroke-width="0.6" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="3" width="11" height="7.5" rx="1.5"/><path d="M6 13h4"/><path d="M8 10.5v2.5"/></svg>';
      const cards = [
        { l: 'Indstillinger', c: '#c77ddb', d: 'Tilpas for\u00e6ldreportalen. V\u00e6lg hvilke funktioner der skal v\u00e6re tilg\u00e6ngelige for for\u00e6ldre.', icon: gearIcon },
        { l: 'Simulator', c: '#5ba0d8', d: '\u00c5bner institutionens for\u00e6ldreportal konto, med alle brugere tilknyttet.', icon: monitorIcon }
      ];
      return `<div class="fsp-big-cards">${cards.map(card =>
        `<div class="fsp-big-card" data-card="${card.l}">
          <div class="fsp-big-card-label">${card.l === 'Indstillinger' ? 'For\u00e6ldreportal Indstillinger' : 'For\u00e6ldreportal Simulator'}</div>
          <div class="fsp-big-card-icon" style="background:${card.c}22">${card.icon.replace('{COLOR}', card.c)}</div>
          <div class="fsp-big-card-desc">${card.d}</div>
        </div>`
      ).join('')}</div>`;
    },
    wire(container, ctx) {
      container.querySelectorAll('.fsp-big-card').forEach(card => {
        card.addEventListener('click', () => {
          const label = card.dataset.card;
          window.FlangoSettings.close();
          if (label === 'Indstillinger') {
            window.openAdminPortalV2?.();
          } else if (label === 'Simulator') {
            window.openParentPortalAsAdmin?.();
          }
        });
      });
    }
  };

  // ── Betalingsmetoder (info cards with toggle + expandable details) ──
  sections['Betalingsmetoder'] = {
    render(ctx) {
      const inst = ctx.institutionData || {};
      const methods = [
        { t: 'MobilePay API', badges: [['Automatisk saldo-opdatering','green'],['Kr\u00e6ver ops\u00e6tning','orange']], d: 'For\u00e6ldre indbetaler via MobilePay. Saldo opdateres automatisk.', on: false, detail: 'Denne l\u00f8sning foruds\u00e6tter, at institutionen (eller kommunen) har en MobilePay API-aftale. N\u00e5r en for\u00e6lder indbetaler via MobilePay, registreres betalingen automatisk i Flango, og barnets saldo opdateres uden manuelt arbejde.' },
        { t: 'MobilePay CSV', badges: [['Semi-automatisk','orange']], d: 'Sekret\u00e6r/leder uploader en MobilePay-oversigt. Nye betalinger registreres automatisk i Flango.', on: false, detail: 'Typisk logger skolens sekret\u00e6r eller SFO-leder ind i MobilePay-portalen, downloader en oversigt over indbetalinger (CSV) og uploader den i Flango. Flango registrerer automatisk alle nye betalinger p\u00e5 de relevante b\u00f8rn.<br><br>Det anbefales at g\u00f8re dette i et fast interval, som meldes ud til for\u00e6ldrene, fx: <em>\u2018Indbetalinger opdateres hver dag inden kl. 13:00\u2019</em> eller <em>\u2018hver mandag inden kl. 13:00\u2019</em>.' },
        { t: 'MobilePay QR', badges: [['Manuel','gray']], d: 'For\u00e6ldre scanner en QR-kode. Personalet registrerer indbetalingen manuelt i Flango.', on: false, detail: 'Denne metode foruds\u00e6tter, at institutionen har en MobilePay-aftale, og at klubben er logget ind p\u00e5 den mobil, som modtager indbetalinger. Institutionens QR-kode vises i for\u00e6ldreportalen og evt. i Aula. N\u00e5r for\u00e6ldre sender penge, skal personalet manuelt registrere indbetalingen p\u00e5 det enkelte barn i Flango (fx via \u2018Opdater saldo\u2019 i brugerpanelet).' },
        { t: 'MobilePay QR + Screenshot', badges: [['N\u00f8dl\u00f8sning','red']], d: 'For\u00e6ldre sender et sk\u00e6rmbillede som betalingsbevis. Personalet registrerer manuelt i Flango.', on: false, detail: 'Denne metode er til institutioner, hvor MobilePay-aftalen administreres eksternt (fx hos skolens sekret\u00e6r). Personalet kan derfor ikke se, n\u00e5r en for\u00e6lder har indbetalt. For\u00e6ldre skal sende et sk\u00e6rmbillede af betalingen som dokumentation til klubbens mobil, hvorefter personalet registrerer indbetalingen manuelt.<br><br><strong style="color:var(--fsp-accent)">Anbefales kun, hvis ingen andre l\u00f8sninger er mulige.</strong>' },
        { t: 'Kontant', badges: [['Offline','gray'],['N\u00f8dl\u00f8sning','red']], d: 'Personalet tager imod kontanter og registrerer indbetalingen manuelt i Flango.', on: false, detail: 'Kontant indbetaling kr\u00e6ver ingen teknisk ops\u00e6tning og medf\u00f8rer ingen transaktionsomkostninger. De fleste for\u00e6ldre foretr\u00e6kker digitale indbetalinger, men kontant kan bruges som en alternativ eller n\u00f8dl\u00f8sning for familier, der ikke \u00f8nsker digitale betalinger.' }
      ];
      return `<div class="fsp-page" style="max-width:780px">
        <div class="fsp-page-title">Betalingsmetoder</div>
        <div class="fsp-page-desc">Kommuner og institutioner har forskellige aftaler med betalingsudbydere. Her kan I v\u00e6lge de metoder, der passer bedst til jeres institution. Kontakt skolens sekret\u00e6r eller kommunens \u00f8konomiafdeling, hvis I er i tvivl om, hvilke aftaler I har adgang til.</div>
        <div style="margin-bottom:24px">
          <div class="fsp-collapse-btn" data-action="toggle-admin-cost">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6 4l4 4-4 4"/></svg>
            <span>Administrationsomkostning ved indbetaling</span>
          </div>
          <div class="fsp-collapse-body" data-collapse="admin-cost">
            <div class="fsp-collapse-body-inner">
              <div style="font-size:12px;color:var(--fsp-txt3);margin-bottom:14px;line-height:1.5">I v\u00e6lger selv, hvem der betaler administrationsomkostningen.</div>
              <div class="fsp-role" style="margin-bottom:6px"><div class="fsp-role-left"><div class="fsp-role-emoji">\uD83C\uDFEB</div><div><div class="fsp-role-name">Institutionen betaler administrationsomkostningen</div></div></div><div class="fsp-toggle on" data-cost="inst"></div></div>
              <div class="fsp-role"><div class="fsp-role-left"><div class="fsp-role-emoji">\uD83D\uDC6A</div><div><div class="fsp-role-name">For\u00e6ldre betaler administrationsomkostningen</div></div></div><div class="fsp-toggle" data-cost="parent"></div></div>
            </div>
          </div>
        </div>
        <div class="fsp-pm-card">
          <div class="fsp-pm-card-hdr" data-action="toggle-pm-expand">
            <div class="fsp-pm-card-left">
              <div class="fsp-pm-card-title-row"><span class="fsp-pm-card-title">Stripe Connect</span><span class="fsp-pm-badge fsp-pm-badge-green">Anbefalet</span><span class="fsp-pm-badge fsp-pm-badge-green">Automatisk saldo-opdatering</span><span class="fsp-pm-badge fsp-pm-badge-blue">Hurtig ops\u00e6tning</span></div>
              <div class="fsp-pm-card-desc">Med Stripe Connect kan I hurtigt komme i gang med automatisk indbetaling. Betalingen sendes direkte til institutionens bankkonto, og barnets Flango-saldo opdateres automatisk.</div>
            </div>
            <div class="fsp-toggle on" onclick="event.stopPropagation();this.classList.toggle('on')"></div>
          </div>
          <div class="fsp-pm-card-expand"><div class="fsp-pm-card-body"><div class="fsp-pm-card-body-inner">
            <div class="fsp-pm-detail">For\u00e6ldre indbetaler via Flango for\u00e6ldreportalen eller via personlig QR-kode. Barnets saldo opdateres automatisk. Mindre administration \u2013 mere tid til n\u00e6rv\u00e6r.</div>
            <div class="fsp-collapse-btn" data-action="toggle-stripe-details" style="margin-bottom:12px;padding:10px 14px">
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 4l4 4-4 4"/></svg>
              <span style="color:var(--fsp-accent);font-size:12px">Vis detaljer</span>
            </div>
            <div class="fsp-collapse-body" data-collapse="stripe-details">
              <div class="fsp-collapse-body-inner">
                <div style="background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.04);border-radius:10px;padding:12px 16px;margin-bottom:8px;font-size:12px;color:var(--fsp-txt3);line-height:1.5">
                  <strong style="color:var(--fsp-txt)">Administrationsomkostning:</strong> 1,5 % + 1,80 kr pr. indbetaling
                </div>
                <div style="font-size:12px;font-weight:600;color:var(--fsp-txt3);text-transform:uppercase;letter-spacing:0.6px;margin:16px 0 8px">Oprettelse</div>
                <div class="fsp-pm-detail">Oprettelse af jeres Stripe Connect-konto sker via en enkel, selvbetjent onboarding. I skal blot oplyse institutionens virksomhedsoplysninger (CVR/EAN) og udbetalingskonto.</div>
                <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:14px">
                  <button class="fsp-btn fsp-btn-ghost" style="padding:10px 20px;font-size:13px">\uD83D\uDCE5 Download onboarding-guide</button>
                  <button class="fsp-btn fsp-btn-primary" style="padding:10px 20px;font-size:13px">Opret Stripe Connect-konto</button>
                </div>
                <div style="font-size:12px;font-weight:600;color:var(--fsp-txt3);text-transform:uppercase;letter-spacing:0.6px;margin:16px 0 8px">Stripe onboarding-link</div>
                <div style="font-size:12px;color:var(--fsp-txt3);margin-bottom:10px">Linket kan udl\u00f8be \u2013 gener\u00e9r et nyt hvis n\u00f8dvendigt.</div>
                <button class="fsp-btn fsp-btn-ghost" style="padding:10px 20px;font-size:13px">\uD83D\uDD17 Gener\u00e9r onboarding-link</button>
              </div>
            </div>
            <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;padding:12px 16px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.04);border-radius:10px;margin-top:14px;font-size:12px;color:var(--fsp-txt3)">
              <span style="display:flex;align-items:center;gap:6px"><span style="width:8px;height:8px;border-radius:50%;background:#5dca7a"></span><strong style="color:var(--fsp-txt)">Stripe status:</strong></span>
              <span class="fsp-pm-badge fsp-pm-badge-green">Klar</span>
              <span>Mode: <strong style="color:var(--fsp-txt)">Aktiv</strong></span>
            </div>
            <div style="display:flex;gap:8px;margin-top:12px">
              <button class="fsp-btn fsp-btn-primary" style="opacity:0.6;cursor:default;padding:10px 20px;font-size:13px">\u2713 Ops\u00e6tning fuldf\u00f8rt</button>
              <button class="fsp-btn fsp-btn-ghost" style="padding:10px 20px;font-size:13px">\uD83D\uDD04 Opdater status</button>
            </div>
          </div></div></div>
        </div>
        ${methods.map(m => `<div class="fsp-pm-card">
          <div class="fsp-pm-card-hdr" data-action="toggle-pm-expand">
            <div class="fsp-pm-card-left">
              <div class="fsp-pm-card-title-row">
                <span class="fsp-pm-card-title">${m.t}</span>
                ${m.badges.map(b => `<span class="fsp-pm-badge fsp-pm-badge-${b[1]}">${b[0]}</span>`).join('')}
              </div>
              <div class="fsp-pm-card-desc">${m.d}</div>
            </div>
            <div class="fsp-toggle${m.on ? ' on' : ''}" onclick="event.stopPropagation();this.classList.toggle('on')"></div>
          </div>
          <div class="fsp-pm-card-expand"><div class="fsp-pm-card-body"><div class="fsp-pm-card-body-inner">
            <div class="fsp-pm-detail">${m.detail}</div>
          </div></div></div>
        </div>`).join('')}
        <div class="fsp-save-row"><button class="fsp-save-btn" data-action="save-settings">Gem indstillinger</button></div>
      </div>`;
    },
    wire(container, ctx) {
      pageAlign(container);
      // Toggle admin cost collapse
      const costBtn = container.querySelector('[data-action="toggle-admin-cost"]');
      const costBody = container.querySelector('[data-collapse="admin-cost"]');
      costBtn?.addEventListener('click', () => { costBtn.classList.toggle('open'); costBody?.classList.toggle('open'); });
      // Cost toggles (mutually exclusive)
      container.querySelectorAll('[data-cost]').forEach(t => {
        t.addEventListener('click', () => {
          t.classList.toggle('on');
          const other = t.dataset.cost === 'inst' ? 'parent' : 'inst';
          container.querySelector(`[data-cost="${other}"]`)?.classList.toggle('on');
        });
      });
      // Expand/collapse cards on header click
      container.querySelectorAll('[data-action="toggle-pm-expand"]').forEach(hdr => {
        hdr.addEventListener('click', () => {
          const expand = hdr.parentElement.querySelector('.fsp-pm-card-expand');
          expand?.classList.toggle('open');
        });
      });
      // Stripe details sub-collapse
      const stripeBtn = container.querySelector('[data-action="toggle-stripe-details"]');
      const stripeBody = container.querySelector('[data-collapse="stripe-details"]');
      stripeBtn?.addEventListener('click', () => { stripeBtn.classList.toggle('open'); stripeBody?.classList.toggle('open'); });
      wireSaveButton(container, ctx);
    }
  };

  // ── Profilbilleder (settings section — matches mockup exactly) ──
  sections['Profilbilleder'] = {
    render(ctx) {
      const inst = ctx.institutionData || {};
      const enabled = !!inst.profile_pictures_enabled;
      const types = inst.profile_picture_types || [];
      const aiOn = !!inst.profile_pictures_ai_enabled;
      const defMode = inst.default_profile_picture_mode || 'initials';
      const hasUpload = types.includes('upload');
      const hasCamera = types.includes('camera');
      const hasLibrary = types.includes('library');
      return `<div class="fsp-page" style="max-width:720px">
        <div class="fsp-page-title">Profilbilleder</div>
        <div class="fsp-page-desc">Profilbilleder vises ved brugervalg i caf\u00e9en s\u00e5 ekspedienten kan bekr\u00e6fte identiteten. Hver type profilbillede skal godkendes af for\u00e6ldre via for\u00e6ldreportalen.</div>
        <div class="fsp-main-toggle" style="margin-bottom:20px">
          <div style="flex:1"><div class="fsp-main-title">Profilbilleder er sl\u00e5et til</div></div>
          <div class="fsp-toggle${enabled ? ' on' : ''}" data-field="profile_pictures_enabled" data-expand="pp-body"></div>
        </div>
        <div data-expand-target="pp-body" class="${enabled ? '' : 'fsp-off'}">
          <div style="font-size:12px;font-weight:600;color:var(--fsp-txt3);text-transform:uppercase;letter-spacing:0.6px;margin-bottom:12px">Tilg\u00e6ngelige typer</div>
          <div class="fsp-block" style="margin-bottom:10px"><div class="fsp-row">
            <div style="display:flex;align-items:center;gap:12px;flex:1"><span style="font-size:18px">\uD83D\uDCC1</span><div><div class="fsp-row-title">Upload</div><div class="fsp-row-desc">Admin uploader billede (fx kopieret fra Aula)</div></div></div>
            <div class="fsp-toggle${hasUpload ? ' on' : ''}" data-pp-type="upload"></div>
          </div></div>
          <div class="fsp-block" style="margin-bottom:10px"><div class="fsp-row">
            <div style="display:flex;align-items:center;gap:12px;flex:1"><span style="font-size:18px">\uD83D\uDCF7</span><div><div class="fsp-row-title">Kamera</div><div class="fsp-row-desc">Tag foto med enhedens kamera</div></div></div>
            <div class="fsp-toggle${hasCamera ? ' on' : ''}" data-pp-type="camera"></div>
          </div></div>
          <div class="fsp-block" style="margin-bottom:10px"><div class="fsp-row">
            <div style="display:flex;align-items:center;gap:12px;flex:1"><span style="font-size:18px">\uD83C\uDFA8</span><div><div class="fsp-row-title">Bibliotek</div><div class="fsp-row-desc">V\u00e6lg avatar-figur fra eksisterende bibliotek</div></div></div>
            <div class="fsp-toggle${hasLibrary ? ' on' : ''}" data-pp-type="library"></div>
          </div></div>
          <div class="fsp-block" style="margin-bottom:10px">
            <div class="fsp-row" style="margin-bottom:14px">
              <div style="display:flex;align-items:center;gap:12px;flex:1"><span style="font-size:18px">\uD83E\uDD16</span><div><div class="fsp-row-title">AI-Avatar</div><div class="fsp-row-desc">Generer Pixar-stil avatar fra foto</div></div></div>
              <div class="fsp-toggle${aiOn ? ' on' : ''}" data-field="profile_pictures_ai_enabled" data-expand="ai-body"></div>
            </div>
            <div class="fsp-expand${aiOn ? ' open' : ''}" data-expand-target="ai-body" style="max-height:${aiOn ? '400px' : '0'}">
              <div style="padding-top:14px;border-top:1px solid rgba(255,255,255,0.04)">
                <div class="fsp-pm-detail">Aktiverer AI-genererede avatarer baseret p\u00e5 barnets foto. Fotoet sendes til den valgte udbyder og slettes straks efter. Flango sender faktura til institutionen p\u00e5 100,- kr. hvorefter I kan generere 300\u2013400 avatars.</div>
                <div class="fsp-role" style="margin-bottom:6px"><div class="fsp-role-left"><div><div class="fsp-role-name">OpenAI</div><div style="font-size:11px;color:var(--fsp-txt3);margin-top:1px">USA</div></div></div><div class="fsp-toggle${inst.ai_provider_openai !== false ? ' on' : ''}" data-ai-provider="openai"></div></div>
                <div class="fsp-role"><div class="fsp-role-left"><div><div class="fsp-role-name">Black Forest Labs, FLUX 2</div><div style="font-size:11px;color:var(--fsp-txt3);margin-top:1px">Tyskland</div></div></div><div class="fsp-toggle${inst.ai_provider_flux ? ' on' : ''}" data-ai-provider="flux"></div></div>
              </div>
            </div>
          </div>
          <div style="margin:28px 0 28px;padding-top:20px;border-top:1px solid rgba(255,255,255,0.05)">
            <button class="fsp-btn fsp-btn-ghost" data-action="aula-import" style="width:100%;display:flex;justify-content:center;padding:14px 24px;font-size:14px;gap:10px">\uD83D\uDCE5 Auto-import fra Aula</button>
            <div style="font-size:11px;color:var(--fsp-txt3);margin-top:6px;text-align:center">Upload billeder hentet fra Aula \u2014 matcher automatisk p\u00e5 navn og klassetrin</div>
          </div>
        </div>
        <div style="margin-top:8px;padding-top:20px;border-top:1px solid rgba(255,255,255,0.05)">
          <div class="fsp-main-toggle" style="margin-bottom:16px">
            <div style="flex:1"><div class="fsp-main-title">Standard profilbillede</div><div class="fsp-main-desc">Vises for brugere der ikke har f\u00e5et tildelt et profilbillede.</div></div>
            <div class="fsp-toggle on" data-action="toggle-dp"></div>
          </div>
          <div data-dp-options>
            <div class="fsp-sub" data-dp-click="initials">
              <div style="display:flex;align-items:center;gap:8px"><span style="display:flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:50%;background:rgba(232,115,74,0.15);font-size:11px;font-weight:700;color:var(--fsp-accent)">AB</span><div><div class="fsp-sub-title">Initialer</div><div class="fsp-sub-hint">Viser brugerens initialer i en cirkel</div></div></div>
              <div class="fsp-radio${defMode === 'initials' ? ' on' : ''}" data-field="default_profile_picture_mode" data-value="initials"></div>
            </div>
            <div class="fsp-sub" data-dp-click="image">
              <div style="display:flex;align-items:center;gap:8px"><span style="font-size:18px">\uD83D\uDC64</span><div><div class="fsp-sub-title">Anonym bruger-ikon</div><div class="fsp-sub-hint">Viser et generisk bruger-ikon</div></div></div>
              <div class="fsp-radio${defMode === 'image' ? ' on' : ''}" data-field="default_profile_picture_mode" data-value="image"></div>
            </div>
            <div class="fsp-sub" data-dp-click="custom">
              <div style="display:flex;align-items:center;gap:8px"><span style="font-size:18px">\uD83D\uDDBC\uFE0F</span><div><div class="fsp-sub-title">Brugerdefineret billede</div><div class="fsp-sub-hint">\u00c9t f\u00e6lles billede for alle uden profilbillede</div></div></div>
              <div class="fsp-radio${defMode === 'custom' ? ' on' : ''}" data-field="default_profile_picture_mode" data-value="custom"></div>
            </div>
          </div>
        </div>
        <div class="fsp-save-row"><button class="fsp-save-btn" data-action="save-settings">Gem indstillinger</button></div>
      </div>`;
    },
    wire(container, ctx) {
      pageAlign(container);
      wireToggles(container, ctx);
      wireSaveButton(container, ctx);
      // Main toggle grey-out
      container.querySelector('[data-expand="pp-body"]')?.addEventListener('click', function () {
        const target = container.querySelector('[data-expand-target="pp-body"]');
        if (target) target.classList.toggle('fsp-off', !this.classList.contains('on'));
      });
      // AI-Avatar expand
      container.querySelector('[data-expand="ai-body"]')?.addEventListener('click', function () {
        const target = container.querySelector('[data-expand-target="ai-body"]');
        if (target) {
          const isOpen = this.classList.contains('on');
          target.classList.toggle('open', isOpen);
          target.style.maxHeight = isOpen ? '400px' : '0';
        }
      });
      // AI provider toggles (OpenAI / FLUX)
      container.querySelectorAll('[data-ai-provider]').forEach(toggle => {
        toggle.addEventListener('click', () => {
          toggle.classList.toggle('on');
          ctx.markDirty('ai_provider_' + toggle.dataset.aiProvider, toggle.classList.contains('on'));
        });
      });
      // Default picture toggle grey-out
      container.querySelector('[data-action="toggle-dp"]')?.addEventListener('click', function () {
        this.classList.toggle('on');
        container.querySelector('[data-dp-options]')?.classList.toggle('fsp-off', !this.classList.contains('on'));
      });
      // Default picture radio clicks (on the sub row, not just the radio dot)
      container.querySelectorAll('[data-dp-click]').forEach(sub => {
        sub.addEventListener('click', () => {
          container.querySelectorAll('.fsp-radio[data-field="default_profile_picture_mode"]').forEach(r => r.classList.remove('on'));
          sub.querySelector('.fsp-radio')?.classList.add('on');
          ctx.markDirty('default_profile_picture_mode', sub.dataset.dpClick);
        });
      });
      // Profile picture types array toggle
      container.querySelectorAll('[data-pp-type]').forEach(toggle => {
        toggle.addEventListener('click', () => {
          toggle.classList.toggle('on');
          const types = [];
          container.querySelectorAll('[data-pp-type]').forEach(t => {
            if (t.classList.contains('on')) types.push(t.dataset.ppType);
          });
          ctx.markDirty('profile_picture_types', types);
        });
      });
      // Aula import
      container.querySelector('[data-action="aula-import"]')?.addEventListener('click', () => {
        window.FlangoSettings.close();
        window.__flangoOpenAulaImport?.();
      });
    }
  };

  // ── Produktikoner – Deling (settings section) ──
  sections['Produktikoner – Deling'] = {
    render(ctx) {
      const inst = ctx.institutionData || {};
      const shareOn = !!inst.icon_sharing_enabled;
      const useOn = !!inst.icon_use_shared_enabled;
      return `<div class="fsp-page">
        <div class="fsp-page-title">Produktikoner \u2013 Deling</div>
        <div class="fsp-page-desc">V\u00e6lg om jeres ikoner skal v\u00e6re tilg\u00e6ngelige for andre institutioner, og om I vil kunne se andres delte ikoner.</div>
        <div class="fsp-section"><div class="fsp-block">
          <div class="fsp-row">
            <div style="display:flex;align-items:center;gap:12px;flex:1"><span style="font-size:18px">\uD83E\uDD1D</span><div><div class="fsp-row-title">Del jeres ikoner</div><div class="fsp-row-desc">Andre institutioner kan bruge jeres ikoner</div></div></div>
            <div class="fsp-toggle${shareOn ? ' on' : ''}" data-field="icon_sharing_enabled"></div>
          </div>
        </div></div>
        <div class="fsp-section"><div class="fsp-block">
          <div class="fsp-row">
            <div style="display:flex;align-items:center;gap:12px;flex:1"><span style="font-size:18px">\uD83C\uDFA8</span><div><div class="fsp-row-title">Brug andres ikoner</div><div class="fsp-row-desc">Se og brug ikoner delt af andre institutioner</div></div></div>
            <div class="fsp-toggle${useOn ? ' on' : ''}" data-field="icon_use_shared_enabled"></div>
          </div>
        </div></div>
        <button class="fsp-btn fsp-btn-ghost" data-action="show-icons" style="width:100%;display:flex;justify-content:center;padding:14px 24px;font-size:14px;gap:10px;margin-top:8px">\uD83C\uDFA8 Vis jeres ikoner</button>
        <div class="fsp-save-row"><button class="fsp-save-btn" data-action="save-settings">Gem indstillinger</button></div>
      </div>`;
    },
    wire(container, ctx) {
      pageAlign(container);
      wireToggles(container, ctx);
      wireSaveButton(container, ctx);
    }
  };

  // ── MobilePay CSV Import (action section) ──
  sections['MobilePay CSV Import'] = {
    render(ctx) {
      return `<div class="fsp-page">
        <div class="fsp-page-title">MobilePay CSV Import</div>
        <div class="fsp-page-desc">Import\u00e9r indbetalinger fra MobilePay CSV-eksport og s\u00e6t dem p\u00e5 b\u00f8rnenes saldo.</div>
        <div class="fsp-block">
          <div class="fsp-row" style="flex-direction:column;align-items:stretch;gap:16px">
            <div>
              <div class="fsp-row-title">Upload CSV-fil</div>
              <div class="fsp-row-desc">V\u00e6lg en CSV-fil eksporteret fra MobilePay. Filen matches automatisk med brugere baseret p\u00e5 betalingsreference.</div>
            </div>
            <button class="fsp-btn fsp-btn-primary" data-action="upload-csv" style="align-self:flex-start;display:flex;align-items:center;gap:8px">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><path d="M8 10V2.5M5 5l3-3 3 3"/><rect x="2" y="10" width="12" height="4" rx="1.5"/></svg>
              Upload CSV
            </button>
          </div>
        </div>
      </div>`;
    },
    wire(container, ctx) {
      pageAlign(container);
      container.querySelector('[data-action="upload-csv"]')?.addEventListener('click', () => {
        window.FlangoSettings.close();
        window.openMobilePayImportModal?.();
      });
    }
  };

  // ── Opret/Opdater brugere auto. (action section) ──
  sections['Opret/Opdater brugere auto.'] = {
    render(ctx) {
      return `<div class="fsp-page">
        <div class="fsp-page-title">Opret/Opdater brugere automatisk</div>
        <div class="fsp-page-desc">Masse-import af brugere fra en liste. Upload en fil med brugerdata for at oprette nye brugere eller opdatere eksisterende.</div>
        <div class="fsp-block">
          <div class="fsp-row" style="flex-direction:column;align-items:stretch;gap:16px">
            <div>
              <div class="fsp-row-title">Upload brugerliste</div>
              <div class="fsp-row-desc">V\u00e6lg en fil med brugerdata (CSV eller Excel). Eksisterende brugere opdateres, nye oprettes automatisk.</div>
            </div>
            <button class="fsp-btn fsp-btn-primary" data-action="auto-import" style="align-self:flex-start;display:flex;align-items:center;gap:8px">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><path d="M2 8a6 6 0 0110.5-4M14 8a6 6 0 01-10.5 4"/><path d="M12 1.5V4.5h-3"/><path d="M4 14.5V11.5h3"/></svg>
              Start import
            </button>
          </div>
        </div>
      </div>`;
    },
    wire(container, ctx) {
      pageAlign(container);
      container.querySelector('[data-action="auto-import"]')?.addEventListener('click', () => {
        window.FlangoSettings.close();
        window.__flangoOpenAutoImportModal?.();
      });
    }
  };

  // ═══════════════════════════════════════════════════
  // DATASIKKERHED
  // ═══════════════════════════════════════════════════

  // ── Totrinsgodkendelse (MFA) (settings section) ──
  sections['Totrinsgodkendelse (MFA)'] = {
    render(ctx) {
      const inst = ctx.institutionData || {};
      const policy = inst.admin_mfa_policy || 'off';
      const parentMfa = !!inst.parent_mfa_new_device;
      return `<div class="fsp-page">
        <div class="fsp-page-title">Totrinsgodkendelse (MFA)</div>
        <div class="fsp-page-desc">Totrinsgodkendelse tilf\u00f8jer et ekstra sikkerhedslag ved login. Brugeren skal indtaste en 6-cifret kode fra en authenticator-app (Google Authenticator, Microsoft Authenticator o.l.) ud over kodeord.</div>
        <div style="font-size:12px;font-weight:600;color:var(--fsp-txt3);text-transform:uppercase;letter-spacing:0.6px;margin-bottom:12px">ADMIN-LOGIN MFA</div>
        ${[
          { v: 'off', t: 'Fra (ingen MFA)', h: '' },
          { v: 'new_device', t: 'Kun ved ny enhed', h: 'Kr\u00e6ver MFA f\u00f8rste gang man logger ind p\u00e5 en ny browser/enhed.' },
          { v: 'always', t: 'Altid ved login', h: 'Kr\u00e6ver MFA ved hver ny session.' }
        ].map(opt => `<div class="fsp-sub">
          <div><div class="fsp-sub-title">${opt.t}</div>${opt.h ? `<div class="fsp-sub-hint">${opt.h}</div>` : ''}</div>
          <div class="fsp-radio${policy === opt.v ? ' on' : ''}" data-field="admin_mfa_policy" data-value="${opt.v}"></div>
        </div>`).join('')}
        <div style="margin-top:28px;padding-top:20px;border-top:1px solid rgba(255,255,255,0.05)">
          <div class="fsp-block">
            <div class="fsp-row">
              <div style="flex:1"><div class="fsp-row-title">Kr\u00e6v MFA for for\u00e6ldre ved ny enhed</div><div class="fsp-row-desc">For\u00e6ldre skal bruge authenticator-app f\u00f8rste gang de logger ind p\u00e5 en ny enhed i for\u00e6ldreportalen.</div></div>
              <div class="fsp-toggle${parentMfa ? ' on' : ''}" data-field="parent_mfa_new_device"></div>
            </div>
          </div>
        </div>
        <div class="fsp-save-row"><button class="fsp-save-btn" data-action="save-settings">Gem indstillinger</button></div>
      </div>`;
    },
    wire(container, ctx) {
      pageAlign(container);
      wireToggles(container, ctx);
      wireRadios(container, ctx);
      wireSaveButton(container, ctx);
    }
  };

  // ── Auto-sletning af inaktive (settings section) ──
  sections['Auto-sletning af inaktive'] = {
    render(ctx) {
      const inst = ctx.institutionData || {};
      const enabled = !!inst.auto_delete_inactive_enabled;
      const months = inst.auto_delete_inactive_months || 12;
      return `<div class="fsp-page">
        <div class="fsp-page-title">Auto-sletning af inaktive brugere</div>
        <div class="fsp-page-desc">N\u00e5r auto-sletning er aktiveret, slettes brugere der ikke har v\u00e6ret aktive i den valgte periode automatisk. For\u00e6ldre modtager en advarsel via e-mail 30 dage inden sletning.</div>
        <div class="fsp-main-toggle">
          <div style="flex:1"><div class="fsp-main-title">Aktiv\u00e9r auto-sletning</div><div class="fsp-main-desc">Brugere der ikke har handlet eller logget ind slettes automatisk.</div></div>
          <div class="fsp-toggle${enabled ? ' on' : ''}" data-field="auto_delete_inactive_enabled" data-expand="ad-body"></div>
        </div>
        <div class="fsp-expand${enabled ? ' open' : ''}" data-expand-target="ad-body">
          <div style="font-size:12px;font-weight:600;color:var(--fsp-txt3);text-transform:uppercase;letter-spacing:0.6px;margin-bottom:12px">INAKTIVITETSPERIODE</div>
          ${[
            { m: 6, h: 'Anbefalet for aktive institutioner' },
            { m: 12, h: 'Standard bevaringsperiode' },
            { m: 24, h: 'L\u00e6ngere bevaringsperiode' }
          ].map(opt => `<div class="fsp-sub">
            <div><div class="fsp-sub-title">${opt.m} m\u00e5neder</div><div class="fsp-sub-hint">${opt.h}</div></div>
            <div class="fsp-radio${months === opt.m ? ' on' : ''}" data-field="auto_delete_inactive_months" data-value="${opt.m}"></div>
          </div>`).join('')}
          <div style="font-size:12px;color:var(--fsp-txt3);margin-top:14px;padding:12px 16px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.04);border-radius:10px;line-height:1.5">For\u00e6ldre advares automatisk 30 dage inden sletning via e-mail.</div>
        </div>
        <div class="fsp-save-row"><button class="fsp-save-btn" data-action="save-settings">Gem indstillinger</button></div>
      </div>`;
    },
    wire(container, ctx) {
      pageAlign(container);
      wireToggles(container, ctx);
      wireSaveButton(container, ctx);
      // Expand/collapse
      container.querySelector('[data-expand]')?.addEventListener('click', function () {
        const target = container.querySelector(`[data-expand-target="${this.dataset.expand}"]`);
        if (target) target.classList.toggle('open', this.classList.contains('on'));
      });
      // Wire radios manually with parseInt for number type (instead of wireRadios which passes string)
      container.querySelectorAll('.fsp-radio[data-field="auto_delete_inactive_months"]').forEach(radio => {
        radio.addEventListener('click', () => {
          const field = radio.dataset.field;
          container.querySelectorAll(`.fsp-radio[data-field="${field}"]`).forEach(r => r.classList.remove('on'));
          radio.classList.add('on');
          ctx.markDirty(field, parseInt(radio.dataset.value));
        });
      });
    }
  };

  // ── Mine enheder (async action section) ──
  sections['Mine enheder'] = {
    render(ctx) {
      return `<div class="fsp-page">
        <div class="fsp-page-title">Mine enheder</div>
        <div class="fsp-page-desc">Enheder der er husket via \u201CHusk mig\u201D. Fjern en enhed for at kr\u00e6ve login igen.</div>
        <div data-devices-list style="min-height:60px">
          <div style="text-align:center;padding:24px;color:var(--fsp-txt3);font-size:13px">Indl\u00e6ser enheder...</div>
        </div>
        <div style="border-top:1px solid rgba(255,255,255,0.08);margin-top:16px;padding-top:16px">
          <button class="fsp-btn" data-action="revoke-all" style="width:100%;display:flex;justify-content:center;padding:14px;background:rgba(232,90,111,0.08);color:#e85a6f;border:1px solid rgba(232,90,111,0.15)">Fjern alle enheder</button>
        </div>
      </div>`;
    },
    wire(container, ctx) {
      pageAlign(container);
      const listEl = container.querySelector('[data-devices-list]');
      const trust = window.__flangoDeviceTrust;

      // Load devices
      async function loadDevices() {
        if (!trust?.getMyDeviceTokens) {
          listEl.innerHTML = '<div style="text-align:center;padding:24px;color:var(--fsp-txt3);font-size:13px">Enhedstjeneste er ikke tilg\u00e6ngelig.</div>';
          return;
        }
        try {
          const tokens = await trust.getMyDeviceTokens();
          if (!tokens || tokens.length === 0) {
            listEl.innerHTML = '<div style="text-align:center;padding:24px;color:var(--fsp-txt3);font-size:13px">Ingen enheder registreret.</div>';
            return;
          }
          listEl.innerHTML = tokens.map(t => {
            const name = t.device_name || t.name || 'Ukendt enhed';
            const lastUsed = t.last_used_at ? new Date(t.last_used_at).toLocaleDateString('da-DK') : '';
            return `<div class="fsp-device-row" data-token-id="${t.id}">
              <div class="fsp-device-emoji">\uD83D\uDCF1</div>
              <div class="fsp-device-left">
                <div class="fsp-device-title">${name}</div>
                ${lastUsed ? `<div class="fsp-device-meta">Sidst brugt: ${lastUsed}</div>` : ''}
              </div>
              <button class="fsp-btn fsp-btn-ghost" data-action="revoke" style="padding:8px 16px;font-size:12px;color:#e85a6f;border-color:rgba(232,90,111,0.2)">Fjern</button>
            </div>`;
          }).join('');
        } catch (e) {
          listEl.innerHTML = '<div style="text-align:center;padding:24px;color:var(--fsp-txt3);font-size:13px">Kunne ikke hente enheder.</div>';
        }
      }
      loadDevices();

      // Revoke single device
      listEl.addEventListener('click', async (e) => {
        const btn = e.target.closest('[data-action="revoke"]');
        if (!btn) return;
        const row = btn.closest('[data-token-id]');
        const tokenId = row?.dataset.tokenId;
        if (!tokenId) return;
        btn.textContent = 'Fjerner...';
        btn.disabled = true;
        const result = await trust.revokeDeviceToken(tokenId);
        if (result?.success) {
          row.remove();
          if (!listEl.querySelector('.fsp-device-row')) {
            listEl.innerHTML = '<div style="text-align:center;padding:24px;color:var(--fsp-txt3);font-size:13px">Ingen enheder registreret.</div>';
          }
        } else {
          btn.textContent = 'Fjern';
          btn.disabled = false;
        }
      });

      // Revoke all
      container.querySelector('[data-action="revoke-all"]')?.addEventListener('click', async function () {
        this.textContent = 'Fjerner...';
        this.disabled = true;
        const result = await trust?.revokeAllDeviceTokens?.();
        trust?.clearAllDeviceUsers?.();
        listEl.innerHTML = '<div style="text-align:center;padding:24px;color:var(--fsp-txt3);font-size:13px">Alle enheder fjernet.</div>';
        this.textContent = 'Fjern alle enheder';
        this.disabled = false;
      });
    }
  };

  // ── Saldoliste ved låsning (localStorage toggle — no dirty-tracking) ──
  sections['Saldoliste ved låsning'] = {
    render(ctx) {
      const instId = window.getInstitutionId?.() || window.__flangoInstitutionId || '';
      const key = `flango_balance_download_on_lock_${instId}`;
      const enabled = localStorage.getItem(key) !== 'false';
      return `<div class="fsp-page">
        <div class="fsp-page-title">Saldoliste ved l\u00e5sning</div>
        <div class="fsp-page-desc">Download en komplet saldoliste (CSV) automatisk n\u00e5r caf\u00e9en l\u00e5ses. Nyttig til daglig afstemning.</div>
        <div class="fsp-main-toggle">
          <div style="flex:1"><div class="fsp-main-title">Download saldoliste ved l\u00e5sning</div><div class="fsp-main-desc">Genererer automatisk en CSV-fil med alle brugere og deres saldo.</div></div>
          <div class="fsp-toggle${enabled ? ' on' : ''}" data-action="toggle-balance-lock"></div>
        </div>
      </div>`;
    },
    wire(container, ctx) {
      pageAlign(container);
      const toggle = container.querySelector('[data-action="toggle-balance-lock"]');
      toggle?.addEventListener('click', () => {
        toggle.classList.toggle('on');
        const instId = window.getInstitutionId?.() || window.__flangoInstitutionId || '';
        const key = `flango_balance_download_on_lock_${instId}`;
        localStorage.setItem(key, toggle.classList.contains('on'));
      });
    }
  };

  // ── Anmod om nulstilling (destructive action section) ──
  sections['Anmod om nulstilling'] = {
    render(ctx) {
      return `<div class="fsp-page">
        <div class="fsp-page-title">Anmod om nulstilling</div>
        <div class="fsp-collapse-btn" data-action="toggle-reset" style="border-color:rgba(232,90,111,0.2);background:rgba(232,90,111,0.04)">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="#e85a6f" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6 4l4 4-4 4"/></svg>
          <span style="color:#e85a6f">Anmod om nulstilling af system</span>
        </div>
        <div class="fsp-collapse-body" data-collapse="reset-body">
          <div class="fsp-collapse-body-inner">
            <div style="background:rgba(232,90,111,0.06);border:1px solid rgba(232,90,111,0.15);border-radius:12px;padding:18px 20px">
              <div style="font-size:13px;color:var(--fsp-txt2);margin-bottom:14px;line-height:1.6">Ved nulstilling slettes al caf\u00e9data permanent: brugere, salg, produkter, arrangementer og statistik. Din admin-konto og institutionen bevares. Anmodningen sendes til Flango-teamet, som behandler den manuelt.</div>
              <div style="font-size:12px;font-weight:500;color:var(--fsp-txt2);margin-bottom:6px">Beskriv kort hvorfor (valgfrit)</div>
              <textarea class="fsp-input" placeholder="Beskriv kort hvorfor (valgfrit)" data-reset-reason style="min-height:80px;margin-bottom:14px;background:rgba(255,255,255,0.03);border-color:rgba(232,90,111,0.15)"></textarea>
              <div style="display:flex;gap:10px;justify-content:flex-end">
                <button class="fsp-btn fsp-btn-ghost" data-action="cancel-reset">Annuller</button>
                <button class="fsp-btn" data-action="open-reset" style="background:#e85a6f;color:#fff;padding:11px 28px">Send anmodning</button>
              </div>
            </div>
          </div>
        </div>
      </div>`;
    },
    wire(container, ctx) {
      pageAlign(container);
      const toggleBtn = container.querySelector('[data-action="toggle-reset"]');
      const body = container.querySelector('[data-collapse="reset-body"]');
      toggleBtn?.addEventListener('click', () => {
        toggleBtn.classList.toggle('open');
        body?.classList.toggle('open');
      });
      container.querySelector('[data-action="cancel-reset"]')?.addEventListener('click', () => {
        toggleBtn?.classList.remove('open');
        body?.classList.remove('open');
      });
      container.querySelector('[data-action="open-reset"]')?.addEventListener('click', () => {
        window.FlangoSettings.close();
        window.openResetRequestDialog?.();
      });
    }
  };

  // ═══════════════════════════════════════════════════
  // DIVERSE
  // ═══════════════════════════════════════════════════

  // ── Udseende (standalone — live save to theme-loader/localStorage) ──
  sections['Udseende'] = {
    render(ctx) {
      const current = window.__flangoTheme?.getCurrentTheme?.() || localStorage.getItem('flango-ui-theme') || 'klart';
      const themes = [
        { id: 'klart', name: 'Klart', desc: 'Rent og roligt design med bl\u00f8de pastelfarver', bg: 'linear-gradient(135deg, #f8f6f0, #ebe7df)', accent: '#e8734a', accent2: '#f4a261', card: '#ffffff', sidebar: '#f0ede7', txt: '#2d2a25' },
        { id: 'flango-unstoppable', name: 'Flango Unstoppable', desc: 'Fedt og energisk med lilla accenter og gul kurv', bg: 'linear-gradient(135deg, #1a1d27, #252830)', accent: '#e8734a', accent2: '#f4a261', card: '#2a2d36', sidebar: '#1e2028', txt: '#e4e6eb' },
        { id: 'aurora', name: 'Aurora', desc: 'M\u00f8rkt tema med neon-cyan og magenta accenter', bg: 'linear-gradient(135deg, #0f1923, #162233)', accent: '#5ba0d8', accent2: '#7bb8e0', card: '#1a2a3a', sidebar: '#0d1620', txt: '#c8d6e5' }
      ];
      return `<div class="fsp-page">
        <div class="fsp-page-title">Udseende</div>
        <div class="fsp-page-desc">V\u00e6lg tema for caf\u00e9en.</div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px">
          ${themes.map(t => `<div class="fsp-theme-card${current === t.id ? ' active' : ''}" data-theme="${t.id}">
            <div class="fsp-theme-preview" style="background:${t.bg};display:flex;gap:6px;overflow:hidden">
              <div style="width:28%;background:${t.sidebar};border-radius:6px;padding:6px">
                <div style="height:5px;width:70%;border-radius:2px;background:${t.accent};margin-bottom:4px"></div>
                <div style="height:4px;width:90%;border-radius:2px;background:${t.txt};opacity:0.12;margin-bottom:3px"></div>
                <div style="height:4px;width:60%;border-radius:2px;background:${t.txt};opacity:0.08;margin-bottom:3px"></div>
                <div style="height:4px;width:75%;border-radius:2px;background:${t.txt};opacity:0.08"></div>
              </div>
              <div style="flex:1;display:flex;flex-direction:column;gap:4px;padding:4px 0">
                <div style="display:flex;gap:4px;flex:1">
                  <div style="flex:1;border-radius:5px;background:${t.card};border:1px solid ${t.txt}12"></div>
                  <div style="flex:1;border-radius:5px;background:${t.accent};opacity:0.8"></div>
                  <div style="flex:1;border-radius:5px;background:${t.card};border:1px solid ${t.txt}12"></div>
                </div>
                <div style="display:flex;gap:4px;flex:1">
                  <div style="flex:1;border-radius:5px;background:${t.card};border:1px solid ${t.txt}12"></div>
                  <div style="flex:1;border-radius:5px;background:${t.accent2};opacity:0.6"></div>
                  <div style="flex:1;border-radius:5px;background:${t.card};border:1px solid ${t.txt}12"></div>
                </div>
              </div>
            </div>
            <div class="fsp-theme-name">${t.name}</div>
            <div class="fsp-theme-desc">${t.desc}</div>
          </div>`).join('')}
        </div>
      </div>`;
    },
    wire(container, ctx) {
      pageAlign(container);
      container.querySelectorAll('.fsp-theme-card').forEach(card => {
        card.addEventListener('click', () => {
          container.querySelectorAll('.fsp-theme-card').forEach(c => c.classList.remove('active'));
          card.classList.add('active');
          const themeId = card.dataset.theme;
          if (window.__flangoTheme?.switchTheme) {
            window.__flangoTheme.switchTheme(themeId);
          } else {
            localStorage.setItem('flango-ui-theme', themeId);
          }
        });
      });
    }
  };

  // Note: Dagens Sortiment, Min Flango, Log ud are TRIGGERS — not rendered here.

  // ── Hjælp (read-only searchable accordion) ──
  sections['Hjælp'] = {
    render(ctx) {
      const topics = [
        { t: 'Om Flango', b: 'Flango er et digitalt caf\u00e9system til SFO og klub, som hj\u00e6lper b\u00e5de b\u00f8rn og voksne med at holde styr p\u00e5 saldoer, salg, indbetalinger og statistik.' },
        { t: 'Tastatur genveje', b: 'TAB/+ \u00e5bner brugervælger. Piletaster navigerer. ENTER vælger. ESC lukker vinduer. SPACE gennemf\u00f8rer k\u00f8b. BACKSPACE/-/0 fjerner fra kurv. R/I \u00e5bner Rediger. H \u00e5bner Historik.' },
        { t: 'Historik', b: 'I Historik kan du se alle tidligere salg og indbetalinger. Filtr\u00e9r p\u00e5 datoer, se hvem der har k\u00f8bt hvad, og ret salg s\u00e5 saldo og historik altid passer.' },
        { t: 'Indbetaling', b: 'V\u00e6lg barnet, v\u00e6lg bel\u00f8b, registr\u00e9r betalingsmetode (MobilePay/kontant), og gem. Saldoen opdateres med det samme.' },
        { t: 'Rediger Bruger', b: 'Justér stamdata: navn, kontonummer, PIN-kode, start-/korrektionssaldo. Du kan ogs\u00e5 lukke brugere der ikke l\u00e6ngere g\u00e5r i institutionen.' },
        { t: 'Feedback', b: 'Brug feedback-menuen til at melde fejl, \u00f8nske nye funktioner, eller dele gode id\u00e9er fra b\u00f8rn og kolleger.' },
        { t: 'Admin vs Bruger', b: 'Admin (p\u00e6dagog) kan \u00e5bne/lukke caf\u00e9, se historik, \u00e6ndre saldoer og regler. Bruger/ekspedient (barn) kan betjene kassen og gennemf\u00f8re k\u00f8b.' },
        { t: 'For\u00e6ldreportal', b: 'For\u00e6ldre kan se barnets saldo, overblik over k\u00f8b, og evt. f\u00e5 saldo-advarsler pr. e-mail. Adgang via kode eller link.' },
        { t: 'Institutionens Regler', b: 'Beskriv jeres rammer for caf\u00e9en: dagligt max-k\u00f8b, sukkerregler, \u00e5bningstider, ekspedient-regler.' },
        { t: 'Log Ud vs L\u00e5s Caf\u00e9', b: 'Log ud: afslutter session, kr\u00e6ver nyt login. L\u00e5s caf\u00e9: midlertidig pause, kan \u00e5bnes igen uden login.' },
        { t: 'Kontakt & Support', b: 'Kontakt den lokale Flango-ansvarlige, send feedback via appen, eller brug den aftalte kontaktmetode.' }
      ];
      return `<div class="fsp-page" style="max-width:720px">
        <div class="fsp-page-title">Hj\u00e6lp til Flango</div>
        <div class="fsp-page-desc">Her finder du information om alle Flango's funktioner.</div>
        <div class="fsp-help-search-wrap">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="var(--fsp-txt3)" stroke-width="1.4" stroke-linecap="round"><circle cx="7" cy="7" r="4.5"/><path d="M10.5 10.5L14 14"/></svg>
          <input class="fsp-help-search" placeholder="S\u00f8g i manualen..." data-help-search>
        </div>
        ${topics.map(topic => `<div class="fsp-help-item" data-help-title="${topic.t.toLowerCase()}" data-help-body="${topic.b.toLowerCase()}">
          <div class="fsp-help-hdr" data-action="toggle-help">
            <div class="fsp-help-hdr-title">${topic.t}</div>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6l4 4 4-4"/></svg>
          </div>
          <div class="fsp-help-body"><div class="fsp-help-body-inner">${topic.b}</div></div>
        </div>`).join('')}
      </div>`;
    },
    wire(container, ctx) {
      pageAlign(container);
      // Toggle accordion items
      container.querySelectorAll('[data-action="toggle-help"]').forEach(hdr => {
        hdr.addEventListener('click', () => {
          hdr.closest('.fsp-help-item')?.classList.toggle('open');
        });
      });
      // Search filter
      container.querySelector('[data-help-search]')?.addEventListener('input', function () {
        const q = this.value.toLowerCase();
        container.querySelectorAll('.fsp-help-item').forEach(item => {
          const title = item.dataset.helpTitle || '';
          const body = item.dataset.helpBody || '';
          item.style.display = (!q || title.includes(q) || body.includes(q)) ? '' : 'none';
        });
      });
    }
  };

  // ── Opdateringer (action section) ──
  sections['Opdateringer'] = {
    render(ctx) {
      const versionInfo = window.__flangoVersionCheck?.getVersionInfo?.();
      const version = versionInfo?.localVersion || window.FLANGO_VERSION || '?';
      return `<div class="fsp-page" style="max-width:720px">
        <div class="fsp-page-title">Opdateringer</div>
        <div class="fsp-block" style="margin-bottom:24px">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
            <div style="font-size:13px;color:var(--fsp-txt3)">Installeret version</div>
            <div style="font-size:15px;font-weight:600;color:var(--fsp-txt);font-family:monospace">v${version}</div>
          </div>
          <div style="display:flex;align-items:center;gap:8px;padding:10px 14px;background:rgba(93,202,122,0.08);border:1px solid rgba(93,202,122,0.15);border-radius:10px">
            <span style="color:#5dca7a;font-size:14px">\u2713</span>
            <span style="font-size:13px;color:#5dca7a;font-weight:500" data-status="version-status">Du k\u00f8rer den nyeste version</span>
          </div>
        </div>
        <div style="display:flex;gap:10px">
          <button class="fsp-btn fsp-btn-ghost" data-action="reload" style="flex:1;display:flex;justify-content:center;padding:14px;align-items:center;gap:8px">\uD83D\uDD04 Genindl\u00e6s app</button>
          <button class="fsp-btn fsp-btn-primary" data-action="check-update" style="flex:1;display:flex;justify-content:center;padding:14px">Tjek for opdateringer</button>
        </div>
      </div>`;
    },
    wire(container, ctx) {
      pageAlign(container);
      container.querySelector('[data-action="reload"]')?.addEventListener('click', () => {
        location.reload();
      });
      container.querySelector('[data-action="check-update"]')?.addEventListener('click', async () => {
        const btn = container.querySelector('[data-action="check-update"]');
        const statusEl = container.querySelector('[data-status="version-status"]');
        if (btn) { btn.textContent = 'Tjekker...'; btn.disabled = true; }
        try {
          if (window.__flangoVersionCheck?.checkForUpdates) {
            await window.__flangoVersionCheck.checkForUpdates();
          }
          if (statusEl) statusEl.textContent = 'Tjek gennemf\u00f8rt \u2014 du k\u00f8rer den nyeste version';
        } catch (e) {
          if (statusEl) { statusEl.textContent = 'Kunne ikke tjekke for opdateringer'; statusEl.style.color = '#e85a6f'; }
        }
        if (btn) { btn.textContent = 'Tjek for opdateringer'; btn.disabled = false; }
      });
    }
  };

  // ── Feedback (standalone — send button, moved from logout modal) ──
  sections['Feedback'] = {
    render(ctx) {
      return `<div class="fsp-page" style="max-width:720px">
        <div class="fsp-page-title">Feedback</div>
        <div class="fsp-page-desc">Del dine tanker med Flango-teamet. Foresl\u00e5 forbedringer, rapport\u00e9r fejl, eller del gode id\u00e9er fra b\u00f8rn og kolleger.</div>
        <div class="fsp-form-group">
          <div class="fsp-form-label">Hvad drejer det sig om?</div>
          <div class="fsp-feedback-chips" data-fb-chips></div>
        </div>
        <div class="fsp-form-group">
          <div class="fsp-form-label">Din besked</div>
          <textarea class="fsp-input" data-fb-message placeholder="Beskriv dit forslag, den fejl du oplevede, eller hvad du ellers har p\u00e5 hjerte..." style="min-height:120px"></textarea>
        </div>
        <div style="display:flex;justify-content:flex-end;margin-bottom:40px">
          <button class="fsp-btn fsp-btn-primary" data-action="send-feedback" style="padding:12px 36px;display:flex;align-items:center;gap:8px">\uD83D\uDCE8 Send feedback</button>
        </div>
        <div style="padding-top:24px;border-top:1px solid rgba(255,255,255,0.05)">
          <div class="fsp-collapse-btn" data-action="toggle-bug">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6 4l4 4-4 4"/></svg>
            <span style="display:flex;align-items:center;gap:8px">\uD83D\uDC1B Fejlrapport <span class="fsp-pm-badge fsp-pm-badge-gray">Developer feature</span></span>
          </div>
          <div class="fsp-collapse-body" data-collapse="bug-body">
            <div class="fsp-collapse-body-inner">
              <div style="font-size:12px;color:var(--fsp-txt3);margin-bottom:14px;line-height:1.5">Genererer en teknisk rapport med system-info, konsol-log og seneste handlinger. Kan deles med Flango-teamet ved fejls\u00f8gning.</div>
              <div class="fsp-form-group" style="margin-bottom:14px">
                <div class="fsp-form-label">Beskriv kort hvad der skete (valgfrit)</div>
                <textarea class="fsp-input" data-bug-desc placeholder="f.eks. Kurven blev tom efter jeg trykkede gennemf\u00f8r..." style="min-height:64px"></textarea>
              </div>
              <button class="fsp-btn fsp-btn-ghost" data-action="download-bug-report" style="width:100%;display:flex;justify-content:center;padding:14px;gap:8px">\uD83D\uDC1B Download fejlrapport</button>
            </div>
          </div>
        </div>
      </div>`;
    },
    wire(container, ctx) {
      pageAlign(container);
      // Build feedback type chips
      const chipsEl = container.querySelector('[data-fb-chips]');
      ['\uD83D\uDCA1 Forslag', '\uD83D\uDC1B Fejl', '\u2753 Sp\u00f8rgsm\u00e5l', '\uD83D\uDCAC Andet'].forEach((t, i) => {
        const chip = document.createElement('div');
        chip.className = 'fsp-chip' + (i === 0 ? ' on' : '');
        chip.textContent = t;
        chip.addEventListener('click', () => {
          chipsEl.querySelectorAll('.fsp-chip').forEach(c => c.classList.remove('on'));
          chip.classList.add('on');
        });
        chipsEl.appendChild(chip);
      });

      // Send feedback
      container.querySelector('[data-action="send-feedback"]')?.addEventListener('click', async function () {
        const message = container.querySelector('[data-fb-message]')?.value?.trim();
        const type = chipsEl.querySelector('.fsp-chip.on')?.textContent?.trim() || '';
        if (!message) return;
        this.textContent = 'Sender...';
        this.disabled = true;
        try {
          const client = window.__flangoSupabaseClient;
          if (client) {
            await client.from('feedback').insert({
              institution_id: window.getInstitutionId?.(),
              message: message,
              type: type,
              source: 'settings-panel'
            });
          }
          container.querySelector('[data-fb-message]').value = '';
          this.textContent = '\u2713 Sendt!';
          setTimeout(() => { this.textContent = '\uD83D\uDCE8 Send feedback'; this.disabled = false; }, 2000);
        } catch (e) {
          this.textContent = 'Fejl ved afsendelse';
          setTimeout(() => { this.textContent = '\uD83D\uDCE8 Send feedback'; this.disabled = false; }, 2000);
        }
      });

      // Bug report collapse
      const bugToggle = container.querySelector('[data-action="toggle-bug"]');
      const bugBody = container.querySelector('[data-collapse="bug-body"]');
      bugToggle?.addEventListener('click', () => {
        bugToggle.classList.toggle('open');
        bugBody?.classList.toggle('open');
      });

      // Download bug report
      container.querySelector('[data-action="download-bug-report"]')?.addEventListener('click', () => {
        window.FLANGO_DEBUG?.showBugReportPrompt?.();
      });
    }
  };

  // ── Lydindstillinger (standalone — live save to SoundManager/localStorage) ──
  sections['Lydindstillinger'] = {
    render(ctx) {
      const sm = window.__flangoSoundManager;
      const muted = sm?.isGlobalMuted?.() || false;
      const masterVol = Math.round((sm?.getMasterVolume?.() ?? 1) * 100);
      const sndRows = [
        { key: 'addItem', label: 'Tilf\u00f8j vare', emoji: '\uD83D\uDED2' },
        { key: 'removeItem', label: 'Fjern vare', emoji: '\u274C' },
        { key: 'purchase', label: 'Gennemf\u00f8r k\u00f8b', emoji: '\u2705' },
        { key: 'error', label: 'Fejl', emoji: '\u26A0\uFE0F' }
      ];
      const sounds = ['Ingen lyd', 'Add 1', 'Add 2', 'Add 3', 'Slet', 'Accept 1', 'Accept 2', 'Accept 3', 'Fejl 1', 'Fejl 2', 'Ding', 'Bell', 'Chime', 'Pop'];
      return `<div class="fsp-page" style="max-width:720px">
        <div class="fsp-page-title">Lydindstillinger</div>
        <div class="fsp-page-desc">V\u00e6lg lyde og juster lydstyrke for caf\u00e9systemet.</div>
        <div class="fsp-block" style="margin-bottom:24px">
          <div class="fsp-row" style="margin-bottom:14px">
            <div style="flex:1"><div class="fsp-row-title">\uD83D\uDD07 Mute alle lyde</div></div>
            <div class="fsp-toggle${muted ? ' on' : ''}" data-action="snd-mute"></div>
          </div>
          <div style="padding-top:14px;border-top:1px solid rgba(255,255,255,0.04)">
            <div style="font-size:13px;font-weight:500;color:var(--fsp-txt);margin-bottom:8px">Master volume</div>
            <div class="fsp-snd-slider-wrap">
              <span style="font-size:14px">\uD83D\uDD08</span>
              <input type="range" min="0" max="100" value="${masterVol}" data-action="snd-master">
              <span class="fsp-snd-val" data-val="snd-master">${masterVol}%</span>
              <span style="font-size:14px">\uD83D\uDD0A</span>
            </div>
          </div>
        </div>
        <div data-snd-body class="${muted ? 'fsp-off' : ''}">
          <div style="font-size:12px;font-weight:600;color:var(--fsp-txt3);text-transform:uppercase;letter-spacing:0.6px;margin-bottom:12px">V\u00e6lg lyde</div>
          ${sndRows.map(r => {
            const vol = Math.round((sm?.getSoundVolume?.(r.key) ?? 1) * 100);
            const currentFile = sm?.getSoundFile?.(r.key) || '';
            return `<div class="fsp-snd-row">
              <div class="fsp-snd-row-top">
                <span style="font-size:15px">${r.emoji}</span>
                <div class="fsp-snd-row-label">${r.label}</div>
                <select class="fsp-snd-select" data-snd-key="${r.key}">${sounds.map(s => `<option${currentFile.toLowerCase().includes(s.toLowerCase().replace(/ /g, '')) ? ' selected' : ''}>${s}</option>`).join('')}</select>
                <button class="fsp-snd-play" title="Afspil" data-play="${r.key}"><svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor"><path d="M4 2.5v11l9-5.5z"/></svg></button>
              </div>
              <div class="fsp-snd-slider-wrap">
                <span style="font-size:12px;color:var(--fsp-txt3)">Volume</span>
                <input type="range" min="0" max="100" value="${vol}" data-snd-vol="${r.key}">
                <span class="fsp-snd-val" data-val="snd-${r.key}">${vol}%</span>
              </div>
            </div>`;
          }).join('')}
        </div>
        <div class="fsp-save-row" style="margin-top:24px"><button class="fsp-save-btn" data-action="snd-save" style="padding:12px 36px">Gem indstillinger</button></div>
      </div>`;
    },
    wire(container, ctx) {
      pageAlign(container);
      const sm = window.__flangoSoundManager || {};

      // Helper: mark sound save button as dirty
      function markSndDirty() {
        const btn = container.querySelector('[data-action="snd-save"]');
        if (btn) btn.classList.add('dirty');
      }

      // Mute toggle
      container.querySelector('[data-action="snd-mute"]')?.addEventListener('click', function () {
        this.classList.toggle('on');
        sm.setGlobalMute?.(this.classList.contains('on'));
        container.querySelector('[data-snd-body]')?.classList.toggle('fsp-off', this.classList.contains('on'));
        markSndDirty();
      });

      // Master volume
      container.querySelector('[data-action="snd-master"]')?.addEventListener('input', function () {
        sm.setMasterVolume?.(parseInt(this.value) / 100);
        const label = container.querySelector('[data-val="snd-master"]');
        if (label) label.textContent = this.value + '%';
        markSndDirty();
      });

      // Per-sound volume
      container.querySelectorAll('[data-snd-vol]').forEach(slider => {
        slider.addEventListener('input', function () {
          sm.setSoundVolume?.(this.dataset.sndVol, parseInt(this.value) / 100);
          const label = container.querySelector(`[data-val="snd-${this.dataset.sndVol}"]`);
          if (label) label.textContent = this.value + '%';
          markSndDirty();
        });
      });

      // Sound file mapping (display name → file path)
      const soundFileMap = {
        'Ingen lyd': '',
        'Add 1': 'sounds/Add%20Item/Add1.mp3',
        'Add 2': 'sounds/Add%20Item/Add2.mp3',
        'Slet': 'sounds/Delete%20Item/Slet.mp3',
        'Slet 1': 'sounds/Delete%20Item/Slet1.mp3',
        'Slet 2': 'sounds/Delete%20Item/Slet2.mp3',
        'Slet 3': 'sounds/Delete%20Item/Slet3.mp3',
        'Slet 4': 'sounds/Delete%20Item/Slet4.mp3',
        'Accept 1': 'sounds/Accept/accepter-1.mp3',
        'Accept 2': 'sounds/Accept/accepter-2.mp3',
        'Accept 3': 'sounds/Accept/accepter-3.mp3',
        'Accept 4': 'sounds/Accept/accepter-4.mp3',
        'Accept 5': 'sounds/Accept/accepter-5.mp3',
        'Fejl 1': 'sounds/Error/Fejl1.mp3',
        'Fejl 2': 'sounds/Error/Fejl2.mp3',
        'Fejl 3': 'sounds/Error/Fejl3.mp3',
        'Login 1': 'sounds/Login/Login1.mp3',
        'Login 2': 'sounds/Login/Login2.mp3'
      };

      // Dropdown change → update SoundManager file mapping
      container.querySelectorAll('.fsp-snd-select[data-snd-key]').forEach(sel => {
        sel.addEventListener('change', () => {
          const filePath = soundFileMap[sel.value] || '';
          sm.setSoundFile?.(sel.dataset.sndKey, filePath);
          markSndDirty();
        });
      });

      // Play buttons — preview the selected sound file directly
      container.querySelectorAll('[data-play]').forEach(btn => {
        btn.addEventListener('click', () => {
          const key = btn.dataset.play;
          const sel = container.querySelector(`.fsp-snd-select[data-snd-key="${key}"]`);
          const filePath = soundFileMap[sel?.value] || sm.getSoundFile?.(key);
          if (!filePath) return;
          const audio = new Audio(filePath);
          const vol = (sm.getMasterVolume?.() ?? 1) * (sm.getSoundVolume?.(key) ?? 1);
          audio.volume = Math.min(1, vol);
          audio.play().catch(() => {});
        });
      });

      // Save button (saves to localStorage via SoundManager — already persisted on each change)
      container.querySelector('[data-action="snd-save"]')?.addEventListener('click', function () {
        this.textContent = 'Gemt!';
        this.classList.remove('dirty');
        setTimeout(() => { this.textContent = 'Gem indstillinger'; }, 1500);
      });
    }
  };

  // ═══════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════

  function placeholder(label, desc, ctx) {
    const color = findColor(label);
    return `<div class="fsp-ph">
      <div class="fsp-ph-ring">${ctx.ic(label, color)}</div>
      <div class="fsp-ph-title">${label}</div>
      <div class="fsp-ph-desc">${desc}</div>
    </div>`;
  }

  function findColor(label) {
    for (const tab of (window.FlangoSettings?.T || [])) {
      for (const it of tab.items) {
        if (it.l === label) return it.c;
      }
    }
    return '#e8734a';
  }

  // ── Public API ──
  window.FlangoSettingsSections = {
    render(key, ctx) {
      const section = sections[key];
      if (!section) return null;
      return section.render(ctx);
    },
    wire(key, container, ctx) {
      const section = sections[key];
      if (section?.wire) section.wire(container, ctx);
    },
    applyFeatureLocks,
  };

})();
