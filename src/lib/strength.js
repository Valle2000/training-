// Kraftkatalog mit Fokus Langlauf. Studienlage (u. a. Rønnestad, Losnegard, Sunde, Sandbakk):
// Maximalkraft mit schweren Lasten (≈3–5 Wdh., 85–90 % 1RM) und explosive Ausführung verbessern die
// Ökonomie im Doppelstock und im Skating, ohne nennenswerte Gewichtszunahme. Rumpf und einbeinige
// Stabilität ergänzen. Ziel 2 Einheiten pro Woche in der Vorbereitung, 1 zum Erhalt in der Saison.
export const CATEGORIES = {
  max_lower: 'Maximalkraft Beine',
  max_upper: 'Maximalkraft Oberkörper / Zug',
  explosive: 'Explosiv / Sprung',
  specific: 'Spezifisch Langlauf',
  single_leg: 'Einbeinig / Stabilität',
  core: 'Rumpf',
  prehab: 'Verletzungsprophylaxe',
};

// type: weight (kg), bodyweight (Zusatzgewicht optional), time (Sekunden), reps (nur Wiederholungen)
export const EXERCISES = [
  { id: 'back_squat', name: 'Kniebeuge (Langhantel)', cat: 'max_lower', type: 'weight', muscles: 'Beine, Gesäß', why: 'Grundübung für Beinkraft, Abdruck im Skating', cues: 'Hüftbreit, Knie über Fuß, bis Parallel, explosiv hoch' },
  { id: 'half_squat', name: 'Halbe Kniebeuge (schwer)', cat: 'max_lower', type: 'weight', muscles: 'Beine', why: 'Studien zu Maximalkraft und Ökonomie bei Ausdauersportlern (Rønnestad) nutzen oft halbe Tiefe', cues: '90° Kniewinkel, 3–5 Wdh., Aufwärtsphase maximal schnell' },
  { id: 'deadlift', name: 'Kreuzheben', cat: 'max_lower', type: 'weight', muscles: 'Hintere Kette', why: 'Hüftstreckung und Rumpfstabilität', cues: 'Rücken neutral, Stange nah am Körper' },
  { id: 'trap_bar', name: 'Kreuzheben Trap-Bar', cat: 'max_lower', type: 'weight', muscles: 'Beine, hintere Kette', why: 'Rückenschonende Alternative mit hoher Last', cues: 'Mittig stehen, Hüfte und Knie gleichzeitig strecken' },
  { id: 'hip_thrust', name: 'Hip Thrust', cat: 'max_lower', type: 'weight', muscles: 'Gesäß', why: 'Hüftstreckung im Abdruck', cues: 'Kinn zur Brust, oben 1 s halten' },
  { id: 'leg_press', name: 'Beinpresse', cat: 'max_lower', type: 'weight', muscles: 'Beine', why: 'Hohe Last ohne Technikanspruch', cues: 'Rücken bleibt am Polster' },
  { id: 'pullup', name: 'Klimmzug', cat: 'max_upper', type: 'bodyweight', muscles: 'Lat, Bizeps', why: 'Zugkraft für Doppelstock und Diagonal', cues: 'Ganz hängen, Brust zur Stange, ggf. Zusatzgewicht' },
  { id: 'lat_pulldown', name: 'Latzug', cat: 'max_upper', type: 'weight', muscles: 'Lat', why: 'Doppelstock-Zugkraft, dosierbar', cues: 'Schultern tief, zur Brust ziehen' },
  { id: 'straight_arm_pulldown', name: 'Überzüge am Kabel (gestreckte Arme)', cat: 'specific', type: 'weight', muscles: 'Lat, Trizeps, Rumpf', why: 'Imitiert den Stockschub im Doppelstock', cues: 'Arme fast gestreckt, aus der Hüfte einklappen' },
  { id: 'bench_press', name: 'Bankdrücken', cat: 'max_upper', type: 'weight', muscles: 'Brust, Trizeps', why: 'Allgemeine Druckkraft', cues: 'Schulterblätter zusammen, kontrolliert ab' },
  { id: 'dips', name: 'Dips', cat: 'max_upper', type: 'bodyweight', muscles: 'Trizeps, Brust', why: 'Trizepskraft für das Ende des Stockschubs', cues: 'Bis 90° Ellbogen, Oberkörper leicht vor' },
  { id: 'bent_row', name: 'Rudern vorgebeugt', cat: 'max_upper', type: 'weight', muscles: 'Rücken', why: 'Ausgleich und Zugkraft', cues: 'Rücken gerade, zum Bauchnabel ziehen' },
  { id: 'triceps_pushdown', name: 'Trizepsdrücken am Kabel', cat: 'specific', type: 'weight', muscles: 'Trizeps', why: 'Endphase Stockschub', cues: 'Ellbogen fixiert' },
  { id: 'dp_erg', name: 'Doppelstock-Zugmaschine / SkiErg-Sprints', cat: 'specific', type: 'time', muscles: 'Ganzkörper', why: 'Spezifische Kraftausdauer, kurze maximale Sprints', cues: '6–10 × 10–15 s maximal, volle Pause' },
  { id: 'box_jump', name: 'Box Jumps', cat: 'explosive', type: 'reps', muscles: 'Beine', why: 'Schnellkraft und Reaktivität', cues: 'Weich landen, kurz und explosiv, Qualität vor Menge' },
  { id: 'skater_jump', name: 'Skater-Sprünge seitlich', cat: 'explosive', type: 'reps', muscles: 'Beine, Gesäß', why: 'Spezifisch für den seitlichen Abdruck im Skating', cues: 'Weit seitlich, auf einem Bein stabil landen' },
  { id: 'squat_jump', name: 'Squat Jumps', cat: 'explosive', type: 'reps', muscles: 'Beine', why: 'Explosivkraft', cues: 'Maximal hoch, sauber landen' },
  { id: 'bounding', name: 'Sprunglauf / Skigang mit Stöcken bergauf', cat: 'explosive', type: 'time', muscles: 'Ganzkörper', why: 'Klassiker im Langlauftraining, spezifische Schnellkraft', cues: 'Weit und dynamisch, Stockeinsatz aktiv' },
  { id: 'med_ball_slam', name: 'Medizinball-Slams', cat: 'explosive', type: 'reps', muscles: 'Rumpf, Lat', why: 'Explosives Einklappen wie im Doppelstock', cues: 'Ganzer Körper, Ball kräftig nach unten' },
  { id: 'bulgarian_split', name: 'Bulgarische Kniebeuge', cat: 'single_leg', type: 'weight', muscles: 'Beine, Gesäß', why: 'Einbeinige Kraft und Stabilität (Skating)', cues: 'Vorderes Knie stabil über Fuß' },
  { id: 'step_up', name: 'Step-ups auf Kasten', cat: 'single_leg', type: 'weight', muscles: 'Beine', why: 'Einbeiniger Abdruck', cues: 'Nur mit dem oberen Bein drücken' },
  { id: 'single_leg_rdl', name: 'Einbeiniges Kreuzheben', cat: 'single_leg', type: 'weight', muscles: 'Hintere Kette, Balance', why: 'Hüftstabilität, Balance auf einem Ski', cues: 'Hüfte bleibt gerade' },
  { id: 'lateral_lunge', name: 'Seitliche Ausfallschritte', cat: 'single_leg', type: 'weight', muscles: 'Adduktoren, Gesäß', why: 'Seitliche Kraft für Skating', cues: 'Gewicht auf die Ferse' },
  { id: 'copenhagen', name: 'Copenhagen Plank', cat: 'prehab', type: 'time', muscles: 'Adduktoren', why: 'Leistenprophylaxe, wichtig beim Skating', cues: 'Hüfte hoch, 20–30 s je Seite' },
  { id: 'nordic_ham', name: 'Nordic Hamstring Curl', cat: 'prehab', type: 'reps', muscles: 'Beinrückseite', why: 'Verletzungsprophylaxe', cues: 'So langsam wie möglich absenken' },
  { id: 'calf_raise', name: 'Wadenheben', cat: 'prehab', type: 'weight', muscles: 'Waden', why: 'Klassisch-Abdruck und Achillessehne', cues: 'Langsam ab, explosiv hoch' },
  { id: 'face_pull', name: 'Face Pulls', cat: 'prehab', type: 'weight', muscles: 'Hintere Schulter', why: 'Schultergesundheit bei viel Stockarbeit', cues: 'Ellbogen hoch, Daumen nach hinten' },
  { id: 'plank', name: 'Unterarmstütz', cat: 'core', type: 'time', muscles: 'Rumpf', why: 'Rumpfstabilität', cues: 'Körper eine Linie' },
  { id: 'side_plank', name: 'Seitstütz', cat: 'core', type: 'time', muscles: 'Seitlicher Rumpf', why: 'Stabilität in der Gleitphase', cues: 'Hüfte hoch' },
  { id: 'hanging_leg_raise', name: 'Beinheben hängend', cat: 'core', type: 'reps', muscles: 'Bauch, Hüftbeuger', why: 'Rumpfkraft im Doppelstock', cues: 'Ohne Schwung' },
  { id: 'pallof', name: 'Pallof Press', cat: 'core', type: 'weight', muscles: 'Rumpf (Anti-Rotation)', why: 'Stabil gegen Drehung', cues: 'Arme strecken, nicht mitdrehen' },
  { id: 'ab_wheel', name: 'Bauchroller', cat: 'core', type: 'reps', muscles: 'Bauch, Lat', why: 'Anti-Extension, Kopplung Rumpf und Arme', cues: 'Becken kippen, Rücken nicht durchhängen' },
  { id: 'back_ext', name: 'Rückenstrecker', cat: 'core', type: 'weight', muscles: 'Unterer Rücken', why: 'Ausgleich zum Einklappen', cues: 'Kontrolliert, nicht überstrecken' },
];

// Zwei Vorlagen passend zu 2 Krafteinheiten pro Woche.
export const TEMPLATES = [
  { id: 'A', name: 'Kraft A – Beine schwer + Zug', items: [
    { ex: 'half_squat', sets: 4, reps: 4 }, { ex: 'pullup', sets: 4, reps: 5 }, { ex: 'box_jump', sets: 3, reps: 5 },
    { ex: 'straight_arm_pulldown', sets: 3, reps: 8 }, { ex: 'copenhagen', sets: 2, reps: 25 }, { ex: 'hanging_leg_raise', sets: 3, reps: 10 } ] },
  { id: 'B', name: 'Kraft B – Hüfte, einbeinig + Doppelstock', items: [
    { ex: 'trap_bar', sets: 4, reps: 4 }, { ex: 'bulgarian_split', sets: 3, reps: 6 }, { ex: 'skater_jump', sets: 3, reps: 6 },
    { ex: 'dips', sets: 3, reps: 6 }, { ex: 'dp_erg', sets: 6, reps: 12 }, { ex: 'pallof', sets: 3, reps: 10 } ] },
];

export const exerciseById = (id, custom = []) => [...EXERCISES, ...custom].find((e) => e.id === id);

// Geschätztes 1RM nach Epley (nur sinnvoll bis ~10 Wdh.).
export const e1rm = (kg, reps) => (kg && reps ? (reps === 1 ? kg : kg * (1 + reps / 30)) : null);

// Bestwerte und Verlauf einer Übung über alle Krafteinheiten.
export function exerciseHistory(sessions, exId, bodyWeight = 0) {
  const rows = [];
  for (const s of sessions) for (const it of s.items || []) {
    if (it.ex !== exId) continue;
    const sets = (it.sets || []).filter((x) => x.reps || x.sec);
    if (!sets.length) continue;
    const ex = exerciseById(exId);
    const load = (x) => (ex?.type === 'bodyweight' ? bodyWeight + (Number(x.kg) || 0) : Number(x.kg) || 0);
    const best = Math.max(...sets.map((x) => e1rm(load(x), Number(x.reps)) || 0));
    const volume = sets.reduce((a, x) => a + load(x) * (Number(x.reps) || 0), 0);
    rows.push({ date: s.date, sets, best: best || null, volume });
  }
  return rows.sort((a, b) => a.date.localeCompare(b.date));
}

export const lastSets = (sessions, exId) => {
  const h = exerciseHistory(sessions, exId);
  return h.length ? h.at(-1) : null;
};
