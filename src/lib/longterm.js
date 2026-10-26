// Langzeit-Auswertungen über die ganze Historie: Saisonvergleich, Stunden in frei wählbaren Puls-/Watt-Bereichen,
// Puls bei gleicher Leistung und Belastbarkeit aus deiner eigenen Vergangenheit (statt nur der letzten 4 Wochen).
import { addDays, HR_BIN, POWER_BIN, secondsBetween, performanceCurve } from './metrics.js';
import { dailyLoads, mondayOf } from './activities.js';

// Langlaufsaison beginnt am 1. Mai.
export const seasonStart = (date) => (date.slice(5) >= '05-01' ? `${date.slice(0, 4)}-05-01` : `${+date.slice(0, 4) - 1}-05-01`);
export const seasonLabel = (start) => `${start.slice(2, 4)}/${String(+start.slice(2, 4) + 1).padStart(2, '0')}`;
const days = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5);

// Kumulierte Stunden je Saison, Woche für Woche (für den Vergleich „wo stehe ich gegenüber den Vorjahren“).
export function seasonCumulative(activities, t, count = 4) {
  const seasons = [...new Set(activities.map((a) => seasonStart(a.date)))].sort().slice(-count);
  return seasons.map((s) => {
    const weeks = Array(53).fill(0);
    for (const a of activities) if (seasonStart(a.date) === s) weeks[Math.min(52, Math.floor(days(s, a.date) / 7))] += (a.durationS || 0) / 3600;
    const cut = s === seasonStart(t) ? Math.floor(days(s, t) / 7) : 52;
    let sum = 0;
    return { start: s, label: seasonLabel(s), values: weeks.map((h, i) => (i > cut ? null : (sum += h))) };
  });
}

// Übersicht je Saison: Stunden, Zonen, größte Woche, höchste Fitness.
export function seasonTable(activities) {
  const loads = dailyLoads(activities);
  const first = Object.keys(loads).sort()[0];
  const curve = first ? performanceCurve(loads, first, Object.keys(loads).sort().at(-1)) : [];
  const out = {};
  for (const a of activities) {
    const s = seasonStart(a.date);
    const r = (out[s] ||= { start: s, label: seasonLabel(s), hours: 0, sessions: 0, load: 0, zones: { I1: 0, I2: 0, I3: 0, I4: 0, I5: 0 }, weeks: {}, peakFitness: 0 });
    const h = (a.durationS || 0) / 3600;
    r.hours += h; r.sessions++; r.load += a.load || 0;
    if (a.zones) for (const z in r.zones) r.zones[z] += (a.zones[z] || 0) / 3600;
    const w = mondayOf(a.date); r.weeks[w] = (r.weeks[w] || 0) + h;
  }
  for (const d of curve) { const r = out[seasonStart(d.day)]; if (r && d.fitness > r.peakFitness) r.peakFitness = d.fitness; }
  return Object.values(out).sort((a, b) => b.start.localeCompare(a.start)).map((r) => ({ ...r, maxWeek: Math.max(0, ...Object.values(r.weeks)), weeksActive: Object.keys(r.weeks).length }));
}

// Sekunden einer Einheit in einem frei gewählten Bereich (Puls in bpm oder Leistung in W).
export const bandSeconds = (a, kind, lo, hi) => (kind === 'power' ? secondsBetween(a.powerHist, lo, hi, POWER_BIN) : secondsBetween(a.hrHist, lo, hi, HR_BIN));

// Puls bei gegebener Leistung (±tol W) in einer Einheit; mindestens 3 min in dem Bereich, sonst null.
export function hrAtPower(a, watt, tol = 10) {
  let hr = 0, s = 0;
  for (const [w, h, sec] of a.powerHr || []) if (Math.abs(w - watt) <= tol) { hr += h * sec; s += sec; }
  return s >= 180 ? Math.round(hr / s) : null;
}
// Umgekehrt: Leistung bei gegebenem Puls (±tol bpm), aus derselben Tabelle.
export function powerAtHr(a, bpm, tol = 3) {
  let w = 0, s = 0;
  for (const [p, h, sec] of a.powerHr || []) if (Math.abs(h - bpm) <= tol) { w += p * sec; s += sec; }
  return s >= 180 ? Math.round(w / s) : null;
}

// Belastbarkeit: Wochenbelastung im Vergleich zu deinem eigenen langfristigen Schnitt und zu dem,
// was du in einem frei wählbaren Rückblick (z. B. 1 Jahr) bisher über 4 Wochen am Stück vertragen hast.
export function tolerance(activities, t, windowDays = 365) {
  const loads = dailyLoads(activities);
  const first = Object.keys(loads).filter((d) => d <= t).sort()[0];
  if (!first) return null;
  // Tagesreihe mit Präfixsummen: Summe über beliebige Tage in O(1), auch bei vielen Jahren Historie.
  const n = days(first, t) + 1, pre = [0];
  for (let i = 0, d = first; i < n; i++, d = addDays(d, 1)) pre.push(pre[i] + (loads[d] || 0));
  const sum = (end, len) => pre[end + 1] - pre[Math.max(0, end + 1 - len)];
  const block = []; // Wochenschnitt der 4 Wochen bis Tag i
  for (let i = 0; i < n; i++) block.push(i >= 27 ? sum(i, 28) / 4 : null);
  const at = (i) => {
    const win = Math.min(windowDays, i + 1);
    const chronic = (sum(i, win) / win) * 7;
    let capacity = 0;
    // Ohne die aktuelle Woche, sonst würde ein Sprung sich selbst als „vertragen“ bestätigen.
    for (let k = i - 7; k >= i - win + 27; k -= 7) if (block[k] > capacity) capacity = block[k];
    const acute = sum(i, 7);
    return { day: addDays(first, i), acute, chronic, capacity, ratio: chronic ? acute / chronic : null };
  };
  const now = at(n - 1);
  const weeks = [];
  const from = Math.max(0, n - Math.max(windowDays, 84));
  for (let i = n - 1; i >= from; i -= 7) weeks.unshift(at(i));
  return { now, weeks, status: status(now.ratio), headroom: Math.round(now.capacity - now.acute) };
}

// Einordnung des Verhältnisses akut/chronisch (Gabbett 2016). Die Grenzen sind umstritten (Impellizzeri 2020) –
// als grobe Orientierung, nicht als Verletzungsprognose.
export function status(ratio) {
  if (ratio == null) return { label: 'zu wenig Daten', tone: 'muted' };
  if (ratio < 0.8) return { label: 'unter deinem Schnitt', tone: 'muted' };
  if (ratio <= 1.3) return { label: 'im gewohnten Bereich', tone: 'good' };
  if (ratio <= 1.5) return { label: 'deutlich über Schnitt', tone: 'warn' };
  return { label: 'Belastungssprung', tone: 'bad' };
}

// Verhältnis akut/chronisch am Tag vor jedem Ausfall (Krankheit, Verletzung).
export function healthRatios(health, activities, windowDays = 365) {
  return health.filter((e) => e.start).map((e) => {
    const r = tolerance(activities.filter((a) => a.date < e.start), addDays(e.start, -1), windowDays);
    return { ...e, ratio: r?.now.ratio ?? null };
  });
}
