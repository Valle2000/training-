// Tagesampel aus Morgen-Check, HRV-Trend, Ruhepuls und Form. Orientierung, keine Diagnose.

export const SYMPTOMS = [
  ['throat', 'Halsschmerzen', 'above'], ['nose', 'Schnupfen', 'above'], ['headache', 'Kopfschmerzen', 'above'],
  ['cough', 'Husten / Brust', 'below'], ['fever', 'Fieber / Gliederschmerzen', 'below'], ['stomach', 'Magen-Darm', 'below'],
];

import { addDays } from './metrics.js';

const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
const sd = (a) => { const m = mean(a); return a.length > 2 ? Math.sqrt(mean(a.map((x) => (x - m) ** 2))) : null; };

// HRV mit persönlichem Normalbereich (Plews et al. 2012/2013, Buchheit 2014): ln(rMSSD) glätten (7-Tage-Schnitt)
// und gegen den eigenen Normalbereich der letzten 60 Tage vergleichen (Mittel ± 0,5 SD = kleinste relevante Änderung).
// Einzelne schlechte Nächte lösen so keinen Alarm aus, ein anhaltender Abfall schon.
const hrvOf = (w) => w.hrv ?? w.hrvManual ?? null;
export function hrvStatus(date, wellness) {
  const ln = (from, to) => wellness.filter((w) => w.date >= from && w.date <= to && hrvOf(w) > 0).map((w) => Math.log(hrvOf(w)));
  const base = ln(addDays(date, -60), addDays(date, -1)), week = ln(addDays(date, -6), date);
  if (base.length < 14 || week.length < 3) return null;
  const m = mean(base), sdv = sd(base), swc = 0.5 * sdv, avg = mean(week);
  const cv = (sd(week) ?? 0) / mean(week) * 100;
  // Erst „niedrig“, wenn auch mindestens 3 der letzten 7 Werte unter dem Bereich liegen – eine einzelne sehr
  // schlechte Nacht zieht den Schnitt sonst allein unter die Grenze.
  const below = week.filter((x) => x < m - swc).length;
  const status = avg < m - swc && below >= 3 ? 'low' : avg > m + swc ? 'high' : 'normal';
  return { avg7: Math.round(Math.exp(avg)), low: Math.round(Math.exp(m - swc)), high: Math.round(Math.exp(m + swc)), mean: Math.round(Math.exp(m)), sdLn: sdv, mLn: m, status, cv: Math.round(cv * 10) / 10, n: base.length };
}

// Belastungsmuster (Foster 1998; Gabbett 2016): Monotonie = Ø Tagesbelastung / Streuung der letzten 7 Tage (Ruhetage = 0),
// Strain = Wochenbelastung × Monotonie, Belastungssprung = letzte 7 Tage im Verhältnis zum Wochenschnitt der letzten 28 Tage.
export function loadStatus(date, activities = []) {
  const daily = {};
  for (const a of activities) if (a.date <= date && a.date > addDays(date, -120)) daily[a.date] = (daily[a.date] || 0) + (a.load || 0);
  const week = (end) => Array.from({ length: 7 }, (_, i) => daily[addDays(end, -i)] || 0);
  const stats = (end) => { const v = week(end), m = mean(v), s = Math.sqrt(mean(v.map((x) => (x - m) ** 2))); const mono = m ? Math.min(10, s ? m / s : 10) : 0; return { load: m * 7, monotony: mono, strain: m * 7 * mono }; };
  const now = stats(date);
  if (!now.load) return null;
  const past = Array.from({ length: 12 }, (_, k) => stats(addDays(date, -7 * (k + 1)))).filter((x) => x.load > 0);
  const sorted = past.map((x) => x.strain).sort((a, b) => a - b);
  const p90 = sorted.length >= 6 ? sorted[Math.floor(sorted.length * 0.9)] : null;
  const chronic = Array.from({ length: 28 }, (_, i) => daily[addDays(date, -i)] || 0).reduce((a, b) => a + b, 0) / 4;
  return {
    weekLoad: Math.round(now.load), monotony: Math.round(now.monotony * 100) / 100, strain: Math.round(now.strain),
    strainP90: p90 ? Math.round(p90) : null, strainHigh: p90 != null && now.strain > p90, acwr: chronic ? Math.round((now.load / chronic) * 100) / 100 : null,
  };
}

// wellness: [{date, hrv, restHr, feel, soreness, stress, sleepQ, symptoms:[]}], aufsteigend sortiert.
export function readinessFor(date, wellness, form = null, activities = []) {
  const today = wellness.find((w) => w.date === date) || {};
  const prev = wellness.filter((w) => w.date < date).slice(-30);
  const reasons = [];
  let score = 100, red = false;
  const add = (pts, text, isRed = false) => { score -= pts; reasons.push(text); if (isRed) red = true; };

  const sym = (today.symptoms || []).map((s) => SYMPTOMS.find((x) => x[0] === s)).filter(Boolean);
  if (sym.some((s) => s[2] === 'below')) add(60, 'Symptome unterhalb des Halses: kein Training', true);
  else if (sym.length) add(25, 'Symptome oberhalb des Halses: höchstens locker');

  // HRV: Trend (7 Tage) gegen den persönlichen Normalbereich, dazu der heutige Wert (ln) gegen die Streuung.
  const hs = hrvStatus(date, wellness);
  const hrvToday = hrvOf(today);
  const hrvs = prev.map(hrvOf).filter(Boolean);
  if (hs) {
    if (hs.status === 'low') add(15, `HRV-Trend unter deinem Normalbereich (7-Tage-Schnitt ${hs.avg7} ms, normal ${hs.low}–${hs.high} ms)`);
    if (hrvToday) {
      const z = (Math.log(hrvToday) - hs.mLn) / (hs.sdLn || 0.1);
      if (z < -2) add(hs.status === 'low' ? 20 : 15, `HRV heute deutlich unter normal (${hrvToday} ms)`, hs.status === 'low');
      else if (z < -1 && hs.status !== 'low') add(5, `HRV heute etwas niedrig (${hrvToday} ms) – Trend aber normal`);
    }
  } else if (hrvToday && hrvs.length >= 5) {
    const m = mean(hrvs), s = sd(hrvs) || m * 0.07;
    if (hrvToday < m - 2 * s) add(30, `HRV deutlich unter normal (${hrvToday} vs. Ø ${Math.round(m)} ms)`, true);
    else if (hrvToday < m - s) add(15, `HRV unter normal (${hrvToday} vs. Ø ${Math.round(m)} ms)`);
  }
  const rhs = prev.map((w) => w.restHr).filter(Boolean);
  if (today.restHr && rhs.length >= 5) {
    const m = mean(rhs);
    if (today.restHr >= m + 8) add(25, `Ruhepuls stark erhöht (+${Math.round(today.restHr - m)})`, true);
    else if (today.restHr >= m + 5) add(12, `Ruhepuls erhöht (+${Math.round(today.restHr - m)})`);
  }
  if (today.feel && today.feel <= 2) add(15, 'Fühlt sich schlecht an');
  if (today.soreness && today.soreness >= 4) add(10, 'Starker Muskelkater');
  if (today.sleepQ && today.sleepQ <= 2) add(10, 'Schlecht geschlafen');
  if (today.sleepH && today.sleepH < 6) add(10, `Wenig Schlaf (${today.sleepH} h)`);
  if (today.stress && today.stress >= 4) add(8, 'Hoher Stress');
  if (form != null && form < -30) add(15, `Hohe Ermüdung (Form ${Math.round(form)})`);
  const ls = loadStatus(addDays(date, -1), activities);
  if (ls?.monotony > 2 && ls.strainHigh) add(10, `Letzte Woche sehr eintönig und hoch belastet (Monotonie ${String(ls.monotony).replace('.', ',')}) – mehr Abwechslung leicht/hart einplanen`);
  if (ls?.acwr > 1.5) add(10, `Belastungssprung: letzte 7 Tage ${String(ls.acwr).replace('.', ',')}× so viel wie der Wochenschnitt der letzten 4 Wochen`);
  else if (form != null && form > 15) reasons.push('Frisch – guter Tag für Qualität');

  score = Math.max(0, score);
  const level = red || score < 50 ? 'rot' : score < 75 ? 'gelb' : 'gruen';
  const advice = { gruen: 'Training wie geplant.', gelb: 'Harte Einheit nur bei gutem Gefühl, sonst locker oder kürzer.', rot: 'Ruhetag oder nur sehr locker.' }[level];
  const hasData = Object.keys(today).length > 1 || form != null;
  return { level, score, reasons, advice, checked: today.feel != null, hasData };
}
