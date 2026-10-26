// Verbindung zur Online-Datenbank (dasselbe Supabase-Projekt wie SkiWax).
// Ohne VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY läuft die App rein lokal weiter.
// Der „anon key“ ist für den Browser gedacht; geschützt werden die Daten durch die Regeln in supabase/training.sql.
import { createClient } from '@supabase/supabase-js';

// Nur Protokoll und Host verwenden (eine kopierte „API URL“ mit /rest/v1/ am Ende würde sonst stören).
const cleanUrl = (u) => { const t = (u || '').trim().replace(/^["']|["']$/g, ''); if (!t) return ''; try { return new URL(/^https?:\/\//.test(t) ? t : 'https://' + t).origin; } catch { return t; } };
const url = cleanUrl(import.meta.env?.VITE_SUPABASE_URL);
const key = (import.meta.env?.VITE_SUPABASE_ANON_KEY || '').trim().replace(/^["']|["']$/g, '');
export const cloudConfigured = !!(url && key);
export const supabase = cloudConfigured ? createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }) : null;
