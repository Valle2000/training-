// Laktat-Stufentest: Schwellen aus Laktat, Puls und Belastung je Stufe.
// LT1 = erster Anstieg um 0,5 mmol über den Ausgangswert (aerobe Schwelle),
// LT2 = modifizierte Dmax-Methode (Bishop et al. 1998) auf einer kubischen Ausgleichskurve,
// dazu die festen Werte 2 und 4 mmol (OBLA) zum Vergleich mit Labortests.

// Olympiatoppen-Zonen nach Laktat (mmol/l): Grenzen I1/I2, I2/I3, I3/I4, I4/I5.
export const LACTATE_ZONE_BOUNDS = [1.5, 2.5, 4, 6];

const clean = (steps) => steps
  .map((s) => ({ load: Number(String(s.load).replace(',', '.')), hr: Number(s.hr) || null, lactate: Number(String(s.lactate).replace(',', '.')), rpe: s.rpe }))
  .filter((s) => s.load > 0 && s.lactate > 0)
  .sort((a, b) => a.load - b.load);

// Linear interpoliert: Belastung und Puls, bei denen das Laktat zuerst den Wert `l` erreicht.
export function atLactate(steps, l) {
  for (let i = 1; i < steps.length; i++) {
    const a = steps[i - 1], b = steps[i];
    if (a.lactate < l && b.lactate >= l) {
      const f = (l - a.lactate) / (b.lactate - a.lactate);
      return { load: a.load + f * (b.load - a.load), hr: a.hr && b.hr ? a.hr + f * (b.hr - a.hr) : null, lactate: l };
    }
  }
  return null;
}

// Kubische Ausgleichskurve (kleinste Quadrate) über Normalgleichungen.
export function cubicFit(xs, ys) {
  const n = 4, A = Array.from({ length: n }, () => Array(n + 1).fill(0));
  for (let k = 0; k < xs.length; k++) {
    const p = [1, xs[k], xs[k] ** 2, xs[k] ** 3];
    for (let i = 0; i < n; i++) { for (let j = 0; j < n; j++) A[i][j] += p[i] * p[j]; A[i][n] += p[i] * ys[k]; }
  }
  for (let i = 0; i < n; i++) {
    let m = i; for (let r = i + 1; r < n; r++) if (Math.abs(A[r][i]) > Math.abs(A[m][i])) m = r;
    [A[i], A[m]] = [A[m], A[i]];
    for (let r = 0; r < n; r++) if (r !== i) { const f = A[r][i] / A[i][i]; for (let c = i; c <= n; c++) A[r][c] -= f * A[i][c]; }
  }
  const c = A.map((row, i) => row[n] / row[i]);
  return (x) => c[0] + c[1] * x + c[2] * x ** 2 + c[3] * x ** 3;
}

const hrAtLoad = (steps, load) => {
  for (let i = 1; i < steps.length; i++) {
    const a = steps[i - 1], b = steps[i];
    if (load >= a.load && load <= b.load && a.hr && b.hr) return a.hr + ((load - a.load) / (b.load - a.load)) * (b.hr - a.hr);
  }
  return null;
};

export function analyzeLactate(rawSteps) {
  const steps = clean(rawSteps);
  if (steps.length < 4) return { steps, error: 'Mindestens 4 Stufen mit Belastung und Laktat eintragen.' };
  const baseline = Math.min(...steps.slice(0, Math.max(2, Math.ceil(steps.length / 3))).map((s) => s.lactate));
  const lt1 = atLactate(steps, baseline + 0.5);

  // Modifizierte Dmax: Linie vom letzten Punkt vor dem ersten Anstieg ≥ 0,4 mmol bis zum letzten Punkt.
  let startIdx = 0;
  for (let i = 1; i < steps.length; i++) if (steps[i].lactate - steps[i - 1].lactate >= 0.4) { startIdx = i - 1; break; }
  const f = cubicFit(steps.map((s) => s.load), steps.map((s) => s.lactate));
  const p1 = { x: steps[startIdx].load, y: f(steps[startIdx].load) }, p2 = { x: steps.at(-1).load, y: f(steps.at(-1).load) };
  let best = null;
  for (let k = 0; k <= 400; k++) {
    const x = p1.x + ((p2.x - p1.x) * k) / 400, y = f(x);
    const d = Math.abs((p2.y - p1.y) * x - (p2.x - p1.x) * y + p2.x * p1.y - p2.y * p1.x) / Math.hypot(p2.y - p1.y, p2.x - p1.x);
    if (!best || d > best.d) best = { d, x, y };
  }
  const lt2 = best && best.x > p1.x ? { load: best.x, hr: hrAtLoad(steps, best.x), lactate: best.y } : null;

  const zoneHr = LACTATE_ZONE_BOUNDS.map((l) => atLactate(steps, l)?.hr ?? null);
  return { steps, baseline, lt1, lt2, at2: atLactate(steps, 2), at4: atLactate(steps, 4), zoneHr, fit: f };
}
