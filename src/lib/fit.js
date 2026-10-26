// FIT-Dateien (Polar, Wahoo, Garmin …) im Browser lesen und auf ein 1-Hz-Raster bringen.
import { Decoder, Stream } from '@garmin/fitsdk';
import { sportFromFit } from './sports.js';
import { toSeries } from './series.js';

export { toSeries, thin } from './series.js';

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
    // Runden (Lap-Taste oder automatische Runden der Uhr).
    laps: (messages.lapMesgs || []).length > 1 ? messages.lapMesgs.map((l, i) => ({
      n: i + 1, startS: l.startTime ? (new Date(l.startTime) - new Date(start)) / 1000 : null,
      durationS: l.totalTimerTime ?? l.totalElapsedTime ?? null, distanceM: l.totalDistance ?? null,
      avgHr: l.avgHeartRate ?? null, maxHr: l.maxHeartRate ?? null, avgPower: l.avgPower ?? null, spm: l.avgCadence ?? null,
      pace: l.totalTimerTime && l.totalDistance ? (l.totalTimerTime / l.totalDistance) * 1000 : null,
    })) : null,
    series: toSeries(records.map((r) => ({ t: r.timestamp.getTime(), hr: r.heartRate, power: r.power, speed: r.enhancedSpeed ?? r.speed, alt: r.enhancedAltitude ?? r.altitude }))),
  };
}

