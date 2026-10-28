// Runden/Intervalle: aus Concept2-Intervallen, FIT-/TCX-Runden oder aus dem Verlauf, dazu eine kleine Auswertung.

// Pace in Sekunden pro 500 m (Ergometer) bzw. pro km.
export const pacePer = (seconds, meters, per = 500) => (seconds && meters ? (seconds / meters) * per : null);
// Erst runden, dann aufteilen (sonst entsteht „1:60“).
export const fmtPace = (s) => { if (s == null) return '–'; const r = Math.round(s); return `${Math.floor(r / 60)}:${String(r % 60).padStart(2, '0')}`; };

const avg = (a) => { const v = a.filter((x) => x > 0); return v.length ? v.reduce((x, y) => x + y, 0) / v.length : null; };

// Concept2 liefert je Intervall bzw. Split Zeit in Zehntelsekunden, Distanz in m, Pause, Schlagzahl, Puls.
export function lapsFromConcept2(workout, type, c2Watts) {
  const list = workout?.intervals?.length ? workout.intervals : workout?.splits || [];
  let t = 0;
  return list.map((iv, i) => {
    const timeS = (Number(iv.time) || 0) / 10, restS = (Number(iv.rest_time) || 0) / 10, dist = Number(iv.distance) || null;
    const lap = {
      n: i + 1, startS: t, durationS: timeS, distanceM: dist, restS: restS || null, restDistanceM: Number(iv.rest_distance) || null,
      avgHr: iv.heart_rate?.average || null, maxHr: iv.heart_rate?.max || null, endHr: iv.heart_rate?.ending || null,
      spm: iv.stroke_rate || null, calories: iv.calories_total || null,
      pace: pacePer(timeS, dist, type === 'bike' ? 1000 : 500),
    };
    lap.avgPower = lap.pace ? c2Watts(lap.pace * 10, type) : null;
    t += timeS + restS;
    return lap;
  });
}

// Runden aus einem 1-Hz-Verlauf und Grenzen in Sekunden ab Start.
export function lapsFromSeries(series, bounds) {
  return bounds.map((b, i) => {
    const s = Math.max(0, Math.round(b.startS)), e = Math.min(series.hr.length, Math.round(b.startS + b.durationS));
    const hr = series.hr.slice(s, e), pw = series.power.slice(s, e);
    return { n: i + 1, startS: b.startS, durationS: b.durationS, distanceM: b.distanceM ?? null, avgHr: b.avgHr ?? avg(hr), maxHr: b.maxHr ?? (hr.some(Boolean) ? Math.max(...hr.filter(Boolean)) : null), avgPower: b.avgPower ?? avg(pw), spm: b.spm ?? null, pace: b.pace ?? null, restS: b.restS ?? null };
  });
}

// Auswertung der Belastungsrunden: Gleichmäßigkeit, Pulsanstieg bei gleicher Leistung, beste/schwächste Runde.
export function lapAnalysis(laps) {
  const work = laps.filter((l) => l.durationS >= 20 && (l.avgPower || l.pace || l.avgHr));
  if (work.length < 2) return null;
  const out = { count: work.length };
  const pw = work.map((l) => l.avgPower).filter(Boolean);
  if (pw.length >= 2) {
    const m = pw.reduce((a, b) => a + b, 0) / pw.length;
    out.powerMean = Math.round(m);
    out.powerCv = Math.round((Math.sqrt(pw.reduce((a, b) => a + (b - m) ** 2, 0) / pw.length) / m) * 1000) / 10;
    out.best = work.reduce((a, b) => ((b.avgPower || 0) > (a.avgPower || 0) ? b : a)).n;
    out.worst = work.reduce((a, b) => ((b.avgPower || Infinity) < (a.avgPower || Infinity) ? b : a)).n;
    out.fade = Math.round(((pw.at(-1) - pw[0]) / pw[0]) * 1000) / 10;
  }
  const hr = work.map((l) => l.avgHr).filter(Boolean);
  if (hr.length >= 2) out.hrRise = Math.round(hr.at(-1) - hr[0]);
  const ratio = work.filter((l) => l.avgPower && l.avgHr).map((l) => l.avgPower / l.avgHr);
  if (ratio.length >= 2) out.efficiencyDrop = Math.round(((ratio[0] - ratio.at(-1)) / ratio[0]) * 1000) / 10;
  return out;
}

// Name einer Concept2-Einheit: eigener Name, falls die Schnittstelle einen liefert, sonst der Kommentar
// (kurz, einzeilig), sonst aus dem Aufbau wie im Logbuch („5×6:00/1:00r“, „10.000m“, „30:00“).
const WORKOUT_TYPES = /^(JustRow|Fixed\w*|Variable\w*|WattMinute\w*|FixedWattMinute\w*)$/;
export const isAutoC2Title = (t) => !t || WORKOUT_TYPES.test(t);
const c2Time = (tenths) => {
  const s = Math.round(tenths / 10), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
};
const c2Dist = (m) => `${Number(m).toLocaleString('de-DE')}m`;
export function concept2Title(r, workout) {
  const own = [r.name, r.workout_name, r.title, workout?.name, r.metadata?.name].find((x) => typeof x === 'string' && x.trim());
  if (own) return own.trim();
  const c = (r.comments || '').trim();
  if (c && c.length <= 60 && !c.includes('\n')) return c;
  const wt = r.workout_type || '';
  if (/^FixedTime/.test(wt) && !/Interval/.test(wt)) return c2Time(r.time);
  if (/^FixedDistance/.test(wt) && !/Interval/.test(wt)) return c2Dist(r.distance);
  const iv = workout?.intervals || [];
  if (!iv.length) return '';
  const kind = (x) => x.type || (/Distance/.test(wt) ? 'distance' : /Calorie/.test(wt) ? 'calorie' : /Time/.test(wt) ? 'time'
    : (Number(x.time) % 600 === 0 ? 'time' : Number(x.distance) % 100 === 0 ? 'distance' : 'time'));
  const target = (x) => { const k = kind(x); return k === 'distance' ? c2Dist(x.distance) : k === 'calorie' ? `${x.calories_total}cal` : c2Time(x.time); };
  // Gleiche Intervalle hintereinander zusammenfassen; die (fehlende) Pause nach dem letzten zählt nicht.
  const groups = [];
  iv.forEach((x, i) => {
    const t = target(x), rest = Number(x.rest_time) || 0, g = groups.at(-1);
    if (g && g.t === t && (g.rest === rest || i === iv.length - 1)) g.n++; else groups.push({ t, rest, n: 1 });
  });
  const label = (g, last) => g.t + (g.rest && !(last && g.n === 1) ? `/${c2Time(g.rest)}r` : '');
  return groups.map((g, i) => (g.n > 1 ? `${g.n}×` : '') + label(g, i === groups.length - 1)).join(', ');
}
