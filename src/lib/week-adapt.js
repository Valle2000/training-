// Wochenplanung mit Alltag (Uni, Arbeit …) und Anpassung der restlichen Woche an Morgen-Check, Krankheit und
// verpasste Einheiten. Liefert Vorschläge mit Operationen (verschieben, ändern, streichen), die mit einem Klick
// übernommen werden – nichts wird automatisch geändert.
import { addDays } from './metrics.js';
import { mondayOf, matchPlan, isThreshold, estimatePlanLoad } from './activities.js';
import { readinessFor } from './readiness.js';
import { returnPlan } from './gear.js';

// ——— Alltag: feste Wochentermine und einzelne Termine ———
// settings.schedule = { start: '06:30', end: '21:30', buffer: 15, blocks: [{id, dows: [1..7], from, to, label}], oneOff: [{id, date, from, to, label}] }
export const toMin = (hhmm) => { const [h, m] = String(hhmm || '0:0').split(':').map(Number); return (h || 0) * 60 + (m || 0); };
export const fmtTime = (min) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(Math.round(min % 60)).padStart(2, '0')}`;
export const dowOf = (date) => ((new Date(date + 'T12:00:00Z').getUTCDay() + 6) % 7) + 1;
export const hasSchedule = (s) => !!(s && ((s.blocks || []).length || (s.oneOff || []).length));

export function busyOn(date, s = {}) {
  const dow = dowOf(date);
  return [
    ...(s.blocks || []).filter((b) => (b.dows || []).includes(dow) && (!b.until || date <= b.until) && (!b.since || date >= b.since)),
    ...(s.oneOff || []).filter((b) => b.date === date),
  ].map((b) => ({ ...b, fromM: toMin(b.from), toM: toMin(b.to) })).sort((a, b) => a.fromM - b.fromM);
}

// Besondere Zeiten (settings.schedule.periods: [{id, type, from, to, label}]): Umfang anpassen, Intensität je nach Art.
// Prüfungsphase: weniger Umfang, Intensität halten (kurze harte Reize erhalten die Form, Stress kommt schon vom Lernen).
export const PERIOD_TYPES = {
  exam: { label: 'Prüfungsphase', factor: 0.7, hardMax: 2, note: 'Umfang ca. −30 %, harte Einheiten bleiben (kürzer ist okay). Schlaf geht vor.' },
  stress: { label: 'Stressige Zeit', factor: 0.8, hardMax: 2, note: 'Umfang ca. −20 %. Morgen-Check ernst nehmen.' },
  travel: { label: 'Reise', factor: 0.5, hardMax: 1, note: 'Umfang ca. −50 %, höchstens 1 harte Einheit, Sportart nach Möglichkeit (Laufen, Hotel-Kraft).' },
  camp: { label: 'Trainingslager', factor: 1.3, hardMax: 3, note: 'Umfang ca. +30 %, vor allem lockere und lange Einheiten. Danach eine leichtere Woche.' },
};
export const periodOn = (date, s = {}) => (s.periods || []).find((p) => date >= p.from && date <= p.to) || null;
// Durchschnittlicher Umfangsfaktor einer Woche (Tage ohne besondere Zeit = 1) und vorherrschende Art.
export function weekPeriod(monday, s = {}) {
  const ps = Array.from({ length: 7 }, (_, i) => periodOn(addDays(monday, i), s));
  if (!ps.some(Boolean)) return null;
  const factor = ps.reduce((a, p) => a + (p ? PERIOD_TYPES[p.type]?.factor ?? 1 : 1), 0) / 7;
  const days = ps.filter(Boolean).length, main = ps.filter(Boolean).sort((a, b) => ps.filter((x) => x === b).length - ps.filter((x) => x === a).length)[0];
  return { factor: Math.round(factor * 100) / 100, type: main.type, label: main.label || PERIOD_TYPES[main.type]?.label, days };
}

// Für den Saisonplan-Assistenten: Faktor der Woche; harte Einheiten nur begrenzen, wenn die besondere Zeit
// den Großteil der Woche (ab 4 Tagen) ausmacht.
export function periodForWeek(monday, s) {
  const wp = weekPeriod(monday, s);
  if (!wp) return null;
  return { ...wp, hardMax: wp.days >= 4 ? PERIOD_TYPES[wp.type]?.hardMax : null, type: wp.days >= 4 ? wp.type : null };
}

// Freie Zeitfenster eines Tages (zwischen Tagesbeginn und -ende, mit Puffer für Wege um jeden Termin).
export function freeWindows(date, s = {}) {
  const start = toMin(s.start || '06:30'), end = toMin(s.end || '21:30'), buf = Number(s.buffer ?? 15);
  let wins = [[start, end]];
  for (const b of busyOn(date, s)) {
    const a = b.fromM - buf, z = b.toM + buf;
    wins = wins.flatMap(([x, y]) => (z <= x || a >= y ? [[x, y]] : [[x, Math.min(y, a)], [Math.max(x, z), y]]));
  }
  return wins.filter(([x, y]) => y - x >= 20);
}
export const freeMinutes = (date, s) => freeWindows(date, s).reduce((a, [x, y]) => a + y - x, 0);

// Uhrzeit-Vorschlag je geplanter Einheit: längste zuerst in das früheste passende Fenster;
// „nachmittags/abends“ ins späteste. Gibt {id: {from, to}} und Einheiten ohne Platz (overflow) zurück.
export function slotDay(date, items, s) {
  const wins = freeWindows(date, s).map(([x, y]) => ({ x, y }));
  const out = {}, overflow = [];
  for (const p of [...items].sort((a, b) => (b.minutes || 0) - (a.minutes || 0))) {
    const need = Number(p.minutes) || 0;
    const late = /nachmittag|abend/i.test(p.title || '');
    const fits = wins.filter((w) => w.y - w.x >= need);
    const w = late ? fits.at(-1) : fits[0];
    if (!w) { overflow.push(p.id); continue; }
    if (late) { out[p.id] = { from: w.y - need, to: w.y }; w.y -= need + 30; } else { out[p.id] = { from: w.x, to: w.x + need }; w.x += need + 30; }
  }
  return { slots: out, overflow };
}

// ——— Anpassung der restlichen Woche ———
const HARD = ['I3', 'I4', 'I5'];
export const isHardPlan = (p) => HARD.includes(p.zone);
const isHardAct = (a) => isThreshold(a) || ((a.zones?.I4 || 0) + (a.zones?.I5 || 0)) >= 600;
const scaled = (p, minutes, zone = p.zone) => ({ minutes, zone, load: zone === p.zone && p.minutes ? Math.round(((p.load || 0) * minutes) / p.minutes) : estimatePlanLoad(minutes, zone) });

export function adaptWeek(data, t, form = null) {
  const { plan = [], activities = [], wellness = [], health = [], settings = {} } = data;
  const monday = mondayOf(t), sunday = addDays(monday, 6);
  const acts = activities.filter((a) => a.date >= monday && a.date <= sunday);
  const open = plan.filter((p) => p.date >= monday && p.date <= sunday && !p.done && !(p.date <= t && matchPlan(p, acts)));
  const future = open.filter((p) => p.date >= t), missed = open.filter((p) => p.date < t);
  const s = settings.schedule, sched = hasSchedule(s);
  const out = [];
  const label = (p) => `${p.title || 'Einheit'} (${p.minutes}′)`;
  const day = (d) => new Date(d + 'T12:00:00').toLocaleDateString('de-DE', { weekday: 'long' });

  // 1) Krankheit: aktuelle Erkrankung oder Wiedereinstieg hat Vorrang vor allem anderen.
  const ill = health.filter((e) => e.type === 'ill').sort((a, b) => b.start.localeCompare(a.start))[0];
  const rp = ill ? returnPlan(ill, t) : null;
  if (rp?.active) {
    const ops = future.filter((p) => p.date <= addDays(t, ill.systemic ? 6 : 2)).flatMap((p) => (ill.systemic || p.sport === 'strength' ? [{ type: 'remove', id: p.id }] : isHardPlan(p) || p.minutes > 40 ? [{ type: 'update', id: p.id, patch: { ...scaled(p, Math.min(40, p.minutes), 'I1'), title: 'Ganz locker (krank)' } }] : []));
    if (ops.length) out.push({ id: 'ill', level: 'rot', title: ill.systemic ? 'Krank mit Fieber/Ganzkörpersymptomen: Training aussetzen' : 'Krank (oberhalb des Halses): nur ganz locker', text: ill.systemic ? 'Alle Einheiten der nächsten Tage streichen. Danach startet der stufenweise Wiedereinstieg.' : 'Harte und lange Einheiten der nächsten 3 Tage auf höchstens 40 min locker kürzen, Kraft streichen. Bei Verschlechterung ganz pausieren.', ops });
    return out;
  }
  if (rp?.steps) {
    const caps = [30, 60, null];
    const ops = [];
    for (const p of future) {
      const st = rp.steps.findIndex((x) => p.date >= x.from && p.date <= x.to);
      const stage = p.date < rp.steps[0].from ? -1 : st;
      if (stage === 3) continue;
      if (stage === -1 || p.sport === 'strength' && stage < 2) { ops.push({ type: 'remove', id: p.id }); continue; }
      const cap = caps[stage];
      if (isHardPlan(p) || (cap && p.minutes > cap)) ops.push({ type: 'update', id: p.id, patch: { ...scaled(p, cap ? Math.min(cap, p.minutes) : p.minutes, 'I1'), title: `Locker – ${rp.steps[stage].label} Wiedereinstieg` } });
    }
    if (ops.length) out.push({ id: 'return', level: 'gelb', title: 'Wiedereinstieg nach Krankheit', text: 'Einheiten an die Stufen anpassen: erst kurz und locker, Intensität erst ab Stufe 4.', ops });
    return out;
  }

  // Wochentage mit harter Belastung (erledigt oder geplant) – zwei harte Tage nicht direkt hintereinander.
  const hardDates = new Set([...acts.filter(isHardAct).map((a) => a.date), ...future.filter(isHardPlan).map((p) => p.date)]);
  const used = (d) => future.filter((p) => p.date === d).reduce((a, p) => a + (Number(p.minutes) || 0), 0);
  const cap = (d) => (sched ? freeMinutes(d, s) : Infinity);
  const r = readinessFor(t, wellness, form, activities);
  const okToday = !r.checked || r.level === 'gruen';
  // Tag für eine harte Einheit: Tausch mit einer lockeren Einheit an einem Tag ohne harte Nachbartage.
  const findSwap = (p, { after = t, skip = new Set() } = {}) => {
    for (let d = after; d <= sunday; d = addDays(d, 1)) {
      if (d === t && !okToday) continue;
      if (d === p.date || skip.has(d)) continue;
      const others = new Set([...hardDates].filter((x) => x !== p.date));
      if (others.has(d) || others.has(addDays(d, -1)) || others.has(addDays(d, 1))) continue;
      const easy = future.find((x) => x.date === d && !isHardPlan(x) && x.sport !== 'strength');
      if (!easy) continue;
      if (cap(d) - used(d) + (easy.minutes || 0) < (p.minutes || 0)) continue;
      return { d, easy };
    }
    return null;
  };

  // 2) Morgen-Check heute
  if (r.checked && r.level !== 'gruen') {
    const todays = future.filter((p) => p.date === t);
    const hard = todays.filter(isHardPlan);
    const ops = [];
    const notes = [];
    for (const p of hard) {
      const sw = findSwap(p, { after: addDays(t, 1) });
      if (sw) {
        ops.push({ type: 'move', id: p.id, date: sw.d }, ...(r.level === 'rot' ? [{ type: 'remove', id: sw.easy.id }] : [{ type: 'move', id: sw.easy.id, date: t }]));
        notes.push(`${label(p)} auf ${day(sw.d)}${r.level === 'rot' ? '' : `, dafür ${label(sw.easy)} heute`}`);
        hardDates.delete(t); hardDates.add(sw.d);
      } else {
        ops.push({ type: 'update', id: p.id, patch: { ...scaled(p, Math.min(45, p.minutes), 'I1'), title: 'Locker statt hart (Morgen-Check)' } });
        notes.push(`${label(p)} diese Woche nicht sinnvoll verschiebbar → heute locker 45 min`);
      }
    }
    if (r.level === 'rot') for (const p of todays.filter((x) => !isHardPlan(x))) { ops.push({ type: 'remove', id: p.id }); notes.push(`${label(p)} streichen`); }
    if (ops.length) out.push({ id: 'readiness', level: r.level, title: r.level === 'rot' ? 'Morgen-Check rot: heute Ruhe' : 'Morgen-Check gelb: harte Einheit tauschen', text: `${r.reasons.slice(0, 2).join(' · ')}. Vorschlag: ${notes.join('; ')}.`, ops });
  }

  // 3) Verpasste harte Einheiten: an einem passenden Tag nachholen (ersetzt dort eine lockere Einheit),
  // verpasste lockere Einheiten nicht nachholen.
  const taken = new Set();
  for (const p of missed.filter(isHardPlan)) {
    const sw = findSwap(p, { skip: taken });
    if (sw) {
      taken.add(sw.d); hardDates.add(sw.d);
      out.push({ id: `missed-${p.id}`, level: 'info', title: `Verpasst: ${label(p)}`, text: `Am ${day(sw.d)} nachholen, statt ${label(sw.easy)}. Kein zusätzlicher Umfang, harte Tage nicht direkt hintereinander.`, ops: [{ type: 'move', id: p.id, date: sw.d }, { type: 'remove', id: sw.easy.id }] });
    } else {
      out.push({ id: `missed-${p.id}`, level: 'info', title: `Verpasst: ${label(p)}`, text: 'Passt diese Woche nicht mehr ohne zwei harte Tage hintereinander – nicht nachholen, normal weiter.', ops: [{ type: 'remove', id: p.id }] });
    }
  }
  const missedEasy = missed.filter((p) => !isHardPlan(p));
  if (missedEasy.length) out.push({ id: 'missed-easy', level: 'info', title: `${missedEasy.length} lockere Einheit(en) verpasst`, text: 'Nicht nachholen – verpasster lockerer Umfang lässt sich nicht in die restliche Woche stopfen. Aus dem Kalender entfernen?', ops: missedEasy.map((p) => ({ type: 'remove', id: p.id })) });

  // 4) Besondere Zeiten: Umfang an Prüfungsphase/Reise anpassen (einmal pro Einheit, danach als angepasst markiert).
  if (s?.periods?.length) {
    const byPeriod = new Map();
    for (const p of future) {
      const per = periodOn(p.date, s), type = per && PERIOD_TYPES[per.type];
      if (!type || type.factor >= 1 || p.periodAdjusted || out.some((o) => o.ops.some((op) => op.id === p.id))) continue;
      const key = per.id, list = byPeriod.get(key) || { per, type, items: [] };
      list.items.push(p); byPeriod.set(key, list);
    }
    for (const { per, type, items } of byPeriod.values()) {
      const ops = [];
      let hard = 0;
      for (const p of items.sort((a, b) => a.date.localeCompare(b.date))) {
        if (isHardPlan(p)) {
          hard++;
          if (hard > type.hardMax) ops.push({ type: 'update', id: p.id, patch: { ...scaled(p, Math.min(45, p.minutes), 'I1'), title: `Locker (${type.label})`, periodAdjusted: true } });
          else ops.push({ type: 'update', id: p.id, patch: { periodAdjusted: true } });
        } else if (p.sport === 'strength') {
          ops.push(per.type === 'travel' ? { type: 'update', id: p.id, patch: { title: 'Kraft ohne Geräte (Hotel)', minutes: 30, load: estimatePlanLoad(30, 'Kraft'), periodAdjusted: true } } : { type: 'update', id: p.id, patch: { periodAdjusted: true } });
        } else {
          const m = Math.max(30, Math.round((p.minutes * type.factor) / 5) * 5);
          ops.push({ type: 'update', id: p.id, patch: { ...scaled(p, m), ...(per.type === 'travel' ? { sport: 'run', title: 'Locker (Reise: Laufen oder was geht)' } : {}), periodAdjusted: true } });
        }
      }
      out.push({ id: `period-${per.id}`, level: 'info', title: `${per.label || type.label}: Umfang anpassen`, text: `${type.note} Betrifft ${items.length} Einheit(en) diese Woche.`, ops });
    }
  }

  // 5) Alltag: geplante Zeit passt nicht in die freie Zeit des Tages → kürzen oder verschieben.
  if (sched) {
    const moved = new Map();
    for (let d = t; d <= sunday; d = addDays(d, 1)) {
      const items = future.filter((p) => p.date === d && !out.some((o) => o.ops.some((op) => op.id === p.id)));
      const { overflow } = slotDay(d, items, s);
      if (!overflow.length) continue;
      const ops = [], notes = [];
      for (const id of overflow) {
        const p = items.find((x) => x.id === id);
        // Anderer Tag mit genug Platz (ohne harte Nachbartage bei harten Einheiten)?
        let target = null;
        for (let d2 = t; d2 <= sunday && !target; d2 = addDays(d2, 1)) {
          if (d2 === d) continue;
          if (isHardPlan(p) && (hardDates.has(d2) || hardDates.has(addDays(d2, -1)) || hardDates.has(addDays(d2, 1)))) continue;
          const extra = moved.get(d2) || 0;
          if (cap(d2) - used(d2) - extra >= (p.minutes || 0) + 30) target = d2;
        }
        const room = Math.max(...freeWindows(d, s).map(([x, y]) => y - x), 0);
        if (!isHardPlan(p) && room >= 30) { ops.push({ type: 'update', id, patch: scaled(p, Math.floor(room / 5) * 5) }); notes.push(`${label(p)} auf ${Math.floor(room / 5) * 5}′ kürzen`); }
        else if (target) { ops.push({ type: 'move', id, date: target }); moved.set(target, (moved.get(target) || 0) + p.minutes); notes.push(`${label(p)} auf ${day(target)} verschieben`); if (isHardPlan(p)) { hardDates.delete(d); hardDates.add(target); } }
        else if (room >= 30) { ops.push({ type: 'update', id, patch: scaled(p, Math.floor(room / 5) * 5) }); notes.push(`${label(p)} auf ${Math.floor(room / 5) * 5}′ kürzen`); }
        else { ops.push({ type: 'remove', id }); notes.push(`${label(p)} streichen (kein Platz)`); }
      }
      out.push({ id: `time-${d}`, level: 'info', title: `${day(d)}: zu wenig Zeit`, text: `Frei sind ${Math.round(freeMinutes(d, s))} min. Vorschlag: ${notes.join('; ')}.`, ops });
    }
  }
  return out;
}

export function applyOps(plan, ops) {
  let next = plan;
  for (const op of ops) {
    if (op.type === 'remove') next = next.filter((p) => p.id !== op.id);
    else if (op.type === 'move') next = next.map((p) => (p.id === op.id ? { ...p, date: op.date } : p));
    else if (op.type === 'update') next = next.map((p) => (p.id === op.id ? { ...p, ...op.patch } : p));
  }
  return next;
}
