// Schlanke SVG-Diagramme ohne Bibliothek (funktionieren offline in der App).
import React, { useState } from 'react';
import { ZONES } from '../lib/metrics.js';

const W = 680;
const fmtDay = (iso) => `${+iso.slice(8, 10)}.${+iso.slice(5, 7)}.`;
const niceMax = (v) => { if (v <= 0) return 10; const p = 10 ** Math.floor(Math.log10(v)); return Math.ceil(v / p) * p; };
export const ZONE_COLORS = { I1: 'var(--z1)', I2: 'var(--z2)', I3: 'var(--z3)', I4: 'var(--z4)', I5: 'var(--z5)' };

function path(points) {
  let d = '', pen = false;
  for (const p of points) {
    if (p == null) { pen = false; continue; }
    d += `${pen ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`;
    pen = true;
  }
  return d;
}

// Fitness, Ermüdung, Form mit Tagesbelastung als Balken; Zukunft gestrichelt.
export function FormChart({ days, height = 240 }) {
  const [hover, setHover] = useState(null);
  if (!days.length) return <p className="muted">Noch keine Daten.</p>;
  const H = height, L = 34, R = 34, T = 10, B = 22, iw = W - L - R, ih = H - T - B;
  const n = days.length, x = (i) => L + (n === 1 ? iw / 2 : (i / (n - 1)) * iw);
  const yMax = niceMax(Math.max(...days.map((d) => Math.max(d.fitness, d.fatigue))));
  const fMin = Math.min(-10, ...days.map((d) => d.form)), fMax = Math.max(10, ...days.map((d) => d.form));
  const fAbs = niceMax(Math.max(-fMin, fMax));
  const y = (v) => T + ih - (v / yMax) * ih, yf = (v) => T + ih / 2 - (v / fAbs) * (ih / 2);
  const lMax = Math.max(...days.map((d) => d.load), 1) * 2.5;
  const bw = Math.max(1, iw / n - 1);
  // Vergangenheit durchgezogen, Zukunft gestrichelt; die Prognose beginnt am letzten echten Tag.
  const line = (key, scale, future) => path(days.map((d, i) => ((future ? d.future || days[i + 1]?.future : !d.future) ? [x(i), scale(d[key])] : null)));
  const ticks = Array.from({ length: 6 }, (_, k) => Math.round((k * (n - 1)) / 5));
  const h = hover != null ? days[hover] : null;
  return (
    <div>
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} onMouseLeave={() => setHover(null)}
        onPointerMove={(e) => { const r = e.currentTarget.getBoundingClientRect(); const i = Math.round((((e.clientX - r.left) / r.width) * W - L) / iw * (n - 1)); setHover(Math.max(0, Math.min(n - 1, i))); }}>
        {[0, 0.5, 1].map((f) => <line key={f} className="grid" x1={L} x2={W - R} y1={T + ih * f} y2={T + ih * f} />)}
        <text x={L - 4} y={T + 8} textAnchor="end">{yMax}</text><text x={L - 4} y={T + ih} textAnchor="end">0</text>
        <text x={W - R + 4} y={T + 8}>{`+${fAbs}`}</text><text x={W - R + 4} y={T + ih / 2 + 3}>0</text><text x={W - R + 4} y={T + ih}>{`−${fAbs}`}</text>
        {days.map((d, i) => d.load > 0 && <rect key={i} x={x(i) - bw / 2} y={T + ih - (d.load / lMax) * ih} width={bw} height={(d.load / lMax) * ih} fill="var(--load)" opacity={d.future ? 0.45 : 0.8} />)}
        {[['fitness', y, 'var(--fit)'], ['fatigue', y, 'var(--fat)'], ['form', yf, 'var(--form)']].map(([k, s, c]) => (
          <g key={k}><path d={line(k, s, false)} fill="none" stroke={c} strokeWidth="2" /><path d={line(k, s, true)} fill="none" stroke={c} strokeWidth="2" strokeDasharray="5 4" /></g>
        ))}
        {ticks.map((i) => <text key={i} x={x(i)} y={H - 6} textAnchor="middle">{fmtDay(days[i].day)}</text>)}
        {h && <line x1={x(hover)} x2={x(hover)} y1={T} y2={T + ih} stroke="var(--muted)" strokeDasharray="2 3" />}
      </svg>
      <div className="legend">
        {h ? <span><b>{fmtDay(h.day)}</b> Fitness {h.fitness.toFixed(0)} · Ermüdung {h.fatigue.toFixed(0)} · Form {h.form.toFixed(0)} · Belastung {h.load.toFixed(0)}{h.future ? ' (Plan)' : ''}</span> : <>
          <span><i style={{ background: 'var(--fit)' }} />Fitness</span><span><i style={{ background: 'var(--fat)' }} />Ermüdung</span>
          <span><i style={{ background: 'var(--form)' }} />Form</span><span><i style={{ background: 'var(--load)' }} />Belastung</span><span>gestrichelt: Prognose mit Plan</span></>}
      </div>
    </div>
  );
}

// Wochenstunden gestapelt nach Intensitätszone (+ Zeit ohne Zone grau).
export function ZoneWeeks({ weeks, height = 200 }) {
  const H = height, L = 30, T = 10, B = 22, iw = W - L - 6, ih = H - T - B;
  const max = niceMax(Math.max(...weeks.map((w) => w.hours), 1));
  const bw = iw / weeks.length;
  return (
    <div>
      <svg className="chart" viewBox={`0 0 ${W} ${H}`}>
        {[0, 0.5, 1].map((f) => <line key={f} className="grid" x1={L} x2={W} y1={T + ih * f} y2={T + ih * f} />)}
        <text x={L - 4} y={T + 8} textAnchor="end">{max} h</text>
        {weeks.map((w, i) => {
          let y0 = T + ih;
          const zoneH = ZONES.reduce((a, z) => a + w.zones[z.id], 0);
          const parts = [...ZONES.map((z) => [w.zones[z.id], ZONE_COLORS[z.id]]), [Math.max(0, w.hours - zoneH), 'var(--load)']];
          return (
            <g key={w.from}>
              {parts.map(([v, c], k) => { const hgt = (v / max) * ih; y0 -= hgt; return hgt > 0 && <rect key={k} x={L + i * bw + 3} y={y0} width={bw - 6} height={hgt} fill={c} rx="2" />; })}
              <text x={L + i * bw + bw / 2} y={H - 6} textAnchor="middle">{fmtDay(w.from)}</text>
              {w.hours > 0 && <text x={L + i * bw + bw / 2} y={T + ih - (w.hours / max) * ih - 3} textAnchor="middle">{w.hours.toFixed(1).replace('.', ',')}</text>}
            </g>
          );
        })}
      </svg>
      <div className="legend">{ZONES.map((z) => <span key={z.id}><i style={{ background: ZONE_COLORS[z.id] }} />{z.label}</span>)}<span><i style={{ background: 'var(--load)' }} />ohne Puls</span></div>
    </div>
  );
}

// Einfaches Liniendiagramm (z. B. Puls/Leistung einer Einheit, 1RM-Verlauf, HRV).
export function LineChart({ series, labels, height = 200, xFormat = (v) => v }) {
  const H = height, L = 36, R = 36, T = 10, B = 22, iw = W - L - R, ih = H - T - B;
  const n = Math.max(...series.map((s) => s.values.length), 0);
  if (!n) return <p className="muted">Keine Daten.</p>;
  const x = (i) => L + (n === 1 ? iw / 2 : (i / (n - 1)) * iw);
  const scales = series.map((s) => {
    const v = s.values.filter((a) => a != null && a > 0);
    const lo = Math.min(...v), hi = Math.max(...v), pad = (hi - lo) * 0.1 || 5;
    return { lo: Math.max(0, lo - pad), hi: hi + pad };
  });
  const ticks = Array.from({ length: Math.min(6, n) }, (_, k) => Math.round((k * (n - 1)) / Math.max(1, Math.min(5, n - 1))));
  return (
    <div>
      <svg className="chart" viewBox={`0 0 ${W} ${H}`}>
        {[0, 0.5, 1].map((f) => <line key={f} className="grid" x1={L} x2={W - R} y1={T + ih * f} y2={T + ih * f} />)}
        {series.map((s, k) => {
          const { lo, hi } = scales[k];
          const y = (v) => T + ih - ((v - lo) / (hi - lo || 1)) * ih;
          return (
            <g key={s.label}>
              <path d={path(s.values.map((v, i) => (v != null && v > 0 ? [x(i), y(v)] : null)))} fill="none" stroke={s.color} strokeWidth={s.dots ? 2 : 1.4} />
              {s.dots && s.values.map((v, i) => v != null && <circle key={i} cx={x(i)} cy={y(v)} r="3" fill={s.color} />)}
              <text x={k === 0 ? L - 4 : W - R + 4} y={T + 8} textAnchor={k === 0 ? 'end' : 'start'} fill={s.color}>{Math.round(hi)}</text>
              <text x={k === 0 ? L - 4 : W - R + 4} y={T + ih} textAnchor={k === 0 ? 'end' : 'start'} fill={s.color}>{Math.round(lo)}</text>
            </g>
          );
        })}
        {labels && ticks.map((i) => <text key={i} x={x(i)} y={H - 6} textAnchor="middle">{xFormat(labels[i])}</text>)}
      </svg>
      <div className="legend">{series.map((s) => <span key={s.label}><i style={{ background: s.color }} />{s.label}</span>)}</div>
    </div>
  );
}

export function ZoneBar({ zones }) {
  const total = ZONES.reduce((a, z) => a + (zones?.[z.id] || 0), 0);
  if (!total) return null;
  return <div className="zonebar">{ZONES.map((z) => <div key={z.id} title={z.label} style={{ width: `${(zones[z.id] / total) * 100}%`, background: ZONE_COLORS[z.id] }} />)}</div>;
}
