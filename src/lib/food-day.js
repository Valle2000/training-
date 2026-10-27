// Training und Umstände eines Tages für die Ernährung (Tagestipp, Tagesvorschlag, Bedarf).
import { addDays } from './metrics.js';
import { nutritionTips } from './nutrition.js';

const HARD = ['I3', 'I4', 'I5'];
const OUTDOOR_WINTER = new Set(['xc_skate', 'xc_classic', 'run', 'hike', 'rollerski_skate', 'rollerski_classic', 'bike']);

// Erste Uhrzeit aus den Vorlieben („7:00 und 17:00“), für geplante Einheiten ohne Uhrzeit.
const prefTime = (s, i) => { const m = (String(s || '').match(/\d{1,2}[:.]\d{2}/g) || [])[i]; return m ? m.replace('.', ':').padStart(5, '0') : null; };

// Training je Tag: erledigte Einheiten + offene Planung + Rennen.
export function trainingOf(date, { activities = [], plan = [], races = [], settings = {} }) {
  const done = activities.filter((a) => a.date === date).map((a) => ({ sport: a.sport, minutes: Math.round((a.durationS || 0) / 60), hard: Math.round(((a.zones?.I3 || 0) + (a.zones?.I4 || 0) + (a.zones?.I5 || 0)) / 60), title: a.title, time: new Date(a.start).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) }));
  const planned = plan.filter((p) => p.date === date && !p.done).map((p, i) => ({ sport: p.sport, minutes: Number(p.minutes) || 0, hard: HARD.includes(p.zone) ? Number(p.minutes) || 0 : 0, title: p.title, planned: true, time: p.time || prefTime(settings.food?.trainingTime, done.length + i) }));
  const race = races.filter((r) => r.date === date).map((r) => ({ sport: 'xc_skate', minutes: Math.round((Number(r.distanceKm) || 15) * 3), hard: 30, title: r.name, race: true, planned: true }));
  return [...done, ...planned, ...race].sort((a, b) => String(a.time || '99').padStart(5, '0').localeCompare(String(b.time || '99').padStart(5, '0')));
}

// Rennen in den nächsten 2 Tagen (lang = über ca. 90 min, z. B. ab 30 km).
export function raceSoon(date, races = []) {
  const r = races.filter((x) => x.date >= date && x.date <= addDays(date, 2)).sort((a, b) => a.date.localeCompare(b.date))[0];
  if (!r) return null;
  return { name: r.name, days: Math.round((Date.parse(r.date) - Date.parse(date)) / 864e5), long: (Number(r.distanceKm) || 0) >= 30 };
}

// Alles für den Tagestipp aus dem App-Stand.
export function tipsFor(data, date) {
  const prefs = data.settings?.food || {};
  const today = trainingOf(date, data), tomorrow = trainingOf(addDays(date, 1), data);
  const month = Number(date.slice(5, 7));
  const w = (data.wellness || []).find((x) => x.date === date);
  return nutritionTips({
    date, today, tomorrow, weightKg: data.settings?.weightKg,
    heat: prefs.heatDate === date, sweat: prefs.sweat || null, raceSoon: raceSoon(date, data.races || []),
    symptoms: !!w?.symptoms?.length, cold: [11, 12, 1, 2, 3].includes(month) && today.some((x) => OUTDOOR_WINTER.has(x.sport)),
  });
}
