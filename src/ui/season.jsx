import React, { useMemo, useState } from 'react';
import { Plus, Trash2, Trophy, Flag } from 'lucide-react';
import { useData, update, uid } from '../lib/store.js';
import { today, weeks as weekStats, mondayOf, dailyLoads } from '../lib/activities.js';
import { addDays, performanceCurve } from '../lib/metrics.js';
import { PHASES, seasonPlan, seasonStart, gapPct, parseTime, fmtTime } from '../lib/season.js';
import { SeasonChart, LineChart } from './charts.jsx';
import { Sheet, fmtDate, fmtNum, toast } from './common.jsx';

const PRIORITY = { A: 'Saisonhöhepunkt', B: 'wichtig', C: 'Trainingsrennen' };
const TECHNIQUE = ['Skating', 'Klassisch', 'Skiathlon', 'Rollski', 'Lauf', 'Rad', 'Sonstiges'];

export const nextRace = (races, t) => [...races].filter((r) => r.date >= t).sort((a, b) => a.date.localeCompare(b.date))[0];

// Form am Renntag: echte Daten bis heute, danach geplante Einheiten bzw. Wochenziele (≈ 60 Belastung pro Stunde).
function projectedForm(activities, plan, weeksPlan, t, raceDate) {
  const loads = dailyLoads(activities);
  const first = Object.keys(loads).sort()[0];
  if (!first || raceDate <= t) return null;
  const planned = {};
  for (const p of plan) if (p.date > t && !p.done) planned[p.date] = (planned[p.date] || 0) + (p.load || 0);
  for (let d = addDays(t, 1); d <= raceDate; d = addDays(d, 1)) {
    if (planned[d] != null) continue;
    const w = weeksPlan.find((x) => x.from <= d && x.to >= d);
    if (w) planned[d] = (w.targetHours * 60) / 7;
  }
  return performanceCurve(loads, first, raceDate, { planned, today: t }).at(-1);
}

export function Season() {
  const { races, activities, plan, settings } = useData();
  const t = today(settings.timezone);
  const s = settings.season || {};
  const recent = weekStats(activities, 8, t).slice(0, 7);
  const avg = recent.reduce((a, w) => a + w.hours, 0) / (recent.length || 1);
  const baseHours = Number(s.baseHours) || Math.round(avg) || 10;
  const peakHours = Number(s.peakHours) || Math.round(baseHours * 1.25) || 14;
  const start = s.start || seasonStart(t), end = s.end || addDays(addDays(start, 365), -1);
  const wk = useMemo(() => seasonPlan(races, { start, end, baseHours, peakHours }).map((w) => ({ ...w, color: PHASES[w.phase].color })), [races, start, end, baseHours, peakHours]);
  const actual = useMemo(() => { const out = {}; for (const a of activities) { const m = mondayOf(a.date); out[m] = (out[m] || 0) + (a.durationS || 0) / 3600; } return out; }, [activities]);
  const cur = wk.find((w) => t >= w.from && t <= w.to);
  const nr = nextRace(races.filter((r) => r.priority === 'A'), t) || nextRace(races, t);
  const proj = nr ? projectedForm(activities, plan, wk, t, nr.date) : null;
  const setS = (k, v) => update((d) => ({ ...d, settings: { ...d.settings, season: { ...(d.settings.season || {}), [k]: v } } }));
  const total = wk.reduce((a, w) => a + w.targetHours, 0), done = wk.filter((w) => w.to < t).reduce((a, w) => a + (actual[w.from] || 0), 0);
  return (
    <>
      {nr && <div className="card" style={{ borderColor: 'var(--accent)' }}>
        <div className="row" style={{ justifyContent: 'space-between' }}><b style={{ flex: 'none' }}><Flag size={16} /> {nr.name}</b><span className="badge b-info" style={{ flex: 'none' }}>{nr.priority}-Rennen</span></div>
        <p style={{ margin: '6px 0' }}>{fmtDate(nr.date, { weekday: 'long', day: 'numeric', month: 'long' })} · noch {Math.round((Date.parse(nr.date) - Date.parse(t)) / 864e5)} Tage</p>
        {proj && <p className="muted small" style={{ margin: 0 }}>Prognose am Renntag: Fitness {fmtNum(proj.fitness)}, Form <b style={{ color: proj.form > 0 ? 'var(--good)' : 'var(--warn)' }}>{proj.form > 0 ? '+' : ''}{fmtNum(proj.form)}</b> – {proj.form > 0 ? 'frisch, passt' : 'noch ermüdet, Tapering prüfen'} (aus deinem Plan und den Wochenzielen).</p>}
      </div>}
      {cur && <div className="stats">
        <div><b style={{ color: PHASES[cur.phase].color === '#a8b8c0' ? 'var(--ink)' : undefined }}>{PHASES[cur.phase].label}</b><span>Phase diese Woche</span></div>
        <div><b>{fmtNum(actual[cur.from] || 0, 1)}/{fmtNum(cur.targetHours, 1)}</b><span>Stunden Ist/Ziel</span></div>
        <div><b>{fmtNum(done)}/{fmtNum(total)}</b><span>Saisonstunden</span></div>
      </div>}
      <div className="card">
        <h3 style={{ marginTop: 0 }}>Saison {start.slice(0, 4)}/{end.slice(2, 4)}</h3>
        <SeasonChart weeks={wk} actual={actual} today={t} />
        <div className="legend">{Object.entries(PHASES).map(([k, p]) => <span key={k}><i style={{ background: p.color }} />{p.label}</span>)}<span><i style={{ background: 'var(--ink)' }} />Ist</span></div>
        {!races.some((r) => r.priority === 'A') && <p className="notice">Trag unter „Rennen“ deine Saisonhöhepunkte als A-Rennen ein – die Phasen werden rückwärts davon geplant (Tapering 2 Wochen, Wettkampfvorbereitung 8 Wochen, Aufbau davor).</p>}
      </div>
      <details className="card">
        <summary><b>Saisonrahmen</b> <span className="muted small">{baseHours} → {peakHours} h/Woche</span></summary>
        <div className="grid2">
          <div><label>Start-Stunden/Woche</label><input type="number" value={s.baseHours ?? ''} placeholder={String(baseHours)} onChange={(e) => setS('baseHours', e.target.value)} /></div>
          <div><label>Spitze Stunden/Woche</label><input type="number" value={s.peakHours ?? ''} placeholder={String(peakHours)} onChange={(e) => setS('peakHours', e.target.value)} /></div>
          <div><label>Saisonstart</label><input type="date" value={start} onChange={(e) => setS('start', e.target.value)} /></div>
          <div><label>Saisonende</label><input type="date" value={end} onChange={(e) => setS('end', e.target.value)} /></div>
        </div>
        <p className="muted small">3:1-Rhythmus (drei aufbauende Wochen, eine Entlastungswoche mit ~65 %), Tapering nach Bosquet et al. 2007: 2 Wochen, Umfang −41–60 %, Intensität halten. Startwert vorgeschlagen aus deinem Schnitt der letzten 7 Wochen ({fmtNum(avg, 1)} h).</p>
      </details>
      <div className="card">
        <h3 style={{ marginTop: 0 }}>Kommende Wochen</h3>
        <div style={{ overflowX: 'auto' }}><table className="t nowrap"><thead><tr><th>Woche</th><th>Phase</th><th>Ziel</th><th>Ist</th><th>Rennen</th></tr></thead>
          <tbody>{wk.filter((w) => w.to >= addDays(t, -14)).slice(0, 12).map((w) => <tr key={w.from} style={{ fontWeight: t >= w.from && t <= w.to ? 700 : 400 }}>
            <td>{fmtDate(w.from, { day: 'numeric', month: 'short' })}</td><td><i style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 3, background: w.color, marginRight: 6 }} />{PHASES[w.phase].label}</td>
            <td>{fmtNum(w.targetHours, 1)} h</td><td>{w.from <= t ? `${fmtNum(actual[w.from] || 0, 1)} h` : ''}</td><td>{w.races.map((r) => `${r.priority}: ${r.name}`).join(', ')}</td>
          </tr>)}</tbody></table></div>
      </div>
    </>
  );
}

export function Races({ openActivity }) {
  const { races, activities, settings } = useData();
  const t = today(settings.timezone);
  const [edit, setEdit] = useState(null);
  const upcoming = races.filter((r) => r.date >= t).sort((a, b) => a.date.localeCompare(b.date));
  const past = races.filter((r) => r.date < t).sort((a, b) => b.date.localeCompare(a.date));
  const withGap = [...past].reverse().filter((r) => r.result?.gapPct != null);
  return (
    <>
      <button className="primary wide" style={{ marginTop: 12 }} onClick={() => setEdit({ id: uid(), date: t, name: '', priority: 'B', technique: 'Skating', distanceKm: '', goal: '', notes: '' })}><Plus size={17} />Rennen eintragen</button>
      <h2>Kommende Rennen</h2>
      {!upcoming.length && <p className="muted">Noch keine Rennen geplant.</p>}
      {upcoming.map((r) => <button key={r.id} className="item" onClick={() => setEdit(r)}><div className="grow"><b>{r.name}</b><p>{fmtDate(r.date)} · {r.technique}{r.distanceKm ? ` · ${r.distanceKm} km` : ''}{r.goal ? ` · Ziel: ${r.goal}` : ''}</p></div><span className={`badge ${r.priority === 'A' ? 'b-kritisch' : r.priority === 'B' ? 'b-achtung' : 'b-info'}`}>{r.priority} · {PRIORITY[r.priority]}</span></button>)}
      <h2>Ergebnisse</h2>
      {withGap.length > 1 && <div className="card"><LineChart labels={withGap.map((r) => r.date)} xFormat={(d) => fmtDate(d, { day: 'numeric', month: 'numeric' })} series={[{ label: 'Rückstand auf Sieger (%)', values: withGap.map((r) => r.result.gapPct), color: 'var(--fat)', dots: true }]} /><p className="muted small">Weniger Rückstand = besser. Distanz und Technik beim Vergleich beachten.</p></div>}
      {!past.length && <p className="muted">Nach dem Rennen hier Zeit, Platz und Siegerzeit eintragen – die App berechnet den Rückstand in % und verknüpft die Einheit.</p>}
      {past.map((r) => <button key={r.id} className="item" onClick={() => setEdit(r)}><div className="grow"><b><Trophy size={14} /> {r.name}</b><p>{fmtDate(r.date)} · {r.technique}{r.distanceKm ? ` · ${r.distanceKm} km` : ''}{r.result?.place ? ` · Platz ${r.result.place}${r.result.fieldSize ? '/' + r.result.fieldSize : ''}` : ''}{r.result?.timeS ? ` · ${fmtTime(r.result.timeS)}` : ''}</p></div>{r.result?.gapPct != null && <span className="num">+{fmtNum(r.result.gapPct, 1)} %</span>}</button>)}
      {edit && <RaceEditor race={edit} activities={activities} onClose={() => setEdit(null)} openActivity={openActivity} t={t} />}
    </>
  );
}

function RaceEditor({ race, activities, onClose, openActivity, t }) {
  const [r, setR] = useState({ result: {}, ...race });
  const [timeStr, setTimeStr] = useState(r.result?.timeS ? fmtTime(r.result.timeS) : '');
  const [winStr, setWinStr] = useState(r.result?.winnerS ? fmtTime(r.result.winnerS) : '');
  const set = (k) => (e) => setR({ ...r, [k]: e.target.value });
  const setRes = (k, v) => setR({ ...r, result: { ...r.result, [k]: v } });
  const sameDay = activities.filter((a) => a.date === r.date);
  const save = () => {
    if (!r.name.trim()) return toast('Name fehlt');
    const timeS = parseTime(timeStr), winnerS = parseTime(winStr);
    const next = { ...r, result: { ...r.result, timeS, winnerS, gapPct: gapPct(timeS, winnerS) } };
    update((d) => ({ ...d, races: [...d.races.filter((x) => x.id !== next.id), next] }));
    onClose();
  };
  const remove = () => { update((d) => ({ ...d, races: d.races.filter((x) => x.id !== r.id) })); onClose(); };
  return (
    <Sheet title={race.name ? race.name : 'Rennen'} onClose={onClose}>
      <label>Name</label><input value={r.name} onChange={set('name')} placeholder="z. B. Engadin Skimarathon" />
      <div className="grid3">
        <div><label>Datum</label><input type="date" value={r.date} onChange={set('date')} /></div>
        <div><label>Priorität</label><select value={r.priority} onChange={set('priority')}>{Object.entries(PRIORITY).map(([k, v]) => <option key={k} value={k}>{k} – {v}</option>)}</select></div>
        <div><label>Technik</label><select value={r.technique} onChange={set('technique')}>{TECHNIQUE.map((x) => <option key={x}>{x}</option>)}</select></div>
        <div><label>Distanz (km)</label><input inputMode="decimal" value={r.distanceKm} onChange={set('distanceKm')} /></div>
      </div>
      <label>Ziel</label><input value={r.goal} onChange={set('goal')} placeholder="z. B. unter 2:00 h, Top 50" />
      {r.date <= t && <>
        <h3>Ergebnis</h3>
        <div className="grid2">
          <div><label>Deine Zeit (h:mm:ss)</label><input value={timeStr} onChange={(e) => setTimeStr(e.target.value)} placeholder="1:58:30" /></div>
          <div><label>Siegerzeit</label><input value={winStr} onChange={(e) => setWinStr(e.target.value)} placeholder="1:42:10" /></div>
          <div><label>Platz</label><input inputMode="numeric" value={r.result.place ?? ''} onChange={(e) => setRes('place', e.target.value)} /></div>
          <div><label>Starter</label><input inputMode="numeric" value={r.result.fieldSize ?? ''} onChange={(e) => setRes('fieldSize', e.target.value)} /></div>
        </div>
        {parseTime(timeStr) && parseTime(winStr) && <p className="muted small">Rückstand: +{fmtNum(gapPct(parseTime(timeStr), parseTime(winStr)), 1)} %</p>}
        <label>Gefühl / Ski / Verlauf</label><textarea value={r.result.feeling ?? ''} onChange={(e) => setRes('feeling', e.target.value)} />
        {sameDay.length > 0 && <><label>Einheit verknüpfen</label><select value={r.result.activityId ?? ''} onChange={(e) => setRes('activityId', e.target.value || null)}><option value="">–</option>{sameDay.map((a) => <option key={a.id} value={a.id}>{a.title || a.sport} · {Math.round(a.durationS / 60)} min</option>)}</select></>}
        {r.result.activityId && <button className="ghost" onClick={() => openActivity(activities.find((a) => a.id === r.result.activityId))}>Einheit öffnen</button>}
      </>}
      <label>Notizen</label><textarea value={r.notes} onChange={set('notes')} />
      <div className="row" style={{ marginTop: 12 }}>
        <button className="primary" onClick={save}>Speichern</button>
        {race.name && <button className="danger" onClick={remove}><Trash2 size={17} />Löschen</button>}
      </div>
    </Sheet>
  );
}

// Für „Heute“: Countdown zum nächsten Rennen.
export function RaceCountdown({ go }) {
  const { races, settings } = useData();
  const t = today(settings.timezone);
  const nr = nextRace(races, t);
  if (!nr) return null;
  const days = Math.round((Date.parse(nr.date) - Date.parse(t)) / 864e5);
  return <button className="item" onClick={() => go('training')}><div className="grow"><b><Flag size={14} /> {nr.name}</b><p>{fmtDate(nr.date)} · {nr.priority}-Rennen · {nr.technique}</p></div><span className="num">{days === 0 ? 'heute' : `${days} T`}</span></button>;
}

