// Einheiten anlegen, Dubletten erkennen, Auswertungen über Tage und Wochen.
import { computeLoad, luciaLoad, zoneSeconds, performanceCurve, addDays, ZONES, seriesStats, cleanSeries } from './metrics.js';
import { tolerance, seasonTable } from './longterm.js';
import { sportById } from './sports.js';
import { thin } from './series.js';
import { lapsFromSeries } from './laps.js';
import { keySessionRows } from './keysessions.js';

// FTP je Sportart: SkiErg und Rudern haben eigene Schwellenleistungen, sonst gilt die Rad-FTP.
export const ftpFor = (s = {}, sport) => num({ skierg: s.ftpSkierg, row: s.ftpRow, bikeerg: s.ftp }[sport]) ?? num(s.ftp);
export const athleteOf = (s = {}, sport) => ({
  ftp: ftpFor(s, sport), lthr: num(s.lthr), hrMax: num(s.hrMax), hrRest: num(s.hrRest), sex: s.sex || 'm',
});
const num = (v) => (v === '' || v == null || isNaN(Number(v)) ? null : Number(v));

export const localDate = (iso, tz = 'Europe/Berlin') =>
  new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso));
export const today = (tz) => localDate(new Date().toISOString(), tz);

// Gleiche Startminute = gleiche Einheit (z. B. Polar-Uhr und Wahoo zeichnen parallel auf).
// Bei ±2 min Abweichung und ähnlicher Dauer ebenfalls Dublette.
// Dieselbe Einheit von zwei Geräten/Quellen (z. B. Polar-Uhr und Wahoo, oder Strava-Kopie): gleicher Anbieter-ID,
// oder Start innerhalb 2 min bei ähnlicher Dauer (Bewegungszeit oder Gesamtzeit), oder zeitlich zu mindestens 80 %
// überlappend bei Start innerhalb 15 min (anders gestartet, Pausen unterschiedlich gezählt).
export function findDuplicate(activities, a) {
  const t = Date.parse(a.start);
  const lensA = [a.durationS, a.elapsedS].filter((v) => v > 0);
  return activities.find((x) => {
    if (a.source && x.source === a.source && a.externalId && x.externalId === a.externalId) return true;
    const tx = Date.parse(x.start), dt = Math.abs(tx - t);
    if (dt > 900000) return false;
    const lensX = [x.durationS, x.elapsedS].filter((v) => v > 0);
    if (dt < 120000 && lensA.some((la) => lensX.some((lx) => Math.abs(la - lx) < Math.max(300, 0.15 * la)))) return true;
    const la = Math.max(0, ...lensA), lx = Math.max(0, ...lensX);
    if (!la || !lx || Math.min(la, lx) / Math.max(la, lx) < 0.6) return false; // Teilstück (z. B. 20 min SkiErg in 1 h) ist keine Dublette
    const overlap = Math.min(t + la * 1000, tx + lx * 1000) - Math.max(t, tx);
    return overlap >= 0.8 * Math.min(la, lx) * 1000;
  });
}

// Belastung, Zonen usw. aus Rohdaten berechnen. raw.series in 1 Hz (optional).
export function evaluate(raw, settings) {
  const athlete = athleteOf(settings, raw.sport);
  const series = cleanSeries(raw.series);
  // Dauer wie auf der Uhr (Polar/Garmin/Wahoo-Timer), sonst Bewegungszeit aus dem Verlauf.
  const movingS = raw.timerS || series?.hr?.length || raw.durationS || raw.elapsedS || 0;
  const res = computeLoad(athlete, {
    durationS: movingS, power: series?.power, hr: series?.hr, avgHr: raw.avgHr, rpe: raw.rpe,
    kind: raw.sport === 'strength' ? 'strength' : 'endurance', powerSport: !!sportById(raw.sport).power,
  });
  let zones = series?.hr?.some(Boolean) ? zoneSeconds(series.hr, athlete.hrMax, settings.zoneHr) : null;
  // Ohne Verlauf: ganze Dauer der Zone des Durchschnittspulses bzw. der manuell gewählten Zone zuordnen.
  if (!zones && raw.zone) zones = { I1: 0, I2: 0, I3: 0, I4: 0, I5: 0, [raw.zone]: movingS };
  // Wahlweise umfangsbetontes Zonenmodell (Einstellungen → Belastungsmodell), wenn Pulszonen vorliegen.
  const lucia = settings.loadModel === 'lucia' && raw.sport !== 'strength' && zones ? luciaLoad(zones) : null;
  return {
    durationS: movingS,
      // Ohne Puls, Watt und RPE: Polars eigene Trainingsbelastung aus dem Export (grobe Näherung).
    load: lucia != null ? Math.round(lucia * 10) / 10 : res.load != null ? Math.round(res.load * 10) / 10 : raw.externalLoad ?? null,
    loadSource: lucia != null ? 'lucia' : res.load != null ? res.source : raw.externalLoad != null ? 'polar' : res.source,
    np: res.np ? Math.round(res.np) : null,
    intensity: res.intensity ? Math.round(res.intensity * 100) / 100 : null,
    trimp: res.trimp ? Math.round(res.trimp) : null,
    zones,
    // Bestwertkurven, Leistungszonen, kJ, VI, EF, Entkopplung (nur mit Verlauf)
    hrCurve: null, powerCurve: null, powerZones: null, kj: null, vi: null, ef: null, decoupling: null, hrHist: null, powerHist: null, powerHr: null,
    ...(series ? seriesStats(series, { ftp: athlete.ftp, powerSport: !!sportById(raw.sport).power }) : {}),
    // Automatische Runden: von der Uhr (Polar-Autolaps), sonst aus dem Tempo berechnet (Laufen/Ski 1 km, Rad 5 km).
    autoLaps: raw.deviceAutoLaps || (series ? distanceSplits(series, raw.sport) : null),
  };
}

// Neue Einheit aus Rohdaten (FIT, Concept2, manuell). Gibt {activity, series} zurück.
export function buildActivity(raw, settings, extra = {}) {
  // Fehlen Ø/max Puls oder Ø Leistung in der Zusammenfassung, aus dem Verlauf berechnen.
  const hr = raw.series?.hr?.filter((h) => h > 0) || [], pw = raw.series?.power?.filter((p) => p != null) || [];
  raw = { ...raw, avgHr: raw.avgHr ?? (hr.length ? hr.reduce((a, b) => a + b, 0) / hr.length : null), maxHr: raw.maxHr ?? (hr.length ? Math.max(...hr) : null), avgPower: raw.avgPower ?? (pw.some(Boolean) ? pw.reduce((a, b) => a + b, 0) / pw.length : null) };
  const ev = evaluate(raw, settings);
  const activity = {
    id: extra.id || Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    source: raw.source || 'upload', externalId: raw.externalId ?? null,
    start: raw.start, date: localDate(raw.start, settings.timezone), sport: raw.sport,
    title: renameTitle(raw.title || '', settings), notes: raw.notes || '', rpe: raw.rpe ?? null, lactate: raw.lactate || '',
    zone: raw.zone || null, elapsedS: raw.elapsedS ?? raw.durationS ?? null,
    distanceM: raw.distanceM ?? null, avgHr: round(raw.avgHr), maxHr: round(raw.maxHr), avgPower: round(raw.avgPower),
    calories: raw.calories ?? null, ascentM: raw.ascentM ?? null, strengthId: raw.strengthId ?? null,
    laps: raw.laps || null, timerS: raw.timerS ?? null, deviceAutoLaps: raw.deviceAutoLaps || null, externalLoad: raw.externalLoad ?? null, pace: raw.pace ?? null, spm: raw.spm ?? null, workS: raw.workS ?? null,
    hasSeries: !!raw.series?.hr?.length, ...ev,
  };
  return { activity, series: raw.series ? thin(raw.series) : null };
}
const round = (v) => (v == null ? null : Math.round(v));

// Splits nach Distanz aus dem 1-Hz-Tempoverlauf (m/s): jeder km (Rad: alle 5 km), wie die Autolap-Funktion der Uhr.
const SPLIT_M = { run: 1000, hike: 1000, xc_skate: 1000, xc_classic: 1000, rollerski_skate: 1000, rollerski_classic: 1000, bike: 5000 };
export function distanceSplits(series, sport) {
  const step = SPLIT_M[sport], sp = series?.speed;
  if (!step || !sp?.some((v) => v > 0)) return null;
  const bounds = [];
  let dist = 0, start = 0, next = step;
  for (let i = 0; i < sp.length; i++) {
    dist += sp[i] > 0 ? sp[i] : 0;
    if (dist >= next) { bounds.push({ startS: start, durationS: i + 1 - start, distanceM: step }); start = i + 1; next += step; }
  }
  const restM = dist - (next - step);
  if (restM >= step * 0.2 && sp.length - start > 10) bounds.push({ startS: start, durationS: sp.length - start, distanceM: Math.round(restM) });
  if (bounds.length < 2) return null;
  return lapsFromSeries({ hr: series.hr || [], power: series.power || [] }, bounds).map((l) => ({ ...l, pace: (l.durationS / l.distanceM) * 1000 }));
}

// Umbenennen-Regeln (Einstellungen): z. B. „20:00, 2×20:00/2:00r, 2×20:00“ → „3x20min“. Gilt für neue Importe.
export const renameTitle = (title, settings = {}) => settings.titleRules?.[title] || title;

// Neuberechnung (z. B. nach geänderter Schwelle). Verlauf liegt nur ausgedünnt (5 s) vor → hochrechnen.
export function reevaluate(a, settings, series5) {
  const series = series5 ? Object.fromEntries(Object.entries(series5).map(([k, v]) => [k, v.flatMap((x) => [x, x, x, x, x])])) : null;
  // Fehlende Ø/max Puls bzw. Ø Leistung (z. B. „0“ aus älteren Polar-Importen) aus dem Verlauf ergänzen.
  const hr = series5?.hr?.filter((h) => h > 0) || [], pw = series5?.power?.filter((p) => p != null) || [];
  const fill = {
    avgHr: a.avgHr || (hr.length ? round(hr.reduce((x, y) => x + y, 0) / hr.length) : a.avgHr ?? null),
    maxHr: a.maxHr || (hr.length ? Math.max(...hr) : a.maxHr ?? null),
    avgPower: a.avgPower || (pw.some(Boolean) ? round(pw.reduce((x, y) => x + y, 0) / pw.length) : a.avgPower ?? null),
  };
  return { ...a, ...fill, ...evaluate({ ...a, ...fill, series, durationS: series ? null : a.durationS }, settings) };
}

export function dailyLoads(activities) {
  const out = {};
  for (const a of activities) out[a.date] = (out[a.date] || 0) + (a.load || 0);
  return out;
}

export function plannedLoads(plan) {
  const out = {};
  for (const p of plan) if (!p.done) out[p.date] = (out[p.date] || 0) + (p.load || 0);
  return out;
}

export function curve(activities, plan, t, futureDays = 21) {
  const loads = dailyLoads(activities);
  const days = Object.keys(loads).sort();
  if (!days.length) return [];
  const planned = plannedLoads(plan.filter((p) => p.date > t));
  const lastPlan = Object.keys(planned).sort().at(-1);
  const end = [addDays(t, futureDays), lastPlan].filter(Boolean).sort().at(-1);
  return performanceCurve(loads, days[0], end, { planned, today: t });
}

export const mondayOf = (iso) => { const d = new Date(iso + 'T12:00:00Z'); return addDays(iso, -((d.getUTCDay() + 6) % 7)); };

// Wochenübersicht: Stunden gesamt, je Sportgruppe und je Zone, Belastung, Krafteinheiten.
export function weeks(activities, count = 12, t) {
  const start = addDays(mondayOf(t), -7 * (count - 1));
  const out = [];
  for (let i = 0; i < count; i++) {
    const from = addDays(start, 7 * i), to = addDays(from, 6);
    const list = activities.filter((a) => a.date >= from && a.date <= to);
    const zones = { I1: 0, I2: 0, I3: 0, I4: 0, I5: 0 };
    const groups = { ski: 0, endurance: 0, strength: 0, other: 0 };
    let hours = 0, load = 0;
    for (const a of list) {
      const h = (a.durationS || 0) / 3600;
      hours += h; load += a.load || 0;
      groups[sportById(a.sport).group] += h;
      if (a.zones) for (const z of ZONES) zones[z.id] += (a.zones[z.id] || 0) / 3600;
    }
    out.push({ from, to, hours, load, groups, zones, sessions: list.length, strengthSessions: list.filter((a) => a.sport === 'strength').length, thresholdSessions: list.filter(isThreshold).length });
  }
  return out;
}

// Schwelleneinheit: mind. 15 min in I3 oder manuell als I3 markiert.
export const isThreshold = (a) => a.zone === 'I3' || (a.zones?.I3 || 0) >= 900;

// Kompakte Daten für den KI-Coach, damit die Anfrage klein bleibt.
export function coachSummary(data, t) {
  const { activities, strength, plan, settings, wellness, keySessions = [], races = [], health = [], lactateTests = [] } = data;
  const c = curve(activities, plan, t, 0);
  const now = c.find((d) => d.day === t) || c.at(-1);
  const recent = activities.filter((a) => a.date >= addDays(t, -21)).sort((a, b) => a.date.localeCompare(b.date));
  const r1 = (v) => Math.round(v * 10) / 10;
  return {
    heute: t,
    athlet: {
      sport: 'Skilanglauf', ftp: settings.ftp, laktatschwellenPuls: settings.lthr, maxPuls: settings.hrMax, ruhePuls: settings.hrRest,
      gewichtKg: settings.weightKg, geschlecht: settings.sex === 'f' ? 'weiblich' : 'männlich', alter: settings.age,
      ziele: settings.goals, wettkaempfe: settings.races, strategie: settings.strategy, verfuegbarkeit: settings.availability,
    },
    formHeute: now ? { fitness: r1(now.fitness), ermuedung: r1(now.fatigue), form: r1(now.form) } : null,
    wochen: weeks(activities, 12, t).map((w) => ({
      ab: w.from, stunden: r1(w.hours), belastung: Math.round(w.load), einheiten: w.sessions, kraft: w.strengthSessions, schwelle: w.thresholdSessions,
      stundenJeZone: Object.fromEntries(Object.entries(w.zones).map(([k, v]) => [k, r1(v)])),
      stundenJeGruppe: Object.fromEntries(Object.entries(w.groups).map(([k, v]) => [k, r1(v)])),
    })),
    letzte21Tage: recent.map((a) => ({
      datum: a.date, sport: sportById(a.sport).label, titel: a.title || undefined, min: Math.round((a.durationS || 0) / 60),
      belastung: a.load ?? undefined, oPuls: a.avgHr ?? undefined, rpe: a.rpe ?? undefined, laktat: a.lactate || undefined,
      zonenMin: a.zones ? Object.fromEntries(Object.entries(a.zones).filter(([, v]) => v > 59).map(([k, v]) => [k, Math.round(v / 60)])) : undefined,
      notiz: a.notes || undefined,
    })),
    kraftLetzte4Wochen: strength.filter((s) => s.date >= addDays(t, -28)).map((s) => ({
      datum: s.date, uebungen: (s.items || []).map((it) => `${it.name || it.ex}: ${(it.sets || []).map((x) => `${x.reps || x.sec || '?'}${x.kg ? '×' + x.kg + 'kg' : ''}`).join(', ')}`),
    })),
    erholung: wellness.filter((w) => w.date >= addDays(t, -14)).map((w) => ({ datum: w.date, hrv: w.hrv, ruhepuls: w.restHr, schlafScore: w.sleepScore, schlafStd: w.sleepH, recharge: w.recharge, gefuehl1bis5: w.feel, schlafqualitaet1bis5: w.sleepQ, muskelkater1bis5: w.soreness, stress1bis5: w.stress, symptome: w.symptoms?.length ? w.symptoms : undefined, gewichtKg: w.weightKg ?? undefined })),
    rennen: races.filter((r) => r.date >= addDays(t, -60)).sort((a, b) => a.date.localeCompare(b.date)).map((r) => ({ datum: r.date, name: r.name, prioritaet: r.priority, technik: r.technique, km: r.distanceKm || undefined, ziel: r.goal || undefined, rueckstandProzent: r.result?.gapPct ?? undefined, platz: r.result?.place || undefined })),
    gesundheit: health.filter((e) => !e.end || e.end >= addDays(t, -60)).map((e) => ({ art: e.type, titel: e.title, von: e.start, bis: e.end || 'andauernd', auswirkung: e.impact })),
    laktattest: (() => { const lt = [...lactateTests].sort((a, b) => b.date.localeCompare(a.date))[0]; return lt ? { datum: lt.date, sport: lt.sport, einheit: lt.unit, stufen: lt.steps.filter((x) => x.lactate).map((x) => ({ last: x.load, puls: x.hr || undefined, laktat: x.lactate })) } : undefined; })(),
    pulszonenAusLaktattest: settings.zoneHr || undefined,
    geplant: plan.filter((p) => p.date >= t).slice(0, 21).map((p) => ({ datum: p.date, titel: p.title, min: p.minutes, zone: p.zone })),
    keySessions: keySessions.map((k) => ({ name: k.name, vergleichsdauerSek: k.intervalSec, verlauf: keySessionRows(activities, k).slice(-6).map((r) => ({ datum: r.date, watt: r.intervalPower ?? undefined, puls: r.intervalHr ?? r.avgHr ?? undefined, laktat: r.lactateAvg ?? undefined, rpe: r.rpe ?? undefined })) })).filter((k) => k.verlauf.length),
    ftp: { rad: settings.ftp, skierg: settings.ftpSkierg, rudern: settings.ftpRow },
    belastbarkeit: (() => {
      const tol = tolerance(activities, t, 365);
      return tol ? { letzte7Tage: Math.round(tol.now.acute), schnittProWocheLetztesJahr: Math.round(tol.now.chronic), bestenVierWochenProWoche: Math.round(tol.now.capacity), verhaeltnis: tol.now.ratio ? r1(tol.now.ratio) : undefined } : undefined;
    })(),
    saisons: seasonTable(activities).slice(0, 4).map((s) => ({ saison: s.label, stunden: Math.round(s.hours), maxWoche: r1(s.maxWeek), fitnessMax: Math.round(s.peakFitness) })),
  };
}

// Geschätzte Belastung einer geplanten Einheit pro Stunde je Zone (≈ IF² × 100).
export const PLAN_LOAD_PER_HOUR = { I1: 50, I2: 65, I3: 90, I4: 110, I5: 125, Kraft: 45, Ruhe: 0 };
export const estimatePlanLoad = (minutes, zone) => Math.round(((Number(minutes) || 0) / 60) * (PLAN_LOAD_PER_HOUR[zone] ?? 50));

// Geplante Einheit gilt als erledigt, wenn am selben Tag eine Einheit derselben Sportgruppe existiert.
export function matchPlan(p, activities) {
  const g = sportById(p.sport).group;
  return activities.find((a) => a.date === p.date && (a.sport === p.sport || sportById(a.sport).group === g));
}

// Soll/Ist für einen Zeitraum.
export function compliance(plan, activities, from, to) {
  const items = plan.filter((p) => p.date >= from && p.date <= to);
  const acts = activities.filter((a) => a.date >= from && a.date <= to);
  const done = items.filter((p) => p.done || matchPlan(p, acts));
  return {
    planned: items.length, done: done.length,
    plannedMin: items.reduce((a, p) => a + (Number(p.minutes) || 0), 0), actualMin: acts.reduce((a, x) => a + (x.durationS || 0) / 60, 0),
    plannedLoad: items.reduce((a, p) => a + (p.load || 0), 0), actualLoad: acts.reduce((a, x) => a + (x.load || 0), 0),
  };
}

// Einheit auf einen Abschnitt zuschneiden (z. B. vergessenes Stoppen, Heimweg). Verlauf im 5-s-Raster,
// from/to sind Indizes darin. Werte, die nur als Summe vorliegen (Distanz ohne Tempo, Kalorien), anteilig.
export function cropActivity(a, series5, from, to, settings) {
  const cut = Object.fromEntries(Object.entries(series5).map(([k, v]) => [k, v.slice(from, to + 1)]));
  const total = series5.hr?.length || series5.power?.length || 1, share = (to - from + 1) / total;
  const speedSum = cut.speed?.some((v) => v > 0) ? cut.speed.reduce((s, v) => s + (v || 0) * 5, 0) : null;
  const base = {
    ...a, avgHr: null, maxHr: null, avgPower: null,
    start: new Date(Date.parse(a.start) + from * 5000).toISOString(),
    distanceM: speedSum ?? (a.distanceM ? a.distanceM * share : null),
    calories: a.calories ? Math.round(a.calories * share) : null,
    ascentM: null, laps: (a.laps || []).filter((l) => l.startS >= from * 5 && l.startS < (to + 1) * 5).map((l, i) => ({ ...l, n: i + 1, startS: l.startS - from * 5 })),
    original: a.original || { ...a, original: undefined },
  };
  const next = reevaluate(base, settings, cut);
  next.date = localDate(next.start, settings.timezone);
  next.elapsedS = next.durationS;
  next.externalLoad = null;
  next.timerS = null; next.deviceAutoLaps = null;
  if (!next.laps.length) next.laps = null;
  return { activity: next, series: cut };
}
