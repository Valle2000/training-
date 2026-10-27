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
// Wozu welche Form? Kurz die Vorteile – hilft bei der Auswahl.
const WHY = {
  dt_am: 'Einstieg ins Double Threshold: kurze Wiederholungen, leicht zu kontrollieren, gut für die ersten Wochen.',
  dtam_3x20: 'Viel Zeit an der unteren Schwelle in wenigen langen Blöcken – sehr rennnah für Langdistanzen, trainiert Konzentration und gleichmäßiges Tempo.',
  dtam_8x8: 'Hoher Umfang an der Schwelle, durch die kurzen Pausen trotzdem gut kontrollierbar – klassische norwegische Vormittagseinheit.',
  dtam_6x10: 'Ausgewogen zwischen Umfang und Kontrolle; 60 min an der Schwelle, gut zum Vergleichen über die Saison.',
  dtam_5x10: 'Wie 6×10, etwas weniger Umfang – gut für Wochen mit viel Alltag oder am Anfang.',
  dtam_4x12: 'Längere Blöcke, weniger Pausen – Übergang von Intervallen zu langen Schwellenblöcken.',
  dtam_2x25: 'Sehr lange Blöcke an der unteren Schwelle – Ausdauer an der Schwelle und Renntempo für 30–50 km.',
  dt_pm: 'Abends kürzer und etwas schneller: mehr Tempo und Technik an der Schwelle trotz Vorbelastung vom Morgen.',
  dtpm_8x4: 'Kurze Blöcke, etwas höheres Tempo als morgens – trainiert Schwelle mit flüssiger Technik bei Vorermüdung.',
  dtpm_12x3: 'Viele kurze Wiederholungen – hoher Schwellenumfang bei guter Lockerheit.',
  dtpm_6x5: 'Mittellange Blöcke – wenn 3 min zu kurz und 8–10 min abends zu zäh sind.',
  dtpm_20x1: 'Sehr kurze Belastungen an der oberen Schwelle – Tempo und Technik, wenig muskuläre Ermüdung.',
  dtpm_25x400: 'Bakken-Klassiker im Laufen: viele kurze Wiederholungen, Tempo exakt steuerbar über die Zeit pro 400 m.',
  thr_6x10: 'Der Klassiker: 60 min Schwelle, gut dosierbar und über Wochen vergleichbar (Key Session).',
  thr_3x20s: 'Lange Blöcke an der unteren Schwelle – rennspezifisch für lange Rennen, mental fordernd.',
  thr_6x8: 'Etwas kürzere Blöcke als 6×10 – leichter, das Tempo sauber zu halten; gut auf Rollski.',
  thr_8x8: 'Hoher Schwellenumfang (64 min) – für Fortgeschrittene in der Aufbauphase.',
  thr_5x10: 'Etwas weniger als 6×10 – gut als Einstieg oder in Wochen mit wenig Zeit.',
  thr_4x12: 'Längere Blöcke mit wenigen Pausen – Übergang zu Dauertempo.',
  thr_4x8: 'Kompakte Schwelleneinheit (32 min) – wenn wenig Zeit ist oder in Wettkampfwochen.',
  thr_3x15: 'Mittellange Blöcke – rennnahes Tempo für 15–30 km.',
  thr_2x30: 'Sehr lange Blöcke an der unteren Schwelle – Langdistanz-Vorbereitung.',
  thr_10x3: 'Kurze Wiederholungen – Schwelle mit höherem Tempo und guter Technik, wenig Ermüdung.',
  thr_8x4: 'Kurze Blöcke mit kurzen Pausen – viel Zeit an der Schwelle bei lockerer Technik.',
  thr_tempo45: 'Dauertempo ohne Pause – Renngefühl und gleichmäßiges Pacing für Langdistanzen.',
  thr_3x20: 'SkiErg: Doppelstock-Kraftausdauer an der Schwelle, unabhängig von Wetter und Gelände.',
  thr_3x10: 'SkiErg kompakt – Oberkörper-Schwelle, gut als zweite Einheit am Tag.',
  hit_5x4: 'VO2max-Klassiker: 20 min nahe der maximalen Sauerstoffaufnahme, gut steuerbar.',
  hit_4x4: 'Norwegischer 4×4-Klassiker – in Studien deutliche VO2max-Verbesserung; kurz genug, um voll zu gehen.',
  hit_6x4: 'Mehr Umfang als 5×4 – für gut Trainierte in der Wettkampfvorbereitung.',
  hit_4x5: 'Etwas längere Blöcke – mehr Zeit nahe VO2max pro Wiederholung, gut für lange Anstiege.',
  hit_5x5: 'Viel Zeit nahe VO2max (25 min) – anspruchsvoll, für Fortgeschrittene.',
  hit_6x3: 'Kürzer und schneller – mehr Tempo, gut für Technik bei hoher Geschwindigkeit.',
  hit_4x6: 'Lange harte Blöcke – nahe am Tempo von 10–15-km-Rennen.',
  hit_hill: 'Bergauf mit Stöcken: sehr langlaufspezifisch, viel Muskelmasse, wenig Stoßbelastung – ideal im Sommer.',
  hit_hill8x4: 'Bergläufe: hohe Intensität bei geringer Stoßbelastung, kräftigt Beine und Hüfte.',
  hit_pyr: 'Abwechslung und Pacing-Training – verschiedene Längen in einer Einheit, mental leichter.',
  hit_30_15: 'Kurze Intervalle mit kurzen Pausen: besonders viel Zeit nahe VO2max bei erträglicher Ermüdung (Rønnestad) – auf Rad, SkiErg oder Rollski bergauf.',
  hit_40_20: 'Wie 30/15, etwas längere Belastungen – Übergang zu längeren VO2max-Intervallen.',
  hit_10x1: 'Kurz und sehr hart – Tempohärte, Laktattoleranz und Antritte für Rennen und Sprints.',
  hit_15x1: 'Kurze Pausen machen es zur Mischung aus VO2max und Laktattoleranz – sehr fordernd.',
  hit_8x2: 'Harte Zwei-Minuten-Blöcke – nahe am Tempo von Sprint-Rennen bzw. Rennanstiegen.',
  hit_hill10x1: 'Kurz, explosiv und bergauf – Kraft, Schnellkraft und Technik unter Ermüdung.',
  race_pace: 'Geplantes Renntempo üben: Pacing-Gefühl, Technik und Verpflegung im Renntempo.',
  race_3x8: 'Längere Blöcke im Renntempo – für Distanzrennen.',
  race_5x3: 'Kürzere Blöcke im Renntempo – Start und Endspurt üben.',
  race_sprint: 'Sprint-Format simulieren: mehrere harte Läufe mit Pausen wie im Rennen (Prolog, Vorlauf, Finale).',
  race_tt: 'Testrennen auf bekannter Runde – der beste Formtest, über die Saison vergleichbar.',
};
const WHY_TYPE = { dt_am: 'Vormittags längere, kontrollierte Schwellenblöcke.', dt_pm: 'Abends kürzere, etwas schnellere Schwellenblöcke.', threshold: 'Schwelle: viel Wirkung bei überschaubarer Erholungszeit.', hit: 'Harte Intervalle für VO2max und Tempohärte.', race: 'Renntempo und Rennabläufe üben.' };
for (const o of KEY_OPTIONS) o.why = WHY[o.id] || null;

// Eigene Einheiten (settings.customKeys: [{id, spec}]) zusammen mit dem Katalog.
export const allOptions = (custom = []) => [...KEY_OPTIONS, ...custom.map((c) => { const k = makeKey({ ...c.spec, id: c.id, name: c.name }); return { ...k, custom: true, why: WHY_TYPE[k.type] || null }; })];
export const optionById = (id) => KEY_OPTIONS.find((o) => o.id === id);

// ——— Harte Tage wählen ———
// Wie viele harte Tage plant ein Ansatz pro Woche (Aufbau/Wettkampfvorbereitung)? Ein Double-Threshold-Tag zählt als ein Tag.
export function hardDayCount(approachId, dtDays = 2) {
  const ap = APPROACHES.find((a) => a.id === approachId);
  if (!ap) return 2;
  if (ap.phases.build === 'block') return 2;
  const slots = phasesFor(ap, dtDays).build || [];
  return slots.filter((x) => x !== 'opener').length;
}
// Norwegisch mit nur einem Double-Threshold-Tag: DT + eine harte Einheit.
function phasesFor(ap, dtDays) {
  if (ap.id !== 'norwegian' || Number(dtDays) !== 1) return ap.phases;
  return { ...ap.phases, build: ['dt', 'hit'], specific: ['dt', 'race'] };
}
const cyc = (a, b) => { const d = Math.abs(a - b); return Math.min(d, 7 - d); };
// Vorschläge für n harte Tage: möglichst großer Abstand (mind. 48 h), nicht auf Ruhetag/langem Tag; bei Gleichstand
// lieber ein harter Tag am Wochenende (Rennrhythmus) und der Tag nach dem Ruhetag (frisch).
export function suggestHardDays(n, { restDays = [1], longDay = 7, minGap = 2 } = {}) {
  const free = [1, 2, 3, 4, 5, 6, 7].filter((d) => !restDays.includes(d) && d !== longDay);
  const combos = [];
  const rec = (start, pick) => { if (pick.length === n) { combos.push([...pick]); return; } for (let i = start; i < free.length; i++) rec(i + 1, [...pick, free[i]]); };
  rec(0, []);
  const score = (c) => {
    let minGap = 7;
    for (let i = 0; i < c.length; i++) for (let j = i + 1; j < c.length; j++) minGap = Math.min(minGap, cyc(c[i], c[j]));
    const weekend = c.some((d) => d >= 6) ? 1 : 0;
    const afterRest = c.some((d) => restDays.includes(((d + 5) % 7) + 1)) ? 1 : 0;
    const beforeLong = c.includes(((longDay + 5) % 7) + 1) ? 0.5 : 0; // Tag vor dem langen Tag hart: als Wochenend-Block okay
    return minGap * 10 + weekend * 2 + afterRest + beforeLong * 0.5;
  };
  const gapOf = (c) => Math.min(7, ...c.flatMap((x, i) => c.slice(i + 1).map((y) => cyc(x, y))));
  const best = Math.max(0, ...combos.map(gapOf));
  return combos.filter((c) => gapOf(c) >= Math.min(minGap, best)).sort((a, b) => score(b) - score(a)).slice(0, 3);
}
export function checkHardDays(days = [], { restDays = [1], longDay = 7, needed = 2, minGap = 2 } = {}) {
  const out = [];
  const s = [...days].sort((a, b) => a - b);
  for (let i = 0; i < s.length; i++) for (let j = i + 1; j < s.length; j++) if (cyc(s[i], s[j]) < minGap) out.push(`${DOW_NAME[s[i] - 1]} und ${DOW_NAME[s[j] - 1]} liegen zu nah beieinander – mindestens ${minGap} ${minGap === 1 ? 'lockerer Tag' : 'lockere Tage'} dazwischen (Abstand ${minGap} Tage).`);
  for (const d of s) if (restDays.includes(d)) out.push(`${DOW_NAME[d - 1]} ist dein Ruhetag.`);
  if (s.includes(longDay)) out.push(`${DOW_NAME[longDay - 1]} ist dein langer Tag – lang und hart am selben Tag ist sehr ermüdend (Ausnahme: Rennen).`);
  if (s.length < needed) out.push(`Der Ansatz sieht ${needed} harte Tage vor, gewählt sind ${s.length} – die übrigen harten Einheiten fallen weg (bewusst weniger Intensität).`);
  if (s.length > needed) out.push(`${s.length} Tage gewählt, der Ansatz braucht ${needed} – es werden die ersten ${needed} genutzt.`);
  return out;
}
const DOW_NAME = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];

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

// Multisport: Schwerpunkt-Zeiträume (z. B. Juni–August Laufen oder Rad, Triathlon-Block mit Rad + Lauf).
export const FOCUS_OPTIONS = [['run', 'Laufen'], ['bike', 'Rad'], ['tri', 'Triathlon (Rad + Lauf)'], ['rollerski', 'Rollski/Ski (Standard)']];
// Schneelage: Zeiträume ohne Schnee (snow: false) ersetzen Ski durch eine Ersatzsportart (winterSub).
export const noSnowOn = (date, snow = []) => (snow || []).some((p) => !p.snow && date >= p.from && date <= p.to);
export function focusOn(date, list = [], snow = [], winterSub = 'run') {
  const f = (list || []).find((x) => date >= x.from && date <= x.to && x.sport !== 'rollerski');
  if (f) return f.sport;
  if (noSnowOn(date, snow) && (winterSub === 'run' || winterSub === 'bike')) return winterSub;
  return null;
}
// Sportart einer Rennzeile im Kalender.
export const raceSport = (technique, date) => (technique === 'Rad' ? 'bike' : technique === 'Lauf' || technique === 'Triathlon' ? 'run' : technique === 'Rollski' ? 'rollerski_skate' : winter(date) ? 'xc_skate' : 'rollerski_skate');

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
  return weeks.map((w, wi) => {
    let hardSlots = phasesFor(ap, opts.dtDays)[w.phase] ?? [];
    // Rhythmus Double Threshold: jede Woche, jede zweite Woche oder 3:1 (drei mit, eine ohne).
    const dtOff = (opts.dtRhythm === 'biweekly' && wi % 2 === 1) || (opts.dtRhythm === '3:1' && wi % 4 === 3);
    if (dtOff && Array.isArray(hardSlots)) hardSlots = hardSlots.map((x) => (x === 'dt' ? 'threshold' : x));
    const focus = opts.focusFor ? opts.focusFor(w.from) : null;
    const fSport = focus === 'run' || focus === 'bike' ? focus : null;
    // Triathlon: harte Einheiten wechseln zwischen Lauf und Rad (sonst Rollski wie im Standardplan).
    let triFlip = 0;
    const sess = (o, date, i, when) => session(o, date, i, when, focus === 'tri' ? (triFlip++ % 2 ? 'bike' : 'run') : fSport);
    // Besondere Zeiten (Prüfungsphase, Reise, Trainingslager): Umfang skalieren, harte Einheiten begrenzen.
    const per = opts.periodFor ? opts.periodFor(w.from) : null;
    if (per) {
      w.targetHours = Math.round(w.targetHours * per.factor * 10) / 10; w.period = per.label;
      if (Array.isArray(hardSlots) && per.hardMax != null) hardSlots = hardSlots.slice(0, per.hardMax);
      else if (hardSlots === 'block' && per.factor < 1) hardSlots = ['threshold'];
    }
    // Eigene harte Tage: Anzahl harter Einheiten passt sich an (weniger Tage = bewusst weniger Intensität).
    const own = opts.hardDays?.length ? [...opts.hardDays].sort((a, b) => a - b) : null;
    let hardDays = own || ap.days.hard;
    if (hardSlots === 'block') {
      const blockWeek = buildIdx % 4 === 0; buildIdx++;
      hardSlots = blockWeek ? ['hit', 'hit', 'hit', 'hit', 'hit'] : w.phase === 'specific' ? ['threshold', 'race'] : ['threshold', 'hit'];
      if (blockWeek) { hardDays = ap.days.block; w.targetHours = Math.round(w.targetHours * 0.85 * 10) / 10; w.block = true; }
    }
    if (own && !w.block && Array.isArray(hardSlots)) {
      const opener = hardSlots.filter((x) => x === 'opener');
      hardSlots = [...hardSlots.filter((x) => x !== 'opener').slice(0, own.length), ...opener];
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
    // B- und C-Rennen ersetzen je eine harte Einheit; vor B-Rennen Vorbelastung am Vortag.
    const PRIO = { A: 0, B: 1, C: 2 };
    const weekRaces = [...(w.races || [])].sort((a, b) => (PRIO[a.priority] ?? 2) - (PRIO[b.priority] ?? 2));
    const minor = weekRaces.filter((r) => r.priority !== 'A');
    if (minor.length && Array.isArray(hardSlots) && w.phase !== 'race') {
      hardSlots = hardSlots.filter((x) => x !== 'opener');
      hardSlots = hardSlots.slice(0, Math.max(0, hardSlots.length - minor.length));
      if (minor.some((r) => r.priority === 'B')) hardSlots.push('opener');
    }
    // Keine harte Einheit am Renntag, am Tag davor und nach A-/B-Rennen am Tag danach (auch Rennen vom Vorsonntag).
    const dowOfDate = (d) => Math.round((Date.parse(d) - Date.parse(w.from)) / 864e5) + 1;
    const blocked = new Set(), raceDows = new Set();
    for (const r of races) {
      const dw = dowOfDate(r.date);
      if (dw >= 1 && dw <= 7) { raceDows.add(dw); blocked.add(dw); blocked.add(dw - 1); }
      if (r.priority !== 'C') blocked.add(dw + 1);
      if (r.priority === 'B' || r.priority === 'A') blocked.add(dw - 2);
    }
    const free = (dow) => !rest.has(dow) && dow !== longDay && !raceDows.has(dow);
    const hardOk = (dow) => free(dow) && !blocked.has(dow);
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
      if (slot !== 'opener') for (let tries = 0; tries < 7 && (!hardOk(dow) || hardUsed.has(dow) || room(days[dow - 1]) < need); tries++) dow = (dow % 7) + 1;
      // Keine passende Lücke (z. B. Rennen, Ruhetage): Einheit weglassen statt neben das Rennen legen.
      if (slot !== 'opener' && (!hardOk(dow) || hardUsed.has(dow))) return;
      hardUsed.add(dow);
      const day = days[dow - 1];
      if (slot === 'dt') {
        const am = pickByType('dt_am', rot) || pickByType('threshold', rot), pm = pickByType('dt_pm', rot) || pickByType('threshold', rot + 1);
        // Zweimal am Tag: immer, nie, oder nur an Tagen ohne Termin (Uni, Arbeit) – auto.
        const busy = opts.busyFor ? opts.busyFor(day.date) : false;
        const twice = opts.dtDouble === 'always' || (opts.dtDouble !== 'never' && !busy);
        if (!twice && am) {
          // Eine Schwelleneinheit statt zwei: der Tag bleibt frei, die Schwelle bleibt drin.
          const single = pickByType('threshold', rot) || optionById('thr_6x10');
          put(day, sess(single, day.date, rot++, ''));
        } else if (am) {
          const x = sess(am, day.date, rot++, 'vormittags');
          // Double Threshold getrennt: morgens Rad (gelenkschonend), abends Laufen – im Laufen-Schwerpunkt.
          if (fSport === 'run' && opts.dtSplit !== false && x.sport !== 'bike' && am.sport === 'specific') x.sport = 'bike';
          put(day, x);
        }
        if (twice && pm && room(day) >= pm.minutes) {
          const x = sess(pm, day.date, rot++, 'nachmittags');
          // Mit Rad als Ersatz: auch die Abendeinheit auf dem Rad.
          if (fSport === 'bike' && pm.sport === 'run') x.sport = 'bike';
          put(day, x);
        }
      } else if (slot === 'opener') {
        const race = weekRaces[0];
        const d = race ? days.find((x) => x.date === addDays(race.date, -1)) || day : day;
        put(d, sess(optionById('opener'), d.date, rot++));
      } else if (slot === 'i4' || slot === 'i5') {
        const o = pickHit(slot.toUpperCase(), rot) || pickHit(slot === 'i5' ? 'I4' : 'I5', rot) || pickByType('hit', rot);
        if (o) put(day, sess(o, day.date, rot++));
      } else {
        const o = pickByType(slot, rot) || pickByType(slot === 'race' ? 'hit' : slot === 'hit' ? 'threshold' : 'hit', rot);
        if (o) put(day, sess(o, day.date, rot++));
      }
    });
    // Rennen der Woche als Einheit eintragen (Dauer grob nach Distanz).
    for (const r of w.races || []) { const d = days.find((x) => x.date === r.date); if (d) put(d, { title: `Rennen: ${r.name}`, sport: raceSport(r.technique, r.date), minutes: Math.round((Number(r.distanceKm) || 15) * 3.2 + 40), zone: 'I4', description: 'Inkl. Ein- und Auslaufen', kind: 'race' }); }
    // 2) Lange Einheit (ca. 22 % der Woche, 1,5–3,5 h), nicht in Renn-/Taperwochen mit Rennen am Wochenende.
    const raceOnLong = (w.races || []).some((r) => days[longDay - 1]?.date === r.date);
    if (keys.has('long') && !raceOnLong && !['race', 'recovery'].includes(w.phase)) {
      const min = Math.round(Math.min(240, room(days[longDay - 1]), Math.max(90, total * 0.22)) / 15) * 15;
      if (min >= 60) put(days[longDay - 1], { title: 'Lange Grundlage', sport: specificSport(w.from, 1), minutes: min, zone: 'I1', description: 'Locker, viel Doppelstock, Verpflegung üben (60 g KH/h)', kind: 'long' });
    }
    // 3) Kraft auf Tage ohne harte Einheit.
    // Kraft: Vorbereitung wie gewählt, ab Wettkampfvorbereitung und in Erholungswochen höchstens 1× (Erhalt).
    const strengthN = ['base', 'build'].includes(w.phase) ? opts.strengthPerWeek ?? 2 : Math.min(1, opts.strengthPerWeek ?? 2);
    const strengthDays = days.filter((d) => !rest.has(d.dow) && d.dow !== longDay && !d.sessions.length && room(d) >= 60 && !hardUsed.has(d.dow + 1) && !raceDows.has(d.dow) && !raceDows.has(d.dow + 1) && !raceDows.has(d.dow + 2));
    // Krafttage: bevorzugte Wochentage zuerst (Standard Donnerstag und Sonntag), sonst die übrigen freien Tage.
    const prefStrength = opts.strengthDays?.length ? opts.strengthDays : [4, 7];
    const strengthPick = [...strengthDays].sort((a, b) => (prefStrength.includes(a.dow) ? 0 : 1) - (prefStrength.includes(b.dow) ? 0 : 1));
    for (let i = 0; i < strengthN && i < strengthPick.length; i++) {
      const d = strengthPick[i];
      put(d, { title: ['Kraft A – Beine schwer + Zug', 'Kraft B – Hüfte, einbeinig + Doppelstock', 'Kraft JOE – Doppelstock-Fokus'][i % 3], sport: 'strength', minutes: 60, zone: 'Kraft', description: 'Vorlage im Tab „Kraft“', kind: 'strength' });
    }
    // 4) Rest mit lockeren Einheiten füllen (45–150 min, höchstens 2 Einheiten pro Tag).
    let easy = Math.max(0, total - used);
    // Freie Plätze: erst jeder Tag einmal, dann (bei Doppeltagen) ein zweites Mal – höchstens 2 Einheiten pro Tag.
    // Zwei Einheiten am Tag nur, wenn ausdrücklich gewünscht (Double-Threshold-Tage sind ohnehin zwei Einheiten).
    // Einheiten pro Tag: Standard zwei, an den Ruhe-Einzeltagen (Standard Dienstag) nur eine.
    const singleDays = new Set(opts.singleDays ?? [2]);
    const maxFor = (d) => (singleDays.has(d.dow) ? 1 : 2);
    const cap = (d) => (rest.has(d.dow) || d.dow === longDay || raceDows.has(d.dow) ? 0 : maxFor(d) - d.sessions.length);
    const slots = [];
    for (const d of days) if (cap(d) >= 1 && !d.sessions.some((s) => s.kind === 'hard')) slots.push(d);
    for (const d of days) if (cap(d) >= (slots.includes(d) ? 2 : 1)) slots.push(d);
    if (!slots.length) slots.push(...days.filter((d) => !rest.has(d.dow) && d.dow !== longDay && !raceDows.has(d.dow)));
    let n = Math.max(0, Math.min(slots.length, Math.round(easy / 80)));
    if (n === 0 && easy >= 30) n = 1;
    let speedDone = !(keys.has('speed') && ['base', 'build', 'specific'].includes(w.phase));
    let speedLeft = pr.weak?.includes('sprint') ? 2 : 1;
    let techLeft = pr.weak?.some((x) => x === 'skate' || x === 'classic') && !['race', 'taper'].includes(w.phase) ? 1 : 0;
    const share = per?.type === 'travel' ? 0.1 : focus ? Math.min(0.2, specificShare(w.phase, w.from, pr)) : specificShare(w.phase, w.from, pr);
    for (let i = 0; i < n; i++) {
      const d = slots[i];
      const min = Math.floor(Math.min(210, room(d), Math.max(40, easy / (n - i))) / 5) * 5;
      if (min < 30) { if (room(d) < 30) continue; break; }
      const specific = (i / Math.max(1, n)) < share;
      const easySport = focus === 'tri' ? (i % 2 ? 'bike' : 'run') : fSport || focus;
      const s = { title: focus ? `Locker (${focus === 'tri' ? (i % 2 ? 'Rad' : 'Laufen') : focus === 'run' ? 'Laufen' : 'Rad'})` : 'Locker', sport: specific && !focus ? specificSport(d.date, i + (pr.weak?.includes('classic') ? 1 : 0)) : easySport || (specific ? specificSport(d.date, i) : generalSport(pr, i + rot)), minutes: min, zone: 'I1', description: 'Grundlage I1, wirklich locker', kind: 'easy' };
      // Triathlon-Block: die erste lockere Einheit der Woche als Koppeltraining Rad → Lauf (gewöhnt die Beine an den Wechsel).
      if (focus === 'tri' && i === 0 && ['build', 'specific'].includes(w.phase) && room(d) >= 80) { s.title = 'Koppeln: Rad → Lauf'; s.sport = 'bike'; s.minutes = 80; s.description = 'Rad 60 min locker, direkt danach Lauf 20 min locker. Der Wechsel Rad → Lauf ist im Triathlon der Knackpunkt.'; }
      if (specific && techLeft > 0) { s.title = 'Locker + Technik'; s.description = `Grundlage I1 mit Technikübungen (${pr.weak?.includes('classic') ? 'Klassisch: Abstoß, Gleiten auf einem Ski' : 'Skating: Gewichtsverlagerung, Eins-zu-eins, ohne Stöcke'}), gern Video`; techLeft--; }
      if (!speedDone && specific && s.title === 'Locker') { s.title = 'Locker + Sprints'; s.description = 'Grundlage I1, gegen Ende 6–8× 10–15 s Sprint mit voller Pause'; speedLeft--; if (speedLeft <= 0) speedDone = true; }
      // Wer es nicht so ernst nimmt, legt die Sportart nicht fest: locker nach Lust (Spaß-Fokus außerhalb des Winters,
      // ambitioniert im Frühjahr/Frühsommer). Leistungsorientierte bekommen feste Sportarten.
      if (!focus && !specific && s.title === 'Locker' && flexible(pr, d.date)) {
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

function session(o, date, i, when = '', focusSport = null) {
  const sport = o.sport === 'specific' ? (focusSport || specificSport(date, i)) : o.sport;
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
