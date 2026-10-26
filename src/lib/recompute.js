// Alle Einheiten neu berechnen (nach geänderten Schwellen oder wenn neue Kennzahlen dazukommen).
import { getData, update, getSeries } from './store.js';
import { reevaluate } from './activities.js';

// 3: Messfehler (unrealistische Watt/Puls) werden vor der Berechnung entfernt.
// 4: Puls-/Watt-Verteilung und Puls bei Leistung je Einheit (für Langzeit-Auswertungen).
export const METRICS_VERSION = 4;

export async function recomputeAll() {
  const st = getData().settings;
  const next = [];
  for (const a of getData().activities) {
    const series = a.hasSeries ? await getSeries(a.id) : null;
    // Verlauf nicht lesbar (z. B. Speicher gesperrt): Einheit lieber unverändert lassen als Werte verlieren.
    next.push(a.hasSeries && !series ? a : reevaluate(a, st, series));
  }
  update((d) => ({ ...d, activities: next, settings: { ...d.settings, metricsVersion: METRICS_VERSION } }));
  return next.length;
}

export function migrateMetrics() {
  const d = getData();
  if (d.activities.length && d.settings.metricsVersion !== METRICS_VERSION) return recomputeAll();
  return null;
}
