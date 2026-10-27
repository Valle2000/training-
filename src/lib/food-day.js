// Training und Umstände eines Tages für die Ernährung (Tagestipp, Tagesvorschlag, Bedarf).
import { addDays } from './metrics.js';
import { nutritionTips } from './nutrition.js';
import { slotDay, busyOn, hasSchedule, toMin, fmtTime } from './week-adapt.js';

const HARD = ['I3', 'I4', 'I5'];
const OUTDOOR_WINTER = new Set(['xc_skate', 'xc_classic', 'run', 'hike', 'rollerski_skate', 'rollerski_classic', 'bike']);

// Erste Uhrzeit aus den Vorlieben („7:00 und 17:00“), für geplante Einheiten ohne Uhrzeit.
const prefTime = (s, i) => { const m = (String(s || '').match(/\d{1,2}[:.]\d{2}/g) || [])[i]; return m ? m.replace('.', ':').padStart(5, '0') : null; };

// Training je Tag: erledigte Einheiten + offene Planung + Rennen.
export function trainingOf(date, { activities = [], plan = [], races = [], settings = {} }) {
  const done = activities.filter((a) => a.date === date).map((a) => ({ sport: a.sport, minutes: Math.round((a.durationS || 0) / 60), hard: Math.round(((a.zones?.I3 || 0) + (a.zones?.I4 || 0) + (a.zones?.I5 || 0)) / 60), title: a.title, time: new Date(a.start).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) }));
  const open = plan.filter((p) => p.date === date && !p.done);
  // Uhrzeit: in der Einheit gespeichert, sonst Vorschlag aus dem Alltag (freie Zeit), sonst „übliche Trainingszeit“.
  const slots = hasSchedule(settings.schedule) ? slotDay(date, open, settings.schedule).slots : {};
  const planned = open.map((p, i) => ({ sport: p.sport, minutes: Number(p.minutes) || 0, hard: HARD.includes(p.zone) ? Number(p.minutes) || 0 : 0, title: p.title, planned: true, time: p.time || (slots[p.id] ? fmtTime(slots[p.id].from) : null) || prefTime(settings.food?.trainingTime, done.length + i) }));
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

// Uhrzeiten für die Mahlzeiten des Tagesplans: rund um die Trainingszeiten (vorher 3 h bzw. 30–60 min, danach
// innerhalb von 30 min), Hauptmahlzeiten in freie Zeit; fällt eine Mahlzeit in Uni/Arbeit, gilt sie als „zum Mitnehmen“.
export function mealTimes(meals, training, date, schedule = {}) {
  const s = schedule || {};
  const start = toMin(s.start || '06:30'), end = toMin(s.end || '22:00');
  const sess = training.filter((x) => x.time && x.sport !== 'strength').map((x) => ({ from: toMin(x.time), to: toMin(x.time) + (x.minutes || 0), hard: x.hard >= 20 })).sort((a, b) => a.from - b.from);
  const target = sess.length >= 2 ? sess[1] : sess.find((x) => x.hard) || sess[0];
  const first = sess[0], last = sess.at(-1);
  const inSession = (m) => sess.find((x) => m > x.from - 15 && m < x.to);
  const busy = busyOn(date, s);
  const at = {
    breakfast: first && first.from < start + 60 ? first.to + 20 : start + 15,
    preLunch: target ? Math.max(start + 120, target.from - 180) : 12 * 60,
    pre: target ? target.from - 60 : null,
    during: target ? target.from + 15 : null,
    post: sess.length ? (sess.length >= 2 ? sess[0] : target).to + 15 : null,
    lunch: 12 * 60 + 30,
    snack: 16 * 60,
    dinner: Math.min(end - 60, Math.max(19 * 60, last ? last.to + 45 : 0)),
    bed: end - 30,
  };
  const out = meals.map((m) => {
    let time = at[m.role] ?? null;
    if (time != null && !['during', 'pre', 'post'].includes(m.role)) {
      const hit = inSession(time);
      if (hit) time = hit.to + 20; // nicht während des Trainings essen
    }
    // Gibt es schon einen Snack direkt vor dem Training, kommt der normale Snack zwischen Frühstück und Mittag.
    if (m.role === 'snack' && meals.some((x) => x.role === 'pre') && target) time = (at.breakfast + (meals.some((x) => x.role === 'preLunch') ? at.preLunch : at.lunch)) / 2;
    else if (m.role === 'snack' && target && Math.abs(time - target.from) < 90) time = target.from - 75;
    const block = time != null && m.role !== 'during' ? busy.find((b) => time >= b.fromM && time < b.toM) : null;
    return { ...m, time: time != null ? Math.max(0, Math.min(24 * 60 - 1, Math.round(time / 5) * 5)) : null, takeaway: block ? block.label || 'Termin' : null };
  });
  return out.sort((a, b) => (a.time ?? 9999) - (b.time ?? 9999));
}
