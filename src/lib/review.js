// Wochenrückblick: Bilanz einer Woche (Soll/Ist, Intensität, Key Sessions, Erholung) und Hinweise für die nächste.
import { addDays } from './metrics.js';
import { compliance, isThreshold } from './activities.js';
import { sportLabel } from './sports.js';
import { hrvStatus, loadStatus } from './readiness.js';
import { healthStats } from './gear.js';
import { keySessionRows } from './keysessions.js';
import { weekPeriod } from './week-adapt.js';

const HARD = ['I3', 'I4', 'I5'];
const isHardAct = (a) => isThreshold(a) || ((a.zones?.I4 || 0) + (a.zones?.I5 || 0)) >= 600;
const hoursOf = (list) => list.reduce((x, a) => x + (a.durationS || 0) / 3600, 0);
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);

export function weekReview(data, monday, t) {
  const { activities = [], plan = [], wellness = [], health = [], keySessions = [], races = [], settings = {} } = data;
  const sunday = addDays(monday, 6), end = sunday < t ? sunday : t;
  const acts = activities.filter((a) => a.date >= monday && a.date <= sunday);
  const comp = compliance(plan, activities, monday, sunday);
  const hours = hoursOf(acts), load = acts.reduce((x, a) => x + (a.load || 0), 0);
  const prev = [1, 2, 3, 4].map((k) => activities.filter((a) => a.date >= addDays(monday, -7 * k) && a.date <= addDays(sunday, -7 * k)));
  const prevHours = mean(prev.map(hoursOf).filter((h) => h > 0)) || 0;
  const z = { I1: 0, I2: 0, I3: 0, I4: 0, I5: 0 };
  for (const a of acts) if (a.zones) for (const k in z) z[k] += a.zones[k] || 0;
  const zt = Object.values(z).reduce((x, y) => x + y, 0);
  const share = zt ? { easy: Math.round(((z.I1 + z.I2) / zt) * 100), thr: Math.round((z.I3 / zt) * 100), hard: Math.round(((z.I4 + z.I5) / zt) * 100) } : null;
  const bySport = {};
  for (const a of acts) bySport[a.sport] = (bySport[a.sport] || 0) + (a.durationS || 0) / 3600;
  const longest = [...acts].filter((a) => a.sport !== 'strength').sort((a, b) => (b.durationS || 0) - (a.durationS || 0))[0];
  const plannedHard = plan.filter((p) => p.date >= monday && p.date <= end && HARD.includes(p.zone));
  const doneHardDates = new Set(acts.filter(isHardAct).map((a) => a.date));
  const missedHard = plannedHard.filter((p) => p.date < t && !p.done && !doneHardDates.has(p.date));

  // Key Sessions dieser Woche gegenüber der letzten gleichen Einheit (Leistung bzw. Tempo je Puls).
  const keys = keySessions.flatMap((ks) => {
    const rows = keySessionRows(activities, ks);
    return rows.map((r, i) => ({ r, i })).filter(({ r }) => r.date >= monday && r.date <= sunday).map(({ r, i }) => {
      const before = rows.slice(0, i).reverse().find((x) => x.intervalRatio || x.intervalPower || x.lactateAvg != null);
      const ratio = r.intervalRatio && before?.intervalRatio ? Math.round(((r.intervalRatio - before.intervalRatio) / before.intervalRatio) * 1000) / 10 : null;
      return { name: ks.name, date: r.date, power: r.intervalPower, hr: r.intervalHr, lactate: r.lactateAvg, ratioPct: ratio, beforeDate: before?.date };
    });
  });

  const hrv = hrvStatus(end, wellness);
  const wk = wellness.filter((w) => w.date >= monday && w.date <= sunday);
  const sleep = mean(wk.map((w) => w.sleepH ?? w.sleepHManual).filter(Boolean));
  const feel = mean(wk.map((w) => w.feel).filter(Boolean));
  const ill = healthStats(health, monday, sunday, t);
  const ls = loadStatus(end, activities);

  // Nächste Woche
  const nMon = addDays(monday, 7), nSun = addDays(monday, 13);
  const next = plan.filter((p) => p.date >= nMon && p.date <= nSun);
  const nextHours = next.reduce((x, p) => x + (Number(p.minutes) || 0), 0) / 60;
  const nextHard = next.filter((p) => HARD.includes(p.zone)).length;
  const nextRaces = races.filter((r) => r.date >= nMon && r.date <= nSun);
  const nextPeriod = weekPeriod(nMon, settings.schedule);

  const tips = [];
  const pct = comp.plannedMin ? Math.round((hours * 60 / comp.plannedMin) * 100) : null;
  if (ill.ill || ill.injury) tips.push({ level: 'gelb', text: `${ill.ill ? `${ill.ill} Krankheitstag(e)` : `${ill.injury} Tag(e) verletzt`} – nächste Woche den Wiedereinstieg ernst nehmen, Intensität erst wenn beschwerdefrei.` });
  if (pct != null && pct < 70 && comp.plannedMin >= 120) tips.push({ level: 'gelb', text: `Nur ${pct} % vom geplanten Umfang. War der Plan zu voll oder die Woche stressig? Nächste Woche lieber realistisch planen (Alltag eintragen hilft) – Kontinuität schlägt volle Pläne.` });
  if (missedHard.length) tips.push({ level: 'info', text: `${missedHard.length} harte Einheit(en) ausgefallen. Nicht alles nachholen – lieber eine davon nächste Woche einbauen.` });
  if (hrv?.status === 'low') tips.push({ level: 'gelb', text: `HRV-Trend unter deinem Normalbereich (${hrv.avg7} ms, normal ${hrv.low}–${hrv.high}). Nächste Woche Umfang eher reduzieren oder eine leichtere Woche einschieben.` });
  if (ls?.acwr > 1.5) tips.push({ level: 'gelb', text: `Belastungssprung (${String(ls.acwr).replace('.', ',')}× gegenüber den letzten 4 Wochen). Nächste Woche nicht weiter steigern.` });
  if (ls?.monotony > 2 && ls.strainHigh) tips.push({ level: 'info', text: 'Sehr gleichförmige, hohe Belastung. Klarere Unterschiede zwischen harten und ganz lockeren Tagen (oder ein Ruhetag) helfen der Erholung.' });
  if (share && share.easy < 75 && hours >= 4) tips.push({ level: 'info', text: `Nur ${share.easy} % locker (I1–I2). Langläufer liegen meist bei 80–90 % – die lockeren Einheiten wirklich locker halten.` });
  if (sleep && sleep < 7) tips.push({ level: 'info', text: `Im Schnitt ${String(Math.round(sleep * 10) / 10).replace('.', ',')} h Schlaf – 8 h und mehr verbessern Erholung und Anpassung spürbar.` });
  if (nextHours && hours && nextHours > Math.max(hours, prevHours) * 1.2 && !nextPeriod) tips.push({ level: 'info', text: `Nächste Woche sind ${String(Math.round(nextHours * 10) / 10).replace('.', ',')} h geplant – ein Sprung um ${Math.round((nextHours / Math.max(hours, prevHours) - 1) * 100)} %. Mehr als ca. 10–15 % auf einmal erhöht das Risiko.` });
  if (nextPeriod) tips.push({ level: 'info', text: `Nächste Woche: ${nextPeriod.label} (${nextPeriod.days} Tage) – Umfang ca. ${Math.round(nextPeriod.factor * 100)} %. „Woche anpassen“ schlägt die Änderungen vor.` });
  if (nextRaces.length) tips.push({ level: 'info', text: `Rennen nächste Woche: ${nextRaces.map((r) => r.name).join(', ')}. Die zwei Tage davor locker mit kurzer Vorbelastung, Kohlenhydrate auffüllen.` });
  const good = [];
  if (pct != null && pct >= 90) good.push(`${pct} % vom Plan umgesetzt`);
  if (keys.some((k) => k.ratioPct > 1)) good.push('Key Session besser als beim letzten Mal');
  if (hrv?.status !== 'low' && hrv) good.push('HRV im Normalbereich');
  if (!tips.some((x) => x.level === 'gelb')) tips.push({ level: 'gut', text: good.length ? `Gute Woche: ${good.join(', ')}. Weiter so.` : 'Keine Auffälligkeiten – weiter nach Plan.' });

  return {
    monday, sunday, done: sunday < t, hours, load: Math.round(load), sessions: acts.length, prevHours, deltaPct: prevHours ? Math.round((hours / prevHours - 1) * 100) : null,
    comp, pct, share, sports: Object.entries(bySport).sort((a, b) => b[1] - a[1]).map(([s, h]) => ({ sport: s, label: sportLabel(s), hours: h })),
    hardSessions: acts.filter(isHardAct).length, strength: acts.filter((a) => a.sport === 'strength').length, missedHard: missedHard.length,
    longest: longest ? { title: longest.title || sportLabel(longest.sport), minutes: Math.round((longest.durationS || 0) / 60), id: longest.id } : null,
    keys, hrv, sleep, feel, ill, load7: ls, next: { hours: nextHours, hard: nextHard, races: nextRaces, period: nextPeriod, count: next.length }, tips,
  };
}
