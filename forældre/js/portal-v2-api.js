/**
 * Flango Parent Portal v2 — API Layer
 *
 * Wraps all Supabase Edge Function calls and RPC calls.
 * Exposed as window.PortalAPI for use by portal-v2.js.
 *
 * Requires: `window.portalSupabase` (from index.html)
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
      let details = null;
      try {
        if (error.context && typeof error.context.json === 'function') {
          details = await error.context.clone().json();
        } else if (error.context && typeof error.context.text === 'function') {
          details = await error.context.clone().text();
        }
      } catch (_) { /* ignore */ }
      console.error(`[PortalAPI] ${name} error:`, error, 'details:', details);
      if (details && typeof details === 'object' && details.error) {
        const err = new Error(details.error);
        err.status = error.context?.status;
        err.details = details;
        throw err;
      }
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

    /** Verify invite code for signup (before account creation, anon) */
    async verifyInviteCodeForSignup(code) {
      const { data, error } = await window.portalSupabase.rpc('verify_invite_code_for_signup', {
        p_code: code,
      });
      if (error) throw error;
      return data;
    },

    /** Create a parent invite code (authenticated parent) */
    async createParentInvite(institutionId) {
      const { data, error } = await window.portalSupabase.rpc('create_parent_invite', {
        p_institution_id: institutionId,
      });
      if (error) throw error;
      return data;
    },

    /** Redeem a parent invite code (authenticated parent) */
    async redeemParentInvite(inviteCode) {
      const { data, error } = await window.portalSupabase.rpc('redeem_parent_invite', {
        p_invite_code: inviteCode,
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

    /** Get customer average spend per period (today/week/month) */
    async getCustomerAvgSpend(institutionId) {
      const { data, error } = await window.portalSupabase.rpc('get_customer_avg_spend', {
        p_institution_id: institutionId,
      });
      if (error) throw error;
      return data || { avg_today: 0, avg_week: 0, avg_month: 0 };
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

    /** Set active profile picture or delete one from library */
    async manageProfilePicture(childId, action, pictureId) {
      return invokeFunction('parent-manage-profile-picture', {
        child_id: childId,
        action,        // 'set_active' | 'delete'
        picture_id: pictureId,
      });
    },

    /**
     * Upload et profilbillede som forælder. Filen skal være færdig-komprimeret
     * (typisk 400x400 WebP, max 50KB — samme preset som café-appen).
     *
     * Flow: 1) klient-side upload til Storage på path
     *       {institution_id}/parent-uploads/{child_id}/{timestamp}.webp
     *       (RLS-policy profile_pics_insert_parent verificerer parent-child relation)
     *       2) Edge Function verificerer fil-eksistens og opretter pending-row
     *
     * Resultat: { success, status: 'pending', library_id }
     * Pending uploads vises i forældreportalen som "afventer godkendelse"
     * og aktiveres først når institutions-admin har godkendt billedet.
     */
    async uploadProfilePictureFile(institutionId, childId, blob) {
      const path = `${institutionId}/parent-uploads/${childId}/${Date.now()}.webp`;
      const { error: uploadError } = await window.portalSupabase.storage
        .from('profile-pictures')
        .upload(path, blob, {
          contentType: 'image/webp',
          cacheControl: '31536000',
        });
      if (uploadError) {
        throw new Error('Storage-upload fejlede: ' + uploadError.message);
      }
      try {
        return await fetchFunction('parent-upload-profile-picture', {
          child_id: childId,
          storage_path: path,
        });
      } catch (err) {
        // Edge Function fejlede — slet uploadet fil for at undgå forældreløse paths
        try {
          await window.portalSupabase.storage.from('profile-pictures').remove([path]);
        } catch (_) { /* best-effort */ }
        throw err;
      }
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
    async getScreentime(childId, institutionId) {
      return invokeFunction('get-parent-skaermtid', { child_id: childId, institution_id: institutionId });
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

    // ─── Privacy & Rights (GDPR) ───

    /** Get complete data export for a child */
    async getDataExport(childId) {
      return rpcCall('get_child_data_export', { p_child_id: childId });
    },

    /** Get deletion request status for a child */
    async getDeletionStatus(childId) {
      return rpcCall('get_parent_deletion_status', { p_child_id: childId });
    },

    /** Request deletion of a child's data */
    async requestDeletion(childId, reason) {
      return rpcCall('request_parent_deletion', {
        p_child_id: childId,
        p_reason: reason || null,
      });
    },

    /** Get linked parents for a child */
    async getLinkedParents(childId) {
      return rpcCall('get_linked_parents_for_child', { p_child_id: childId });
    },

    /** Update child's display name */
    async updateChildName(childId, newName) {
      return rpcCall('update_child_name_by_parent', {
        p_child_id: childId,
        p_new_name: newName,
      });
    },

    /** Delete parent's own account */
    async deleteParentAccount() {
      return invokeFunction('delete-parent-account');
    },

    // ─── Terms Acceptance ───

    /** Accept terms for a child */
    async acceptTerms(childId, termsVersion) {
      return rpcCall('accept_parent_terms', {
        p_child_id: childId,
        p_terms_version: termsVersion || 1,
      });
    },

    // ─── GDPR Consents (parent_consents) ───

    /** Register a new consent for a child (GDPR art. 7) */
    async giveConsent(childId, consentType, consentVersion, givenMethod) {
      return rpcCall('give_consent', {
        p_child_user_id: childId,
        p_consent_type: consentType,
        p_consent_version: consentVersion,
        p_given_method: givenMethod || 'forældreportal_checkbox',
      });
    },

    /** Withdraw an active consent for a child. Efter SQL-RPC'en succes
     *  kaldes cleanup-user-avatar-storage Edge Function for at slette de
     *  fysiske filer i 'profile-pictures'-bucket — DB-rækkerne er allerede
     *  slettet af _delete_images_on_withdraw, men storage-objekter kræver
     *  service-role for at fjerne. */
    async withdrawConsent(childId, consentType) {
      const result = await rpcCall('withdraw_consent', {
        p_child_user_id: childId,
        p_consent_type: consentType,
      });

      // Hvis der er paths at rydde op fra storage, kald Edge Function (best-effort)
      const paths = Array.isArray(result?.deleted_storage_paths) ? result.deleted_storage_paths : [];
      if (result?.success && paths.length > 0) {
        try {
          await fetchFunction('cleanup-user-avatar-storage', {
            child_user_id: childId,
            paths,
          });
        } catch (e) {
          console.warn('[withdrawConsent] storage cleanup fejlede (DB-rækker er fjernet, storage-objekter forbliver indtil næste cleanup):', e?.message || e);
        }
      }

      return result;
    },

    /** Get full consent history for a child */
    async getConsentHistory(childId) {
      return rpcCall('get_consent_history', {
        p_child_user_id: childId,
      });
    },
  };
})();
