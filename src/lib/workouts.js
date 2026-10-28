// Strukturierte Workouts: Bausteine mit Dauer und Ziel, Wiederholungen, Belastungsschätzung,
// Export als FIT-Workout (Garmin, Wahoo, Polar-Import über Drittanbieter) und als ZWO (Zwift, TrainerRoad).

export const STEP_TYPES = [['warmup', 'Einlaufen'], ['work', 'Belastung'], ['rest', 'Pause'], ['cooldown', 'Auslaufen']];
// Ziele: Zone (I1–I5), Watt in % FTP, Puls in bpm oder frei.
export const ZONE_IF = { I1: 0.68, I2: 0.8, I3: 0.92, I4: 1.03, I5: 1.12 };
const ZONE_FTP = { I1: [0.55, 0.72], I2: [0.72, 0.84], I3: [0.84, 0.95], I4: [0.95, 1.08], I5: [1.08, 1.25] };
const ZONE_HRMAX = { I1: [0.55, 0.72], I2: [0.72, 0.82], I3: [0.82, 0.87], I4: [0.87, 0.92], I5: [0.92, 1] };

export const uidStep = () => Math.random().toString(36).slice(2, 9);
export const step = (type, min, target = { kind: 'zone', zone: 'I1' }, label = '') => ({ id: uidStep(), type, durationS: Math.round(min * 60), target, label });
export const repeat = (n, steps) => ({ id: uidStep(), type: 'repeat', repeat: n, steps });

export const TEMPLATES = [
  { name: 'Double Threshold AM: 5×6 min', sport: 'rollerski_skate', description: 'Schwelle, Laktat 2–3 mmol/l, kontrolliert', steps: [step('warmup', 20, { kind: 'zone', zone: 'I1' }), repeat(5, [step('work', 6, { kind: 'zone', zone: 'I3' }), step('rest', 1, { kind: 'open' })]), step('cooldown', 15, { kind: 'zone', zone: 'I1' })] },
  { name: 'Double Threshold PM: 10×3 min', sport: 'run', description: 'Schwelle, kurze Pausen, Laktat 2–3,5 mmol/l', steps: [step('warmup', 15), repeat(10, [step('work', 3, { kind: 'zone', zone: 'I3' }), step('rest', 1, { kind: 'open' })]), step('cooldown', 10)] },
  { name: 'Schwelle lang: 4×8 min', sport: 'bike', description: '4×8 min bei 88–95 % FTP', steps: [step('warmup', 20, { kind: 'power', low: 55, high: 70 }), repeat(4, [step('work', 8, { kind: 'power', low: 88, high: 95 }), step('rest', 2, { kind: 'power', low: 45, high: 55 })]), step('cooldown', 15, { kind: 'power', low: 50, high: 65 })] },
  { name: 'VO2max: 5×4 min', sport: 'bike', description: 'Hart, 106–115 % FTP', steps: [step('warmup', 20, { kind: 'power', low: 55, high: 70 }), repeat(5, [step('work', 4, { kind: 'power', low: 106, high: 115 }), step('rest', 3, { kind: 'power', low: 45, high: 55 })]), step('cooldown', 15, { kind: 'power', low: 50, high: 65 })] },
  { name: 'SkiErg Schwelle: 3×10 min', sport: 'skierg', description: 'Doppelstock am SkiErg', steps: [step('warmup', 12), repeat(3, [step('work', 10, { kind: 'zone', zone: 'I3' }), step('rest', 2, { kind: 'open' })]), step('cooldown', 10)] },
  { name: 'Sprints: 8×12 s', sport: 'rollerski_skate', description: 'Maximal, volle Erholung – Schnelligkeit', steps: [step('warmup', 25), repeat(8, [step('work', 0.2, { kind: 'zone', zone: 'I5' }, 'maximal'), step('rest', 2.8, { kind: 'zone', zone: 'I1' })]), step('cooldown', 20)] },
  { name: 'Lange Grundlage 3 h', sport: 'rollerski_classic', description: 'Locker, viel Doppelstock', steps: [step('work', 180, { kind: 'zone', zone: 'I1' })] },
];

export function flatten(steps) {
  const out = [];
  for (const s of steps) {
    if (s.type === 'repeat') for (let i = 0; i < (s.repeat || 1); i++) out.push(...flatten(s.steps || []));
    else out.push(s);
  }
  return out;
}

export const durationOf = (w) => flatten(w.steps).reduce((a, s) => a + (s.durationS || 0), 0);

function intensityFactor(t, lthr) {
  if (!t || t.kind === 'open') return 0.6;
  if (t.kind === 'zone') return ZONE_IF[t.zone] ?? 0.7;
  if (t.kind === 'power') return ((Number(t.low) + Number(t.high)) / 2) / 100;
  if (t.kind === 'hr' && lthr) return ((Number(t.low) + Number(t.high)) / 2) / lthr;
  return 0.7;
}

// Geschätzte Belastung (TSS-Logik): Σ Dauer × IF² × 100.
export const workoutLoad = (w, settings = {}) => Math.round(flatten(w.steps).reduce((a, s) => a + ((s.durationS || 0) / 3600) * intensityFactor(s.target, Number(settings.lthr)) ** 2 * 100, 0));

// Hauptzone für den Kalender: Zone der längsten Belastungsstufe (ohne Ein-/Auslaufen).
export function mainZone(w) {
  const work = flatten(w.steps).filter((s) => s.type === 'work');
  const best = work.sort((a, b) => intensityFactor(b.target) - intensityFactor(a.target))[0];
  if (!best) return 'I1';
  const f = intensityFactor(best.target);
  return f >= 1.06 ? 'I5' : f >= 0.97 ? 'I4' : f >= 0.86 ? 'I3' : f >= 0.75 ? 'I2' : 'I1';
}

const targetText = (t) => (!t || t.kind === 'open' ? 'frei' : t.kind === 'zone' ? t.zone : t.kind === 'power' ? `${t.low}–${t.high} % FTP` : `${t.low}–${t.high} bpm`);
export function describe(steps, indent = '') {
  return steps.map((s) => (s.type === 'repeat'
    ? `${indent}${s.repeat}× (\n${describe(s.steps, indent + '  ')}\n${indent})`
    : `${indent}${Math.round(s.durationS / 60 * 10) / 10} min ${STEP_TYPES.find((x) => x[0] === s.type)?.[1]} ${targetText(s.target)}${s.label ? ' – ' + s.label : ''}`)).join('\n');
}

// Absolute Zielbereiche für Geräte: Watt aus FTP, Puls aus Laktat-Zonen oder % HFmax.
export function absoluteTarget(t, { ftp, hrMax, zoneHr }, preferPower) {
  if (!t || t.kind === 'open') return { kind: 'open' };
  if (t.kind === 'power' && ftp) return { kind: 'power', low: Math.round(ftp * t.low / 100), high: Math.round(ftp * t.high / 100) };
  if (t.kind === 'hr') return { kind: 'hr', low: Number(t.low), high: Number(t.high) };
  if (t.kind === 'zone') {
    if (preferPower && ftp) { const [a, b] = ZONE_FTP[t.zone]; return { kind: 'power', low: Math.round(ftp * a), high: Math.round(ftp * b) }; }
    if (zoneHr?.every(Boolean)) { const i = ['I1', 'I2', 'I3', 'I4', 'I5'].indexOf(t.zone); const lo = i === 0 ? Math.round(hrMax * 0.55) : zoneHr[i - 1], hi = i === 4 ? hrMax : zoneHr[i]; return { kind: 'hr', low: Math.round(lo), high: Math.round(hi) }; }
    if (hrMax) { const [a, b] = ZONE_HRMAX[t.zone]; return { kind: 'hr', low: Math.round(hrMax * a), high: Math.round(hrMax * b) }; }
  }
  return { kind: 'open' };
}

const FIT_SPORT = { bike: 'cycling', run: 'running', hike: 'hiking', row: 'rowing', skierg: 'crossCountrySkiing', xc_skate: 'crossCountrySkiing', xc_classic: 'crossCountrySkiing', rollerski_skate: 'crossCountrySkiing', rollerski_classic: 'crossCountrySkiing', rollerski: 'crossCountrySkiing', swim: 'swimming' };
const FIT_INTENSITY = { warmup: 'warmup', work: 'active', rest: 'rest', cooldown: 'cooldown' };

// FIT-Workout-Datei. Wiederholungen als „repeat until steps complete“; Watt-Ziele +1000, Puls +100 (FIT-Konvention).
export async function toFit(w, opts) {
  const { Encoder, Profile } = await import('@garmin/fitsdk');
  const enc = new Encoder();
  const steps = [];
  const walk = (list) => {
    for (const s of list) {
      if (s.type === 'repeat') {
        const from = steps.length;
        walk(s.steps || []);
        steps.push({ wktStepName: `${s.repeat}×`, durationType: 'repeatUntilStepsCmplt', durationValue: from, targetType: 'open', targetValue: s.repeat });
      } else {
        const t = absoluteTarget(s.target, opts, ['bike', 'skierg', 'row'].includes(w.sport));
        const m = { wktStepName: (s.label || STEP_TYPES.find((x) => x[0] === s.type)?.[1] || '').slice(0, 15), durationType: 'time', durationValue: Math.round(s.durationS * 1000), intensity: FIT_INTENSITY[s.type] || 'active' };
        if (t.kind === 'power') Object.assign(m, { targetType: 'power', targetValue: 0, customTargetValueLow: t.low + 1000, customTargetValueHigh: t.high + 1000 });
        else if (t.kind === 'hr') Object.assign(m, { targetType: 'heartRate', targetValue: 0, customTargetValueLow: t.low + 100, customTargetValueHigh: t.high + 100 });
        else Object.assign(m, { targetType: 'open' });
        steps.push(m);
      }
    }
  };
  walk(w.steps);
  enc.onMesg(Profile.MesgNum.FILE_ID, { type: 'workout', manufacturer: 'development', product: 0, timeCreated: new Date(), serialNumber: 1 });
  enc.onMesg(Profile.MesgNum.WORKOUT, { wktName: w.name.slice(0, 40), sport: FIT_SPORT[w.sport] || 'generic', numValidSteps: steps.length });
  steps.forEach((m, i) => enc.onMesg(Profile.MesgNum.WORKOUT_STEP, { messageIndex: i, ...m }));
  return enc.close();
}

// ZWO für Zwift/TrainerRoad (nur Rad, Leistung als Anteil der FTP).
export function toZwo(w) {
  const pct = (t) => (t?.kind === 'power' ? [t.low / 100, t.high / 100] : t?.kind === 'zone' ? ZONE_FTP[t.zone] : [0.55, 0.6]);
  const esc = (s) => String(s).replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));
  const lines = flatten(w.steps).map((s) => {
    const [lo, hi] = pct(s.target);
    if (s.type === 'warmup') return `    <Warmup Duration="${s.durationS}" PowerLow="${lo.toFixed(2)}" PowerHigh="${hi.toFixed(2)}"/>`;
    if (s.type === 'cooldown') return `    <Cooldown Duration="${s.durationS}" PowerLow="${hi.toFixed(2)}" PowerHigh="${lo.toFixed(2)}"/>`;
    return `    <SteadyState Duration="${s.durationS}" Power="${((lo + hi) / 2).toFixed(2)}"/>`;
  });
  return `<workout_file>\n  <author>Training</author>\n  <name>${esc(w.name)}</name>\n  <description>${esc(w.description || '')}</description>\n  <sportType>bike</sportType>\n  <workout>\n${lines.join('\n')}\n  </workout>\n</workout_file>\n`;
}
