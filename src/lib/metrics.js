// Belastung und Form. Eigene Namen statt der TrainingPeaks-Marken:
// Belastung ≈ TSS (1 h an der Schwelle = 100), Fitness ≈ CTL (42 Tage), Ermüdung ≈ ATL (7 Tage), Form ≈ TSB.
export const FITNESS_DAYS = 42;
export const FATIGUE_DAYS = 7;

// Intensitätszonen nach Olympiatoppen (Norwegen), in % der maximalen Herzfrequenz.
// I1/I2 locker, I3 Schwelle (Double Threshold liegt hier, ~2–3 mmol Laktat), I4/I5 hart.
export const ZONES = [
  { id: 'I1', label: 'I1 locker', from: 0.55, to: 0.72 },
  { id: 'I2', label: 'I2 mittel', from: 0.72, to: 0.82 },
  { id: 'I3', label: 'I3 Schwelle', from: 0.82, to: 0.87 },
  { id: 'I4', label: 'I4 hart', from: 0.87, to: 0.92 },
  { id: 'I5', label: 'I5 sehr hart', from: 0.92, to: 1.01 },
];

export function zoneOf(hr, hrMax) {
  if (!hr || !hrMax) return null;
  const p = hr / hrMax;
  if (p < ZONES[0].from) return null; // unter I1: Pause/Erholung
  return ZONES.find((z) => p < z.to)?.id ?? 'I5';
}

// Sekunden je Zone aus einem 1-Hz-Pulsverlauf.
export function zoneSeconds(hr, hrMax) {
  const out = { I1: 0, I2: 0, I3: 0, I4: 0, I5: 0 };
  if (!hrMax) return out;
  for (const h of hr) { const z = zoneOf(h, hrMax); if (z) out[z]++; }
  return out;
}

// NP aus 1-Hz-Leistung: 4. Wurzel des Mittels der 30-s-Gleitmittel hoch 4.
export function normalizedPower(power, window = 30) {
  const v = power.map((p) => p || 0);
  if (v.length < window) return null;
  let acc = v.slice(0, window).reduce((a, b) => a + b, 0);
  let sum4 = (acc / window) ** 4, n = 1;
  for (let i = window; i < v.length; i++) { acc += v[i] - v[i - window]; sum4 += (acc / window) ** 4; n++; }
  return (sum4 / n) ** 0.25;
}

export const powerLoad = (durationS, np, ftp) => (durationS * np * (np / ftp)) / (ftp * 3600) * 100;

const trimpFactor = (ratio, sex) => { const [a, b] = sex === 'f' ? [0.86, 1.67] : [0.64, 1.92]; return ratio * a * Math.exp(b * ratio); };

// Banister-TRIMP aus Pulswerten im festen Zeitraster (Standard 1 s).
export function trimp(hr, athlete, dtS = 1) {
  const { hrMax, hrRest, sex } = athlete;
  if (!hrMax || !hrRest || hrMax <= hrRest) return null;
  let total = 0, seen = false;
  for (const h of hr) {
    if (!h) continue;
    seen = true;
    const ratio = Math.min(Math.max((h - hrRest) / (hrMax - hrRest), 0), 1);
    total += trimpFactor(ratio, sex) * dtS / 60;
  }
  return seen ? total : null;
}

// TRIMP so skalieren, dass 1 h an der Laktatschwelle 100 ergibt.
export function hrLoadFromTrimp(t, athlete) {
  const { lthr, hrMax, hrRest, sex } = athlete;
  if (t == null || !lthr || !hrMax || !hrRest) return null;
  const ratio = Math.min(Math.max((lthr - hrRest) / (hrMax - hrRest), 0), 1);
  const hour = trimpFactor(ratio, sex) * 60;
  return hour > 0 ? (t / hour) * 100 : null;
}

// Subjektive Belastung (RPE 1–10). Ausdauer: RPE 7,5 ≈ Schwelle → 100/h.
// Kraft belastet das Herz-Kreislauf-System weniger: RPE 10 → 100/h.
export function rpeLoad(durationS, rpe, kind = 'endurance') {
  if (!durationS || !rpe) return null;
  const ref = kind === 'strength' ? 10 : 7.5;
  return (durationS / 3600) * (rpe / ref) ** 2 * 100;
}

// Beste verfügbare Methode: Leistung > Pulsverlauf > Durchschnittspuls > RPE.
export function computeLoad(athlete, { durationS, power, hr, avgHr, rpe, kind, powerSport = true }) {
  const np = power?.some(Boolean) ? normalizedPower(power) : null;
  const t = hr?.some(Boolean) ? trimp(hr, athlete) : null;
  if (np && athlete.ftp && powerSport) return { load: powerLoad(durationS, np, athlete.ftp), source: 'power', np, intensity: np / athlete.ftp, trimp: t };
  const fromHr = hrLoadFromTrimp(t, athlete);
  if (fromHr != null) return { load: fromHr, source: 'hr', np, trimp: t };
  if (avgHr && durationS) {
    const ta = trimp([avgHr], athlete, durationS);
    const l = hrLoadFromTrimp(ta, athlete);
    if (l != null) return { load: l, source: 'hr_avg', np, trimp: ta };
  }
  const r = rpeLoad(durationS, rpe, kind);
  if (r != null) return { load: r, source: 'rpe', np };
  return { load: null, source: null, np };
}

const addDays = (iso, n) => { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
export { addDays };

// Tagesverlauf von Fitness, Ermüdung und Form. dailyLoad: {'YYYY-MM-DD': Belastung}.
// planned (optional) fließt nur für Tage nach "today" ein → Prognose.
export function performanceCurve(dailyLoad, start, end, { planned = {}, today = null } = {}) {
  let fitness = 0, fatigue = 0;
  const out = [];
  for (let day = start; day <= end; day = addDays(day, 1)) {
    const future = today && day > today;
    const load = future ? (planned[day] || 0) : (dailyLoad[day] || 0);
    const form = fitness - fatigue;
    fitness += (load - fitness) / FITNESS_DAYS;
    fatigue += (load - fatigue) / FATIGUE_DAYS;
    out.push({ day, load, fitness, fatigue, form, future: !!future });
  }
  return out;
}
