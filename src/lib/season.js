// Saisonplanung rückwärts von den A-Rennen: Phasen, Wochenziele (3:1-Rhythmus) und Tapering;
// B-Rennen mit Mini-Tapering, C-Rennen als Trainingsreiz.
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
// style: 'steady' = kleine Schwankungen (Entlastung ~80 %), 'varied' = ausgeprägte Wellen (große Woche, Entlastung ~60 %).
export function seasonPlan(races, { start, end, baseHours = 10, peakHours = 15, style = 'standard' }) {
  const WAVE = { steady: [0.97, 0.99, 1.01, 0.8], varied: [0.88, 0.98, 1.1, 0.6], standard: [0.94, 0.97, 1, 0.65] }[style] || [0.94, 0.97, 1, 0.65];
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
      target = ramp * WAVE[cycle];
    } else if (phase === 'specific') target = (toNext % 4 === 0 ? 0.7 : 0.9) * peakHours;
    else if (phase === 'taper') target = (toNext === 2 ? 0.75 : 0.55) * peakHours;
    else if (phase === 'race') target = 0.45 * peakHours;
    else if (phase === 'recovery') target = 0.5 * peakHours;
    else target = 0.4 * peakHours;
    const raceIn = races.filter((r) => r.date >= w && r.date <= wEnd);
    // B-Rennen: kleines Tapering (Woche ca. −15 %), C-Rennen laufen als harte Einheit ohne Tapering.
    const mini = raceIn.some((r) => r.priority === 'B') && !['race', 'taper', 'recovery'].includes(phase);
    if (mini) target *= 0.85;
    weeks.push({ from: w, to: wEnd, phase, targetHours: Math.round(target * 10) / 10, races: raceIn, mini });
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

// Was die Prioritäten bedeuten (für Rennen-Liste und Saisonplan-Assistent).
export const PRIORITY_INFO = {
  A: 'Saisonhöhepunkt: Phasen werden rückwärts davon geplant, 2 Wochen Tapering (Umfang −40–60 %, Intensität bleibt), danach Erholung. Höchstens 2–3 pro Saison.',
  B: 'Wichtiges Rennen: kleines Tapering (Woche ca. −15 %, 2 Tage vorher keine harte Einheit, Vorbelastung am Vortag), danach ein lockerer Tag. Ersetzt eine harte Einheit.',
  C: 'Trainingsrennen: zählt als harte Einheit der Woche, kein Tapering – gut, um Renntempo, Verpflegung und Material zu testen.',
};

// Hinweise zur Rennplanung einer Saison: Abstände der Höhepunkte, Anzahl, fehlende A-Rennen, Häufung harter Rennen.
export function raceAdvice(races, t) {
  const up = races.filter((r) => r.date >= t).sort((a, b) => a.date.localeCompare(b.date));
  const out = [];
  if (!up.length) return out;
  const a = up.filter((r) => r.priority === 'A');
  if (!a.length) out.push({ level: 'info', text: 'Kein A-Rennen eingetragen: Der Plan bleibt im Aufbau ohne Höhepunkt. Markiere 1–3 Saisonhöhepunkte als A, dann plant der Assistent Wettkampfvorbereitung und Tapering rückwärts davon.' });
  const seasonA = a.filter((r) => seasonStart(r.date) === seasonStart(a[0]?.date || t));
  if (seasonA.length > 3) out.push({ level: 'gelb', text: `${seasonA.length} A-Rennen in einer Saison: Jeder Höhepunkt kostet Tapering und Erholung. 2–3 echte Höhepunkte sind realistisch – stufe die übrigen zu B herunter.` });
  for (let i = 1; i < a.length; i++) {
    const wks = weeksUntil(a[i - 1].date, a[i].date);
    if (wks > 0 && wks < 4) out.push({ level: 'gelb', text: `${a[i - 1].name} und ${a[i].name} liegen nur ${wks} Woche(n) auseinander. Plane sie als einen Wettkampfblock (das spätere als A, das frühere als B) – zweimal volles Tapering kostet zu viel Training.` });
    else if (wks >= 4 && wks < 7) out.push({ level: 'info', text: `${a[i - 1].name} → ${a[i].name}: ${wks} Wochen dazwischen – genug für Erholung, kurze Wettkampfvorbereitung und erneutes Tapering, aber kein neuer Aufbau.` });
  }
  // Viele Rennen kurz hintereinander (B/C zusätzlich zu harten Einheiten).
  for (let i = 0; i < up.length; i++) {
    const inTwo = up.filter((r) => r.date >= up[i].date && r.date <= addDays(up[i].date, 13));
    if (inTwo.length >= 4) { out.push({ level: 'info', text: `${inTwo.length} Rennen innerhalb von 2 Wochen ab ${up[i].name}: Zwischen den Rennen kaum zusätzliche harte Einheiten, Fokus auf Erholung, Essen und Schlaf.` }); break; }
  }
  const nextA = a[0];
  if (nextA) {
    const wks = weeksUntil(t, nextA.date);
    if (wks < 3) out.push({ level: 'info', text: `${nextA.name} in ${wks} Woche(n): Jetzt Tapering – Umfang runter, Intensität kurz und knackig halten, kein neues Training ausprobieren.` });
    else if (wks <= 8) out.push({ level: 'info', text: `${nextA.name} in ${wks} Wochen: Wettkampfvorbereitung – mehr Renntempo und spezifische Technik, B-/C-Rennen als Formtest nutzen.` });
  }
  return out;
}
