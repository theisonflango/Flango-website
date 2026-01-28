// js/core/auth-retry.js
// Central helper: refresh Supabase session and retry once on auth errors.
import { supabaseClient } from './config-and-supabase.js';

function isAuthError(error) {
    if (!error) return false;
    const status = Number(error.status || error.code || 0);
    const message = String(error.message || '').toLowerCase();
    return (
        status === 401 ||
        status === 403 ||
        message.includes('jwt') ||
        message.includes('token') ||
        message.includes('not authorized') ||
        message.includes('permission denied')
    );
}

export async function runWithAuthRetry(label, callFn) {
    if (typeof callFn !== 'function') {
        return { data: null, error: new Error('runWithAuthRetry: callFn mangler') };
    }
    
    // #region agent log
    const sessionCheck = await supabaseClient.auth.getSession();
    fetch('http://127.0.0.1:7243/ingest/061553fc-00e4-4d47-b4a3-265f30951c0a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'auth-retry.js:19',message:'runWithAuthRetry entry',data:{label,hasSession:!!sessionCheck.data?.session,userId:sessionCheck.data?.session?.user?.id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
    // #endregion

    try {
        const initial = await callFn();
        
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/061553fc-00e4-4d47-b4a3-265f30951c0a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'auth-retry.js:26',message:'After initial callFn',data:{label,hasError:!!initial?.error,errorMessage:initial?.error?.message,errorCode:initial?.error?.code,isAuthError:initial?.error ? isAuthError(initial.error) : false},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
        // #endregion

        if (!initial?.error || !isAuthError(initial.error)) {
            return initial;
        }

        console.warn(`[auth-retry] ${label} auth-fejl, forsøger session refresh...`);
        const { error: refreshError } = await supabaseClient.auth.refreshSession();
        
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/061553fc-00e4-4d47-b4a3-265f30951c0a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'auth-retry.js:32',message:'After refreshSession',data:{label,refreshError:refreshError?.message,hasRefreshError:!!refreshError},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
        // #endregion

        if (refreshError) {
            console.warn('[auth-retry] refreshSession fejlede:', refreshError?.message || refreshError);
            return initial;
        }

        const retryResult = await callFn();
        
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/061553fc-00e4-4d47-b4a3-265f30951c0a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'auth-retry.js:38',message:'After retry callFn',data:{label,hasError:!!retryResult?.error,errorMessage:retryResult?.error?.message,errorCode:retryResult?.error?.code},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
        // #endregion

        return retryResult;
    } catch (err) {
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/061553fc-00e4-4d47-b4a3-265f30951c0a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'auth-retry.js:40',message:'runWithAuthRetry catch',data:{label,error:err?.message,errorCode:err?.code},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
        // #endregion
        return { data: null, error: err };
    }
}
