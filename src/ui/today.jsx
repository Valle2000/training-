import React, { useMemo, useState } from 'react';
import { RefreshCw, Plus, HeartPulse, Moon, Lightbulb } from 'lucide-react';
import { useData } from '../lib/store.js';
import { curve, today, weeks } from '../lib/activities.js';
import { addDays } from '../lib/metrics.js';
import { sportLabel } from '../lib/sports.js';
import { syncAll } from '../lib/sync.js';
import { dayTargets } from '../lib/nutrition.js';
import { tipsFor } from '../lib/food-day.js';
import { FormChart, ZoneBar, LineChart } from './charts.jsx';
import { rolling } from '../lib/analysis.js';
import { fmtDuration, fmtNum, toast } from './common.jsx';
import { ReadinessCard, MorningSheet } from './morning.jsx';
import { RaceCountdown } from './season.jsx';
import { HealthBanner } from './more.jsx';

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
  const minutes = [...todays.map((a) => (a.durationS || 0) / 60), ...planned.map((p) => p.minutes || 0)].reduce((a, b) => a + b, 0);
  const hard = [...todays.map((a) => ((a.zones?.I3 || 0) + (a.zones?.I4 || 0) + (a.zones?.I5 || 0)) / 60), ...planned.filter((p) => ['I3', 'I4', 'I5'].includes(p.zone)).map((p) => p.minutes || 0)].reduce((a, b) => a + b, 0);
  const longest = Math.max(0, ...todays.filter((a) => a.sport !== 'strength').map((a) => (a.durationS || 0) / 60), ...planned.filter((p) => p.sport !== 'strength').map((p) => p.minutes || 0));
  const food = dayTargets({ weightKg: Number(settings.weightKg), minutes, hardMinutes: hard, strength: [...todays, ...planned].some((x) => x.sport === 'strength'), longestMinutes: longest });
  const lastW = wellness.at(-1);
  const tip = useMemo(() => tipsFor(data, t)[0], [data, t]);
  const connected = Object.keys(data.connections).length > 0;

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
      <div className="hero">
        <div className="eyebrow">{new Date().toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' }).toUpperCase()}</div>
        <div className="stats">
          <div className="fit"><b>{fmtNum(now?.fitness)}</b><span>Fitness</span></div>
          <div className="fat"><b>{fmtNum(now?.fatigue)}</b><span>Ermüdung</span></div>
          <div className="form"><b>{fmtNum(now?.form)}</b><span>Form</span></div>
        </div>
        <ReadinessCard date={t} form={now?.form ?? null} onCheck={() => setChecking(true)} />
        {!activities.length && <p>Noch keine Einheiten. Verbinde Polar, Concept2 oder Wahoo unter „Mehr → Einstellungen“ oder trag eine Einheit ein.</p>}
      </div>

      <HealthBanner go={go} />
      <RaceCountdown go={go} />
      <div className="row">
        {connected && <button className="secondary" onClick={sync} disabled={busy}><RefreshCw size={17} className={busy ? 'spin' : ''} />Abgleichen</button>}
        <button className="primary" onClick={openAdd}><Plus size={18} />Einheit</button>
      </div>

      {(planned.length > 0 || todays.length > 0) && <h2>Heute</h2>}
      {planned.map((p) => (
        <div key={p.id} className="item" style={{ borderStyle: 'dashed' }}>
          <div className="grow"><b>{p.title}</b><p>{sportLabel(p.sport)} · {p.minutes} min · {p.zone}</p>{p.description && <p>{p.description}</p>}</div>
          <span className="badge b-info">geplant</span>
        </div>
      ))}
      {todays.map((a) => (
        <button key={a.id} className="item" onClick={() => openActivity(a)}>
          <div className="grow"><b>{a.title || sportLabel(a.sport)}</b><p>{fmtDuration(a.durationS)} h{a.avgHr ? ` · Ø ${a.avgHr} bpm` : ''}</p><ZoneBar zones={a.zones} /></div>
          <span className="num">{fmtNum(a.load)}</span>
        </button>
      ))}

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Fitness, Ermüdung, Form</h3>
        <FormChart days={shown} />
      </div>
      {wellness.some((w) => w.hrv || w.sleepH) && (() => {
        const w = wellness.filter((x) => x.date >= addDays(t, -60));
        const fByDay = Object.fromEntries(days.map((d) => [d.day, d.form]));
        return (
          <div className="card">
            <h3 style={{ marginTop: 0 }}>HRV, Schlaf und Form (60 Tage)</h3>
            <LineChart labels={w.map((x) => x.date)} xFormat={(d) => `${+d.slice(8)}.${+d.slice(5, 7)}.`} series={[
              { label: 'HRV 7-Tage-Schnitt (ms)', values: rolling(w.map((x) => x.hrv ?? null), 7), color: 'var(--z2)' },
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

      {(lastW || food) && (
        <div className="grid2">
          {lastW && (
            <div className="card">
              <h3 style={{ marginTop: 0 }}><HeartPulse size={16} /> Erholung</h3>
              <p className="muted small" style={{ margin: 0 }}>{new Date(lastW.date + 'T12:00:00').toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short' })}</p>
              {lastW.hrv && <p style={{ margin: '4px 0' }}>HRV <b>{lastW.hrv} ms</b></p>}
              {lastW.restHr && <p style={{ margin: '4px 0' }}>Ruhepuls <b>{lastW.restHr}</b></p>}
              {lastW.sleepH && <p style={{ margin: '4px 0' }}><Moon size={14} /> {fmtNum(lastW.sleepH, 1)} h{lastW.sleepScore ? ` · Score ${lastW.sleepScore}` : ''}</p>}
            </div>
          )}
          {food && (
            <button className="card" style={{ textAlign: 'left' }} onClick={() => go('food')}>
              <h3 style={{ marginTop: 0 }}>Essen heute</h3>
              <p style={{ margin: '4px 0' }}><b>{food.kcal}</b> kcal · Bedarf {food.level}</p>
              <p className="muted small" style={{ margin: 0 }}>KH {food.carbs} g · Eiweiß {food.protein} g · Fett {food.fat} g</p>
            </button>
          )}
        </div>
      )}
      {tip && (
        <button className="card" style={{ textAlign: 'left', display: 'block', width: '100%' }} onClick={() => go('food')}>
          <h3 style={{ marginTop: 0 }}><Lightbulb size={16} /> Ernährungstipp: {tip.title}</h3>
          <p className="small" style={{ margin: 0 }}>{tip.text}</p>
        </button>
      )}
      {!settings.hrMax && <div className="notice">Trag unter „Mehr → Einstellungen → Athlet“ Maximalpuls, Ruhepuls und Schwellenpuls ein (und FTP, falls du mit Watt trainierst), sonst kann keine Belastung berechnet werden.</div>}
      {checking && <MorningSheet date={t} onClose={() => setChecking(false)} />}
    </>
  );
}
