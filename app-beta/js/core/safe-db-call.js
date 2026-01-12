// js/core/safe-db-call.js
// Minimal, centralized wrapper for Supabase calls with uniform logging and optional retry.

function createCorrelationId() {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function isTransientError(error) {
    if (!error) return false;
    const msg = String(error.message || '').toLowerCase();
    return (
        error.status === 0 ||
        error.code === 'ECONNRESET' ||
        error.code === 'ETIMEDOUT' ||
        msg.includes('timeout') ||
        msg.includes('network')
    );
}

/**
 * Safe wrapper around Supabase calls.
 * @param {string} label - Short label for logs.
 * @param {Function} fn - Async function performing the Supabase call. Should return { data, error } or throw.
 * @param {Object} options
 * @param {number} [options.retry=0] - How many retries on transient errors.
 * @param {boolean} [options.critical=false] - If true, caller should treat failure as blocking.
 * @returns {Promise<{ ok: boolean, data?: any, error?: any, correlationId: string }>}
 */
export async function safeDbCall(label, fn, { retry = 0, critical = false } = {}) {
    const correlationId = createCorrelationId();
    let attempts = 0;
    let lastError = null;

    while (attempts <= retry) {
        try {
            const result = await fn();
            if (result?.error) throw result.error;
            return { ok: true, data: result?.data ?? result, correlationId };
        } catch (err) {
            lastError = err;
            attempts++;
            console.error(`[db][${label}] fail (attempt ${attempts}/${retry + 1})`, {
                correlationId,
                message: err?.message,
                code: err?.code,
                status: err?.status,
            });

            if (attempts > retry || !isTransientError(err)) {
                break;
            }
        }
    }

    if (critical) {
        console.warn(`[db][${label}] critical failure`, { correlationId, message: lastError?.message });
    }

    return { ok: false, error: lastError, correlationId };
}
