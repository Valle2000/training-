// Import älterer Einheiten aus Exporten: TCX, GPX, Polar-CSV, Polar-Konto-Export (JSON) und ZIP-Archive.
// Alle Leser liefern dieselbe Form wie parseFit: {start, sport, elapsedS, distanceM, avgHr, maxHr, avgPower, calories, series}.
import { toSeries } from './series.js';
import { polarSport, polarSportId } from './sports.js';

// Leere Angaben bleiben leer (nicht 0) – sonst stünde z. B. „Ø Puls 0“ in der Einheit, wenn Polar keine Zusammenfassung mitschickt.
const num = (v) => { if (v == null || String(v).trim() === '') return null; const n = Number(String(v).replace(',', '.')); return Number.isFinite(n) ? n : null; };
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
    title: extra.title || '', notes: extra.notes || '', laps: extra.laps || null, athlete: extra.athlete || null, externalLoad: extra.externalLoad ?? null, recorded: extra.recorded ?? true, planned: !!extra.planned, polarSportId: extra.polarSportId ?? null,
    timerS: extra.timerS ?? null, deviceAutoLaps: extra.autoLaps || null,
    // Lücken bis 30 s auffüllen (Uhren speichern teils nur alle paar Sekunden) – sonst würden sie als Pause zählen.
    series: points.length > 30 ? toSeries(points, 30) : null,
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
    elapsedS: laps.length ? sumLaps('TotalTimeSeconds') : undefined, timerS: laps.length ? sumLaps('TotalTimeSeconds') : undefined,
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
    elapsedS: dur.length === 3 ? dur[0] * 3600 + dur[1] * 60 + dur[2] : undefined, timerS: dur.length === 3 ? dur[0] * 3600 + dur[1] * 60 + dur[2] : undefined,
    distanceM: num(get(/total distance/i)) != null ? num(get(/total distance/i)) * 1000 : undefined,
    avgHr: num(get(/average heart rate/i)) || undefined, calories: num(get(/calories/i)) || undefined,
  });
}

const isoDur = (s) => { const m = /PT(?:([\d.]+)H)?(?:([\d.]+)M)?(?:([\d.]+)S)?/.exec(s || ''); return m ? (+m[1] || 0) * 3600 + (+m[2] || 0) * 60 + (+m[3] || 0) : null; };

// Polar-Konto-Export (JSON je Trainingseinheit). Das Format ist nicht offiziell dokumentiert,
// deshalb wird tolerant gelesen: Zeit, Dauer, Sportart, Puls und Messreihen, wo vorhanden.
// Runden aus dem Polar-Export (Lap-Taste und automatische Runden). Das Format ist nicht offiziell beschrieben,
// deshalb tolerant: Dauer (durationMillis, duration/lapTime als ISO), Zwischenzeit (splitTimeMillis, splitTime),
// Distanz, Puls und Leistung als Felder oder in statistics.
const listOf = (v, key) => (Array.isArray(v) ? v : Array.isArray(v?.[key]) ? v[key] : []);
// Polar speichert Runden wie im Gerät (Protobuf PbLap): header {splitTime, duration, distance, autolapType} und
// statistics {heartRate {average, maximum}, speed {average, maximum} in km/h, cadence, power}. Im Export erscheinen
// Zeiten je nach Version als …Millis, als ISO-Dauer („PT5M“) oder als {hours, minutes, seconds, millis}.
function lapSeconds(h, name) {
  const ms = h[`${name}Millis`] ?? h[`${name}Ms`];
  if (ms != null && num(ms) != null) return num(ms) / 1000;
  const v = h[name];
  if (v == null) return null;
  if (typeof v === 'string') return /^PT/.test(v) ? isoDur(v) : num(v);
  if (typeof v === 'number') return v;
  if (typeof v === 'object') return (num(v.hours) || 0) * 3600 + (num(v.minutes) || 0) * 60 + (num(v.seconds) || 0) + (num(v.millis) || 0) / 1000;
  return null;
}
function polarLapList(list, startMs) {
  let t = 0;
  const laps = list.map((l, i) => {
    const h = l.header || l;
    let dur = lapSeconds(h, 'duration') ?? lapSeconds(h, 'lapTime');
    const split = lapSeconds(h, 'splitTime');
    const startS = h.startTime && startMs ? (Date.parse(h.startTime) - startMs) / 1000 : split != null && dur != null ? split - dur : t;
    if (dur == null && split != null) dur = split - t;
    if (dur == null || dur <= 0) return null;
    t = startS + dur;
    // statistics: Objekt (heartRate, power, speed …) oder Liste [{type: 'STATISTICS_TYPE_…', avg, max}]
    const raw = l.statistics || {};
    const list2 = listOf(raw, 'statistics');
    const st = list2.length ? Object.fromEntries(list2.map((x) => [String(x.type || '').replace('STATISTICS_TYPE_', ''), x])) : {};
    const hr = l.heartRate || raw.heartRate || st.HEART_RATE || {};
    const pw = l.power || raw.power || st.POWER || st.CYCLING_POWER || {};
    const sp = l.speed || raw.speed || st.SPEED || {};
    const cad = l.cadence || raw.cadence || st.CADENCE || {};
    const pick = (o, ...k) => { for (const key of k) { const v = num(o?.[key]); if (v) return v; } return null; };
    let dist = num(h.distanceMeters ?? h.distance ?? h.lapDistance ?? h.lapDistanceMeters ?? l.distance);
    const speedAvg = pick(sp, 'average', 'avg');
    if (!dist && speedAvg) dist = (speedAvg / 3.6) * dur;
    return {
      n: i + 1, startS, durationS: dur, distanceM: dist || null,
      avgHr: pick(hr, 'average', 'avg'), maxHr: pick(hr, 'maximum', 'max'), avgPower: pick(pw, 'average', 'avg'),
      spm: pick(cad, 'average', 'avg'), pace: dist ? (dur / dist) * 1000 : null,
    };
  }).filter(Boolean);
  return laps.length > 1 ? laps : null;
}
function polarLaps(ex, startMs) {
  const manual = polarLapList(listOf(ex.laps, 'laps'), startMs);
  const auto = polarLapList([...listOf(ex.autoLaps, 'autoLaps'), ...listOf(ex.laps?.autoLaps, 'autoLaps'), ...listOf(ex.autolaps, 'autolaps')], startMs);
  return { laps: manual || undefined, autoLaps: auto || undefined };
}

// Ortszeit ohne Zonenangabe („2019-05-05T10:00:00.000“) plus Versatz in Minuten → UTC.
function polarTime(str, offsetMin) {
  if (/[zZ]|[+-]\d\d:?\d\d$/.test(str) || offsetMin == null) return new Date(str).toISOString();
  const [d, t = '0:0:0'] = str.split('T'), [y, mo, da] = d.split('-').map(Number), [h, mi, se] = t.split(':').map(Number);
  return new Date(Date.UTC(y, mo - 1, da, h || 0, mi || 0, Math.floor(se || 0)) - offsetMin * 60000).toISOString();
}
export function parsePolarJson(obj) {
  if (obj.exercises?.[0]?.samples?.samples || obj.durationMillis != null) return parsePolarJsonV2(obj);
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
  // Profil zum Zeitpunkt der Einheit (Polar speichert es mit): für fehlende Einstellungen nach dem Import.
  const p = obj.physicalInformationSnapshot;
  const athlete = p ? { date: p.dateTime || start, hrMax: num(p.maximumHeartRate), hrRest: num(p.restingHeartRate), lthr: num(p.anaerobicThreshold), ftp: num(p.functionalThresholdPower), weightKg: num(p['weight, kg']), sex: p.sex === 'FEMALE' ? 'f' : p.sex === 'MALE' ? 'm' : null } : null;
  return summarize(points, { athlete,
    start, sport: polarSport(ex.sport || obj.sport || ''), title: obj.title || obj.name || ex.name || '', notes: obj.note || obj.notes || '',
    elapsedS: isoDur(ex.duration || obj.duration) ?? (ex.stopTime ? (Date.parse(ex.stopTime) - Date.parse(startRaw)) / 1000 : undefined),
    timerS: isoDur(ex.duration || obj.duration) ?? undefined, ...polarLaps(ex, Date.parse(startRaw)),
    distanceM: num(ex.distance ?? obj.distance) ?? undefined,
    avgHr: num(hr.avg ?? hr.average) ?? undefined, maxHr: num(hr.max ?? hr.maximum) ?? undefined,
    calories: num(ex.kiloCalories ?? obj.kiloCalories ?? ex.calories) ?? undefined,
    ascentM: num(ex.ascent ?? obj.ascent) ?? undefined,
  });
}

// Neueres Polar-Exportformat: Messwerte als Listen je Typ (samples.samples[{type, intervalMillis, values}]),
// Distanz in distanceMeters, Sportart nur als Nummer (der Name steht in „name“, z. B. „Freistil-Rollski“).
export function parsePolarJsonV2(obj) {
  const ex = obj.exercises?.[0] || obj;
  const startRaw = ex.startTime || obj.startTime;
  if (!startRaw) throw new Error('Keine Startzeit im JSON');
  const offset = num(ex.timezoneOffsetMinutes ?? obj.timezoneOffsetMinutes);
  const start = polarTime(startRaw, offset);
  const startMs = Date.parse(startRaw); // Ortszeit wie die Pausen – nur für die relative Zeitachse
  const value = (v) => { const n = num(v); return n == null || Number.isNaN(n) ? null : n; };
  const byType = Object.fromEntries((ex.samples?.samples || []).map((s) => [s.type, s]));
  const pauses = (ex.pauseTimes || []).map((p) => [Date.parse(p.startTime), Date.parse(p.endTime)]).filter(([a, b]) => a && b);
  const types = Object.values(byType);
  const totalMs = Math.max(0, ...types.map((s) => (s.values?.length || 0) * (s.intervalMillis || 1000)));
  const step = Math.min(1000, ...types.map((s) => s.intervalMillis || 1000));
  const at = (type, sec) => { const s = byType[type]; if (!s?.values) return null; return value(s.values[Math.floor((sec * 1000) / (s.intervalMillis || 1000))]); };
  const points = [];
  for (let i = 0; i < totalMs / step; i++) {
    const t = startMs + i * step;
    if (pauses.some(([a, b]) => t >= a && t < b)) continue; // Pausen herausnehmen
    const sec = (i * step) / 1000;
    const sp = at('SPEED', sec);
    points.push({ t, hr: at('HEART_RATE', sec), power: at('POWER', sec) ?? at('CYCLING_POWER', sec), speed: sp != null ? sp / 3.6 : null, alt: at('ALTITUDE', sec) });
  }
  const hasData = points.some((p) => p.hr || p.power || p.speed);
  const stats = Object.fromEntries((ex.statistics?.statistics || []).map((s) => [s.type, s]));
  const p = obj.physicalInformation || ex.physicalInformation;
  const athlete = p ? { date: p.modified || start, hrMax: num(p.maximumHeartRate), hrRest: num(p.restingHeartRate), lthr: num(p.anaerobicThreshold), ftp: num(p.functionalThresholdPower), weightKg: num(p.weightKg), sex: /FEMALE/.test(p.sex || '') ? 'f' : /MALE/.test(p.sex || '') ? 'm' : null } : null;
  const stopS = ex.stopTime ? (Date.parse(ex.stopTime) - startMs) / 1000 : null;
  return summarize(hasData ? points : [], {
    athlete, start, sport: polarSportId(ex.sport?.id ?? obj.sport?.id) || polarSport(obj.name || ex.name || ''), title: obj.name || '', notes: obj.note || '',
    elapsedS: num(ex.durationMillis ?? obj.durationMillis) != null ? num(ex.durationMillis ?? obj.durationMillis) / 1000 : stopS ?? undefined,
    timerS: num(ex.durationMillis ?? obj.durationMillis) != null ? num(ex.durationMillis ?? obj.durationMillis) / 1000 : undefined, ...polarLaps(ex, startMs),
    distanceM: num(ex.distanceMeters ?? obj.distanceMeters) ?? undefined,
    calories: num(ex.calories ?? obj.calories) ?? undefined, ascentM: num(ex.ascentMeters) ?? undefined,
    avgHr: num(stats.STATISTICS_TYPE_HEART_RATE?.avg) ?? undefined, maxHr: num(stats.STATISTICS_TYPE_HEART_RATE?.max) ?? undefined,
    avgPower: num(stats.STATISTICS_TYPE_POWER?.avg ?? stats.STATISTICS_TYPE_CYCLING_POWER?.avg) ?? undefined,
    externalLoad: num(ex.trainingLoad ?? obj.trainingLoad),
    recorded: !!(obj.deviceId || obj.product || hasData),
    // Geplante Einheit (in Polar Flow eingetragenes Ziel): keine Uhr, keine Messwerte, keine Distanz, kein Puls.
    planned: !(obj.deviceId || obj.product || hasData) && !num(ex.distanceMeters ?? obj.distanceMeters) && !num(stats.STATISTICS_TYPE_HEART_RATE?.avg),
    polarSportId: ex.sport?.id ?? obj.sport?.id ?? null,
  });
}

// Nur Dateien, die Einheiten enthalten können (Polar-Export: training-session-*.json; Tagesaktivität, Schlaf usw. nicht).
export function importable(name) {
  const n = name.toLowerCase();
  if (n.endsWith('/') || n.includes('__macosx')) return false;
  const base = n.replace(/\.gz$/, '');
  // Nur aufgezeichnete Einheiten – nicht training-target (geplante Einheiten), Favoriten, Tagesaktivität, Schlaf …
  if (base.endsWith('.json')) return /training[-_]session/.test(n.split('/').pop());
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
  if (lower.endsWith('.csv')) {
    // Andere CSV-Dateien in Exporten (z. B. Strava: comments.csv) still überspringen.
    try { return [parsePolarCsv(text())]; } catch (e) { if (/Kein Polar-CSV/.test(e.message)) return []; throw e; }
  }
  if (lower.endsWith('.json')) {
    const obj = JSON.parse(text());
    // Nur aufgezeichnete Einheiten: geplante Einheiten (training-target) und Ähnliches haben keine „exercises“.
    if (/target/i.test(name) || !Array.isArray(obj.exercises) || !obj.exercises.length) return [];
    return [parsePolarJson(obj)];
  }
  return [];
}

// Strava-Konto-Export: activities.csv enthält Name und Sportart je Datei (Spalte „Filename“, z. B. activities/123.fit.gz).
function csvRows(text) {
  const rows = [];
  let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}
const STRAVA_SPORT = [
  [/roll ?ski|roller ?ski/i, (n) => (/skat|freistil|free/i.test(n) ? 'rollerski_skate' : 'rollerski_classic')],
  [/nordic ski|backcountry/i, (n) => (/skat|freistil|free/i.test(n) ? 'xc_skate' : 'xc_classic')],
  [/virtual ride|e-?bike|ride|velomobile|handcycle/i, () => 'bike'], [/virtual run|trail run|run/i, () => 'run'],
  [/rowing|row/i, () => 'row'], [/weight|crossfit|workout/i, () => 'strength'], [/hike|walk|snowshoe/i, () => 'hike'],
  [/swim/i, () => 'swim'], [/yoga|pilates/i, () => 'mobility'],
];
// Unbekannter Typ (z. B. übersetzte Bezeichnung): Sportart aus dem Namen erkennen, z. B. „Rollski Freistil“.
export const stravaSport = (type, name = '') => { const m = STRAVA_SPORT.find(([re]) => re.test(type || '')); if (m) return m[1](name); const byName = polarSport(name); return byName; };
export function parseStravaCsv(text) {
  const rows = csvRows(text).filter((r) => r.some((c) => c.trim()));
  const head = rows[0] || [];
  const col = (re) => head.findIndex((h) => re.test(h.trim()));
  const iFile = col(/^filename$/i), iName = col(/^activity name$/i), iType = col(/^activity type$/i), iDesc = col(/^activity description$/i);
  const iMove = col(/^moving time$/i), iElapsed = col(/^elapsed time$/i);
  if (iFile < 0 || iName < 0) return null;
  const out = {};
  for (const r of rows.slice(1)) {
    const f = (r[iFile] || '').split('/').pop();
    // Bewegungszeit und Gesamtzeit wie in Strava (Sekunden) – die Bewegungszeit entspricht der Zeit auf der Uhr mit Autostopp.
    const num = (i) => (i >= 0 && r[i] && Number.isFinite(Number(String(r[i]).replace(',', '.'))) ? Number(String(r[i]).replace(',', '.')) : null);
    if (f) out[f] = { name: r[iName] || '', type: r[iType] || '', notes: iDesc >= 0 ? r[iDesc] || '' : '', movingS: num(iMove), elapsedS: num(iElapsed) };
  }
  return out;
}
