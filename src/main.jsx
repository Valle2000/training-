import React, { Suspense, lazy, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Activity, CalendarDays, Dumbbell, Utensils, BrainCircuit, BarChart3, Settings as Gear } from 'lucide-react';
import './style.css';
import { Today } from './ui/today.jsx';
import { Training, ActivitySheet, AddSheet } from './ui/training.jsx';
import { More } from './ui/more.jsx';
import { Toast, toast } from './ui/common.jsx';
import { handleConnectReturn, PROVIDERS } from './lib/sync.js';
import { migrateMetrics, migrateTitles } from './lib/recompute.js';
import { startCloudSync } from './lib/cloud-sync.js';
import { SyncBadge } from './ui/account.jsx';
import { hydrate, onSaveError } from './lib/store.js';

// Selten genutzte, große Tabs erst beim Öffnen laden – die App startet schneller.
const Analysis = lazy(() => import('./ui/analysis.jsx').then((m) => ({ default: m.Analysis })));
const Strength = lazy(() => import('./ui/strength.jsx').then((m) => ({ default: m.Strength })));
const Food = lazy(() => import('./ui/food.jsx').then((m) => ({ default: m.Food })));
const Coach = lazy(() => import('./ui/coach.jsx').then((m) => ({ default: m.Coach })));

const TABS = [
  ['today', 'Heute', Activity], ['training', 'Kalender', CalendarDays], ['analysis', 'Analyse', BarChart3],
  ['strength', 'Kraft', Dumbbell], ['food', 'Essen', Utensils], ['coach', 'Coach', BrainCircuit],
];

function App() {
  const [tab, setTab] = useState('today');
  const [activity, setActivity] = useState(null);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    const r = handleConnectReturn();
    if (r) { setTab('more'); toast(r.error ? `${PROVIDERS[r.provider]?.label || r.provider}: ${r.error}` : `${PROVIDERS[r.provider].label} verbunden – jetzt unter „Heute“ abgleichen`); }
  }, []);
  const [saveErr, setSaveErr] = useState(null);
  useEffect(() => onSaveError(setSaveErr), []);
  // Vorschau-Adressen von Vercel haben einen eigenen, leeren Speicher.
  const wrongHost = typeof __APP_URL__ === 'string' && __APP_URL__ && !location.origin.startsWith(__APP_URL__) && !/localhost|127\.0\.0\.1/.test(location.hostname);
  useEffect(() => { scrollTo(0, 0); }, [tab]);

  const common = { go: setTab, openActivity: setActivity, openAdd: () => setAdding(true) };
  return (
    <>
      <header>
        <div className="brand"><Activity size={24} color="#c7f36b" /><div><b>Training</b><small>LANGLAUF · KI-COACH</small></div></div>
        <div className="row" style={{ flex: 'none', gap: 6 }}>
          <SyncBadge onClick={() => setTab('more')} />
          <button className={`pill${tab === 'more' ? ' on' : ''}`} onClick={() => setTab('more')} aria-label="Mehr: Einstellungen, Material, Gesundheit"><Gear size={16} />Mehr</button>
        </div>
      </header>
      <main>
        {saveErr && <div className="notice" style={{ background: 'var(--badbg)', color: 'var(--bad)' }}><b>Achtung:</b> {saveErr} Bitte unter Mehr → Einstellungen anmelden (Online-Abgleich) oder ein Backup machen.</div>}
        {wrongHost && <div className="notice" style={{ background: 'var(--warnbg)', color: 'var(--warn)' }}><b>Andere Adresse:</b> Du nutzt {location.host}. Daten liegen je Adresse getrennt – öffne die App über <a href={__APP_URL__}>{__APP_URL__.replace('https://', '')}</a>{' '}oder melde dich an, dann sind sie überall gleich.</div>}
        <Suspense fallback={<p className="muted">Lädt …</p>}>
        {tab === 'today' && <Today {...common} />}
        {tab === 'training' && <Training {...common} />}
        {tab === 'analysis' && <Analysis {...common} />}
        {tab === 'strength' && <Strength />}
        {tab === 'food' && <Food />}
        {tab === 'coach' && <Coach />}
        {tab === 'more' && <More />}
        </Suspense>
      </main>
      <nav>
        {TABS.map(([id, label, Icon]) => <button key={id} className={`nav${tab === id ? ' active' : ''}`} onClick={() => setTab(id)}><Icon size={21} />{label}</button>)}
      </nav>
      {activity && <ActivitySheet activity={activity} onClose={() => setActivity(null)} />}
      {adding && <AddSheet onClose={() => setAdding(false)} />}
      <Toast />
    </>
  );
}

createRoot(document.getElementById('root')).render(<App />);
// Erst den vollständigen Stand aus IndexedDB laden, dann Kennzahlen prüfen und online abgleichen –
// sonst könnte ein unvollständiger Stand Einheiten als „gelöscht“ melden.
hydrate().finally(() => { migrateTitles(); migrateMetrics(); startCloudSync(); });

if ('serviceWorker' in navigator && import.meta.env.PROD) navigator.serviceWorker.register('/sw.js').catch(() => {});
