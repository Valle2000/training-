// Sportarten. "ski" zählt für die Langlauf-Auswertung, power: Leistungsmessung sinnvoll für Belastung.
export const SPORTS = [
  { id: 'xc_skate', label: 'Langlauf Skating', group: 'ski' },
  { id: 'xc_classic', label: 'Langlauf klassisch', group: 'ski' },
  { id: 'rollerski_skate', label: 'Rollski Skating', group: 'ski' },
  { id: 'rollerski_classic', label: 'Rollski klassisch', group: 'ski' },
  { id: 'skierg', label: 'SkiErg', group: 'ski', power: true },
  { id: 'run', label: 'Laufen', group: 'endurance' },
  { id: 'hike', label: 'Berglauf / Wandern', group: 'endurance' },
  { id: 'bike', label: 'Rad', group: 'endurance', power: true },
  { id: 'row', label: 'Rudern (Ergometer)', group: 'endurance', power: true },
  { id: 'bikeerg', label: 'BikeErg', group: 'endurance', power: true },
  { id: 'swim', label: 'Schwimmen', group: 'endurance' },
  { id: 'strength', label: 'Krafttraining', group: 'strength' },
  { id: 'mobility', label: 'Mobilität / Yoga', group: 'other' },
  { id: 'other', label: 'Sonstiges', group: 'other' },
];
export const sportById = (id) => SPORTS.find((s) => s.id === id) || SPORTS[SPORTS.length - 1];
export const sportLabel = (id) => sportById(id).label;

// FIT sport/subSport → eigene Sportart.
export function sportFromFit(sport, subSport) {
  const s = String(sport || '').toLowerCase(), sub = String(subSport || '').toLowerCase();
  if (s === 'crossCountrySkiing'.toLowerCase() || s === 'cross_country_skiing') return sub.includes('skate') ? 'xc_skate' : 'xc_classic';
  if (s === 'rollerskiing' || s === 'roller_skiing' || sub.includes('roller')) return sub.includes('classic') ? 'rollerski_classic' : 'rollerski_skate';
  if (s === 'running') return sub.includes('trail') ? 'hike' : 'run';
  if (s === 'hiking' || s === 'walking') return 'hike';
  if (s === 'cycling') return 'bike';
  if (s === 'rowing') return 'row';
  if (s === 'swimming') return 'swim';
  if (s === 'training' || s === 'fitnessequipment' || s === 'fitness_equipment') return sub.includes('strength') ? 'strength' : 'other';
  return 'other';
}

// Concept2-Logbook-Typen → eigene Sportart.
export const sportFromConcept2 = (type) => ({ skierg: 'skierg', rower: 'row', bike: 'bikeerg', dynamic: 'row', slides: 'row' }[type] || 'other');
