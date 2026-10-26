import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, Upload, Trash2, Check } from 'lucide-react';
import { useData, update, getSeries, deleteSeries, uid } from '../lib/store.js';
import { today, weeks, mondayOf, buildActivity, evaluate } from '../lib/activities.js';
import { addDays, ZONES } from '../lib/metrics.js';
import { SPORTS, sportLabel } from '../lib/sports.js';
import { importFiles } from '../lib/sync.js';
import { ZoneWeeks, ZoneBar, LineChart, ZONE_COLORS } from './charts.jsx';
import { Sheet, Seg, fmtDuration, fmtNum, fmtDate, fmtKm, toast } from './common.jsx';

export function Training({ openActivity, openAdd }) {
  const { activities, plan, settings } = useData();
  const t = today(settings.timezone);
  const [view, setView] = useState('week');
  const [monday, setMonday] = useState(mondayOf(t));
  const [planItem, setPlanItem] = useState(null);
  const sorted = useMemo(() => [...activities].sort((a, b) => b.start.localeCompare(a.start)), [activities]);
  const w12 = useMemo(() => weeks(activities, 12, t), [activities, t]);
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const wk = weeks(activities.filter((a) => a.date >= monday && a.date <= days[6]), 1, days[6])[0];
  const plannedWeek = plan.filter((p) => p.date >= monday && p.date <= days[6] && !p.done);

  return (
    <>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h1 style={{ flex: 'none', margin: '8px 0' }}>Training</h1>
        <button className="primary" style={{ flex: 'none' }} onClick={openAdd}><Plus size={18} />Einheit</button>
      </div>
      <Seg value={view} onChange={setView} options={[['week', 'Woche'], ['list', 'Liste'], ['zones', 'Zonen']]} />

      {view === 'week' && (
        <>
          <div className="row" style={{ justifyContent: 'space-between', margin: '12px 0 8px' }}>
            <button className="ghost" style={{ flex: 'none' }} onClick={() => setMonday(addDays(monday, -7))} aria-label="Vorige Woche"><ChevronLeft /></button>
            <b style={{ flex: 'none' }}>{fmtDate(monday, { day: 'numeric', month: 'short' })} – {fmtDate(days[6], { day: 'numeric', month: 'short' })}</b>
            <button className="ghost" style={{ flex: 'none' }} onClick={() => setMonday(addDays(monday, 7))} aria-label="Nächste Woche"><ChevronRight /></button>
          </div>
          <div className="week">
            {days.map((d) => (
              <div key={d} className={`day${d === t ? ' today' : ''}`}>
                <b>{fmtDate(d, { weekday: 'short', day: 'numeric' })}</b>
                {activities.filter((a) => a.date === d).map((a) => <div key={a.id} className="a" onClick={() => openActivity(a)}>{Math.round(a.durationS / 60)}′ {sportLabel(a.sport)}</div>)}
                {plan.filter((p) => p.date === d && !p.done).map((p) => <div key={p.id} className="p" onClick={() => setPlanItem(p)}>{p.minutes}′ {p.title}</div>)}
              </div>
            ))}
          </div>
          <div className="stats">
            <div><b>{fmtNum(wk.hours, 1)}</b><span>Stunden</span></div>
            <div><b>{fmtNum(wk.load)}</b><span>Belastung</span></div>
            <div><b>{fmtNum(plannedWeek.reduce((a, p) => a + p.minutes, 0) / 60, 1)}</b><span>Std. geplant offen</span></div>
          </div>
          <div className="card">
            <h3 style={{ marginTop: 0 }}>Zonen dieser Woche</h3>
            {ZONES.map((z) => <div key={z.id} className="row" style={{ fontSize: 13, margin: '4px 0' }}><span style={{ flex: '0 0 110px' }}><i style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 3, background: ZONE_COLORS[z.id], marginRight: 6 }} />{z.label}</span><span>{fmtDuration(wk.zones[z.id] * 3600)} h</span></div>)}
            <p className="muted small">Kraft: {wk.strengthSessions} · Schwelleneinheiten: {wk.thresholdSessions}</p>
          </div>
        </>
      )}

      {view === 'list' && (
        <>
          {!sorted.length && <p className="muted">Noch keine Einheiten.</p>}
          {sorted.map((a) => (
            <button key={a.id} className="item" onClick={() => openActivity(a)}>
              <div className="grow">
                <b>{a.title || sportLabel(a.sport)}</b>
                <p>{fmtDate(a.date)} · {fmtDuration(a.durationS)} h {fmtKm(a.distanceM) && '· ' + fmtKm(a.distanceM)}{a.avgHr ? ` · Ø ${a.avgHr}` : ''} · {a.source}</p>
                <ZoneBar zones={a.zones} />
              </div>
              <span className="num">{fmtNum(a.load)}</span>
            </button>
          ))}
        </>
      )}

      {view === 'zones' && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Stunden je Woche nach Zone</h3>
          <ZoneWeeks weeks={w12} />
          <ZoneShare weeks={w12.slice(-4)} />
        </div>
      )}
      {planItem && <PlanSheet item={planItem} onClose={() => setPlanItem(null)} />}
    </>
  );
}

// Anteil locker/Schwelle/hart der letzten 4 Wochen (Orientierung: ~80–90 % locker bei Langläufern).
function ZoneShare({ weeks: w }) {
  const z = { I1: 0, I2: 0, I3: 0, I4: 0, I5: 0 };
  for (const x of w) for (const k in z) z[k] += x.zones[k];
  const total = Object.values(z).reduce((a, b) => a + b, 0);
  if (!total) return <p className="muted small">Für die Zonenauswertung braucht es Pulsdaten und deinen Maximalpuls.</p>;
  const pct = (v) => Math.round((v / total) * 100);
  return <p className="muted small">Letzte 4 Wochen: locker (I1–I2) {pct(z.I1 + z.I2)} % · Schwelle (I3) {pct(z.I3)} % · hart (I4–I5) {pct(z.I4 + z.I5)} %. Weltklasse-Langläufer liegen meist bei 80–90 % locker.</p>;
}

function PlanSheet({ item, onClose }) {
  const set = (fn) => { update((d) => ({ ...d, plan: fn(d.plan) })); onClose(); };
  return (
    <Sheet title={item.title} onClose={onClose}>
      <p className="muted">{fmtDate(item.date)} · {sportLabel(item.sport)} · {item.minutes} min · {item.zone} · geschätzte Belastung {item.load}</p>
      <p style={{ whiteSpace: 'pre-line' }}>{item.description}</p>
      <div className="row">
        <button className="secondary" onClick={() => set((p) => p.map((x) => (x.id === item.id ? { ...x, done: true } : x)))}><Check size={17} />Erledigt / ausblenden</button>
        <button className="danger" onClick={() => set((p) => p.filter((x) => x.id !== item.id))}><Trash2 size={17} />Löschen</button>
      </div>
    </Sheet>
  );
}

export function ActivitySheet({ activity, onClose }) {
  const { settings } = useData();
  const [a, setA] = useState(activity);
  const [series, setSeries] = useState(null);
  useEffect(() => { if (activity.hasSeries) getSeries(activity.id).then(setSeries); }, [activity]);
  const save = () => {
    const next = activity.hasSeries ? { ...a } : { ...a, ...evaluate({ ...a, durationS: a.durationS }, settings) };
    update((d) => ({ ...d, activities: d.activities.map((x) => (x.id === a.id ? next : x)) }));
    toast('Gespeichert');
    onClose();
  };
  const remove = async () => {
    if (!confirm('Einheit löschen?')) return;
    await deleteSeries(a.id);
    update((d) => ({ ...d, activities: d.activities.filter((x) => x.id !== a.id) }));
    onClose();
  };
  const labels = series?.hr?.map((_, i) => i * 5);
  return (
    <Sheet title={a.title || sportLabel(a.sport)} onClose={onClose}>
      <p className="muted">{fmtDate(a.date, { weekday: 'long', day: 'numeric', month: 'long' })} · {new Date(a.start).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} · Quelle: {a.source}</p>
      <div className="stats">
        <div><b>{fmtNum(a.load)}</b><span>Belastung ({{ power: 'Watt', hr: 'Puls', hr_avg: 'Ø Puls', rpe: 'RPE' }[a.loadSource] || '–'})</span></div>
        <div><b>{fmtDuration(a.durationS)}</b><span>Dauer</span></div>
        <div><b>{a.distanceM ? fmtNum(a.distanceM / 1000, 1) : '–'}</b><span>km</span></div>
        <div><b>{a.avgHr ?? '–'}/{a.maxHr ?? '–'}</b><span>Ø/max Puls</span></div>
        <div><b>{a.avgPower ?? '–'}{a.np ? `/${a.np}` : ''}</b><span>Ø W{a.np ? '/NP' : ''}</span></div>
        <div><b>{a.trimp ?? '–'}</b><span>TRIMP</span></div>
      </div>
      <ZoneBar zones={a.zones} />
      {series && <div className="card"><LineChart labels={labels} xFormat={(s) => fmtDuration(s)} series={[
        ...(series.hr.some(Boolean) ? [{ label: 'Puls', values: series.hr, color: 'var(--fat)' }] : []),
        ...(series.power.some(Boolean) ? [{ label: 'Watt', values: series.power, color: 'var(--fit)' }] : []),
      ]} /></div>}
      <div className="grid2">
        <div><label>Titel</label><input value={a.title} onChange={(e) => setA({ ...a, title: e.target.value })} placeholder="z. B. 5×6 min Schwelle" /></div>
        <div><label>Sportart</label><select value={a.sport} onChange={(e) => setA({ ...a, sport: e.target.value })}>{SPORTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select></div>
        <div><label>RPE (1–10)</label><input type="number" min="1" max="10" step="0.5" value={a.rpe ?? ''} onChange={(e) => setA({ ...a, rpe: e.target.value ? Number(e.target.value) : null })} /></div>
        <div><label>Laktat (mmol/l)</label><input value={a.lactate} onChange={(e) => setA({ ...a, lactate: e.target.value })} placeholder="z. B. 2,1 / 2,4 / 2,8" /></div>
      </div>
      <label>Notiz</label><textarea value={a.notes} onChange={(e) => setA({ ...a, notes: e.target.value })} />
      <div className="row" style={{ marginTop: 12 }}>
        <button className="primary" onClick={save}>Speichern</button>
        <button className="danger" onClick={remove}><Trash2 size={17} />Löschen</button>
      </div>
    </Sheet>
  );
}

export function AddSheet({ onClose }) {
  const { settings } = useData();
  const t = today(settings.timezone);
  const [mode, setMode] = useState('manual');
  const [f, setF] = useState({ sport: 'xc_skate', date: t, time: '09:00', minutes: 60, rpe: 4, zone: 'I1', title: '', lactate: '', notes: '', distanceKm: '', avgHr: '' });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const saveManual = () => {
    const start = new Date(`${f.date}T${f.time}:00`).toISOString();
    const raw = { source: 'manual', start, sport: f.sport, durationS: Number(f.minutes) * 60, elapsedS: Number(f.minutes) * 60, rpe: Number(f.rpe) || null, zone: f.sport === 'strength' ? null : f.zone, title: f.title, lactate: f.lactate, notes: f.notes, distanceM: f.distanceKm ? Number(String(f.distanceKm).replace(',', '.')) * 1000 : null, avgHr: f.avgHr ? Number(f.avgHr) : null };
    const { activity } = buildActivity(raw, settings, { id: uid() });
    update((d) => ({ ...d, activities: [...d.activities, activity] }));
    toast(`Gespeichert · Belastung ${fmtNum(activity.load)}`);
    onClose();
  };
  const upload = async (e) => {
    setBusy(true);
    const r = await importFiles([...e.target.files]);
    setBusy(false);
    toast(`${r.added} importiert, ${r.dup} schon vorhanden, ${r.failed} fehlerhaft`);
    if (r.added) onClose();
  };
  return (
    <Sheet title="Einheit hinzufügen" onClose={onClose}>
      <Seg value={mode} onChange={setMode} options={[['manual', 'Eintragen'], ['fit', 'FIT-Datei']]} />
      {mode === 'manual' ? (
        <>
          <label>Sportart</label>
          <select value={f.sport} onChange={set('sport')}>{SPORTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select>
          <div className="grid3">
            <div><label>Datum</label><input type="date" value={f.date} onChange={set('date')} /></div>
            <div><label>Uhrzeit</label><input type="time" value={f.time} onChange={set('time')} /></div>
            <div><label>Minuten</label><input type="number" value={f.minutes} onChange={set('minutes')} /></div>
          </div>
          <div className="grid3">
            <div><label>RPE (1–10)</label><input type="number" min="1" max="10" step="0.5" value={f.rpe} onChange={set('rpe')} /></div>
            {f.sport !== 'strength' && <div><label>Hauptzone</label><select value={f.zone} onChange={set('zone')}>{ZONES.map((z) => <option key={z.id} value={z.id}>{z.label}</option>)}</select></div>}
            <div><label>Ø Puls</label><input type="number" value={f.avgHr} onChange={set('avgHr')} placeholder="optional" /></div>
          </div>
          <div className="grid2">
            <div><label>Titel</label><input value={f.title} onChange={set('title')} placeholder="z. B. Double Threshold 1" /></div>
            <div><label>Distanz (km)</label><input value={f.distanceKm} onChange={set('distanceKm')} placeholder="optional" /></div>
          </div>
          <label>Laktat (mmol/l)</label><input value={f.lactate} onChange={set('lactate')} placeholder="optional, z. B. 2,0 / 2,3 / 2,6" />
          <label>Notiz</label><textarea value={f.notes} onChange={set('notes')} />
          <p className="muted small">Krafttraining mit Übungen und Gewichten trägst du im Tab „Kraft“ ein.</p>
          <button className="primary wide" onClick={saveManual}>Speichern</button>
        </>
      ) : (
        <>
          <p className="muted">FIT-Dateien von Polar, Garmin, Wahoo oder Suunto. Für ältere Polar-Daten: in Polar Flow unter Einstellungen → „Daten herunterladen“ exportieren.</p>
          <label className="primary wide" style={{ cursor: 'pointer' }}><Upload size={18} />{busy ? 'Importiere …' : 'FIT-Dateien wählen'}<input type="file" accept=".fit" multiple hidden onChange={upload} /></label>
        </>
      )}
    </Sheet>
  );
}
