import { supabaseClient } from '../core/config-and-supabase.js';

export async function getCurrentUserProfile(session) {
    if (!session) return null;
    const { data, error } = await supabaseClient
        .from('users')
        .select('*')
        .eq('user_id', session.user.id)
        .single();
    return error ? null : data;
}

export async function performLogin(email, password) {
    const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) {
        return { success: false, error: error.message };
    }
    return { success: true };
}
