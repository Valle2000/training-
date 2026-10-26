// Einheiten anlegen, Dubletten erkennen, Auswertungen über Tage und Wochen.
import { computeLoad, zoneSeconds, performanceCurve, addDays, ZONES } from './metrics.js';
import { sportById } from './sports.js';
import { thin } from './fit.js';

export const athleteOf = (s = {}) => ({
  ftp: num(s.ftp), lthr: num(s.lthr), hrMax: num(s.hrMax), hrRest: num(s.hrRest), sex: s.sex || 'm',
});
const num = (v) => (v === '' || v == null || isNaN(Number(v)) ? null : Number(v));

export const localDate = (iso, tz = 'Europe/Berlin') =>
  new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso));
export const today = (tz) => localDate(new Date().toISOString(), tz);

// Gleiche Startminute = gleiche Einheit (z. B. Polar-Uhr und Wahoo zeichnen parallel auf).
// Bei ±2 min Abweichung und ähnlicher Dauer ebenfalls Dublette.
export function findDuplicate(activities, a) {
  const t = Date.parse(a.start);
  return activities.find((x) => {
    if (a.source && x.source === a.source && a.externalId && x.externalId === a.externalId) return true;
    const dt = Math.abs(Date.parse(x.start) - t);
    return dt < 120000 && Math.abs((x.durationS || 0) - (a.durationS || 0)) < Math.max(300, 0.15 * (a.durationS || 0));
  });
}

// Belastung, Zonen usw. aus Rohdaten berechnen. raw.series in 1 Hz (optional).
export function evaluate(raw, settings) {
  const athlete = athleteOf(settings);
  const series = raw.series;
  const movingS = series?.hr?.length || raw.durationS || raw.elapsedS || 0;
  const res = computeLoad(athlete, {
    durationS: movingS, power: series?.power, hr: series?.hr, avgHr: raw.avgHr, rpe: raw.rpe,
    kind: raw.sport === 'strength' ? 'strength' : 'endurance', powerSport: !!sportById(raw.sport).power,
  });
  let zones = series?.hr?.some(Boolean) ? zoneSeconds(series.hr, athlete.hrMax) : null;
  // Ohne Verlauf: ganze Dauer der Zone des Durchschnittspulses bzw. der manuell gewählten Zone zuordnen.
  if (!zones && raw.zone) zones = { I1: 0, I2: 0, I3: 0, I4: 0, I5: 0, [raw.zone]: movingS };
  return {
    durationS: movingS,
    load: res.load != null ? Math.round(res.load * 10) / 10 : null,
    loadSource: res.source,
    np: res.np ? Math.round(res.np) : null,
    intensity: res.intensity ? Math.round(res.intensity * 100) / 100 : null,
    trimp: res.trimp ? Math.round(res.trimp) : null,
    zones,
  };
}

// Neue Einheit aus Rohdaten (FIT, Concept2, manuell). Gibt {activity, series} zurück.
export function buildActivity(raw, settings, extra = {}) {
  const ev = evaluate(raw, settings);
  const activity = {
    id: extra.id || Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    source: raw.source || 'upload', externalId: raw.externalId ?? null,
    start: raw.start, date: localDate(raw.start, settings.timezone), sport: raw.sport,
    title: raw.title || '', notes: raw.notes || '', rpe: raw.rpe ?? null, lactate: raw.lactate || '',
    zone: raw.zone || null, elapsedS: raw.elapsedS ?? raw.durationS ?? null,
    distanceM: raw.distanceM ?? null, avgHr: round(raw.avgHr), maxHr: round(raw.maxHr), avgPower: round(raw.avgPower),
    calories: raw.calories ?? null, ascentM: raw.ascentM ?? null, strengthId: raw.strengthId ?? null,
    hasSeries: !!raw.series?.hr?.length, ...ev,
  };
  return { activity, series: raw.series ? thin(raw.series) : null };
}
const round = (v) => (v == null ? null : Math.round(v));

// Neuberechnung (z. B. nach geänderter Schwelle). Verlauf liegt nur ausgedünnt (5 s) vor → hochrechnen.
export function reevaluate(a, settings, series5) {
  const series = series5 ? Object.fromEntries(Object.entries(series5).map(([k, v]) => [k, v.flatMap((x) => [x, x, x, x, x])])) : null;
  return { ...a, ...evaluate({ ...a, series, durationS: series ? null : a.durationS }, settings) };
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
  const { activities, strength, plan, settings, wellness } = data;
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
    erholung: wellness.filter((w) => w.date >= addDays(t, -14)).map((w) => ({ datum: w.date, hrv: w.hrv, ruhepuls: w.restHr, schlafScore: w.sleepScore, schlafStd: w.sleepH, recharge: w.recharge })),
    geplant: plan.filter((p) => p.date >= t).slice(0, 21).map((p) => ({ datum: p.date, titel: p.title, min: p.minutes, zone: p.zone })),
  };
}
