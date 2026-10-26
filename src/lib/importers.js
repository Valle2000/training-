// Import älterer Einheiten aus Exporten: TCX, GPX, Polar-CSV, Polar-Konto-Export (JSON) und ZIP-Archive.
// Alle Leser liefern dieselbe Form wie parseFit: {start, sport, elapsedS, distanceM, avgHr, maxHr, avgPower, calories, series}.
import { toSeries } from './series.js';
import { polarSport } from './sports.js';

const num = (v) => { const n = Number(String(v ?? '').replace(',', '.')); return Number.isFinite(n) ? n : null; };
const tag = (xml, name) => { const m = new RegExp(`<(?:\\w+:)?${name}\\b[^>]*>([\\s\\S]*?)</(?:\\w+:)?${name}>`).exec(xml); return m ? m[1] : null; };
const tags = (xml, name) => xml.match(new RegExp(`<(?:\\w+:)?${name}\\b[^>]*>[\\s\\S]*?</(?:\\w+:)?${name}>`, 'g')) || [];
const attr = (xml, name) => { const m = new RegExp(`${name}="([^"]*)"`).exec(xml); return m ? m[1] : null; };

const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
function summarize(points, extra) {
  if (!points.length && !extra.start) throw new Error('Keine Messpunkte gefunden');
  const hrs = points.map((p) => p.hr).filter((h) => h > 0), pws = points.map((p) => p.power).filter((p) => p != null);
  const start = extra.start || new Date(points[0].t).toISOString();
  return {
    start, sport: extra.sport || 'other',
    elapsedS: extra.elapsedS ?? (points.length ? (points.at(-1).t - points[0].t) / 1000 : 0),
    distanceM: extra.distanceM ?? null, calories: extra.calories ?? null, ascentM: extra.ascentM ?? null,
    avgHr: extra.avgHr ?? avg(hrs), maxHr: extra.maxHr ?? (hrs.length ? Math.max(...hrs) : null),
    avgPower: extra.avgPower ?? (pws.some(Boolean) ? avg(pws) : null),
    title: extra.title || '', notes: extra.notes || '', laps: extra.laps || null,
    series: points.length > 30 ? toSeries(points) : null,
  };
}

const TCX_SPORT = { running: 'run', biking: 'bike' };

export function parseTcx(xml) {
  const act = tag(xml, 'Activity') ?? xml;
  const sport = TCX_SPORT[String(attr(xml, 'Sport') || '').toLowerCase()];
  const laps = tags(act, 'Lap');
  const points = tags(act, 'Trackpoint').map((tp) => ({
    t: Date.parse(tag(tp, 'Time')),
    hr: num(tag(tag(tp, 'HeartRateBpm') || '', 'Value')),
    power: num(tag(tp, 'Watts')),
    speed: num(tag(tp, 'Speed')),
    alt: num(tag(tp, 'AltitudeMeters')),
  })).filter((p) => p.t);
  const sumLaps = (n) => laps.reduce((a, l) => a + (num(tag(l, n)) || 0), 0);
  const notes = tag(act, 'Notes');
  const t0 = laps[0] ? Date.parse(attr(laps[0], 'StartTime')) : points[0]?.t;
  const lapList = laps.length > 1 ? laps.map((l, i) => {
    const dur = num(tag(l, 'TotalTimeSeconds')), dist = num(tag(l, 'DistanceMeters'));
    return { n: i + 1, startS: (Date.parse(attr(l, 'StartTime')) - t0) / 1000, durationS: dur, distanceM: dist, avgHr: num(tag(tag(l, 'AverageHeartRateBpm') || '', 'Value')), maxHr: num(tag(tag(l, 'MaximumHeartRateBpm') || '', 'Value')), avgPower: num(tag(l, 'AvgWatts')), pace: dur && dist ? (dur / dist) * 1000 : null };
  }) : null;
  return summarize(points, { laps: lapList,
    start: laps[0] ? new Date(attr(laps[0], 'StartTime') || points[0]?.t).toISOString() : undefined,
    sport: notes ? polarSport(notes) : sport, title: notes || '',
    elapsedS: laps.length ? sumLaps('TotalTimeSeconds') : undefined,
    distanceM: laps.length ? sumLaps('DistanceMeters') || null : undefined,
    calories: laps.length ? sumLaps('Calories') || null : undefined,
  });
}

export function parseGpx(xml) {
  const type = tag(xml, 'type');
  const points = tags(xml, 'trkpt').map((p) => ({
    t: Date.parse(tag(p, 'time')),
    hr: num(tag(p, 'hr')),
    power: num(tag(p, 'power')),
    alt: num(tag(p, 'ele')),
    lat: num(attr(p, 'lat')), lon: num(attr(p, 'lon')),
  })).filter((p) => p.t);
  // Distanz aus den Koordinaten (Haversine).
  let dist = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i];
    if (a.lat == null || b.lat == null) continue;
    const r = Math.PI / 180, dLat = (b.lat - a.lat) * r, dLon = (b.lon - a.lon) * r;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLon / 2) ** 2;
    dist += 2 * 6371000 * Math.asin(Math.sqrt(h));
  }
  return summarize(points, { sport: type ? polarSport(type) : undefined, distanceM: dist || null, title: tag(xml, 'name') || '' });
}

// Polar-CSV (Einzelexport aus Polar Flow): Zeile 1/2 Zusammenfassung, ab Zeile 3 Messpunkte.
export function parsePolarCsv(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  const split = (l) => l.split(',').map((x) => x.trim());
  const h1 = split(lines[0]), v1 = split(lines[1] || '');
  const get = (re) => { const i = h1.findIndex((h) => re.test(h)); return i >= 0 ? v1[i] : null; };
  const date = get(/^date/i), time = get(/start time/i);
  if (!date || !time) throw new Error('Kein Polar-CSV-Format');
  const [d, m, y] = date.includes('-') ? date.split('-') : date.split('.');
  const startMs = new Date(`${y.length === 4 ? y : d}-${m}-${y.length === 4 ? d : y}T${time}`).getTime();
  const dur = (get(/^duration/i) || '').split(':').map(Number);
  const h3 = split(lines[2] || '');
  const col = (re) => h3.findIndex((h) => re.test(h));
  const ct = col(/^time/i), chr = col(/^hr/i), cpw = col(/power/i), cal = col(/altitude/i), csp = col(/speed/i);
  const points = lines.slice(3).map(split).map((r) => {
    const [hh, mm, ss] = (r[ct] || '').split(':').map(Number);
    return { t: startMs + ((hh || 0) * 3600 + (mm || 0) * 60 + (ss || 0)) * 1000, hr: num(r[chr]), power: cpw >= 0 ? num(r[cpw]) : null, alt: cal >= 0 ? num(r[cal]) : null, speed: csp >= 0 && num(r[csp]) ? num(r[csp]) / 3.6 : null };
  }).filter((p) => Number.isFinite(p.t));
  return summarize(points, {
    start: new Date(startMs).toISOString(), sport: polarSport(get(/^sport/i) || ''), title: get(/^name/i) || '',
    elapsedS: dur.length === 3 ? dur[0] * 3600 + dur[1] * 60 + dur[2] : undefined,
    distanceM: num(get(/total distance/i)) != null ? num(get(/total distance/i)) * 1000 : undefined,
    avgHr: num(get(/average heart rate/i)) || undefined, calories: num(get(/calories/i)) || undefined,
  });
}

const isoDur = (s) => { const m = /PT(?:([\d.]+)H)?(?:([\d.]+)M)?(?:([\d.]+)S)?/.exec(s || ''); return m ? (+m[1] || 0) * 3600 + (+m[2] || 0) * 60 + (+m[3] || 0) : null; };

// Polar-Konto-Export (JSON je Trainingseinheit). Das Format ist nicht offiziell dokumentiert,
// deshalb wird tolerant gelesen: Zeit, Dauer, Sportart, Puls und Messreihen, wo vorhanden.
// Ortszeit ohne Zonenangabe („2019-05-05T10:00:00.000“) plus Versatz in Minuten → UTC.
function polarTime(str, offsetMin) {
  if (/[zZ]|[+-]\d\d:?\d\d$/.test(str) || offsetMin == null) return new Date(str).toISOString();
  const [d, t = '0:0:0'] = str.split('T'), [y, mo, da] = d.split('-').map(Number), [h, mi, se] = t.split(':').map(Number);
  return new Date(Date.UTC(y, mo - 1, da, h || 0, mi || 0, Math.floor(se || 0)) - offsetMin * 60000).toISOString();
}
export function parsePolarJson(obj) {
  const ex = obj.exercises?.[0] || obj;
  const startRaw = ex.startTime || obj.startTime || ex.start || obj.start;
  if (!startRaw) throw new Error('Keine Startzeit im JSON');
  const offset = num(ex.timezoneOffset ?? ex.timeZoneOffset ?? obj.timeZoneOffset ?? obj.timezoneOffset);
  const start = polarTime(startRaw, offset);
  const samples = ex.samples || obj.samples || {};
  const series = (key) => (Array.isArray(samples[key]) ? samples[key] : []).map((s) => ({ t: Date.parse(s.dateTime || s.time), v: num(s.value) })).filter((s) => s.t);
  const byT = new Map();
  for (const s of series('heartRate')) byT.set(s.t, { t: s.t, hr: s.v });
  for (const s of series('power')) byT.set(s.t, { ...(byT.get(s.t) || { t: s.t }), power: s.v });
  for (const s of series('altitude')) byT.set(s.t, { ...(byT.get(s.t) || { t: s.t }), alt: s.v });
  for (const s of series('speed')) byT.set(s.t, { ...(byT.get(s.t) || { t: s.t }), speed: s.v != null ? s.v / 3.6 : null }); // km/h → m/s
  const points = [...byT.values()].sort((a, b) => a.t - b.t);
  const hr = ex.heartRate || obj.heartRate || {};
  return summarize(points, {
    start, sport: polarSport(ex.sport || obj.sport || ''), title: obj.title || obj.name || ex.name || '', notes: obj.note || obj.notes || '',
    elapsedS: isoDur(ex.duration || obj.duration) ?? (ex.stopTime ? (Date.parse(ex.stopTime) - Date.parse(startRaw)) / 1000 : undefined),
    distanceM: num(ex.distance ?? obj.distance) ?? undefined,
    avgHr: num(hr.avg ?? hr.average) ?? undefined, maxHr: num(hr.max ?? hr.maximum) ?? undefined,
    calories: num(ex.kiloCalories ?? obj.kiloCalories ?? ex.calories) ?? undefined,
    ascentM: num(ex.ascent ?? obj.ascent) ?? undefined,
  });
}

// Nur Dateien, die Einheiten enthalten können (Polar-Export: training-session-*.json; Tagesaktivität, Schlaf usw. nicht).
export function importable(name) {
  const n = name.toLowerCase();
  if (n.endsWith('/') || n.includes('__macosx')) return false;
  const base = n.replace(/\.gz$/, '');
  if (base.endsWith('.json')) return /training|session|exercise/.test(n.split('/').pop());
  return /\.(fit|tcx|gpx|csv|zip)$/.test(base);
}

// Große ZIP-Dateien Stück für Stück lesen, ohne alles auf einmal zu entpacken (Polar-Export: Tausende Dateien,
// mehrere hundert MB). Liefert {name, bytes} je passender Datei.
export async function* zipEntries(file) {
  const { Unzip, UnzipInflate } = await import('fflate');
  const ready = [];
  let error = null;
  const uz = new Unzip((entry) => {
    if (!importable(entry.name)) return; // ohne start() werden die Daten übersprungen
    const parts = [];
    entry.ondata = (err, chunk, final) => {
      if (err) { error = err; return; }
      parts.push(chunk);
      if (final) {
        const bytes = new Uint8Array(parts.reduce((a, p) => a + p.length, 0));
        let o = 0;
        for (const p of parts) { bytes.set(p, o); o += p.length; }
        ready.push({ name: entry.name, bytes });
      }
    };
    entry.start();
  });
  uz.register(UnzipInflate);
  const reader = file.stream().getReader();
  for (;;) {
    const { done, value } = await reader.read();
    uz.push(value || new Uint8Array(0), done);
    if (error) throw error;
    while (ready.length) yield ready.shift();
    if (done) return;
  }
}

// Ersatzweg, falls das Archiv sich nicht als Strom lesen lässt: Inhaltsverzeichnis lesen, dann Datei für Datei entpacken.
export async function* zipEntriesSync(bytes) {
  const { unzipSync } = await import('fflate');
  const names = [];
  unzipSync(bytes, { filter: (f) => { if (importable(f.name)) names.push(f.name); return false; } });
  for (const n of names) yield { name: n, bytes: unzipSync(bytes, { filter: (f) => f.name === n })[n] };
}

// Eine Datei (auch ZIP) → Liste von Rohdaten. FIT wird über den übergebenen Leser verarbeitet.
export async function readExport(name, bytes, parseFit) {
  const lower = name.toLowerCase();
  const text = () => new TextDecoder().decode(bytes);
  // Gepackte Einzeldateien (z. B. Strava- oder Garmin-Export: activities/123.fit.gz).
  if (lower.endsWith('.gz')) {
    const { gunzipSync } = await import('fflate');
    return readExport(name.slice(0, -3), gunzipSync(bytes), parseFit);
  }
  if (lower.endsWith('.zip')) {
    const { unzipSync } = await import('fflate');
    const files = unzipSync(bytes);
    const out = [];
    for (const [n, b] of Object.entries(files)) {
      if (n.endsWith('/') || n.includes('__MACOSX')) continue;
      try { out.push(...(await readExport(n, b, parseFit))); } catch { /* unbekannte Datei im Archiv überspringen */ }
    }
    return out;
  }
  if (lower.endsWith('.fit')) return [await parseFit(bytes)];
  if (lower.endsWith('.tcx')) return [parseTcx(text())];
  if (lower.endsWith('.gpx')) return [parseGpx(text())];
  if (lower.endsWith('.csv')) return [parsePolarCsv(text())];
  if (lower.endsWith('.json')) {
    const obj = JSON.parse(text());
    // Nur Trainingseinheiten, keine Tagesaktivität, Schlaf usw.
    if (!/training|session|exercise/i.test(name) && !obj.exercises) return [];
    return [parsePolarJson(obj)];
  }
  return [];
}
