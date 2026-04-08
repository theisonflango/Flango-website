/**
 * feature-modules.js — Modul-til-felt mapping for feature flag-systemet.
 *
 * Definerer hvilke institutions-felter der kontrolleres af hvert modul.
 * Bruges af admin-portal-settings.js (UI-locking) og portal-data.js (save-filter).
 *
 * PRINCIP: Fravær = ulåst. Hvis et modul ikke er i feature_flags tabellen,
 * er det 'unlocked' og alt virker som i dag.
 */
(function () {
  'use strict';

  // ─── Modul → felter (institutions-tabel kolonner) ───
  const MODULE_FIELD_MAP = {
    parent_portal: [
      // Hele forældreportalen — forced_off lukker alt
    ],
    portal_sections: [
      'parent_portal_events', 'parent_portal_purchase_profile', 'parent_portal_history',
      'parent_portal_sortiment', 'parent_portal_feedback', 'parent_portal_daily_special',
      'parent_portal_daily_special_price',
    ],
    spending_limits: [
      'spending_limit_enabled', 'spending_limit_amount',
      'spending_limit_applies_to_admins', 'spending_limit_applies_to_regular_users',
      'spending_limit_applies_to_test_users',
      'parent_portal_spending_limit', 'parent_portal_product_limit',
    ],
    balance_limits: [
      'balance_limit_enabled', 'balance_limit_amount',
      'balance_limit_exempt_admins', 'balance_limit_exempt_test_users',
    ],
    stripe_payments: [
      'stripe_enabled', 'stripe_mode', 'stripe_account_id', 'stripe_account_status',
    ],
    payment_mobilepay: [
      'topup_qr_enabled', 'topup_qr_image_url',
      // MobilePay-relaterede felter i parent_portal_payment JSONB
    ],
    payment_cash: [
      'topup_cash_enabled',
    ],
    sugar_policy: [
      'sugar_policy_enabled', 'sugar_policy_max_per_product_enabled',
      'sugar_policy_max_per_product_per_day', 'sugar_policy_max_unhealthy_enabled',
      'sugar_policy_max_unhealthy_per_day', 'sugar_policy_info_text', 'sugar_policy_info_enabled',
      'parent_portal_sugar_policy', 'parent_portal_no_unhealthy',
    ],
    diet_preferences: [
      'parent_portal_vegetarian_only', 'parent_portal_no_pork', 'parent_portal_diet',
    ],
    allergens: [
      'parent_portal_allergens',
    ],
    profile_pic_upload: [],   // Enforcement via profile-picture-modal, ikke institutions-felter
    profile_pic_camera: [],
    profile_pic_ai: [
      'profile_pictures_ai_enabled',
    ],
    profile_pic_library: [],
    grade_level: [],           // Enforcement via UI-felter, ikke institutions-felter
    restaurant_mode: [
      'restaurant_mode_enabled', 'restaurant_sound',
    ],
    events: [
      'cafe_events_enabled', 'cafe_events_as_products',
    ],
    security_mfa: [
      'admin_mfa_policy', 'parent_mfa_new_device',
    ],
    skaermtid: [
      'skaermtid_enabled', 'skaermtid_show_usage', 'skaermtid_show_remaining',
      'skaermtid_show_rules', 'skaermtid_allow_personal_limits',
      'skaermtid_allow_extra_time_requests', 'skaermtid_allow_game_approval',
    ],
  };

  // ─── Felt → modul (reverse lookup) ───
  const FIELD_TO_MODULE = {};
  for (const [moduleKey, fields] of Object.entries(MODULE_FIELD_MAP)) {
    for (const field of fields) {
      FIELD_TO_MODULE[field] = moduleKey;
    }
  }

  // ─── Sidebar settingKey → modul (for admin-portal-settings.js) ───
  const SETTING_KEY_TO_MODULE = {
    // Portal sektioner
    parent_portal_events: 'portal_sections',
    parent_portal_purchase_profile: 'portal_sections',
    parent_portal_history: 'portal_sections',
    parent_portal_sortiment: 'portal_sections',
    parent_portal_feedback: 'portal_sections',
    parent_portal_daily_special: 'portal_sections',
    // Payment
    parent_portal_payment: 'balance_limits', // Indbetaling-sektionen
    // Spending
    parent_portal_spending_limit: 'spending_limits',
    parent_portal_product_limit: 'spending_limits',
    // Sugar
    parent_portal_sugar_policy: 'sugar_policy',
    parent_portal_no_unhealthy: 'sugar_policy',
    // Diet
    parent_portal_diet: 'diet_preferences',
    parent_portal_vegetarian_only: 'diet_preferences',
    parent_portal_no_pork: 'diet_preferences',
    // Allergens
    parent_portal_allergens: 'allergens',
    // Profile pictures
    parent_portal_profile_pictures: 'profile_pic_upload', // Master toggle maps to upload
    // Screentime
    skaermtid_enabled: 'skaermtid',
    skaermtid_allow_game_approval: 'skaermtid',
    skaermtid_show_usage: 'skaermtid',
    // Notifications
    parent_portal_email_notifications: 'portal_sections',
    // MFA
    admin_mfa_policy: 'security_mfa',
    parent_mfa_new_device: 'security_mfa',
  };

  // ─── Profilbillede-type → modul ───
  const PROFILE_PIC_MODULE_MAP = {
    upload: 'profile_pic_upload',
    camera: 'profile_pic_camera',
    ai_avatar: 'profile_pic_ai',
    library: 'profile_pic_library',
  };

  // ─── Enable/disable felter pr. modul (kan IKKE ændres ved forced_on) ───
  const MODULE_ENABLE_FIELDS = {
    spending_limits: ['spending_limit_enabled', 'parent_portal_spending_limit', 'parent_portal_product_limit'],
    balance_limits: ['balance_limit_enabled'],
    sugar_policy: ['sugar_policy_enabled', 'parent_portal_sugar_policy', 'parent_portal_no_unhealthy'],
    security_mfa: ['admin_mfa_policy'], // forced_on = kan ikke sættes til 'off'
    restaurant_mode: ['restaurant_mode_enabled'],
    events: ['cafe_events_enabled'],
    skaermtid: ['skaermtid_enabled'],
  };

  // ─── Helper: hent modul-state fra flags-objekt ───
  function getModuleState(flags, moduleKey) {
    if (!flags || !flags[moduleKey]) return 'unlocked';
    return flags[moduleKey];
  }

  // ─── Helper: er modul tvunget fra? ───
  function isModuleForcedOff(flags, moduleKey) {
    return getModuleState(flags, moduleKey) === 'forced_off';
  }

  // ─── Helper: er modul tvunget til? ───
  function isModuleForcedOn(flags, moduleKey) {
    return getModuleState(flags, moduleKey) === 'forced_on';
  }

  // ─── Helper: filtrer felter baseret på feature flags (til save) ───
  function filterFieldsByFlags(fields, flags) {
    if (!flags || Object.keys(flags).length === 0) return fields;

    const filtered = {};
    for (const [key, value] of Object.entries(fields)) {
      const moduleKey = FIELD_TO_MODULE[key];
      if (!moduleKey) {
        // Felt tilhører intet modul — tillad altid
        filtered[key] = value;
        continue;
      }

      const state = getModuleState(flags, moduleKey);
      if (state === 'forced_off') {
        // Modul deaktiveret — fjern alle felter
        console.warn(`[feature-flags] Blokeret felt "${key}" — modul "${moduleKey}" er forced_off`);
        continue;
      }
      if (state === 'forced_on') {
        // Modul tvunget til — fjern enable/disable-felter
        const enableFields = MODULE_ENABLE_FIELDS[moduleKey] || [];
        if (enableFields.includes(key)) {
          console.warn(`[feature-flags] Blokeret enable-felt "${key}" — modul "${moduleKey}" er forced_on`);
          continue;
        }
      }
      filtered[key] = value;
    }
    return filtered;
  }

  // ─── Navnevisning ───
  function formatUserDisplayName(user, namePolicy) {
    if (!user) return '';
    if (!namePolicy || namePolicy === 'full_name') return user.name || '';
    if (namePolicy === 'first_name_only') return (user.name || '').split(' ')[0];
    if (namePolicy === 'number_only') return '#' + (user.number || '?');
    return user.name || '';
  }

  // ─── Global constraint cache (sættes af portal-data eller app.js) ───
  let _constraintsCache = null;

  function setConstraintsCache(constraints) {
    _constraintsCache = constraints;
  }

  function getNameDisplayPolicy() {
    if (!_constraintsCache || !_constraintsCache.name_display_policy) return 'full_name';
    return _constraintsCache.name_display_policy.policy || 'full_name';
  }

  /** Convenience: formater navn med cached policy */
  function displayName(user) {
    return formatUserDisplayName(user, getNameDisplayPolicy());
  }

  // ─── Eksporter ───
  window.FeatureModules = {
    MODULE_FIELD_MAP,
    FIELD_TO_MODULE,
    SETTING_KEY_TO_MODULE,
    PROFILE_PIC_MODULE_MAP,
    MODULE_ENABLE_FIELDS,
    getModuleState,
    isModuleForcedOff,
    isModuleForcedOn,
    filterFieldsByFlags,
    formatUserDisplayName,
    setConstraintsCache,
    getNameDisplayPolicy,
    displayName,
  };
})();
