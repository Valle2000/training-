// Auswertungen über frei wählbare Zeiträume (wie TrainingPeaks-Dashboard und WKO-Charts).
import { addDays, ZONES, POWER_ZONES, CURVE_DURATIONS } from './metrics.js';
import { sportById } from './sports.js';
import { mondayOf } from './activities.js';

export const PRESETS = [
  ['4w', '4 Wochen'], ['3m', '3 Monate'], ['6m', '6 Monate'], ['season', 'Saison'], ['year', 'Jahr'], ['12m', '12 Monate'], ['all', 'Alles'], ['custom', 'Eigener'],
];

const monthsBack = (t, n) => { const d = new Date(t + 'T12:00:00Z'); d.setUTCMonth(d.getUTCMonth() - n); return addDays(d.toISOString().slice(0, 10), 1); };

// Langlaufsaison beginnt am 1. Mai.
export function periodRange(preset, t, activities = [], custom = {}) {
  const y = +t.slice(0, 4);
  switch (preset) {
    case '4w': return { from: addDays(t, -27), to: t };
    case '3m': return { from: monthsBack(t, 3), to: t };
    case '6m': return { from: monthsBack(t, 6), to: t };
    case 'season': return { from: t.slice(5) >= '05-01' ? `${y}-05-01` : `${y - 1}-05-01`, to: t };
    case 'year': return { from: `${y}-01-01`, to: t };
    case '12m': return { from: monthsBack(t, 12), to: t };
    case 'all': return { from: activities.map((a) => a.date).sort()[0] || t, to: t };
    default: return { from: custom.from || addDays(t, -27), to: custom.to || t };
  }
}

export const daysBetween = (from, to) => Math.round((Date.parse(to) - Date.parse(from)) / 864e5) + 1;
export function previousRange({ from, to }) {
  const n = daysBetween(from, to);
  return { from: addDays(from, -n), to: addDays(from, -1) };
}

export const SPORT_FILTERS = [['all', 'Alle'], ['ski', 'Ski'], ['endurance', 'Ausdauer'], ['strength', 'Kraft'], ['power', 'Mit Watt']];
export function matchesFilter(a, filter) {
  if (!filter || filter === 'all') return true;
  if (filter === 'power') return !!sportById(a.sport).power;
  if (['ski', 'endurance', 'strength', 'other'].includes(filter)) return sportById(a.sport).group === filter;
  return a.sport === filter;
}
export const inRange = (acts, { from, to }, filter) => acts.filter((a) => a.date >= from && a.date <= to && matchesFilter(a, filter));

const emptyZones = () => Object.fromEntries(ZONES.map((z) => [z.id, 0]));
const emptyPZones = () => Object.fromEntries(POWER_ZONES.map((z) => [z.id, 0]));

export function totals(acts) {
  const t = { sessions: acts.length, hours: 0, load: 0, distanceKm: 0, ascentM: 0, kj: 0, zones: emptyZones(), powerZones: emptyPZones(), groups: { ski: 0, endurance: 0, strength: 0, other: 0 }, sports: {} };
  for (const a of acts) {
    const h = (a.durationS || 0) / 3600;
    t.hours += h; t.load += a.load || 0; t.distanceKm += (a.distanceM || 0) / 1000; t.ascentM += a.ascentM || 0; t.kj += a.kj || 0;
    t.groups[sportById(a.sport).group] += h;
    const s = (t.sports[a.sport] ||= { sessions: 0, hours: 0, load: 0, distanceKm: 0 });
    s.sessions++; s.hours += h; s.load += a.load || 0; s.distanceKm += (a.distanceM || 0) / 1000;
    if (a.zones) for (const z of ZONES) t.zones[z.id] += (a.zones[z.id] || 0) / 3600;
    if (a.powerZones) for (const z of POWER_ZONES) t.powerZones[z.id] += (a.powerZones[z.id] || 0) / 3600;
  }
  return t;
}

// Prozentuale Veränderung gegenüber dem Vorzeitraum.
export const delta = (now, prev) => (prev ? Math.round(((now - prev) / prev) * 100) : null);

// Buckets je Woche oder Monat über den Zeitraum.
export function buckets(acts, { from, to }, by = 'week') {
  const out = [];
  let start = by === 'week' ? mondayOf(from) : from.slice(0, 8) + '01';
  while (start <= to) {
    let end;
    if (by === 'week') end = addDays(start, 6);
    else { const d = new Date(start + 'T12:00:00Z'); d.setUTCMonth(d.getUTCMonth() + 1); end = addDays(d.toISOString().slice(0, 10), -1); }
    const list = acts.filter((a) => a.date >= start && a.date <= end);
    out.push({ from: start, to: end, label: by === 'week' ? `${+start.slice(8)}.${+start.slice(5, 7)}.` : new Date(start + 'T12:00:00Z').toLocaleDateString('de-DE', { month: 'short', year: '2-digit' }), ...totals(list) });
    start = addDays(end, 1);
  }
  return out;
}

// Bestwerte je Zeitspanne über viele Einheiten: {dauer: {value, date, id}}.
export function bestCurve(acts, key = 'powerCurve') {
  const out = {};
  for (const a of acts) {
    const c = a[key];
    if (!c) continue;
    for (const [d, v] of Object.entries(c)) if (!out[d] || v > out[d].value) out[d] = { value: v, date: a.date, id: a.id };
  }
  return out;
}

export const fmtDur = (s) => (s < 60 ? `${s}s` : s < 3600 ? `${Math.round(s / 60)}min` : `${s / 3600 % 1 ? (s / 3600).toFixed(1).replace('.', ',') : s / 3600}h`);
export const KEY_DURATIONS = [5, 60, 300, 1200, 3600];

// FTP-Schätzung aus der Kurve: 95 % der besten 20 min, oder beste 60 min, falls höher.
export function estimateFtp(curve) {
  const a = curve[1200]?.value ? curve[1200].value * 0.95 : 0;
  const b = curve[3600]?.value || 0;
  return Math.round(Math.max(a, b)) || null;
}

// Ramp Rate: Fitness-Zuwachs pro Woche (Durchschnitt der letzten n Wochen bis `to`).
export function rampRate(days, to, weeks = 4) {
  const end = days.find((d) => d.day === to) || days.filter((d) => d.day <= to).at(-1);
  const startDay = addDays(end?.day || to, -7 * weeks);
  const start = days.find((d) => d.day === startDay);
  return end && start ? Math.round(((end.fitness - start.fitness) / weeks) * 10) / 10 : null;
}

// Gleitender Durchschnitt (z. B. HRV-Baseline über 7 Tage).
export function rolling(values, n = 7) {
  return values.map((_, i) => {
    const w = values.slice(Math.max(0, i - n + 1), i + 1).filter((v) => v != null);
    return w.length ? w.reduce((a, b) => a + b, 0) / w.length : null;
  });
}

export const intensityShare = (zones) => {
  const total = Object.values(zones).reduce((a, b) => a + b, 0);
  if (!total) return null;
  return { low: (zones.I1 + zones.I2) / total, mid: zones.I3 / total, high: (zones.I4 + zones.I5) / total };
};

export { CURVE_DURATIONS };
