// Vendor shims: Erstatter CDN script-tags med npm-pakker.
// Sætter globale variabler så eksisterende kode (IIFEs, config-and-supabase.js) virker uændret.
import { createClient } from '@supabase/supabase-js';
import Sortable from 'sortablejs';
import Papa from 'papaparse';

window.supabase = { createClient };
window.Sortable = Sortable;
window.Papa = Papa;
