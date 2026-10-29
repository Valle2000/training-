// Alle Einheiten neu berechnen (nach geänderten Schwellen oder wenn neue Kennzahlen dazukommen).
import { getData, update, getSeries } from './store.js';
import { reevaluate } from './activities.js';

// 3: Messfehler (unrealistische Watt/Puls) werden vor der Berechnung entfernt.
// 4: Puls-/Watt-Verteilung und Puls bei Leistung je Einheit (für Langzeit-Auswertungen).
// 5: fehlende Ø/max Puls aus dem Verlauf ergänzen (Polar-Import hatte 0 eingetragen).
// 6: km-Splits (Autolaps) aus dem Tempo, Gerätezeit bevorzugt.
// 7: ohne Gerätezeit die Gesamtzeit der Datei statt nur der aufgezeichneten Sekunden.
// 8: ohne Gerätezeit nur die Bewegungszeit aus dem Tempo (Stillstand zählt nicht, wie Strava/Polar).
// 9: I1 nach unten offen – Pulse unter 55 % HFmax zählen als I1 statt als Pause.
// 10: Rollski-Leistung aus Tempo und Steigung (gesamt und je Runde), für Key Sessions ohne Wattmesser.
export const METRICS_VERSION = 10;

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

// Umbenennen-Regeln auf vorhandene Einheiten anwenden; einmalig die 3×20-Regel für Concept2 anlegen.
const DEFAULT_RULES = { '20:00, 2×20:00/2:00r, 2×20:00': '3x20min' };
export function migrateTitles() {
  const d = getData();
  const rules = d.settings.titleRulesSeeded ? d.settings.titleRules || {} : { ...DEFAULT_RULES, ...(d.settings.titleRules || {}) };
  const hits = d.activities.filter((a) => rules[a.title]);
  if (!hits.length && d.settings.titleRulesSeeded) return 0;
  update((x) => ({ ...x, settings: { ...x.settings, titleRules: rules, titleRulesSeeded: true }, activities: x.activities.map((a) => (rules[a.title] ? { ...a, title: rules[a.title] } : a)) }));
  return hits.length;
}
