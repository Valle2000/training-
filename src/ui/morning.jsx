import React, { useMemo, useState } from 'react';
import { Sun, Activity } from 'lucide-react';
import { useData, update } from '../lib/store.js';
import { SYMPTOMS, readinessFor, hrvStatus, loadStatus } from '../lib/readiness.js';
import { addDays } from '../lib/metrics.js';
import { LineChart } from './charts.jsx';
import { Sheet, toast } from './common.jsx';

const SCALES = [
  ['feel', 'Wie fühlst du dich?', ['sehr schlecht', 'schlecht', 'okay', 'gut', 'super']],
  ['sleepQ', 'Schlafqualität', ['sehr schlecht', 'schlecht', 'okay', 'gut', 'super']],
  ['soreness', 'Muskelkater', ['keiner', 'leicht', 'mittel', 'stark', 'sehr stark']],
  ['stress', 'Stress (Uni, Arbeit, Alltag)', ['keiner', 'wenig', 'mittel', 'hoch', 'sehr hoch']],
];
const LEVEL = { gruen: ['Grün', 'var(--good)', 'var(--goodbg)'], gelb: ['Gelb', 'var(--warn)', 'var(--warnbg)'], rot: ['Rot', 'var(--bad)', 'var(--badbg)'] };

export function ReadinessCard({ date, form, onCheck }) {
  const { wellness, activities } = useData();
  const r = readinessFor(date, wellness, form, activities);
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

const HRV_TEXT = { low: ['unter deinem Normalbereich', 'var(--bad)'], normal: ['im Normalbereich', 'var(--good)'], high: ['über dem Normalbereich (meist gut erholt)', 'var(--good)'] };
// HRV-Trend mit persönlichem Normalbereich, Monotonie/Strain und Belastungssprung.
export function RecoveryCard({ t }) {
  const { wellness, activities } = useData();
  const data = useMemo(() => {
    const dates = Array.from({ length: 60 }, (_, i) => addDays(t, i - 59));
    const st = dates.map((d) => hrvStatus(d, wellness));
    return { dates, st, now: st.at(-1), load: loadStatus(addDays(t, -1), activities) };
  }, [wellness, activities, t]);
  const { dates, st, now, load } = data;
  if (!now && !load) return null;
  const fmt = (v) => String(v).replace('.', ',');
  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}><Activity size={16} /> Erholung und Belastung</h3>
      {now ? <>
        <p className="small" style={{ margin: '0 0 4px' }}>HRV 7-Tage-Schnitt <b>{now.avg7} ms</b> – <b style={{ color: HRV_TEXT[now.status][1] }}>{HRV_TEXT[now.status][0]}</b> ({now.low}–{now.high} ms, aus {now.n} Messungen der letzten 60 Tage)</p>
        <LineChart shared height={170} labels={dates} xFormat={(d) => `${+d.slice(8)}.${+d.slice(5, 7)}.`} series={[
          { label: 'HRV 7 Tage (ms)', values: st.map((x) => x?.avg7 ?? null), color: 'var(--z2)', width: 2 },
          { label: 'Normalbereich unten', values: st.map((x) => x?.low ?? null), color: 'var(--muted)', dashed: true },
          { label: 'oben', values: st.map((x) => x?.high ?? null), color: 'var(--muted)', dashed: true },
        ]} />
      </> : <p className="muted small">Für den HRV-Normalbereich braucht es mindestens 14 Morgenwerte (Polar Nightly Recharge oder Morgen-Check).</p>}
      {load && (
        <div className="stats" style={{ marginTop: 8 }}>
          <div><b style={{ color: load.monotony > 2 ? 'var(--warn)' : undefined }}>{fmt(load.monotony)}</b><span>Monotonie (letzte 7 T.)</span></div>
          <div><b style={{ color: load.strainHigh ? 'var(--warn)' : undefined }}>{load.strain}</b><span>Strain{load.strainP90 ? ` (90 %: ${load.strainP90})` : ''}</span></div>
          <div><b style={{ color: load.acwr > 1.5 ? 'var(--bad)' : load.acwr > 1.3 ? 'var(--warn)' : undefined }}>{load.acwr != null ? `${fmt(load.acwr)}×` : '–'}</b><span>Belastung 7 T. vs. 4 Wo.</span></div>
        </div>
      )}
      <p className="muted small" style={{ marginBottom: 0 }}>Normalbereich = dein Mittel ± kleinste relevante Änderung (Plews/Buchheit). Monotonie über 2 bei hoher Belastung (Foster) und Belastungssprünge über 1,5× (Gabbett) gehen mit mehr Krankheit und Verletzungen einher – beides fließt in die Ampel ein.</p>
    </div>
  );
}
