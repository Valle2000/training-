import React, { useMemo, useState } from 'react';
import { RefreshCw, Plus, HeartPulse, Moon } from 'lucide-react';
import { useData } from '../lib/store.js';
import { curve, today, weeks } from '../lib/activities.js';
import { addDays } from '../lib/metrics.js';
import { sportLabel } from '../lib/sports.js';
import { syncAll } from '../lib/sync.js';
import { dayTargets } from '../lib/nutrition.js';
import { FormChart, ZoneBar } from './charts.jsx';
import { fmtDuration, fmtNum, toast } from './common.jsx';

// Einschätzung aus Form und Erholungswerten (keine Diagnose, nur Orientierung).
export function readiness(form, wellness) {
  const last = wellness.at(-1);
  const prev = wellness.slice(-8, -1).filter((w) => w.hrv);
  const hrvBase = prev.length >= 3 ? prev.reduce((a, w) => a + w.hrv, 0) / prev.length : null;
  const hrvDrop = last?.hrv && hrvBase ? (last.hrv - hrvBase) / hrvBase : 0;
  if (form < -30 || hrvDrop < -0.15) return { level: 'kritisch', text: 'Hohe Ermüdung – heute locker oder Ruhetag.' };
  if (form < -15 || hrvDrop < -0.08) return { level: 'achtung', text: 'Belastung hoch – harte Einheiten nur, wenn du dich gut fühlst.' };
  if (form > 15) return { level: 'gut', text: 'Frisch – guter Tag für Qualität oder Wettkampf.' };
  return { level: 'info', text: 'Normale Trainingsbelastung.' };
}

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
  const r = now ? readiness(now.form, wellness) : null;
  const minutes = [...todays.map((a) => (a.durationS || 0) / 60), ...planned.map((p) => p.minutes || 0)].reduce((a, b) => a + b, 0);
  const hard = [...todays.map((a) => ((a.zones?.I3 || 0) + (a.zones?.I4 || 0) + (a.zones?.I5 || 0)) / 60), ...planned.filter((p) => ['I3', 'I4', 'I5'].includes(p.zone)).map((p) => p.minutes || 0)].reduce((a, b) => a + b, 0);
  const longest = Math.max(0, ...todays.filter((a) => a.sport !== 'strength').map((a) => (a.durationS || 0) / 60), ...planned.filter((p) => p.sport !== 'strength').map((p) => p.minutes || 0));
  const food = dayTargets({ weightKg: Number(settings.weightKg), minutes, hardMinutes: hard, strength: [...todays, ...planned].some((x) => x.sport === 'strength'), longestMinutes: longest });
  const lastW = wellness.at(-1);
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
        {r && <p><span className={`badge b-${r.level}`}>{r.level === 'info' ? 'normal' : r.level}</span> {r.text}</p>}
        {!activities.length && <p>Noch keine Einheiten. Verbinde Polar, Concept2 oder Wahoo unter „Mehr“ oder trag eine Einheit ein.</p>}
      </div>

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
              <p className="muted small" style={{ margin: 0 }}>{lastW.date}</p>
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
      {!settings.hrMax && <div className="notice">Trag unter „Mehr → Athlet“ Maximalpuls, Ruhepuls und Schwellenpuls ein (und FTP, falls du mit Watt trainierst), sonst kann keine Belastung berechnet werden.</div>}
    </>
  );
}
