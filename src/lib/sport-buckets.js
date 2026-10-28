// Gruppen für Einheiten ohne Sportnummer und ohne Titel (z. B. TCX mit „Other“): Tempo und Jahreszeit.
const WINTER = new Set([11, 12, 1, 2, 3]);

// Gruppe wie „5–17 km/h|Winter“, null bei zu kurzen Einheiten (unter 5 min) – die werden nicht gefragt.
export function tempoGroup({ distanceM, durationS, start }) {
  if ((durationS || 0) < 300) return null;
  const season = WINTER.has(Number(String(start).slice(5, 7))) ? 'Winter' : 'Sommer';
  if (!distanceM) return `ohne Distanz|${season}`;
  const kmh = (distanceM / 1000) / (durationS / 3600);
  const speed = kmh < 5 ? 'unter 5 km/h' : kmh <= 17 ? '5–17 km/h' : 'über 17 km/h';
  return `${speed}|${season}`;
}
