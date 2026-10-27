import React, { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import { onUnknownPolar, mapPolarSport, mapSportByTitle } from '../lib/sync.js';
import { SPORTS } from '../lib/sports.js';
import { Sheet, toast } from './common.jsx';

// Unbekannte Polar-Sportarten nach dem Abgleich festlegen. Die Zuordnung wird gespeichert und gilt für künftige Abgleiche.
export function PolarAsk() {
  const [items, setItems] = useState(null);
  const [pick, setPick] = useState({});
  useEffect(() => onUnknownPolar((list) => { setItems(list); setPick({}); }), []);
  if (!items?.length) return null;
  const save = async () => {
    const chosen = items.filter((x) => pick[x.id]);
    for (const x of chosen) await (x.kind === 'title' ? mapSportByTitle(x.name, pick[x.id]) : mapPolarSport(x.id, pick[x.id]));
    if (chosen.length) toast(`${chosen.length} Polar-Sportart(en) gespeichert`);
    setItems(null);
  };
  return (
    <Sheet title="Neue Polar-Sportarten" onClose={() => setItems(null)}>
      <p className="small muted">Diese Sportarten kennt die App noch nicht (bzw. die Einheiten haben keine Sportnummer, dann zählt der Name). Die Zuordnung gilt für alle Einheiten dieser Sportart, auch für künftige Abgleiche. Was du offen lässt, bleibt „Sonstiges“ und wird beim nächsten Abgleich wieder gefragt.</p>
      {items.map((x) => (
        <div key={x.id} className="item" style={{ alignItems: 'center' }}>
          <div className="grow small"><b>{x.kind === 'title' ? `Name: „${x.name}“` : (x.name || `Sportnummer ${x.id}`)}</b><div className="muted">{x.count}×{x.kind === 'title' ? ' ohne Sportnummer' : ` · z. B. ${x.example || '–'}`}</div></div>
          <select value={pick[x.id] || ''} onChange={(e) => setPick({ ...pick, [x.id]: e.target.value })} style={{ width: 150 }}>
            <option value="">offen lassen</option>
            {SPORTS.filter((s) => s.id !== 'other').map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </div>
      ))}
      <button className="primary wide" onClick={save}><Check size={17} />Speichern</button>
    </Sheet>
  );
}
