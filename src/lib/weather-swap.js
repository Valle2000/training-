// Rad wetterabhängig tauschen: eine geplante Radeinheit wird zu Laufen, Rollski, SkiErg oder Rolle.
// Dazu die Rad-Saison (Monate), in der der Saisonplan überhaupt Rad plant.
import { estimatePlanLoad } from './activities.js';
import { sportLabel } from './sports.js';

export const BIKE_SWAP = [['run', 'Laufen'], ['rollerski_skate', 'Rollski'], ['skierg', 'SkiErg'], ['bikeerg', 'Rolle/Ergometer']];

// Laufen belastet pro Minute mehr als Radfahren (Stoßbelastung, höherer Puls bei gleichem Gefühl): lockere Einheiten werden
// auf drei Viertel der Zeit gekürzt und auf 2,5 h begrenzt. Harte Einheiten behalten ihre Struktur.
export function swapPlanItem(p, to) {
  if (!p || p.sport === to) return p;
  const fromLabel = sportLabel(p.sport), toLabel = sportLabel(to);
  const easy = !['I3', 'I4', 'I5'].includes(p.zone);
  let minutes = Number(p.minutes) || 0;
  if (to === 'run' && p.sport === 'bike' && easy) minutes = Math.min(150, Math.round((minutes * 0.75) / 5) * 5);
  const t = String(p.title || '');
  const title = /^Locker \(/.test(t) ? `Locker (${toLabel})`
    : /^Lange Ausfahrt/.test(t) ? `Lange Grundlage (${toLabel})`
      : t.replace(/^Rad\s+/, '') ? `${toLabel}: ${t.replace(/^Rad\s+/, '')}` : toLabel;
  const note = `Getauscht statt ${fromLabel}${minutes !== p.minutes ? ` (${p.minutes} → ${minutes} min)` : ''}.`;
  return { ...p, sport: to, title, minutes, load: estimatePlanLoad(minutes, p.zone), description: [p.description, note].filter(Boolean).join(' '), swappedFrom: p.sport };
}

// Rad-Saison als Monate (z. B. 4 bis 10 = April bis Oktober). Ohne Angabe ist Rad das ganze Jahr möglich.
export const bikeInSeason = (date, from, to) => {
  if (!from || !to) return true;
  const m = Number(String(date).slice(5, 7));
  return from <= to ? m >= from && m <= to : m >= from || m <= to;
};
