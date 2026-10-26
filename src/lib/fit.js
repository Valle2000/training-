// FIT-Dateien (Polar, Wahoo, Garmin …) im Browser lesen und auf ein 1-Hz-Raster bringen.
import { Decoder, Stream } from '@garmin/fitsdk';
import { sportFromFit } from './sports.js';

const MAX_GAP_S = 5; // längere Lücken gelten als Pause

export function parseFit(bytes) {
  const decoder = new Decoder(Stream.fromByteArray(bytes instanceof Uint8Array ? Array.from(bytes) : bytes));
  if (!decoder.isFIT()) throw new Error('Keine FIT-Datei');
  const { messages, errors } = decoder.read();
  const records = (messages.recordMesgs || []).filter((r) => r.timestamp).sort((a, b) => a.timestamp - b.timestamp);
  const s = messages.sessionMesgs?.[0] || {};
  const start = s.startTime || records[0]?.timestamp;
  if (!start) throw new Error(errors?.[0]?.message || 'FIT-Datei enthält keine Messpunkte');
  const hrs = records.map((r) => r.heartRate).filter(Boolean);
  const pws = records.map((r) => r.power).filter((p) => p != null);
  return {
    start: new Date(start).toISOString(),
    sport: sportFromFit(s.sport, s.subSport),
    elapsedS: s.totalElapsedTime ?? s.totalTimerTime ?? (records.length ? (records.at(-1).timestamp - records[0].timestamp) / 1000 : 0),
    distanceM: s.totalDistance ?? null,
    avgHr: s.avgHeartRate ?? (hrs.length ? hrs.reduce((a, b) => a + b, 0) / hrs.length : null),
    maxHr: s.maxHeartRate ?? (hrs.length ? Math.max(...hrs) : null),
    avgPower: s.avgPower ?? (pws.some(Boolean) ? pws.reduce((a, b) => a + b, 0) / pws.length : null),
    calories: s.totalCalories ?? null,
    ascentM: s.totalAscent ?? null,
    series: toSeries(records.map((r) => ({ t: r.timestamp.getTime(), hr: r.heartRate, power: r.power, speed: r.enhancedSpeed ?? r.speed, alt: r.enhancedAltitude ?? r.altitude }))),
  };
}

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
