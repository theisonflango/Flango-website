/**
 * Flango Parent Portal v2 — API Layer
 *
 * Wraps all Supabase Edge Function calls and RPC calls.
 * Exposed as window.PortalAPI for use by portal-v2.js.
 *
 * Requires: `window.portalSupabase` (from portal-v2.html)
 */
(function () {
  'use strict';

  const SUPABASE_URL = "https://jbknjgbpghrbrstqwoxj.supabase.co";

  // ─── Helper: get auth token ───
  async function getAccessToken() {
    const { data } = await window.portalSupabase.auth.getSession();
    return data?.session?.access_token || null;
  }

  // ─── Helper: invoke Edge Function ───
  async function invokeFunction(name, body) {
    const { data, error } = await window.portalSupabase.functions.invoke(name, {
      body: body || {},
    });
    if (error) {
      console.error(`[PortalAPI] ${name} error:`, error);
      throw error;
    }
    return data;
  }

  // ─── Helper: invoke Edge Function via fetch (for functions that need custom handling) ───
  async function fetchFunction(name, body) {
    const token = await getAccessToken();
    if (!token) throw new Error('Ikke logget ind');
    const response = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(body || {}),
    });
    if (!response.ok) {
      const errText = await response.text().catch(() => 'Ukendt fejl');
      throw new Error(errText);
    }
    return response.json();
  }

  // ─── Helper: RPC call via REST ───
  async function rpcCall(fnName, params) {
    const token = await getAccessToken();
    if (!token) throw new Error('Ikke logget ind');
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fnName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'apikey': window.portalSupabase.supabaseKey || window.SUPABASE_ANON_KEY || '',
      },
      body: JSON.stringify(params || {}),
    });
    if (!response.ok) {
      const errText = await response.text().catch(() => 'Ukendt fejl');
      throw new Error(errText);
    }
    return response.json();
  }

  // ═══════════════════════════════════════
  //  PUBLIC API
  // ═══════════════════════════════════════

  window.PortalAPI = {

    // ─── Auth ───

    /** Get current session */
    async getSession() {
      const { data, error } = await window.portalSupabase.auth.getSession();
      if (error) throw error;
      return data?.session || null;
    },

    /** Sign in with email and password */
    async signIn(email, password) {
      const { data, error } = await window.portalSupabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      return data;
    },

    /** Sign out */
    async signOut() {
      const { error } = await window.portalSupabase.auth.signOut();
      if (error) throw error;
    },

    /** Send password reset email */
    async resetPassword(email) {
      const { error } = await window.portalSupabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + window.location.pathname,
      });
      if (error) throw error;
    },

    /** Update password (for recovery flow) */
    async updatePassword(newPassword) {
      const { error } = await window.portalSupabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
    },

    /** Sign up a new parent account */
    async signUp(email, password) {
      const { data, error } = await window.portalSupabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: window.location.origin + window.location.pathname,
        },
      });
      if (error) throw error;
      return data;
    },

    /** Sign in with Google OAuth */
    async signInWithGoogle() {
      const { data, error } = await window.portalSupabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin + window.location.pathname,
        },
      });
      if (error) throw error;
      return data;
    },

    // ─── Signup helpers (RPC) ───

    /** Get list of public institutions (for signup dropdown) */
    async getPublicInstitutions() {
      const { data, error } = await window.portalSupabase.rpc('get_public_institutions');
      if (error) throw error;
      return data || [];
    },

    /** Verify portal code for signup (before account creation) */
    async verifyPortalCodeForSignup(code, institutionLoginCode) {
      const { data, error } = await window.portalSupabase.rpc('verify_portal_code_for_signup', {
        p_code: code,
        p_institution_login_code: institutionLoginCode || null,
      });
      if (error) throw error;
      return data;
    },

    /** Verify 8-digit PIN and get child info */
    async verifyPinAndGetChildInfo(pin, institutionId) {
      const { data, error } = await window.portalSupabase.rpc('verify_pin_and_get_child_info', {
        p_pin: pin,
        p_institution_id: institutionId,
      });
      if (error) throw error;
      return data;
    },

    /** Link child to parent account via 8-digit PIN */
    async verifyParentCodeAndLinkChild(code, institutionId) {
      const { data, error } = await window.portalSupabase.rpc('verify_parent_code_and_link_child', {
        p_code: code,
        p_institution_id: institutionId,
      });
      if (error) throw error;
      return data;
    },

    /** Link child to parent account via portal code (8-char alphanumeric). Also marks code as used. */
    async linkChildByPortalCode(portalCode) {
      const { data, error } = await window.portalSupabase.rpc('link_child_by_portal_code', {
        p_portal_code: portalCode,
      });
      if (error) throw error;
      return data;
    },

    // ─── Children ───

    /** Get all children for the logged-in parent */
    async getChildren() {
      return rpcCall('get_children_for_parent');
    },

    // ─── Parent View (child data, balance, institution) ───

    /** Get child data including balance, name, institution */
    async getParentView(childId) {
      return invokeFunction('get-parent-view', { child_id: childId });
    },

    /** Get club average daily spend (all-time) */
    async getClubAvgDailySpend(institutionId) {
      const { data, error } = await window.portalSupabase.rpc('get_club_avg_daily_spend', {
        p_institution_id: institutionId,
      });
      if (error) throw error;
      return data || 0;
    },

    // ─── Products ───

    /** Get products for a child's institution */
    async getProducts(institutionId, childId) {
      return invokeFunction('get-products-for-parent', { institution_id: institutionId, child_id: childId });
    },

    // ─── Purchase Profile ───

    /** Get purchase profile (spending history, product breakdown) */
    async getPurchaseProfile(childId, period, sortBy, includeDailyData) {
      return invokeFunction('get-purchase-profile', {
        child_id: childId,
        period: period || '30d',
        sort_by: sortBy || 'antal',
        include_daily: !!includeDailyData,
      });
    },

    // ─── Daily Spending Limit ───

    /** Save daily spending limit for a child */
    async saveDailyLimit(childId, limit) {
      return invokeFunction('save-daily-limit', {
        child_id: childId,
        daily_limit: limit,
      });
    },

    // ─── Product Limits ───

    /** Save product limits (per-product max per day) */
    async saveProductLimits(childId, limits) {
      return fetchFunction('save-parent-limits', {
        child_id: childId,
        limits: limits,
      });
    },

    // ─── Sugar Policy ───

    /** Save sugar policy for a child */
    async saveSugarPolicy(childId, policy) {
      return invokeFunction('save-parent-sugar-policy', {
        child_id: childId,
        ...policy,
      });
    },

    // ─── Allergy Settings ───

    /** Get allergy settings for a child */
    async getAllergySettings(childId) {
      return invokeFunction('get-allergy-settings', { child_id: childId });
    },

    /** Save allergy settings for a child */
    async saveAllergySettings(childId, settings) {
      return invokeFunction('save-allergy-settings', {
        child_id: childId,
        settings: settings,
      });
    },

    // ─── Profile Picture Consent ───

    /** Save granular profile picture consent for a child */
    async saveProfilePictureConsent(childId, optOutAula, optOutCamera, optOutAi) {
      return rpcCall('save_profile_picture_consent', {
        p_child_id: childId,
        p_opt_out_aula: optOutAula,
        p_opt_out_camera: optOutCamera,
        p_opt_out_ai: optOutAi,
      });
    },

    // ─── Notifications ───

    /** Save notification preferences for a child */
    async saveNotification(childId, settings) {
      return invokeFunction('save-parent-notification', {
        child_id: childId,
        ...settings,
      });
    },

    // ─── Events ───

    /** Get events for parent's children */
    async getParentEvents(childId) {
      return invokeFunction('get-parent-events', { child_id: childId });
    },

    /** Register child for an event */
    async registerForEvent(childId, eventId, payNow, paymentType) {
      const body = {
        child_id: childId,
        event_id: eventId,
      };
      if (payNow != null) body.pay_now = payNow;
      if (paymentType) body.payment_type = paymentType;
      return invokeFunction('parent-event-register', body);
    },

    /** Cancel child's event registration */
    async cancelEvent(childId, eventId) {
      return invokeFunction('parent-event-cancel', {
        child_id: childId,
        event_id: eventId,
      });
    },

    /** Create Stripe payment for event */
    async createEventPayment(childId, eventId) {
      return invokeFunction('create-event-payment', {
        child_id: childId,
        event_id: eventId,
      });
    },

    /** Confirm event payment */
    async confirmEventPayment(sessionId) {
      return invokeFunction('confirm-event-payment', {
        session_id: sessionId,
      });
    },

    // ─── Screentime ───

    /** Get screentime data for a child */
    async getScreentime(childId) {
      return invokeFunction('get-parent-skaermtid', { child_id: childId });
    },

    /** Save screentime settings for a child */
    async saveScreentime(childId, settings) {
      return invokeFunction('save-skaermtid-parent-settings', {
        child_id: childId,
        ...settings,
      });
    },

    // ─── Topup / Payment ───

    /** Create a Stripe topup PaymentIntent */
    async createTopup(childId, amountDkk) {
      return invokeFunction('create-topup', {
        child_id: childId,
        amount_dkk: amountDkk,
      });
    },

    /** Confirm a Stripe topup (after PaymentIntent succeeds) */
    async confirmTopup(childId, paymentIntentId) {
      return invokeFunction('confirm-topup', {
        child_id: childId,
        payment_intent_id: paymentIntentId,
      });
    },

    // ─── PIN ───

    /** Update parent portal PIN / password */
    async updatePin(newPin) {
      return invokeFunction('update-parent-pin', {
        new_pin: newPin,
      });
    },

    // ─── Sibling Linking ───

    /** Link a sibling by portal code */
    async linkSiblingByCode(code, institutionId) {
      return invokeFunction('link-sibling-by-code', {
        code: code,
        institution_id: institutionId,
      });
    },

    // ─── Sugar Policy (read) ───

    /** Get child sugar policy (from Edge Function) */
    async getChildSugarPolicy(childId) {
      return invokeFunction('get-child-sugar-policy', { child_id: childId });
    },
  };
})();
