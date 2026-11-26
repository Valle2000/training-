// Kleine Planänderungen per KI: kompakte Plan-Liste für die Anfrage und sicheres Anwenden der Vorschläge.
import { addDays } from './metrics.js';
import { estimatePlanLoad } from './activities.js';
import { SPORTS } from './sports.js';

const SPORT_IDS = new Set(SPORTS.map((s) => s.id));
const ZONES = new Set(['I1', 'I2', 'I3', 'I4', 'I5', 'Kraft']);

// Geplante Einheiten ab heute (Standard 28 Tage) in der Form, die die KI bekommt.
export function planForEdit(plan, today, days = 28) {
  const to = addDays(today, days);
  return plan.filter((p) => p.date >= today && p.date <= to).sort((a, b) => a.date.localeCompare(b.date)).map((p) => ({
    id: p.id, datum: p.date, titel: p.title || '', sport: p.sport, minuten: Number(p.minutes) || 0, zone: p.zone || null,
    beschreibung: String(p.description || '').slice(0, 300), quelle: p.source || 'eigene', erledigt: !!p.done,
  }));
}

// Vorschläge anwenden. Nur bekannte ids, nichts vor heute, erledigte Einheiten bleiben. Gibt Zählung und Hinweise zurück.
export function applyPlanEdits(plan, ops = [], newId, today) {
  const byId = new Map(plan.map((p) => [p.id, p]));
  let next = [...plan];
  const res = { added: 0, changed: 0, removed: 0, skipped: [] };
  const clean = (o) => {
    const minutes = Math.max(0, Math.min(600, Math.round(Number(o.minuten) || 0)));
    const zone = ZONES.has(o.zone) ? o.zone : null;
    return { date: o.datum, title: String(o.titel || '').trim() || 'Einheit', sport: SPORT_IDS.has(o.sport) ? o.sport : 'other', minutes, zone, description: String(o.beschreibung || ''), load: zone === 'Kraft' ? Math.round(minutes * 0.75) : minutes ? estimatePlanLoad(minutes, zone || 'I1') : 0 };
  };
  for (const o of ops) {
    const okDate = /^\d{4}-\d{2}-\d{2}$/.test(o.datum || '') && o.datum >= today;
    if (o.aktion === 'neu') {
      if (!okDate) { res.skipped.push(`${o.titel}: Datum ungültig oder in der Vergangenheit`); continue; }
      next.push({ id: newId(), ...clean(o), source: 'coach', done: false }); res.added++;
      continue;
    }
    const old = byId.get(o.id);
    if (!old) { res.skipped.push(`${o.titel || o.id}: Einheit nicht gefunden`); continue; }
    if (old.done || old.date < today) { res.skipped.push(`${old.title || 'Einheit'}: schon erledigt bzw. vorbei`); continue; }
    if (o.aktion === 'loeschen') { next = next.filter((p) => p.id !== old.id); res.removed++; continue; }
    if (o.aktion === 'aendern') {
      if (!okDate) { res.skipped.push(`${old.title}: neues Datum ungültig`); continue; }
      next = next.map((p) => (p.id === old.id ? { ...p, ...clean(o), edited: true } : p)); res.changed++;
    }
  }
  return { plan: next, ...res };
}
