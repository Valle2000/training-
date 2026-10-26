// Schlanke SVG-Diagramme ohne Bibliothek (funktionieren offline in der App).
import React, { useState } from 'react';
import { ZONES } from '../lib/metrics.js';

const W = 680;
const fmtDay = (iso) => `${+iso.slice(8, 10)}.${+iso.slice(5, 7)}.`;
const niceMax = (v) => { if (v <= 0) return 10; const p = 10 ** Math.floor(Math.log10(v)); return Math.ceil(v / p) * p; };
// Kleine Werte (z. B. EF 1,45) mit Nachkommastellen beschriften.
const axisFmt = (v) => (Math.abs(v) < 10 ? v.toFixed(2).replace('.', ',') : String(Math.round(v)));
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
export function LineChart({ series: all, labels, height = 200, xFormat = (v) => v }) {
  // Reihen ohne einen einzigen Wert weglassen.
  const series = all.filter((s) => s.values.some((a) => a != null && (s.signed || a > 0)));
  const H = height, L = 36, R = 36, T = 10, B = 22, iw = W - L - R, ih = H - T - B;
  const n = Math.max(...series.map((s) => s.values.length), 0);
  if (!n) return <p className="muted">Keine Daten.</p>;
  const x = (i) => L + (n === 1 ? iw / 2 : (i / (n - 1)) * iw);
  // signed: Werte dürfen negativ sein (z. B. Form); sonst gelten 0/leer als fehlend.
  const ok = (s, a) => a != null && (s.signed || a > 0);
  const scales = series.map((s) => {
    const v = s.values.filter((a) => ok(s, a));
    const lo = Math.min(...v), hi = Math.max(...v), pad = (hi - lo) * 0.1 || 5;
    return { lo: s.signed ? lo - pad : Math.max(0, lo - pad), hi: hi + pad };
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
              <path d={path(s.values.map((v, i) => (ok(s, v) ? [x(i), y(v)] : null)))} fill="none" stroke={s.color} strokeWidth={s.dots ? 2 : 1.4} />
              {s.dots && s.values.map((v, i) => ok(s, v) && <circle key={i} cx={x(i)} cy={y(v)} r="3" fill={s.color} />)}
              <text x={k === 0 ? L - 4 : W - R + 4} y={T + 8} textAnchor={k === 0 ? 'end' : 'start'} fill={s.color}>{axisFmt(hi)}</text>
              <text x={k === 0 ? L - 4 : W - R + 4} y={T + ih} textAnchor={k === 0 ? 'end' : 'start'} fill={s.color}>{axisFmt(lo)}</text>
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

// Gestapelte Balken je Woche/Monat. stacks: [{key, label, color}], value(bucket, key).
export function StackedBars({ buckets, stacks, value, height = 210, unit = '' }) {
  const H = height, L = 36, T = 14, B = 22, iw = W - L - 6, ih = H - T - B;
  const sums = buckets.map((b) => stacks.reduce((a, s) => a + (value(b, s.key) || 0), 0));
  const max = niceMax(Math.max(...sums, 1));
  const bw = iw / Math.max(1, buckets.length);
  const every = Math.ceil(buckets.length / 12);
  return (
    <div>
      <svg className="chart" viewBox={`0 0 ${W} ${H}`}>
        {[0, 0.5, 1].map((f) => <line key={f} className="grid" x1={L} x2={W} y1={T + ih * f} y2={T + ih * f} />)}
        <text x={L - 4} y={T + 8} textAnchor="end">{max}{unit}</text>
        {buckets.map((b, i) => {
          let y0 = T + ih;
          return (
            <g key={b.from}>
              <title>{`${b.label}: ${sums[i].toFixed(1).replace('.', ',')}${unit}`}</title>
              {stacks.map((s) => { const hgt = ((value(b, s.key) || 0) / max) * ih; y0 -= hgt; return hgt > 0 && <rect key={s.key} x={L + i * bw + Math.min(3, bw * 0.15)} y={y0} width={Math.max(1, bw - Math.min(6, bw * 0.3))} height={hgt} fill={s.color} rx="2" />; })}
              {i % every === 0 && <text x={L + i * bw + bw / 2} y={H - 6} textAnchor="middle">{b.label}</text>}
              {buckets.length <= 16 && sums[i] > 0 && <text x={L + i * bw + bw / 2} y={T + ih - (sums[i] / max) * ih - 3} textAnchor="middle">{sums[i] >= 100 ? Math.round(sums[i]) : sums[i].toFixed(1).replace('.', ',')}</text>}
            </g>
          );
        })}
      </svg>
      <div className="legend">{stacks.map((s) => <span key={s.key}><i style={{ background: s.color }} />{s.label}</span>)}</div>
    </div>
  );
}

// Bestwertkurve (Mean-Max) mit logarithmischer Zeitachse; mehrere Kurven zum Vergleich.
export function CurveChart({ curves, durations, unit = 'W', height = 230, fmt }) {
  const H = height, L = 40, R = 10, T = 10, B = 24, iw = W - L - R, ih = H - T - B;
  const vals = curves.flatMap((c) => durations.map((d) => c.data[d]?.value ?? c.data[d]).filter((v) => v > 0));
  if (!vals.length) return <p className="muted">Noch keine Daten für diese Auswahl.</p>;
  const lo = Math.floor(Math.min(...vals) * 0.9 / 10) * 10, hi = niceMax(Math.max(...vals) * 1.05);
  const lx = (d) => L + ((Math.log(d) - Math.log(durations[0])) / (Math.log(durations.at(-1)) - Math.log(durations[0]))) * iw;
  const y = (v) => T + ih - ((v - lo) / (hi - lo)) * ih;
  const ticks = [5, 30, 60, 300, 1200, 3600, 10800].filter((d) => d >= durations[0] && d <= durations.at(-1));
  return (
    <div>
      <svg className="chart" viewBox={`0 0 ${W} ${H}`}>
        {[0, 0.5, 1].map((f) => <line key={f} className="grid" x1={L} x2={W - R} y1={T + ih * f} y2={T + ih * f} />)}
        <text x={L - 4} y={T + 8} textAnchor="end">{hi}</text><text x={L - 4} y={T + ih} textAnchor="end">{lo}</text>
        {ticks.map((d) => <g key={d}><line className="grid" x1={lx(d)} x2={lx(d)} y1={T} y2={T + ih} /><text x={lx(d)} y={H - 6} textAnchor="middle">{fmt(d)}</text></g>)}
        {curves.map((c) => {
          const pts = durations.map((d) => [d, c.data[d]?.value ?? c.data[d]]).filter(([, v]) => v > 0);
          return <g key={c.label}>
            <path d={path(pts.map(([d, v]) => [lx(d), y(v)]))} fill="none" stroke={c.color} strokeWidth="2.2" strokeDasharray={c.dashed ? '5 4' : undefined} />
            {pts.map(([d, v]) => <circle key={d} cx={lx(d)} cy={y(v)} r="2.5" fill={c.color}><title>{`${fmt(d)}: ${v} ${unit}`}</title></circle>)}
          </g>;
        })}
      </svg>
      <div className="legend">{curves.map((c) => <span key={c.label}><i style={{ background: c.color }} />{c.label}</span>)}</div>
    </div>
  );
}
