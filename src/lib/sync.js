// Abgleich mit Polar, Concept2 (ErgData/Logbook) und Wahoo über /api/connect.
import { getData, update, putSeries } from './store.js';
import { toSeries } from './series.js';
import { buildActivity, findDuplicate, localDate } from './activities.js';
import { sportFromConcept2 } from './sports.js';

// FIT-Bibliothek ist groß und wird erst geladen, wenn eine FIT-Datei kommt.
const parseFit = async (bytes) => (await import('./fit.js')).parseFit(bytes);

export const PROVIDERS = {
  polar: { label: 'Polar', hint: 'Einheiten, Nightly Recharge (HRV) und Schlaf der letzten 30 Tage' },
  concept2: { label: 'Concept2 / ErgData', hint: 'SkiErg, RowErg und BikeErg aus dem Concept2 Logbook, inkl. Schlagdaten' },
  wahoo: { label: 'Wahoo', hint: 'Einheiten von Wahoo-Geräten als FIT-Datei' },
};

const STATE_KEY = 'trainings-app-oauth-state';

export function startConnect(provider) {
  const state = `${provider}.${Math.random().toString(36).slice(2)}`;
  try { sessionStorage.setItem(STATE_KEY, state); } catch { /* nur Schutz gegen fremde Rückleitungen */ }
  location.href = `/api/connect?provider=${provider}&op=start&state=${encodeURIComponent(state)}`;
}

// Rückkehr von der Anmeldung: #verbindung=polar&state=…&daten=base64url(JSON)
export function handleConnectReturn() {
  if (!location.hash.startsWith('#verbindung=')) return null;
  const p = new URLSearchParams(location.hash.slice(1));
  history.replaceState(null, '', location.pathname);
  const provider = p.get('verbindung');
  if (p.get('fehler')) return { provider, error: p.get('fehler') };
  let expected = null;
  try { expected = sessionStorage.getItem(STATE_KEY); sessionStorage.removeItem(STATE_KEY); } catch { /* s. o. */ }
  if (!expected || expected !== p.get('state')) return { provider, error: 'Ungültige Rückleitung, bitte erneut verbinden.' };
  const json = JSON.parse(atob(p.get('daten').replace(/-/g, '+').replace(/_/g, '/')));
  update((d) => ({ ...d, connections: { ...d.connections, [provider]: { ...json, connectedAt: new Date().toISOString() } } }));
  return { provider, ok: true };
}

export const disconnect = (provider) => update((d) => { const c = { ...d.connections }; delete c[provider]; return { ...d, connections: c }; });

async function token(provider) {
  let c = getData().connections[provider];
  if (!c) throw new Error(`${PROVIDERS[provider].label} ist nicht verbunden`);
  if (c.expires_at && c.expires_at < Date.now() + 60000 && c.refresh_token) {
    const r = await fetch(`/api/connect?provider=${provider}&op=refresh`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refresh_token: c.refresh_token }) });
    const json = await r.json();
    if (!r.ok) throw new Error(json.error || 'Token-Erneuerung fehlgeschlagen');
    c = { ...c, ...json, refresh_token: json.refresh_token || c.refresh_token };
    update((d) => ({ ...d, connections: { ...d.connections, [provider]: c } }));
  }
  return c.access_token;
}

async function call(provider, path, { binary = false, file = null } = {}) {
  const q = file ? `op=file&url=${encodeURIComponent(file)}` : `op=get&path=${encodeURIComponent(path)}`;
  const r = await fetch(`/api/connect?provider=${provider}&${q}`, { headers: { 'x-provider-token': await token(provider) } });
  if (r.status === 401 || r.status === 403) throw new Error(`${PROVIDERS[provider].label}: Zugang abgelaufen, bitte neu verbinden`);
  if (r.status === 204 || r.status === 404) return null;
  if (!r.ok) throw new Error(`${PROVIDERS[provider].label}: Fehler ${r.status}`);
  return binary ? new Uint8Array(await r.arrayBuffer()) : r.json();
}

// Neue Einheit speichern, wenn sie noch nicht existiert. Gibt true zurück, wenn neu.
async function store(raw) {
  const d = getData();
  if (findDuplicate(d.activities, { ...raw, durationS: raw.elapsedS })) return false;
  const { activity, series } = buildActivity(raw, d.settings);
  if (series) await putSeries(activity.id, series);
  update((x) => ({ ...x, activities: [...x.activities, activity] }));
  return true;
}

const isoDuration = (s) => { const m = /PT(?:(\d+)H)?(?:(\d+)M)?(?:([\d.]+)S)?/.exec(s || ''); return m ? (+m[1] || 0) * 3600 + (+m[2] || 0) * 60 + (+m[3] || 0) : 0; };

async function syncPolar() {
  const list = (await call('polar', '/v3/exercises')) || [];
  let added = 0;
  const known = new Set(getData().activities.filter((a) => a.source === 'polar').map((a) => a.externalId));
  for (const ex of list) {
    if (known.has(String(ex.id))) continue;
    let raw = null;
    try {
      const fit = await call('polar', `/v3/exercises/${ex.id}/fit`, { binary: true });
      if (fit?.length) raw = await parseFit(fit);
    } catch { /* ohne FIT: Zusammenfassung verwenden */ }
    if (!raw) {
      const offset = ex['start-time-utc-offset'] || 0; // Minuten
      const start = new Date(Date.parse(ex['start-time'] + 'Z') - offset * 60000).toISOString();
      raw = { start, sport: polarSport(ex['detailed-sport-info'] || ex.sport), elapsedS: isoDuration(ex.duration), distanceM: ex.distance, avgHr: ex['heart-rate']?.average, maxHr: ex['heart-rate']?.maximum, calories: ex.calories };
    }
    if (await store({ ...raw, source: 'polar', externalId: String(ex.id) })) added++;
  }
  await syncPolarWellness();
  return added;
}

const polarSport = (s) => {
  s = String(s || '').toUpperCase();
  if (s.includes('SKATING') && s.includes('ROLLER')) return 'rollerski_skate';
  if (s.includes('ROLLER')) return 'rollerski_classic';
  if (s.includes('SKATING')) return 'xc_skate';
  if (s.includes('CROSS_COUNTRY') || s.includes('SKIING')) return 'xc_classic';
  if (s.includes('RUN')) return 'run';
  if (s.includes('CYCL') || s.includes('BIK')) return 'bike';
  if (s.includes('ROW')) return 'row';
  if (s.includes('STRENGTH')) return 'strength';
  if (s.includes('HIK') || s.includes('WALK')) return 'hike';
  return 'other';
};

// Nightly Recharge (HRV, Ruhepuls) und Schlaf → wellness je Datum.
async function syncPolarWellness() {
  const [nr, sl] = await Promise.all([
    call('polar', '/v3/users/nightly-recharge').catch(() => null),
    call('polar', '/v3/users/sleep').catch(() => null),
  ]);
  const byDate = {};
  for (const r of nr?.recharges || []) byDate[r.date] = { ...byDate[r.date], hrv: r.heart_rate_variability_avg, restHr: r.heart_rate_avg, recharge: r.nightly_recharge_status, ansCharge: r.ans_charge };
  for (const n of sl?.nights || []) {
    const secs = (n.light_sleep || 0) + (n.deep_sleep || 0) + (n.rem_sleep || 0);
    byDate[n.date] = { ...byDate[n.date], sleepScore: n.sleep_score, sleepH: secs ? Math.round(secs / 360) / 10 : null };
  }
  if (!Object.keys(byDate).length) return;
  update((d) => {
    const map = Object.fromEntries(d.wellness.map((w) => [w.date, w]));
    for (const [date, v] of Object.entries(byDate)) map[date] = { ...map[date], ...v, date, source: 'polar' };
    return { ...d, wellness: Object.values(map).sort((a, b) => a.date.localeCompare(b.date)) };
  });
}

// Concept2: Watt aus Pace (Zehntelsekunden pro 500 m, BikeErg pro 1000 m): P = 2,80 / (s/m)³
export const c2Watts = (paceTenths, type) => {
  if (!paceTenths) return null;
  const perM = paceTenths / 10 / (type === 'bike' ? 1000 : 500);
  return Math.round(2.8 / perM ** 3);
};

async function syncConcept2() {
  const from = new Date(Date.now() - 90 * 864e5).toISOString().slice(0, 10);
  const res = await call('concept2', `/api/users/me/results?from=${from}&number=250`);
  let added = 0;
  const known = new Set(getData().activities.filter((a) => a.source === 'concept2').map((a) => a.externalId));
  for (const r of res?.data || []) {
    if (known.has(String(r.id))) continue;
    const start = new Date((r.date_utc || r.date).replace(' ', 'T') + (r.date_utc ? 'Z' : '')).toISOString();
    let series = null;
    if (r.stroke_data) {
      const st = await call('concept2', `/api/users/me/results/${r.id}/strokes`).catch(() => null);
      const pts = (st?.data || []).map((s) => ({ t: Date.parse(start) + s.t * 100, hr: s.hr || null, power: c2Watts(s.p, r.type) }));
      if (pts.length) series = toSeries(pts);
    }
    const raw = {
      source: 'concept2', externalId: String(r.id), start, sport: sportFromConcept2(r.type), elapsedS: r.time / 10, distanceM: r.distance,
      avgHr: r.heart_rate?.average || null, maxHr: r.heart_rate?.max || null, calories: r.calories_total || null,
      avgPower: r.time && r.distance ? c2Watts((r.time / r.distance) * (r.type === 'bike' ? 1000 : 500), r.type) : null,
      title: r.workout_type && r.workout_type !== 'JustRow' ? r.workout_type : '', notes: r.comments || '', series,
    };
    if (await store(raw)) added++;
  }
  return added;
}

async function syncWahoo() {
  const res = await call('wahoo', '/v1/workouts?page=1&per_page=50');
  let added = 0;
  const known = new Set(getData().activities.filter((a) => a.source === 'wahoo').map((a) => a.externalId));
  for (const w of res?.workouts || []) {
    if (known.has(String(w.id))) continue;
    const s = w.workout_summary || {};
    let raw = null;
    if (s.file?.url) {
      try { raw = await parseFit(await call('wahoo', null, { binary: true, file: s.file.url })); } catch { /* Zusammenfassung */ }
    }
    raw ||= { start: w.starts, sport: 'other', elapsedS: Number(s.duration_active_accum) || (w.minutes || 0) * 60, distanceM: Number(s.distance_accum) || null, avgHr: Number(s.heart_rate_avg) || null, avgPower: Number(s.power_avg) || null, calories: Number(s.calories_accum) || null };
    if (await store({ ...raw, source: 'wahoo', externalId: String(w.id), title: w.name || '' })) added++;
  }
  return added;
}

const SYNC = { polar: syncPolar, concept2: syncConcept2, wahoo: syncWahoo };

export async function syncAll() {
  const out = {};
  for (const p of Object.keys(getData().connections)) {
    try { out[p] = { added: await SYNC[p]() }; } catch (e) { out[p] = { error: e.message }; }
  }
  update((d) => ({ ...d, settings: { ...d.settings, lastSync: new Date().toISOString() } }));
  return out;
}

// FIT-Dateien von Hand (z. B. Polar-Flow-Export für ältere Daten).
export async function importFiles(files) {
  let added = 0, dup = 0, failed = 0;
  for (const f of files) {
    try {
      const raw = await parseFit(new Uint8Array(await f.arrayBuffer()));
      if (await store({ ...raw, source: 'upload' })) added++; else dup++;
    } catch { failed++; }
  }
  return { added, dup, failed };
}

export { localDate };
