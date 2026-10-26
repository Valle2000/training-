import React, { useState } from 'react';
import { Sun } from 'lucide-react';
import { useData, update } from '../lib/store.js';
import { SYMPTOMS, readinessFor } from '../lib/readiness.js';
import { Sheet, toast } from './common.jsx';

const SCALES = [
  ['feel', 'Wie fühlst du dich?', ['sehr schlecht', 'schlecht', 'okay', 'gut', 'super']],
  ['sleepQ', 'Schlafqualität', ['sehr schlecht', 'schlecht', 'okay', 'gut', 'super']],
  ['soreness', 'Muskelkater', ['keiner', 'leicht', 'mittel', 'stark', 'sehr stark']],
  ['stress', 'Stress (Uni, Arbeit, Alltag)', ['keiner', 'wenig', 'mittel', 'hoch', 'sehr hoch']],
];
const LEVEL = { gruen: ['Grün', 'var(--good)', 'var(--goodbg)'], gelb: ['Gelb', 'var(--warn)', 'var(--warnbg)'], rot: ['Rot', 'var(--bad)', 'var(--badbg)'] };

export function ReadinessCard({ date, form, onCheck }) {
  const { wellness } = useData();
  const r = readinessFor(date, wellness, form);
  const [label, color, bg] = LEVEL[r.level];
  return (
    <div style={{ background: bg, color, borderRadius: 14, padding: '12px 14px', marginTop: 12 }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <b style={{ flex: 'none' }}>● Ampel {label}{r.hasData ? '' : ' (wenig Daten)'}</b>
        <button className="pill" style={{ flex: 'none', color, borderColor: color }} onClick={onCheck}><Sun size={14} />{r.checked ? 'Check ändern' : 'Morgen-Check'}</button>
      </div>
      <div style={{ fontSize: 14, marginTop: 4 }}>{r.advice}</div>
      {r.reasons.length > 0 && <ul style={{ margin: '6px 0 0', paddingLeft: 18, fontSize: 13 }}>{r.reasons.map((x) => <li key={x}>{x}</li>)}</ul>}
    </div>
  );
}

export function MorningSheet({ date, onClose }) {
  const { wellness } = useData();
  const existing = wellness.find((w) => w.date === date) || {};
  const [f, setF] = useState({ feel: 3, sleepQ: 3, soreness: 1, stress: 2, symptoms: [], weightKg: '', restHrManual: '', hrvManual: '', sleepHManual: '', note: '', ...existing });
  const set = (k, v) => setF({ ...f, [k]: v });
  const save = () => {
    const num = (v) => (v === '' || v == null ? null : Number(String(v).replace(',', '.')));
    // Werte aus Polar (hrv, restHr, sleepH) nur ergänzen, wenn keine vorhanden sind.
    const entry = { ...existing, ...f, date, weightKg: num(f.weightKg), restHrManual: num(f.restHrManual), hrvManual: num(f.hrvManual), sleepHManual: num(f.sleepHManual) };
    entry.restHr = existing.restHr ?? entry.restHrManual ?? null;
    entry.hrv = existing.hrv ?? entry.hrvManual ?? null;
    entry.sleepH = existing.sleepH ?? entry.sleepHManual ?? null;
    update((d) => ({ ...d, wellness: [...d.wellness.filter((w) => w.date !== date), entry].sort((a, b) => a.date.localeCompare(b.date)) }));
    toast('Morgen-Check gespeichert');
    onClose();
  };
  return (
    <Sheet title="Morgen-Check" onClose={onClose}>
      {SCALES.map(([k, label, words]) => (
        <div key={k}>
          <label>{label}</label>
          <div className="chips">{words.map((w, i) => <button key={w} className={`chip${f[k] === i + 1 ? ' on' : ''}`} onClick={() => set(k, i + 1)}>{w}</button>)}</div>
        </div>
      ))}
      <label>Symptome</label>
      <div className="chips">{SYMPTOMS.map(([id, label]) => <button key={id} className={`chip${f.symptoms.includes(id) ? ' on' : ''}`} onClick={() => set('symptoms', f.symptoms.includes(id) ? f.symptoms.filter((x) => x !== id) : [...f.symptoms, id])}>{label}</button>)}</div>
      <div className="grid2">
        <div><label>Gewicht (kg)</label><input inputMode="decimal" value={f.weightKg ?? ''} onChange={(e) => set('weightKg', e.target.value)} /></div>
        <div><label>Ruhepuls {existing.restHr && existing.source ? '(Polar)' : ''}</label><input inputMode="numeric" value={existing.source ? existing.restHr ?? '' : f.restHrManual ?? ''} disabled={!!(existing.source && existing.restHr)} onChange={(e) => set('restHrManual', e.target.value)} /></div>
        <div><label>HRV morgens (ms) {existing.hrv && existing.source ? '(Polar)' : ''}</label><input inputMode="numeric" value={existing.source ? existing.hrv ?? '' : f.hrvManual ?? ''} disabled={!!(existing.source && existing.hrv)} onChange={(e) => set('hrvManual', e.target.value)} /></div>
        <div><label>Schlaf (h) {existing.sleepH && existing.source ? '(Polar)' : ''}</label><input inputMode="decimal" value={existing.source ? existing.sleepH ?? '' : f.sleepHManual ?? ''} disabled={!!(existing.source && existing.sleepH)} onChange={(e) => set('sleepHManual', e.target.value)} /></div>
      </div>
      <label>Notiz</label><input value={f.note} onChange={(e) => set('note', e.target.value)} placeholder="z. B. Prüfung, Reise, Zyklus" />
      <button className="primary wide" onClick={save}>Speichern</button>
      <p className="muted small">Bei Symptomen unterhalb des Halses (Fieber, Husten, Gliederschmerzen) kein Training. Die Ampel ist eine Orientierung, keine Diagnose.</p>
    </Sheet>
  );
}
