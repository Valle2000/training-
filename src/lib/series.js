// 1-Hz-Reihen aus Messpunkten (ohne FIT-Bibliothek, damit sie nur bei Bedarf geladen wird).
const MAX_GAP_S = 5; // längere Lücken gelten als Pause

// Punkte {t: ms, hr, power, speed, alt} → 1-Hz-Reihen über die Bewegungszeit.
// maxGap: bis zu dieser Lücke wird mit dem letzten Wert gefüllt (Concept2 speichert nicht jeden Schlag einzeln).
export function toSeries(points, maxGap = MAX_GAP_S) {
  const out = { hr: [], power: [], speed: [], alt: [] };
  const push = (p) => { out.hr.push(p.hr ?? null); out.power.push(p.power ?? null); out.speed.push(p.speed ?? null); out.alt.push(p.alt ?? null); };
  // Sekunde jedes Punkts aus der echten Zeitachse (nicht aus gerundeten Einzelabständen, sonst summieren sich
  // Rundungsfehler, z. B. bei Schlägen alle 1,5 s). Pausen über maxGap werden herausgenommen.
  let t0 = null, prev = null, lastSec = -1, paused = 0;
  for (const p of points) {
    if (prev) {
      const gap = (p.t - prev.t) / 1000;
      if (gap <= 0) continue;
      if (gap > maxGap) paused += gap - 1;
    } else t0 = p.t;
    const sec = Math.round((p.t - t0) / 1000 - paused);
    if (sec > lastSec) {
      for (let s = lastSec + 1; s < sec; s++) push(prev);
      push(p);
      lastSec = sec;
    }
    prev = p;
  }
  return out;
}

// Für Anzeige und Speicherung auf 5-s-Schritte ausdünnen.
export const thin = (series, step = 5) => Object.fromEntries(Object.entries(series).map(([k, v]) => [k, v.filter((_, i) => i % step === 0)]));
