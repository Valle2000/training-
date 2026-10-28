import React, { useState } from 'react';
import { fmtPace, lapAnalysis } from '../lib/laps.js';
import { fmtNum, Seg } from './common.jsx';

// Runden der Uhr/des Geräts und automatische Splits (km) – umschaltbar.
export function LapsCard({ laps, autoLaps, erg, sport }) {
  const hasLaps = laps?.length > 0, hasAuto = autoLaps?.length > 0;
  const [view, setView] = useState(hasLaps ? 'laps' : 'auto');
  if (!hasLaps && !hasAuto) return null;
  const v = hasLaps && hasAuto ? view : hasLaps ? 'laps' : 'auto';
  const unit = sport === 'bike' ? '5 km' : 'km';
  return (
    <>
      {hasLaps && hasAuto && <div style={{ marginTop: 8 }}><Seg value={v} onChange={setView} options={[['laps', `Runden (${laps.length})`], ['auto', `Splits je ${unit} (${autoLaps.length})`]]} /></div>}
      {v === 'laps' ? <LapsTable laps={laps} erg={erg} title={`Runden / Intervalle (${laps.length})`} /> : <LapsTable laps={autoLaps} erg={null} title={`Splits je ${unit} (${autoLaps.length})`} splits />}
    </>
  );
}

// Rundentabelle mit Balken für Leistung bzw. Pace und eine kurze Auswertung der Belastungsrunden.
function LapsTable({ laps, erg, title, splits = false }) {
  if (!laps?.length) return null;
  const a = lapAnalysis(laps);
  // Balken ab 90 % der schwächsten Runde, damit Unterschiede sichtbar werden.
  const pws = laps.map((l) => l.avgPower).filter(Boolean);
  const maxP = Math.max(...pws, 1), minP = pws.length ? Math.min(...pws) * 0.9 : 0;
  const per = erg === 'bike' ? '/1000 m' : erg ? '/500 m' : '/km';
  const hasP = laps.some((l) => l.avgPower), hasPace = laps.some((l) => l.pace), hasSpm = laps.some((l) => l.spm), hasRest = laps.some((l) => l.restS);
  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>{title}</h3>
      <div style={{ overflowX: 'auto' }}>
        <table className="t nowrap">
          <thead><tr><th>#</th><th>Zeit</th><th>m</th>{hasPace && <th>Pace{per}</th>}{hasP && <th>W</th>}<th>Ø/max Puls</th>{hasSpm && <th>{erg ? 'SPM' : 'Kad.'}</th>}{hasRest && <th>Pause</th>}</tr></thead>
          <tbody>{laps.map((l) => (
            <tr key={l.n} style={{ fontWeight: a && (l.n === a.best) ? 700 : 400 }}>
              <td>{l.n}</td><td>{fmtPace(l.durationS)}</td>
              <td>{l.distanceM ? Math.round(l.distanceM) : '–'}</td>
              {hasPace && <td>{fmtPace(l.pace)}</td>}
              {hasP && <td><span style={{ display: 'inline-block', width: 34 }}>{l.avgPower ? Math.round(l.avgPower) : '–'}</span><span style={{ display: 'inline-block', height: 6, width: `${l.avgPower ? 8 + ((l.avgPower - minP) / (maxP - minP || 1)) * 52 : 0}px`, background: 'var(--fit)', borderRadius: 3, verticalAlign: 'middle' }} /></td>}
              <td>{l.avgHr ? Math.round(l.avgHr) : '–'}/{l.maxHr ? Math.round(l.maxHr) : '–'}</td>
              {hasSpm && <td>{l.spm ?? '–'}</td>}
              {hasRest && <td>{l.restS ? `${Math.floor(l.restS / 60)}:${String(Math.round(l.restS % 60)).padStart(2, '0')}` : ''}</td>}
            </tr>
          ))}</tbody>
        </table>
      </div>
      {splits && <SplitSummary laps={laps} />}
      {a && !splits && <div className="stats" style={{ marginBottom: 0 }}>
        {a.powerMean != null && <div><b>{a.powerMean} W</b><span>Ø der Runden</span></div>}
        {a.powerCv != null && <div><b style={{ color: a.powerCv <= 3 ? 'var(--good)' : a.powerCv <= 6 ? 'var(--warn)' : 'var(--bad)' }}>{fmtNum(a.powerCv, 1)} %</b><span>Schwankung (gleichmäßig ≤ 3 %)</span></div>}
        {a.fade != null && <div><b style={{ color: a.fade >= -2 ? 'var(--good)' : 'var(--bad)' }}>{a.fade > 0 ? '+' : ''}{fmtNum(a.fade, 1)} %</b><span>Leistung letzte vs. erste</span></div>}
        {a.hrRise != null && <div><b>{a.hrRise > 0 ? '+' : ''}{a.hrRise}</b><span>Puls letzte vs. erste</span></div>}
        {a.efficiencyDrop != null && <div><b style={{ color: a.efficiencyDrop <= 5 ? 'var(--good)' : 'var(--bad)' }}>{fmtNum(a.efficiencyDrop, 1)} %</b><span>Abfall Watt/Puls</span></div>}
      </div>}
      {a && !splits && <p className="muted small">Gute Schwellenintervalle: gleichmäßige Leistung (Schwankung ≤ 3 %), keine fallende Leistung und nur moderater Pulsanstieg. Steigt der Puls bei gleicher Leistung stark oder fällt Watt/Puls um mehr als 5 %, war die Intensität eher zu hoch. Fett: stärkste Runde.</p>}
    </div>
  );
}

// Splits: schnellster/langsamster Abschnitt, zweite Hälfte schneller (negativ) oder langsamer.
function SplitSummary({ laps }) {
  const full = laps.filter((l) => l.distanceM >= 900 && l.pace);
  if (full.length < 2) return null;
  const fast = full.reduce((a, b) => (b.pace < a.pace ? b : a)), slow = full.reduce((a, b) => (b.pace > a.pace ? b : a));
  const half = Math.floor(full.length / 2), m = (xs) => xs.reduce((a, l) => a + l.pace, 0) / xs.length;
  const diff = m(full.slice(half)) - m(full.slice(0, half));
  return (
    <div className="stats" style={{ marginBottom: 0 }}>
      <div><b>{fmtPace(fast.pace)}</b><span>schnellster ({fast.n})</span></div>
      <div><b>{fmtPace(slow.pace)}</b><span>langsamster ({slow.n})</span></div>
      <div><b style={{ color: diff <= 0 ? 'var(--good)' : undefined }}>{diff <= 0 ? '−' : '+'}{fmtPace(Math.abs(diff))}</b><span>2. Hälfte {diff <= 0 ? 'schneller' : 'langsamer'}</span></div>
    </div>
  );
}
