// Material (km/Stunden aus den Einheiten, Service-Erinnerung) und Gesundheitslog (Krankheit, Verletzung).
import { addDays } from './metrics.js';

export const GEAR_KINDS = [
  ['ski_skate', 'Ski Skating'], ['ski_classic', 'Ski klassisch'], ['rollerski', 'Rollski'], ['poles', 'Stöcke'],
  ['shoes_ski', 'Skischuhe'], ['shoes_run', 'Laufschuhe'], ['bike', 'Rad'], ['other', 'Sonstiges'],
];

// Einheiten eines Materials: manuell zugeordnet (activity.gearIds) oder Standard für die Sportart ab Kaufdatum.
export function gearActivities(g, activities) {
  return activities.filter((a) => {
    if (a.gearIds) return a.gearIds.includes(g.id);
    return (g.defaultSports || []).includes(a.sport) && (!g.since || a.date >= g.since) && (!g.retired || a.date <= g.retired);
  });
}

export function gearUsage(g, activities) {
  const list = gearActivities(g, activities);
  const km = (Number(g.startKm) || 0) + list.reduce((x, a) => x + (a.distanceM || 0) / 1000, 0);
  const hours = list.reduce((x, a) => x + (a.durationS || 0) / 3600, 0);
  const sinceService = g.serviceKm ? km - (Number(g.lastServiceKm) || 0) : null;
  return { km, hours, sessions: list.length, sinceService, serviceDue: g.serviceKm ? sinceService >= Number(g.serviceKm) : false, last: list.map((a) => a.date).sort().at(-1) };
}

export const HEALTH_TYPES = [['ill', 'Krankheit'], ['injury', 'Verletzung'], ['niggle', 'Beschwerden']];

export const healthDays = (e, today) => Math.round((Date.parse(e.end || today) - Date.parse(e.start)) / 864e5) + 1;

// Belastung in den 14 Tagen vor dem Ausfall im Vergleich zu den 4 Wochen davor (pro Tag), in %.
export function loadBefore(e, activities) {
  const sum = (from, to) => activities.filter((a) => a.date >= from && a.date <= to).reduce((x, a) => x + (a.load || 0), 0);
  const recent = sum(addDays(e.start, -14), addDays(e.start, -1)) / 14;
  const before = sum(addDays(e.start, -42), addDays(e.start, -15)) / 28;
  return before ? Math.round(((recent - before) / before) * 100) : null;
}

export function healthStats(entries, from, to, today) {
  const inRange = entries.filter((e) => e.start <= to && (e.end || today) >= from);
  const days = (type) => inRange.filter((e) => e.type === type).reduce((x, e) => {
    const s = e.start < from ? from : e.start, en = (e.end || today) > to ? to : e.end || today;
    return x + Math.max(0, Math.round((Date.parse(en) - Date.parse(s)) / 864e5) + 1);
  }, 0);
  return { ill: days('ill'), injury: days('injury'), niggle: days('niggle'), count: inRange.length };
}

// Stufenweiser Wiedereinstieg nach Krankheit (Praxisempfehlung nach IOC-Konsens 2016 und Elliott et al. 2020):
// erst beschwerdefrei warten, dann 4 Stufen; Dauer je Stufe wächst mit der Krankheitsdauer, nach Fieber/
// Ganzkörpersymptomen doppelt so lang. Gibt null zurück, wenn kein Wiedereinstieg (mehr) ansteht.
export const RETURN_STAGES = [
  ['Stufe 1', 'Gehen oder ganz locker, 15–30 min'],
  ['Stufe 2', 'Locker I1, 30–60 min'],
  ['Stufe 3', 'Normaler lockerer Umfang (I1–I2), noch keine Intervalle'],
  ['Stufe 4', 'Wieder Intensität – mit einer kürzeren Schwelleneinheit beginnen'],
];
export function returnPlan(e, t) {
  if (e.type !== 'ill') return null;
  if (!e.end || e.end >= t) {
    return { active: true, text: e.systemic ? 'Fieber oder Ganzkörpersymptome: kein Training. Viel trinken, schlafen, genug essen.' : 'Nur Symptome oberhalb des Halses, kein Fieber: höchstens 20–40 min ganz locker – werden die Symptome schlimmer, abbrechen. Sonst Pause.' };
  }
  const ill = healthDays(e, t);
  const wait = e.systemic ? (/covid|corona/i.test(e.title || '') ? 7 : 2) : 1;
  const per = Math.max(1, Math.round((ill * (e.systemic ? 2 : 1)) / 4));
  let from = addDays(e.end, wait);
  const steps = RETURN_STAGES.map(([label, text]) => { const s = { label, text, from, to: addDays(from, per - 1) }; from = addDays(from, per); return s; });
  if (t > steps.at(-1).from) return null; // Stufe 4 erreicht → normales Training
  const current = t < steps[0].from ? -1 : steps.findIndex((s) => t >= s.from && t <= s.to);
  return { active: false, wait, steps, current: current === -1 && t >= steps[0].from ? 3 : current };
}
