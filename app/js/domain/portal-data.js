// portal-data.js — Data-lag for Admin Portal v2 (ES module)
// Ansvar: Hent og gem institutions-indstillinger, forældre-statistik, forældreliste, adoption-data.
// Importerer supabaseClient direkte fra config-and-supabase.js (samme autentificerede klient).

import { supabaseClient } from '../core/config-and-supabase.js?v=3.0.64';
import { getInstitutionId } from './session-store.js?v=3.0.64';

// ─── Hjælpere ──────────────────────────────────────────────────

/** Resolve institution ID: brug argument, ellers session-store, ellers localStorage */
function resolveInstitutionId(institutionId) {
  if (institutionId) return institutionId;
  if (typeof getInstitutionId === 'function') {
    const id = getInstitutionId();
    if (id) return id;
  }
  const stored = localStorage.getItem('flango_institution_id');
  if (stored) return stored;
  console.warn('[portal-data] Ingen institutionId fundet');
  return null;
}

/** Returner supabaseClient */
function db() {
  if (supabaseClient) return supabaseClient;
  console.error('[portal-data] supabaseClient er ikke tilgængelig');
  return null;
}

/** Start af indeværende måned (lokal tid) som ISO-streng */
function startOfMonth() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
}

/** Start af indeværende dag (lokal tid) som ISO-streng */
function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
}

/** n dage siden som ISO-streng */
function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

// ─── Feature Flags ────────────────────────────────────────────

/** Cache for feature flags (invalideres ved nyt institutionsvalg) */
let _featureFlagsCache = null;
let _featureFlagsCacheId = null;

/**
 * Hent feature flags for institution.
 * Returnerer objekt: { moduleKey: 'unlocked'|'forced_on'|'forced_off', ... }
 * Tomt objekt = alt ulåst = uændret adfærd.
 */
async function getFeatureFlags(institutionId) {
  const client = db();
  const instId = resolveInstitutionId(institutionId);
  if (!client || !instId) return {};

  // Cache-hit
  if (_featureFlagsCacheId === instId && _featureFlagsCache) return _featureFlagsCache;

  try {
    const { data, error } = await client.rpc('get_feature_flags', { p_institution_id: instId });
    if (error) {
      console.warn('[portal-data] Kunne ikke hente feature flags:', error.message);
      return {};
    }
    _featureFlagsCache = data || {};
    _featureFlagsCacheId = instId;
    return _featureFlagsCache;
  } catch (e) {
    console.warn('[portal-data] Fejl i getFeatureFlags:', e);
    return {};
  }
}

/**
 * Hent feature constraints for institution.
 * Returnerer objekt: { constraintKey: jsonbValue, ... }
 * Tomt objekt = ingen constraints = uændret adfærd.
 */
async function getFeatureConstraints(institutionId) {
  const client = db();
  const instId = resolveInstitutionId(institutionId);
  if (!client || !instId) return {};

  try {
    const { data, error } = await client.rpc('get_feature_constraints', { p_institution_id: instId });
    if (error) {
      console.warn('[portal-data] Kunne ikke hente feature constraints:', error.message);
      return {};
    }
    return data || {};
  } catch (e) {
    console.warn('[portal-data] Fejl i getFeatureConstraints:', e);
    return {};
  }
}

/** Invalidér feature flags cache (kald ved institutions-skift) */
function invalidateFeatureFlagsCache() {
  _featureFlagsCache = null;
  _featureFlagsCacheId = null;
}

// ─── Paginerings-hjælper ───────────────────────────────────────

const PAGE_SIZE = 1000;

/**
 * Hent alle rækker fra en query-builder (undgår Supabase's 1000-rækkers grænse).
 * @param {function} buildQuery - Funktion der returnerer et nyt Supabase query
 * @returns {Promise<Array>}
 */
async function fetchAllRows(buildQuery) {
  const rows = [];
  let offset = 0;
  while (true) {
    const { data, error } = await buildQuery().range(offset, offset + PAGE_SIZE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }
  return rows;
}

// ═════════════════════════════════════════════════════════════════
//  1. INSTITUTIONS-INDSTILLINGER
// ═════════════════════════════════════════════════════════════════

/**
 * Hent institution-indstillinger (feature flags for forældreportalen).
 * @param {string} [institutionId]
 * @returns {Promise<object|null>}
 */
async function getInstitutionSettings(institutionId) {
  const client = db();
  const instId = resolveInstitutionId(institutionId);
  if (!client || !instId) return null;

  try {
    // Fetch institution settings and gaming portal settings in parallel
    const [instResult, gamingResult] = await Promise.all([
      client
        .from('institutions')
        .select(`
          name,
          parent_portal_spending_limit,
          parent_portal_product_limit,
          parent_portal_allergens,
          parent_portal_vegetarian_only,
          parent_portal_no_pork,
          parent_portal_no_unhealthy,
          parent_portal_sugar_policy,
          parent_portal_email_notifications,
          parent_portal_daily_special,
          parent_portal_daily_special_price,
          parent_portal_payment,
          parent_portal_message_template,
          institution_contact_phone,
          institution_contact_phone_enabled,
          sugar_policy_info_text,
          sugar_policy_info_enabled
        `)
        .eq('id', instId)
        .single(),
      client
        .schema('gaming')
        .from('portal_settings')
        .select('skaermtid_enabled, skaermtid_show_usage, skaermtid_show_remaining, skaermtid_show_rules, skaermtid_allow_personal_limits, skaermtid_allow_extra_time_requests, skaermtid_allow_game_approval')
        .eq('institution_id', instId)
        .maybeSingle()
        .catch(() => ({ data: null })),
    ]);

    if (instResult.error) {
      console.error('[portal-data] Fejl ved hentning af institutions-indstillinger:', instResult.error.message);
      return null;
    }

    // Merge gaming settings into institution settings
    const merged = { ...instResult.data };
    if (gamingResult.data) {
      Object.assign(merged, gamingResult.data);
    }

    return merged;
  } catch (e) {
    console.error('[portal-data] Uventet fejl i getInstitutionSettings:', e);
    return null;
  }
}

/**
 * Gem institutions-indstillinger (opdatér feature flags).
 * @param {string} [institutionId]
 * @param {object} settings - Objekt med de felter der skal opdateres
 * @returns {Promise<boolean>} true ved succes
 */
async function saveInstitutionSettings(institutionId, settings) {
  const client = db();
  const instId = resolveInstitutionId(institutionId);
  if (!client || !instId || !settings) return false;

  // Tillad kun kendte portal-felter (sikkerhedsfilter)
  const ALLOWED_FIELDS = [
    'parent_portal_spending_limit',
    'parent_portal_product_limit',
    'parent_portal_allergens',
    'parent_portal_vegetarian_only',
    'parent_portal_no_pork',
    'parent_portal_no_unhealthy',
    'parent_portal_sugar_policy',
    'parent_portal_email_notifications',
    'parent_portal_daily_special',
    'parent_portal_daily_special_price',
    'parent_portal_payment',
    'parent_portal_message_template',
    'institution_contact_phone',
    'institution_contact_phone_enabled',
    'sugar_policy_info_text',
    'sugar_policy_info_enabled',
    'admin_mfa_policy',
    'parent_mfa_new_device',
    'auto_delete_inactive_enabled',
    'auto_delete_inactive_months',
    'parent_portal_diet',
    'parent_portal_events',
    'parent_portal_purchase_profile',
    'parent_portal_history',
    'parent_portal_sortiment',
    'parent_portal_feedback',
    'parent_portal_profile_pictures',
  ];

  let filtered = {};
  for (const key of ALLOWED_FIELDS) {
    if (key in settings) {
      filtered[key] = settings[key];
    }
  }

  // Feature flag enforcement: fjern felter fra låste moduler
  if (typeof window !== 'undefined' && window.FeatureModules) {
    const flags = await getFeatureFlags(instId);
    if (flags && Object.keys(flags).length > 0) {
      filtered = window.FeatureModules.filterFieldsByFlags(filtered, flags);
    }
  }

  if (Object.keys(filtered).length === 0) {
    console.warn('[portal-data] Ingen gyldige felter at gemme');
    return false;
  }

  try {
    const { error } = await client
      .from('institutions')
      .update(filtered)
      .eq('id', instId);

    if (error) {
      console.error('[portal-data] Fejl ved gemning af indstillinger:', error.message);
      return false;
    }

    console.log('[portal-data] Indstillinger gemt:', Object.keys(filtered));
    return true;
  } catch (e) {
    console.error('[portal-data] Uventet fejl i saveInstitutionSettings:', e);
    return false;
  }
}

/**
 * Gem skærmtid-indstillinger til gaming.portal_settings.
 * @param {string} [institutionId]
 * @param {object} settings - Objekt med skaermtid_* felter
 * @returns {Promise<boolean>} true ved succes
 */
async function saveScreentimeSettings(institutionId, settings) {
  const client = db();
  const instId = resolveInstitutionId(institutionId);
  if (!client || !instId || !settings) return false;

  const ALLOWED_FIELDS = [
    'skaermtid_enabled',
    'skaermtid_show_usage',
    'skaermtid_show_remaining',
    'skaermtid_show_rules',
    'skaermtid_allow_personal_limits',
    'skaermtid_allow_extra_time_requests',
    'skaermtid_allow_game_approval',
  ];

  const filtered = {};
  for (const key of ALLOWED_FIELDS) {
    if (key in settings) {
      filtered[key] = settings[key];
    }
  }

  if (Object.keys(filtered).length === 0) return true; // nothing to save

  try {
    const { error } = await client
      .schema('gaming')
      .from('portal_settings')
      .upsert({ institution_id: instId, ...filtered }, { onConflict: 'institution_id' });

    if (error) {
      console.error('[portal-data] Fejl ved gemning af skærmtid-indstillinger:', error.message);
      return false;
    }

    console.log('[portal-data] Skærmtid-indstillinger gemt:', Object.keys(filtered));
    return true;
  } catch (e) {
    console.error('[portal-data] Uventet fejl i saveScreentimeSettings:', e);
    return false;
  }
}

// ═════════════════════════════════════════════════════════════════
//  2. FORÆLDRE-STATISTIK (Insights-side)
// ═════════════════════════════════════════════════════════════════

/**
 * Hent aggregeret forældre-statistik til indsigts-dashboardet.
 * @param {string} [institutionId]
 * @returns {Promise<object|null>}
 */
async function getParentStats(institutionId) {
  const client = db();
  const instId = resolveInstitutionId(institutionId);
  if (!client || !instId) return null;

  try {
    // ── Parallelle queries ──

    // 1. Alle børn (kunder) i institutionen
    const childrenPromise = fetchAllRows(() =>
      client
        .from('users')
        .select('id, balance, parent_pin_hash, last_parent_login_at, daily_spend_limit, created_at')
        .eq('institution_id', instId)
        .eq('role', 'kunde')
        .not('is_test_user', 'eq', true)
    );

    // 2. Forældre-barn koblinger
    const linksPromise = fetchAllRows(() =>
      client
        .from('parent_account_children')
        .select('auth_user_id, child_id')
    );

    // 3. Notifikationsindstillinger
    const notifsPromise = fetchAllRows(() =>
      client
        .from('parent_notifications')
        .select('user_id, notify_at_zero, notify_at_ten')
        .eq('institution_id', instId)
    );

    // 4. Indbetalinger (DEPOSIT events) — samlet og denne måned
    const depositsPromise = fetchAllRows(() =>
      client
        .from('events')
        .select('target_user_id, details, created_at')
        .eq('institution_id', instId)
        .eq('event_type', 'DEPOSIT')
    );

    // 5. Køb (SALE events) — samlet antal
    const salesPromise = fetchAllRows(() =>
      client
        .from('events')
        .select('target_user_id, details, created_at')
        .eq('institution_id', instId)
        .eq('event_type', 'SALE')
    );

    const [children, links, notifs, deposits, sales] = await Promise.all([
      childrenPromise, linksPromise, notifsPromise, depositsPromise, salesPromise,
    ]);

    // ── Beregninger ──

    const childIds = new Set(children.map(c => c.id));

    // Filtrér koblinger til kun denne institutions børn
    const relevantLinks = links.filter(l => childIds.has(l.child_id));
    const parentAuthIds = new Set(relevantLinks.map(l => l.auth_user_id));

    // Børn med forældre-kode (parent_pin_hash sat = forældrene har fået en kode)
    const childrenWithCode = children.filter(c => !!c.parent_pin_hash);

    // Aktive forældre (sidste login inden for 30 dage)
    const thirtyDaysAgo = daysAgo(30);
    const sevenDaysAgo = daysAgo(7);
    const todayStart = startOfToday();

    const activeParents30d = children.filter(
      c => c.last_parent_login_at && c.last_parent_login_at >= thirtyDaysAgo
    ).length;
    const activeParents7d = children.filter(
      c => c.last_parent_login_at && c.last_parent_login_at >= sevenDaysAgo
    ).length;
    const activeParentsToday = children.filter(
      c => c.last_parent_login_at && c.last_parent_login_at >= todayStart
    ).length;

    // Aldrig logget ind (ingen last_parent_login_at)
    const neverLoggedIn = children.filter(c => !c.last_parent_login_at).length;

    // Saldo-statistik
    const balances = children.map(c => parseFloat(c.balance) || 0);
    const totalBalance = balances.reduce((sum, b) => sum + b, 0);
    const avgBalance = children.length > 0 ? Math.round(totalBalance / children.length) : 0;
    const zeroBalanceCount = balances.filter(b => b <= 0).length;

    // Daglig grænse — børn uden grænse sat
    const noLimitsSet = children.filter(c => c.daily_spend_limit == null).length;

    // Notifikationer
    const notifsEnabled = notifs.filter(n => n.notify_at_zero || n.notify_at_ten).length;
    const notifsDisabled = children.length - notifsEnabled;

    // Økonomi — indbetalinger
    const monthStart = startOfMonth();
    const weekStart = daysAgo(7);

    let totalDepositAmount = 0;
    let monthlyDepositAmount = 0;
    let weeklyDepositAmount = 0;
    let totalDepositCount = 0;
    let weeklyDepositCount = 0;

    for (const dep of deposits) {
      const amount = parseFloat(dep.details?.amount || dep.details?.deposit_amount || 0);
      totalDepositAmount += amount;
      totalDepositCount++;
      if (dep.created_at >= monthStart) monthlyDepositAmount += amount;
      if (dep.created_at >= weekStart) {
        weeklyDepositAmount += amount;
        weeklyDepositCount++;
      }
    }

    // Økonomi — køb
    let totalPurchaseCount = 0;
    let monthlyPurchaseCount = 0;

    for (const sale of sales) {
      totalPurchaseCount++;
      if (sale.created_at >= monthStart) monthlyPurchaseCount++;
    }

    // Gennemsnitlig køb pr. barn
    const avgPurchasesPerChild = children.length > 0
      ? Math.round((totalPurchaseCount / children.length) * 10) / 10
      : 0;

    return {
      // Hovedtal
      totalChildren: children.length,
      totalParents: parentAuthIds.size,
      childrenWithCode: childrenWithCode.length,
      adoptionRate: children.length > 0
        ? Math.round((parentAuthIds.size / children.length) * 100)
        : 0,
      missingParents: children.length - parentAuthIds.size,

      // Aktivitet
      activeParents30d,
      activeParents7d,
      activeParentsToday,
      neverLoggedIn,

      // Saldo
      avgBalance,
      totalBalance: Math.round(totalBalance),
      zeroBalanceCount,

      // Grænser
      noLimitsSet,

      // Notifikationer
      notifsEnabled,
      notifsDisabled,
      notifRate: children.length > 0
        ? Math.round((notifsEnabled / children.length) * 100)
        : 0,

      // Økonomi
      totalDepositAmount: Math.round(totalDepositAmount),
      monthlyDepositAmount: Math.round(monthlyDepositAmount),
      weeklyDepositAmount: Math.round(weeklyDepositAmount),
      totalDepositCount,
      weeklyDepositCount,
      totalPurchaseCount,
      monthlyPurchaseCount,
      avgPurchasesPerChild,
    };
  } catch (e) {
    console.error('[portal-data] Fejl i getParentStats:', e);
    return null;
  }
}

// ═════════════════════════════════════════════════════════════════
//  3. FORÆLDRELISTE (fuldskærms-tabel)
// ═════════════════════════════════════════════════════════════════

/**
 * Hent forældreliste-data til den fuldskærms-tabel.
 * Returnerer et array af objekter med børne- og forældreinformation.
 * @param {string} [institutionId]
 * @returns {Promise<Array>}
 */
async function getParentList(institutionId) {
  const client = db();
  const instId = resolveInstitutionId(institutionId);
  if (!client || !instId) return [];

  try {
    // ── Parallelle queries ──

    // 1. Alle børn (kunder)
    const childrenPromise = fetchAllRows(() =>
      client
        .from('users')
        .select('id, name, number, balance, role, parent_pin_hash, parent_pin_is_custom, parent_portal_code, last_parent_login_at, daily_spend_limit, grade_level, is_test_user, created_at, profile_picture_opt_out_aula, profile_picture_opt_out_camera, profile_picture_opt_out_ai, profile_picture_opt_out_camera_at, profile_picture_opt_out_ai_at, profile_picture_type, profile_picture_url')
        .eq('institution_id', instId)
        .eq('role', 'kunde')
        .not('is_test_user', 'eq', true)
        .order('name')
    );

    // 2. Forældre-barn koblinger med forælders auth_user_id
    const linksPromise = fetchAllRows(() =>
      client
        .from('parent_account_children')
        .select('auth_user_id, child_id')
    );

    // 3. Forældre-profiler (auth_id → email/navn)
    const profilesPromise = fetchAllRows(() =>
      client
        .from('parent_profiles')
        .select('auth_id, email')
    );

    // 4. Notifikationer
    const notifsPromise = fetchAllRows(() =>
      client
        .from('parent_notifications')
        .select('user_id, notify_at_zero, notify_at_ten')
        .eq('institution_id', instId)
    );

    // 5. Forældre-produktgrænser (bare count pr. barn — har forælder sat grænser?)
    const parentLimitsPromise = fetchAllRows(() =>
      client
        .from('parent_limits')
        .select('child_id')
    );

    // 6. Forældre-sukkerpolitik
    const sugarPolicyPromise = fetchAllRows(() =>
      client
        .from('parent_sugar_policy')
        .select('child_id, block_unhealthy, vegetarian_only, no_pork, max_unhealthy_per_day')
    );

    // 7. Allergen-indstillinger (bare count pr. barn)
    const allergenPromise = fetchAllRows(() =>
      client
        .from('child_allergen_settings')
        .select('child_id, allergen, policy')
        .eq('institution_id', instId)
    );

    // 8. Indbetalinger pr. barn (DEPOSIT events)
    const depositsPromise = fetchAllRows(() =>
      client
        .from('events')
        .select('target_user_id, details, created_at')
        .eq('institution_id', instId)
        .eq('event_type', 'DEPOSIT')
    );

    // 9. Køb pr. barn (SALE events) — denne måned + total
    const salesPromise = fetchAllRows(() =>
      client
        .from('events')
        .select('target_user_id, details, created_at')
        .eq('institution_id', instId)
        .eq('event_type', 'SALE')
    );

    const [
      children, links, profiles, notifs,
      parentLimits, sugarPolicies, allergens,
      deposits, sales,
    ] = await Promise.all([
      childrenPromise, linksPromise, profilesPromise, notifsPromise,
      parentLimitsPromise, sugarPolicyPromise, allergenPromise,
      depositsPromise, salesPromise,
    ]);

    // ── Byg lookup-maps ──

    // child_id → auth_user_id
    const childIds = new Set(children.map(c => c.id));
    const childToParentAuth = {};
    for (const link of links) {
      if (childIds.has(link.child_id)) {
        childToParentAuth[link.child_id] = link.auth_user_id;
      }
    }

    // auth_id → profil
    const profileMap = {};
    for (const p of profiles) {
      profileMap[p.auth_id] = p;
    }

    // user_id → notifikation
    const notifMap = {};
    for (const n of notifs) {
      notifMap[n.user_id] = n;
    }

    // child_id → har produktgrænser sat
    const childrenWithLimits = new Set();
    for (const l of parentLimits) {
      childrenWithLimits.add(l.child_id);
    }

    // child_id → sukkerpolitik
    const sugarMap = {};
    for (const s of sugarPolicies) {
      sugarMap[s.child_id] = s;
    }

    // child_id → allergen-indstillinger (antal sat)
    const allergenCountMap = {};
    for (const a of allergens) {
      if (a.policy && a.policy !== 'allow') {
        allergenCountMap[a.child_id] = (allergenCountMap[a.child_id] || 0) + 1;
      }
    }

    // Indbetalinger pr. barn
    const depositsByChild = {};
    for (const dep of deposits) {
      const uid = dep.target_user_id;
      if (!uid) continue;
      if (!depositsByChild[uid]) {
        depositsByChild[uid] = { totalAmount: 0, count: 0, lastDate: null, lastAmount: 0 };
      }
      const amount = parseFloat(dep.details?.amount || dep.details?.deposit_amount || 0);
      depositsByChild[uid].totalAmount += amount;
      depositsByChild[uid].count++;
      if (!depositsByChild[uid].lastDate || dep.created_at > depositsByChild[uid].lastDate) {
        depositsByChild[uid].lastDate = dep.created_at;
        depositsByChild[uid].lastAmount = amount;
      }
    }

    // Køb pr. barn — denne måned (forbrug) og total (antal)
    const monthStart = startOfMonth();
    const salesByChild = {};
    for (const sale of sales) {
      const uid = sale.target_user_id;
      if (!uid) continue;
      if (!salesByChild[uid]) {
        salesByChild[uid] = { totalCount: 0, monthSpent: 0, monthCount: 0 };
      }
      salesByChild[uid].totalCount++;
      if (sale.created_at >= monthStart) {
        const amount = parseFloat(sale.details?.total_amount || sale.details?.amount || 0);
        salesByChild[uid].monthSpent += amount;
        salesByChild[uid].monthCount++;
      }
    }

    // ── Byg resultatliste ──

    const result = children.map(child => {
      const parentAuthId = childToParentAuth[child.id];
      const parentProfile = parentAuthId ? profileMap[parentAuthId] : null;
      const notif = notifMap[child.id];
      const sugar = sugarMap[child.id];
      const depData = depositsByChild[child.id];
      const saleData = salesByChild[child.id];

      // Kostpræferencer-sammenfatning
      let dietPrefs = [];
      if (sugar?.vegetarian_only) dietPrefs.push('Vegetar');
      if (sugar?.no_pork) dietPrefs.push('Ingen svinekød');
      if (sugar?.block_unhealthy) dietPrefs.push('Ingen usunde');
      if (sugar?.max_unhealthy_per_day != null) dietPrefs.push('Max ' + sugar.max_unhealthy_per_day + ' usunde/dag');

      // Formatér sidste indbetaling
      let lastDepositText = null;
      if (depData?.lastDate) {
        const d = new Date(depData.lastDate);
        const dateStr = d.toLocaleDateString('da-DK', { day: 'numeric', month: 'short' });
        lastDepositText = dateStr + ' · ' + Math.round(depData.lastAmount) + ' kr';
      }

      // Notifikationer aktiv?
      const hasNotif = !!(notif && (notif.notify_at_zero || notif.notify_at_ten));

      // "Flags" til filtrering i UI
      const flags = [];
      if (!child.last_parent_login_at) flags.push('never');
      if ((parseFloat(child.balance) || 0) <= 0) flags.push('zero');
      if (child.daily_spend_limit == null && !childrenWithLimits.has(child.id)) flags.push('nolimit');
      if (!child.parent_pin_hash) flags.push('nocode');
      if (child.last_parent_login_at && child.last_parent_login_at >= daysAgo(30)) flags.push('active');
      if (child.parent_pin_is_custom) flags.push('code');

      return {
        childId: child.id,
        child: child.name || 'Ukendt',
        childNumber: child.number,
        parent: parentProfile ? parentProfile.email : null,
        parentAuthId: parentAuthId || null,
        saldo: parseFloat(child.balance) || 0,
        login: child.last_parent_login_at || null,
        code: !!child.parent_pin_hash,
        pcode: !!child.parent_pin_is_custom,
        portalCode: child.parent_portal_code || null,
        limit: child.daily_spend_limit != null ? Math.round(child.daily_spend_limit) + ' kr' : null,
        limitRaw: child.daily_spend_limit != null ? parseFloat(child.daily_spend_limit) : null,
        hasProductLimits: childrenWithLimits.has(child.id),
        spent: saleData ? Math.round(saleData.monthSpent) : 0,
        purchases: saleData ? saleData.totalCount : 0,
        purchasesMonth: saleData ? saleData.monthCount : 0,
        deposited: depData ? Math.round(depData.totalAmount) : 0,
        depositCount: depData ? depData.count : 0,
        lastDeposit: lastDepositText,
        diet: dietPrefs.length > 0 ? dietPrefs.join(', ') : null,
        allergenCount: allergenCountMap[child.id] || 0,
        notif: hasNotif,
        notifDetails: notif || null,
        gradeLevel: child.grade_level,
        created: child.created_at,
        // Profilbillede opt-out status
        ppOptOutAula: !!child.profile_picture_opt_out_aula,
        ppOptOutCamera: !!child.profile_picture_opt_out_camera,
        ppOptOutAi: !!child.profile_picture_opt_out_ai,
        ppOptOutCameraAt: child.profile_picture_opt_out_camera_at || null,
        ppOptOutAiAt: child.profile_picture_opt_out_ai_at || null,
        ppType: child.profile_picture_type || null,
        ppUrl: child.profile_picture_url || null,
        flags: flags.join(' '),
      };
    });

    console.log('[portal-data] Forældreliste hentet:', result.length, 'børn');
    return result;
  } catch (e) {
    console.error('[portal-data] Fejl i getParentList:', e);
    return [];
  }
}

// ═════════════════════════════════════════════════════════════════
//  4. FUNKTIONS-ADOPTION
// ═════════════════════════════════════════════════════════════════

/**
 * Hent adoption-statistik for funktioner i forældreportalen.
 * @param {string} [institutionId]
 * @returns {Promise<object|null>}
 */
async function getAdoptionStats(institutionId) {
  const client = db();
  const instId = resolveInstitutionId(institutionId);
  if (!client || !instId) return null;

  try {
    // Hent børn med forældre-koblinger
    const [childrenRes, linksRes, limitsRes, allergensRes, screentimeRes] = await Promise.all([
      // Alle børn
      fetchAllRows(() =>
        client
          .from('users')
          .select('id')
          .eq('institution_id', instId)
          .eq('role', 'kunde')
          .not('is_test_user', 'eq', true)
      ),
      // Forældre-koblinger
      fetchAllRows(() =>
        client
          .from('parent_account_children')
          .select('auth_user_id, child_id')
      ),
      // Forældre-grænser (daglig beløbsgrænse ELLER produktgrænser)
      fetchAllRows(() =>
        client
          .from('parent_limits')
          .select('child_id')
      ),
      // Allergen-indstillinger (warn/block)
      fetchAllRows(() =>
        client
          .from('child_allergen_settings')
          .select('child_id, policy')
          .eq('institution_id', instId)
          .neq('policy', 'allow')
      ),
      // Skærmtid forældre-overrides
      fetchAllRows(() =>
        client
          .from('gaming.parent_overrides')
          .select('user_id')
          .eq('institution_id', instId)
      ).catch(() => []),  // Fejl tolereres (gaming-schema måske ikke tilgængeligt)
    ]);

    const childIds = new Set(childrenRes.map(c => c.id));
    const totalChildren = childIds.size;

    // Filtrér koblinger til denne institution
    const relevantLinks = linksRes.filter(l => childIds.has(l.child_id));
    const childrenWithParent = new Set(relevantLinks.map(l => l.child_id));
    const totalWithParent = childrenWithParent.size;

    if (totalWithParent === 0) {
      return {
        limitsSet: { count: 0, total: 0, pct: 0 },
        allergensSet: { count: 0, total: 0, pct: 0 },
        screentimeSet: { count: 0, total: 0, pct: 0 },
      };
    }

    // Grænser: børn med mindst én produktgrænse sat (af forældre)
    const childrenWithLimits = new Set();
    for (const l of limitsRes) {
      if (childrenWithParent.has(l.child_id)) {
        childrenWithLimits.add(l.child_id);
      }
    }

    // Allergener: børn med mindst én allergen-indstilling (warn/block)
    const childrenWithAllergens = new Set();
    for (const a of allergensRes) {
      if (childrenWithParent.has(a.child_id)) {
        childrenWithAllergens.add(a.child_id);
      }
    }

    // Skærmtid: børn med forældre-overrides
    const screentimeOverrides = Array.isArray(screentimeRes) ? screentimeRes : [];
    const childrenWithScreentime = new Set();
    for (const s of screentimeOverrides) {
      if (childrenWithParent.has(s.user_id)) {
        childrenWithScreentime.add(s.user_id);
      }
    }

    const makeStat = (count) => ({
      count,
      total: totalWithParent,
      pct: totalWithParent > 0 ? Math.round((count / totalWithParent) * 100) : 0,
    });

    return {
      limitsSet: makeStat(childrenWithLimits.size),
      allergensSet: makeStat(childrenWithAllergens.size),
      screentimeSet: makeStat(childrenWithScreentime.size),
    };
  } catch (e) {
    console.error('[portal-data] Fejl i getAdoptionStats:', e);
    return null;
  }
}

// ═════════════════════════════════════════════════════════════════
//  5. PREVIEW-BRUGERE (admin + test-brugere til demo i settings)
// ═════════════════════════════════════════════════════════════════

/**
 * Hent admin- og test-brugere til brug som demo-børn i Portal-indstillinger.
 * @param {string} [institutionId]
 * @returns {Promise<Array>} Array af { id, name, balance, role, isTest, emoji }
 */
async function getPreviewUsers(institutionId) {
  const client = db();
  const instId = resolveInstitutionId(institutionId);
  if (!client || !instId) return [];

  try {
    const { data, error } = await client
      .from('users')
      .select('id, name, balance, role, is_test_user')
      .eq('institution_id', instId)
      .or('role.eq.admin,is_test_user.eq.true')
      .order('name');

    if (error) {
      console.error('[portal-data] Fejl ved hentning af preview-brugere:', error.message);
      return [];
    }

    const emojis = ['\uD83E\uDD8A', '\uD83D\uDC38', '\uD83E\uDD81', '\uD83D\uDC3B', '\uD83D\uDC27', '\uD83E\uDD8B', '\uD83D\uDC36', '\uD83D\uDC31'];
    return (data || []).map(function(u, i) {
      return {
        id: u.id,
        name: u.name || 'Ukendt',
        balance: parseFloat(u.balance) || 0,
        role: u.role,
        isTest: u.is_test_user === true,
        emoji: emojis[i % emojis.length],
      };
    });
  } catch (e) {
    console.error('[portal-data] Uventet fejl i getPreviewUsers:', e);
    return [];
  }
}

// ═════════════════════════════════════════════════════════════════
//  6. SAMLET RPC: get_parent_admin_overview
// ═════════════════════════════════════════════════════════════════

/**
 * Hent alt forældre-administrationsdata via én RPC (erstatter 9+ parallelle queries).
 * Returnerer { stats, parentList, adoption } i samme format som de individuelle funktioner.
 * @param {string} [institutionId]
 * @returns {Promise<{stats: Object, parentList: Array, adoption: Object}|null>}
 */
async function getParentAdminOverview(institutionId) {
  const client = db();
  const instId = resolveInstitutionId(institutionId);
  if (!client || !instId) return null;

  try {
    console.log('[portal-data] Kalder get_parent_admin_overview RPC...');
    const { data, error } = await client.rpc('get_parent_admin_overview', {
      p_institution_id: instId,
    });

    if (error) {
      console.error('[portal-data] RPC fejl:', error.message);
      return null;
    }

    if (!data || data.error) {
      console.error('[portal-data] RPC returnerede fejl:', data?.error);
      return null;
    }

    const rpcStats = data.stats || {};
    const rpcChildren = data.children || [];

    // ── Transform stats til eksisterende format ──
    const totalChildren = rpcStats.totalChildren || 0;
    const totalParents = rpcStats.totalParents || 0;
    const notifsEnabled = rpcStats.notifsEnabled || 0;
    const totalPurchaseCount = rpcStats.totalPurchaseCount || 0;

    const stats = {
      totalChildren,
      totalParents,
      childrenWithCode: rpcStats.childrenWithCode || 0,
      childrenWithPortalCode: rpcStats.childrenWithPortalCode || 0,
      adoptionRate: rpcStats.adoptionRate || 0,
      missingParents: totalChildren - totalParents,

      activeParents30d: rpcStats.activeParents30d || 0,
      activeParents7d: rpcStats.activeParents7d || 0,
      activeParentsToday: rpcStats.activeParentsToday || 0,
      neverLoggedIn: rpcStats.neverLoggedIn || 0,

      avgBalance: rpcStats.avgBalance || 0,
      totalBalance: rpcStats.totalBalance || 0,
      zeroBalanceCount: rpcStats.zeroBalanceCount || 0,

      noLimitsSet: rpcStats.noLimitsSet || 0,

      notifsEnabled,
      notifsDisabled: totalChildren - notifsEnabled,
      notifRate: totalChildren > 0 ? Math.round((notifsEnabled / totalChildren) * 100) : 0,

      totalDepositAmount: rpcStats.totalDepositAmount || 0,
      monthlyDepositAmount: rpcStats.monthlyDepositAmount || 0,
      weeklyDepositAmount: rpcStats.weeklyDepositAmount || 0,
      totalDepositCount: rpcStats.totalDepositCount || 0,
      weeklyDepositCount: 0, // Ikke i RPC — kan tilføjes senere
      totalPurchaseCount,
      monthlyPurchaseCount: rpcStats.monthlyPurchaseCount || 0,
      avgPurchasesPerChild: totalChildren > 0
        ? Math.round((totalPurchaseCount / totalChildren) * 10) / 10
        : 0,
    };

    // ── Transform children til parentList format ──
    const parentList = rpcChildren.map(function (c) {
      // Kostpræferencer-sammenfatning
      const dietPrefs = [];
      if (c.vegetarianOnly) dietPrefs.push('Vegetar');
      if (c.noPork) dietPrefs.push('Ingen svinekød');
      if (c.blockUnhealthy) dietPrefs.push('Ingen usunde');
      if (c.maxUnhealthyPerDay != null) dietPrefs.push('Max ' + c.maxUnhealthyPerDay + ' usunde/dag');

      // Flags til filtrering
      const flags = [];
      if (!c.login) flags.push('never');
      if ((parseFloat(c.saldo) || 0) <= 0) flags.push('zero');
      if (c.limitKr == null && !c.hasProductLimits) flags.push('nolimit');
      if (!c.hasCode && !c.parent) flags.push('nocode');
      if (c.login && new Date(c.login) >= new Date(Date.now() - 30 * 86400000)) flags.push('active');
      if (c.isCustomCode) flags.push('code');

      return {
        childId: c.childId,
        child: c.child || 'Ukendt',
        childNumber: c.childNumber,
        parent: c.parent || null,
        saldo: parseFloat(c.saldo) || 0,
        login: c.login || null,
        code: !!c.hasCode,
        pcode: !!c.isCustomCode,
        portalCode: c.portalCode || null,
        portalCodeUsedAt: c.portalCodeUsedAt || null,
        portalCodeGeneratedAt: c.portalCodeGeneratedAt || null,
        codeExpiresAt: c.codeExpiresAt || null,
        limit: c.limitKr != null ? Math.round(c.limitKr) + ' kr' : null,
        limitRaw: c.limitKr != null ? parseFloat(c.limitKr) : null,
        hasProductLimits: !!c.hasProductLimits,
        spent: parseFloat(c.spent) || 0,
        purchases: c.purchases || 0,
        purchasesMonth: c.purchasesMonth || 0,
        deposited: parseFloat(c.deposited) || 0,
        depositCount: c.depositCount || 0,
        lastDeposit: null, // Ikke i RPC — kan tilføjes senere
        diet: dietPrefs.length > 0 ? dietPrefs.join(', ') : null,
        allergenCount: c.allergenCount || 0,
        notif: !!(c.notifyAtZero || c.notifyAtTen),
        notifDetails: { notify_at_zero: !!c.notifyAtZero, notify_at_ten: !!c.notifyAtTen },
        gradeLevel: c.gradeLevel,
        created: c.created,
        flags: flags.join(' '),
      };
    });

    // ── Beregn adoption-stats fra children data ──
    const childrenWithParent = parentList.filter(c => !!c.parent);
    const totalWithParent = childrenWithParent.length;

    const makeStat = (count) => ({
      count,
      total: totalWithParent,
      pct: totalWithParent > 0 ? Math.round((count / totalWithParent) * 100) : 0,
    });

    const limitsCount = childrenWithParent.filter(c => c.limitRaw != null || c.hasProductLimits).length;
    const allergensCount = childrenWithParent.filter(c => c.allergenCount > 0).length;

    const adoption = {
      limitsSet: makeStat(limitsCount),
      allergensSet: makeStat(allergensCount),
      screentimeSet: makeStat(0), // Skærmtid parent_overrides ikke i RPC
    };

    console.log('[portal-data] RPC data hentet:', stats.totalChildren, 'børn,', parentList.length, 'i liste');
    return { stats, parentList, adoption };
  } catch (e) {
    console.error('[portal-data] Fejl i getParentAdminOverview:', e);
    return null;
  }
}

// ═════════════════════════════════════════════════════════════════
//  7. PORTAL-KODE GENERERING
// ═════════════════════════════════════════════════════════════════

/**
 * Generer portal-kode for ét barn via RPC.
 * @param {string} childId - UUID af barnet
 * @returns {Promise<{success: boolean, code?: string, child_name?: string, error?: string}|null>}
 */
async function generateSinglePortalCode(childId) {
  const client = db();
  if (!client || !childId) return null;

  try {
    const { data, error } = await client.rpc('generate_single_portal_code', {
      p_child_id: childId,
    });

    if (error) {
      console.error('[portal-data] generate_single_portal_code fejl:', error.message);
      return { success: false, error: error.message };
    }

    return data || { success: false, error: 'Intet svar fra server.' };
  } catch (e) {
    console.error('[portal-data] Fejl i generateSinglePortalCode:', e);
    return { success: false, error: e.message };
  }
}

/**
 * Generer portal-koder for alle børn uden kode via batch RPC.
 * @param {string} [institutionId]
 * @returns {Promise<{success: boolean, generated_count?: number, error?: string}|null>}
 */
async function generatePortalCodesBatch(institutionId) {
  const client = db();
  const instId = resolveInstitutionId(institutionId);
  if (!client || !instId) return null;

  try {
    const { data, error } = await client.rpc('generate_portal_codes_batch', {
      p_institution_id: instId,
    });

    if (error) {
      console.error('[portal-data] generate_portal_codes_batch fejl:', error.message);
      return { success: false, error: error.message };
    }

    return data || { success: false, error: 'Intet svar fra server.' };
  } catch (e) {
    console.error('[portal-data] Fejl i generatePortalCodesBatch:', e);
    return { success: false, error: e.message };
  }
}

/**
 * Hent Aula-beskedskabelon for institutionen.
 * @param {string} [institutionId]
 * @returns {Promise<string|null>}
 */
async function getAulaMessageTemplate(institutionId) {
  const client = db();
  const instId = resolveInstitutionId(institutionId);
  if (!client || !instId) return null;

  try {
    const { data, error } = await client
      .from('institutions')
      .select('parent_portal_message_template, name')
      .eq('id', instId)
      .single();

    if (error) {
      console.error('[portal-data] Fejl ved hentning af Aula-skabelon:', error.message);
      return null;
    }

    return {
      template: data?.parent_portal_message_template || null,
      institutionName: data?.name || null,
    };
  } catch (e) {
    console.error('[portal-data] Fejl i getAulaMessageTemplate:', e);
    return null;
  }
}

// ═════════════════════════════════════════════════════════════════
//  EKSPONÉR PÅ WINDOW (så IIFE-scripts kan tilgå PortalData)
// ═════════════════════════════════════════════════════════════════

window.PortalData = {
  getInstitutionSettings,
  saveInstitutionSettings,
  saveScreentimeSettings,
  getParentStats,
  getParentList,
  getAdoptionStats,
  getPreviewUsers,
  getParentAdminOverview,
  generateSinglePortalCode,
  generatePortalCodesBatch,
  getAulaMessageTemplate,
  getFeatureFlags,
  getFeatureConstraints,
  invalidateFeatureFlagsCache,
};

console.log('[portal-data] PortalData modul registreret på window.PortalData');
