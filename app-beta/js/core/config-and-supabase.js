// Ansvar: Supabase-client, institutionsvalg, login, profiler, generel config.
import { instrumentSupabase } from './db-instrumentation.js';

// App version - skal matche version.json efter deploy
export const FLANGO_VERSION = '3.0.8';

const SUPABASE_URL = 'https://jbknjgbpghrbrstqwoxj.supabase.co'; // Dette er din nye URL for Flango-3
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impia25qZ2JwZ2hyYnJzdHF3b3hqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI2MjIwNjMsImV4cCI6MjA3ODE5ODA2M30.ZMlxQyzmXuy43EcKIN6-eO8pJZs2F6kfDw_cfaks9qQ';

export const INSTITUTION_ID_KEY = 'flango_institution_id';
export const INSTITUTION_NAME_KEY = 'flango_institution_name';

// Opret Supabase client med instrumentering
// Supabase er inkluderet via CDN i index.html, så den er tilgængelig globalt
// I ES6 modules skal vi bruge window.supabase eksplicit
const supabaseLib = typeof window !== 'undefined' && window.supabase ? window.supabase : (typeof supabase !== 'undefined' ? supabase : null);
if (!supabaseLib || typeof supabaseLib.createClient !== 'function') {
    throw new Error('Supabase library ikke fundet. Tjek at CDN script er inkluderet i index.html');
}
// Supabase auth config - undgår lock-problemer ved at bruge unik storage key
const authConfig = {
    auth: {
        storageKey: 'flango-auth-v3',
        storage: typeof window !== 'undefined' ? window.localStorage : undefined,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
        // Vigtigt: flowType 'implicit' undgår nogle lock-problemer
        flowType: 'implicit',
    }
};

const _rawClient = supabaseLib.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, authConfig);
export const supabaseClient = instrumentSupabase(_rawClient);

console.log('Supabase client initialiseret til Flango-3.');

const adminCacheByInstitution = {};

export { SUPABASE_URL, SUPABASE_ANON_KEY };
