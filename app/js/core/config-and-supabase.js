// Ansvar: Supabase-client, institutionsvalg, login, profiler, generel config.
import { instrumentSupabase } from './db-instrumentation.js';

// App version - skal matche version.json efter deploy
3.0.1'3.0.1';

const SUPABASE_URL = 'https://jbknjgbpghrbrstqwoxj.supabase.co'; // Dette er din nye URL for Flango-3
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impia25qZ2JwZ2hyYnJzdHF3b3hqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI2MjIwNjMsImV4cCI6MjA3ODE5ODA2M30.ZMlxQyzmXuy43EcKIN6-eO8pJZs2F6kfDw_cfaks9qQ';

export const INSTITUTION_ID_KEY = 'flango_institution_id';
export const INSTITUTION_NAME_KEY = 'flango_institution_name';

// Opret Supabase client med instrumentering
const _rawClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
export const supabaseClient = instrumentSupabase(_rawClient);

console.log('Supabase client initialiseret til Flango-3.');

const adminCacheByInstitution = {};

export { SUPABASE_URL, SUPABASE_ANON_KEY };
