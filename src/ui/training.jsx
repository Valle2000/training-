import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, Upload, Trash2, Check, Copy, Scissors, Undo2, CalendarClock } from 'lucide-react';
import { useData, update, getData, getSeries, getLocalSeries, putSeries, uid } from '../lib/store.js';
import { today, weeks, mondayOf, buildActivity, evaluate, estimatePlanLoad, matchPlan, compliance, cropActivity, localDate, reevaluate } from '../lib/activities.js';
import { addDays, ZONES, cleanSeries } from '../lib/metrics.js';
import { SPORTS, sportLabel } from '../lib/sports.js';
import { importFiles, deleteActivities } from '../lib/sync.js';
import { deleteRemoteSeries } from '../lib/cloud-sync.js';
import { ZoneWeeks, ZoneBar, LineChart, ZONE_COLORS } from './charts.jsx';
import { Sheet, Seg, fmtDuration, fmtNum, fmtDate, fmtKm, toast } from './common.jsx';
import { Season, Races } from './season.jsx';
import { Workouts } from './workouts.jsx';
import { durationOf, workoutLoad, mainZone, describe } from '../lib/workouts.js';
import { ScheduleSheet, AdaptCard } from './week.jsx';
import { slotDay, freeMinutes, hasSchedule, fmtTime } from '../lib/week-adapt.js';
import { LapsCard } from './laps.jsx';
import { ActivityChart } from './activity-chart.jsx';
import { fmtPace } from '../lib/laps.js';
import { athleteOf } from '../lib/activities.js';

export function Training({ openActivity, openAdd }) {
  const { activities, plan, settings } = useData();
  const t = today(settings.timezone);
  const [view, setView] = useState('week');
  const [monday, setMonday] = useState(mondayOf(t));
  const [planItem, setPlanItem] = useState(null);
  const [schedOpen, setSchedOpen] = useState(false);
  const sched = hasSchedule(settings.schedule) ? settings.schedule : null;
  const sorted = useMemo(() => [...activities].sort((a, b) => b.start.localeCompare(a.start)), [activities]);
  const w12 = useMemo(() => weeks(activities, 12, t), [activities, t]);
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const wk = weeks(activities.filter((a) => a.date >= monday && a.date <= days[6]), 1, days[6])[0];
  const comp = compliance(plan, activities, monday, days[6]);
  const copyLastWeek = () => {
    const prev = plan.filter((p) => p.date >= addDays(monday, -7) && p.date < monday);
    if (!prev.length) return toast('In der Vorwoche ist nichts geplant');
    update((d) => ({ ...d, plan: [...d.plan, ...prev.map((p) => ({ ...p, id: uid(), date: addDays(p.date, 7), done: false }))] }));
    toast(`${prev.length} Einheiten kopiert`);
  };

  return (
    <>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h1 style={{ flex: 'none', margin: '8px 0' }}>Kalender</h1>
        <button className="primary" style={{ flex: 'none' }} onClick={openAdd}><Plus size={18} />Einheit</button>
      </div>
      <Seg value={view} onChange={setView} options={[['week', 'Woche'], ['list', 'Liste'], ['season', 'Saison'], ['races', 'Rennen'], ['workouts', 'Workouts'], ['zones', 'Zonen']]} />

      {view === 'week' && (
        <>
          <div className="row" style={{ justifyContent: 'space-between', margin: '12px 0 8px' }}>
            <button className="ghost" style={{ flex: 'none' }} onClick={() => setMonday(addDays(monday, -7))} aria-label="Vorige Woche"><ChevronLeft /></button>
            <b style={{ flex: 'none' }}>{fmtDate(monday, { day: 'numeric', month: 'short' })} – {fmtDate(days[6], { day: 'numeric', month: 'short' })}</b>
            <button className="ghost" style={{ flex: 'none' }} onClick={() => setMonday(addDays(monday, 7))} aria-label="Nächste Woche"><ChevronRight /></button>
          </div>
          {monday === mondayOf(t) && <AdaptCard />}
          <div className="week">
            {days.map((d) => { const open = plan.filter((p) => p.date === d && !p.done && !(d <= t && matchPlan(p, activities))); const slot = sched ? slotDay(d, open, sched) : null; return (
              <div key={d} className={`day${d === t ? ' today' : ''}`} onClick={(e) => e.target === e.currentTarget && setPlanItem({ date: d })}>
                <b onClick={() => setPlanItem({ date: d })}>{fmtDate(d, { weekday: 'short', day: 'numeric' })}</b>
                {activities.filter((a) => a.date === d).map((a) => <div key={a.id} className="a" onClick={() => openActivity(a)}>{Math.round(a.durationS / 60)}′ {sportLabel(a.sport)}</div>)}
                {open.map((p) => <div key={p.id} className={`p${d < t ? ' missed' : ''}`} style={slot?.overflow.includes(p.id) && d >= t ? { borderColor: 'var(--bad)' } : undefined} onClick={() => setPlanItem(p)}>{slot?.slots[p.id] && d >= t && <span style={{ display: 'block', fontWeight: 700 }}>{fmtTime(slot.slots[p.id].from)}</span>}{p.minutes}′ {p.title || sportLabel(p.sport)}</div>)}
                {sched && d >= t && <div className="muted" style={{ fontSize: 11 }}>frei {fmtNum(freeMinutes(d, sched) / 60, 1)} h</div>}
              </div>
            ); })}
          </div>
          <p className="muted small">Tippe auf einen Tag, um eine Einheit zu planen. Gestrichelt = geplant, durchgestrichen = verpasst.{sched ? ' Uhrzeit = Vorschlag in deiner freien Zeit, rot umrandet = passt nicht in den Tag.' : ''}</p>
          <div className="stats">
            <div><b>{fmtNum(comp.actualMin / 60, 1)}<small className="muted">/{fmtNum(comp.plannedMin / 60, 1)}</small></b><span>Stunden Ist/Soll</span></div>
            <div><b>{fmtNum(comp.actualLoad)}<small className="muted">/{fmtNum(comp.plannedLoad)}</small></b><span>Belastung Ist/Soll</span></div>
            <div><b>{comp.done}/{comp.planned}</b><span>Einheiten erledigt</span></div>
          </div>
          <div className="row">
            <button className="secondary" onClick={() => setPlanItem({ date: days.find((d) => d >= t) || days[0] })}><Plus size={17} />Einheit planen</button>
            <button className="secondary" onClick={copyLastWeek}><Copy size={17} />Vorwoche kopieren</button>
            <button className="secondary" onClick={() => setSchedOpen(true)}><CalendarClock size={17} />Alltag</button>
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
                <p>{fmtDate(a.date, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })} · {fmtDuration(a.durationS)} h {fmtKm(a.distanceM) && '· ' + fmtKm(a.distanceM)}{a.avgHr ? ` · Ø ${a.avgHr}` : ''} · {a.source}</p>
                <ZoneBar zones={a.zones} />
              </div>
              <span className="num" title={a.load == null ? 'Schwellenwerte fehlen' : undefined}>{a.load == null ? '?' : fmtNum(a.load)}</span>
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
      {view === 'season' && <Season />}
      {view === 'races' && <Races openActivity={openActivity} />}
      {view === 'workouts' && <Workouts />}
      {schedOpen && <ScheduleSheet onClose={() => setSchedOpen(false)} />}
      {planItem && <PlanEditor item={planItem} onClose={() => setPlanItem(null)} />}
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

const PLAN_ZONES = [['I1', 'I1 locker'], ['I2', 'I2 mittel'], ['I3', 'I3 Schwelle'], ['I4', 'I4 hart'], ['I5', 'I5 sehr hart'], ['Kraft', 'Kraft']];

// Geplante Einheit anlegen oder bearbeiten. Die Belastung fließt in die Formprognose ein.
function PlanEditor({ item, onClose }) {
  const { keySessions, workouts, settings } = useData();
  const isNew = !item.id;
  const [p, setP] = useState({ sport: 'rollerski_skate', minutes: 60, zone: 'I1', title: '', description: '', ...item });
  const [manualLoad, setManualLoad] = useState(!isNew && item.load !== estimatePlanLoad(item.minutes, item.zone));
  const load = manualLoad ? p.load : estimatePlanLoad(p.minutes, p.zone);
  const set = (k) => (e) => setP({ ...p, [k]: e.target.value });
  const save = () => {
    const next = { ...p, id: p.id || uid(), minutes: Number(p.minutes) || 0, load: Number(load) || 0, source: p.source || 'manual' };
    update((d) => ({ ...d, plan: [...d.plan.filter((x) => x.id !== next.id), next] }));
    toast('Geplant');
    onClose();
  };
  const remove = () => { update((d) => ({ ...d, plan: d.plan.filter((x) => x.id !== p.id) })); onClose(); };
  return (
    <Sheet title={isNew ? 'Einheit planen' : 'Geplante Einheit'} onClose={onClose}>
      <div className="grid2">
        <div><label>Datum</label><input type="date" value={p.date} onChange={set('date')} /></div>
        <div><label>Sportart</label><select value={p.sport} onChange={(e) => setP({ ...p, sport: e.target.value, zone: e.target.value === 'strength' ? 'Kraft' : p.zone === 'Kraft' ? 'I1' : p.zone })}>{SPORTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select></div>
        <div><label>Minuten</label><input type="number" value={p.minutes} onChange={set('minutes')} /></div>
        <div><label>Hauptzone</label><select value={p.zone} onChange={set('zone')}>{PLAN_ZONES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
      </div>
      <label>Titel</label><input value={p.title} onChange={set('title')} placeholder="z. B. Double Threshold AM: 5×6 min" />
      {keySessions.length > 0 && <><label>Key Session</label><select value={p.keySessionId || ''} onChange={(e) => { const k = keySessions.find((x) => x.id === e.target.value); setP({ ...p, keySessionId: e.target.value || null, ...(k && !p.title ? { title: k.name, sport: k.sport || p.sport } : {}) }); }}><option value="">–</option>{keySessions.map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}</select></>}
      {workouts.length > 0 && <><label>Workout aus Bibliothek</label><select value={p.workoutId || ''} onChange={(e) => { const w = workouts.find((x) => x.id === e.target.value); if (!w) return setP({ ...p, workoutId: null }); setManualLoad(true); setP({ ...p, workoutId: w.id, title: w.name, sport: w.sport, minutes: Math.round(durationOf(w) / 60), zone: mainZone(w), load: workoutLoad(w, settings), description: describe(w.steps) }); }}><option value="">–</option>{workouts.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</select></>}
      <label>Beschreibung</label><textarea value={p.description} onChange={set('description')} placeholder="Aufwärmen, Intervalle, Laktatziel …" />
      <label>Geschätzte Belastung</label>
      <div className="row">
        <input type="number" value={load} disabled={!manualLoad} onChange={(e) => setP({ ...p, load: e.target.value })} />
        <button className="ghost" style={{ flex: 'none' }} onClick={() => { setManualLoad(!manualLoad); setP({ ...p, load }); }}>{manualLoad ? 'automatisch' : 'selbst festlegen'}</button>
      </div>
      <p className="muted small">Automatisch: pro Stunde I1 ≈ 50, I2 ≈ 65, I3 ≈ 90, I4 ≈ 110, I5 ≈ 125, Kraft ≈ 45.</p>
      <div className="row" style={{ marginTop: 12 }}>
        <button className="primary" onClick={save}>Speichern</button>
        {!isNew && <button className="secondary" onClick={() => { update((d) => ({ ...d, plan: d.plan.map((x) => (x.id === p.id ? { ...x, done: true } : x)) })); onClose(); }}><Check size={17} />Erledigt</button>}
        {!isNew && <button className="danger" onClick={remove}><Trash2 size={17} />Löschen</button>}
      </div>
    </Sheet>
  );
}

export function ActivitySheet({ activity, onClose }) {
  const { settings, keySessions, gear } = useData();
  const [a, setA] = useState(activity);
  const [series, setSeries] = useState(null);
  useEffect(() => { if (activity.hasSeries) getSeries(activity.id).then((x) => setSeries(cleanSeries(x))); }, [activity]);
  // Datum/Uhrzeit (und ohne Verlauf auch Dauer, Distanz, Ø Puls) lassen sich nachträglich ändern.
  const tz = settings.timezone || 'Europe/Berlin';
  const [when, setWhen] = useState(() => ({ date: activity.date, time: new Date(activity.start).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) }));
  const save = async () => {
    let next = { ...a };
    if (when.date !== activity.date || when.time !== new Date(activity.start).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })) {
      next.start = new Date(`${when.date}T${when.time}:00`).toISOString();
      next.date = localDate(next.start, tz);
    }
    // Titel geändert und weitere Einheiten heißen genauso (z. B. Concept2-Aufbau): alle umbenennen und als Regel merken.
    const same = activity.title && next.title !== activity.title ? getData().activities.filter((x) => x.id !== a.id && x.title === activity.title) : [];
    const renameAll = same.length > 0 && confirm(`${same.length} weitere Einheit(en) heißen „${activity.title}“. Alle in „${next.title}“ umbenennen und künftige Importe automatisch so nennen?`);
    if (!activity.hasSeries) next = { ...next, elapsedS: next.durationS, ...evaluate({ ...next, durationS: next.durationS }, settings) };
    else if (next.sport !== activity.sport) { const s5 = await getSeries(a.id); if (s5) next = reevaluate(next, settings, s5); } // Sportart bestimmt FTP und Watt-Belastung
    update((d) => ({
      ...d,
      settings: renameAll ? { ...d.settings, titleRules: { ...(d.settings.titleRules || {}), [activity.title]: next.title } } : d.settings,
      activities: d.activities.map((x) => (x.id === a.id ? next : renameAll && x.title === activity.title ? { ...x, title: next.title } : x)),
    }));
    toast(renameAll ? `${same.length + 1} Einheiten umbenannt` : 'Gespeichert');
    onClose();
  };
  const remove = async () => {
    if (!confirm('Einheit löschen? Sie verschwindet auch auf deinen anderen Geräten.')) return;
    await deleteActivities([a.id]);
    toast('Gelöscht');
    onClose();
  };
  // Zuschneiden auf den im Diagramm gewählten Bereich (Ziehen oder Regler).
  const [sel, setSel] = useState(null);
  const n = series?.hr?.length || series?.power?.length || 0;
  const partial = sel && n && (sel[0] > 0 || sel[1] < n - 1);
  const crop = async () => {
    const raw = await getLocalSeries(a.id) || await getSeries(a.id);
    if (!raw) return toast('Verlauf nicht gefunden');
    const mins = (x) => fmtDuration(x * 5);
    if (!confirm(`Auf ${mins(sel[0])}–${mins(sel[1] + 1)} h zuschneiden? Alles außerhalb wird entfernt (auf diesem Gerät rückgängig zu machen).`)) return;
    if (!a.original) await putSeries(`${a.id}:original`, raw);
    const { activity: next, series: cut } = cropActivity({ ...a, ...activity, title: a.title, notes: a.notes, rpe: a.rpe, lactate: a.lactate, sport: a.sport }, raw, sel[0], sel[1], settings);
    await putSeries(a.id, cut);
    await deleteRemoteSeries([a.id]).catch(() => {}); // neu hochladen
    update((d) => ({ ...d, activities: d.activities.map((x) => (x.id === a.id ? next : x)) }));
    toast(`Zugeschnitten · ${fmtDuration(next.durationS)} h`);
    onClose();
  };
  const uncrop = async () => {
    const orig = await getLocalSeries(`${a.id}:original`);
    if (!orig) return toast('Original nur auf dem Gerät gespeichert, auf dem zugeschnitten wurde');
    const back = { ...a.original, title: a.title, notes: a.notes, rpe: a.rpe, lactate: a.lactate, sport: a.sport, original: undefined };
    await putSeries(a.id, orig);
    await deleteRemoteSeries([a.id]).catch(() => {});
    update((d) => ({ ...d, activities: d.activities.map((x) => (x.id === a.id ? back : x)) }));
    toast('Original wiederhergestellt');
    onClose();
  };
  return (
    <Sheet title={a.title || sportLabel(a.sport)} onClose={onClose}>
      <p className="muted">{fmtDate(a.date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} · {new Date(a.start).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} · Quelle: {a.source}</p>
      <div className="stats">
        <div><b>{fmtNum(a.load)}</b><span>Belastung ({{ power: 'Watt', hr: 'Puls', hr_avg: 'Ø Puls', rpe: 'RPE', polar: 'Polar', lucia: 'Zonen' }[a.loadSource] || '–'})</span></div>
        <div><b>{fmtDuration(a.durationS)}</b><span>Dauer</span></div>
        <div><b>{a.distanceM ? fmtNum(a.distanceM / 1000, 1) : '–'}</b><span>km</span></div>
        <div><b>{a.avgHr ?? '–'}/{a.maxHr ?? '–'}</b><span>Ø/max Puls</span></div>
        <div><b>{a.avgPower ?? '–'}{a.np ? `/${a.np}` : ''}</b><span>Ø W{a.np ? '/NP' : ''}</span></div>
        <div><b>{a.trimp ?? '–'}</b><span>TRIMP</span></div>
        {a.intensity != null && <div><b>{fmtNum(a.intensity, 2)}</b><span>IF</span></div>}
        {a.ef != null && <div><b>{fmtNum(a.ef, 2)}</b><span>EF (NP/Puls)</span></div>}
        {a.decoupling != null && <div><b style={{ color: a.decoupling > 5 ? 'var(--bad)' : 'var(--good)' }}>{fmtNum(a.decoupling, 1)} %</b><span>Entkopplung</span></div>}
        {a.kj != null && <div><b>{a.kj}</b><span>kJ</span></div>}
        {a.vi != null && <div><b>{fmtNum(a.vi, 2)}</b><span>VI</span></div>}
        {a.powerCurve?.[1200] && <div><b>{a.powerCurve[1200]}</b><span>beste 20 min W</span></div>}
        {a.pace != null && <div><b>{fmtPace(a.pace)}</b><span>Ø Pace {a.sport === 'bikeerg' ? '/1000 m' : '/500 m'}</span></div>}
        {a.spm != null && <div><b>{a.spm}</b><span>Ø Schläge/min</span></div>}
        {a.elapsedS && a.durationS && a.elapsedS - a.durationS > 120 && <div><b>{fmtDuration(a.elapsedS)}</b><span>Gesamt inkl. Pausen</span></div>}
      </div>
      {a.load == null && (() => { const at = athleteOf(settings, a.sport); const miss = [!at.hrMax && 'Maximalpuls', !at.hrRest && 'Ruhepuls', !at.lthr && 'Schwellenpuls', !at.ftp && 'FTP'].filter(Boolean); return <div className="notice">Für die Belastung fehlen: {miss.join(', ')}. Unter Mehr → Einstellungen → Athlet eintragen, dann rechnet die App alle Einheiten neu.</div>; })()}
      <ZoneBar zones={a.zones} />
      {series && <ActivityChart series={series} sport={a.sport} laps={a.laps?.length ? a.laps : a.autoLaps} onSelect={setSel} />}
      {series && <div className="row" style={{ marginTop: 6 }}>
        <button className="secondary" disabled={!partial} onClick={crop} title="Im Diagramm einen Bereich ziehen oder die Regler verschieben"><Scissors size={16} />{partial ? `Auf Auswahl zuschneiden (${fmtDuration(sel[0] * 5)}–${fmtDuration((sel[1] + 1) * 5)})` : 'Zuschneiden: Bereich im Diagramm wählen'}</button>
        {a.original && <button className="ghost" style={{ flex: 'none' }} onClick={uncrop}><Undo2 size={16} />Original</button>}
      </div>}
      <LapsCard laps={a.laps} autoLaps={a.autoLaps} sport={a.sport} erg={['skierg', 'row'].includes(a.sport) ? 'erg' : a.sport === 'bikeerg' ? 'bike' : null} />
      <div className="grid2">
        <div><label>Datum</label><input type="date" value={when.date} onChange={(e) => setWhen({ ...when, date: e.target.value })} /></div>
        <div><label>Uhrzeit</label><input type="time" value={when.time} onChange={(e) => setWhen({ ...when, time: e.target.value })} /></div>
        {!activity.hasSeries && <>
          <div><label>Dauer (Minuten)</label><input type="number" value={Math.round((a.durationS || 0) / 60)} onChange={(e) => setA({ ...a, durationS: (Number(e.target.value) || 0) * 60 })} /></div>
          <div><label>Distanz (km)</label><input inputMode="decimal" value={a.distanceM ? String(Math.round(a.distanceM / 100) / 10).replace('.', ',') : ''} onChange={(e) => setA({ ...a, distanceM: e.target.value ? Number(e.target.value.replace(',', '.')) * 1000 : null })} /></div>
          <div><label>Ø Puls</label><input type="number" value={a.avgHr ?? ''} onChange={(e) => setA({ ...a, avgHr: e.target.value ? Number(e.target.value) : null })} /></div>
          {a.sport !== 'strength' && <div><label>Hauptzone</label><select value={a.zone || ''} onChange={(e) => setA({ ...a, zone: e.target.value || null })}><option value="">–</option>{ZONES.map((z) => <option key={z.id} value={z.id}>{z.label}</option>)}</select></div>}
        </>}
        <div><label>Titel</label><input value={a.title} onChange={(e) => setA({ ...a, title: e.target.value })} placeholder="z. B. 5×6 min Schwelle" /></div>
        <div><label>Sportart</label><select value={a.sport} onChange={(e) => setA({ ...a, sport: e.target.value })}>{SPORTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select></div>
        <div><label>RPE (1–10)</label><input type="number" min="1" max="10" step="0.5" value={a.rpe ?? ''} onChange={(e) => setA({ ...a, rpe: e.target.value ? Number(e.target.value) : null })} /></div>
        <div><label>Laktat (mmol/l)</label><input value={a.lactate} onChange={(e) => setA({ ...a, lactate: e.target.value })} placeholder="z. B. 2,1 / 2,4 / 2,8" /></div>
      </div>
      {gear.some((g) => !g.retired) && <><label>Material {a.gearIds ? '' : '(automatisch nach Sportart)'}</label><div className="chips">{gear.filter((g) => !g.retired).map((g) => { const on = a.gearIds ? a.gearIds.includes(g.id) : (g.defaultSports || []).includes(a.sport); return <button key={g.id} className={`chip${on ? ' on' : ''}`} onClick={() => { const cur = a.gearIds || gear.filter((x) => (x.defaultSports || []).includes(a.sport)).map((x) => x.id); setA({ ...a, gearIds: on ? cur.filter((x) => x !== g.id) : [...cur, g.id] }); }}>{g.name}</button>; })}</div></>}
      {keySessions.length > 0 && <><label>Key Session</label><select value={a.keySessionId || ''} onChange={(e) => setA({ ...a, keySessionId: e.target.value || null })}><option value="">automatisch (über Stichwörter)</option>{keySessions.map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}</select></>}
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
      <Seg value={mode} onChange={setMode} options={[['manual', 'Eintragen'], ['fit', 'Datei importieren']]} />
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
          <p className="muted">FIT, TCX, GPX, Polar-CSV, Polar-Konto-Export (JSON) oder ein ZIP mit solchen Dateien – z. B. aus Polar Flow, Garmin, Wahoo oder Suunto.</p>
          <label className="primary wide" style={{ cursor: 'pointer' }}><Upload size={18} />{busy ? 'Importiere …' : 'Dateien wählen'}<input type="file" accept=".fit,.tcx,.gpx,.csv,.json,.zip" multiple hidden onChange={upload} /></label>
        </>
      )}
    </Sheet>
  );
}
