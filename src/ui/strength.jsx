import React, { useMemo, useState } from 'react';
import { Plus, Trash2, Search, Dumbbell, ChevronLeft } from 'lucide-react';
import { useData, update, uid } from '../lib/store.js';
import { today, buildActivity } from '../lib/activities.js';
import { EXERCISES, CATEGORIES, TEMPLATES, exerciseById, exerciseHistory, lastSets, e1rm } from '../lib/strength.js';
import { LineChart } from './charts.jsx';
import { Sheet, Seg, fmtDate, fmtNum, toast } from './common.jsx';

const unit = (ex) => (ex?.type === 'time' ? 'Sek.' : 'Wdh.');
const setsText = (sets, ex) => sets.filter((s) => s.reps).map((s) => `${s.reps}${ex?.type === 'time' ? 's' : ''}${s.kg ? '×' + s.kg : ''}`).join(' · ');

export function Strength() {
  const { strength, customExercises, settings } = useData();
  const [view, setView] = useState('log');
  const [editing, setEditing] = useState(null);
  const [exInfo, setExInfo] = useState(null);
  const sorted = [...strength].sort((a, b) => b.date.localeCompare(a.date));

  const start = (tpl) => {
    const items = (tpl?.items || []).map((it) => {
      const ex = exerciseById(it.ex, customExercises);
      const last = lastSets(strength, it.ex);
      // Vorschlag: letzte Gewichte übernehmen, sonst Sätze aus der Vorlage.
      const sets = last ? last.sets.map((s) => ({ reps: s.reps, kg: s.kg, rpe: '' })) : Array.from({ length: it.sets }, () => ({ reps: it.reps, kg: '', rpe: '' }));
      return { ex: it.ex, name: ex?.name, sets };
    });
    setEditing({ id: uid(), date: today(settings.timezone), title: tpl?.name || 'Krafttraining', minutes: 60, rpe: 7, notes: '', items, isNew: true });
  };

  if (editing) return <SessionEditor session={editing} onDone={() => setEditing(null)} />;

  return (
    <>
      <h1>Kraft</h1>
      <Seg value={view} onChange={setView} options={[['log', 'Einheiten'], ['catalog', 'Katalog'], ['progress', 'Fortschritt']]} />
      {view === 'log' && (
        <>
          <h2>Neue Einheit</h2>
          {TEMPLATES.map((t) => <button key={t.id} className="item" onClick={() => start(t)}><div className="grow"><b>{t.name}</b><p>{t.items.map((i) => exerciseById(i.ex)?.name).join(' · ')}</p></div><Plus size={18} /></button>)}
          <button className="secondary wide" onClick={() => start(null)}><Plus size={17} />Leere Einheit</button>
          <h2>Letzte Einheiten</h2>
          {!sorted.length && <p className="muted">Noch keine Krafteinheiten.</p>}
          {sorted.map((s) => (
            <button key={s.id} className="item" onClick={() => setEditing(s)}>
              <div className="grow"><b>{s.title}</b><p>{fmtDate(s.date)} · {s.minutes} min · RPE {s.rpe}</p>
                <p>{s.items.map((it) => `${it.name}: ${setsText(it.sets, exerciseById(it.ex, customExercises))}`).join(' | ')}</p></div>
              <Dumbbell size={18} />
            </button>
          ))}
        </>
      )}
      {view === 'catalog' && <Catalog onPick={setExInfo} />}
      {view === 'progress' && <Progress onPick={setExInfo} />}
      {exInfo && <ExerciseSheet ex={exInfo} onClose={() => setExInfo(null)} />}
      <div className="notice">Studienlage Langlauf: schwere Maximalkraft (3–5 Wdh., ~85–90 % 1RM, Aufwärtsphase explosiv) plus Sprungkraft verbessert die Ökonomie im Doppelstock und im Skating (Rønnestad & Mujika 2014; Losnegard et al. 2011). 2 Einheiten pro Woche in der Vorbereitung, in der Saison 1 zum Erhalt.</div>
    </>
  );
}

function Catalog({ onPick, pickMode }) {
  const { customExercises } = useData();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const all = [...EXERCISES, ...customExercises];
  const list = all.filter((e) => (!cat || e.cat === cat) && (!q || (e.name + e.muscles).toLowerCase().includes(q.toLowerCase())));
  const addCustom = () => {
    const name = q.trim();
    if (!name) return;
    const ex = { id: 'c_' + uid(), name, cat: cat || 'specific', type: 'weight', muscles: '', why: 'Eigene Übung', cues: '' };
    update((d) => ({ ...d, customExercises: [...d.customExercises, ex] }));
    onPick(ex);
  };
  return (
    <>
      <div className="row" style={{ marginTop: 12 }}><Search size={18} style={{ flex: 'none' }} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Übung suchen" /></div>
      <div className="chips">
        <button className={`chip${!cat ? ' on' : ''}`} onClick={() => setCat('')}>Alle</button>
        {Object.entries(CATEGORIES).map(([k, v]) => <button key={k} className={`chip${cat === k ? ' on' : ''}`} onClick={() => setCat(k)}>{v}</button>)}
      </div>
      {list.map((e) => <button key={e.id} className="item" onClick={() => onPick(e)}><div className="grow"><b>{e.name}</b><p>{CATEGORIES[e.cat]} · {e.muscles}</p>{!pickMode && <p>{e.why}</p>}</div>{pickMode && <Plus size={18} />}</button>)}
      {q && !list.some((e) => e.name.toLowerCase() === q.toLowerCase()) && <button className="secondary wide" onClick={addCustom}><Plus size={17} />„{q}“ als eigene Übung anlegen</button>}
    </>
  );
}

function Progress({ onPick }) {
  const { strength, customExercises } = useData();
  const used = useMemo(() => [...new Set(strength.flatMap((s) => s.items.map((i) => i.ex)))], [strength]);
  if (!used.length) return <p className="muted" style={{ marginTop: 16 }}>Sobald du Krafteinheiten eingetragen hast, siehst du hier Bestwerte und Verlauf je Übung.</p>;
  return used.map((id) => {
    const ex = exerciseById(id, customExercises);
    const h = exerciseHistory(strength, id);
    const best = Math.max(...h.map((r) => r.best || 0));
    return <button key={id} className="item" onClick={() => onPick(ex)}><div className="grow"><b>{ex?.name || id}</b><p>{h.length} Einheiten · zuletzt {fmtDate(h.at(-1).date)}: {setsText(h.at(-1).sets, ex)}</p></div>{best > 0 && <span className="num">{fmtNum(best)}<span className="muted small"> kg 1RM</span></span>}</button>;
  });
}

function ExerciseSheet({ ex, onClose }) {
  const { strength, settings } = useData();
  const h = exerciseHistory(strength, ex.id, Number(settings.weightKg) || 0);
  return (
    <Sheet title={ex.name} onClose={onClose}>
      <p className="muted">{CATEGORIES[ex.cat]} · {ex.muscles}</p>
      {ex.why && <p><b>Warum:</b> {ex.why}</p>}
      {ex.cues && <p><b>Ausführung:</b> {ex.cues}</p>}
      {h.length > 0 && <>
        {h.some((r) => r.best) && <div className="card"><LineChart labels={h.map((r) => r.date)} xFormat={(d) => fmtDate(d, { day: 'numeric', month: 'numeric' })} series={[{ label: 'geschätztes 1RM (kg)', values: h.map((r) => r.best), color: 'var(--fit)', dots: true }]} /></div>}
        <table className="t"><thead><tr><th>Datum</th><th>Sätze</th><th>1RM</th></tr></thead>
          <tbody>{[...h].reverse().map((r) => <tr key={r.date + r.volume}><td>{fmtDate(r.date, { day: 'numeric', month: 'short' })}</td><td>{setsText(r.sets, ex)}</td><td>{fmtNum(r.best)}</td></tr>)}</tbody></table>
      </>}
    </Sheet>
  );
}

function SessionEditor({ session, onDone }) {
  const { strength, customExercises, settings, activities } = useData();
  const [s, setS] = useState(session);
  const [picking, setPicking] = useState(false);
  const setItem = (i, fn) => setS({ ...s, items: s.items.map((it, k) => (k === i ? fn(it) : it)) });
  const setSet = (i, j, k, v) => setItem(i, (it) => ({ ...it, sets: it.sets.map((x, m) => (m === j ? { ...x, [k]: v } : x)) }));
  const add = (ex) => {
    const last = lastSets(strength, ex.id);
    setS({ ...s, items: [...s.items, { ex: ex.id, name: ex.name, sets: last ? last.sets.map((x) => ({ reps: x.reps, kg: x.kg, rpe: '' })) : [{ reps: '', kg: '', rpe: '' }] }] });
    setPicking(false);
  };
  const save = () => {
    const clean = { ...s, isNew: undefined, items: s.items.map((it) => ({ ...it, sets: it.sets.filter((x) => x.reps).map((x) => ({ reps: Number(x.reps), kg: x.kg === '' ? '' : Number(String(x.kg).replace(',', '.')), rpe: x.rpe })) })).filter((it) => it.sets.length) };
    // Eine Krafteinheit erscheint auch als Trainingseinheit (Belastung über RPE × Dauer).
    const existing = activities.find((a) => a.strengthId === s.id);
    const { activity } = buildActivity({ source: existing?.source || 'manual', start: existing?.start || new Date(`${s.date}T17:00:00`).toISOString(), sport: 'strength', durationS: Number(s.minutes) * 60, elapsedS: Number(s.minutes) * 60, rpe: Number(s.rpe), title: s.title, strengthId: s.id, notes: s.notes, avgHr: existing?.avgHr }, settings, { id: existing?.id || uid() });
    update((d) => ({
      ...d,
      strength: [...d.strength.filter((x) => x.id !== s.id), clean],
      activities: [...d.activities.filter((a) => a.id !== activity.id), { ...activity, hasSeries: existing?.hasSeries || false }],
    }));
    toast('Krafteinheit gespeichert');
    onDone();
  };
  const remove = () => {
    if (!confirm('Krafteinheit löschen?')) return;
    update((d) => ({ ...d, strength: d.strength.filter((x) => x.id !== s.id), activities: d.activities.filter((a) => a.strengthId !== s.id) }));
    onDone();
  };
  return (
    <>
      <button className="ghost" onClick={onDone}><ChevronLeft size={18} />Zurück</button>
      <input value={s.title} onChange={(e) => setS({ ...s, title: e.target.value })} style={{ fontSize: 20, fontWeight: 800 }} />
      <div className="grid3">
        <div><label>Datum</label><input type="date" value={s.date} onChange={(e) => setS({ ...s, date: e.target.value })} /></div>
        <div><label>Minuten</label><input type="number" value={s.minutes} onChange={(e) => setS({ ...s, minutes: e.target.value })} /></div>
        <div><label>RPE gesamt</label><input type="number" min="1" max="10" value={s.rpe} onChange={(e) => setS({ ...s, rpe: e.target.value })} /></div>
      </div>
      {s.items.map((it, i) => {
        const ex = exerciseById(it.ex, customExercises);
        const last = lastSets(strength.filter((x) => x.id !== s.id), it.ex);
        return (
          <div key={i} className="ex">
            <div className="ex-head"><b>{it.name}</b><button className="ghost" onClick={() => setS({ ...s, items: s.items.filter((_, k) => k !== i) })} aria-label="Übung entfernen"><Trash2 size={16} /></button></div>
            {last && <p className="muted small" style={{ margin: '2px 0 6px' }}>Letztes Mal ({fmtDate(last.date, { day: 'numeric', month: 'short' })}): {setsText(last.sets, ex)}</p>}
            <div className="set-row"><span>#</span><span>{unit(ex)}</span><span>{ex?.type === 'bodyweight' ? '+kg' : 'kg'}</span><span>RPE</span><span /></div>
            {it.sets.map((x, j) => (
              <div key={j} className="set-row">
                <span>{j + 1}</span>
                <input inputMode="numeric" value={x.reps} onChange={(e) => setSet(i, j, 'reps', e.target.value)} />
                <input inputMode="decimal" value={x.kg} onChange={(e) => setSet(i, j, 'kg', e.target.value)} disabled={ex?.type === 'time' || ex?.type === 'reps'} />
                <input inputMode="decimal" value={x.rpe} onChange={(e) => setSet(i, j, 'rpe', e.target.value)} />
                <button className="ghost" onClick={() => setItem(i, (t) => ({ ...t, sets: t.sets.filter((_, m) => m !== j) }))} aria-label="Satz entfernen"><Trash2 size={14} /></button>
              </div>
            ))}
            <button className="ghost" onClick={() => setItem(i, (t) => ({ ...t, sets: [...t.sets, { ...(t.sets.at(-1) || { reps: '', kg: '' }), rpe: '' }] }))}><Plus size={15} />Satz</button>
            {ex?.type === 'weight' && it.sets.some((x) => x.kg && x.reps) && <span className="muted small"> · 1RM ≈ {fmtNum(Math.max(...it.sets.map((x) => e1rm(Number(x.kg), Number(x.reps)) || 0)))} kg</span>}
          </div>
        );
      })}
      <button className="secondary wide" onClick={() => setPicking(true)}><Plus size={17} />Übung hinzufügen</button>
      <label>Notiz</label><textarea value={s.notes} onChange={(e) => setS({ ...s, notes: e.target.value })} />
      <div className="row" style={{ marginTop: 12 }}>
        <button className="primary" onClick={save}>Speichern</button>
        {!s.isNew && <button className="danger" onClick={remove}><Trash2 size={17} />Löschen</button>}
      </div>
      {picking && <Sheet title="Übung wählen" onClose={() => setPicking(false)}><Catalog onPick={add} pickMode /></Sheet>}
    </>
  );
}
