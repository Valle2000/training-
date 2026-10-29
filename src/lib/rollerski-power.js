// Schätzung der Leistung auf Rollski aus Tempo und Höhenprofil: Steigung, Rollwiderstand und Luftwiderstand.
// Die Schätzung ist eine Untergrenze (Stockarbeit fehlt) und ohne Leistungsmesser grob ±15–25 %.
const G = 9.81, RHO = 1.2;

// Rollwiderstand je Stufe am Rollski (1 = leicht, 4 = schwer). Richtwerte, in den Einstellungen anpassbar.
export const ROLL_CRR = { 1: 0.010, 2: 0.014, 3: 0.018, 4: 0.022 };

// Vorne und hinten getrennt eingestellt: Mittel aus beiden Stufen.
export function crrFor(front, rear) {
  const f = ROLL_CRR[front] ?? ROLL_CRR[3], r = ROLL_CRR[rear] ?? ROLL_CRR[3];
  return (f + r) / 2;
}

const mean = (arr, i, w) => {
  let s = 0, n = 0;
  for (let j = Math.max(0, i - w); j <= Math.min(arr.length - 1, i + w); j++) if (arr[j] != null) { s += arr[j]; n++; }
  return n ? s / n : null;
};

// series: {speed: m/s, alt: m} im gleichen Takt (dt Sekunden je Wert). Gibt Durchschnittsleistung der Bewegungszeit zurück.
export function rollerPower(series, { massKg = 75, front = 3, rear = 3, cdA = 0.35, dt = 1, minSpeed = 1 } = {}) {
  const v = series.speed || [], alt = series.alt || [];
  const crr = crrFor(front, rear), w = Math.max(1, Math.round(5 / dt));
  let sumP = 0, n = 0, dist = 0;
  for (let i = 0; i < v.length; i++) {
    const vi = mean(v, i, w);
    if (vi == null || vi < minSpeed) continue;
    // Steigung über ein Fenster von ±5 s: Höhenänderung geteilt durch die Strecke in diesem Fenster.
    const a1 = mean(alt, Math.min(alt.length - 1, i + w), 0), a0 = mean(alt, Math.max(0, i - w), 0);
    const seg = vi * 2 * w * dt;
    const grade = a1 != null && a0 != null && seg > 0 ? Math.max(-0.3, Math.min(0.3, (a1 - a0) / seg)) : 0;
    const theta = Math.atan(grade);
    const p = massKg * G * vi * (Math.sin(theta) + crr * Math.cos(theta)) + 0.5 * RHO * cdA * vi ** 3;
    sumP += Math.max(0, p); n++;
    dist += vi * dt;
  }
  return n ? { watts: Math.round(sumP / n), samples: n, distanceM: Math.round(dist) } : null;
}
