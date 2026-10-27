import React, { useMemo, useState } from 'react';
import { Plus, Trash2, Wand2, Check, X, Gauge } from 'lucide-react';
import { useData, update, uid } from '../lib/store.js';
import { curve, today } from '../lib/activities.js';
import { adaptWeek, applyOps, hasSchedule } from '../lib/week-adapt.js';
import { suggestThresholds } from '../lib/thresholds.js';
import { recomputeAll } from '../lib/recompute.js';
import { Sheet, toast } from './common.jsx';

const DOW = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const PRESETS = ['Uni', 'Arbeit', 'Lernen', 'Pendeln', 'Termin'];

// Alltag: feste Wochentermine (Vorlesungen, Arbeit …) und einzelne Termine. Daraus berechnet die App die freie
// Trainingszeit je Tag – für den Saisonplan-Assistenten, Uhrzeit-Vorschläge und die Wochen-Anpassung.
export function ScheduleSheet({ onClose }) {
  const { settings } = useData();
  const t = today(settings.timezone);
  const [s, setS] = useState({ start: '06:30', end: '21:30', buffer: 15, blocks: [], oneOff: [], ...(settings.schedule || {}) });
  const set = (k, v) => setS({ ...s, [k]: v });
  const setBlock = (id, k, v) => set('blocks', s.blocks.map((b) => (b.id === id ? { ...b, [k]: v } : b)));
  const setOne = (id, k, v) => set('oneOff', s.oneOff.map((b) => (b.id === id ? { ...b, [k]: v } : b)));
  const save = () => {
    // Vergangene Einzeltermine aufräumen.
    update((d) => ({ ...d, settings: { ...d.settings, schedule: { ...s, oneOff: s.oneOff.filter((b) => b.date >= t) } } }));
    toast('Alltag gespeichert');
    onClose();
  };
  return (
    <Sheet title="Alltag & freie Zeit" onClose={onClose}>
      <p className="muted small">Trag feste Termine wie Uni, Arbeit oder Pendeln ein. Die App plant Training nur in die freien Zeiten, schlägt Uhrzeiten vor und meldet, wenn eine Einheit nicht mehr in den Tag passt.</p>
      <div className="grid2">
        <div><label>Tag beginnt</label><input type="time" value={s.start} onChange={(e) => set('start', e.target.value)} /></div>
        <div><label>Tag endet</label><input type="time" value={s.end} onChange={(e) => set('end', e.target.value)} /></div>
        <div><label>Puffer vor/nach Terminen (min)</label><input type="number" min="0" value={s.buffer} onChange={(e) => set('buffer', Number(e.target.value))} /></div>
      </div>

      <h3>Jede Woche</h3>
      {s.blocks.map((b) => (
        <div key={b.id} className="card">
          <div className="row" style={{ flexWrap: 'nowrap' }}>
            <input value={b.label} onChange={(e) => setBlock(b.id, 'label', e.target.value)} placeholder="z. B. Uni" />
            <button className="ghost" style={{ flex: 'none' }} onClick={() => set('blocks', s.blocks.filter((x) => x.id !== b.id))} aria-label="Entfernen"><Trash2 size={16} /></button>
          </div>
          <div className="chips">{DOW.map((d, i) => <button key={d} className={`chip${b.dows.includes(i + 1) ? ' on' : ''}`} onClick={() => setBlock(b.id, 'dows', b.dows.includes(i + 1) ? b.dows.filter((x) => x !== i + 1) : [...b.dows, i + 1].sort())}>{d}</button>)}</div>
          <div className="grid2">
            <div><label>von</label><input type="time" value={b.from} onChange={(e) => setBlock(b.id, 'from', e.target.value)} /></div>
            <div><label>bis</label><input type="time" value={b.to} onChange={(e) => setBlock(b.id, 'to', e.target.value)} /></div>
            <div><label>gilt bis (optional, z. B. Semesterende)</label><input type="date" value={b.until || ''} onChange={(e) => setBlock(b.id, 'until', e.target.value || null)} /></div>
          </div>
        </div>
      ))}
      <div className="chips">{PRESETS.map((l) => <button key={l} className="chip" onClick={() => set('blocks', [...s.blocks, { id: uid(), label: l, dows: [1, 2, 3, 4, 5], from: l === 'Pendeln' ? '07:30' : '08:00', to: l === 'Pendeln' ? '08:00' : l === 'Arbeit' ? '17:00' : '16:00' }])}><Plus size={13} /> {l}</button>)}</div>

      <h3>Einzelne Termine</h3>
      {s.oneOff.map((b) => (
        <div key={b.id} className="card">
          <div className="row" style={{ flexWrap: 'nowrap' }}>
            <input value={b.label} onChange={(e) => setOne(b.id, 'label', e.target.value)} placeholder="z. B. Klausur, Reise" />
            <button className="ghost" style={{ flex: 'none' }} onClick={() => set('oneOff', s.oneOff.filter((x) => x.id !== b.id))} aria-label="Entfernen"><Trash2 size={16} /></button>
          </div>
          <div className="grid2">
            <div><label>Datum</label><input type="date" value={b.date} onChange={(e) => setOne(b.id, 'date', e.target.value)} /></div>
            <div><label>ganzer Tag</label><input type="checkbox" checked={b.from === '00:00' && b.to === '23:59'} onChange={(e) => setS({ ...s, oneOff: s.oneOff.map((x) => (x.id === b.id ? { ...x, from: e.target.checked ? '00:00' : '09:00', to: e.target.checked ? '23:59' : '12:00' } : x)) })} style={{ width: 20, height: 20 }} /></div>
            {!(b.from === '00:00' && b.to === '23:59') && <>
              <div><label>von</label><input type="time" value={b.from} onChange={(e) => setOne(b.id, 'from', e.target.value)} /></div>
              <div><label>bis</label><input type="time" value={b.to} onChange={(e) => setOne(b.id, 'to', e.target.value)} /></div>
            </>}
          </div>
        </div>
      ))}
      <button className="secondary" onClick={() => set('oneOff', [...s.oneOff, { id: uid(), label: '', date: t, from: '09:00', to: '12:00' }])}><Plus size={16} />Termin</button>
      <button className="primary wide" style={{ marginTop: 12 }} onClick={save}><Check size={17} />Speichern</button>
    </Sheet>
  );
}

// Vorschläge für die restliche Woche (Morgen-Check, Krankheit, verpasste Einheiten, zu wenig Zeit).
export function AdaptCard() {
  const data = useData();
  const t = today(data.settings.timezone);
  const form = useMemo(() => curve(data.activities, data.plan, t, 0).find((d) => d.day === t)?.form ?? null, [data.activities, data.plan, t]);
  const [hidden, setHidden] = useState([]);
  const list = useMemo(() => adaptWeek(data, t, form), [data, t, form]).filter((s) => !hidden.includes(s.id));
  if (!list.length) return null;
  const apply = (s) => { update((d) => ({ ...d, plan: applyOps(d.plan, s.ops) })); toast('Plan angepasst'); };
  const color = { rot: 'var(--bad)', gelb: 'var(--warn, #c88a00)', info: 'var(--accent)' };
  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}><Wand2 size={16} /> Woche anpassen</h3>
      {list.map((s) => (
        <div key={s.id} style={{ borderLeft: `3px solid ${color[s.level] || color.info}`, paddingLeft: 10, margin: '10px 0' }}>
          <b className="small">{s.title}</b>
          <p className="small" style={{ margin: '2px 0 6px' }}>{s.text}</p>
          <div className="row">
            {s.ops.length > 0 && <button className="secondary" style={{ flex: 'none' }} onClick={() => apply(s)}><Check size={15} />Übernehmen</button>}
            <button className="ghost" style={{ flex: 'none' }} onClick={() => setHidden([...hidden, s.id])}><X size={15} />Ignorieren</button>
          </div>
        </div>
      ))}
      {list.length > 1 && list.some((s) => s.ops.length) && <button className="primary wide" onClick={() => { update((d) => ({ ...d, plan: list.reduce((p, s) => applyOps(p, s.ops), d.plan) })); toast('Alle Vorschläge übernommen'); }}>Alle übernehmen</button>}
      {!hasSchedule(data.settings.schedule) && <p className="muted small" style={{ marginBottom: 0 }}>Tipp: Unter Kalender → Woche → „Alltag“ Uni/Arbeit eintragen, dann berücksichtigt die Anpassung auch deine freie Zeit.</p>}
    </div>
  );
}

// Schwellen-Vorschläge aus Laktattests, Bestwerten und Ruhepuls.
export function ThresholdCard({ compact = false, onApplied }) {
  const data = useData();
  const t = today(data.settings.timezone);
  const list = useMemo(() => suggestThresholds(data, t), [data, t]).filter((x) => data.settings.thresholdDismissed?.[x.key] !== x.value);
  const [busy, setBusy] = useState(false);
  if (!list.length) return null;
  const take = async (items) => {
    setBusy(true);
    update((d) => ({ ...d, settings: { ...d.settings, ...Object.fromEntries(items.map((x) => [x.key, String(x.value)])) } }));
    onApplied?.(items);
    toast(`Übernommen · ${await recomputeAll()} Einheiten neu berechnet`);
    setBusy(false);
  };
  const dismiss = (x) => update((d) => ({ ...d, settings: { ...d.settings, thresholdDismissed: { ...(d.settings.thresholdDismissed || {}), [x.key]: x.value } } }));
  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}><Gauge size={16} /> Schwellen aktualisieren?</h3>
      {list.map((x) => (
        <div key={x.key} style={{ margin: '8px 0' }}>
          <b className="small">{x.label}: {x.current ?? '–'} → {x.value}{x.unit ? ` ${x.unit}` : ''}</b>
          {!compact && <p className="small muted" style={{ margin: '2px 0 4px' }}>{x.reason}</p>}
          <div className="row">
            <button className="secondary" style={{ flex: 'none' }} disabled={busy} onClick={() => take([x])}><Check size={15} />Übernehmen</button>
            <button className="ghost" style={{ flex: 'none' }} onClick={() => dismiss(x)}><X size={15} />Nein</button>
          </div>
        </div>
      ))}
      <p className="muted small" style={{ marginBottom: 0 }}>Danach werden Zonen und Belastung aller Einheiten neu berechnet.</p>
    </div>
  );
}

