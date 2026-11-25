import React, { useMemo, useState } from 'react';
import { RefreshCw, Plus, Moon, Lightbulb, Sun, HeartPulse, Activity as Pulse } from 'lucide-react';
import { useData, update } from '../lib/store.js';
import { BIKE_SWAP, swapPlanItem } from '../lib/weather-swap.js';
import { curve, today, weeks } from '../lib/activities.js';
import { planTargets } from '../lib/targets.js';
import { addDays, rpeLoad } from '../lib/metrics.js';
import { sportLabel, sportEmoji } from '../lib/sports.js';
import { syncAll } from '../lib/sync.js';
import { dayTargets } from '../lib/nutrition.js';
import { tipsFor } from '../lib/food-day.js';
import { FormChart, ZoneBar, LineChart } from './charts.jsx';
import { rolling } from '../lib/analysis.js';
import { fmtDuration, fmtNum, toast } from './common.jsx';
import { MorningSheet, RecoveryCard } from './morning.jsx';
import { readinessFor } from '../lib/readiness.js';
import { RaceCountdown } from './season.jsx';
import { HealthBanner } from './more.jsx';
import { AdaptCard, ThresholdCard, WeekReviewCard } from './week.jsx';

export const FEELS = [['strong', '💪 Stark'], ['normal', '🙂 Normal'], ['weak', '😮‍💨 Schwach']];
// Kleiner Verlauf ohne Achsen für das Cockpit.
function Spark({ values, color = 'currentColor', width = 110, height = 28 }) {
  const v = values.filter((x) => x != null && !isNaN(x));
  if (v.length < 2) return null;
  const lo = Math.min(...v), hi = Math.max(...v), span = hi - lo || 1;
  const pts = values.map((x, i) => (x == null ? null : [(i / (values.length - 1)) * width, height - 2 - ((x - lo) / span) * (height - 4)])).filter(Boolean);
  return <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: 'block' }}><polyline points={pts.map((p) => p.join(',')).join(' ')} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" /></svg>;
}
// Bereitschaft als Ring (Punkte 0–100, Farbe nach Ampel).
const RING = { gruen: ['#7be495', 'Bereit'], gelb: ['#ffd166', 'Vorsicht'], rot: ['#ff8a7a', 'Erholen'] };
function ReadyRing({ score = 0, level = 'gruen', size = 112 }) {
  const r = 44, c = 2 * Math.PI * r, p = Math.max(0, Math.min(100, score)) / 100;
  const [color, label] = RING[level] || RING.gruen;
  return (
    <svg width={size} height={size} viewBox="0 0 110 110" className="ring" role="img" aria-label={`Bereitschaft ${Math.round(score)} von 100`}>
      <circle cx="55" cy="55" r={r} fill="none" stroke="rgba(255,255,255,.14)" strokeWidth="10" />
      <circle cx="55" cy="55" r={r} fill="none" stroke={color} strokeWidth="10" strokeLinecap="round" strokeDasharray={`${c * p} ${c}`} transform="rotate(-90 55 55)" style={{ transition: 'stroke-dasharray .8s ease' }} />
      <text x="55" y="54" textAnchor="middle" fill="#fff" fontSize="28" fontWeight="750">{Math.round(score)}</text>
      <text x="55" y="72" textAnchor="middle" fill={color} fontSize="11.5" fontWeight="700" letterSpacing=".5">{label.toUpperCase()}</text>
    </svg>
  );
}
const avg = (a) => { const v = a.filter((x) => x != null); return v.length ? v.reduce((x, y) => x + y, 0) / v.length : null; };

export function Today({ go, openActivity, openAdd }) {
  const data = useData();
  const { activities, plan, settings, wellness } = data;
  const t = today(settings.timezone);
  const [busy, setBusy] = useState(false);
  const days = useMemo(() => curve(activities, plan, t, 21), [activities, plan, t]);
  const now = days.find((d) => d.day === t);
  const shown = days.filter((d) => d.day >= addDays(t, -90));
  const week = weeks(activities, 1, t)[0];
  const todays = activities.filter((a) => a.date === t);
  const planned = plan.filter((p) => p.date === t && !p.done);
  const [checking, setChecking] = useState(false);
  // Morgen-Check auch für vergangene Tage nachtragen (Standard: heute).
  const [checkDay, setCheckDay] = useState(t);
  const minutes = [...todays.map((a) => (a.durationS || 0) / 60), ...planned.map((p) => p.minutes || 0)].reduce((a, b) => a + b, 0);
  const hard = [...todays.map((a) => ((a.zones?.I3 || 0) + (a.zones?.I4 || 0) + (a.zones?.I5 || 0)) / 60), ...planned.filter((p) => ['I3', 'I4', 'I5'].includes(p.zone)).map((p) => p.minutes || 0)].reduce((a, b) => a + b, 0);
  const longest = Math.max(0, ...todays.filter((a) => a.sport !== 'strength').map((a) => (a.durationS || 0) / 60), ...planned.filter((p) => p.sport !== 'strength').map((p) => p.minutes || 0));
  const food = dayTargets({ weightKg: Number(settings.weightKg), minutes, hardMinutes: hard, strength: [...todays, ...planned].some((x) => x.sport === 'strength'), longestMinutes: longest });
  const lastW = wellness.at(-1);
  const tip = useMemo(() => tipsFor(data, t)[0], [data, t]);
  const connected = Object.keys(data.connections).length > 0 || !!data.settings.tpFeedUrl;
  // Cockpit: HRV-Wochenschnitt gegen die Vorwoche, letzte Nacht, Form der letzten 4 Wochen.
  const wIn = (from, to) => wellness.filter((x) => x.date > addDays(t, -from) && x.date <= addDays(t, -to));
  const hrv7 = avg(wIn(7, 0).map((x) => x.hrv ?? null)), hrvPrev = avg(wIn(14, 7).map((x) => x.hrv ?? null));
  const trend = hrv7 && hrvPrev ? (hrv7 > hrvPrev * 1.03 ? '↗' : hrv7 < hrvPrev * 0.97 ? '↘' : '→') : '';
  const formSpark = days.filter((d) => d.day > addDays(t, -28) && d.day <= t).map((d) => d.form);
  const [swapFor, setSwapFor] = useState(null);
  const [openDesc, setOpenDesc] = useState({});
  // Kopfbereich: Bereitschaft, Trend der Kennzahlen gegenüber vor 7 Tagen, nächstes Rennen, Begrüßung.
  const ready = readinessFor(t, wellness, now?.form ?? null, activities);
  const weekAgo = days.find((d) => d.day === addDays(t, -7));
  const delta = (k) => (now && weekAgo ? now[k] - weekAgo[k] : null);
  const nextRace = (data.races || []).filter((r) => r.date >= t).sort((a, b) => a.date.localeCompare(b.date))[0];
  const raceIn = nextRace ? Math.round((Date.parse(`${nextRace.date}T12:00:00Z`) - Date.parse(`${t}T12:00:00Z`)) / 864e5) : null;
  const hour = new Date().getHours();
  const hello = hour < 11 ? 'Guten Morgen' : hour < 17 ? 'Hallo' : 'Guten Abend';
  const arrow = (v, invert = false) => (v == null || Math.abs(v) < 1 ? '' : (v > 0) !== invert ? '▲' : '▼');
  const changePlan = (p, patch) => update((d) => ({ ...d, plan: d.plan.map((x) => (x.id === p.id ? { ...x, ...patch } : x)) }));
  const markDone = (p) => { changePlan(p, { done: true }); toast('Als erledigt markiert'); };
  const toTomorrow = (p) => { changePlan(p, { date: addDays(p.date, 1) }); toast('Auf morgen verschoben'); };
  // Nach der Einheit: „Wie hart war es?“ (RPE 1–10) für Einheiten von heute und gestern ohne Angabe.
  // Ohne Puls/Watt wird daraus die Belastung berechnet; der KI-Coach bekommt den Wert mit.
  const toRate = activities.filter((a) => a.date >= addDays(t, -1) && a.date <= t && a.sport !== 'strength' && (a.rpe == null || !a.feel) && !a.rpeSkip).slice(-3);
  const setFeel = (a, v) => update((d) => ({ ...d, activities: d.activities.map((x) => (x.id === a.id ? { ...x, feel: v } : x)) }));
  const rate = (a, v) => { update((d) => ({ ...d, activities: d.activities.map((x) => (x.id === a.id ? { ...x, rpe: v, ...(x.load == null ? { load: rpeLoad(x.durationS, v), loadSource: 'rpe' } : {}) } : x)) })); toast(`Gespeichert: ${v}/10`); };
  const skipRate = (a) => update((d) => ({ ...d, activities: d.activities.map((x) => (x.id === a.id ? { ...x, rpeSkip: true } : x)) }));
  const swap = (p, to) => { const n = swapPlanItem(p, to); changePlan(p, n); setSwapFor(null); toast(`Getauscht: ${sportLabel(to)}, ${n.minutes} min`); };

  const sync = async () => {
    setBusy(true);
    try {
      const res = await syncAll();
      const msg = Object.entries(res).map(([p, v]) => (v.error ? `${p}: ${v.error}` : `${p}: ${v.added} neu`)).join(' · ');
      toast(msg || 'Nichts verbunden');
    } finally { setBusy(false); }
  };

  return (
    <>
      <div className="hero hero2">
        <div className="hero-top">
          <div>
            <div className="eyebrow">{new Date().toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' }).toUpperCase()}</div>
            <div className="hello">{hello}</div>
          </div>
          {nextRace && <button className="race-chip" onClick={() => go('training')}>🏁 {String(nextRace.name || 'Rennen').trim()} · {raceIn === 0 ? 'heute' : `${raceIn} T`}</button>}
        </div>
        <div className="hero-main">
          <ReadyRing score={ready.score} level={ready.level} />
          <div className="hero-ready">
            <b>{ready.advice}</b>
            {ready.reasons.length > 0 && <p>{ready.reasons[0]}{ready.reasons.length > 1 ? ` (+${ready.reasons.length - 1})` : ''}</p>}
            {!ready.hasData && <p>Wenig Daten – mach den Morgen-Check für eine genauere Einschätzung.</p>}
            <button className="pill" onClick={() => { setCheckDay(t); setChecking(true); }}><Sun size={14} />{ready.checked ? 'Check ändern' : 'Morgen-Check'}</button>
          </div>
        </div>
        <div className="hero-metrics">
          {[['fitness', 'Fitness', 'fit', false], ['fatigue', 'Ermüdung', 'fat', true], ['form', 'Form', 'form', false]].map(([k, label, cls, inv]) => (
            <div key={k} className={cls}><b>{fmtNum(now?.[k])}</b><span>{label} <em>{arrow(delta(k), inv)}</em></span></div>
          ))}
        </div>
        {(hrv7 || lastW?.restHr || lastW?.sleepH) && <div className="hero-vitals">
          {hrv7 && <span><HeartPulse size={14} /> HRV <b>{Math.round(hrv7)}</b> ms {trend}</span>}
          {lastW?.restHr && <span><Pulse size={14} /> Ruhe <b>{lastW.restHr}</b></span>}
          {lastW?.sleepH && <span><Moon size={14} /> <b>{fmtNum(lastW.sleepH, 1)}</b> h</span>}
          {formSpark.length > 1 && <span className="spark"><Spark values={formSpark} color="#ffd27a" width={70} height={22} /></span>}
        </div>}
        {ready.reasons.length > 1 && <details className="hero-more"><summary className="small">Alle Gründe</summary><ul>{ready.reasons.map((x) => <li key={x}>{x}</li>)}</ul></details>}
        <details className="hero-more">
          <summary className="small">Morgen-Check für einen anderen Tag</summary>
          <div className="row" style={{ gap: 6, marginTop: 6 }}>
            <input type="date" value={checkDay} max={t} onChange={(e) => setCheckDay(e.target.value)} style={{ color: '#1b1f1d', background: '#fff', colorScheme: 'light', flex: 1 }} />
            <button className="secondary" disabled={!checkDay} onClick={() => setChecking(true)}>Öffnen</button>
          </div>
        </details>
        {!activities.length && <p>Noch keine Einheiten. Verbinde Polar, Concept2 oder Wahoo unter „Mehr → Einstellungen“ oder trag eine Einheit ein.</p>}
      </div>

      <HealthBanner go={go} />
      {(planned.length > 0 || todays.length > 0) && <h2>Heute</h2>}
      {planned.map((p) => (
        <div key={p.id} className="item" style={{ borderStyle: 'dashed', flexDirection: 'column', alignItems: 'stretch' }}>
          <div className="row" style={{ flexWrap: 'nowrap', alignItems: 'flex-start' }}>
            <span className="ico-badge">{sportEmoji(p.sport)}</span><div className="grow"><b>{p.title}</b><p>{sportLabel(p.sport)} · {p.minutes} min · {p.zone}</p>{planTargets(p, settings) && <p><b>Ziel:</b> {planTargets(p, settings)}</p>}{p.description && <p className={openDesc[p.id] ? '' : 'clamp3'} onClick={() => setOpenDesc({ ...openDesc, [p.id]: !openDesc[p.id] })}>{p.description}</p>}{p.description?.length > 140 && <button className="link-btn" onClick={() => setOpenDesc({ ...openDesc, [p.id]: !openDesc[p.id] })}>{openDesc[p.id] ? 'weniger' : 'mehr anzeigen'}</button>}</div>
            <span className="badge b-info" style={{ flex: 'none' }}>geplant</span>
          </div>
          <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
            <button className="secondary" onClick={() => markDone(p)}>Erledigt</button>
            <button className="ghost" onClick={() => toTomorrow(p)}>Morgen</button>
            {p.sport === 'bike' && <button className="ghost" onClick={() => setSwapFor(swapFor === p.id ? null : p.id)}>Wetter: tauschen</button>}
          </div>
          {swapFor === p.id && <div className="chips" style={{ marginTop: 6 }}>{BIKE_SWAP.map(([to, label]) => <button key={to} className="chip" onClick={() => swap(p, to)}>{label}</button>)}</div>}
        </div>
      ))}
      {todays.map((a) => (
        <button key={a.id} className="item" onClick={() => openActivity(a)}>
          <span className="ico-badge">{sportEmoji(a.sport)}</span><div className="grow"><b>{a.title || sportLabel(a.sport)}</b><p>{fmtDuration(a.durationS)} h{a.avgHr ? ` · Ø ${a.avgHr} bpm` : ''}</p><ZoneBar zones={a.zones} /></div>
          <span className="num">{fmtNum(a.load)}</span>
        </button>
      ))}

      {toRate.map((a) => (
        <div key={a.id} className="card" style={{ padding: 14 }}>
          <div className="row" style={{ flexWrap: 'nowrap' }}><b className="grow">Wie war die Einheit? <span className="muted small">{a.title || sportLabel(a.sport)} · {fmtDuration(a.durationS)} h{a.date !== t ? ' · gestern' : ''}</span></b><button className="ghost" style={{ flex: 'none' }} onClick={() => skipRate(a)}>Überspringen</button></div>
          <div className="chips" style={{ flexWrap: 'nowrap', overflowX: 'auto' }}>{[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((v) => <button key={v} className={`chip${a.rpe === v ? ' on' : ''}`} style={{ flex: 'none', minWidth: 38 }} onClick={() => rate(a, v)}>{v}</button>)}</div>
          <div className="chips">{FEELS.map(([k, label]) => <button key={k} className={`chip${a.feel === k ? ' on' : ''}`} onClick={() => setFeel(a, k)}>{label}</button>)}</div>
          <p className="muted small" style={{ margin: 0 }}>1 sehr leicht · 4 locker · 6 Schwelle · 8 hart · 10 maximal</p>
        </div>
      ))}
      <RaceCountdown go={go} />
      <AdaptCard />
      <WeekReviewCard />
      <div className="row">
        {connected && <button className="secondary" onClick={sync} disabled={busy}><RefreshCw size={17} className={busy ? 'spin' : ''} />Abgleichen</button>}
        <button className="primary" onClick={openAdd}><Plus size={18} />Einheit</button>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Fitness, Ermüdung, Form</h3>
        <FormChart days={shown} />
      </div>
      <RecoveryCard t={t} />
      {wellness.some((w) => w.hrv || w.sleepH) && (() => {
        const w = wellness.filter((x) => x.date >= addDays(t, -60));
        const fByDay = Object.fromEntries(days.map((d) => [d.day, d.form]));
        return (
          <div className="card">
            <h3 style={{ marginTop: 0 }}>HRV, Schlaf und Form (60 Tage)</h3>
            <LineChart labels={w.map((x) => x.date)} xFormat={(d) => `${+d.slice(8)}.${+d.slice(5, 7)}.`} series={[
              { label: 'HRV 7-Tage-Schnitt (ms)', values: rolling(w.map((x) => x.hrv ?? null), 7), color: 'var(--z2)' },
              { label: 'Ruhepuls (bpm)', values: w.map((x) => x.restHr ?? null), color: 'var(--fat)', dashed: true },
              { label: 'Form', values: w.map((x) => fByDay[x.date] ?? null), color: 'var(--form)', signed: true },
            ]} />
            {w.some((x) => x.sleepH) && <LineChart height={140} labels={w.map((x) => x.date)} xFormat={(d) => `${+d.slice(8)}.${+d.slice(5, 7)}.`} series={[{ label: 'Schlaf (h)', values: w.map((x) => x.sleepH ?? null), color: 'var(--fit)', dots: true }]} />}
          </div>
        );
      })()}

      <div className="stats">
        <div><b>{fmtDuration(week.hours * 3600)}</b><span>Stunden diese Woche</span></div>
        <div><b>{fmtNum(week.load)}</b><span>Belastung</span></div>
        <div><b>{week.strengthSessions}/{week.thresholdSessions}</b><span>Kraft / Schwelle</span></div>
      </div>

      {food && (
        <div>
          {food && (
            <button className="card" style={{ textAlign: 'left' }} onClick={() => go('food')}>
              <h3 style={{ marginTop: 0 }}>Essen heute</h3>
              <p style={{ margin: '4px 0' }}><b>{food.kcal}</b> kcal · Bedarf {food.level}</p>
              <p className="muted small" style={{ margin: 0 }}>KH {food.carbs} g · Eiweiß {food.protein} g · Fett {food.fat} g</p>
            </button>
          )}
        </div>
      )}
      <ThresholdCard compact />
      {tip && (
        <button className="card" style={{ textAlign: 'left', display: 'block', width: '100%' }} onClick={() => go('food')}>
          <h3 style={{ marginTop: 0 }}><Lightbulb size={16} /> Ernährungstipp: {tip.title}</h3>
          <p className="small" style={{ margin: 0 }}>{tip.text}</p>
        </button>
      )}
      {!settings.hrMax && <div className="notice">Trag unter „Mehr → Einstellungen → Athlet“ Maximalpuls, Ruhepuls und Schwellenpuls ein (und FTP, falls du mit Watt trainierst), sonst kann keine Belastung berechnet werden.</div>}
      {checking && <MorningSheet date={checkDay || t} onClose={() => setChecking(false)} />}
    </>
  );
}
