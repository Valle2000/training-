// Ablauf des Online-Abgleichs: holen, zusammenführen, hochladen. Läuft beim Start, nach der Anmeldung,
// beim Zurückkehren in die App und kurz nach jeder lokalen Änderung.
import { useEffect, useState } from 'react';
import { supabase, cloudConfigured } from './supabase.js';
import { getData, update, subscribe, getLocalSeries, setSeriesFallback } from './store.js';
import { planSync, applyRows, fingerprint } from './cloud.js';

const META_KEY = 'trainings-app-sync-meta';
const loadMeta = () => { try { return JSON.parse(localStorage.getItem(META_KEY) || '{}'); } catch { return {}; } };
const saveMeta = (m) => { try { localStorage.setItem(META_KEY, JSON.stringify(m)); } catch { /* nur Komfort */ } };

let status = { state: cloudConfigured ? 'off' : 'unconfigured', email: null, last: loadMeta().lastSync || null, error: null };
const statusListeners = new Set();
const setStatus = (patch) => { status = { ...status, ...patch }; statusListeners.forEach((l) => l(status)); };
export function useCloudStatus() {
  const [s, setS] = useState(status);
  useEffect(() => { statusListeners.add(setS); return () => statusListeners.delete(setS); }, []);
  return s;
}

let running = null, again = false, applying = false;

async function pullAll(since) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    let q = supabase.from('training_records').select('collection,id,data,deleted,updated_at').order('updated_at', { ascending: true }).range(from, from + 999);
    if (since) q = q.gt('updated_at', since);
    const { data, error } = await q;
    if (error) throw error;
    rows.push(...data);
    if (data.length < 1000) return rows;
  }
}

async function run() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) { setStatus({ state: 'off', email: null }); return; }
  setStatus({ state: 'syncing', email: session.user.email, error: null });
  let meta = loadMeta();
  if (meta.userId !== session.user.id) meta = { userId: session.user.id, fp: {}, lastPulled: null, seriesPushed: {} };
  const rows = await pullAll(meta.lastPulled);
  const { apply, push, nextFp } = planSync(getData(), meta.fp || {}, rows);
  if (apply.length) { applying = true; update((d) => applyRows(d, apply)); applying = false; }
  for (let i = 0; i < push.length; i += 200) {
    const chunk = push.slice(i, i + 200).map((r) => ({ ...r, owner: session.user.id }));
    const { error } = await supabase.from('training_records').upsert(chunk, { onConflict: 'owner,collection,id' });
    if (error) throw error;
    for (const r of chunk) nextFp[`${r.collection}:${r.id}`] = r.deleted ? 'deleted' : fingerprint(r.data);
  }
  if (rows.length) meta.lastPulled = rows.at(-1).updated_at;
  meta.fp = nextFp;
  // Verläufe hochladen (einmal je Einheit, höchstens 40 pro Durchgang, damit es flüssig bleibt).
  meta.seriesPushed ||= {};
  const todo = getData().activities.filter((a) => a.hasSeries && !meta.seriesPushed[a.id]).slice(0, 40);
  for (const a of todo) {
    const series = await getLocalSeries(a.id);
    if (!series) continue;
    const { error } = await supabase.from('training_series').upsert({ owner: session.user.id, activity_id: a.id, data: series }, { onConflict: 'owner,activity_id' });
    if (error) throw error;
    meta.seriesPushed[a.id] = true;
  }
  meta.lastSync = new Date().toISOString();
  saveMeta(meta);
  setStatus({ state: 'ok', last: meta.lastSync });
  if (todo.length === 40) again = true;
}

export async function syncNow() {
  if (!cloudConfigured) return;
  if (running) { again = true; return running; }
  running = run().catch((e) => { console.error('[sync]', e); setStatus({ state: 'error', error: e.message || String(e) }); }).finally(() => { running = null; if (again) { again = false; syncNow(); } });
  return running;
}

let timer = null;
export function startCloudSync() {
  if (!cloudConfigured) return;
  setSeriesFallback(async (id) => {
    const { data } = await supabase.from('training_series').select('data').eq('activity_id', id).maybeSingle();
    return data?.data || null;
  });
  supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') { if (session) syncNow(); else setStatus({ state: 'off', email: null }); }
    if (event === 'SIGNED_OUT') setStatus({ state: 'off', email: null });
  });
  subscribe(() => { if (applying) return; clearTimeout(timer); timer = setTimeout(syncNow, 4000); });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') syncNow(); });
}

export async function signIn(email, password) {
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  if (error) throw error;
}
export async function signUp(email, password) {
  const { data, error } = await supabase.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: location.origin } });
  if (error) throw error;
  return !!data.session;
}
export async function resetPassword(email) {
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: location.origin });
  if (error) throw error;
}
export async function signOut() { await supabase.auth.signOut(); setStatus({ state: 'off', email: null }); }
