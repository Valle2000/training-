import React from 'react';
import { RACE_APPROACHES, RACE_KIND_LABEL, FOCUS_STRENGTHS, raceKind } from '../lib/plan-wizard.js';

// Optional am Lauf- oder Radrennen: welcher Ansatz davor (Halbmarathon, 10 km …) und wie stark der Fokus.
// Der Rest des Trainings verteilt sich nach dem Profil (z. B. Langlauf-Allrounder) – es bleibt multisportlich.
export function RaceApproachFields({ race, onChange }) {
  const list = RACE_APPROACHES[race.technique];
  if (!list) return null;
  const auto = raceKind({ ...race, approach: '' });
  return (
    <div className="grid2">
      <div>
        <label>Ansatz davor</label>
        <select value={race.approach || ''} onChange={(e) => onChange({ approach: e.target.value || undefined })}>
          <option value="">Automatisch{auto ? ` (${RACE_KIND_LABEL[auto]})` : ''}</option>
          {list.map((k) => <option key={k} value={k}>{RACE_KIND_LABEL[k]}</option>)}
          <option value="none">Kein Schwerpunkt davor</option>
        </select>
      </div>
      {race.approach !== 'none' && (
        <div>
          <label>Fokus davor</label>
          <select value={race.focusStrength ?? ''} onChange={(e) => onChange({ focusStrength: e.target.value === '' ? undefined : Number(e.target.value) })}>
            {FOCUS_STRENGTHS.map(([v, l]) => <option key={l} value={v ?? ''}>{v == null ? 'Standard' : `${l} der Zeit`}</option>)}
          </select>
        </div>
      )}
    </div>
  );
}
export const FOCUS_HELP = 'Fokus = Anteil der Trainingszeit in der Sportart des Rennens (A-Rennen ca. 8 Wochen, B-Rennen ca. 4 Wochen davor). Der Rest verteilt sich nach deinem Profil, harte Einheiten unter 75 % auch auf Rollski/Rad. „Standard“ = wie bisher (gemischter lockerer Umfang, alle harten Einheiten in der Sportart des Rennens).';
