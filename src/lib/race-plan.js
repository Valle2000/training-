// Rennplan: Verpflegung (Carboloading, Vorstartmahlzeit, unterwegs), Trinken nach Temperatur/Schweißrate,
// Pacing, Aufwärmen und Packliste. Richtwerte nach Thomas, Erdman & Burke 2016 (ACSM/AND/DC), Jeukendrup 2014
// und dem ISSN-Positionspapier Koffein (Guest et al. 2021). Ergebnis = Vorschlag, im Training ausprobieren.
import { addDays } from './metrics.js';
import { toMin, fmtTime } from './week-adapt.js';

// Grobe Schätzung der Rennzeit (min/km) nach Technik, wenn keine Zielzeit angegeben ist.
const PACE = { Skating: 3.0, Klassisch: 3.4, Skiathlon: 3.2, Rollski: 2.6, Lauf: 5.0, Rad: 1.8, Sonstiges: 4.0 };
export const estimateMinutes = (race) => Math.round((Number(race.distanceKm) || 15) * (PACE[race.technique] || 3.2));
const r5 = (x) => Math.round(x / 5) * 5;
const de = (x, d = 0) => String(Math.round(x * 10 ** d) / 10 ** d).replace('.', ',');

export function racePlan(race, { weightKg = 70, minutes, startTime = '09:00', tempC = -5, feedKm = '', gelG = 25, caffeine = false, sweat = null } = {}) {
  const w = Number(weightKg) || 70;
  const dur = Number(minutes) || estimateMinutes(race);
  const km = Number(race.distanceKm) || null;
  const start = toMin(startTime || '09:00');
  const hours = dur / 60;
  const temp = Number(tempC);

  // Kohlenhydrate unterwegs nach Dauer.
  const carbH = dur < 45 ? 0 : dur < 75 ? 30 : dur < 150 ? 60 : 90;
  const during = [];
  if (dur >= 45 && dur < 75) during.push({ min: Math.round(dur / 2), what: 'Ein paar Schlucke Sportgetränk oder Mundspülung mit Kohlenhydraten (reicht bei dieser Dauer)' });
  // Feste Abstände (ca. alle 20–30 min) – an Verpflegungsstellen Getränk, sonst Gel aus dem Gürtel.
  const feeds = String(feedKm || '').split(/[,; ]+/).map(Number).filter((x) => x > 0 && (!km || x < km)).sort((a, b) => a - b);
  const minAtKm = (k) => (km ? Math.round((k / km) * dur) : null);
  let gels = 0, drinkCups = 0;
  if (carbH) {
    const every = carbH >= 90 ? 20 : carbH >= 60 ? 25 : 30;
    // Verpflegungsstellen sind feste Zeitpunkte; Lücken dazwischen gleichmäßig mit Gels füllen, sodass nie
    // länger als ca. „every“ + 5 min nichts kommt. Jede Aufnahme deckt die Zeit seit der letzten ab.
    const stations = feeds.map((k) => ({ min: minAtKm(k), km: k })).filter((x) => x.min > 5 && x.min < dur - 8);
    const bounds = [0, ...stations.map((x) => x.min), dur];
    const events = [];
    for (let i = 0; i < bounds.length - 1; i++) {
      const a = bounds[i], b = bounds[i + 1], n = Math.max(0, Math.ceil((b - a) / (every + 5)) - 1);
      for (let j = 1; j <= n; j++) { const m = Math.round(a + ((b - a) * j) / (n + 1)); if (m <= dur - 10) events.push({ min: m }); }
      if (i < stations.length) events.push({ ...stations[i], station: true });
    }
    // Erste Aufnahme nicht vor ca. 15 min.
    let last = 0;
    for (const e of events.filter((x) => x.station || x.min >= 15)) {
      const need = (carbH * (e.min - last)) / 60;
      last = e.min;
      if (e.station) {
        drinkCups++;
        const extra = need > 35 ? Math.max(1, Math.round((need - 25) / (Number(gelG) || 25))) : 0;
        gels += extra;
        during.push({ min: e.min, km: e.km, what: `Verpflegung km ${de(e.km, 1)}: 1–2 Becher Sportgetränk (ca. ${r5(Math.min(need, 25))} g KH)${extra ? ` + ${extra > 1 ? `${extra} Gels` : 'Gel'}` : ''}` });
      } else {
        const n = Math.max(1, Math.round(need / (Number(gelG) || 25)));
        gels += n;
        during.push({ min: e.min, km: km ? Math.round((e.min / dur) * km) : null, what: `${n > 1 ? `${n} Gels` : 'Gel'} (${r5(n * (Number(gelG) || 25))} g KH) mit Wasser/Getränk` });
      }
    }
    if (caffeine && dur >= 120) during.push({ min: Math.round(dur * 0.66), what: 'Koffein-Gel (ca. 1 mg/kg) für das letzte Drittel – nur wenn im Training getestet' });
  }
  during.sort((a, b) => a.min - b.min);

  // Trinken: Schweißrate, sonst nach Temperatur. Im Langlauf oft kalt → weniger, aber warm und nicht gefroren.
  const fluidH = sweat?.drinkPerHour ? Math.round(sweat.drinkPerHour * 1000 * 0.8) : temp <= -5 ? 350 : temp <= 5 ? 450 : temp <= 18 ? 600 : 800;
  const sodiumL = sweat?.sodiumPerL || (temp > 18 ? 800 : 500);
  const fluid = dur >= 60 ? { perHour: fluidH, total: Math.round((fluidH * hours) / 50) * 50, sodiumPerL: sodiumL } : null;

  // Tage davor und Renntag.
  const steps = [];
  if (dur >= 90) {
    steps.push({ when: `${fmtDay(addDays(race.date, -2))} und ${fmtDay(addDays(race.date, -1))}`, title: 'Carboloading (36–48 h)', text: `${Math.round(w * 10)}–${Math.round(w * 12)} g Kohlenhydrate pro Tag (10–12 g/kg), auf 5–6 Mahlzeiten verteilt. Weniger Ballaststoffe und Fett, vertraute Lebensmittel (Reis, Nudeln, Brot, Saft, Haferflocken). Training nur locker mit kurzer Vorbelastung. 1–2 kg mehr auf der Waage sind normal (Wasser im Glykogen).` });
  } else {
    steps.push({ when: fmtDay(addDays(race.date, -1)), title: 'Tag vorher: Speicher füllen', text: `${Math.round(w * 7)}–${Math.round(w * 10)} g Kohlenhydrate (7–10 g/kg), Abendessen kohlenhydratreich und gut verträglich. Locker mit kurzer Vorbelastung (z. B. 30 min + 4× 1 min zügig).` });
  }
  const meal = start - 180;
  steps.push({ when: fmtTime(Math.max(5 * 60, meal)), title: 'Vorstartmahlzeit (ca. 3 h vorher)', text: `${Math.round(w * (dur >= 90 ? 2 : 1.5))} g Kohlenhydrate (${dur >= 90 ? 2 : 1.5} g/kg), wenig Fett/Ballaststoffe/Eiweiß – z. B. Weißbrot/Toast mit Honig oder Marmelade, Reis- oder Haferbrei, Banane, Saft. ${Math.round(w * 6 / 50) * 50} ml trinken.${meal < 6 * 60 ? ' Bei frühem Start lieber kleiner und dafür 1 h vorher ein Snack.' : ''}` });
  if (caffeine) steps.push({ when: fmtTime(start - 60), title: 'Koffein', text: `${Math.round(w * 3)} mg (3 mg/kg) ca. 60 min vor dem Start, z. B. Koffeintablette oder 2–3 Espresso. Nur, wenn im Training getestet.` });
  steps.push({ when: fmtTime(start - 45), title: 'Letzter Snack', text: dur >= 60 ? 'Optional 20–30 g Kohlenhydrate (Gel, halbe Banane, Riegel) und ein paar Schlucke trinken.' : 'Nur noch ein paar Schlucke trinken.' });
  const sprint = (km && km <= 3) || /sprint/i.test(race.name || '');
  steps.push({ when: fmtTime(start - (sprint ? 45 : 35)), title: 'Aufwärmen', text: sprint ? '20–30 min locker, dann 3–4 Steigerungen und 2 kurze Belastungen im Renntempo (20–40 s), dazwischen locker. Danach warm halten, nicht länger als ca. 15 min bis zum Start.' : dur >= 120 ? '10–15 min locker mit 2–3 kurzen Steigerungen – bei Langdistanzen reicht wenig, Kräfte sparen. Warm anziehen bis zum Start.' : '15–20 min locker, 3–4 Steigerungen und 1–2 Belastungen im Renntempo (1 min). Danach warm halten.' });
  steps.push({ when: fmtTime(start), title: 'Start', text: `Erstes Drittel bewusst kontrolliert (eher 2–3 % langsamer als der Schnitt), dann gleichmäßig; stärkere Gruppen nutzen.` });
  steps.push({ when: fmtTime(start + dur + 15), title: 'Direkt danach', text: `${Math.round(w * 1)} g Kohlenhydrate und ${Math.round(w * 0.3)} g Eiweiß innerhalb der ersten Stunde (z. B. Kakao/Recovery-Drink + Brötchen), trocken anziehen. Bei mehreren Renntagen besonders wichtig.` });

  // Pacing: Zwischenzeiten bei gleichmäßigem Tempo.
  const hm = (m) => `${Math.floor(m / 60)}:${String(Math.round(m % 60)).padStart(2, '0')} h`;
  const splits = km ? [0.25, 0.5, 0.75].map((f) => ({ km: Math.round(km * f * 10) / 10, time: hm(dur * f), clock: fmtTime(start + dur * f) })) : [];

  const cold = temp <= -5;
  const pack = [
    'Startnummer, Chip, Ausweis/Lizenz', `Rennski (${race.technique === 'Klassisch' ? 'Steigwachs/Klister + Gleitwachs' : 'Gleitwachs'} passend zu Schnee und Temperatur) + Reserveski/Testski`, 'Stöcke (Ersatzteller), Schuhe',
    `Rennanzug + ${cold ? 'Windunterwäsche, Mütze, dünne Handschuhe + Fäustlinge, Tape/Creme gegen Kälte im Gesicht' : temp > 5 ? 'leichte Kleidung, Sonnenbrille, Sonnencreme' : 'dünne Mütze und Handschuhe'}`,
    'Warme Wechselkleidung für danach, Aufwärmjacke',
    ...(gels ? [`${gels + 1} Gels (${gels} geplant + 1 Reserve)${cold ? ' – nah am Körper tragen, damit sie nicht fest werden' : ''}`, 'Verpflegungsgürtel'] : []),
    ...(fluid ? [`Getränk: ca. ${de(fluid.total / 1000, 1)} l gesamt${drinkCups ? ' (davon ein Teil an den Verpflegungsstellen)' : ''}${cold ? ', warm in Thermoflasche, damit es nicht gefriert' : ''}`] : []),
    'Vorstartmahlzeit und Recovery-Drink für danach', 'Wachsbox, Kork, Bürsten (falls selbst gewachst)',
  ];

  return { minutes: dur, carbPerHour: carbH, during, gels, fluid, steps, splits, pack, cold, startTime: fmtTime(start), finish: fmtTime(start + dur) };
}

function fmtDay(d) { return new Date(d + 'T12:00:00').toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short' }); }

// Erkenntnisse aus früheren Rennberichten (für den nächsten Rennplan).
export function lessons(races, beforeDate) {
  return races.filter((r) => r.date < beforeDate && r.report && (r.report.lesson || r.report.nutritionNote))
    .sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5)
    .map((r) => ({ name: r.name, date: r.date, text: [r.report.lesson, r.report.nutritionNote && `Verpflegung: ${r.report.nutritionNote}`].filter(Boolean).join(' · ') }));
}
