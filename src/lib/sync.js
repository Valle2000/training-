// Abgleich mit Polar, Concept2 (ErgData/Logbook) und Wahoo über /api/connect.
import { getData, update, putSeries, deleteSeries, uid, getLocalSeries } from './store.js';
import { toSeries } from './series.js';
import { buildActivity, findDuplicate, localDate, estimatePlanLoad, renameTitle } from './activities.js';
import { sportFromConcept2, polarSport, polarSportId } from './sports.js';
import { readExport, zipEntries, zipEntriesSync, importable, parseStravaCsv, stravaSport } from './importers.js';
import { recomputeAll } from './recompute.js';
import { deleteRemoteSeries, forgetSeriesPushed } from './cloud-sync.js';
import { lapsFromConcept2, lapsFromSeries, pacePer, concept2Title, isAutoC2Title } from './laps.js';

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
  if (r.status === 429) throw Object.assign(new Error(`${PROVIDERS[provider].label}: zu viele Anfragen – in ein paar Minuten nochmal versuchen, schon geladene Einheiten werden übersprungen`), { rate: true });
  if (!r.ok) throw new Error(`${PROVIDERS[provider].label}: Fehler ${r.status}`);
  return binary ? new Uint8Array(await r.arrayBuffer()) : r.json();
}

// Neue Einheit speichern, wenn sie noch nicht existiert. Gibt true zurück, wenn neu.
async function store(raw) {
  const d = getData();
  // Selbst zugeordnete Polar-Sportnummern (Einstellungen) haben Vorrang.
  const mapped = raw.polarSportId != null && d.settings.polarSportMap?.[raw.polarSportId];
  if (mapped) raw.sport = mapped;
  if (findDuplicate(d.activities, { ...raw, durationS: raw.elapsedS })) return false;
  const { activity, series } = buildActivity(raw, d.settings);
  if (raw.polarSportId != null) activity.polarSportId = String(raw.polarSportId);
  if (series) await putSeries(activity.id, series);
  update((x) => ({ ...x, activities: [...x.activities, activity] }));
  return true;
}

const isoDuration = (s) => { const m = /PT(?:(\d+)H)?(?:(\d+)M)?(?:([\d.]+)S)?/.exec(s || ''); return m ? (+m[1] || 0) * 3600 + (+m[2] || 0) * 60 + (+m[3] || 0) : 0; };

// Nur die Sportart einer bestehenden Einheit ändern (Dauer, Notizen und Daten bleiben).
const setSport = (id, sport) => update((x) => ({ ...x, activities: x.activities.map((a) => (a.id === id ? { ...a, sport } : a)) }));

// Unbekannte Polar-Sportnummern dieses Abgleichs: die App fragt danach (siehe PolarAsk).
const unknownPolar = new Map();
const unknownListeners = new Set();
export function onUnknownPolar(fn) { unknownListeners.add(fn); return () => unknownListeners.delete(fn); }
function notePolar(pid, sport, { name = null, example = null } = {}) {
  if (pid == null || sport !== 'other' || getData().settings.polarSportMap?.[pid]) return;
  const cur = unknownPolar.get(String(pid)) || { id: String(pid), name, count: 0, example };
  cur.count++;
  unknownPolar.set(String(pid), cur);
}
// Ohne Sportnummer (z. B. FIT-Datei „generic“): nach dem Namen der Einheit fragen.
function notePolarTitle(title, sport) {
  if (!title || sport !== 'other') return;
  const key = `title:${title}`;
  const cur = unknownPolar.get(key) || { id: key, kind: 'title', name: title, count: 0, example: null };
  cur.count++;
  unknownPolar.set(key, cur);
}
const askPolar = (ex, sport) => notePolar(ex.sport?.id, sport, { name: ex.detailed_sport_info ?? ex['detailed-sport-info'] ?? null, example: ex.name ?? null });
// Nach einem Datei-Import: gleiche Abfrage wie beim Abgleich.
function flushPolarAsk() {
  if (!unknownPolar.size) return;
  const items = [...unknownPolar.values()];
  unknownPolar.clear();
  for (const fn of unknownListeners) fn(items);
}

async function syncPolar() {
  const list = (await call('polar', '/v3/exercises')) || [];
  let added = 0;
  const known = new Map(getData().activities.filter((a) => a.source === 'polar').map((a) => [a.externalId, a]));
  for (const ex of list) {
    const old = known.get(String(ex.id));
    if (old) {
      // Bekannte „Sonstiges“-Einheit: mit gespeicherter Zuordnung umstellen, sonst unverändert lassen.
      const mappedSport = ex.sport?.id != null ? getData().settings.polarSportMap?.[ex.sport.id] : null;
      if (mappedSport && old.sport === 'other') setSport(old.id, mappedSport);
      if (old.sport === 'other') askPolar(ex, mappedSport || 'other');
      continue;
    }
    let raw = null;
    // Sportart aus der Zusammenfassung (Bezeichnung, sonst Sportnummer) – gilt auch, wenn die FIT-Datei nur „Sonstiges“ liefert.
    const summarySport = polarSport(ex.detailed_sport_info ?? ex['detailed-sport-info']) !== 'other' ? polarSport(ex.detailed_sport_info ?? ex['detailed-sport-info']) : (polarSportId(ex.sport?.id ?? ex.sport) || 'other');
    try {
      const fit = await call('polar', `/v3/exercises/${ex.id}/fit`, { binary: true });
      if (fit?.length) raw = await parseFit(fit);
    } catch { /* ohne FIT: Zusammenfassung verwenden */ }
    if (raw && raw.sport === 'other' && summarySport !== 'other') raw.sport = summarySport;
    if (old) {
      const mappedSport = ex.sport?.id != null ? getData().settings.polarSportMap?.[ex.sport.id] : null;
      const sportNow = mappedSport || raw?.sport;
      if (sportNow && sportNow !== 'other') setSport(old.id, sportNow);
      continue;
    }
    if (!raw) {
      // Die Schnittstelle liefert Feldnamen mit Unterstrich (start_time), ältere Exporte mit Bindestrich – beides lesen.
      const f = (k) => ex[k.replace(/-/g, '_')] ?? ex[k];
      const offset = f('start-time-utc-offset') || 0; // Minuten
      const start = new Date(Date.parse(f('start-time') + 'Z') - offset * 60000).toISOString();
      // Sportart: Bezeichnung zuerst, dann Sportnummer; sonst „Sonstiges“.
      const sport = polarSport(f('detailed-sport-info')) !== 'other' ? polarSport(f('detailed-sport-info')) : (polarSportId(ex.sport?.id ?? ex.sport) || polarSport(typeof ex.sport === 'string' ? ex.sport : ''));
      const hr = f('heart-rate') || {};
      raw = { start, sport, elapsedS: isoDuration(f('duration')), distanceM: f('distance'), avgHr: hr.average, maxHr: hr.maximum, calories: f('calories') };
    }
    askPolar(ex, raw.sport);
    if (await store({ ...raw, source: 'polar', externalId: String(ex.id), polarSportId: ex.sport?.id ?? null })) added++;
  }
  flushPolarAsk();
  await syncPolarWellness();
  return added;
}

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
// Unrealistische Werte (fast leerer Pace beim Anrudern o. Ä.) werden verworfen, sonst entstehen Milliarden Watt.
export const c2Watts = (paceTenths, type) => {
  if (!paceTenths) return null;
  const perM = paceTenths / 10 / (type === 'bike' ? 1000 : 500);
  const w = Math.round(2.8 / perM ** 3);
  return w >= 20 && w <= 2000 ? w : null;
};

// Standard: letzte 90 Tage; all = komplette Historie (Seite für Seite, meta.pagination.total_pages).
async function syncConcept2({ all = false, onProgress } = {}) {
  const from = all ? null : new Date(Date.now() - 90 * 864e5).toISOString().slice(0, 10);
  let added = 0, page = 1, pages = 1;
  const known = new Set(getData().activities.filter((a) => a.source === 'concept2').map((a) => a.externalId));
  do {
    const res = await call('concept2', `/api/users/me/results?${from ? `from=${from}&` : ''}number=100&page=${page}`);
    pages = res?.meta?.pagination?.total_pages || 1;
    for (const r of res?.data || []) {
      if (known.has(String(r.id))) continue;
      if (await store(await concept2Raw(r))) added++;
    }
    onProgress?.(`Concept2: Seite ${page} von ${pages}, ${added} neu`);
    page++;
  } while (page <= pages);
  return added;
}

// Eine Concept2-Einheit mit Intervallen/Splits und Schlagdaten in Rohdaten umwandeln.
// Bei Intervall-Einheiten beginnt die Zeit der Schlagdaten in jedem Intervall neu: Die Zeitachse wird
// deshalb fortgeschrieben (plus Pause), damit nicht nur das erste Intervall zählt.
export function concept2Points(strokes, startMs, laps, type) {
  const pts = [];
  let offset = 0, prevT = -1, lap = 0;
  for (const x of strokes) {
    if (x.t < prevT) { offset += prevT + ((laps[lap]?.restS || 0) * 10); lap++; }
    prevT = x.t;
    pts.push({ t: startMs + (offset + x.t) * 100, hr: x.hr || null, power: c2Watts(x.p, type), lap });
  }
  return pts;
}

async function concept2Raw(r) {
  const start = new Date((r.date_utc || r.date).replace(' ', 'T') + (r.date_utc ? 'Z' : '')).toISOString();
  let workout = r.workout;
  if (!workout && r.workout_type && r.workout_type !== 'JustRow') {
    const detail = (await call('concept2', `/api/users/me/results/${r.id}`).catch(() => null))?.data;
    workout = detail?.workout;
    if (detail) r = { ...detail, ...r };
  }
  let laps = lapsFromConcept2(workout, r.type, c2Watts);
  let series = null;
  if (r.stroke_data) {
    const st = await call('concept2', `/api/users/me/results/${r.id}/strokes`).catch(() => null);
    const pts = concept2Points(st?.data || [], Date.parse(start), laps, r.type);
    if (pts.length) {
      series = toSeries(pts, 30);
      // Ohne Intervall-Angaben: Runden aus den Neustarts der Schlagzeit ableiten.
      if (!laps.length && pts.at(-1).lap > 0) {
        const bounds = [];
        for (let i = 0; i <= pts.at(-1).lap; i++) { const p = pts.filter((x) => x.lap === i); bounds.push({ startS: (p[0].t - pts[0].t) / 1000, durationS: (p.at(-1).t - p[0].t) / 1000 }); }
        laps = lapsFromSeries(series, bounds);
      }
    }
  }
  const restS = (Number(r.rest_time) || 0) / 10 || laps.reduce((a, l) => a + (l.restS || 0), 0);
  return {
    source: 'concept2', externalId: String(r.id), start, sport: sportFromConcept2(r.type), elapsedS: r.time / 10 + restS, workS: r.time / 10, distanceM: r.distance,
    avgHr: r.heart_rate?.average || null, maxHr: r.heart_rate?.max || null, calories: r.calories_total || null,
    avgPower: r.time && r.distance ? c2Watts((r.time / r.distance) * (r.type === 'bike' ? 1000 : 500), r.type) : null,
    pace: pacePer(r.time / 10, r.distance, r.type === 'bike' ? 1000 : 500), spm: r.stroke_rate || null,
    title: concept2Title(r, workout), notes: r.comments || '', series, laps: laps.length ? laps : null,
  };
}

// Alle Concept2-Einheiten neu laden (z. B. nach Korrekturen an der Auswertung). Eigene Notizen/RPE/Laktat bleiben.
// Sicher: Alte Einheiten werden erst ersetzt, wenn die neuen vollständig geladen sind. Bricht das Laden ab,
// bleibt alles wie vorher (früher wurde zuerst gelöscht – bei einem Fehler waren die Einheiten dann weg).
export async function reloadConcept2(onProgress) {
  const old = getData().activities.filter((a) => a.source === 'concept2');
  // Titel nur behalten, wenn er selbst vergeben wurde (nicht der alte automatische wie „VariableInterval“).
  const keep = Object.fromEntries(old.map((a) => [a.externalId, { notes: a.notes, rpe: a.rpe, lactate: a.lactate, title: isAutoC2Title(a.title) ? null : a.title, keySessionId: a.keySessionId, gearIds: a.gearIds }]));
  const fresh = [];
  let page = 1, pages = 1;
  do {
    const res = await call('concept2', `/api/users/me/results?number=100&page=${page}`);
    pages = res?.meta?.pagination?.total_pages || 1;
    for (const r of res?.data || []) {
      const { activity, series } = buildActivity(await concept2Raw(r), getData().settings);
      const k = keep[activity.externalId];
      if (k) Object.assign(activity, Object.fromEntries(Object.entries(k).filter(([, v]) => v != null && v !== '')));
      fresh.push({ activity, series });
      onProgress?.(`Concept2: ${fresh.length} Einheiten geladen (Seite ${page} von ${pages})`);
    }
    page++;
  } while (page <= pages);
  if (!fresh.length && old.length) throw new Error('Concept2 hat keine Einheiten geliefert – nichts geändert.');
  // Alte IDs weiterverwenden, damit andere Geräte die Einheit ersetzen statt doppelt anlegen.
  const oldId = Object.fromEntries(old.map((a) => [a.externalId, a.id]));
  for (const f of fresh) { if (oldId[f.activity.externalId]) f.activity.id = oldId[f.activity.externalId]; if (f.series) await putSeries(f.activity.id, f.series); }
  // Neue Verläufe beim nächsten Online-Abgleich erneut hochladen.
  forgetSeriesPushed(fresh.map((f) => f.activity.id));
  const freshIds = new Set(fresh.map((f) => f.activity.externalId));
  update((d) => ({ ...d, activities: [...d.activities.filter((a) => a.source !== 'concept2' || !freshIds.has(a.externalId)), ...fresh.map((f) => f.activity)] }));
  return fresh.length;
}

// Standard: letzte 50 Einheiten; all = alle Seiten, bis eine Seite leer bzw. nicht voll ist.
// Wahoo-Einheit, die schon von der Polar-Uhr (o. Ä.) ohne Watt vorliegt: durch die Wahoo-Fassung mit Watt ersetzen,
// Puls aus der vorhandenen Aufzeichnung übernehmen, falls Wahoo keinen hat; Notizen, RPE und Laktat bleiben.
export async function mergeIntoExisting(raw, old) {
  const d = getData();
  if (!raw.series?.power?.some((p) => p > 0) || old.avgPower || old.powerCurve || old.source === 'concept2') return false;
  if (!raw.series.hr?.some((h) => h > 0)) {
    const old5 = await getLocalSeries(old.id);
    if (old5?.hr?.some((h) => h > 0)) {
      const offset = Math.round((Date.parse(old.start) - Date.parse(raw.start)) / 1000);
      raw = { ...raw, series: { ...raw.series, hr: raw.series.power.map((_, i) => old5.hr[Math.floor((i - offset) / 5)] ?? null) } };
    }
    raw = { ...raw, avgHr: raw.avgHr ?? old.avgHr, maxHr: raw.maxHr ?? old.maxHr };
  }
  const { activity, series } = buildActivity(raw, d.settings, { id: old.id });
  for (const k of ['notes', 'rpe', 'lactate', 'keySessionId', 'gearIds']) if (old[k] != null && old[k] !== '') activity[k] = old[k];
  if (!activity.title && old.title) activity.title = old.title;
  if (series) await putSeries(old.id, series);
  await deleteRemoteSeries([old.id]).catch(() => {}); // Verlauf wird neu hochgeladen
  update((x) => ({ ...x, activities: x.activities.map((a) => (a.id === old.id ? activity : a)) }));
  return true;
}

async function syncWahoo({ all = false, onProgress } = {}) {
  let added = 0, merged = 0;
  const known = new Set(getData().activities.filter((a) => a.source === 'wahoo').map((a) => a.externalId));
  const list = [];
  for (let page = 1; page <= (all ? 400 : 1); page++) {
    const res = await call('wahoo', `/v1/workouts?page=${page}&per_page=50`);
    const ws = res?.workouts || [];
    list.push(...ws);
    onProgress?.(`Wahoo: ${list.length} Einheiten gefunden`);
    if (ws.length < 50) break;
  }
  const todo = list.filter((w) => !known.has(String(w.id)));
  try {
    for (const w of todo) {
      const s = w.workout_summary || {};
      let raw = null;
      if (s.file?.url) {
        try { raw = await parseFit(await call('wahoo', null, { binary: true, file: s.file.url })); } catch (e) { if (e.rate) throw e; }
      }
      raw ||= { start: w.starts, sport: 'other', elapsedS: Number(s.duration_active_accum) || (w.minutes || 0) * 60, distanceM: Number(s.distance_accum) || null, avgHr: Number(s.heart_rate_avg) || null, avgPower: Number(s.power_avg) || null, calories: Number(s.calories_accum) || null };
      raw = { ...raw, source: 'wahoo', externalId: String(w.id), title: w.name || raw.title || '' };
      const old = findDuplicate(getData().activities, { ...raw, durationS: raw.elapsedS });
      if (old) { if (await mergeIntoExisting(raw, old)) merged++; }
      else if (await store(raw)) added++;
      onProgress?.(`Wahoo: ${added + merged} von ${todo.length} verarbeitet (${added} neu${merged ? `, ${merged} mit Watt ergänzt` : ''})`);
    }
  } catch (e) {
    if (e.rate) throw new Error(`${added} neu, ${merged} ergänzt. ${e.message}`);
    throw e;
  }
  return added + merged;
}

const SYNC = { polar: syncPolar, concept2: syncConcept2, wahoo: syncWahoo };

// Verbindungstest: ruft die Listen-Endpunkte ab und zeigt Status, Anzahl und Feldnamen (zur Fehlersuche).
const TEST_PATHS = {
  polar: ['/v3/exercises', '/v3/users/nightly-recharge', '/v3/users/sleep'],
  concept2: ['/api/users/me', '/api/users/me/results?number=5'],
  wahoo: ['/v1/user', '/v1/workouts?page=1&per_page=5'],
};
export async function testConnection(provider) {
  const lines = [];
  for (const path of TEST_PATHS[provider]) {
    try {
      const r = await fetch(`/api/connect?provider=${provider}&op=get&path=${encodeURIComponent(path)}`, { headers: { 'x-provider-token': await token(provider) } });
      const text = await r.text();
      let info = '';
      try {
        const j = JSON.parse(text);
        const list = Array.isArray(j) ? j : j.data || j.workouts || j.recharges || j.nights || null;
        const first = Array.isArray(list) ? list[0] : j;
        info = `${Array.isArray(list) ? list.length + ' Einträge, ' : ''}Felder: ${first ? Object.keys(first).slice(0, 40).join(', ') : '–'}`;
      } catch { info = text.slice(0, 160) || '(leer)'; }
      lines.push(`${r.status} ${path} → ${info}`);
    } catch (e) { lines.push(`Fehler ${path}: ${e.message}`); }
  }
  if (provider === 'concept2') {
    // Aufbau einer Einheit mit Intervallen zeigen, damit Feldnamen geprüft werden können.
    try {
      const list = await call('concept2', '/api/users/me/results?number=20');
      const r = (list?.data || []).find((x) => x.workout_type && x.workout_type !== 'JustRow') || list?.data?.[0];
      if (r) {
        const d = (await call('concept2', `/api/users/me/results/${r.id}`))?.data || {};
        const iv = d.workout?.intervals?.[0] || d.workout?.splits?.[0];
        lines.push(`Detail ${r.workout_type}: Felder: ${Object.keys(d).join(', ')}`);
        lines.push(`workout: ${d.workout ? Object.keys(d.workout).join(', ') : '–'}; Intervall/Split: ${iv ? JSON.stringify(iv).slice(0, 220) : '–'}`);
        if (r.stroke_data) { const st = await call('concept2', `/api/users/me/results/${r.id}/strokes`); const ts = (st?.data || []).map((x) => x.t); lines.push(`Schläge: ${ts.length}, Zeit-Neustarts: ${ts.filter((t, i) => i && t < ts[i - 1]).length}, Beispiel: ${JSON.stringify(st?.data?.[0] || {})}`); }
      }
    } catch (e) { lines.push(`Detail-Fehler: ${e.message}`); }
  }
  return lines;
}

export async function syncAll() {
  const out = {};
  for (const p of Object.keys(getData().connections)) {
    try { out[p] = { added: await SYNC[p]() }; } catch (e) { out[p] = { error: e.message }; }
  }
  update((d) => ({ ...d, settings: { ...d.settings, lastSync: new Date().toISOString() } }));
  return out;
}

// Komplette Historie eines verbundenen Anbieters (Concept2, Wahoo). Polar liefert nur Daten ab der Verbindung.
export async function syncHistory(provider, onProgress) {
  if (provider === 'concept2') return syncConcept2({ all: true, onProgress });
  if (provider === 'wahoo') return syncWahoo({ all: true, onProgress });
  return syncPolar();
}

// Dateien von Hand: FIT, TCX, GPX, Polar-CSV, Polar-Konto-Export (JSON) und ZIP-Archive mit solchen Dateien.
// Auch für sehr große Exporte (tausende Einheiten): ZIPs werden Datei für Datei gelesen, gespeichert wird in Paketen.
export async function importFiles(files, onProgress) {
  let added = 0, dup = 0, failed = 0, done = 0, refreshed = 0, planned = 0;
  const errors = [], pending = [];
  const fail = (name, e) => { failed++; if (errors.length < 3) errors.push(`${name.split('/').pop()}: ${e?.message || e}`); };
  const flush = () => { if (!pending.length) return; const batch = pending.splice(0); update((x) => ({ ...x, activities: [...x.activities, ...batch] })); };
  const add = async (raw) => {
    const d = getData(), cand = { ...raw, durationS: raw.series?.hr?.length || raw.series?.power?.length || raw.elapsedS, elapsedS: raw.elapsedS };
    // Selbst zugeordnete Polar-Sportnummern (Einstellungen) haben Vorrang.
    const mapped = raw.polarSportId != null && d.settings.polarSportMap?.[raw.polarSportId];
    const byTitle = !raw.polarSportId && raw.title ? d.settings.sportByTitle?.[raw.title] : null;
    if (mapped) raw.sport = mapped;
    else if (byTitle) raw.sport = byTitle;
    else if (raw.polarSportId != null) notePolar(raw.polarSportId, raw.sport, { name: raw.polarSportName ?? null, example: raw.title || null });
    else notePolarTitle(raw.title, raw.sport);
    // Geplante Polar-Einheiten gehören in den Kalender (Soll), nicht zu den absolvierten Einheiten.
    if (raw.planned) {
      const date = localDate(raw.start, d.settings.timezone), minutes = Math.round((raw.elapsedS || 0) / 60);
      if (d.plan.some((p) => p.date === date && p.title === raw.title && p.source === 'polar')) return false;
      const item = { id: uid(), date, sport: raw.sport, title: raw.title || '', description: raw.notes || '', minutes, zone: 'I1', load: estimatePlanLoad(minutes, 'I1'), source: 'polar', done: false };
      update((x) => ({ ...x, plan: [...x.plan, item] }));
      planned++;
      return false;
    }
    if (findDuplicate(pending, cand)) return false;
    const old = findDuplicate(d.activities, cand);
    // Gleiche Einheit schon da (z. B. von der Polar-Uhr), aber ohne Watt – die neue Datei hat Watt (Wahoo/Strava): zusammenführen.
    if (old && raw.series?.power?.some((p) => p > 0) && !old.avgPower && !old.powerCurve && old.source !== 'concept2') {
      if (await mergeIntoExisting({ ...raw, source: old.source === 'polar' ? 'polar' : 'upload' }, old)) { refreshed++; return false; }
    }
    if (old) {
      if (old.sport === 'other' && raw.sport && raw.sport !== 'other') {
        setSport(old.id, raw.sport);
        if (old.source !== 'upload') { refreshed++; return false; }
      }
      // Schon importiert, aber mit weniger Daten (z. B. früherer Import ohne Puls)? Dann mit den neuen Daten auffrischen.
      const needs = !(old.hasSeries && old.avgHr) || (raw.timerS && old.timerS == null && Math.abs((old.durationS || 0) - raw.timerS) > 60)
        || (raw.laps?.length && !old.laps?.length) || (raw.deviceAutoLaps?.length && !old.deviceAutoLaps?.length);
      if (old.source !== 'upload' || !needs || !(raw.series?.hr?.length || raw.avgHr || raw.timerS)) return false;
      const { activity, series } = buildActivity({ ...raw, source: 'upload' }, d.settings, { id: old.id });
      activity.importFormat = raw.importFormat;
      for (const k of ['notes', 'rpe', 'lactate', 'title', 'keySessionId', 'gearIds']) if (old[k] != null && old[k] !== '') activity[k] = old[k];
      if (series) await putSeries(old.id, series);
      update((x) => ({ ...x, activities: x.activities.map((a) => (a.id === old.id ? activity : a)) }));
      refreshed++;
      return false;
    }
    const { activity, series } = buildActivity({ ...raw, source: 'upload' }, d.settings);
    activity.importFormat = raw.importFormat;
    activity.importFile = raw.importFile;
    if (raw.polarSportId != null) activity.polarSportId = String(raw.polarSportId);
    if (series) await putSeries(activity.id, series);
    pending.push(activity);
    if (pending.length >= 25) flush();
    return true;
  };
  // Leere Einstellungen (Maximalpuls, Ruhepuls, Schwelle, FTP, Gewicht) aus dem neuesten Polar-Profil übernehmen –
  // sofort, damit schon beim Import die Belastung berechnet wird.
  let profile = null;
  const filled = new Set();
  const applyProfile = () => {
    const st = getData().settings, next = {};
    for (const k of ['hrMax', 'hrRest', 'lthr', 'ftp', 'weightKg', 'sex']) {
      if (!profile[k] || !(st[k] == null || st[k] === '' || filled.has(k)) || String(st[k]) === String(profile[k])) continue;
      next[k] = String(profile[k]); filled.add(k);
    }
    if (!Object.keys(next).length) return;
    update((x) => ({ ...x, settings: { ...x.settings, ...next } }));
  };
  let strava = null; // Name/Sportart je Datei aus activities.csv (Strava-Export)
  const handle = async (name, bytes) => {
    if (/(^|\/)activities\.csv$/i.test(name)) { strava = parseStravaCsv(new TextDecoder().decode(bytes)) || strava; return; }
    let raws = [];
    try { raws = await readExport(name, bytes, parseFit); } catch (e) { fail(name, e); }
    const ext = name.toLowerCase().replace(/\.gz$/, '').split('.').pop();
    for (const raw of raws) {
      // Polar-Einheiten ohne Uhr und ohne Messwerte (geplant oder von Hand eingetragen) getrennt führen.
      raw.importFormat = ['json', 'csv'].includes(ext) ? (raw.recorded === false ? 'polar-plan' : 'polar') : ext;
      raw.importFile = name.split('/').pop();
      if (raw.athlete && (!profile || raw.athlete.date > profile.date)) { profile = raw.athlete; applyProfile(); }
      try { const r0 = refreshed, p0 = planned; if (await add(raw)) added++; else if (refreshed === r0 && planned === p0) dup++; } catch (e) { fail(name, e); }
      if (++done % 10 === 0) onProgress?.(`${done} Einheiten verarbeitet · ${added} neu · ${dup} schon vorhanden${failed ? ` · ${failed} nicht lesbar` : ''}`);
    }
    await new Promise((r) => setTimeout(r, 0)); // Anzeige aktualisieren lassen
  };
  // Bildschirm anlassen, damit das Handy beim langen Import nicht einschläft.
  const lock = await globalThis.navigator?.wakeLock?.request('screen').catch(() => null);
  try {
    const list = files.length > 1 ? files.filter((f) => importable(f.webkitRelativePath || f.name)) : files; // Ordner: nur Trainingsdateien
    for (const f of list) {
      if (!f.name.toLowerCase().endsWith('.zip')) { await handle(f.name, new Uint8Array(await f.arrayBuffer())); continue; }
      onProgress?.(`Öffne ${f.name} (${Math.round(f.size / 1e6)} MB) …`);
      let seen = 0;
      try {
        for await (const e of zipEntries(f)) { seen++; await handle(e.name, e.bytes); }
      } catch (err) {
        if (seen) fail(f.name, err);
        else for await (const e of zipEntriesSync(new Uint8Array(await f.arrayBuffer()))) await handle(e.name, e.bytes);
      }
      flush();
    }
  } finally {
    flush();
    lock?.release?.().catch(() => {});
  }
  // Strava: Namen und Sportarten aus activities.csv übernehmen (die Datei kann im Archiv vor oder nach den Einheiten liegen).
  let sportChanged = false;
  let durationChanged = false;
  if (strava) {
    update((x) => ({ ...x, activities: x.activities.map((a) => {
      const s = a.source === 'upload' && a.importFile && strava[a.importFile];
      if (!s) return a;
      const sport = stravaSport(s.type, s.name); // die in Strava gewählte Sportart ist meist genauer als die Gerätedatei
      if (sport !== 'other' && sport !== a.sport) sportChanged = true;
      // Dauer wie in Strava: Bewegungszeit als Zeit auf der Uhr, Gesamtzeit als Elapsed.
      const timerChanged = !!s.movingS && s.movingS !== a.timerS;
      if (timerChanged) durationChanged = true;
      return { ...a, title: a.title && !/^(morning|afternoon|evening|lunch|night)\b/i.test(a.title) ? a.title : renameTitle(s.name, x.settings), notes: a.notes || s.notes, sport: sport === 'other' ? a.sport : sport, ...(s.movingS ? { timerS: s.movingS } : {}), ...(s.elapsedS ? { elapsedS: s.elapsedS } : {}) };
    }) }));
  }
  // Profilwerte übernommen: alle Einheiten (auch schon vorhandene und übersprungene) einheitlich neu berechnen.
  if (filled.size || sportChanged || durationChanged) { onProgress?.('Berechne Belastung und Zonen neu …'); await recomputeAll(); }
  flushPolarAsk();
  return { added, dup, failed, errors, refreshed, planned, filled: [...filled] };
}

// Mehrere Einheiten löschen (z. B. einen fehlerhaften Import): lokal, und beim nächsten Abgleich auch in Supabase.
export async function deleteActivities(ids) {
  const set = new Set(ids);
  update((d) => ({ ...d, activities: d.activities.filter((a) => !set.has(a.id)) }));
  for (const id of ids) await deleteSeries(id);
  await deleteRemoteSeries(ids).catch(() => {});
  return ids.length;
}

// Sportart nach Name der Einheit festlegen (ohne Sportnummer): gilt für bestehende und künftige Einheiten mit diesem Namen.
export async function mapSportByTitle(title, sport) {
  update((d) => ({
    ...d, settings: { ...d.settings, sportByTitle: { ...(d.settings.sportByTitle || {}), [title]: sport } },
    activities: d.activities.map((a) => (a.title === title && a.sport === 'other' ? { ...a, sport } : a)),
  }));
  return recomputeAll();
}

// Unbekannte Polar-Sportnummer einer Sportart zuordnen: gilt für vorhandene und künftige Importe.
export async function mapPolarSport(id, sport) {
  update((d) => ({
    ...d, settings: { ...d.settings, polarSportMap: { ...(d.settings.polarSportMap || {}), [id]: sport } },
    activities: d.activities.map((a) => (String(a.polarSportId) === String(id) ? { ...a, sport } : a)),
  }));
  return recomputeAll();
}

export { localDate };
