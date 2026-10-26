// Tagesampel aus Morgen-Check, HRV-Trend, Ruhepuls und Form. Orientierung, keine Diagnose.

export const SYMPTOMS = [
  ['throat', 'Halsschmerzen', 'above'], ['nose', 'Schnupfen', 'above'], ['headache', 'Kopfschmerzen', 'above'],
  ['cough', 'Husten / Brust', 'below'], ['fever', 'Fieber / Gliederschmerzen', 'below'], ['stomach', 'Magen-Darm', 'below'],
];

const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
const sd = (a) => { const m = mean(a); return a.length > 2 ? Math.sqrt(mean(a.map((x) => (x - m) ** 2))) : null; };

// wellness: [{date, hrv, restHr, feel, soreness, stress, sleepQ, symptoms:[]}], aufsteigend sortiert.
export function readinessFor(date, wellness, form = null) {
  const today = wellness.find((w) => w.date === date) || {};
  const prev = wellness.filter((w) => w.date < date).slice(-30);
  const reasons = [];
  let score = 100, red = false;
  const add = (pts, text, isRed = false) => { score -= pts; reasons.push(text); if (isRed) red = true; };

  const sym = (today.symptoms || []).map((s) => SYMPTOMS.find((x) => x[0] === s)).filter(Boolean);
  if (sym.some((s) => s[2] === 'below')) add(60, 'Symptome unterhalb des Halses: kein Training', true);
  else if (sym.length) add(25, 'Symptome oberhalb des Halses: höchstens locker');

  // HRV: heutiger Wert gegen Mittel und Streuung der letzten 30 Tage.
  const hrvs = prev.map((w) => w.hrv).filter(Boolean);
  if (today.hrv && hrvs.length >= 5) {
    const m = mean(hrvs), s = sd(hrvs) || m * 0.07;
    if (today.hrv < m - 2 * s) add(30, `HRV deutlich unter normal (${today.hrv} vs. Ø ${Math.round(m)} ms)`, true);
    else if (today.hrv < m - s) add(15, `HRV unter normal (${today.hrv} vs. Ø ${Math.round(m)} ms)`);
  }
  const rhs = prev.map((w) => w.restHr).filter(Boolean);
  if (today.restHr && rhs.length >= 5) {
    const m = mean(rhs);
    if (today.restHr >= m + 8) add(25, `Ruhepuls stark erhöht (+${Math.round(today.restHr - m)})`, true);
    else if (today.restHr >= m + 5) add(12, `Ruhepuls erhöht (+${Math.round(today.restHr - m)})`);
  }
  if (today.feel && today.feel <= 2) add(15, 'Fühlt sich schlecht an');
  if (today.soreness && today.soreness >= 4) add(10, 'Starker Muskelkater');
  if (today.sleepQ && today.sleepQ <= 2) add(10, 'Schlecht geschlafen');
  if (today.sleepH && today.sleepH < 6) add(10, `Wenig Schlaf (${today.sleepH} h)`);
  if (today.stress && today.stress >= 4) add(8, 'Hoher Stress');
  if (form != null && form < -30) add(15, `Hohe Ermüdung (Form ${Math.round(form)})`);
  else if (form != null && form > 15) reasons.push('Frisch – guter Tag für Qualität');

  score = Math.max(0, score);
  const level = red || score < 50 ? 'rot' : score < 75 ? 'gelb' : 'gruen';
  const advice = { gruen: 'Training wie geplant.', gelb: 'Harte Einheit nur bei gutem Gefühl, sonst locker oder kürzer.', rot: 'Ruhetag oder nur sehr locker.' }[level];
  const hasData = Object.keys(today).length > 1 || form != null;
  return { level, score, reasons, advice, checked: today.feel != null, hasData };
}
