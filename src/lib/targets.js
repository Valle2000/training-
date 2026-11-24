// Konkrete Zielwerte für geplante Einheiten: Puls (aus dem Maximalpuls), Lauftempo (aus der Schwellenpace)
// und Watt (aus der FTP der Sportart). Richtwerte, die mit Puls und Gefühl abgeglichen werden.
import { athleteOf } from './activities.js';
import { ZONES } from './metrics.js';

export const parsePace = (txt) => {
  const m = String(txt ?? '').trim().match(/^(\d{1,2})[:.,](\d{2})$/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};
export const fmtPace = (sec) => `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, '0')}`;

// Lauftempo je Zone als Faktor auf die Schwellenpace (größer = langsamer).
const RUN_PACE = { I1: [1.25, 1.4], I2: [1.12, 1.2], I3: [1.0, 1.04], I4: [0.93, 0.97], I5: [0.88, 0.92] };
// Renntempo-Einheiten im Laufen haben eigene Bereiche.
const RUN_KEY_PACE = { run_mp3x15: [1.06, 1.09], run_hm3x10: [1.02, 1.04], run_10k5x4: [0.96, 0.98], dtpm_25x400: [0.98, 1.01] };
// Watt je Zone in % der FTP; einzelne Einheiten genauer.
const POWER = { I1: [0.56, 0.75], I2: [0.76, 0.87], I3: [0.9, 1.0], I4: [1.05, 1.2], I5: [1.2, 1.5] };
const KEY_POWER = { bike_sweet2x15: [0.88, 0.94], bike_2x20: [0.95, 1.0], bike_3x12: [0.97, 1.03], bike_overunder: [0.95, 1.05], bike_tempo2x30: [0.76, 0.9], bike_climb_tt: [1.0, 1.05], bike_climb5x6: [1.06, 1.15], bike_hit5x4: [1.06, 1.2] };
const POWER_SPORTS = ['bike', 'bikeerg', 'skierg', 'row'];

export function planTargets(item, settings = {}) {
  if (!item || !item.zone || !ZONES.some((z) => z.id === item.zone)) return null;
  const parts = [];
  const a = athleteOf(settings, item.sport);
  if (item.sport === 'run' && item.zone !== 'I1') {
    const t = parsePace(settings.thresholdPace);
    const f = RUN_KEY_PACE[item.keyId] || RUN_PACE[item.zone];
    if (t && f) parts.push(`${fmtPace(t * f[0])}–${fmtPace(t * f[1])} min/km`);
  }
  if (item.sport === 'run' && item.zone === 'I1') {
    const t = parsePace(settings.thresholdPace);
    if (t) parts.push(`langsamer als ${fmtPace(t * RUN_PACE.I1[0])} min/km`);
  }
  if (POWER_SPORTS.includes(item.sport) && a.ftp) {
    const f = KEY_POWER[item.keyId] || POWER[item.zone];
    if (f) parts.push(item.keyId === 'bike_overunder' ? `${Math.round(a.ftp * 1.05)} / ${Math.round(a.ftp * 0.95)} W im Wechsel` : `${Math.round(a.ftp * f[0])}–${Math.round(a.ftp * f[1])} W`);
  }
  if (a.hrMax) {
    const z = ZONES.find((x) => x.id === item.zone);
    const lo = item.zone === 'I1' ? null : Math.round(a.hrMax * z.from), hi = Math.round(a.hrMax * Math.min(1, z.to));
    parts.push(lo ? `${lo}–${hi} bpm` : `unter ${hi} bpm`);
  }
  return parts.length ? parts.join(' · ') : null;
}
