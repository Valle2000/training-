// Intervalle erkennen: Abschnitte, die deutlich über dem Schnitt der Einheit liegen.
// Gilt für Watt (Rad, Ergometer) und für geschätzte Leistung (Laufen, Rollski). Sub-Threshold-Einheiten
// haben dann kaum oder keine Intervalle, weil ihr Schnitt schon nahe am Niveau liegt.
export function detectIntervals(values, { minS = 60, factor = 1.12, gapS = 15, smoothS = 15 } = {}) {
  const v = values.map((x) => (x == null || Number.isNaN(x) ? null : x));
  const moving = v.filter((x) => x != null && x > 0);
  if (moving.length < minS) return [];
  const mean = moving.reduce((a, b) => a + b, 0) / moving.length;
  const limit = mean * factor;
  const half = Math.floor(smoothS / 2);
  const sm = v.map((_, i) => {
    let s = 0, n = 0;
    for (let j = Math.max(0, i - half); j <= Math.min(v.length - 1, i + half); j++) if (v[j] != null) { s += v[j]; n++; }
    return n ? s / n : null;
  });
  // zusammenhängende Abschnitte über der Schwelle
  const raw = [];
  let open = null;
  sm.forEach((x, i) => {
    const above = x != null && x > limit;
    if (above && open == null) open = i;
    if (!above && open != null) { raw.push([open, i - 1]); open = null; }
  });
  if (open != null) raw.push([open, sm.length - 1]);
  // kurze Lücken schließen
  const merged = [];
  for (const seg of raw) {
    const last = merged.at(-1);
    if (last && seg[0] - last[1] - 1 <= gapS) last[1] = seg[1];
    else merged.push([...seg]);
  }
  return merged
    .filter(([a, b]) => b - a + 1 >= minS)
    .map(([a, b]) => {
      const part = v.slice(a, b + 1).filter((x) => x != null);
      return { startS: a, endS: b, durationS: b - a + 1, avg: Math.round(part.reduce((x, y) => x + y, 0) / part.length) };
    });
}
