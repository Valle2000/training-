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

// Polar-Sportbezeichnungen (z. B. ROLLER_SKIING_SKATING, CROSS_COUNTRY_SKIING, ROAD_BIKING) → eigene Sportart.
// Versteht auch deutsche Namen aus Polar-Flow-Exporten (z. B. „Rollski Skating“, „Radfahren“).
export const polarSport = (s) => {
  s = String(s || '').toUpperCase();
  if (/ALPIN|DOWNHILL|SNOWBOARD|BACKCOUNTRY|SKITOUR|TELEMARK/.test(s)) return 'other';
  if (s.includes('SWIM') || s.includes('SCHWIMM')) return 'swim';
  const skate = /SKAT|FREISTIL|FREESTYLE|FREE_STYLE/.test(s);
  if (s.includes('ROLLER') || s.includes('ROLLSKI')) return skate ? 'rollerski_skate' : 'rollerski_classic';
  if (s.includes('SKIERG') || s.includes('SKI-ERG') || s.includes('SKI ERG')) return 'skierg';
  if (s.includes('CROSS_COUNTRY') || s.includes('CROSS-COUNTRY') || s.includes('LANGLAUF') || s.includes('SKIING') || s.includes('SKILANGLAUF') || s.includes('NORDIC_SKI')) return skate ? 'xc_skate' : 'xc_classic';
  if (/SKAT/.test(s)) return 'other'; // Inline/Eislauf
  if (s.includes('RUN') || s.includes('LAUF') || s.includes('JOGG')) return 'run';
  if (s.includes('CYCL') || s.includes('BIK') || s.includes('RAD')) return 'bike';
  if (s.includes('ROW') || s.includes('RUDER')) return 'row';
  if (s.includes('STRENGTH') || s.includes('KRAFT')) return 'strength';
  if (s.includes('HIK') || s.includes('WALK') || s.includes('WANDER') || s.includes('GEHEN')) return 'hike';
  if (s.includes('YOGA') || s.includes('MOBIL') || s.includes('STRETCH') || s.includes('DEHN')) return 'mobility';
  return 'other';
};
