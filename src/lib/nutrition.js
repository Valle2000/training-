// Ernährungsziele nach Trainingsumfang. Grundlage: IOC-Konsens und ACSM/ISSN-Positionspapiere
// (Burke et al.; Thomas, Erdman & Burke 2016): Kohlenhydrate nach Umfang und Intensität periodisieren,
// Eiweiß 1,6–2,0 g/kg über den Tag verteilt, im Training über 90 min 60–90 g KH pro Stunde.
// minutes: Trainingszeit des Tages, longestMinutes: längste Ausdauereinheit (für KH während des Trainings).
export function dayTargets({ weightKg, minutes = 0, hardMinutes = 0, strength = false, longestMinutes = minutes }) {
  if (!weightKg) return null;
  let carbs; // g/kg
  if (minutes < 30) carbs = 3.5;
  else if (minutes < 75) carbs = 5;
  else if (minutes < 150) carbs = 6.5;
  else if (minutes < 240) carbs = 8;
  else carbs = 10;
  if (hardMinutes >= 30) carbs += 1; // Schwelle/Intervalle brauchen Glykogen
  const protein = strength || minutes >= 120 ? 2.0 : 1.7;
  const fat = 1.1;
  const g = { carbs: Math.round(carbs * weightKg), protein: Math.round(protein * weightKg), fat: Math.round(fat * weightKg) };
  const kcal = g.carbs * 4 + g.protein * 4 + g.fat * 9;
  const duringPerHour = longestMinutes >= 150 ? 90 : longestMinutes >= 90 ? 60 : longestMinutes >= 60 ? 30 : 0;
  const level = minutes >= 150 || hardMinutes >= 30 ? 'hoch' : minutes >= 60 ? 'mittel' : 'niedrig';
  return { ...g, kcal, perKg: { carbs, protein, fat }, duringPerHour, level };
}

// ——— Tagestipp und Tagesvorschlag aus dem Katalog ———
import { CATALOG, fitsDiet, scaleFor } from './recipes.js';
import { nutrientsOf } from './foods.js';

const sum = (list, k) => list.reduce((a, x) => a + (x[k] || 0), 0);
const isEndurance = (x) => x.sport !== 'strength' && x.sport !== 'mobility';
const hourOf = (x) => (x.time ? Number(String(x.time).split(':')[0]) : null);

// Einordnung eines Trainingstags: Umfang, harte Minuten, Zeitpunkt, Doppeleinheit.
export function dayKind(training = []) {
  const end = training.filter(isEndurance);
  const minutes = sum(end, 'minutes'), hard = sum(training, 'hard'), longest = Math.max(0, ...end.map((x) => x.minutes));
  const first = hourOf(training.find((x) => x.time) || {});
  return {
    minutes, hard, longest, sessions: end.length, rest: !training.length,
    isHard: hard >= 20 || training.some((x) => x.race), isLong: longest >= 90,
    morning: first == null ? null : first < 12, double: end.length >= 2,
    strength: training.some((x) => x.sport === 'strength'),
  };
}

const MICRO_ROTATION = [
  { key: 'eisen', title: 'Eisen', text: 'Eisenreich essen und mit Vitamin C kombinieren (z. B. Linsencurry mit Paprika, Hirse mit Spinat). Kaffee und Tee mit 1 h Abstand.' },
  { key: 'vitd', title: 'Vitamin D', text: 'Im Winterhalbjahr bildet die Haut kaum Vitamin D. Fisch (Lachs, Forelle, Sardinen) und Eier helfen; den Spiegel einmal pro Saison messen lassen.' },
  { key: 'calcium', title: 'Calcium für die Knochen', text: 'Milchprodukte, angereicherte Pflanzendrinks, Sardinen mit Gräten oder Grünkohl – 1000 mg am Tag schützen zusammen mit genug Energie vor Stressfrakturen.' },
  { key: 'omega3', title: 'Omega-3', text: 'Heute Fisch oder Leinöl/Walnüsse einbauen. 1–2 Fischmahlzeiten pro Woche decken EPA/DHA.' },
  { key: 'magnesium', title: 'Magnesium und Kalium', text: 'Haferflocken, Kürbiskerne, Hülsenfrüchte, Kartoffeln und Bananen – gerade an umfangreichen Tagen mit viel Schweiß.' },
  { key: 'b1', title: 'B-Vitamine', text: 'Viel Training = mehr Energieumsatz = mehr B1/B2/B6. Vollkorn, Haferflocken, Hülsenfrüchte, Milchprodukte und Sonnenblumenkerne decken das – Weißmehl und Zucker kaum.' },
  { key: 'vita', title: 'Vitamin A und Beta-Carotin', text: 'Karotten, Süßkartoffeln, Kürbis, Spinat oder Grünkohl – mit etwas Fett gegessen wird Beta-Carotin besser aufgenommen. Gut fürs Immunsystem in der Infektzeit.' },
  { key: 'bunt', title: 'Bunt statt Pillen', text: 'Fünf Portionen Obst und Gemüse in verschiedenen Farben. Hochdosierte Antioxidantien-Präparate können Trainingsanpassungen dämpfen.' },
];
const dayOfYear = (iso) => Math.floor((Date.parse(iso) - Date.parse(iso.slice(0, 4) + '-01-01')) / 864e5);

// Bis zu vier Tipps für heute, nach Wichtigkeit.
// today/tomorrow: Training (wie trainingOf), weightKg, heat: heute heiß, sweat: gespeicherte Schweißrate, raceSoon: Rennen in ≤ 2 Tagen
export function nutritionTips({ date, today = [], tomorrow = [], weightKg, heat = false, sweat = null, raceSoon = null, symptoms = false, cold = false }) {
  const w = Number(weightKg) || 70, t = dayKind(today), n = dayKind(tomorrow), out = [];
  const g = (perKg) => Math.round((perKg * w) / 5) * 5;
  if (raceSoon) out.push({ prio: 10, title: raceSoon.long ? 'Carboloading' : 'Rennen steht an', text: raceSoon.long ? `Rennen über 90 min in ${raceSoon.days === 0 ? 'heute' : raceSoon.days === 1 ? '1 Tag' : raceSoon.days + ' Tagen'}: heute ${g(10)}–${g(12)} g Kohlenhydrate, wenig Ballaststoffe und Fett. Nichts Neues ausprobieren.` : `Am Vortag ${g(7)}–${g(8)} g Kohlenhydrate, Renntag 3–4 h vorher ${g(1.5)}–${g(2.5)} g (Porridge, Weißbrot, Milchreis).` });
  if (t.isHard && t.double) out.push({ prio: 9, title: 'Double Threshold: zwischen den Einheiten auffüllen', text: `Direkt nach der ersten Einheit ${g(1)} g Kohlenhydrate und ${g(0.3)} g Eiweiß, bis zur zweiten Einheit pro Stunde ca. ${g(1)} g KH – sonst startest du die Nachmittagseinheit mit halbleeren Speichern.` });
  else if (t.isHard) out.push({ prio: 8, title: 'Harte Einheit heute', text: `${t.morning === false ? 'Mittagessen 3 h vorher kohlenhydratreich, 30–60 min vorher ein Snack (Banane, Toast).' : `Frühstück 2–3 h vorher mit ca. ${g(1.5)} g Kohlenhydraten, wenig Fett und Ballaststoffen.`} Danach innerhalb 1 h ${g(0.8)}–${g(1)} g KH plus ${g(0.3)} g Eiweiß (z. B. Recovery-Kakao).` });
  if (t.isLong) {
    const perH = t.longest >= 150 ? 90 : 60;
    const drink = sweat?.drinkPerHour ? `${String(sweat.drinkPerHour).replace('.', ',')} l und ca. ${sweat.sodiumPerHour} mg Natrium pro Stunde (deine Schweißrate)` : '0,5–0,8 l pro Stunde mit etwas Natrium';
    out.push({ prio: 7, title: `Lange Einheit (${String(Math.round(t.longest / 6) / 10).replace('.', ',')} h): unterwegs essen`, text: `${perH} g Kohlenhydrate pro Stunde${perH === 90 ? ' mit Glukose + Fruktose' : ''}, ${drink}. Ab der ersten halben Stunde beginnen, nicht erst bei Hunger.` });
  }
  if (heat) out.push({ prio: 9, title: 'Hitze', text: `Gut hydriert starten (2–4 h vorher ca. ${Math.round(w * 6 / 50) * 50} ml mit etwas Salz). Unterwegs kühl trinken, ${sweat?.sodiumPerL ? `ca. ${sweat.sodiumPerL} mg Natrium pro Liter` : '500–1000 mg Natrium pro Liter'}. Harte Einheiten in die kühlen Morgenstunden; der Puls liegt bei gleicher Leistung höher. Danach 1,5 l pro kg Gewichtsverlust trinken.` });
  if (!raceSoon && (n.isHard || n.isLong) && !t.isHard) out.push({ prio: 6, title: 'Morgen hart oder lang', text: `Heute Abend die Speicher füllen: ca. ${g(1.5)}–${g(2)} g Kohlenhydrate zum Abendessen (Pasta, Reis, Kartoffeln) – Katalog „Abendessen“ mit „Harte Einheit“.` });
  if (!t.isHard && !t.rest && t.minutes <= 90 && !n.isHard && !raceSoon && !heat && !symptoms) out.push({ prio: 3, title: 'Option Train Low', text: `Lockere Einheit unter 90 min: kann gelegentlich (1–2× pro Woche) nüchtern oder nach einem eiweißreichen Frühstück stattfinden – Fettstoffwechsel-Reiz. Nicht in Phasen mit sehr viel Umfang oder bei Infektzeichen.` });
  if (t.rest) out.push({ prio: 4, title: 'Ruhetag', text: `Weniger Kohlenhydrate (${g(3)}–${g(5)} g), aber nicht hungern: Eiweiß über den Tag verteilen (4× ${g(0.3)} g) und viel Gemüse – Regeneration passiert jetzt.` });
  if (t.strength) out.push({ prio: 5, title: 'Krafttraining', text: `Nach dem Krafttraining ${g(0.3)}–${g(0.4)} g Eiweiß (20–40 g), vor dem Schlafen z. B. 250 g Magerquark.` });
  if (symptoms) out.push({ prio: 9, title: 'Infektzeichen', text: 'Genug essen (kein Defizit), viel trinken, Obst und Gemüse; bei beginnender Erkältung können Zink-Lutschtabletten für ein paar Tage die Dauer verkürzen. Training reduzieren.' });
  if (cold && !heat) out.push({ prio: 4, title: 'Kälte', text: 'In der Kälte wird zu wenig getrunken: warmes Getränk in die Isolierflasche, Riegel/Gels nah am Körper tragen, damit sie nicht hart werden. Der Energiebedarf ist höher.' });
  const m = MICRO_ROTATION[dayOfYear(date) % MICRO_ROTATION.length];
  out.push({ prio: 2, title: `Mikronährstoff des Tages: ${m.title}`, text: m.text, micro: m.key });
  return out.sort((a, b) => b.prio - a.prio).slice(0, 4);
}

// Tagesvorschlag aus dem Katalog, abgestimmt auf Training heute und morgen. seed sorgt für Abwechslung.
export function suggestDay({ today = [], tomorrow = [], diet = 'alles', heat = false, seed = 0, trainLow = true, offsets = {} }) {
  const t = dayKind(today), n = dayKind(tomorrow);
  const used = new Set();
  // Rote-Bete-Shot und Carboloading-Baustein nur gezielt (Rennen), nicht im Alltagsvorschlag.
  const SPECIAL = new Set(['rote-bete-shot', 'carboload-tag', 'quark-abend-casein']);
  const take = (list, k) => { const r = list[((seed + k) % list.length + list.length) % list.length]; if (r) used.add(r.id); return r; };
  const free = (r) => !used.has(r.id) && !SPECIAL.has(r.id) && fitsDiet(r, diet);
  const pick = (slot, ctxs, k = 0) => {
    for (const ctx of ctxs) {
      const list = CATALOG.filter((r) => r.slots.includes(slot) && r.ctx.includes(ctx) && free(r));
      if (list.length) return take(list, k);
    }
    const any = CATALOG.filter((r) => r.slots.includes(slot) && free(r));
    return take(any.length ? any : CATALOG.filter((r) => r.slots.includes(slot) && fitsDiet(r, diet)), k);
  };
  const meals = [];
  // role: Aufgabe der Mahlzeit im Tag (für die Verteilung), offsets[role] tauscht einzelne Rezepte.
  const add = (role, slot, label, ctxs, k = 0) => meals.push({ role, slot, label, r: pick(slot, ctxs, k + (offsets[role] || 0)) });
  const lowOk = trainLow && !t.isHard && !t.rest && t.minutes <= 90 && t.morning !== false && !heat;
  add('breakfast', 'fruehstueck', 'Frühstück', t.isHard || t.isLong ? ['hart'] : lowOk ? ['trainlow', 'locker'] : ['locker', 'ruhetag']);
  if (!t.rest && t.morning === false) add('preLunch', 'mittag', 'Mittagessen (3 h vor dem Training)', t.isHard ? ['hart'] : ['locker']);
  if (!t.rest && (t.isHard || t.morning === false)) add('pre', 'vorher', t.double ? 'Snack vor der 2. Einheit' : 'Snack vor dem Training', t.isHard ? ['hart'] : ['locker'], 1);
  if (t.longest >= 75) add('during', 'waehrend', `Unterwegs (${String(Math.round(t.longest / 6) / 10).replace('.', ',')} h Einheit)`, heat ? ['hitze'] : t.isHard || t.longest >= 150 ? ['hart'] : ['locker']);
  if (t.isHard || t.minutes >= 90) add('post', 'nachher', t.double ? 'Direkt nach der 1. Einheit' : 'Direkt danach', heat ? ['hitze', 'hart'] : ['hart', 'locker']);
  if (t.morning !== false || t.rest) add('lunch', 'mittag', 'Mittagessen', t.isHard || t.minutes >= 90 ? ['hart'] : n.isHard ? ['hart', 'locker'] : t.rest ? ['locker', 'ruhetag'] : ['locker', 'trainlow'], 2);
  add('snack', 'snack', 'Snack', t.isHard ? ['hart', 'locker'] : ['locker', 'ruhetag'], 3);
  const eveningCtx = n.isHard || n.isLong || t.isHard || t.minutes >= 150 ? ['hart'] : n.rest || t.rest ? ['locker', 'ruhetag'] : trainLow && !t.isHard && n.minutes <= 90 ? ['trainlow', 'locker'] : ['locker', 'hart'];
  add('dinner', 'abend', n.isHard || n.isLong ? 'Abendessen (Speicher für morgen füllen)' : 'Abendessen', eveningCtx, 4);
  if (t.isHard || t.strength) {
    const q = CATALOG.find((r) => r.id === 'quark-abend-casein' && fitsDiet(r, diet));
    if (q && !offsets.bed) meals.push({ role: 'bed', slot: 'snack', label: 'Vor dem Schlafen', r: q });
    else add('bed', 'snack', 'Vor dem Schlafen', ['ruhetag', 'locker'], 5);
  }
  return meals.filter((m) => m.r);
}

// Tagesplan: Tagesbedarf auf die Mahlzeiten verteilen (nach Trainingszeitpunkt und -art) und jede Portion so
// skalieren, dass sie ihr Mahlzeitenziel trifft. Kohlenhydrate: feste Mengen rund ums Training (vorher, während,
// danach), der Rest auf die Hauptmahlzeiten; Eiweiß ca. 0,3–0,4 g/kg pro Hauptmahlzeit.
export function planDay({ today = [], tomorrow = [], targets, weightKg, diet, heat, seed, trainLow, offsets }) {
  const w = Number(weightKg) || 70, t = dayKind(today), n = dayKind(tomorrow);
  const meals = suggestDay({ today, tomorrow, diet, heat, seed, trainLow, offsets });
  if (!targets) return { meals: meals.map((m) => ({ ...m, factor: scaleFor(w) })), totals: null, targets: null };
  const hours = Math.max(1, t.longest / 60);
  const fixedCarb = {
    breakfast: t.isHard || t.isLong ? (t.morning === false ? 1.2 : 1.5) : t.rest ? null : (t.morning !== false && trainLow && !t.isHard && t.minutes <= 90 ? 0.5 : null),
    preLunch: t.isHard ? 1.5 : 1.0, pre: 0.6, during: (targets.duringPerHour || 30) / w * hours, post: t.isHard || t.double ? 1.0 : 0.8, bed: 0.3,
  };
  const share = { breakfast: 1, lunch: 1.2, snack: 0.5, dinner: n.isHard || n.isLong || t.isHard ? 1.5 : trainLow && !t.isHard && !n.isHard && !n.rest && n.minutes <= 90 ? 0.6 : 1.1, preLunch: 1 };
  const protein = { breakfast: 0.35, preLunch: 0.3, pre: 0.05, during: 0, post: 0.3, lunch: 0.4, snack: 0.2, dinner: 0.4, bed: 0.4 };
  const carbT = {};
  let rest = targets.carbs;
  for (const m of meals) if (fixedCarb[m.role] != null) { carbT[m.role] = fixedCarb[m.role] * w; rest -= carbT[m.role]; }
  const flex = meals.filter((m) => carbT[m.role] == null);
  const shareSum = flex.reduce((a, m) => a + (share[m.role] || 1), 0) || 1;
  for (const m of flex) carbT[m.role] = Math.max(15, (Math.max(0, rest) * (share[m.role] || 1)) / shareSum);
  const out = meals.map((m) => {
    const base = nutrientsOf(m.r.items); // Rezept wie geschrieben (70-kg-Menge, Faktor 1)
    const goal = { kh: carbT[m.role], eiweiss: (protein[m.role] ?? 0.3) * w };
    // Kohlenhydratarme Rezepte nach Eiweiß skalieren, sonst nach Kohlenhydraten; Grenzen halten Portionen realistisch.
    const byProtein = (base.kh < 20 || m.role === 'bed') && goal.eiweiss > 0;
    const raw = byProtein ? goal.eiweiss / Math.max(1, base.eiweiss) : goal.kh / Math.max(1, base.kh);
    const factor = Math.round(Math.min(m.role === 'during' ? 5 : 2.5, Math.max(0.5, raw)) * 20) / 20; // unterwegs: Menge für die ganze Einheit
    const got = nutrientsOf(m.r.items.map(([k, g]) => [k, g * factor]));
    return { ...m, factor, goal, got };
  });
  const sumUp = () => out.reduce((a, m) => ({ kcal: a.kcal + m.got.kcal, kh: a.kh + m.got.kh, eiweiss: a.eiweiss + m.got.eiweiss, fett: a.fett + m.got.fett }), { kcal: 0, kh: 0, eiweiss: 0, fett: 0 });
  let totals = sumUp();
  // Deutlich über dem Energiebedarf (eiweiß-/fettreiche Rezepte)? Hauptmahlzeiten und Snacks etwas kleiner.
  if (totals.kcal > targets.kcal * 1.08) {
    const flexible = out.filter((m) => ['lunch', 'dinner', 'snack', 'breakfast'].includes(m.role) && fixedCarb[m.role] == null);
    const flexKcal = flexible.reduce((a, m) => a + m.got.kcal, 0);
    const ratio = flexKcal ? Math.max(0.6, (targets.kcal * 1.03 - (totals.kcal - flexKcal)) / flexKcal) : 1;
    for (const m of flexible) { m.factor = Math.round(Math.max(0.5, m.factor * ratio) * 20) / 20; m.got = nutrientsOf(m.r.items.map(([k, g]) => [k, g * m.factor])); }
    totals = sumUp();
  }
  // Was noch fehlt, mit einfachen Ergänzungen auffüllen.
  const extras = [];
  const khGap = targets.carbs - totals.kh, eGap = targets.protein - totals.eiweiss;
  if (khGap > 30) extras.push(`+${Math.round(khGap)} g Kohlenhydrate ergänzen, z. B. ${Math.max(1, Math.round(khGap / 20))} Scheibe(n) Brot, eine Banane (20 g) oder 100 ml Saft (10 g) – am besten zu den Mahlzeiten rund ums Training.`);
  if (eGap > 15) extras.push(`+${Math.round(eGap)} g Eiweiß ergänzen, z. B. ${Math.round(eGap / 12 * 100 / 50) * 50} g Skyr oder Magerquark.`);
  if (khGap < -60) extras.push(`Etwa ${Math.round(-khGap)} g Kohlenhydrate über dem Ziel – Portionen Reis, Nudeln oder Brot etwas kleiner nehmen.`);
  return { meals: out, totals, targets, extras };
}
