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
  mobility: 'Mobilität (Aufwärmen)',
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
  // Ergänzt nach dem JOE-Programm „Strength Training for XC-Skiers“ (Schwerpunkt Doppelstock)
  { id: 'lunge', name: 'Ausfallschritte vor/rück', cat: 'single_leg', type: 'weight', muscles: 'Beine, Gesäß', why: 'Einbeinige Kraft und Stabilität, Abdruck im Klassisch und Skating', cues: 'Großer Schritt, hinteres Knie Richtung Boden' },
  { id: 'box_leg_ext', name: 'Box-Beinstreckung (Step-up mit Kniehub)', cat: 'single_leg', type: 'weight', muscles: 'Beine, Gesäß, Hüftbeuger', why: 'Vollständige Hüft- und Kniestreckung auf einem Bein wie im Abdruck', cues: 'Oben ganz strecken, gegenüberliegendes Knie hochziehen' },
  { id: 'single_leg_press', name: 'Einbeinige Beinpresse', cat: 'single_leg', type: 'weight', muscles: 'Beine', why: 'Hohe einbeinige Last, Seitenunterschiede erkennen', cues: 'Knie über dem Fuß, nicht ganz durchstrecken' },
  { id: 'pelvic_tilt', name: 'Beckenkippen (Pelvic Tilt)', cat: 'core', type: 'reps', muscles: 'Tiefe Bauchmuskeln, Beckenboden', why: 'Becken-Kontrolle: Grundlage für die Rumpfspannung im Doppelstock', cues: 'Rückenlage, unteren Rücken in den Boden drücken, Becken kippen' },
  { id: 'core_roll', name: 'Rumpfrolle vorwärts/rückwärts (Gymnastikball)', cat: 'core', type: 'reps', muscles: 'Bauch, Lat, Schulter', why: 'Anti-Extension und Kopplung Arme–Rumpf wie im Stockeinsatz', cues: 'Unterarme auf dem Ball, Rumpf fest, nur so weit rollen wie der Rücken neutral bleibt' },
  { id: 'hip_to_bar', name: 'Hüfte zur Stange (hängend)', cat: 'core', type: 'reps', muscles: 'Bauch, Hüftbeuger, Lat', why: 'Kraftvolles Einklappen des Rumpfs wie im Doppelstock', cues: 'Aus dem Hang Becken einrollen, Hüfte Richtung Stange' },
  { id: 'cable_crunch', name: 'Crunch am Kabelzug (kniend)', cat: 'core', type: 'weight', muscles: 'Gerader Bauch', why: 'Belastbare Bauchkraft für das Einklappen im Doppelstock', cues: 'Hüfte bleibt stehen, Brust zum Becken rollen' },
  { id: 'med_ball_dp', name: 'Medizinball-Doppelstock', cat: 'specific', type: 'reps', muscles: 'Lat, Trizeps, Rumpf', why: 'Explosive Doppelstock-Bewegung mit Widerstand', cues: 'Ball über Kopf, mit gestreckten Armen kraftvoll nach unten/vorne werfen, Rumpf klappt mit' },
  { id: 'bench_dp', name: 'Bank-Doppelstock (Kabel oder Kurzhanteln)', cat: 'specific', type: 'weight', muscles: 'Lat, Trizeps, hintere Schulter', why: 'Isolierte Doppelstock-Zugbewegung mit hoher Last', cues: 'Bauchlage auf der (Schräg-)Bank, Arme leicht gebeugt von vorne nach hinten an der Hüfte vorbei ziehen' },
  { id: 'mob_diagonal', name: 'Diagonale Rotationsdehnung', cat: 'mobility', type: 'time', muscles: 'Brustwirbelsäule, Hüfte', why: 'Rotation für Diagonalschritt und Skating', cues: 'Ausfallschritt, gegenüberliegenden Arm nach oben aufdrehen' },
  { id: 'mob_squat', name: 'Tiefe Hocke (Squat-Dehnung)', cat: 'mobility', type: 'time', muscles: 'Hüfte, Sprunggelenk', why: 'Beweglichkeit für Kniebeugen und tiefe Abfahrtshocke', cues: 'Fersen am Boden, Ellbogen drücken Knie nach außen' },
  { id: 'mob_chest', name: 'Brustdehnung an der Bank (lange/kurze Arme)', cat: 'mobility', type: 'time', muscles: 'Brust, Lat, Schulter', why: 'Öffnet die Schulter für einen langen Stockeinsatz', cues: 'Kniend, Ellbogen (kurz) bzw. Hände (lang) auf die Bank, Brust sinken lassen' },
  { id: 'mob_cobra', name: '„Kobra“', cat: 'mobility', type: 'time', muscles: 'Bauch, Hüftbeuger', why: 'Gegenbewegung zum vielen Einklappen', cues: 'Bauchlage, Oberkörper auf die Hände hochdrücken, Becken bleibt am Boden' },
  { id: 'mob_pigeon', name: '„Taube“ (Pigeon)', cat: 'mobility', type: 'time', muscles: 'Gesäß, Hüftrotatoren', why: 'Hüftbeweglichkeit für Skating', cues: 'Vorderes Bein angewinkelt vor dem Körper, hinteres lang, Becken gerade' },
];

// Techniktipps je Übung: Aufbau, Ausführung, typische Fehler.
const TECH = {
  back_squat: ['Stange auf dem oberen Rücken (nicht Nacken), Hände eng, Ellbogen unter die Stange.', 'Einatmen und Bauch fest (Bracing), dann Hüfte nach hinten-unten.', 'Knie zeigen in Richtung Fußspitzen, Fersen bleiben am Boden.', 'Fehler: Knie fallen nach innen, Rücken rundet unten („Butt Wink“), Fersen heben ab.'],
  half_squat: ['Tiefe mit einer Box oder Bank auf 90° Kniewinkel markieren.', 'Absenken kontrolliert (2 s), Aufwärtsphase so explosiv wie möglich – auf die Geschwindigkeit kommt es an.', 'Schwere Lasten (3–5 Wdh.) nur mit sauberer Technik und Sicherung (Rack, Ablagen).', 'Fehler: zu tief und dadurch zu leicht, oder Rücken kippt nach vorne.'],
  deadlift: ['Stange über der Fußmitte, Schienbeine fast an der Stange.', 'Schulterblätter nach hinten-unten („Achseln zusperren“), Rücken neutral, Bauch fest.', 'Boden wegdrücken, Stange am Körper entlang führen, oben Hüfte strecken ohne Hohlkreuz.', 'Fehler: runder Rücken, Hüfte schießt zuerst hoch, Stange entfernt sich vom Körper.'],
  trap_bar: ['Mittig in der Stange stehen, Griffe auf Höhe der Fußmitte.', 'Hüfte und Knie gleichzeitig strecken – mehr Kniebeuge-Anteil als beim klassischen Kreuzheben.', 'Brust stolz, Blick nach vorne-unten.', 'Fehler: Schultern runden nach vorne, oben ins Hohlkreuz lehnen.'],
  hip_thrust: ['Schulterblätter an der Bankkante, Stange mit Polster über der Hüfte.', 'Füße so stellen, dass oben die Schienbeine senkrecht sind.', 'Kinn zur Brust, Becken leicht einrollen, Gesäß oben 1 s anspannen.', 'Fehler: Hohlkreuz statt Hüftstreckung, Druck über die Zehen.'],
  leg_press: ['Füße schulterbreit mittig auf der Platte.', 'Nur so tief, wie das Becken am Polster bleibt.', 'Knie nicht ganz durchstrecken, Kraft über die ganze Fußsohle.', 'Fehler: Gesäß hebt ab, Knie fallen nach innen.'],
  pullup: ['Aus dem vollen Hang starten, Schultern zuerst aktiv nach unten ziehen.', 'Brust zur Stange, Ellbogen Richtung Hüfte.', 'Kontrolliert ablassen (2–3 s), ohne Schwung.', 'Ab 8–10 sauberen Wiederholungen Zusatzgewicht, für Maximalkraft 3–6 Wdh.'],
  lat_pulldown: ['Oberschenkel fixiert, leicht zurückgelehnt.', 'Schultern tief, Stange zur oberen Brust ziehen.', 'Langsam zurück bis die Arme gestreckt sind.', 'Fehler: mit dem Oberkörper reißen, Stange in den Nacken.'],
  straight_arm_pulldown: ['Am hohen Kabel, Arme fast gestreckt, leichte Vorlage.', 'Bewegung startet aus dem Lat, Rumpf klappt wie im Doppelstock mit ein.', 'Griff endet an der Hüfte, kurz halten, langsam zurück.', 'Fehler: Ellbogen stark beugen (wird zum Trizepsdrücken), Schultern ziehen hoch.'],
  bench_press: ['Schulterblätter zusammen und nach unten, leichter Bogen, Füße fest am Boden.', 'Stange auf die untere Brust ablassen, Ellbogen ca. 45° zum Körper.', 'Explosiv hochdrücken, mit Sicherung oder Partner.', 'Fehler: Gesäß hebt ab, Ellbogen 90° seitlich (Schulterstress).'],
  dips: ['Schultern tief und nach hinten, Oberkörper leicht vorgeneigt.', 'Bis ca. 90° Ellbogenwinkel absenken – tiefer nur mit guter Schulterbeweglichkeit.', 'Kräftig hochdrücken bis die Arme gestreckt sind – das ist das Ende des Stockschubs.', 'Fehler: Schultern rutschen zu den Ohren, zu tief und mit Schwung.'],
  bent_row: ['Hüfte zurück, Oberkörper ca. 45°, Rücken neutral.', 'Stange zum Bauchnabel ziehen, Schulterblätter zusammen.', 'Kontrolliert ablassen.', 'Fehler: Rücken rundet, Oberkörper richtet sich beim Ziehen auf.'],
  triceps_pushdown: ['Ellbogen eng am Körper fixieren.', 'Bis zur vollen Streckung drücken, kurz halten.', 'Langsam zurück bis ca. 90°.', 'Fehler: Ellbogen wandern nach vorne, Oberkörper hilft mit.'],
  dp_erg: ['Hoch ansetzen, Stöcke bzw. Griffe vor dem Körper.', 'Kraft aus dem Einklappen des Rumpfs, Arme folgen; Hüfte geht leicht zurück.', 'Sprints 10–15 s maximal mit voller Pause (2–3 min) – Qualität vor Menge.', 'Fehler: nur aus den Armen ziehen, Knie zu stark beugen.'],
  box_jump: ['Kiste wählen, die du sicher erreichst – Höhe ist nicht das Ziel.', 'Ausholen mit den Armen, explosiv abspringen.', 'Weich und leise in halber Hocke landen, Knie über den Füßen; heruntersteigen statt springen.', 'Wenige, hochwertige Sprünge (3–6) mit voller Pause.'],
  skater_jump: ['Aus einem Bein seitlich so weit wie möglich abspringen.', 'Auf dem anderen Bein stabil landen und 1 s halten (Knie über dem Fuß, Hüfte gerade).', 'Später flüssig hin und her mit kurzer Bodenkontaktzeit.', 'Fehler: Knie knickt nach innen, Oberkörper kippt zur Seite.'],
  squat_jump: ['Hüftbreit, kurz in die Hocke (ca. 90°).', 'Explosiv maximal hoch, Arme schwingen mit.', 'Weich landen und neu ansetzen.', 'Fehler: steif landen, zu viele Wiederholungen (dann nicht mehr explosiv).'],
  bounding: ['Am Hang 8–12 % Steigung, 10–20 s.', 'Kräftiger Abdruck aus Sprung- und Kniegelenk, Arme/Stöcke diagonal aktiv.', 'Lange Flugphase, aktive Landung unter dem Körperschwerpunkt.', 'Zwischen den Wiederholungen locker zurückgehen.'],
  med_ball_slam: ['Ball über Kopf, auf die Zehen strecken.', 'Rumpf explosiv einklappen und Ball vor den Füßen auf den Boden schmettern.', 'In der Hocke aufnehmen, Rücken neutral.', 'Fehler: nur aus den Armen werfen.'],
  bulgarian_split: ['Hinterer Fuß auf der Bank, vorderer Fuß so weit vorne, dass das Knie über dem Fuß bleibt.', 'Senkrecht absenken, Oberkörper leicht vor.', 'Über die Ferse des vorderen Fußes hochdrücken.', 'Fehler: Knie fällt nach innen, Hüfte kippt.'],
  step_up: ['Kasten so hoch, dass das Knie ca. 90° gebeugt ist.', 'Nur mit dem oberen Bein drücken – unteres Bein nicht abspringen.', 'Oben ganz aufrichten, kontrolliert absteigen.', 'Fehler: Schwung aus dem hinteren Bein.'],
  single_leg_rdl: ['Standbein leicht gebeugt, Hüfte nach hinten schieben.', 'Oberkörper und freies Bein bilden eine Linie, Hüfte bleibt parallel zum Boden.', 'Langsam absenken, über das Gesäß zurück.', 'Fehler: Hüfte dreht auf, Rücken rundet.'],
  lateral_lunge: ['Großer Schritt zur Seite, Fußspitzen nach vorne.', 'Hüfte nach hinten, Gewicht auf die Ferse, anderes Bein gestreckt.', 'Kräftig zurück in die Mitte drücken.', 'Fehler: Knie schiebt weit über die Zehen, Rücken rundet.'],
  copenhagen: ['Seitstütz, oberes Bein auf der Bank (Knie = leichter, Fuß = schwer).', 'Hüfte hochdrücken, Körper eine Linie.', '20–30 s je Seite, langsam steigern – Adduktoren reagieren stark.', 'Fehler: Hüfte sackt ab.'],
  nordic_ham: ['Fersen fixiert (Partner oder Polster), Körper gerade von Knie bis Kopf.', 'So langsam wie möglich nach vorne absenken, Hüfte nicht abknicken.', 'Mit den Händen auffangen, zurückdrücken.', 'Anfangs 3 × 3–5 Wdh., Muskelkater einplanen.'],
  calf_raise: ['Fußballen auf einer Stufe, Fersen frei.', 'Explosiv hoch auf die Zehen, oben kurz halten.', 'Langsam unter Stufenniveau absenken (3 s).', 'Auch einbeinig und mit gebeugtem Knie (Schollenmuskel).'],
  face_pull: ['Kabel auf Augenhöhe, Seil-Griff.', 'Zum Gesicht ziehen, Ellbogen hoch, Daumen zeigen nach hinten.', 'Schulterblätter zusammen, kurz halten.', 'Leichtes Gewicht, saubere Ausführung, 12–15 Wdh.'],
  plank: ['Ellbogen unter den Schultern, Körper eine Linie.', 'Gesäß und Bauch fest, Becken leicht eingerollt.', 'Lieber kürzer und sauber (20–40 s) als lange mit Hohlkreuz.', 'Steigern: Arm/Bein abheben, Gewicht auf dem Rücken.'],
  side_plank: ['Ellbogen unter der Schulter, Füße übereinander.', 'Hüfte hoch, Körper eine Linie.', 'Steigern: oberes Bein abspreizen.', 'Fehler: Hüfte sackt nach hinten oder unten.'],
  hanging_leg_raise: ['Aus dem ruhigen Hang, Schultern aktiv.', 'Becken einrollen, Beine kontrolliert anheben.', 'Langsam ablassen, kein Schwung.', 'Leichter: Knie anziehen; schwerer: gestreckte Beine bis zur Stange.'],
  pallof: ['Seitlich zum Kabel, Griff vor der Brust.', 'Arme langsam nach vorne strecken, Rumpf darf nicht mitdrehen.', '2 s halten, zurück.', 'Fehler: Hüfte dreht weg, Schultern ziehen hoch.'],
  ab_wheel: ['Kniend, Becken eingerollt, Bauch fest.', 'Nur so weit rollen, wie der Rücken nicht durchhängt.', 'Aus dem Bauch und Lat zurückziehen.', 'Fehler: Hohlkreuz, Hüfte bleibt hinten.'],
  back_ext: ['Hüftknochen knapp über dem Polster.', 'Aus der Hüfte aufrichten bis Körper eine Linie bildet.', 'Nicht überstrecken, langsam ab.', 'Steigern: Gewicht vor der Brust.'],
  lunge: ['Aufrecht, großer Schritt nach vorne oder hinten.', 'Hinteres Knie kontrolliert Richtung Boden, vorderes Knie über dem Fuß.', 'Über die vordere Ferse zurückdrücken.', 'Varianten vor, rück, seitlich (JOE-Programm) – rückwärts schont die Knie.'],
  box_leg_ext: ['Ein Fuß ganz auf der Box, Oberkörper leicht vor.', 'Über das Standbein vollständig aufrichten (Hüfte und Knie gestreckt).', 'Gleichzeitig das freie Knie dynamisch hochziehen, Arme gegengleich.', 'Langsam zurück, nicht mit dem unteren Bein abstoßen.'],
  single_leg_press: ['Fuß mittig auf der Platte, anderes Bein seitlich abstellen.', 'Knie zeigt über die Fußspitze, Becken bleibt am Polster.', 'Kontrolliert tief, explosiv drücken, nicht ganz durchstrecken.', 'Beide Seiten vergleichen – mehr als 10 % Unterschied gezielt ausgleichen.'],
  pelvic_tilt: ['Rückenlage, Knie angewinkelt, Füße am Boden.', 'Bauchnabel Richtung Wirbelsäule, unteren Rücken in den Boden drücken (Becken kippt nach hinten).', 'Halten, dann lösen – ruhig weiteratmen.', 'Basis für die Rumpfspannung: im Doppelstock genau diese Beckenposition halten.'],
  core_roll: ['Kniend, Unterarme auf dem Gymnastikball (vorwärts) bzw. Füße auf dem Ball im Stütz (rückwärts).', 'Becken eingerollt, Rumpf fest wie ein Brett.', 'Ball langsam wegrollen und zurückziehen, Rücken bleibt neutral.', 'Fehler: Hohlkreuz, Bewegung aus der Hüfte statt aus der Schulter.'],
  hip_to_bar: ['Aus dem ruhigen Hang, Schultern aktiv nach unten.', 'Becken einrollen und Hüfte mit fast gestreckten Beinen Richtung Stange heben.', 'Langsam ablassen, kein Schwung.', 'Leichter: Knie zur Brust.'],
  cable_crunch: ['Kniend vor dem hohen Kabel, Seil neben dem Kopf.', 'Hüfte bleibt stehen, Rumpf rollt Wirbel für Wirbel nach unten (Brust zum Becken).', 'Kurz halten, langsam aufrollen.', 'Fehler: mit der Hüfte nach hinten sitzen statt einrollen.'],
  med_ball_dp: ['Stehend oder kniend, Ball mit gestreckten Armen über dem Kopf.', 'Wie im Doppelstock: Rumpf klappt ein, Arme ziehen gestreckt nach unten-vorne, Ball auf den Boden oder zum Partner werfen.', 'Explosiv, wenige Wiederholungen (5–8), volle Pause.', 'Fehler: Arme beugen, nur aus den Schultern werfen.'],
  bench_dp: ['Bauchlage auf der Schrägbank, Kurzhanteln oder Kabel vor dem Kopf.', 'Arme leicht gebeugt (wie beim Stockeinsatz) kräftig nach hinten an der Hüfte vorbeiziehen.', 'Am Ende Trizeps strecken, langsam zurück.', 'Fehler: Schultern hochziehen, Ellbogen stark beugen.'],
  mob_diagonal: ['Tiefer Ausfallschritt, Hand auf der Innenseite des vorderen Fußes.', 'Anderen Arm langsam zur Decke aufdrehen, Blick folgt der Hand.', '5–8 ruhige Wiederholungen je Seite.'],
  mob_squat: ['Füße etwas breiter als hüftbreit, Fußspitzen leicht außen.', 'Tief in die Hocke, Fersen am Boden, Ellbogen drücken die Knie nach außen.', '30–60 s halten, Gewicht leicht verlagern.'],
  mob_chest: ['Kniend vor der Bank, Ellbogen (kurze Arme) oder Hände (lange Arme) auf der Bank.', 'Brust Richtung Boden sinken lassen, Rücken nicht ins Hohlkreuz.', '30 s je Variante.'],
  mob_cobra: ['Bauchlage, Hände neben der Brust.', 'Oberkörper langsam hochdrücken, Becken bleibt am Boden, Schultern tief.', '20–30 s, ruhig atmen.'],
  mob_pigeon: ['Vorderes Bein angewinkelt vor dem Körper, hinteres lang nach hinten.', 'Becken gerade, Oberkörper langsam nach vorne sinken lassen.', '30–60 s je Seite.'],
};
for (const e of EXERCISES) e.tech = TECH[e.id] || null;

// Zwei Vorlagen passend zu 2 Krafteinheiten pro Woche.
export const TEMPLATES = [
  { id: 'A', name: 'Kraft A – Beine schwer + Zug', items: [
    { ex: 'half_squat', sets: 4, reps: 4 }, { ex: 'pullup', sets: 4, reps: 5 }, { ex: 'box_jump', sets: 3, reps: 5 },
    { ex: 'straight_arm_pulldown', sets: 3, reps: 8 }, { ex: 'copenhagen', sets: 2, reps: 25 }, { ex: 'hanging_leg_raise', sets: 3, reps: 10 } ] },
  { id: 'B', name: 'Kraft B – Hüfte, einbeinig + Doppelstock', items: [
    { ex: 'trap_bar', sets: 4, reps: 4 }, { ex: 'bulgarian_split', sets: 3, reps: 6 }, { ex: 'skater_jump', sets: 3, reps: 6 },
    { ex: 'dips', sets: 3, reps: 6 }, { ex: 'dp_erg', sets: 6, reps: 12 }, { ex: 'pallof', sets: 3, reps: 10 } ] },
  // JOE-Programm: Mischung aus Hypertrophie und Maximalkraft, 3 Sätze à ca. 6 Wdh., Schwerpunkt Doppelstock.
  // Vorher 10–15 min locker + Mobilität (Diagonal-Rotation, Hocke, Brust an der Bank, Kobra, Taube), danach max. 10 min locker.
  { id: 'JOE', name: 'Kraft JOE – Doppelstock-Fokus (3 × 6)', items: [
    { ex: 'back_squat', sets: 3, reps: 6 }, { ex: 'deadlift', sets: 3, reps: 6 }, { ex: 'lunge', sets: 3, reps: 6 }, { ex: 'box_leg_ext', sets: 3, reps: 6 },
    { ex: 'single_leg_press', sets: 3, reps: 6 }, { ex: 'pelvic_tilt', sets: 3, reps: 6 }, { ex: 'core_roll', sets: 3, reps: 6 }, { ex: 'hip_to_bar', sets: 3, reps: 6 },
    { ex: 'cable_crunch', sets: 3, reps: 6 }, { ex: 'med_ball_dp', sets: 3, reps: 6 }, { ex: 'dips', sets: 3, reps: 6 }, { ex: 'bench_dp', sets: 3, reps: 6 } ] },
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
