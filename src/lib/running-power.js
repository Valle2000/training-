// Näherung der Laufleistung (Stoffwechselleistung je kg, Minetti et al. 2002) aus Tempo und Steigung.
// Ergebnis in Watt; für Vergleiche innerhalb derselben Person, nicht als Absolutwert.
export function runPower(speedMs, gradePct, massKg = 75) {
  if (!(speedMs > 0)) return null;
  const g = Math.max(-0.45, Math.min(0.45, (gradePct || 0) / 100));
  // Kosten je kg und Meter (J/kg/m), Minetti-Polynom
  const cost = 155.4 * g ** 5 - 30.4 * g ** 4 - 43.3 * g ** 3 + 46.3 * g ** 2 + 19.5 * g + 3.6;
  return Math.round(massKg * Math.max(0, cost) * speedMs);
}
