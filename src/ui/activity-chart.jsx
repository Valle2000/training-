// Verlaufsdiagramm einer Einheit wie bei TrainingPeaks: Kurven ein-/ausblenden, Bereich per Ziehen oder Regler
// wählen, Werte des Bereichs, Lesefinger und Zoom. Verlauf liegt im 5-s-Raster vor.
import React, { useMemo, useRef, useState } from 'react';
import { ZoomIn, ZoomOut } from 'lucide-react';
import { fmtPace } from '../lib/laps.js';
import { fmtDuration, fmtNum } from './common.jsx';

const STEP = 5; // Sekunden je Messpunkt
const W = 680, H = 230, L = 8, R = 8, T = 10, B = 22;

// Pace aus Watt am Ergometer (Concept2-Formel umgekehrt), Sekunden pro 500 m bzw. 1000 m (BikeErg).
const ergPace = (w, per) => (w > 0 ? per * Math.cbrt(2.8 / w) : null);

function metricDefs(series, sport) {
  const erg = ['skierg', 'row', 'bikeerg'].includes(sport);
  const per = sport === 'bikeerg' ? 1000 : 500;
  const defs = [];
  if (series.hr?.some(Boolean)) defs.push({ id: 'hr', label: 'Puls', unit: 'bpm', color: 'var(--fat)', values: series.hr });
  if (series.power?.some(Boolean)) defs.push({ id: 'power', label: 'Watt', unit: 'W', color: 'var(--fit)', values: series.power });
  if (erg && series.power?.some(Boolean)) defs.push({ id: 'pace', label: `Pace/${per} m`, unit: '', color: 'var(--z2)', values: series.power.map((w) => ergPace(w, per)), invert: true, fmt: fmtPace });
  else if (series.speed?.some(Boolean)) {
    if (sport === 'bike') defs.push({ id: 'speed', label: 'km/h', unit: 'km/h', color: 'var(--z2)', values: series.speed.map((v) => (v ? v * 3.6 : null)) });
    else defs.push({ id: 'pace', label: 'Pace/km', unit: '', color: 'var(--z2)', values: series.speed.map((v) => (v > 0.5 ? 1000 / v : null)), invert: true, fmt: fmtPace });
  }
  if (series.alt?.some((a) => a != null)) defs.push({ id: 'alt', label: 'Höhe', unit: 'm', color: 'var(--load)', values: series.alt, area: true });
  return defs;
}

const mean = (a) => { const v = a.filter((x) => x != null && x > 0); return v.length ? v.reduce((x, y) => x + y, 0) / v.length : null; };

export function ActivityChart({ series, sport, laps }) {
  const defs = useMemo(() => metricDefs(series, sport), [series, sport]);
  const n = defs[0]?.values.length || 0;
  const [shown, setShown] = useState(() => defs.filter((d) => d.id === 'hr' || d.id === 'power').map((d) => d.id));
  const [sel, setSel] = useState([0, Math.max(0, n - 1)]);
  const [view, setView] = useState([0, Math.max(0, n - 1)]);
  const [hover, setHover] = useState(null);
  const drag = useRef(null);
  const svg = useRef(null);
  // Runden auf die Bewegungszeit abbilden (aufsummierte Rundendauer).
  const lapRanges = useMemo(() => { let t = 0; return (laps || []).map((l) => { const a = Math.round(t / STEP); t += l.durationS || 0; return { n: l.n, a, b: Math.min(n - 1, Math.round(t / STEP) - 1) }; }); }, [laps, n]);
  if (!n) return null;

  const [v0, v1] = view;
  const iw = W - L - R, ih = H - T - B;
  const x = (i) => L + ((i - v0) / Math.max(1, v1 - v0)) * iw;
  const idxAt = (clientX) => { const r = svg.current.getBoundingClientRect(); return Math.round(v0 + (((clientX - r.left) / r.width) * W - L) / iw * (v1 - v0)); };
  const clamp = (i) => Math.max(v0, Math.min(v1, i));

  const active = defs.filter((d) => shown.includes(d.id));
  const scales = Object.fromEntries(active.map((d) => {
    const vals = d.values.slice(v0, v1 + 1).filter((v) => v != null && v > 0);
    if (!vals.length) return [d.id, null];
    let lo = Math.min(...vals), hi = Math.max(...vals);
    if (d.id === 'pace') { const sorted = [...vals].sort((a, b) => a - b); hi = sorted[Math.floor(sorted.length * 0.97)] || hi; } // Ausreißer (Pausen) kappen
    const pad = (hi - lo) * 0.08 || 1;
    return [d.id, { lo: lo - pad, hi: hi + pad }];
  }));
  const y = (d, v) => { const s = scales[d.id]; if (!s || v == null || v <= 0) return null; const f = (Math.min(Math.max(v, s.lo), s.hi) - s.lo) / (s.hi - s.lo); return T + ih - (d.invert ? 1 - f : f) * ih; };
  const pathOf = (d) => {
    let p = '', pen = false;
    const stride = Math.max(1, Math.floor((v1 - v0) / 700)); // nicht mehr Punkte als Pixel zeichnen
    for (let i = v0; i <= v1; i += stride) { const yy = y(d, d.values[i]); if (yy == null) { pen = false; continue; } p += `${pen ? 'L' : 'M'}${x(i).toFixed(1)},${yy.toFixed(1)}`; pen = true; }
    return p;
  };

  // Werte des gewählten Bereichs.
  const [s0, s1] = sel[0] <= sel[1] ? sel : [sel[1], sel[0]];
  const part = (k) => defs.find((d) => d.id === k)?.values.slice(s0, s1 + 1) || [];
  const hrP = part('hr'), pwP = part('power');
  const np = (() => { if (pwP.length < 12) return null; const r = []; for (let i = 5; i < pwP.length; i++) r.push(pwP.slice(i - 5, i + 1).reduce((a, b) => a + (b || 0), 0) / 6); return Math.round((r.reduce((a, b) => a + b ** 4, 0) / r.length) ** 0.25); })();
  const paceDef = defs.find((d) => d.id === 'pace');
  const stats = {
    dur: (s1 - s0 + 1) * STEP,
    hrAvg: mean(hrP), hrMax: hrP.some(Boolean) ? Math.max(...hrP.filter(Boolean)) : null,
    pwAvg: mean(pwP), np,
    pace: paceDef ? (sport === 'skierg' || sport === 'row' || sport === 'bikeerg' ? ergPace(mean(pwP), sport === 'bikeerg' ? 1000 : 500) : (() => { const sp = mean(part('speed').length ? part('speed') : (series.speed || []).slice(s0, s1 + 1)); return sp ? 1000 / sp : null; })()) : null,
    climb: (() => { const a = part('alt'); let up = 0; for (let i = 1; i < a.length; i++) if (a[i] != null && a[i - 1] != null && a[i] > a[i - 1]) up += a[i] - a[i - 1]; return a.length ? Math.round(up) : null; })(),
  };
  const isFull = s0 === 0 && s1 === n - 1;


  const onDown = (e) => { const i = clamp(idxAt(e.clientX)); drag.current = i; setSel([i, i]); svg.current.setPointerCapture?.(e.pointerId); };
  const onMove = (e) => { const i = clamp(idxAt(e.clientX)); setHover(i); if (drag.current != null) setSel([drag.current, i]); };
  const onUp = () => { if (drag.current != null && Math.abs(sel[1] - sel[0]) < 2) setSel([0, n - 1]); drag.current = null; };
  const hv = hover != null ? hover : null;

  return (
    <div className="card">
      <div className="chips" style={{ marginTop: 0 }}>{defs.map((d) => <button key={d.id} className={`chip${shown.includes(d.id) ? ' on' : ''}`} style={shown.includes(d.id) ? { background: d.color, borderColor: d.color } : undefined} onClick={() => setShown(shown.includes(d.id) ? shown.filter((x) => x !== d.id) : [...shown, d.id])}>{d.label}</button>)}</div>
      <svg ref={svg} className="chart" viewBox={`0 0 ${W} ${H}`} style={{ touchAction: 'none', userSelect: 'none' }}
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={() => { setHover(null); }}>
        {[0, 0.5, 1].map((f) => <line key={f} className="grid" x1={L} x2={W - R} y1={T + ih * f} y2={T + ih * f} />)}
        {lapRanges.map((r) => r.b >= v0 && r.a <= v1 && <line key={r.n} x1={x(Math.max(v0, r.a))} x2={x(Math.max(v0, r.a))} y1={T} y2={T + ih} stroke="var(--line)" strokeDasharray="3 3" />)}
        {!isFull && <rect x={x(Math.max(v0, s0))} y={T} width={Math.max(1, x(Math.min(v1, s1)) - x(Math.max(v0, s0)))} height={ih} fill="var(--accent)" opacity="0.12" />}
        {active.map((d) => d.area
          ? <path key={d.id} d={`${pathOf(d)}L${x(v1)},${T + ih}L${x(v0)},${T + ih}Z`} fill={d.color} opacity="0.25" stroke="none" />
          : <path key={d.id} d={pathOf(d)} fill="none" stroke={d.color} strokeWidth="1.5" />)}
        {[0, 0.25, 0.5, 0.75, 1].map((f) => { const i = Math.round(v0 + f * (v1 - v0)); return <text key={f} x={x(i)} y={H - 6} textAnchor={f === 0 ? 'start' : f === 1 ? 'end' : 'middle'}>{fmtDuration(i * STEP)}</text>; })}
        {hv != null && <line x1={x(hv)} x2={x(hv)} y1={T} y2={T + ih} stroke="var(--ink)" strokeWidth="1" opacity="0.5" />}
        {hv != null && active.map((d) => { const yy = y(d, d.values[hv]); return yy != null && <circle key={d.id} cx={x(hv)} cy={yy} r="3.5" fill={d.color} />; })}
      </svg>
      <div className="small" style={{ minHeight: 20, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {hv != null
          ? <><b>{fmtDuration(hv * STEP)}:{String((hv * STEP) % 60).padStart(2, '0')}</b>{active.map((d) => <span key={d.id} style={{ color: d.color }}>{d.label}: {d.values[hv] == null ? '–' : d.fmt ? d.fmt(d.values[hv]) : Math.round(d.values[hv])} {d.fmt ? '' : d.unit}</span>)}</>
          : <span className="muted">Im Diagramm ziehen, um einen Bereich zu wählen · tippen zum Zurücksetzen</span>}
      </div>
      {/* Doppelregler für Anfang und Ende des Bereichs */}
      <div className="dual">
        <input type="range" min={v0} max={v1} value={Math.max(v0, s0)} onChange={(e) => setSel([Math.min(Number(e.target.value), s1), s1])} aria-label="Bereich Anfang" />
        <input type="range" min={v0} max={v1} value={Math.min(v1, s1)} onChange={(e) => setSel([s0, Math.max(Number(e.target.value), s0)])} aria-label="Bereich Ende" />
      </div>
      {lapRanges.length > 1 && <div className="chips">{lapRanges.map((r) => <button key={r.n} className={`chip${s0 === r.a && s1 === r.b ? ' on' : ''}`} onClick={() => setSel([r.a, r.b])}>R{r.n}</button>)}<button className="chip" onClick={() => setSel([0, n - 1])}>Alles</button></div>}
      <div className="stats" style={{ marginBottom: 0 }}>
        <div><b>{fmtDuration(stats.dur)}{stats.dur < 3600 ? `:${String(stats.dur % 60).padStart(2, '0')}` : ''}</b><span>{isFull ? 'Gesamt' : 'Auswahl'}</span></div>
        {stats.hrAvg != null && <div><b>{Math.round(stats.hrAvg)}/{stats.hrMax}</b><span>Ø/max Puls</span></div>}
        {stats.pwAvg != null && <div><b>{Math.round(stats.pwAvg)}{stats.np ? `/${stats.np}` : ''}</b><span>Ø W{stats.np ? '/NP' : ''}</span></div>}
        {stats.pace != null && <div><b>{fmtPace(stats.pace)}</b><span>Ø Pace</span></div>}
        {stats.pwAvg != null && stats.hrAvg != null && <div><b>{fmtNum(stats.pwAvg / stats.hrAvg, 2)}</b><span>Watt/Puls</span></div>}
        {stats.climb ? <div><b>{stats.climb} m</b><span>Anstieg</span></div> : null}
      </div>
      <div className="row" style={{ marginTop: 8 }}>
        {!isFull && (v0 !== s0 || v1 !== s1) && <button className="secondary" onClick={() => setView([s0, s1])}><ZoomIn size={16} />Auf Auswahl zoomen</button>}
        {(v0 !== 0 || v1 !== n - 1) && <button className="ghost" onClick={() => setView([0, n - 1])}><ZoomOut size={16} />Ganze Einheit</button>}
      </div>
    </div>
  );
}
