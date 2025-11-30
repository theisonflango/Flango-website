let currentAdmin = null;
let currentClerk = null;
let institutionId = null;
let appStarted = false;
let sessionStartTime = null;

export function setCurrentAdmin(adminProfile) {
    currentAdmin = adminProfile || null;
}

export function getCurrentAdmin() {
    return currentAdmin;
}

export function getCurrentSessionAdmin() {
    return currentAdmin;
}

export function setCurrentClerk(clerkProfile) {
    currentClerk = clerkProfile || null;
}

export function getCurrentClerk() {
    return currentClerk;
}

export function isCurrentUserAdmin() {
    return currentClerk?.role === 'admin';
}

export function clearSession() {
    currentAdmin = null;
    currentClerk = null;
    institutionId = null;
    appStarted = false;
    sessionStartTime = null;
    // Nulstil eventuelle globale spejle for bagudkompatibilitet
    // TODO: Legacy window.__flango* spejle kan udfases, når alle kald bruger session-store alene.
    if (typeof window !== 'undefined') {
        window.__flangoCurrentAdminProfile = null;
        window.__flangoCurrentClerkProfile = null;
        window.__flangoCurrentClerkRole = null;
        window.__flangoCurrentAdminRole = null;
        window.__flangoAppStarted = false;
    }
}

export function clearClerkSession() {
    currentClerk = null;
    appStarted = false;
    sessionStartTime = null;
    if (typeof window !== 'undefined') {
        window.__flangoCurrentClerkProfile = null;
        window.__flangoCurrentClerkRole = null;
        // Admin-spejle forbliver urørte her
    }
}

export function setInstitutionId(id) {
    institutionId = id || null;
}

export function getInstitutionId() {
    return institutionId;
}

export function markAppStarted() {
    appStarted = true;
}

export function hasAppStarted() {
    return appStarted;
}

export function setSessionStartTime(ts) {
    sessionStartTime = ts || null;
}

export function getSessionStartTime() {
    return sessionStartTime;
}
