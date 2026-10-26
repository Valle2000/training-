import React from 'react';
import { fmtPace, lapAnalysis } from '../lib/laps.js';
import { fmtNum } from './common.jsx';

// Rundentabelle mit Balken für Leistung bzw. Pace und eine kurze Auswertung der Belastungsrunden.
export function LapsCard({ laps, erg }) {
  if (!laps?.length) return null;
  const a = lapAnalysis(laps);
  // Balken ab 90 % der schwächsten Runde, damit Unterschiede sichtbar werden.
  const pws = laps.map((l) => l.avgPower).filter(Boolean);
  const maxP = Math.max(...pws, 1), minP = pws.length ? Math.min(...pws) * 0.9 : 0;
  const per = erg === 'bike' ? '/1000 m' : erg ? '/500 m' : '/km';
  const hasP = laps.some((l) => l.avgPower), hasPace = laps.some((l) => l.pace), hasSpm = laps.some((l) => l.spm), hasRest = laps.some((l) => l.restS);
  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>Runden / Intervalle ({laps.length})</h3>
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
      {a && <div className="stats" style={{ marginBottom: 0 }}>
        {a.powerMean != null && <div><b>{a.powerMean} W</b><span>Ø der Runden</span></div>}
        {a.powerCv != null && <div><b style={{ color: a.powerCv <= 3 ? 'var(--good)' : a.powerCv <= 6 ? 'var(--warn)' : 'var(--bad)' }}>{fmtNum(a.powerCv, 1)} %</b><span>Schwankung (gleichmäßig ≤ 3 %)</span></div>}
        {a.fade != null && <div><b style={{ color: a.fade >= -2 ? 'var(--good)' : 'var(--bad)' }}>{a.fade > 0 ? '+' : ''}{fmtNum(a.fade, 1)} %</b><span>Leistung letzte vs. erste</span></div>}
        {a.hrRise != null && <div><b>{a.hrRise > 0 ? '+' : ''}{a.hrRise}</b><span>Puls letzte vs. erste</span></div>}
        {a.efficiencyDrop != null && <div><b style={{ color: a.efficiencyDrop <= 5 ? 'var(--good)' : 'var(--bad)' }}>{fmtNum(a.efficiencyDrop, 1)} %</b><span>Abfall Watt/Puls</span></div>}
      </div>}
      {a && <p className="muted small">Gute Schwellenintervalle: gleichmäßige Leistung (Schwankung ≤ 3 %), keine fallende Leistung und nur moderater Pulsanstieg. Steigt der Puls bei gleicher Leistung stark oder fällt Watt/Puls um mehr als 5 %, war die Intensität eher zu hoch. Fett: stärkste Runde.</p>}
    </div>
  );
}
