// Key Sessions: wiederkehrende Schlüsseleinheiten (z. B. „5×6 min Schwelle Rollski“), deren Fortschritt verfolgt wird.
// Zuordnung manuell (activity.keySessionId) oder automatisch über Sportart + Stichwörter im Titel.

export const KEY_TEMPLATES = [
  { name: 'Double Threshold AM (5×6 min)', sport: 'rollerski_skate', keywords: 'threshold, schwelle, 5x6, 5×6', intervalSec: 360, zone: 'I3', description: '5×6 min an der Schwelle, 1 min Pause, Laktat 2–3 mmol/l' },
  { name: 'Double Threshold PM (10×3 min)', sport: 'run', keywords: '10x3, 10×3', intervalSec: 180, zone: 'I3', description: '10×3 min, 30–60 s Pause, Laktat 2–3,5 mmol/l' },
  { name: 'VO2max-Intervalle (5×4 min)', sport: 'bike', keywords: '5x4, 5×4, vo2', intervalSec: 240, zone: 'I4', description: '5×4 min hart, 2–3 min Pause' },
  { name: 'Lange Grundlage', sport: 'rollerski_classic', keywords: 'lang, long, grundlage', intervalSec: 3600, zone: 'I1', description: '2,5–4 h locker, Entkopplung und Effizienz beobachten' },
  { name: 'SkiErg-Schwelle', sport: 'skierg', keywords: 'skierg, schwelle', intervalSec: 600, zone: 'I3', description: 'z. B. 3×10 min am SkiErg' },
  { name: 'SkiErg 3×20 min', sport: 'skierg', keywords: '3x20, 3×20', intervalSec: 1200, laps: '2-4', zone: 'I2', description: '20 min ein, 3×20 min (2 min Pause), 20 min aus – ausgewertet werden nur die Runden 2–4' },
];

const words = (k) => String(k || '').toLowerCase().split(',').map((w) => w.trim()).filter(Boolean);

export function matchesKey(a, ks) {
  if (a.keySessionId) return a.keySessionId === ks.id;
  if (ks.sport && a.sport !== ks.sport) return false;
  const title = `${a.title || ''} ${a.notes || ''}`.toLowerCase();
  const kw = words(ks.keywords);
  return kw.length > 0 && kw.some((w) => title.includes(w));
}

// Laktatwerte aus Freitext („2,1 / 2,4 / 2,8“) → Zahlen.
export const parseLactate = (s) => (String(s || '').match(/\d+(?:[.,]\d+)?/g) || []).map((x) => Number(x.replace(',', '.'))).filter((x) => x > 0 && x < 25);

// Wert der Bestwertkurve für die gewünschte Dauer; fehlt sie, die nächstkürzere vorhandene Dauer.
export function curveAt(c, sec) {
  if (!c) return null;
  if (c[sec] != null) return c[sec];
  const d = Object.keys(c).map(Number).filter((x) => x <= sec).sort((a, b) => b - a)[0];
  return d ? c[d] : null;
}

// Rundenbereich „2-4“ oder „2,3,4“ → Rundennummern (1-basiert).
export function parseLapRange(s) {
  const t = String(s || '').replace(/\s/g, '');
  if (!t) return null;
  const out = new Set();
  for (const part of t.split(',')) {
    const m = /^(\d+)(?:[-–](\d+))?$/.exec(part);
    if (!m) continue;
    for (let i = Number(m[1]); i <= Number(m[2] || m[1]); i++) out.add(i);
  }
  return out.size ? [...out].sort((a, b) => a - b) : null;
}

// Ø Leistung und Ø Puls über ausgewählte Runden, nach Dauer gewichtet (z. B. nur die 3×20 min in der Mitte).
export function lapAverages(laps, range) {
  const sel = (laps || []).filter((l) => range.includes(l.n));
  if (!sel.length) return null;
  const w = (k) => { const v = sel.filter((l) => l[k] > 0); const t = v.reduce((a, l) => a + (l.durationS || 0), 0); return t ? Math.round(v.reduce((a, l) => a + l[k] * (l.durationS || 0), 0) / t) : null; };
  return { power: w('avgPower'), hr: w('avgHr'), minutes: Math.round(sel.reduce((a, l) => a + (l.durationS || 0), 0) / 60), count: sel.length };
}

export function keySessionRows(activities, ks) {
  const d = ks.intervalSec || 300;
  const range = parseLapRange(ks.laps);
  return activities.filter((a) => matchesKey(a, ks)).sort((a, b) => a.date.localeCompare(b.date)).map((a) => {
    const lac = parseLactate(a.lactate);
    const lapAvg = range ? lapAverages(a.laps, range) : null;
    const pw = lapAvg ? lapAvg.power : curveAt(a.powerCurve, d), hr = lapAvg ? lapAvg.hr : curveAt(a.hrCurve, d);
    return {
      id: a.id, date: a.date, minutes: Math.round((a.durationS || 0) / 60), load: a.load, rpe: a.rpe,
      avgHr: a.avgHr, avgPower: a.avgPower, np: a.np, ef: a.ef, decoupling: a.decoupling,
      intervalPower: pw, intervalHr: hr, fromLaps: !!lapAvg, intervalRatio: pw && hr ? Math.round((pw / hr) * 100) / 100 : null,
      lactateAvg: lac.length ? Math.round((lac.reduce((x, y) => x + y, 0) / lac.length) * 10) / 10 : null, lactateMax: lac.length ? Math.max(...lac) : null,
    };
  });
}

// Veränderung erster → letzter Wert in %; better: ob die Richtung eine Verbesserung ist.
export function trend(rows, key, lowerIsBetter = false) {
  const v = rows.map((r) => r[key]).filter((x) => x != null);
  if (v.length < 2) return null;
  const pct = Math.round(((v.at(-1) - v[0]) / v[0]) * 1000) / 10;
  return { pct, better: lowerIsBetter ? pct < 0 : pct > 0 };
}
