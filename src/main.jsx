import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Activity, CalendarDays, Dumbbell, Utensils, BrainCircuit, Menu } from 'lucide-react';
import './style.css';
import { Today } from './ui/today.jsx';
import { Training, ActivitySheet, AddSheet } from './ui/training.jsx';
import { Strength } from './ui/strength.jsx';
import { Food } from './ui/food.jsx';
import { Coach } from './ui/coach.jsx';
import { Settings } from './ui/settings.jsx';
import { Toast, toast } from './ui/common.jsx';
import { handleConnectReturn, PROVIDERS } from './lib/sync.js';

const TABS = [
  ['today', 'Heute', Activity], ['training', 'Training', CalendarDays], ['strength', 'Kraft', Dumbbell],
  ['food', 'Essen', Utensils], ['coach', 'Coach', BrainCircuit], ['more', 'Mehr', Menu],
];

function App() {
  const [tab, setTab] = useState('today');
  const [activity, setActivity] = useState(null);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    const r = handleConnectReturn();
    if (r) { setTab('more'); toast(r.error ? `${PROVIDERS[r.provider]?.label || r.provider}: ${r.error}` : `${PROVIDERS[r.provider].label} verbunden – jetzt unter „Heute“ abgleichen`); }
  }, []);
  useEffect(() => { scrollTo(0, 0); }, [tab]);

  const common = { go: setTab, openActivity: setActivity, openAdd: () => setAdding(true) };
  return (
    <>
      <header>
        <div className="brand"><Activity size={24} color="#c7f36b" /><div><b>Training</b><small>LANGLAUF · KI-COACH</small></div></div>
      </header>
      <main>
        {tab === 'today' && <Today {...common} />}
        {tab === 'training' && <Training {...common} />}
        {tab === 'strength' && <Strength />}
        {tab === 'food' && <Food />}
        {tab === 'coach' && <Coach />}
        {tab === 'more' && <Settings />}
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

if ('serviceWorker' in navigator && import.meta.env.PROD) navigator.serviceWorker.register('/sw.js').catch(() => {});
