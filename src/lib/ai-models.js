// KI-Modelle zur Auswahl mit Preisen (US-$ pro 1 Mio. Tokens, Anthropic-API, Stand Oktober 2026).
// cacheRead: Eingabe aus dem Zwischenspeicher; Schreiben in den Zwischenspeicher ≈ 1,25 × Eingabe.
export const AI_MODELS = [
  { id: 'claude-haiku-5-5', label: 'Haiku 5.5 – sehr günstig', short: 'Haiku', in: 0.1, out: 0.5, cacheRead: 0.01, fallback: false, note: 'Schnell und sehr günstig; für einfache Fragen und Essenspläne meist ausreichend, bei der Trainingsanalyse weniger tiefgehend.' },
  { id: 'claude-sonnet-5-5', label: 'Sonnet 5.5 – ausgewogen', short: 'Sonnet', in: 2, out: 10, cacheRead: 0.2, fallback: true, note: 'Gute Qualität zum halben Preis von Opus – für Wochenpläne und Essenspläne eine gute Wahl.' },
  { id: 'claude-opus-5-5', label: 'Opus 5.5 – sehr gut (Standard)', short: 'Opus', in: 4, out: 20, cacheRead: 0.2, fallback: true, note: 'Sehr gründliche Analyse und Begründungen – Standard der App.' },
  { id: 'claude-fable-5-1', label: 'Fable 5.1 – bestes Modell', short: 'Fable', in: 10, out: 50, cacheRead: 0.25, fallback: true, note: 'Das stärkste Modell, etwa 2,5× so teuer wie Opus – lohnt sich eher für die Saisonanalyse als für jede Woche.' },
];
export const AI_EFFORTS = [
  ['low', 'Schnell', 'kurz nachdenken – günstiger, für einfache Fragen'],
  ['medium', 'Normal', 'gutes Verhältnis aus Gründlichkeit und Kosten'],
  ['high', 'Gründlich', 'länger nachdenken – für Analyse und Planung'],
];
export const DEFAULT_AI = { coach: { model: 'claude-opus-5-5', effort: 'high' }, food: { model: 'claude-opus-5-5', effort: 'medium' } };
export const modelById = (id) => AI_MODELS.find((m) => m.id === id) || AI_MODELS.find((m) => m.id === 'claude-opus-5-5');

// Kosten einer Antwort aus den Token-Zahlen der API.
export function costOf(modelId, u = {}) {
  const m = modelById(modelId);
  const usd = ((u.input || 0) * m.in + (u.cacheWrite || 0) * m.in * 1.25 + (u.cacheRead || 0) * m.cacheRead + (u.output || 0) * m.out) / 1e6;
  return Math.round(usd * 10000) / 10000;
}

// Grobe Schätzung pro Anfrage (Eingabe/Ausgabe-Tokens je Art, Ausgabe inkl. Nachdenken je nach Gründlichkeit).
const TYPICAL = { coach: { input: 20000, output: 12000 }, food: { input: 12000, output: 10000 } };
const EFFORT_FACTOR = { low: 0.5, medium: 0.75, high: 1 };
export function estimateCost(kind, modelId, effort) {
  const t = TYPICAL[kind] || TYPICAL.coach;
  return costOf(modelId, { input: t.input, output: t.output * (EFFORT_FACTOR[effort] ?? 1) });
}
export const fmtUsd = (x) => (x == null ? '–' : x === 0 ? '0 Cent' : x < 0.01 ? 'unter 1 Cent' : `${x < 1 ? `${String(Math.round(x * 100)).replace('.', ',')} Cent` : `${String(Math.round(x * 100) / 100).replace('.', ',')} $`}`);

// Schlüssel einer Anfrage: gleiche Daten, Frage, Modell und Gründlichkeit ergeben dieselbe Antwort.
export function requestKey(payload) {
  const s = JSON.stringify(payload);
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(36);
}

// Beispiele: was sinnvoll ist und was unnötige Kosten verursacht (Preise je Anfrage mit Opus, „Gründlich“).
export const AI_EXAMPLES = {
  sinnvoll: [
    'Analyse und Wochenplan einmal pro Woche (ca. 1,40 $ im Monat mit Opus).',
    'Eine konkrete Frage, wenn etwas auffällt, z. B. „Warum war die Schwelleneinheit so schwer?“.',
    'Essensplan einmal pro Woche oder wenn sich Vorlieben ändern (ca. 0,90 $ im Monat mit Opus).',
  ],
  unnoetig: [
    'Eine Analyse nach jeder Einheit – das wären ca. 10 $ im Monat, ohne dass sich der Plan wesentlich ändert.',
    'Dieselbe Frage mehrmals ohne neue Daten – die App zeigt dir die letzte Antwort, die kostet nichts.',
    'Zahlen, die die App selbst zeigt (Ampel, Wochenbilanz, Zonen) – dafür braucht es keine KI.',
    'Einen Essensplan für jeden Tag einzeln – ein Plan für die ganze Woche reicht.',
  ],
};
export const monthlyEstimate = (kind, modelId, effort, perMonth) => Math.round(estimateCost(kind, modelId, effort) * perMonth * 100) / 100;
