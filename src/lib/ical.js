// Kalender-Feed (iCal/.ics) lesen, z. B. den TrainingPeaks-Kalender mit den geplanten Einheiten der Trainerin.
// TrainingPeaks: Einstellungen → Konto → Kalender-Feed (nur mit Premium). Der Feed enthält ca. 5 Tage
// Vergangenheit und 14 Tage Zukunft. Dauer, Sportart und Zone werden aus Titel und Beschreibung geschätzt.
import { guessSport } from './sports.js';

// Zeilen entfalten (RFC 5545: Fortsetzungszeilen beginnen mit Leerzeichen/Tab) und Texte entschlüsseln.
const unfold = (txt) => String(txt || '').replace(/\r\n/g, '\n').replace(/\n[ \t]/g, '');
const unescape = (v) => v.replace(/\\n/gi, '\n').replace(/\\([,;\\])/g, '$1').trim();

export function parseIcs(txt) {
  const events = [];
  let cur = null;
  for (const line of unfold(txt).split('\n')) {
    if (line === 'BEGIN:VEVENT') { cur = {}; continue; }
    if (line === 'END:VEVENT') { if (cur) events.push(cur); cur = null; continue; }
    if (!cur) continue;
    const i = line.indexOf(':');
    if (i < 0) continue;
    const [name, ...params] = line.slice(0, i).split(';');
    const key = name.toUpperCase(), value = line.slice(i + 1);
    if (key === 'DTSTART' || key === 'DTEND') cur[key] = { value, allDay: params.some((p) => /VALUE=DATE$/i.test(p)) || /^\d{8}$/.test(value) };
    else if (['SUMMARY', 'DESCRIPTION', 'UID', 'DURATION', 'CATEGORIES'].includes(key)) cur[key] = unescape(value);
  }
  return events;
}

// 20261124 / 20261124T060000Z → Datum (lokal) + Zeitpunkt
function icsTime(t) {
  if (!t) return null;
  const m = t.value.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?/);
  if (!m) return null;
  const [, y, mo, d, h, mi, s, z] = m;
  if (!h) return { date: `${y}-${mo}-${d}`, ms: null };
  const ms = z ? Date.UTC(+y, mo - 1, +d, +h, +mi, +s) : new Date(+y, mo - 1, +d, +h, +mi, +s).getTime();
  const local = new Date(ms);
  const pad = (n) => String(n).padStart(2, '0');
  return { date: `${local.getFullYear()}-${pad(local.getMonth() + 1)}-${pad(local.getDate())}`, ms };
}

// Dauer in Minuten aus dem Text: „Planned Time: 1:15:00“, „Dauer 1:30 h“, „90 min“, „1.5 h“, ISO „PT1H30M“.
export function minutesFromText(text) {
  const s = String(text || '');
  let m = s.match(/(?:planned\s*(?:time|duration)|geplante?\s*(?:zeit|dauer)|duration|dauer|zeit)\s*[:=]?\s*(\d{1,2}):(\d{2})(?::(\d{2}))?/i);
  if (m) return +m[1] * 60 + +m[2] + (m[3] ? Math.round(+m[3] / 60) : 0);
  m = s.match(/\bPT(?:(\d+)H)?(?:(\d+)M)?/);
  if (m && (m[1] || m[2])) return (+m[1] || 0) * 60 + (+m[2] || 0);
  m = s.match(/\b(\d{1,2}):(\d{2})\s*h\b/i);
  if (m) return +m[1] * 60 + +m[2];
  m = s.match(/\b(\d{1,2}(?:[.,]\d+)?)\s*(?:h|std|hrs?|hours?|stunden?)\b/i);
  if (m) return Math.round(parseFloat(m[1].replace(',', '.')) * 60);
  m = s.match(/\b(\d{2,3})\s*(?:min|minuten|minutes|′|')(?![a-z]*\s*(?:x|×|pause|rest|off))/i);
  if (m) return +m[1];
  return null;
}

// Sportart: TrainingPeaks-Typen (Run, Bike, Swim, XC-Ski, Strength, Rowing …) und deutsche Begriffe.
export function sportFromText(text) {
  const s = String(text || '');
  if (/ski ?erg/i.test(s)) return 'skierg';
  if (/roll ?ski|roller ?ski/i.test(s)) return /klass|classic|\bcl\b/i.test(s) ? 'rollerski_classic' : /skat|\bsk\b|free/i.test(s) ? 'rollerski_skate' : 'rollerski';
  if (/xc[- ]?ski|langlauf|nordic|cross[- ]?country ski|\bski\b/i.test(s)) return /klass|classic|\bcl\b/i.test(s) ? 'xc_classic' : 'xc_skate';
  if (/\b(swim|schwimm)/i.test(s)) return 'swim';
  if (/\b(row|ruder)/i.test(s)) return 'row';
  if (/\b(strength|kraft|gym|athletik)/i.test(s)) return 'strength';
  if (/\b(mobility|yoga|stretch|mobil)/i.test(s)) return 'mobility';
  return guessSport({ title: s });
}

// Zone aus den üblichen Bezeichnungen (I1–I5, L1–L5, Z1–Z5) oder Stichworten.
export function zoneFromText(text) {
  const s = String(text || '');
  const nums = [...s.matchAll(/\b[ILZ]([1-5])\b/gi)].map((m) => +m[1]);
  if (nums.length) return `I${Math.max(...nums)}`;
  if (/vo2|hit\b|hiit|intervall|interval|sprint|race|wettkampf|rennen/i.test(s)) return 'I4';
  if (/schwelle|threshold|tempo|sweet ?spot|lt2?\b/i.test(s)) return 'I3';
  if (/locker|easy|recovery|regeneration|grundlage|endurance|long|lang|ga1|base/i.test(s)) return 'I1';
  return null;
}

// Feed → Plan-Einheiten (source 'trainingpeaks'). Termine ohne erkennbare Sportart und ohne Dauer werden
// als Notiz übernommen (z. B. „Ruhetag“), ganz leere übersprungen.
export function icsToPlan(txt, { source = 'trainingpeaks' } = {}) {
  const out = [];
  for (const ev of parseIcs(txt)) {
    const start = icsTime(ev.DTSTART);
    if (!start) continue;
    const title = (ev.SUMMARY || '').trim();
    const desc = (ev.DESCRIPTION || '').trim();
    if (!title && !desc) continue;
    const text = `${title}\n${ev.CATEGORIES || ''}\n${desc}`;
    let minutes = minutesFromText(`${title}\n${desc}`) ?? minutesFromText(ev.DURATION || '');
    if (minutes == null && start.ms != null && ev.DTEND && !ev.DTEND.allDay) {
      const end = icsTime(ev.DTEND);
      const diff = end?.ms != null ? Math.round((end.ms - start.ms) / 60000) : 0;
      if (diff > 0 && diff < 600) minutes = diff;
    }
    const sport = sportFromText(`${title}\n${ev.CATEGORIES || ''}`) !== 'other' ? sportFromText(`${title}\n${ev.CATEGORIES || ''}`) : sportFromText(text);
    const rest = /ruhetag|rest day|day off|\boff\b/i.test(title);
    out.push({
      externalId: ev.UID || `${start.date}-${title}`, source, date: start.date, title: title || 'Einheit (TrainingPeaks)',
      sport: rest ? 'other' : sport, minutes: rest ? 0 : Math.max(0, Math.min(600, minutes ?? 60)), zone: rest ? null : zoneFromText(text),
      notes: desc, minutesGuessed: minutes == null,
    });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

// Neue Feed-Einheiten mit dem Plan zusammenführen: offene, nicht erledigte TrainingPeaks-Einheiten im Zeitraum des
// Feeds werden ersetzt (die Trainerin hat umgeplant), erledigte und eigene Einheiten bleiben.
export function mergeFeedPlan(plan, items, newId, source = 'trainingpeaks') {
  if (!items.length) return { plan, added: 0, removed: 0 };
  const from = items[0].date, to = items[items.length - 1].date;
  const keep = plan.filter((p) => !(p.source === source && !p.done && p.date >= from && p.date <= to));
  const kept = new Set(keep.filter((p) => p.source === source).map((p) => p.externalId));
  const fresh = items.filter((it) => !kept.has(it.externalId)).map((it) => ({ id: newId(), ...it, done: false }));
  return { plan: [...keep, ...fresh], added: fresh.length, removed: plan.length - keep.length };
}
