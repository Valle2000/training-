// Ablauf des Online-Abgleichs: holen, zusammenführen, hochladen. Läuft beim Start, nach der Anmeldung,
// beim Zurückkehren in die App und kurz nach jeder lokalen Änderung.
import { useEffect, useState } from 'react';
import { supabase, cloudConfigured } from './supabase.js';
import { getData, update, subscribe, getLocalSeries, setSeriesFallback, kvGet, kvPut } from './store.js';
import { planSync, applyRows, fingerprint } from './cloud.js';

const META_KEY = 'trainings-app-sync-meta';
// Gedächtnis des Abgleichs (Fingerabdrücke, hochgeladene Verläufe). Liegt in IndexedDB: Bei großen Datenmengen ist
// localStorage voll, dann ging das Gedächtnis verloren und der Abgleich lud alles immer wieder hoch (Endlosschleife).
let metaCache = null;
const lsMeta = () => { try { return JSON.parse(localStorage.getItem(META_KEY) || '{}'); } catch { return {}; } };
const loadMeta = () => metaCache || (metaCache = lsMeta());
const saveMeta = (m) => {
  metaCache = m;
  kvPut('sync-meta', m).catch(() => {});
  try { localStorage.setItem(META_KEY, JSON.stringify(m)); } catch { try { localStorage.removeItem(META_KEY); } catch { /* egal */ } }
};
const metaReady = kvGet('sync-meta').then((m) => {
  const ls = lsMeta();
  // Den Stand mit den meisten bereits hochgeladenen Verläufen nehmen.
  const count = (x) => Object.keys(x?.seriesPushed || {}).length;
  if (m && count(m) >= count(ls)) metaCache = m;
}).catch(() => {});
// Nach Neuladen/Löschen: Verläufe dieser Einheiten erneut hochladen.
export function forgetSeriesPushed(ids) {
  const m = loadMeta();
  for (const id of ids) delete m.seriesPushed?.[id];
  saveMeta(m);
}

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
  await metaReady;
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) { setStatus({ state: 'off', email: null }); return; }
  setStatus({ state: 'syncing', email: session.user.email, error: null });
  let meta = loadMeta();
  if (meta.userId !== session.user.id) meta = { userId: session.user.id, fp: {}, lastPulled: null, seriesPushed: {} };
  const rows = await pullAll(meta.lastPulled);
  const { apply, push, nextFp } = planSync(getData(), meta.fp || {}, rows);
  if (apply.length) { applying = true; update((d) => applyRows(d, apply)); applying = false; }
  for (let i = 0; i < push.length; i += 200) {
    if (push.length > 200) setStatus({ detail: `Einheiten hochladen: ${i} von ${push.length}` });
    const chunk = push.slice(i, i + 200).map((r) => ({ ...r, owner: session.user.id }));
    const { error } = await supabase.from('training_records').upsert(chunk, { onConflict: 'owner,collection,id' });
    if (error) throw error;
    for (const r of chunk) nextFp[`${r.collection}:${r.id}`] = r.deleted ? 'deleted' : fingerprint(r.data);
  }
  if (rows.length) meta.lastPulled = rows.at(-1).updated_at;
  meta.fp = nextFp;
  // Verläufe hochladen: einmal je Einheit, bis zu 120 pro Durchgang in Paketen zu 20; der Fortschritt steht im Konto-Bereich.
  meta.seriesPushed ||= {};
  const pending = getData().activities.filter((a) => a.hasSeries && !meta.seriesPushed[a.id]);
  const todo = pending.slice(0, 120);
  let doneCount = 0;
  for (let i = 0; i < todo.length; i += 20) {
    setStatus({ detail: `Puls-/Wattverläufe hochladen: noch ${pending.length - doneCount} Einheiten` });
    const rows = [];
    for (const a of todo.slice(i, i + 20)) { const data = await getLocalSeries(a.id); if (data) rows.push({ owner: session.user.id, activity_id: a.id, data }); else meta.seriesPushed[a.id] = true; }
    doneCount += Math.min(20, todo.length - i);
    if (!rows.length) continue;
    const { error } = await supabase.from('training_series').upsert(rows, { onConflict: 'owner,activity_id' });
    if (error) throw error;
    for (const r of rows) meta.seriesPushed[r.activity_id] = true;
    saveMeta(meta);
  }
  meta.lastSync = new Date().toISOString();
  saveMeta(meta);
  setStatus({ state: 'ok', last: meta.lastSync, detail: pending.length > todo.length ? `Puls-/Wattverläufe hochladen: noch ${pending.length - todo.length} Einheiten` : null });
  if (pending.length > todo.length) again = true;
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

// Verläufe gelöschter Einheiten auch in Supabase entfernen (die Einheiten selbst gehen als „gelöscht“ über den Abgleich).
export async function deleteRemoteSeries(ids) {
  forgetSeriesPushed(ids);
  if (!cloudConfigured) return;
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;
  for (let i = 0; i < ids.length; i += 100) {
    const { error } = await supabase.from('training_series').delete().in('activity_id', ids.slice(i, i + 100));
    if (error) throw error;
  }
}

// Die Trainings-App ist nur für den Betreiber: Nach der Anmeldung wird geprüft, ob das Konto eingetragen ist.
const ADMIN_ONLY = 'Die Trainings-App ist nur für den Betreiber freigegeben. Ein SkiWax-Konto funktioniert hier nicht.';
async function requireAdmin() {
  const { data: { user } } = await supabase.auth.getUser();
  const { data } = await supabase.from('training_admins').select('user_id').eq('user_id', user?.id || '').maybeSingle();
  if (data) return;
  await supabase.auth.signOut();
  throw new Error(ADMIN_ONLY);
}
export async function signIn(email, password) {
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  if (error) throw error;
  await requireAdmin();
}
// Konto anlegen geht nur über SkiWax; hier nicht, damit keine Trainings-Konten entstehen.
export async function signUp() {
  throw new Error('Konten werden hier nicht angelegt. Die Trainings-App ist nur für den Betreiber.');
}
export async function resetPassword(email) {
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: location.origin });
  if (error) throw error;
}
export async function signOut() { await supabase.auth.signOut(); setStatus({ state: 'off', email: null }); }
