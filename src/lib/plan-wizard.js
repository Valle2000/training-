// Saisonplan-Assistent: studienbasierte Trainingsansätze → konkrete Wochen mit Einheiten im Kalender.
// Phasen und Wochenstunden kommen aus seasonPlan (rückwärts von den A-Rennen, 3:1-Rhythmus, Tapering).
import { addDays } from './metrics.js';
import { mondayOf, estimatePlanLoad } from './activities.js';
import { seasonPlan } from './season.js';

export const PLAN_SOURCES = {
  casado23: { text: 'Casado et al. 2023 – Das norwegische Modell / Double Threshold (Review)', url: 'https://pubmed.ncbi.nlm.nih.gov/?term=Casado+Foster+Bakken+Tjelta+Norwegian+method' },
  molmen19: { text: 'Mølmen et al. 2019 – Block-Periodisierung im Ausdauersport (Systematischer Review/Metaanalyse)', url: 'https://pubmed.ncbi.nlm.nih.gov/?term=M%C3%B8lmen+block+periodization+endurance+systematic+review' },
  raysmith16: { text: 'Raysmith & Drew 2016 – Kontinuität: verlorene Trainingswochen und Erfolg (J Sci Med Sport)', url: 'https://pubmed.ncbi.nlm.nih.gov/?term=Raysmith+Drew+2016+weeks+lost+injury+illness+track+and+field' },
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
    id: 'threshold', name: 'Schwellenbetont (aktueller Trend)', evidence: 'gering bis mittel',
    short: 'Sehr viel Schwelle (2 Einheiten pro Woche, Klassiker wie 6×10, 3×20, 6×8 min), I4 und I5 (z. B. 30/15) je nur etwa einmal in 3–4 Wochen.',
    detail: 'So trainieren inzwischen viele Langläufer und Läufer: die Schwelle (I3, Laktat ca. 2–4 mmol/l) ist der Hauptreiz, weil sie viel Wirkung bei überschaubarer Erholungszeit bringt und große Mengen erlaubt. Harte Intervalle (I4) kommen nur ab und zu dazu, sehr harte (I5) nur alle paar Wochen als Spitze. Wichtig: die Schwelle wirklich kontrolliert laufen – lieber etwas zu locker als zu hart, sonst wird es ein verstecktes I4. Studienlage: Beschreibungen von Weltklasse-Athleten und Trainern, wenige kontrollierte Studien.',
    phases: { base: ['threshold', 'threshold'], build: ['threshold', 'threshold', 'rot'], specific: ['threshold', 'threshold', 'rot'], taper: ['threshold', 'race'], race: ['opener'], recovery: [], transition: ['threshold'] },
    days: { hard: [2, 4, 6] }, sources: ['casado23', 'walther23', 'sandbakk17'], defaults: ['thr_6x10', 'thr_3x20s', 'thr_6x8', 'hit_5x4', 'hit_30_15', 'race_pace', 'speed', 'long'],
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

// Schlüsseleinheiten aus Wiederholungen, Belastung und Pause (auch für eigene Einheiten im Assistenten).
// type: dt_am/dt_pm (Double Threshold morgens/abends), threshold, hit (zone I4 oder I5), race, opener, speed, long, strength.
// sport: 'specific' = Rollski bzw. Ski (Winter), sonst feste Sportart.
export const KEY_TYPES = [
  ['dt_am', 'Double Threshold morgens', 'I3'], ['dt_pm', 'Double Threshold abends', 'I3'], ['threshold', 'Schwelle (I3)', 'I3'],
  ['hit_I4', 'Intervalle I4', 'I4'], ['hit_I5', 'Intervalle I5 / kurz', 'I5'], ['race', 'Wettkampftempo', 'I4'],
];
const PREFIX = { dt_am: 'Double Threshold morgens', dt_pm: 'Double Threshold abends', threshold: 'Schwelle', race: 'Wettkampftempo', I4: 'I4', I5: 'I5' };
const EFFORT = { I3: 'Schwelle (Laktat ca. 2–3,5 mmol/l, kontrolliert)', I4: 'hart (I4)', I5: 'sehr hart (I5)' };
const de = (x) => String(Math.round(x * 100) / 100).replace('.', ',');
export function makeKey({ id, type, reps, work, rest = 1, unit = 'min', restUnit, sets = 1, setRest = 3, zone, sport = 'specific', warm = 20, cool = 15, note = '', name, desc: descOverride }) {
  reps = Number(reps) || 1; work = Number(work) || 1; rest = Number(rest) || 0; sets = Number(sets) || 1;
  restUnit ||= unit;
  const z = zone || (type === 'hit' ? 'I4' : type === 'race' ? 'I4' : 'I3');
  const workMin = unit === 's' ? work / 60 : work, restMin = restUnit === 's' ? rest / 60 : rest;
  const minutes = Math.round((Number(warm) + sets * (reps * workMin + (reps - 1) * restMin) + (sets - 1) * Number(setRest) + Number(cool)) / 5) * 5;
  const core = sets > 1 ? `${sets}×(${reps}×${de(work)}${unit === 's' ? '' : ' min'}/${de(rest)} ${restUnit === 's' ? 's' : 'min'})` : `${reps}×${de(work)} ${unit === 's' ? 's' : 'min'}`;
  const label = type === 'hit' ? PREFIX[z] : PREFIX[type];
  const restTxt = rest ? `${de(rest)} ${restUnit === 's' ? 's' : 'min'} Pause` : 'ohne Pause';
  const desc = `${warm} min ein, ${sets > 1 ? `${sets} Serien à ` : ''}${reps}× ${de(work)} ${unit === 's' ? 's' : 'min'} ${type === 'race' ? 'im Renntempo' : EFFORT[z]}, ${restTxt}${sets > 1 ? `, ${setRest} min Serienpause` : ''}, ${cool} min aus${note ? ` – ${note}` : ''}`;
  return { id, type, name: name || `${label}: ${core}`, minutes, zone: z, sport, desc: descOverride || desc, spec: { type, reps, work, rest, unit, restUnit, sets, setRest, zone: z, sport, warm, cool, note } };
}
const K = (id, type, reps, work, rest, more = {}) => makeKey({ id, type, reps, work, rest, ...more });

export const KEY_OPTIONS = [
  K('dt_am', 'dt_am', 5, 6, 1),
  K('dtam_3x20', 'dt_am', 3, 20, 2, { note: 'eher untere Schwelle' }),
  K('dtam_8x8', 'dt_am', 8, 8, 1),
  K('dtam_6x10', 'dt_am', 6, 10, 1),
  K('dtam_5x10', 'dt_am', 5, 10, 1),
  K('dtam_4x12', 'dt_am', 4, 12, 1.5),
  K('dtam_2x25', 'dt_am', 2, 25, 3, { note: 'untere Schwelle' }),
  K('dt_pm', 'dt_pm', 10, 3, 1, { sport: 'run', warm: 15, cool: 10 }),
  K('dtpm_8x4', 'dt_pm', 8, 4, 1, { warm: 15, cool: 10 }),
  K('dtpm_12x3', 'dt_pm', 12, 3, 0.75, { warm: 15, cool: 10 }),
  K('dtpm_6x5', 'dt_pm', 6, 5, 1, { warm: 15, cool: 10 }),
  K('dtpm_20x1', 'dt_pm', 20, 1, 30, { restUnit: 's', warm: 15, cool: 10, note: 'obere Schwelle, nicht schneller werden' }),
  K('dtpm_25x400', 'dt_pm', 25, 80, 30, { unit: 's', restUnit: 's', sport: 'run', warm: 15, cool: 10, name: 'Double Threshold abends: 25×400 m (Laufen)', desc: '15 min ein, 25× 400 m im Schwellentempo (ca. 75–85 s), 30 s Pause, 10 min aus' }),
  K('thr_6x10', 'threshold', 6, 10, 1.5),
  K('thr_3x20s', 'threshold', 3, 20, 2.5),
  K('thr_6x8', 'threshold', 6, 8, 1.5),
  K('thr_8x8', 'threshold', 8, 8, 1),
  K('thr_5x10', 'threshold', 5, 10, 1.5),
  K('thr_4x12', 'threshold', 4, 12, 2),
  K('thr_4x8', 'threshold', 4, 8, 2),
  K('thr_3x15', 'threshold', 3, 15, 2),
  K('thr_2x30', 'threshold', 2, 30, 3, { note: 'untere Schwelle' }),
  K('thr_10x3', 'threshold', 10, 3, 1),
  K('thr_8x4', 'threshold', 8, 4, 1),
  K('thr_tempo45', 'threshold', 1, 45, 0, { name: 'Schwelle: 45 min Dauertempo', note: 'gleichmäßig an der unteren Schwelle' }),
  K('thr_3x20', 'threshold', 3, 20, 2, { sport: 'skierg', cool: 20, name: 'SkiErg 3×20 min' }),
  K('thr_3x10', 'threshold', 3, 10, 2, { sport: 'skierg', warm: 12, cool: 10, name: 'SkiErg Schwelle: 3×10 min' }),
  K('hit_5x4', 'hit', 5, 4, 3, { name: 'VO2max (I4): 5×4 min' }),
  K('hit_4x4', 'hit', 4, 4, 3, { note: 'Klassiker 4×4' }),
  K('hit_6x4', 'hit', 6, 4, 2.5),
  K('hit_4x5', 'hit', 4, 5, 3),
  K('hit_5x5', 'hit', 5, 5, 2.5),
  K('hit_6x3', 'hit', 6, 3, 2),
  K('hit_4x6', 'hit', 4, 6, 3),
  K('hit_hill', 'hit', 6, 5, 3, { sport: 'hike', name: 'Bergintervalle Skigang (I4): 6×5 min', note: 'Skigang mit Stöcken bergauf, locker zurück' }),
  K('hit_hill8x4', 'hit', 8, 4, 2.5, { sport: 'run', name: 'Bergläufe (I4): 8×4 min', note: 'bergauf laufen, locker zurück' }),
  K('hit_pyr', 'hit', 7, 2.6, 2, { name: 'Pyramide (I4): 1-2-3-4-3-2-1 min', desc: '20 min ein, 1-2-3-4-3-2-1 min hart (I4), Pause halb so lang wie die Belastung, 15 min aus' }),
  K('hit_30_15', 'hit', 13, 30, 15, { unit: 's', restUnit: 's', sets: 3, zone: 'I5', sport: 'bike', warm: 15, cool: 10, name: 'VO2max kurz (I5): 3×(13×30/15 s)', note: 'Rønnestad' }),
  K('hit_40_20', 'hit', 10, 40, 20, { unit: 's', restUnit: 's', sets: 3, zone: 'I5', warm: 15, cool: 10 }),
  K('hit_10x1', 'hit', 10, 1, 1, { zone: 'I5' }),
  K('hit_15x1', 'hit', 15, 1, 30, { zone: 'I5', restUnit: 's' }),
  K('hit_8x2', 'hit', 8, 2, 2, { zone: 'I5' }),
  K('hit_hill10x1', 'hit', 10, 1, 2, { zone: 'I5', sport: 'hike', name: 'Kurze Bergsprünge (I5): 10×1 min', note: 'Skigang/Sprünge bergauf, locker zurück' }),
  K('race_pace', 'race', 4, 6, 3),
  K('race_3x8', 'race', 3, 8, 3),
  K('race_5x3', 'race', 5, 3, 2, { note: 'Start- und Endspurt-Tempo üben' }),
  K('race_sprint', 'race', 4, 3, 12, { name: 'Sprint-Simulation: 4 Läufe à 3 min', note: 'wie Prolog/Vorlauf/Halbfinale/Finale, volle Erholung' }),
  K('race_tt', 'race', 1, 25, 0, { name: 'Testrennen: 25 min', note: 'Zeitfahren auf bekannter Runde – gut zum Vergleichen' }),
  { id: 'opener', type: 'opener', name: 'Vorbelastung: 30 min + 4×1 min + Sprints', minutes: 45, zone: 'I2', sport: 'specific', desc: '30 min locker, 4×1 min zügig, 3 kurze Sprints – 1–2 Tage vor dem Rennen' },
  { id: 'speed', type: 'speed', name: 'Steigerungen/Sprints in einer lockeren Einheit', minutes: 0, zone: 'I1', sport: 'specific', desc: 'In einer lockeren Einheit 6–8× 10–15 s Sprint, volle Pause – Technik und Schnelligkeit' },
  { id: 'long', type: 'long', name: 'Lange Einheit am Wochenende', minutes: 0, zone: 'I1', sport: 'specific', desc: 'Lang und locker, gern mit viel Doppelstock; Verpflegung üben' },
  { id: 'strength', type: 'strength', name: 'Krafttraining', minutes: 60, zone: 'Kraft', sport: 'strength', desc: 'Kraft-Vorlage A/B oder JOE (Doppelstock-Fokus)' },
];
// Eigene Einheiten (settings.customKeys: [{id, spec}]) zusammen mit dem Katalog.
export const allOptions = (custom = []) => [...KEY_OPTIONS, ...custom.map((c) => ({ ...makeKey({ ...c.spec, id: c.id, name: c.name }), custom: true }))];
export const optionById = (id) => KEY_OPTIONS.find((o) => o.id === id);

// Rollski im Sommer, Ski im Winter (Dez–März).
const winter = (date) => [12, 1, 2, 3].includes(Number(date.slice(5, 7)));
const specificSport = (date, i) => (winter(date) ? (i % 2 ? 'xc_classic' : 'xc_skate') : (i % 2 ? 'rollerski_classic' : 'rollerski_skate'));
const SPECIFIC_SHARE = { base: 0.5, build: 0.6, specific: 0.75, taper: 0.75, race: 0.8, recovery: 0.4, transition: 0.3 };
const OTHER = ['run', 'bike'];
const GENERAL = ['bike', 'run', 'hike', 'skierg', 'row', 'swim'];

// Anteil langlaufspezifischer Einheiten (Rollski/Ski) – angepasst an Jahreszeit, Vorlieben und Ernsthaftigkeit:
// Frühjahr/Frühsommer (Apr–Jul) ist Zeit für allgemeines Training (z. B. viel Rad, wenn du es magst), ab Spätsommer
// wird es spezifischer. Wer es locker/aus Spaß betreibt, behält Lieblingssportarten länger; Leistungsorientierte
// werden ab September deutlich spezifischer (Spezifität vor dem Winter).
export function specificShare(phase, date, pr = {}) {
  let s = SPECIFIC_SHARE[phase] ?? 0.5;
  const m = Number(date.slice(5, 7)), likesGeneral = (pr.likes || []).some((x) => GENERAL.includes(x));
  if ([4, 5, 6, 7].includes(m)) s -= likesGeneral ? 0.2 : 0.1;
  if (m === 8 && likesGeneral && pr.seriousness !== 'performance') s -= 0.1;
  if ([9, 10, 11].includes(m) && pr.seriousness === 'performance') s += 0.1;
  if (pr.seriousness === 'fun') s -= 0.1;
  if ((pr.dislikes || []).includes('rollerski') && ![12, 1, 2, 3].includes(m)) s -= 0.15;
  return Math.min(0.9, Math.max(0.2, s));
}
// Allgemeine Sportart für lockere Einheiten: Lieblingssportarten zuerst, Abneigungen nie.
function generalSport(pr = {}, i) {
  const liked = (pr.likes || []).filter((x) => GENERAL.includes(x) && !(pr.dislikes || []).includes(x));
  const pool = liked.length ? [...liked, ...liked, ...OTHER.filter((x) => !liked.includes(x) && !(pr.dislikes || []).includes(x))] : OTHER.filter((x) => !(pr.dislikes || []).includes(x));
  return (pool.length ? pool : OTHER)[i % (pool.length || OTHER.length)];
}

const SPORT_NAME = { bike: 'Rad', run: 'Laufen', rollerski: 'Rollski', skierg: 'SkiErg', hike: 'Berglauf/Wandern', row: 'Rudern', swim: 'Schwimmen' };
const sportName = (x) => SPORT_NAME[x];
export function flexible(pr = {}, date) {
  const m = Number(date.slice(5, 7));
  if (pr.seriousness === 'fun' || pr.goal === 'fitness') return ![12, 1, 2, 3].includes(m);
  if (pr.seriousness === 'ambitious') return [4, 5, 6].includes(m);
  return false;
}

// Optionen: approach, startHours, peakHours, start, end, restDays ([1] = Montag), longDay (7 = Sonntag), doubles, strengthPerWeek, keys (IDs)
export function generatePlan(opts, races = []) {
  const ap = APPROACHES.find((a) => a.id === opts.approach) || APPROACHES[0];
  const keys = new Set(opts.keys?.length ? opts.keys : ap.defaults);
  const pr = opts.profile || {};
  const weeks = seasonPlan(races, { start: opts.start, end: opts.end, baseHours: Number(opts.startHours) || 10, peakHours: Number(opts.peakHours) || 14, style: pr.style === 'steady' ? 'steady' : pr.style === 'varied' ? 'varied' : 'standard' });
  // Wiedereinstieg: höchstens +10 % pro Woche, alle 4 Wochen leichter.
  if (ap.id === 'base') weeks.forEach((w, i) => { w.targetHours = Math.round(Math.min(Number(opts.peakHours) || 14, (Number(opts.startHours) || 8) * 1.1 ** i) * (i % 4 === 3 ? 0.75 : 1) * 10) / 10; });
  const options = allOptions(opts.customKeys);
  const pickByType = (type, k) => { const list = options.filter((o) => o.type === type && keys.has(o.id)); return list.length ? list[k % list.length] : null; };
  let rot = 0, buildIdx = 0, rotIdx = 0, prevHours = null;
  const pickHit = (zone, k) => { const list = options.filter((o) => o.type === 'hit' && o.zone === zone && keys.has(o.id)); return list.length ? list[k % list.length] : null; };
  return weeks.map((w) => {
    let hardSlots = ap.phases[w.phase] ?? [];
    let hardDays = ap.days.hard;
    if (hardSlots === 'block') {
      const blockWeek = buildIdx % 4 === 0; buildIdx++;
      hardSlots = blockWeek ? ['hit', 'hit', 'hit', 'hit', 'hit'] : w.phase === 'specific' ? ['threshold', 'race'] : ['threshold', 'hit'];
      if (blockWeek) { hardDays = ap.days.block; w.targetHours = Math.round(w.targetHours * 0.85 * 10) / 10; w.block = true; }
    }
    // 'rot': pro 4-Wochen-Zyklus einmal I4 (bzw. Wettkampftempo in der Wettkampfvorbereitung) und einmal I5,
    // nie in der Entlastungswoche (deutlich weniger Stunden als die Vorwoche).
    const deload = prevHours != null && w.targetHours < prevHours * 0.85;
    prevHours = w.targetHours;
    if (Array.isArray(hardSlots) && hardSlots.includes('rot')) {
      const r = deload ? -1 : rotIdx++ % 3;
      const what = r === 2 ? 'i5' : r === 0 ? (w.phase === 'specific' ? 'race' : 'i4') : null;
      hardSlots = hardSlots.flatMap((x) => (x === 'rot' ? (what ? [what] : []) : [x]));
    }
    if (deload && ap.id === 'threshold') hardSlots = hardSlots.slice(0, 1);
    const rest = new Set(opts.restDays || [1]), longDay = Number(opts.longDay) || 7;
    const days = Array.from({ length: 7 }, (_, i) => ({ dow: i + 1, date: addDays(w.from, i), sessions: [] }));
    const free = (dow) => !rest.has(dow) && dow !== longDay;
    const total = w.targetHours * 60;
    let used = 0;
    const put = (day, s) => { day.sessions.push(s); used += s.minutes; };
    // Freie Zeit des Tages (Alltag: Uni, Arbeit …); zwischen zwei Einheiten 30 min Abstand.
    const room = (day) => (opts.capFor ? opts.capFor(day.date) - day.sessions.reduce((a, x) => a + x.minutes, 0) - (day.sessions.length ? 30 : 0) : Infinity);
    // 1) Harte Einheiten auf die Wunschtage (Ruhetag und langer Tag ausgenommen, sonst nächster freier Tag).
    const hardUsed = new Set();
    hardSlots.forEach((slot, k) => {
      let dow = hardDays[k] ?? hardDays[hardDays.length - 1] ?? 3;
      const need = slot === 'dt' ? 70 : 60;
      for (let tries = 0; tries < 7 && (!free(dow) || hardUsed.has(dow) || room(days[dow - 1]) < need); tries++) dow = (dow % 7) + 1;
      hardUsed.add(dow);
      const day = days[dow - 1];
      if (slot === 'dt') {
        const am = pickByType('dt_am', rot) || pickByType('threshold', rot), pm = pickByType('dt_pm', rot) || pickByType('threshold', rot + 1);
        if (am) put(day, session(am, day.date, rot++, 'vormittags'));
        if (pm && opts.doubles !== false && room(day) >= pm.minutes) put(day, session(pm, day.date, rot++, 'nachmittags'));
      } else if (slot === 'opener') {
        const race = (w.races || [])[0];
        const d = race ? days.find((x) => x.date === addDays(race.date, -1)) || day : day;
        put(d, session(optionById('opener'), d.date, rot++));
      } else if (slot === 'i4' || slot === 'i5') {
        const o = pickHit(slot.toUpperCase(), rot) || pickHit(slot === 'i5' ? 'I4' : 'I5', rot) || pickByType('hit', rot);
        if (o) put(day, session(o, day.date, rot++));
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
      const min = Math.round(Math.min(210, room(days[longDay - 1]), Math.max(90, total * 0.22)) / 15) * 15;
      if (min >= 60) put(days[longDay - 1], { title: 'Lange Grundlage', sport: specificSport(w.from, 1), minutes: min, zone: 'I1', description: 'Locker, viel Doppelstock, Verpflegung üben (60 g KH/h)', kind: 'long' });
    }
    // 3) Kraft auf Tage ohne harte Einheit.
    // Kraft: Vorbereitung wie gewählt, ab Wettkampfvorbereitung und in Erholungswochen höchstens 1× (Erhalt).
    const strengthN = ['base', 'build'].includes(w.phase) ? opts.strengthPerWeek ?? 2 : Math.min(1, opts.strengthPerWeek ?? 2);
    const strengthDays = days.filter((d) => !rest.has(d.dow) && d.dow !== longDay && !d.sessions.length && room(d) >= 60);
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
    let speedLeft = pr.weak?.includes('sprint') ? 2 : 1;
    let techLeft = pr.weak?.some((x) => x === 'skate' || x === 'classic') && !['race', 'taper'].includes(w.phase) ? 1 : 0;
    const share = specificShare(w.phase, w.from, pr);
    for (let i = 0; i < n; i++) {
      const d = slots[i];
      const min = Math.floor(Math.min(150, room(d), Math.max(40, easy / (n - i))) / 5) * 5;
      if (min < 30) { if (room(d) < 30) continue; break; }
      const specific = (i / Math.max(1, n)) < share;
      const s = { title: 'Locker', sport: specific ? specificSport(d.date, i + (pr.weak?.includes('classic') ? 1 : 0)) : generalSport(pr, i + rot), minutes: min, zone: 'I1', description: 'Grundlage I1, wirklich locker', kind: 'easy' };
      if (specific && techLeft > 0) { s.title = 'Locker + Technik'; s.description = `Grundlage I1 mit Technikübungen (${pr.weak?.includes('classic') ? 'Klassisch: Abstoß, Gleiten auf einem Ski' : 'Skating: Gewichtsverlagerung, Eins-zu-eins, ohne Stöcke'}), gern Video`; techLeft--; }
      if (!speedDone && specific && s.title === 'Locker') { s.title = 'Locker + Sprints'; s.description = 'Grundlage I1, gegen Ende 6–8× 10–15 s Sprint mit voller Pause'; speedLeft--; if (speedLeft <= 0) speedDone = true; }
      // Wer es nicht so ernst nimmt, legt die Sportart nicht fest: locker nach Lust (Spaß-Fokus außerhalb des Winters,
      // ambitioniert im Frühjahr/Frühsommer). Leistungsorientierte bekommen feste Sportarten.
      if (!specific && s.title === 'Locker' && flexible(pr, d.date)) {
        const liked = (pr.likes || []).map((x) => sportName(x)).filter(Boolean);
        s.sport = 'other'; s.title = 'Locker nach Lust';
        s.description = `Grundlage I1 – Sportart frei: ${liked.length ? liked.join(', ') + ' oder was sonst Spaß macht' : 'Rad, Laufen, Rollski, Wandern, Schwimmen … was Spaß macht'}`;
      }
      put(d, s); easy -= min;
    }
    for (const d of days) if (rest.has(d.dow) && !d.sessions.length) d.rest = true;
    return { ...w, approach: ap.id, days, plannedHours: Math.round((used / 60) * 10) / 10 };
  });
}

function session(o, date, i, when = '') {
  const sport = o.sport === 'specific' ? specificSport(date, i) : o.sport;
  return { title: o.name + (when && !/^Double Threshold/.test(o.name) ? ` (${when})` : ''), sport, minutes: o.minutes, zone: o.zone, description: o.desc, kind: 'hard', keyId: o.id };
}

// In Kalendereinträge umwandeln (ersetzt beim Übernehmen frühere Assistenten-Einträge ab dem Startdatum).
export function toPlanItems(weeks, uid) {
  return weeks.flatMap((w) => w.days.flatMap((d) => d.sessions.map((s) => ({
    id: uid(), date: d.date, sport: s.sport, minutes: s.minutes, zone: s.zone, title: s.title, description: s.description,
    load: estimatePlanLoad(s.minutes, s.zone), source: 'wizard', phase: w.phase, done: false,
  }))));
}

export const nextMonday = (t) => { const m = mondayOf(t); return m === t ? t : addDays(m, 7); };

// ——— Beratung: Fragen zu Ziel, Ernsthaftigkeit, Stil, Stärken/Schwächen und Lieblingstraining ———
export const GOALS = [['long', 'Langdistanz / Volkslauf (z. B. Engadin, Vasalauf)'], ['short', 'Kürzere Rennen / Sprint'], ['allround', 'Alles – möglichst fit für die ganze Saison'], ['fitness', 'Fitness und Spaß, keine Rennziele']];
export const SERIOUSNESS = [['fun', 'Spaß steht vorn'], ['ambitious', 'Ambitioniert'], ['performance', 'Leistungsorientiert']];
export const STYLES = [['steady', 'Gleichmäßig – jede Woche ähnlich'], ['varied', 'Abwechslung – mal richtig harte Wochen, dann ruhiger'], ['any', 'Egal – Empfehlung der App']];
export const ABILITIES = [['endurance', 'Grundlagenausdauer'], ['threshold', 'Schwelle / Tempohärte'], ['vo2', 'VO2max / harte Intervalle'], ['sprint', 'Sprint / Antritt'], ['hills', 'Bergauf'], ['strength', 'Kraft / Doppelstock'], ['skate', 'Technik Skating'], ['classic', 'Technik Klassisch']];
export const MODES = [['bike', 'Rad'], ['run', 'Laufen'], ['rollerski', 'Rollski'], ['skierg', 'SkiErg'], ['hike', 'Berglauf / Skigang'], ['row', 'Rudern'], ['swim', 'Schwimmen']];

export function recommend(pr = {}, hours = 10) {
  const weak = pr.weak || [], strong = pr.strong || [], reasons = [];
  let approach;
  if (pr.goal === 'fitness' || (pr.seriousness === 'fun' && hours < 10)) {
    approach = 'polarized';
    reasons.push('Für Fitness und Spaß ist ein einfaches 80/20-Schema gut: wenige, klare harte Einheiten, der Rest locker und abwechslungsreich.');
  } else if (pr.style === 'varied' && hours >= 8 && pr.seriousness !== 'fun') {
    approach = 'block';
    reasons.push('Du magst Abwechslung mit harten Phasen: Block-Periodisierung bündelt die Intensität in einzelne Wochen – bei Trainierten mindestens so wirksam wie gleichmäßig verteilte Intervalle (Rønnestad; Metaanalyse Mølmen 2019).');
  } else if (weak.includes('vo2') && hours < 12) {
    approach = 'polarized';
    reasons.push('Schwäche bei harten Intervallen: polarisiert mit zwei harten Einheiten pro Woche setzt dort den Schwerpunkt.');
  } else if (weak.includes('threshold') && hours >= 12 && pr.seriousness === 'performance') {
    approach = 'norwegian';
    reasons.push('Schwäche an der Schwelle bei hohem Umfang: Double Threshold (zwei Schwelleneinheiten an einem Tag) bringt die meiste Schwellenzeit – Laktat bzw. Puls dabei im Griff halten.');
  } else if (hours >= 7) {
    approach = 'threshold';
    reasons.push('So trainieren inzwischen die meisten: viel kontrollierte Schwelle (Klassiker 6×10, 3×20, 6×8 min), I4 und I5 wie 30/15 nur je etwa einmal in 3–4 Wochen. Viel Wirkung bei gut planbarer Erholung.');
    if (weak.includes('threshold')) reasons.push('Passt genau zu deiner Schwäche an der Schwelle.');
  } else {
    approach = 'polarized';
    reasons.push('Bei begrenzter Zeit bringt das 80/20-Schema viel Wirkung mit wenig Planungsaufwand.');
  }
  if (weak.includes('endurance')) reasons.push('Grundlage als Schwäche: Umfang und lange Einheiten haben Vorrang – erhöhe die Stunden lieber langsam und stetig als über harte Einheiten.');
  if (pr.style === 'steady') reasons.push('Gleichmäßig trainieren ist eine sehr gute Wahl: Kontinuität – möglichst wenige ausgefallene Wochen – ist einer der stärksten Erfolgsfaktoren (u. a. Raysmith & Drew 2016). Die Wochen schwanken deshalb nur leicht, Entlastung auf ca. 80 %.');
  if (pr.style === 'varied') reasons.push('Ausgeprägte Wellen: dritte Woche ca. 10 % über dem Schnitt, Entlastungswoche ca. 60 %. Auf Erholung, Schlaf und Essen in den großen Wochen achten.');
  if (pr.style === 'any') reasons.push('Empfehlung: eher gleichmäßig mit Entlastung alle 3–4 Wochen – Kontinuität schlägt einzelne „krasse“ Wochen, vor allem ohne Trainer.');
  const keys = new Set(APPROACHES.find((a) => a.id === approach).defaults);
  if (weak.includes('threshold')) { keys.add('thr_6x10'); keys.add('thr_3x20s'); }
  if (weak.includes('vo2')) { keys.add('hit_5x4'); keys.add('hit_30_15'); }
  if (weak.includes('hills')) { keys.add('hit_hill'); reasons.push('Bergauf als Schwäche: Bergintervalle im Skigang mit Stöcken sind fest eingeplant.'); }
  if (weak.includes('sprint')) { keys.add('speed'); reasons.push('Sprint als Schwäche: zwei Einheiten pro Woche mit kurzen Sprints (volle Pause, Technik sauber).'); }
  if (weak.includes('strength')) reasons.push('Kraft als Schwäche: 3 Krafteinheiten in der Vorbereitung, Schwerpunkt Doppelstock (Kraft JOE, Bank-Doppelstock, Medizinball).');
  if (weak.some((x) => x === 'skate' || x === 'classic')) reasons.push(`Technik ${weak.includes('classic') && weak.includes('skate') ? 'Skating und Klassisch' : weak.includes('classic') ? 'Klassisch' : 'Skating'}: eine lockere Einheit pro Woche mit Technikübungen; die schwächere Technik kommt öfter dran.`);
  if (strong.length) reasons.push(`Stärken (${strong.map((x) => ABILITIES.find((a) => a[0] === x)?.[1]).filter(Boolean).join(', ')}) erhalten – sie brauchen weniger, aber regelmäßige Reize.`);
  const likes = pr.likes || [];
  if (likes.length) reasons.push(`Lieblingstraining (${likes.map((x) => MODES.find((m) => m[0] === x)?.[1]).join(', ')}): ${pr.seriousness === 'performance' ? 'im Frühjahr und Frühsommer viel davon, ab Spätsommer wird es spezifischer (Rollski/Ski).' : 'bleibt bis in den Spätsommer fester Bestandteil – Spaß hält dich dran, und das ist der wichtigste Faktor.'}`);
  if (flexible(pr, '2027-05-01')) reasons.push(pr.seriousness === 'ambitious' ? 'Im Frühjahr und Frühsommer sind die lockeren Einheiten „nach Lust“ – die Sportart legst du spontan fest, ab Sommer wird es konkreter.' : 'Lockere Einheiten außerhalb des Winters sind „nach Lust“ – die Sportart legst du spontan fest, es zählt die Zeit in Zone 1.');
  if (pr.goal === 'long') reasons.push('Langdistanz: lange Einheiten mit viel Doppelstock und Verpflegung üben sind zentral.');
  if (pr.goal === 'short') reasons.push('Kurze Rennen: mehr Wettkampftempo und Sprints in der Wettkampfvorbereitung.');
  return { approach, keys: [...keys], strengthPerWeek: weak.includes('strength') ? 3 : pr.seriousness === 'fun' ? 1 : 2, reasons };
}
