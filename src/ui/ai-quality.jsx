import React from 'react';
import { useData, update } from '../lib/store.js';
import { AI_MODELS, AI_EFFORTS, DEFAULT_AI, modelById, estimateCost, fmtUsd } from '../lib/ai-models.js';

// Gewählte KI (Modell + Gründlichkeit) je Funktion – gespeichert in den Einstellungen.
export const aiChoice = (settings, kind) => ({ ...DEFAULT_AI[kind], ...(settings.ai?.[kind] || {}) });

// Jede Antwort mit Kosten protokollieren (für die Monatssumme), höchstens 300 Einträge.
export function logAiCost(kind, result, date) {
  if (result?.costUsd == null) return;
  update((d) => ({ ...d, settings: { ...d.settings, aiLog: [...(d.settings.aiLog || []), { date, kind, model: result.model, usd: result.costUsd }].slice(-300) } }));
}
export const monthSpend = (settings, month) => (settings.aiLog || []).filter((x) => x.date.slice(0, 7) === month).reduce((a, x) => a + (x.usd || 0), 0);

// Auswahl „Wie gut soll die KI sein?“ mit geschätzten Kosten pro Anfrage und Ausgaben im Monat.
export function AiQuality({ kind, t }) {
  const { settings } = useData();
  const c = aiChoice(settings, kind);
  const m = modelById(c.model);
  const set = (k, v) => update((d) => ({ ...d, settings: { ...d.settings, ai: { ...(d.settings.ai || {}), [kind]: { ...aiChoice(d.settings, kind), [k]: v } } } }));
  const spent = monthSpend(settings, t.slice(0, 7));
  return (
    <details className="card" style={{ marginTop: 10 }}>
      <summary><b>KI-Qualität</b> <span className="muted small">{m.short} · {AI_EFFORTS.find((e) => e[0] === c.effort)?.[1]} · ca. {fmtUsd(estimateCost(kind, c.model, c.effort))} pro Anfrage</span></summary>
      <label>Modell</label>
      {AI_MODELS.map((x) => (
        <label key={x.id} className="item" style={{ cursor: 'pointer', fontWeight: 400, borderColor: x.id === c.model ? 'var(--accent)' : undefined }}>
          <input type="radio" name={`ai-${kind}`} checked={x.id === c.model} onChange={() => set('model', x.id)} style={{ width: 18, height: 18, flex: 'none' }} />
          <div className="grow"><b>{x.label}</b><p>{x.note}</p></div>
          <span className="muted small" style={{ flex: 'none' }}>ca. {fmtUsd(estimateCost(kind, x.id, c.effort))}</span>
        </label>
      ))}
      <label>Gründlichkeit</label>
      <div className="chips">{AI_EFFORTS.map(([id, l]) => <button key={id} className={`chip${c.effort === id ? ' on' : ''}`} onClick={() => set('effort', id)}>{l}</button>)}</div>
      <p className="muted small">{AI_EFFORTS.find((e) => e[0] === c.effort)?.[2]}. Kosten sind Schätzungen; die tatsächlichen stehen unter jeder Antwort. Bisher diesen Monat: <b>{fmtUsd(spent)}</b> (nur Anfragen von diesem Gerät seit Einführung der Anzeige).</p>
    </details>
  );
}

// Zeile unter einer KI-Antwort: Modell und tatsächliche Kosten.
export function AiCost({ result }) {
  if (!result?.model) return null;
  const m = AI_MODELS.find((x) => x.id === result.model);
  return <p className="muted small" style={{ margin: '6px 0 0' }}>KI: {m ? m.short : result.model}{result.costUsd != null ? ` · Kosten ca. ${fmtUsd(result.costUsd)}` : ''}{result.usage ? ` (${Math.round((result.usage.input + result.usage.cacheRead + result.usage.cacheWrite) / 100) / 10}k Tokens rein, ${Math.round(result.usage.output / 100) / 10}k raus)` : ''}</p>;
}
