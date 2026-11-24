// Mitteilungen (Web Push): Wochenrückblick am Sonntag, auch auf dem iPhone (als Home-Bildschirm-App ab iOS 16.4).
// Einrichtung: VAPID-Schlüssel (npx web-push generate-vapid-keys), SUPABASE_SERVICE_ROLE_KEY, Tabelle aus
// supabase/training-push.sql und optional CRON_SECRET. Details in docs/SELBST-HOSTEN.md.
import webpush from 'web-push';

const env = (k) => (process.env[k] || '').trim().replace(/^["']|["']$/g, '');
const cleanUrl = (u) => { if (!u) return ''; try { return new URL(/^https?:\/\//.test(u) ? u : `https://${u}`).origin; } catch { return u; } };
const sbUrl = () => cleanUrl(env('SUPABASE_URL') || env('VITE_SUPABASE_URL'));
const anonKey = () => env('SUPABASE_ANON_KEY') || env('VITE_SUPABASE_ANON_KEY');
const serviceKey = () => env('SUPABASE_SERVICE_ROLE_KEY');

export const pushConfigured = () => !!(env('VAPID_PUBLIC_KEY') && env('VAPID_PRIVATE_KEY') && sbUrl() && serviceKey());

// Supabase-REST mit dem Dienstschlüssel (liest alle Abos und die Wochendaten; nur auf dem Server).
async function rest(path, { method = 'GET', body, prefer } = {}) {
  const res = await fetch(`${sbUrl()}/rest/v1/${path}`, {
    method,
    headers: { apikey: serviceKey(), Authorization: `Bearer ${serviceKey()}`, 'Content-Type': 'application/json', ...(prefer ? { Prefer: prefer } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw Object.assign(new Error(`Supabase ${res.status}: ${await res.text()}`), { status: 502 });
  return res.status === 204 ? null : res.json().catch(() => null);
}

// Angemeldeten Nutzer über sein Zugangs-Token prüfen.
async function userFrom(headers) {
  const token = String(headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) throw Object.assign(new Error('Nicht angemeldet'), { status: 401 });
  const res = await fetch(`${sbUrl()}/auth/v1/user`, { headers: { apikey: anonKey() || serviceKey(), Authorization: `Bearer ${token}` } });
  if (!res.ok) throw Object.assign(new Error('Anmeldung ungültig'), { status: 401 });
  return res.json();
}

const day = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
const addDays = (iso, n) => { const d = new Date(`${iso}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const de = (x, digits = 1) => String(Math.round(x * 10 ** digits) / 10 ** digits).replace('.', ',');

// Text des Wochenrückblicks: Stunden, Einheiten, Belastung, Vergleich zur Vorwoche, nächstes Rennen.
export function weekSummaryText({ week = [], prev = [], races = [], today }) {
  const sum = (list) => ({ h: list.reduce((a, x) => a + (x.durationS || 0), 0) / 3600, n: list.length, load: list.reduce((a, x) => a + (x.load || 0), 0) });
  const w = sum(week), p = sum(prev);
  const parts = [`${de(w.h)} h in ${w.n} ${w.n === 1 ? 'Einheit' : 'Einheiten'}`];
  if (w.load) parts.push(`Belastung ${Math.round(w.load)}`);
  if (p.n) parts.push(`Vorwoche ${de(p.h)} h`);
  const next = races.filter((r) => r.date >= today).sort((a, b) => a.date.localeCompare(b.date))[0];
  const daysTo = next ? Math.round((Date.parse(`${next.date}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) / 864e5) : null;
  let text = `Diese Woche: ${parts.join(' · ')}.`;
  if (next) text += ` Nächstes Rennen: ${String(next.name || 'Rennen').trim()} in ${daysTo} ${daysTo === 1 ? 'Tag' : 'Tagen'}.`;
  if (!w.n) text = `Diese Woche ist noch keine Einheit eingetragen.${next ? ` Nächstes Rennen: ${String(next.name || 'Rennen').trim()} in ${daysTo} Tagen.` : ''}`;
  return text;
}

async function summaryFor(owner, now = new Date()) {
  const today = day(now), from = addDays(today, -6), prevFrom = addDays(today, -13);
  const acts = (await rest(`training_records?select=data&owner=eq.${owner}&collection=eq.activities&deleted=eq.false&data->>date=gte.${prevFrom}`)).map((r) => r.data || {});
  const races = (await rest(`training_records?select=data&owner=eq.${owner}&collection=eq.races&deleted=eq.false`)).map((r) => r.data || {});
  return weekSummaryText({
    week: acts.filter((a) => a.date >= from && a.date <= today),
    prev: acts.filter((a) => a.date >= prevFrom && a.date < from),
    races,
    today,
  });
}

async function sendTo(subs, payload) {
  webpush.setVapidDetails(env('VAPID_SUBJECT') || 'mailto:push@example.invalid', env('VAPID_PUBLIC_KEY'), env('VAPID_PRIVATE_KEY'));
  let sent = 0;
  for (const s of subs) {
    try { await webpush.sendNotification(s.subscription, JSON.stringify(payload)); sent++; } catch (e) {
      // Abo abgelaufen oder zurückgezogen: entfernen.
      if (e.statusCode === 404 || e.statusCode === 410) await rest(`training_push?endpoint=eq.${encodeURIComponent(s.endpoint)}`, { method: 'DELETE' }).catch(() => {});
      else console.error('[push]', e.statusCode, e.body || e.message);
    }
  }
  return sent;
}

// action: subscribe | unsubscribe | test (mit Nutzer-Token) oder Zeitplan-Aufruf (cron) für alle.
export async function handlePush({ method, query = {}, body = {}, headers = {} }) {
  if (!pushConfigured()) throw Object.assign(new Error('Mitteilungen sind auf dem Server nicht eingerichtet (VAPID-Schlüssel, SUPABASE_SERVICE_ROLE_KEY).'), { status: 501 });
  if (method === 'GET' && query.cron) {
    const secret = env('CRON_SECRET');
    if (secret && headers.authorization !== `Bearer ${secret}`) throw Object.assign(new Error('Nicht erlaubt'), { status: 401 });
    const subs = await rest('training_push?select=endpoint,owner,subscription');
    const owners = [...new Set(subs.map((s) => s.owner))];
    let sent = 0;
    for (const o of owners) sent += await sendTo(subs.filter((s) => s.owner === o), { title: 'Wochenrückblick', body: await summaryFor(o), url: '/' });
    return { ok: true, sent };
  }
  const user = await userFrom(headers);
  if (body.action === 'subscribe') {
    const sub = body.subscription;
    if (!sub?.endpoint) throw Object.assign(new Error('Abo fehlt'), { status: 400 });
    await rest('training_push?on_conflict=endpoint', { method: 'POST', prefer: 'resolution=merge-duplicates', body: { endpoint: sub.endpoint, owner: user.id, subscription: sub } });
    return { ok: true };
  }
  if (body.action === 'unsubscribe') {
    await rest(`training_push?endpoint=eq.${encodeURIComponent(body.endpoint || '')}&owner=eq.${user.id}`, { method: 'DELETE' });
    return { ok: true };
  }
  if (body.action === 'test') {
    const subs = await rest(`training_push?select=endpoint,owner,subscription&owner=eq.${user.id}`);
    const sent = await sendTo(subs, { title: 'Wochenrückblick', body: await summaryFor(user.id), url: '/' });
    return { ok: true, sent };
  }
  throw Object.assign(new Error('Unbekannte Aktion'), { status: 400 });
}
