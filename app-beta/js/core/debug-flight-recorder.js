// js/core/debug-flight-recorder.js
// Flight recorder for Flango - captures debug events and errors for bug reports

const STORAGE_KEY_EVENTS = 'flango_debug_events_v1';
const STORAGE_KEY_ERRORS = 'flango_debug_errors_v1';
const MAX_EVENTS = 300;
const MAX_ERRORS = 100;
const PERSIST_INTERVAL = 10; // Persist every N events/errors

// Ring buffers
let eventBuffer = [];
let errorBuffer = [];
let eventsSinceLastPersist = 0;
let errorsSinceLastPersist = 0;
let isInitialized = false;

// Secrets patterns to mask
const SECRET_PATTERNS = [
    /bearer\s+[a-zA-Z0-9\-_\.]+/gi,
    /token["\s:=]+["']?[a-zA-Z0-9\-_\.]{20,}["']?/gi,
    /api[_-]?key["\s:=]+["']?[a-zA-Z0-9\-_\.]{16,}["']?/gi,
    /password["\s:=]+["']?[^"'\s]{4,}["']?/gi,
    /secret["\s:=]+["']?[a-zA-Z0-9\-_\.]{16,}["']?/gi,
    /authorization["\s:=]+["']?[a-zA-Z0-9\-_\.]{20,}["']?/gi,
    /session[_-]?id["\s:=]+["']?[a-zA-Z0-9\-_\.]{16,}["']?/gi,
    /supabase[a-zA-Z]*["\s:=]+["']?[a-zA-Z0-9\-_\.]{20,}["']?/gi,
    /eyJ[a-zA-Z0-9\-_]{50,}\.[a-zA-Z0-9\-_]+\.[a-zA-Z0-9\-_]*/g, // JWT tokens
];

/**
 * Sanitize a value by masking potential secrets
 */
function sanitize(value) {
    if (value === null || value === undefined) return value;
    
    if (typeof value === 'string') {
        let sanitized = value;
        for (const pattern of SECRET_PATTERNS) {
            sanitized = sanitized.replace(pattern, '[REDACTED]');
        }
        return sanitized;
    }
    
    if (Array.isArray(value)) {
        return value.map(sanitize);
    }
    
    if (typeof value === 'object') {
        const sanitized = {};
        for (const key of Object.keys(value)) {
            const lowerKey = key.toLowerCase();
            // Redact keys that look like secrets
            if (lowerKey.includes('token') || lowerKey.includes('password') || 
                lowerKey.includes('secret') || lowerKey.includes('key') ||
                lowerKey.includes('auth') || lowerKey.includes('bearer') ||
                lowerKey.includes('credential') || lowerKey.includes('session')) {
                sanitized[key] = '[REDACTED]';
            } else {
                sanitized[key] = sanitize(value[key]);
            }
        }
        return sanitized;
    }
    
    return value;
}

/**
 * Add event to ring buffer
 */
function addToBuffer(buffer, item, maxSize) {
    buffer.push(item);
    if (buffer.length > maxSize) {
        buffer.shift();
    }
}

/**
 * Load buffers from localStorage
 */
function loadFromStorage() {
    try {
        const eventsJson = localStorage.getItem(STORAGE_KEY_EVENTS);
        if (eventsJson) {
            const loaded = JSON.parse(eventsJson);
            if (Array.isArray(loaded)) {
                eventBuffer = loaded.slice(-MAX_EVENTS);
            }
        }
    } catch (e) {
        console.warn('[debug-flight-recorder] Failed to load events from storage:', e);
    }
    
    try {
        const errorsJson = localStorage.getItem(STORAGE_KEY_ERRORS);
        if (errorsJson) {
            const loaded = JSON.parse(errorsJson);
            if (Array.isArray(loaded)) {
                errorBuffer = loaded.slice(-MAX_ERRORS);
            }
        }
    } catch (e) {
        console.warn('[debug-flight-recorder] Failed to load errors from storage:', e);
    }
}

/**
 * Persist buffers to localStorage
 */
function persistToStorage() {
    try {
        localStorage.setItem(STORAGE_KEY_EVENTS, JSON.stringify(eventBuffer));
    } catch (e) {
        console.warn('[debug-flight-recorder] Failed to persist events:', e);
    }
    
    try {
        localStorage.setItem(STORAGE_KEY_ERRORS, JSON.stringify(errorBuffer));
    } catch (e) {
        console.warn('[debug-flight-recorder] Failed to persist errors:', e);
    }
}

/**
 * Log a debug event
 * @param {string} type - Event type (e.g., 'purchase_started', 'user_selected')
 * @param {object} data - Event data (will be sanitized)
 */
export function logDebugEvent(type, data = {}) {
    const event = {
        ts: Date.now(),
        type: sanitize(type),
        data: sanitize(data),
    };
    
    addToBuffer(eventBuffer, event, MAX_EVENTS);
    eventsSinceLastPersist++;
    
    if (eventsSinceLastPersist >= PERSIST_INTERVAL) {
        eventsSinceLastPersist = 0;
        persistToStorage();
    }
}

/**
 * Capture an error
 * @param {string} errorType - 'error' | 'unhandledrejection' | 'console.error'
 * @param {object} payload - Error details
 */
export function captureError(errorType, payload) {
    const errorEntry = {
        ts: Date.now(),
        type: errorType,
        message: sanitize(payload.message || 'Unknown error'),
        stack: sanitize(payload.stack ? payload.stack.substring(0, 1000) : null),
        extra: sanitize(payload.extra || null),
    };
    
    addToBuffer(errorBuffer, errorEntry, MAX_ERRORS);
    errorsSinceLastPersist++;
    
    if (errorsSinceLastPersist >= PERSIST_INTERVAL) {
        errorsSinceLastPersist = 0;
        persistToStorage();
    }
}

/**
 * Generate and download the debug report
 * @param {string} userNote - Optional user description of the issue
 */
export function downloadDebugReport(userNote = '') {
    // Log the report generation itself
    logDebugEvent('debug_report_generated', { userNoteLength: userNote?.length || 0 });
    
    // Force persist before generating report
    persistToStorage();
    
    // Build report
    const report = {
        reportGeneratedAt: new Date().toISOString(),
        timezoneOffset: new Date().getTimezoneOffset(),
        
        // App info
        appVersion: window.FLANGO_VERSION || 'unknown',
        buildDate: window.FLANGO_BUILD_DATE || 'unknown',
        
        // Environment
        url: sanitize(window.location.href),
        institutionId: window.__flangoInstitutionSettings?.id || 
                       (typeof getInstitutionId === 'function' ? getInstitutionId() : null) ||
                       'unknown',
        
        // Browser info
        userAgent: navigator.userAgent,
        viewport: {
            width: window.innerWidth,
            height: window.innerHeight,
            devicePixelRatio: window.devicePixelRatio,
        },
        
        // User note
        userNote: sanitize(userNote),
        
        // Events and errors
        events: eventBuffer.slice(), // Copy
        errors: errorBuffer.slice(), // Copy
        
        // Summary stats
        stats: {
            totalEvents: eventBuffer.length,
            totalErrors: errorBuffer.length,
            oldestEventAge: eventBuffer.length > 0 
                ? Date.now() - eventBuffer[0].ts 
                : null,
            newestEventAge: eventBuffer.length > 0 
                ? Date.now() - eventBuffer[eventBuffer.length - 1].ts 
                : null,
        },
    };
    
    // Generate filename
    const now = new Date();
    const timestamp = now.toISOString()
        .replace(/[:.]/g, '-')
        .replace('T', '_')
        .substring(0, 19);
    const filename = `flango-bugreport-${timestamp}.json`;
    
    // Create and trigger download
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    return filename;
}

/**
 * Show the bug report prompt and handle download
 */
export async function showBugReportPrompt() {
    logDebugEvent('bug_report_prompt_opened', {});
    
    // Create modal elements
    const backdrop = document.createElement('div');
    backdrop.style.cssText = `
        position: fixed;
        inset: 0;
        background: rgba(0,0,0,0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 100000;
    `;
    
    const modal = document.createElement('div');
    modal.style.cssText = `
        background: white;
        border-radius: 16px;
        padding: 24px;
        max-width: 400px;
        width: 90%;
        box-shadow: 0 8px 32px rgba(0,0,0,0.2);
    `;
    
    modal.innerHTML = `
        <h3 style="margin: 0 0 16px 0; font-size: 18px; color: #1f2937;">🐛 Fejlrapport</h3>
        <p style="margin: 0 0 12px 0; font-size: 14px; color: #6b7280;">
            Beskriv kort hvad der skete (valgfrit):
        </p>
        <textarea id="bug-report-note" style="
            width: 100%;
            height: 100px;
            padding: 12px;
            border: 2px solid #e5e7eb;
            border-radius: 8px;
            font-size: 14px;
            resize: vertical;
            box-sizing: border-box;
            font-family: inherit;
        " placeholder="F.eks. 'Kurven viste forkerte produkter' eller 'Der kom en fejllyd efter køb'"></textarea>
        <div style="display: flex; gap: 12px; margin-top: 16px;">
            <button id="bug-report-ok" style="
                flex: 1;
                padding: 12px 20px;
                background: linear-gradient(135deg, #ef4444, #dc2626);
                color: white;
                border: none;
                border-radius: 8px;
                font-size: 15px;
                font-weight: 600;
                cursor: pointer;
            ">Download Rapport</button>
            <button id="bug-report-cancel" style="
                padding: 12px 20px;
                background: #f3f4f6;
                color: #4b5563;
                border: 2px solid #e5e7eb;
                border-radius: 8px;
                font-size: 15px;
                font-weight: 600;
                cursor: pointer;
            ">Annuller</button>
        </div>
    `;
    
    backdrop.appendChild(modal);
    document.body.appendChild(backdrop);
    
    const textarea = modal.querySelector('#bug-report-note');
    const okBtn = modal.querySelector('#bug-report-ok');
    const cancelBtn = modal.querySelector('#bug-report-cancel');
    
    // Focus textarea
    setTimeout(() => textarea.focus(), 50);
    
    return new Promise((resolve) => {
        const cleanup = (result) => {
            document.body.removeChild(backdrop);
            resolve(result);
        };
        
        okBtn.onclick = () => {
            const userNote = textarea.value.trim();
            if (userNote) {
                logDebugEvent('user_note_submitted', { noteLength: userNote.length });
            }
            const filename = downloadDebugReport(userNote);
            cleanup({ downloaded: true, filename });
            
            // Show toast
            showBugReportToast(`Fejlrapport downloadet: ${filename}`);
        };
        
        cancelBtn.onclick = () => {
            logDebugEvent('bug_report_cancelled', {});
            cleanup({ downloaded: false });
        };
        
        backdrop.onclick = (e) => {
            if (e.target === backdrop) {
                logDebugEvent('bug_report_cancelled', {});
                cleanup({ downloaded: false });
            }
        };
    });
}

/**
 * Show a toast notification
 */
function showBugReportToast(message) {
    const toast = document.createElement('div');
    toast.style.cssText = `
        position: fixed;
        bottom: 24px;
        left: 50%;
        transform: translateX(-50%);
        background: linear-gradient(135deg, #10b981, #059669);
        color: white;
        padding: 14px 24px;
        border-radius: 12px;
        font-size: 14px;
        font-weight: 600;
        box-shadow: 0 4px 16px rgba(0,0,0,0.2);
        z-index: 100001;
        animation: slideUp 0.3s ease-out;
    `;
    toast.textContent = message;
    
    // Add animation keyframes if not exists
    if (!document.getElementById('bug-report-toast-style')) {
        const style = document.createElement('style');
        style.id = 'bug-report-toast-style';
        style.textContent = `
            @keyframes slideUp {
                from { opacity: 0; transform: translateX(-50%) translateY(20px); }
                to { opacity: 1; transform: translateX(-50%) translateY(0); }
            }
        `;
        document.head.appendChild(style);
    }
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.3s';
        setTimeout(() => document.body.removeChild(toast), 300);
    }, 4000);
}

/**
 * Setup error capturing hooks
 */
function setupErrorCapture() {
    // Store original console.error
    const originalConsoleError = console.error;
    
    // Wrap console.error
    console.error = function(...args) {
        // Call original first
        originalConsoleError.apply(console, args);
        
        // Capture the error
        try {
            const message = args.map(arg => {
                if (arg instanceof Error) return arg.message;
                if (typeof arg === 'string') return arg;
                try { return JSON.stringify(arg); } catch { return String(arg); }
            }).join(' ');
            
            captureError('console.error', {
                message: message.substring(0, 500),
                extra: { argCount: args.length },
            });
        } catch (e) {
            // Don't break if capture fails
        }
    };
    
    // Global error handler
    const originalOnError = window.onerror;
    window.onerror = function(message, source, lineno, colno, error) {
        captureError('error', {
            message: String(message).substring(0, 500),
            stack: error?.stack?.substring(0, 1000) || null,
            extra: { source, lineno, colno },
        });
        
        // Call original if exists
        if (typeof originalOnError === 'function') {
            return originalOnError.apply(this, arguments);
        }
        return false;
    };
    
    // Unhandled promise rejection handler
    const originalOnUnhandledRejection = window.onunhandledrejection;
    window.onunhandledrejection = function(event) {
        const reason = event.reason;
        captureError('unhandledrejection', {
            message: reason?.message || String(reason).substring(0, 500),
            stack: reason?.stack?.substring(0, 1000) || null,
            extra: { type: typeof reason },
        });
        
        // Call original if exists
        if (typeof originalOnUnhandledRejection === 'function') {
            return originalOnUnhandledRejection.apply(this, arguments);
        }
    };
}

/**
 * Initialize the debug flight recorder
 */
export function initDebugRecorder() {
    if (isInitialized) {
        logDebugEvent('debug_recorder_init_duplicate', {});
        return;
    }
    
    isInitialized = true;
    
    // Load existing data from storage
    loadFromStorage();
    
    // Setup error capture
    setupErrorCapture();
    
    // Expose global helper
    window.FLANGO_DEBUG = {
        log: logDebugEvent,
        captureError: captureError,
        downloadReport: downloadDebugReport,
        showBugReportPrompt: showBugReportPrompt,
        getEvents: () => eventBuffer.slice(),
        getErrors: () => errorBuffer.slice(),
        clear: () => {
            eventBuffer = [];
            errorBuffer = [];
            persistToStorage();
        },
    };
    
    // Log initialization
    logDebugEvent('debug_recorder_initialized', {
        existingEvents: eventBuffer.length,
        existingErrors: errorBuffer.length,
    });
    
    // Persist on page unload
    window.addEventListener('beforeunload', () => {
        persistToStorage();
    });
    
    console.log('[debug-flight-recorder] Initialized with', eventBuffer.length, 'events and', errorBuffer.length, 'errors');
}

// Export for use in other modules
export { sanitize };
