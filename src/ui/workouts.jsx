import React, { useState } from 'react';
import { Plus, Trash2, Download, CalendarPlus, Repeat, ChevronUp, ChevronDown } from 'lucide-react';
import { useData, update, uid } from '../lib/store.js';
import { today, ftpFor } from '../lib/activities.js';
import { SPORTS, sportLabel } from '../lib/sports.js';
import { TEMPLATES, STEP_TYPES, ZONE_IF, step, repeat, flatten, durationOf, workoutLoad, mainZone, describe, toFit, toZwo } from '../lib/workouts.js';
import { ZONE_COLORS } from './charts.jsx';
import { Sheet, fmtDuration, toast } from './common.jsx';

const TARGETS = [['zone', 'Zone'], ['power', '% FTP'], ['hr', 'Puls'], ['open', 'frei']];

function download(name, data, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([data], { type }));
  a.download = name;
  a.click();
}

// Balkenprofil: Breite = Dauer, Höhe = Intensität.
function Profile({ w }) {
  const flat = flatten(w.steps), total = durationOf(w) || 1;
  let x = 0;
  const ifOf = (t) => (t?.kind === 'zone' ? ZONE_IF[t.zone] : t?.kind === 'power' ? (Number(t.low) + Number(t.high)) / 200 : t?.kind === 'hr' ? 0.85 : 0.55);
  const color = (t) => (t?.kind === 'zone' ? ZONE_COLORS[t.zone] : t?.kind === 'power' ? ZONE_COLORS[ifOf(t) >= 1.05 ? 'I5' : ifOf(t) >= 0.95 ? 'I4' : ifOf(t) >= 0.84 ? 'I3' : ifOf(t) >= 0.72 ? 'I2' : 'I1'] : 'var(--load)');
  return (
    <svg className="chart" viewBox="0 0 680 70" preserveAspectRatio="none">
      {flat.map((s, i) => { const wd = (s.durationS / total) * 680, h = Math.min(1.3, ifOf(s.target)) / 1.3 * 66; const r = <rect key={i} x={x} y={70 - h} width={Math.max(0.5, wd - 0.5)} height={h} fill={color(s.target)} />; x += wd; return r; })}
    </svg>
  );
}

export function Workouts() {
  const { workouts, settings } = useData();
  const [edit, setEdit] = useState(null);
  const [planFor, setPlanFor] = useState(null);
  const opts = (w) => ({ ftp: ftpFor(settings, w.sport), hrMax: Number(settings.hrMax), zoneHr: settings.zoneHr });
  const exportFit = async (w) => { download(`${w.name.replace(/[^\w\-äöüÄÖÜß ]/g, '')}.fit`, await toFit(w, opts(w)), 'application/octet-stream'); };
  return (
    <>
      <p className="muted" style={{ marginTop: 12 }}>Baue strukturierte Einheiten aus Bausteinen, plane sie im Kalender und exportiere sie als FIT-Datei für die Uhr bzw. den Radcomputer (Garmin, Wahoo) oder als ZWO für Zwift.</p>
      <button className="primary wide" onClick={() => setEdit({ id: uid(), name: 'Neues Workout', sport: 'bike', description: '', steps: [step('warmup', 15), step('work', 20, { kind: 'zone', zone: 'I2' }), step('cooldown', 10)] })}><Plus size={17} />Neues Workout</button>
      {workouts.length > 0 && <h2>Meine Workouts</h2>}
      {workouts.map((w) => (
        <div key={w.id} className="card">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <div style={{ flex: '1 1 auto' }}><b>{w.name}</b><p className="muted small" style={{ margin: '2px 0' }}>{sportLabel(w.sport)} · {fmtDuration(durationOf(w))} h · Belastung ~{workoutLoad(w, settings)} · {mainZone(w)}</p></div>
          </div>
          <Profile w={w} />
          {w.description && <p className="small" style={{ margin: '6px 0' }}>{w.description}</p>}
          <div className="row" style={{ marginTop: 8 }}>
            <button className="secondary" onClick={() => setPlanFor(w)}><CalendarPlus size={16} />Planen</button>
            <button className="secondary" onClick={() => exportFit(w)}><Download size={16} />FIT</button>
            {w.sport === 'bike' && <button className="secondary" onClick={() => download(`${w.name}.zwo`, toZwo(w), 'application/xml')}><Download size={16} />ZWO</button>}
            <button className="ghost" onClick={() => setEdit(w)}>Bearbeiten</button>
          </div>
        </div>
      ))}
      <h2>Vorlagen</h2>
      {TEMPLATES.map((tpl) => (
        <button key={tpl.name} className="item" onClick={() => { const w = { ...structuredClone(tpl), id: uid() }; update((d) => ({ ...d, workouts: [...d.workouts, w] })); toast('Zu deinen Workouts hinzugefügt'); }}>
          <div className="grow"><b>{tpl.name}</b><p>{sportLabel(tpl.sport)} · {fmtDuration(durationOf(tpl))} h · {tpl.description}</p></div><Plus size={18} />
        </button>
      ))}
      <p className="muted small">Polar Flow kann keine FIT-Workouts importieren und die Polar-Schnittstelle nimmt keine Workouts an – dort Einheit in Polar Flow nachbauen oder die Beschreibung nutzen. Garmin Connect und Wahoo ELEMNT importieren FIT-Workouts.</p>
      {edit && <WorkoutEditor workout={edit} onClose={() => setEdit(null)} />}
      {planFor && <PlanWorkout w={planFor} onClose={() => setPlanFor(null)} />}
    </>
  );
}

function PlanWorkout({ w, onClose }) {
  const { settings } = useData();
  const [date, setDate] = useState(today(settings.timezone));
  const save = () => {
    const item = { id: uid(), date, title: w.name, sport: w.sport, minutes: Math.round(durationOf(w) / 60), zone: mainZone(w), load: workoutLoad(w, settings), description: describe(w.steps), workoutId: w.id, source: 'workout' };
    update((d) => ({ ...d, plan: [...d.plan, item] }));
    toast('Im Kalender geplant');
    onClose();
  };
  return (
    <Sheet title={`${w.name} planen`} onClose={onClose}>
      <label>Datum</label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      <pre className="notice" style={{ whiteSpace: 'pre-wrap' }}>{describe(w.steps)}</pre>
      <button className="primary wide" onClick={save}><CalendarPlus size={17} />Planen</button>
    </Sheet>
  );
}

function StepRow({ s, onChange, onRemove, onMove }) {
  const t = s.target || { kind: 'open' };
  const setT = (patch) => onChange({ ...s, target: { ...t, ...patch } });
  return (
    <div className="ex" style={{ padding: 10 }}>
      <div className="row">
        <select value={s.type} onChange={(e) => onChange({ ...s, type: e.target.value })} style={{ flex: '1 1 110px' }}>{STEP_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
        <input type="number" step="0.5" value={Math.round(s.durationS / 6) / 10} onChange={(e) => onChange({ ...s, durationS: Math.round(Number(e.target.value) * 60) })} style={{ flex: '0 1 80px' }} aria-label="Minuten" />
        <span className="muted small" style={{ flex: 'none' }}>min</span>
        <button className="ghost" style={{ flex: 'none' }} onClick={() => onMove(-1)} aria-label="nach oben"><ChevronUp size={15} /></button>
        <button className="ghost" style={{ flex: 'none' }} onClick={() => onMove(1)} aria-label="nach unten"><ChevronDown size={15} /></button>
        <button className="ghost" style={{ flex: 'none' }} onClick={onRemove} aria-label="Entfernen"><Trash2 size={15} /></button>
      </div>
      <div className="row" style={{ marginTop: 6 }}>
        <select value={t.kind} onChange={(e) => setT({ kind: e.target.value, ...(e.target.value === 'zone' ? { zone: 'I1' } : e.target.value === 'power' ? { low: 55, high: 75 } : e.target.value === 'hr' ? { low: 130, high: 145 } : {}) })} style={{ flex: '1 1 90px' }}>{TARGETS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
        {t.kind === 'zone' && <select value={t.zone} onChange={(e) => setT({ zone: e.target.value })} style={{ flex: '1 1 90px' }}>{['I1', 'I2', 'I3', 'I4', 'I5'].map((z) => <option key={z}>{z}</option>)}</select>}
        {(t.kind === 'power' || t.kind === 'hr') && <><input type="number" value={t.low} onChange={(e) => setT({ low: Number(e.target.value) })} style={{ flex: '1 1 60px' }} aria-label="von" /><input type="number" value={t.high} onChange={(e) => setT({ high: Number(e.target.value) })} style={{ flex: '1 1 60px' }} aria-label="bis" /><span className="muted small" style={{ flex: 'none' }}>{t.kind === 'power' ? '%' : 'bpm'}</span></>}
        <input value={s.label || ''} onChange={(e) => onChange({ ...s, label: e.target.value })} placeholder="Hinweis" style={{ flex: '2 1 100px' }} />
      </div>
    </div>
  );
}

function StepList({ steps, onChange, nested }) {
  const setAt = (i, v) => onChange(steps.map((x, j) => (j === i ? v : x)));
  const move = (i, d) => { const j = i + d; if (j < 0 || j >= steps.length) return; const n = [...steps]; [n[i], n[j]] = [n[j], n[i]]; onChange(n); };
  return (
    <>
      {steps.map((s, i) => s.type === 'repeat' ? (
        <div key={s.id} className="card" style={{ borderStyle: 'dashed', padding: 10 }}>
          <div className="row"><Repeat size={16} style={{ flex: 'none' }} /><input type="number" value={s.repeat} onChange={(e) => setAt(i, { ...s, repeat: Number(e.target.value) || 1 })} style={{ flex: '0 1 70px' }} aria-label="Wiederholungen" /><span style={{ flex: 'none' }}>× wiederholen</span>
            <button className="ghost" style={{ flex: 'none', marginLeft: 'auto' }} onClick={() => onChange(steps.filter((_, j) => j !== i))} aria-label="Block entfernen"><Trash2 size={15} /></button></div>
          <StepList steps={s.steps} onChange={(v) => setAt(i, { ...s, steps: v })} nested />
        </div>
      ) : <StepRow key={s.id} s={s} onChange={(v) => setAt(i, v)} onRemove={() => onChange(steps.filter((_, j) => j !== i))} onMove={(d) => move(i, d)} />)}
      <div className="row">
        <button className="ghost" onClick={() => onChange([...steps, step('work', 5, { kind: 'zone', zone: 'I3' })])}><Plus size={15} />Baustein</button>
        {!nested && <button className="ghost" onClick={() => onChange([...steps, repeat(4, [step('work', 4, { kind: 'zone', zone: 'I4' }), step('rest', 2, { kind: 'open' })])])}><Repeat size={15} />Wiederholung</button>}
      </div>
    </>
  );
}

function WorkoutEditor({ workout, onClose }) {
  const { settings } = useData();
  const [w, setW] = useState(structuredClone(workout));
  const save = () => { update((d) => ({ ...d, workouts: [...d.workouts.filter((x) => x.id !== w.id), w] })); toast('Gespeichert'); onClose(); };
  const remove = () => { update((d) => ({ ...d, workouts: d.workouts.filter((x) => x.id !== w.id) })); onClose(); };
  return (
    <Sheet title="Workout" onClose={onClose}>
      <label>Name</label><input value={w.name} onChange={(e) => setW({ ...w, name: e.target.value })} />
      <div className="grid2">
        <div><label>Sportart</label><select value={w.sport} onChange={(e) => setW({ ...w, sport: e.target.value })}>{SPORTS.filter((s) => s.group !== 'strength').map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select></div>
        <div><label>Dauer / Belastung</label><input disabled value={`${fmtDuration(durationOf(w))} h · ~${workoutLoad(w, settings)}`} /></div>
      </div>
      <label>Beschreibung</label><input value={w.description} onChange={(e) => setW({ ...w, description: e.target.value })} placeholder="z. B. Laktat 2–3 mmol/l" />
      <Profile w={w} />
      <label>Bausteine</label>
      <StepList steps={w.steps} onChange={(steps) => setW({ ...w, steps })} />
      <div className="row" style={{ marginTop: 12 }}>
        <button className="primary" onClick={save}>Speichern</button>
        <button className="danger" onClick={remove}><Trash2 size={17} />Löschen</button>
      </div>
    </Sheet>
  );
}
