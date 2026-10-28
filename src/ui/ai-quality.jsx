import React from 'react';
import { useData, update } from '../lib/store.js';
import { AI_MODELS, AI_EFFORTS, AI_EXAMPLES, DEFAULT_AI, modelById, estimateCost, fmtUsd } from '../lib/ai-models.js';

// Gewählte KI (Modell + Gründlichkeit) je Funktion – gespeichert in den Einstellungen.
export const aiChoice = (settings, kind) => ({ ...DEFAULT_AI[kind], ...(settings.ai?.[kind] || {}) });

// Jede Antwort mit Kosten protokollieren (für die Monatssumme), höchstens 300 Einträge.
export function logAiCost(kind, result, date) {
  if (result?.costUsd == null) return;
  update((d) => ({ ...d, settings: { ...d.settings, aiLog: [...(d.settings.aiLog || []), { date, kind, model: result.model, usd: result.costUsd }].slice(-300) } }));
}
export const monthSpend = (settings, month) => (settings.aiLog || []).filter((x) => x.date.slice(0, 7) === month).reduce((a, x) => a + (x.usd || 0), 0);
export const monthBudget = (settings) => (settings.ai?.budget === '' || settings.ai?.budget == null ? 5 : Number(settings.ai.budget));

// Vor jeder Anfrage: Wird das Monatsbudget überschritten, nachfragen. Gibt true zurück, wenn gesendet werden darf.
export function budgetOk(settings, kind, modelId, effort, date) {
  const budget = monthBudget(settings);
  if (!(budget > 0)) return true;
  const spent = monthSpend(settings, date.slice(0, 7));
  const next = estimateCost(kind, modelId, effort);
  if (spent + next <= budget) return true;
  return window.confirm(`Dein Monatsbudget (${fmtUsd(budget)}) ${spent >= budget ? 'ist schon erreicht' : 'wird überschritten'} (bisher ${fmtUsd(spent)}). Diese Anfrage kostet ca. ${fmtUsd(next)}. Trotzdem senden?`);
}

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
      <p className="muted small">{AI_EFFORTS.find((e) => e[0] === c.effort)?.[2]}. Kosten sind Schätzungen; die tatsächlichen stehen unter jeder Antwort.</p>
      <label>Monatsbudget (Dollar)</label>
      <div className="row" style={{ flexWrap: 'nowrap', alignItems: 'center' }}>
        <input inputMode="decimal" style={{ maxWidth: 120 }} value={settings.ai?.budget ?? 5} onChange={(e) => update((d) => ({ ...d, settings: { ...d.settings, ai: { ...(d.settings.ai || {}), budget: e.target.value } } }))} />
        <span className="small muted">Diesen Monat bisher <b>{fmtUsd(spent)}</b> (ab Einführung der Anzeige, nur dieses Gerät). Vor einer Anfrage, die das Budget überschreiten würde, fragt die App nach.</span>
      </div>
      <div className="notice" style={{ marginTop: 10 }}>
        <b>Sinnvoll</b>
        <ul className="small" style={{ paddingLeft: 18, margin: '4px 0 8px' }}>{AI_EXAMPLES.sinnvoll.map((x) => <li key={x}>{x}</li>)}</ul>
        <b>Unnötig</b>
        <ul className="small" style={{ paddingLeft: 18, margin: '4px 0 0' }}>{AI_EXAMPLES.unnoetig.map((x) => <li key={x}>{x}</li>)}</ul>
      </div>
    </details>
  );
}

// Zeile unter einer KI-Antwort: Modell und tatsächliche Kosten.
export function AiCost({ result }) {
  if (!result?.model) return null;
  const m = AI_MODELS.find((x) => x.id === result.model);
  return <p className="muted small" style={{ margin: '6px 0 0' }}>KI: {m ? m.short : result.model}{result.costUsd != null ? ` · Kosten ca. ${fmtUsd(result.costUsd)}` : ''}{result.usage ? ` (${Math.round((result.usage.input + result.usage.cacheRead + result.usage.cacheWrite) / 100) / 10}k Tokens rein, ${Math.round(result.usage.output / 100) / 10}k raus)` : ''}</p>;
}
