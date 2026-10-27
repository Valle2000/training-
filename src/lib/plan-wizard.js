// Saisonplan-Assistent: studienbasierte Trainingsansätze → konkrete Wochen mit Einheiten im Kalender.
// Phasen und Wochenstunden kommen aus seasonPlan (rückwärts von den A-Rennen, 3:1-Rhythmus, Tapering).
import { addDays } from './metrics.js';
import { mondayOf, estimatePlanLoad } from './activities.js';
import { seasonPlan } from './season.js';

export const PLAN_SOURCES = {
  casado23: { text: 'Casado et al. 2023 – Das norwegische Modell / Double Threshold (Review)', url: 'https://pubmed.ncbi.nlm.nih.gov/?term=Casado+Foster+Bakken+Tjelta+Norwegian+method' },
  seiler10: { text: 'Seiler 2010 – Best practice for training intensity and duration distribution (IJSPP)', url: 'https://pubmed.ncbi.nlm.nih.gov/20861519/' },
  stoggl14: { text: 'Stöggl & Sperlich 2014 – Polarisiertes Training (Front Physiol)', url: 'https://pubmed.ncbi.nlm.nih.gov/24550842/' },
  sandbakk17: { text: 'Sandbakk & Holmberg 2017 – Physiologie und Training im Skilanglauf (IJSPP)', url: 'https://pubmed.ncbi.nlm.nih.gov/28095083/' },
  walther23: { text: 'Walther et al. 2023 – Trainingsentwicklung von Weltklasse-Langläufern (Front Physiol)', url: 'https://pubmed.ncbi.nlm.nih.gov/38054044/' },
  ronnestad14: { text: 'Rønnestad et al. 2014 – Block-Periodisierung bei Ausdauersportlern (Scand J Med Sci Sports)', url: 'https://pubmed.ncbi.nlm.nih.gov/23134196/' },
  ronnestad20: { text: 'Rønnestad et al. 2020 – Kurze Intervalle (30/15) vs. lange Intervalle (Scand J Med Sci Sports)', url: 'https://pubmed.ncbi.nlm.nih.gov/?term=R%C3%B8nnestad+short+intervals+30+15+cyclists' },
  oliveira24: { text: 'Oliveira et al. 2024 – Metaanalyse polarisiert vs. andere Verteilungen (Sports Med)', url: 'https://www.researchgate.net/publication/380425831' },
};

// Harte Einheiten je Phase: dt = Double-Threshold-Tag (morgens + abends Schwelle), threshold, hit, race (Wettkampftempo), opener.
export const APPROACHES = [
  {
    id: 'norwegian', name: 'Norwegisches Modell (Double Threshold)', evidence: 'gering bis mittel',
    short: 'Viel Schwelle in kontrollierten Portionen: 2 Double-Threshold-Tage (2–3 mmol/l Laktat), dazu 1 kurze harte Einheit, sonst locker.',
    detail: 'Bekannt aus dem Laufen (Bakken, Ingebrigtsen) und zunehmend im Langlauf genutzt. Die Schwelle wird bewusst unter dem Maximum gehalten (Laktat 2–3 mmol/l), dadurch sind große Mengen bei guter Erholung möglich. Braucht eine solide Grundlage (ab ca. 8–10 h/Woche) und gute Selbststeuerung (Laktat oder Puls). Studienlage: überwiegend Fallberichte und Beschreibungen, wenige kontrollierte Studien.',
    phases: { base: ['dt'], build: ['dt', 'dt', 'hit'], specific: ['dt', 'dt', 'race'], taper: ['threshold', 'race'], race: ['opener'], recovery: [], transition: [] },
    days: { hard: [2, 4, 6] }, sources: ['casado23'], defaults: ['dt_am', 'dt_pm', 'hit_hill', 'race_pace', 'speed', 'long'],
  },
  {
    id: 'pyramidal', name: 'Weltklasse-Langlauf (pyramidal, ~90 % locker)', evidence: 'mittel',
    short: 'Wie norwegische Weltklasse-Langläufer: sehr viel locker (oft Doppelstock), 1 Schwelleneinheit und 1 harte Einheit pro Woche, später Wettkampftempo.',
    detail: 'Analysen von Olympiasiegern zeigen rund 90 % lockeres Training, 3–5 % Schwelle und 4–6 % hart; gesteigert wird über Jahre vor allem der lockere und mittlere Umfang. Viele lange Einheiten, viel Rollski/Ski. Gut geeignet bei hohem Umfang (12–20 h/Woche).',
    phases: { base: ['threshold'], build: ['threshold', 'hit'], specific: ['threshold', 'hit', 'race'], taper: ['threshold', 'race'], race: ['opener'], recovery: [], transition: [] },
    days: { hard: [2, 5, 6] }, sources: ['walther23', 'sandbakk17'], defaults: ['thr_4x8', 'thr_3x20', 'hit_hill', 'hit_5x4', 'race_pace', 'speed', 'long'],
  },
  {
    id: 'polarized', name: 'Polarisiert (80/20 nach Seiler)', evidence: 'mittel',
    short: 'Locker oder richtig hart: 2 harte Intervalleinheiten (VO2max) pro Woche, kaum Schwelle, der Rest ganz locker.',
    detail: 'Rund 80 % der Einheiten locker, 20 % hart, wenig mittlere Intensität. In kurzen Studien (unter 12 Wochen) oft etwas besser als andere Verteilungen; über längere Zeit laut Metaanalyse nicht klar überlegen. Einfach umzusetzen, gut bei begrenzter Zeit (6–12 h/Woche).',
    phases: { base: ['hit'], build: ['hit', 'hit'], specific: ['hit', 'race'], taper: ['hit', 'opener'], race: ['opener'], recovery: [], transition: [] },
    days: { hard: [2, 5] }, sources: ['seiler10', 'stoggl14', 'oliveira24'], defaults: ['hit_5x4', 'hit_30_15', 'hit_hill', 'race_pace', 'speed', 'long'],
  },
  {
    id: 'block', name: 'Block-Periodisierung (Rønnestad)', evidence: 'mittel',
    short: 'Im Aufbau alle 4 Wochen ein harter Block (5 Intervalleinheiten in einer Woche), danach 3 Wochen mit je 1 harten Einheit.',
    detail: 'Bei trainierten Radsportlern und Langläufern brachte ein konzentrierter HIT-Block in Studien ähnliche oder etwas größere Verbesserungen der VO2max als gleichmäßig verteilte Intervalle. Fordernd – gute Erholung, Schlaf und Ernährung im Blockwoche nötig. Kurze Intervalle (30/15 s) waren in Studien sehr wirksam.',
    phases: { base: ['threshold'], build: 'block', specific: 'block', taper: ['hit', 'opener'], race: ['opener'], recovery: [], transition: [] },
    days: { hard: [2, 4, 6], block: [2, 3, 4, 6, 7] }, sources: ['ronnestad14', 'ronnestad20'], defaults: ['hit_30_15', 'hit_5x4', 'thr_4x8', 'race_pace', 'speed', 'long'],
  },
  {
    id: 'base', name: 'Grundlage / Wiedereinstieg', evidence: 'Praxis',
    short: 'Nur locker plus kurze Steigerungen – nach Krankheit, Pause, Verletzung oder zum Umfangsaufbau. Steigerung höchstens ca. 10 % pro Woche.',
    detail: 'Baut die aerobe Basis und die Belastbarkeit wieder auf, ohne das Risiko harter Einheiten. Nach 2–4 Wochen kannst du zu einem der anderen Ansätze wechseln.',
    phases: { base: [], build: [], specific: [], taper: [], race: ['opener'], recovery: [], transition: [] },
    days: { hard: [] }, sources: ['seiler10'], defaults: ['speed', 'long'],
  },
];

// Schlüsseleinheiten zur Auswahl. sport: 'specific' = Rollski bzw. Ski (Winter), sonst feste Sportart.
export const KEY_OPTIONS = [
  { id: 'dt_am', type: 'dt_am', name: 'Double Threshold morgens: 5×6 min', minutes: 70, zone: 'I3', sport: 'specific', desc: '20 min ein, 5×6 min Schwelle (Laktat 2–3 mmol/l), 1 min Pause, 15 min aus' },
  { id: 'dt_pm', type: 'dt_pm', name: 'Double Threshold abends: 10×3 min', minutes: 60, zone: 'I3', sport: 'run', desc: '15 min ein, 10×3 min Schwelle (Laktat 2,5–3,5 mmol/l), 1 min Pause, 10 min aus' },
  { id: 'thr_4x8', type: 'threshold', name: 'Schwelle: 4×8 min', minutes: 75, zone: 'I3', sport: 'specific', desc: '20 min ein, 4×8 min Schwelle, 2 min Pause, 15 min aus' },
  { id: 'thr_3x20', type: 'threshold', name: 'SkiErg 3×20 min', minutes: 106, zone: 'I3', sport: 'skierg', desc: '20 min ein, 3×20 min an der unteren Schwelle (2 min Pause), 20 min aus' },
  { id: 'thr_3x10', type: 'threshold', name: 'SkiErg Schwelle: 3×10 min', minutes: 56, zone: 'I3', sport: 'skierg', desc: '12 min ein, 3×10 min Schwelle, 2 min Pause, 10 min aus' },
  { id: 'hit_5x4', type: 'hit', name: 'VO2max: 5×4 min', minutes: 70, zone: 'I4', sport: 'specific', desc: '20 min ein, 5×4 min hart (I4), 3 min Pause, 15 min aus' },
  { id: 'hit_hill', type: 'hit', name: 'Bergintervalle Skigang: 6×5 min', minutes: 80, zone: 'I4', sport: 'hike', desc: '20 min ein, 6×5 min Skigang mit Stöcken bergauf (I4), locker zurück, 15 min aus' },
  { id: 'hit_30_15', type: 'hit', name: 'Kurze Intervalle: 3×(13×30/15 s)', minutes: 60, zone: 'I5', sport: 'bike', desc: '15 min ein, 3 Serien à 13× 30 s hart / 15 s locker, 3 min Serienpause, 10 min aus (Rønnestad)' },
  { id: 'race_pace', type: 'race', name: 'Wettkampftempo: 4×6 min', minutes: 70, zone: 'I4', sport: 'specific', desc: '20 min ein, 4×6 min im geplanten Renntempo, 3 min Pause, 15 min aus' },
  { id: 'opener', type: 'opener', name: 'Vorbelastung: 30 min + 4×1 min + Sprints', minutes: 45, zone: 'I2', sport: 'specific', desc: '30 min locker, 4×1 min zügig, 3 kurze Sprints – 1–2 Tage vor dem Rennen' },
  { id: 'speed', type: 'speed', name: 'Steigerungen/Sprints in einer lockeren Einheit', minutes: 0, zone: 'I1', sport: 'specific', desc: 'In einer lockeren Einheit 6–8× 10–15 s Sprint, volle Pause – Technik und Schnelligkeit' },
  { id: 'long', type: 'long', name: 'Lange Einheit am Wochenende', minutes: 0, zone: 'I1', sport: 'specific', desc: 'Lang und locker, gern mit viel Doppelstock; Verpflegung üben' },
  { id: 'strength', type: 'strength', name: 'Krafttraining', minutes: 60, zone: 'Kraft', sport: 'strength', desc: 'Kraft-Vorlage A/B oder JOE (Doppelstock-Fokus)' },
];
export const optionById = (id) => KEY_OPTIONS.find((o) => o.id === id);

// Rollski im Sommer, Ski im Winter (Dez–März).
const winter = (date) => [12, 1, 2, 3].includes(Number(date.slice(5, 7)));
const specificSport = (date, i) => (winter(date) ? (i % 2 ? 'xc_classic' : 'xc_skate') : (i % 2 ? 'rollerski_classic' : 'rollerski_skate'));
const SPECIFIC_SHARE = { base: 0.5, build: 0.6, specific: 0.75, taper: 0.75, race: 0.8, recovery: 0.4, transition: 0.3 };
const OTHER = ['run', 'bike'];

// Optionen: approach, startHours, peakHours, start, end, restDays ([1] = Montag), longDay (7 = Sonntag), doubles, strengthPerWeek, keys (IDs)
export function generatePlan(opts, races = []) {
  const ap = APPROACHES.find((a) => a.id === opts.approach) || APPROACHES[0];
  const keys = new Set(opts.keys?.length ? opts.keys : ap.defaults);
  const weeks = seasonPlan(races, { start: opts.start, end: opts.end, baseHours: Number(opts.startHours) || 10, peakHours: Number(opts.peakHours) || 14 });
  // Wiedereinstieg: höchstens +10 % pro Woche, alle 4 Wochen leichter.
  if (ap.id === 'base') weeks.forEach((w, i) => { w.targetHours = Math.round(Math.min(Number(opts.peakHours) || 14, (Number(opts.startHours) || 8) * 1.1 ** i) * (i % 4 === 3 ? 0.75 : 1) * 10) / 10; });
  const pickByType = (type, k) => { const list = KEY_OPTIONS.filter((o) => o.type === type && keys.has(o.id)); return list.length ? list[k % list.length] : null; };
  let rot = 0, buildIdx = 0;
  return weeks.map((w) => {
    let hardSlots = ap.phases[w.phase] ?? [];
    let hardDays = ap.days.hard;
    if (hardSlots === 'block') {
      const blockWeek = buildIdx % 4 === 0; buildIdx++;
      hardSlots = blockWeek ? ['hit', 'hit', 'hit', 'hit', 'hit'] : w.phase === 'specific' ? ['threshold', 'race'] : ['threshold', 'hit'];
      if (blockWeek) { hardDays = ap.days.block; w.targetHours = Math.round(w.targetHours * 0.85 * 10) / 10; w.block = true; }
    }
    const rest = new Set(opts.restDays || [1]), longDay = Number(opts.longDay) || 7;
    const days = Array.from({ length: 7 }, (_, i) => ({ dow: i + 1, date: addDays(w.from, i), sessions: [] }));
    const free = (dow) => !rest.has(dow) && dow !== longDay;
    const total = w.targetHours * 60;
    let used = 0;
    const put = (day, s) => { day.sessions.push(s); used += s.minutes; };
    // 1) Harte Einheiten auf die Wunschtage (Ruhetag und langer Tag ausgenommen, sonst nächster freier Tag).
    const hardUsed = new Set();
    hardSlots.forEach((slot, k) => {
      let dow = hardDays[k] ?? hardDays[hardDays.length - 1] ?? 3;
      for (let tries = 0; tries < 7 && (!free(dow) || hardUsed.has(dow)); tries++) dow = (dow % 7) + 1;
      hardUsed.add(dow);
      const day = days[dow - 1];
      if (slot === 'dt') {
        const am = pickByType('dt_am', rot) || pickByType('threshold', rot), pm = pickByType('dt_pm', rot) || pickByType('threshold', rot + 1);
        if (am) put(day, session(am, day.date, rot++, 'vormittags'));
        if (pm && opts.doubles !== false) put(day, session(pm, day.date, rot++, 'nachmittags'));
      } else if (slot === 'opener') {
        const race = (w.races || [])[0];
        const d = race ? days.find((x) => x.date === addDays(race.date, -1)) || day : day;
        put(d, session(optionById('opener'), d.date, rot++));
      } else {
        const o = pickByType(slot, rot) || pickByType(slot === 'race' ? 'hit' : slot === 'hit' ? 'threshold' : 'hit', rot);
        if (o) put(day, session(o, day.date, rot++));
      }
    });
    // Rennen der Woche als Einheit eintragen (Dauer grob nach Distanz).
    for (const r of w.races || []) { const d = days.find((x) => x.date === r.date); if (d) put(d, { title: `Rennen: ${r.name}`, sport: winter(r.date) ? 'xc_skate' : 'rollerski_skate', minutes: Math.round((Number(r.distanceKm) || 15) * 3.2 + 40), zone: 'I4', description: 'Inkl. Ein- und Auslaufen', kind: 'race' }); }
    // 2) Lange Einheit (ca. 22 % der Woche, 1,5–3,5 h), nicht in Renn-/Taperwochen mit Rennen am Wochenende.
    const raceOnLong = (w.races || []).some((r) => days[longDay - 1]?.date === r.date);
    if (keys.has('long') && !raceOnLong && !['race', 'recovery'].includes(w.phase)) {
      const min = Math.round(Math.min(210, Math.max(90, total * 0.22)) / 15) * 15;
      put(days[longDay - 1], { title: 'Lange Grundlage', sport: specificSport(w.from, 1), minutes: min, zone: 'I1', description: 'Locker, viel Doppelstock, Verpflegung üben (60 g KH/h)', kind: 'long' });
    }
    // 3) Kraft auf Tage ohne harte Einheit.
    // Kraft: Vorbereitung wie gewählt, ab Wettkampfvorbereitung und in Erholungswochen höchstens 1× (Erhalt).
    const strengthN = ['base', 'build'].includes(w.phase) ? opts.strengthPerWeek ?? 2 : Math.min(1, opts.strengthPerWeek ?? 2);
    const strengthDays = days.filter((d) => !rest.has(d.dow) && d.dow !== longDay && !d.sessions.length);
    for (let i = 0; i < strengthN && i < strengthDays.length; i++) {
      const d = strengthDays[Math.round((i * (strengthDays.length - 1)) / Math.max(1, strengthN - 1))] || strengthDays[i];
      put(d, { title: ['Kraft A – Beine schwer + Zug', 'Kraft B – Hüfte, einbeinig + Doppelstock', 'Kraft JOE – Doppelstock-Fokus'][i % 3], sport: 'strength', minutes: 60, zone: 'Kraft', description: 'Vorlage im Tab „Kraft“', kind: 'strength' });
    }
    // 4) Rest mit lockeren Einheiten füllen (45–150 min, höchstens 2 Einheiten pro Tag).
    let easy = Math.max(0, total - used);
    // Freie Plätze: erst jeder Tag einmal, dann (bei Doppeltagen) ein zweites Mal – höchstens 2 Einheiten pro Tag.
    const maxPerDay = opts.doubles === false ? 1 : 2;
    const cap = (d) => (rest.has(d.dow) || d.dow === longDay ? 0 : maxPerDay - d.sessions.length);
    const slots = [];
    for (const d of days) if (cap(d) >= 1 && !d.sessions.some((s) => s.kind === 'hard')) slots.push(d);
    for (const d of days) if (cap(d) >= (slots.includes(d) ? 2 : 1)) slots.push(d);
    if (!slots.length) slots.push(...days.filter((d) => !rest.has(d.dow) && d.dow !== longDay));
    let n = Math.max(0, Math.min(slots.length, Math.round(easy / 80)));
    if (n === 0 && easy >= 30) n = 1;
    let speedDone = !(keys.has('speed') && ['base', 'build', 'specific'].includes(w.phase));
    const share = SPECIFIC_SHARE[w.phase] ?? 0.5;
    for (let i = 0; i < n; i++) {
      const d = slots[i];
      const min = Math.round(Math.min(150, Math.max(40, easy / (n - i))) / 5) * 5;
      if (min < 30) break;
      const specific = (i / Math.max(1, n)) < share;
      const s = { title: 'Locker', sport: specific ? specificSport(d.date, i) : OTHER[i % 2], minutes: min, zone: 'I1', description: 'Grundlage I1, wirklich locker', kind: 'easy' };
      if (!speedDone && specific) { s.title = 'Locker + Sprints'; s.description = 'Grundlage I1, gegen Ende 6–8× 10–15 s Sprint mit voller Pause'; speedDone = true; }
      put(d, s); easy -= min;
    }
    for (const d of days) if (rest.has(d.dow) && !d.sessions.length) d.rest = true;
    return { ...w, approach: ap.id, days, plannedHours: Math.round((used / 60) * 10) / 10 };
  });
}

function session(o, date, i, when = '') {
  const sport = o.sport === 'specific' ? specificSport(date, i) : o.sport;
  return { title: o.name + (when ? ` (${when})` : ''), sport, minutes: o.minutes, zone: o.zone, description: o.desc, kind: 'hard', keyId: o.id };
}

// In Kalendereinträge umwandeln (ersetzt beim Übernehmen frühere Assistenten-Einträge ab dem Startdatum).
export function toPlanItems(weeks, uid) {
  return weeks.flatMap((w) => w.days.flatMap((d) => d.sessions.map((s) => ({
    id: uid(), date: d.date, sport: s.sport, minutes: s.minutes, zone: s.zone, title: s.title, description: s.description,
    load: estimatePlanLoad(s.minutes, s.zone), source: 'wizard', phase: w.phase, done: false,
  }))));
}

export const nextMonday = (t) => { const m = mondayOf(t); return m === t ? t : addDays(m, 7); };
