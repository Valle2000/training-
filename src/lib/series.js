// 1-Hz-Reihen aus Messpunkten (ohne FIT-Bibliothek, damit sie nur bei Bedarf geladen wird).
const MAX_GAP_S = 5; // längere Lücken gelten als Pause

// Punkte {t: ms, hr, power, speed, alt} → 1-Hz-Reihen über die Bewegungszeit.
export function toSeries(points) {
  const out = { hr: [], power: [], speed: [], alt: [] };
  let prev = null;
  const push = (p) => { out.hr.push(p.hr ?? null); out.power.push(p.power ?? null); out.speed.push(p.speed ?? null); out.alt.push(p.alt ?? null); };
  for (const p of points) {
    if (prev) {
      const gap = Math.round((p.t - prev.t) / 1000);
      if (gap <= 0) continue;
      if (gap <= MAX_GAP_S) for (let i = 1; i < gap; i++) push(prev);
    }
    push(p);
    prev = p;
  }
  return out;
}

// Für Anzeige und Speicherung auf 5-s-Schritte ausdünnen.
export const thin = (series, step = 5) => Object.fromEntries(Object.entries(series).map(([k, v]) => [k, v.filter((_, i) => i % step === 0)]));
