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
