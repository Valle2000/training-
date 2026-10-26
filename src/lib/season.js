// Saisonplanung rückwärts von den A-Rennen: Phasen, Wochenziele (3:1-Rhythmus) und Tapering.
// Tapering nach Bosquet et al. 2007: ~2 Wochen, Umfang −41–60 %, Intensität halten.
import { addDays } from './metrics.js';
import { mondayOf } from './activities.js';

export const PHASES = {
  base: { label: 'Grundlage', color: '#9fd8c3' },
  build: { label: 'Aufbau', color: '#4fb3a0' },
  specific: { label: 'Wettkampfvorbereitung', color: '#f2b630' },
  taper: { label: 'Tapering', color: '#e8743b' },
  race: { label: 'Wettkampfwoche', color: '#c73d4c' },
  recovery: { label: 'Erholung', color: '#a8b8c0' },
  transition: { label: 'Übergang', color: '#c9d4da' },
};

export const seasonStart = (t) => (t.slice(5) >= '05-01' ? `${t.slice(0, 4)}-05-01` : `${+t.slice(0, 4) - 1}-05-01`);
export const weeksUntil = (from, to) => Math.floor((Date.parse(mondayOf(to)) - Date.parse(mondayOf(from))) / (7 * 864e5));

// Wochen von start bis end mit Phase und Zielstunden. opts: {baseHours, peakHours}
export function seasonPlan(races, { start, end, baseHours = 10, peakHours = 15 }) {
  const aRaces = races.filter((r) => r.priority === 'A').map((r) => r.date).sort();
  const weeks = [];
  let buildIdx = 0;
  for (let w = mondayOf(start); w <= end; w = addDays(w, 7)) {
    const wEnd = addDays(w, 6);
    const next = aRaces.find((d) => d >= w);
    const last = [...aRaces].reverse().find((d) => d < w);
    const toNext = next != null ? weeksUntil(w, next) : null;
    const sinceLast = last != null ? weeksUntil(last, w) : null;
    let phase;
    if (toNext === 0) phase = 'race';
    else if (sinceLast != null && sinceLast <= 1 && (toNext == null || toNext > 2)) phase = 'recovery';
    else if (toNext != null && toNext <= 2) phase = 'taper';
    else if (toNext != null && toNext <= 8) phase = 'specific';
    else if (toNext != null && toNext <= 20) phase = 'build';
    else if (toNext == null && sinceLast != null) phase = 'transition';
    else phase = 'base';
    // 3:1-Rhythmus: drei aufbauende Wochen, eine Entlastungswoche (~65 %).
    let target;
    if (phase === 'base' || phase === 'build') {
      const cycle = buildIdx % 4; buildIdx++;
      const total = Math.max(1, (toNext ?? 30) + buildIdx - 9);
      const ramp = baseHours + (peakHours - baseHours) * Math.min(1, buildIdx / total);
      target = cycle === 3 ? ramp * 0.65 : ramp * (0.94 + cycle * 0.03);
    } else if (phase === 'specific') target = (toNext % 4 === 0 ? 0.7 : 0.9) * peakHours;
    else if (phase === 'taper') target = (toNext === 2 ? 0.75 : 0.55) * peakHours;
    else if (phase === 'race') target = 0.45 * peakHours;
    else if (phase === 'recovery') target = 0.5 * peakHours;
    else target = 0.4 * peakHours;
    const raceIn = races.filter((r) => r.date >= w && r.date <= wEnd);
    weeks.push({ from: w, to: wEnd, phase, targetHours: Math.round(target * 10) / 10, races: raceIn });
  }
  return weeks;
}

// Rückstand auf den Sieger in % aus Zeiten (Sekunden).
export const gapPct = (timeS, winnerS) => (timeS && winnerS ? Math.round(((timeS - winnerS) / winnerS) * 1000) / 10 : null);

// Zeit "h:mm:ss" oder "mm:ss" → Sekunden.
export function parseTime(s) {
  if (!s) return null;
  const p = String(s).trim().replace(',', '.').split(':').map(Number);
  if (p.some(isNaN)) return null;
  return p.reduce((a, v) => a * 60 + v, 0);
}
export const fmtTime = (s) => { if (s == null) return '–'; const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = Math.round(s % 60); return `${h ? h + ':' : ''}${String(m).padStart(h ? 2 : 1, '0')}:${String(x).padStart(2, '0')}`; };
