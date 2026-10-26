// Ernährungsziele nach Trainingsumfang. Grundlage: IOC-Konsens und ACSM/ISSN-Positionspapiere
// (Burke et al.; Thomas, Erdman & Burke 2016): Kohlenhydrate nach Umfang und Intensität periodisieren,
// Eiweiß 1,6–2,0 g/kg über den Tag verteilt, im Training über 90 min 60–90 g KH pro Stunde.
// minutes: Trainingszeit des Tages, longestMinutes: längste Ausdauereinheit (für KH während des Trainings).
export function dayTargets({ weightKg, minutes = 0, hardMinutes = 0, strength = false, longestMinutes = minutes }) {
  if (!weightKg) return null;
  let carbs; // g/kg
  if (minutes < 30) carbs = 3.5;
  else if (minutes < 75) carbs = 5;
  else if (minutes < 150) carbs = 6.5;
  else if (minutes < 240) carbs = 8;
  else carbs = 10;
  if (hardMinutes >= 30) carbs += 1; // Schwelle/Intervalle brauchen Glykogen
  const protein = strength || minutes >= 120 ? 2.0 : 1.7;
  const fat = 1.1;
  const g = { carbs: Math.round(carbs * weightKg), protein: Math.round(protein * weightKg), fat: Math.round(fat * weightKg) };
  const kcal = g.carbs * 4 + g.protein * 4 + g.fat * 9;
  const duringPerHour = longestMinutes >= 150 ? 90 : longestMinutes >= 90 ? 60 : longestMinutes >= 60 ? 30 : 0;
  const level = minutes >= 150 || hardMinutes >= 30 ? 'hoch' : minutes >= 60 ? 'mittel' : 'niedrig';
  return { ...g, kcal, perKg: { carbs, protein, fat }, duringPerHour, level };
}
