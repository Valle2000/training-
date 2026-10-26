import React, { useState } from 'react';
import { Plus, Trash2, Check } from 'lucide-react';
import { useData, update, uid } from '../lib/store.js';
import { today } from '../lib/activities.js';
import { analyzeLactate, LACTATE_ZONE_BOUNDS } from '../lib/lactate.js';
import { recomputeAll } from '../lib/recompute.js';
import { SPORTS, sportLabel } from '../lib/sports.js';
import { XYChart } from './charts.jsx';
import { Sheet, fmtDate, fmtNum, toast } from './common.jsx';

const emptySteps = () => [150, 175, 200, 225, 250, 275, 300].map((w) => ({ load: w, hr: '', lactate: '', rpe: '' }));
const FTP_KEY = { bike: 'ftp', bikeerg: 'ftp', skierg: 'ftpSkierg', row: 'ftpRow' };

export function LactateSection() {
  const { lactateTests, settings } = useData();
  const [edit, setEdit] = useState(null);
  const sorted = [...lactateTests].sort((a, b) => b.date.localeCompare(a.date));
  const [openId, setOpenId] = useState(sorted[0]?.id);
  const cur = lactateTests.find((x) => x.id === openId);
  const prev = cur && sorted.find((x) => x.date < cur.date && x.sport === cur.sport && x.unit === cur.unit);
  return (
    <>
      <p className="muted" style={{ marginTop: 12 }}>Stufentest auf Rad, SkiErg, Laufband oder Rollski-Laufband: je Stufe Belastung, Puls am Ende und Laktat eintragen. Die App bestimmt die Schwellen und deine persönlichen Pulszonen.</p>
      <div className="chips">
        {sorted.map((x) => <button key={x.id} className={`chip${openId === x.id ? ' on' : ''}`} onClick={() => setOpenId(x.id)}>{fmtDate(x.date, { day: 'numeric', month: 'short', year: '2-digit' })} · {sportLabel(x.sport)}</button>)}
        <button className="chip" onClick={() => setEdit({ id: uid(), date: today(settings.timezone), sport: 'bike', unit: 'W', stepMin: 4, steps: emptySteps(), notes: '' })}><Plus size={13} /> Neuer Test</button>
      </div>
      {!lactateTests.length && <div className="notice">Typischer Ablauf: 4–5 min je Stufe, Start locker (z. B. 150 W bzw. 8 km/h), Steigerung um 25 W bzw. 1 km/h, Laktat am Ende jeder Stufe aus dem Ohrläppchen, bis etwa 4–6 mmol/l. Gleiche Bedingungen und gleiche Tageszeit machen Tests vergleichbar.</div>}
      {cur && <TestResult test={cur} prev={prev} settings={settings} onEdit={() => setEdit(cur)} />}
      {edit && <TestEditor test={edit} onClose={() => setEdit(null)} onSaved={setOpenId} />}
    </>
  );
}

function TestResult({ test, prev, settings, onEdit }) {
  const r = analyzeLactate(test.steps);
  const p = prev ? analyzeLactate(prev.steps) : null;
  const unit = test.unit;
  if (r.error) return <div className="card"><p>{r.error}</p><button className="secondary" onClick={onEdit}>Bearbeiten</button></div>;
  const curve = (res) => { const xs = res.steps.map((s) => s.load); const pts = []; for (let k = 0; k <= 40; k++) { const x = xs[0] + ((xs.at(-1) - xs[0]) * k) / 40; pts.push({ x, y: Math.max(0, res.fit(x)) }); } return pts; };
  const applyZones = async () => {
    update((d) => ({ ...d, settings: { ...d.settings, zoneHr: r.zoneHr.map((h) => Math.round(h)), zoneSource: test.date } }));
    toast(`Pulszonen übernommen · ${await recomputeAll()} Einheiten neu berechnet`);
  };
  const applyThresholds = async () => {
    const patch = {};
    if (r.lt2?.hr) patch.lthr = Math.round(r.lt2.hr);
    if (unit === 'W' && FTP_KEY[test.sport] && r.lt2) patch[FTP_KEY[test.sport]] = Math.round(r.lt2.load);
    update((d) => ({ ...d, settings: { ...d.settings, ...patch } }));
    toast(`Übernommen: ${Object.entries(patch).map(([k, v]) => `${k === 'lthr' ? 'Schwellenpuls' : 'FTP'} ${v}`).join(', ')} · ${await recomputeAll()} Einheiten neu berechnet`);
  };
  const row = (label, x, hint) => <tr><td>{label}</td><td><b>{x ? `${fmtNum(x.load, unit === 'W' ? 0 : 1)} ${unit}` : '–'}</b></td><td>{x?.hr ? Math.round(x.hr) : '–'}</td><td>{x ? fmtNum(x.lactate, 1) : '–'}</td><td className="muted small">{hint}</td></tr>;
  const zoneRanges = [Math.round((Number(settings.hrMax) || 0) * 0.55) || null, ...r.zoneHr.map((h) => (h ? Math.round(h) : null)), Number(settings.hrMax) || null];
  return (
    <div className="card">
      <div className="row" style={{ justifyContent: 'space-between' }}><h3 style={{ margin: 0, flex: 'none' }}>{sportLabel(test.sport)} · {fmtDate(test.date)}</h3><button className="ghost" style={{ flex: 'none' }} onClick={onEdit}>Bearbeiten</button></div>
      <XYChart xLabel={unit} marks={[r.lt1 && { x: r.lt1.load, label: 'LT1', color: 'var(--z2)' }, r.lt2 && { x: r.lt2.load, label: 'LT2', color: 'var(--z4)' }].filter(Boolean)} series={[
        { label: 'Laktat (mmol/l)', color: 'var(--z3)', points: r.steps.map((s) => ({ x: s.load, y: s.lactate })) },
        { label: 'Ausgleichskurve', color: 'var(--z3)', points: curve(r), dashed: true, noDots: true },
        ...(r.steps.some((s) => s.hr) ? [{ label: 'Puls', color: 'var(--fat)', axis: 'right', points: r.steps.filter((s) => s.hr).map((s) => ({ x: s.load, y: s.hr })) }] : []),
        ...(p && !p.error ? [{ label: `Vortest ${fmtDate(prev.date, { day: 'numeric', month: 'short' })}`, color: 'var(--load)', points: p.steps.map((s) => ({ x: s.load, y: s.lactate })), dashed: true }] : []),
      ]} />
      <table className="t"><thead><tr><th>Schwelle</th><th>Belastung</th><th>Puls</th><th>mmol/l</th><th /></tr></thead>
        <tbody>
          {row('LT1', r.lt1, 'Basis + 0,5 mmol')}
          {row('LT2', r.lt2, 'mod. Dmax')}
          {row('2 mmol', r.at2, 'fest')}
          {row('4 mmol', r.at4, 'OBLA')}
        </tbody></table>
      {p && !p.error && r.lt2 && p.lt2 && <p className="small" style={{ color: r.lt2.load >= p.lt2.load ? 'var(--good)' : 'var(--bad)' }}>LT2 gegenüber Vortest: {r.lt2.load >= p.lt2.load ? '+' : ''}{fmtNum(r.lt2.load - p.lt2.load, unit === 'W' ? 0 : 1)} {unit} ({fmtNum(((r.lt2.load - p.lt2.load) / p.lt2.load) * 100, 1)} %). Kurve nach rechts = besser.</p>}
      <h3>Deine Pulszonen aus dem Test</h3>
      <table className="t"><tbody>{['I1', 'I2', 'I3', 'I4', 'I5'].map((z, i) => <tr key={z}><td>{z}</td><td>{zoneRanges[i] ?? '?'}–{zoneRanges[i + 1] ?? '?'} bpm</td><td className="muted small">{['< 1,5', '1,5–2,5', '2,5–4', '4–6', '> 6'][i]} mmol/l</td></tr>)}</tbody></table>
      <p className="muted small">Olympiatoppen-Zonen nach Laktat (Grenzen {LACTATE_ZONE_BOUNDS.join(' / ').replace(/\./g, ',')} mmol/l). Double Threshold liegt im unteren bis mittleren I3.</p>
      <div className="row">
        <button className="primary" disabled={!r.zoneHr.every(Boolean)} onClick={applyZones}><Check size={17} />Pulszonen übernehmen</button>
        <button className="secondary" disabled={!r.lt2} onClick={applyThresholds}>Schwellenpuls{unit === 'W' && FTP_KEY[test.sport] ? ' + FTP' : ''} übernehmen</button>
      </div>
      {settings.zoneSource && <p className="muted small">Aktuell gelten Pulszonen aus dem Test vom {fmtDate(settings.zoneSource)}. <button className="ghost" style={{ padding: 0, display: 'inline' }} onClick={async () => { update((d) => ({ ...d, settings: { ...d.settings, zoneHr: null, zoneSource: null } })); await recomputeAll(); toast('Zurück auf % Maximalpuls'); }}>Zurücksetzen</button></p>}
      {test.notes && <p className="small">{test.notes}</p>}
    </div>
  );
}

function TestEditor({ test, onClose, onSaved }) {
  const [t, setT] = useState(test);
  const setStep = (i, k, v) => setT({ ...t, steps: t.steps.map((s, j) => (j === i ? { ...s, [k]: v } : s)) });
  const save = () => {
    update((d) => ({ ...d, lactateTests: [...d.lactateTests.filter((x) => x.id !== t.id), t] }));
    onSaved(t.id); onClose();
  };
  const remove = () => { update((d) => ({ ...d, lactateTests: d.lactateTests.filter((x) => x.id !== t.id) })); onClose(); };
  return (
    <Sheet title="Laktat-Stufentest" onClose={onClose}>
      <div className="grid3">
        <div><label>Datum</label><input type="date" value={t.date} onChange={(e) => setT({ ...t, date: e.target.value })} /></div>
        <div><label>Sportart</label><select value={t.sport} onChange={(e) => setT({ ...t, sport: e.target.value })}>{SPORTS.filter((s) => s.group !== 'strength').map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select></div>
        <div><label>Einheit</label><select value={t.unit} onChange={(e) => setT({ ...t, unit: e.target.value })}><option value="W">Watt</option><option value="km/h">km/h</option></select></div>
      </div>
      <div className="set-row" style={{ gridTemplateColumns: '28px 1fr 1fr 1fr 1fr 34px', marginTop: 14 }}><span>#</span><span>{t.unit}</span><span>Puls</span><span>Laktat</span><span>RPE</span><span /></div>
      {t.steps.map((s, i) => (
        <div key={i} className="set-row" style={{ gridTemplateColumns: '28px 1fr 1fr 1fr 1fr 34px' }}>
          <span>{i + 1}</span>
          <input inputMode="decimal" value={s.load} onChange={(e) => setStep(i, 'load', e.target.value)} />
          <input inputMode="numeric" value={s.hr} onChange={(e) => setStep(i, 'hr', e.target.value)} />
          <input inputMode="decimal" value={s.lactate} onChange={(e) => setStep(i, 'lactate', e.target.value)} />
          <input inputMode="decimal" value={s.rpe} onChange={(e) => setStep(i, 'rpe', e.target.value)} />
          <button className="ghost" onClick={() => setT({ ...t, steps: t.steps.filter((_, j) => j !== i) })} aria-label="Stufe entfernen"><Trash2 size={14} /></button>
        </div>
      ))}
      <button className="ghost" onClick={() => { const last = t.steps.at(-1); const inc = t.steps.length > 1 ? Number(last.load) - Number(t.steps.at(-2).load) : 25; setT({ ...t, steps: [...t.steps, { load: (Number(last?.load) || 0) + inc, hr: '', lactate: '', rpe: '' }] }); }}><Plus size={15} />Stufe</button>
      <label>Notiz (Bedingungen, Gerät, Tagesform)</label><textarea value={t.notes} onChange={(e) => setT({ ...t, notes: e.target.value })} />
      <div className="row" style={{ marginTop: 12 }}>
        <button className="primary" onClick={save}>Speichern</button>
        <button className="danger" onClick={remove}><Trash2 size={17} />Löschen</button>
      </div>
    </Sheet>
  );
}
