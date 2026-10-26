import React, { useState } from 'react';
import { Plus, Trash2, Wrench, HeartCrack } from 'lucide-react';
import { useData, update, uid } from '../lib/store.js';
import { today } from '../lib/activities.js';
import { SPORTS } from '../lib/sports.js';
import { GEAR_KINDS, gearUsage, HEALTH_TYPES, healthDays, loadBefore, healthStats } from '../lib/gear.js';
import { seasonStart } from '../lib/season.js';
import { Settings } from './settings.jsx';
import { Sheet, Seg, fmtDate, fmtNum, toast } from './common.jsx';

export function More() {
  const [view, setView] = useState('settings');
  return (
    <>
      <h1>Mehr</h1>
      <Seg value={view} onChange={setView} options={[['settings', 'Einstellungen'], ['gear', 'Material'], ['health', 'Gesundheit']]} />
      {view === 'settings' && <Settings />}
      {view === 'gear' && <Gear />}
      {view === 'health' && <Health />}
    </>
  );
}

function Gear() {
  const { gear, activities, settings } = useData();
  const [edit, setEdit] = useState(null);
  const active = gear.filter((g) => !g.retired), retired = gear.filter((g) => g.retired);
  const card = (g) => {
    const u = gearUsage(g, activities);
    return (
      <button key={g.id} className="item" onClick={() => setEdit(g)}>
        <div className="grow"><b>{g.name}</b> <span className="muted small">{GEAR_KINDS.find((k) => k[0] === g.kind)?.[1]}</span>
          <p>{fmtNum(u.km)} km · {fmtNum(u.hours, 1)} h · {u.sessions} Einheiten{u.last ? ` · zuletzt ${fmtDate(u.last, { day: 'numeric', month: 'short' })}` : ''}</p>
          {g.serviceKm && <p style={{ color: u.serviceDue ? 'var(--bad)' : 'var(--muted)' }}><Wrench size={12} /> {u.serviceDue ? 'Service fällig' : `Service in ${fmtNum(Number(g.serviceKm) - u.sinceService)} km`}{g.serviceNote ? ` (${g.serviceNote})` : ''}</p>}</div>
      </button>
    );
  };
  return (
    <>
      <p className="muted" style={{ marginTop: 12 }}>Ski, Rollski, Schuhe, Rad: Kilometer und Stunden kommen automatisch aus deinen Einheiten (Standard je Sportart oder in der Einheit ausgewählt). Mit Service-Intervall erinnert die App z. B. an Rollski-Rollen oder Kette.</p>
      <button className="primary wide" onClick={() => setEdit({ id: uid(), name: '', kind: 'rollerski', defaultSports: ['rollerski_skate'], since: today(settings.timezone), startKm: 0, serviceKm: '', lastServiceKm: 0, serviceNote: '', notes: '' })}><Plus size={17} />Material hinzufügen</button>
      {active.map(card)}
      {retired.length > 0 && <><h3>Ausgemustert</h3>{retired.map(card)}</>}
      {edit && <GearEditor g={edit} onClose={() => setEdit(null)} />}
    </>
  );
}

function GearEditor({ g: initial, onClose }) {
  const { activities, settings } = useData();
  const [g, setG] = useState(initial);
  const u = gearUsage(g, activities);
  const set = (k) => (e) => setG({ ...g, [k]: e.target.value });
  const save = () => { if (!g.name.trim()) return toast('Name fehlt'); update((d) => ({ ...d, gear: [...d.gear.filter((x) => x.id !== g.id), g] })); onClose(); };
  const remove = () => { update((d) => ({ ...d, gear: d.gear.filter((x) => x.id !== g.id) })); onClose(); };
  return (
    <Sheet title={initial.name || 'Material'} onClose={onClose}>
      <label>Name</label><input value={g.name} onChange={set('name')} placeholder="z. B. Swenor Skate Rollski" />
      <div className="grid2">
        <div><label>Art</label><select value={g.kind} onChange={set('kind')}>{GEAR_KINDS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
        <div><label>Im Einsatz seit</label><input type="date" value={g.since || ''} onChange={set('since')} /></div>
        <div><label>km vorher</label><input type="number" value={g.startKm} onChange={set('startKm')} /></div>
        <div><label>Service alle (km)</label><input type="number" value={g.serviceKm} onChange={set('serviceKm')} placeholder="optional" /></div>
      </div>
      <label>Standard für Sportarten</label>
      <div className="chips">{SPORTS.filter((s) => s.group !== 'strength').map((s) => <button key={s.id} className={`chip${(g.defaultSports || []).includes(s.id) ? ' on' : ''}`} onClick={() => setG({ ...g, defaultSports: (g.defaultSports || []).includes(s.id) ? g.defaultSports.filter((x) => x !== s.id) : [...(g.defaultSports || []), s.id] })}>{s.label}</button>)}</div>
      {g.serviceKm && <><label>Was wird gemacht?</label><input value={g.serviceNote} onChange={set('serviceNote')} placeholder="z. B. Rollen wechseln, Kette" />
        <button className="secondary wide" style={{ marginTop: 8 }} onClick={() => { setG({ ...g, lastServiceKm: Math.round(u.km), lastServiceDate: today(settings.timezone) }); toast('Service vermerkt – Speichern nicht vergessen'); }}><Wrench size={16} />Service erledigt (bei {fmtNum(u.km)} km)</button></>}
      <label>Notizen</label><textarea value={g.notes} onChange={set('notes')} />
      <label className="checkrow" style={{ display: 'flex', gap: 10, fontWeight: 400 }}><input type="checkbox" checked={!!g.retired} onChange={(e) => setG({ ...g, retired: e.target.checked ? today(settings.timezone) : null })} /> Ausgemustert</label>
      <div className="row" style={{ marginTop: 12 }}>
        <button className="primary" onClick={save}>Speichern</button>
        {initial.name && <button className="danger" onClick={remove}><Trash2 size={17} />Löschen</button>}
      </div>
    </Sheet>
  );
}

function Health() {
  const { health, activities, settings } = useData();
  const t = today(settings.timezone);
  const [edit, setEdit] = useState(null);
  const from = seasonStart(t);
  const st = healthStats(health, from, t, t);
  const sorted = [...health].sort((a, b) => b.start.localeCompare(a.start));
  return (
    <>
      <div className="stats">
        <div><b>{st.ill}</b><span>Krankheitstage (Saison)</span></div>
        <div><b>{st.injury}</b><span>Verletzungstage</span></div>
        <div><b>{st.niggle}</b><span>Tage mit Beschwerden</span></div>
      </div>
      <button className="primary wide" onClick={() => setEdit({ id: uid(), type: 'ill', title: '', bodyPart: '', start: t, end: '', severity: 2, impact: 'pause', notes: '' })}><Plus size={17} />Krankheit / Verletzung eintragen</button>
      {sorted.map((e) => {
        const lb = loadBefore(e, activities);
        return (
          <button key={e.id} className="item" onClick={() => setEdit(e)}>
            <div className="grow"><b><HeartCrack size={14} /> {e.title || HEALTH_TYPES.find((x) => x[0] === e.type)?.[1]}</b> {!e.end && <span className="badge b-kritisch">aktuell</span>}
              <p>{HEALTH_TYPES.find((x) => x[0] === e.type)?.[1]}{e.bodyPart ? ` · ${e.bodyPart}` : ''} · {fmtDate(e.start)}{e.end ? ` – ${fmtDate(e.end)}` : ''} · {healthDays(e, t)} Tage</p>
              {lb != null && <p style={{ color: lb > 30 ? 'var(--bad)' : 'var(--muted)' }}>Belastung in den 2 Wochen davor: {lb > 0 ? '+' : ''}{lb} % gegenüber den 4 Wochen zuvor</p>}</div>
          </button>
        );
      })}
      <p className="muted small">Große Belastungssprünge gingen bei Elite-Langläufern mit mehr Infekten einher (Svendsen et al. 2016). Die App zeigt dir zu jedem Ausfall, wie sich deine Belastung vorher entwickelt hat.</p>
      {edit && <HealthEditor e={edit} onClose={() => setEdit(null)} />}
    </>
  );
}

function HealthEditor({ e: initial, onClose }) {
  const [e, setE] = useState(initial);
  const set = (k) => (ev) => setE({ ...e, [k]: ev.target.value });
  const save = () => { update((d) => ({ ...d, health: [...d.health.filter((x) => x.id !== e.id), { ...e, end: e.end || null }] })); onClose(); };
  const remove = () => { update((d) => ({ ...d, health: d.health.filter((x) => x.id !== e.id) })); onClose(); };
  return (
    <Sheet title="Krankheit / Verletzung" onClose={onClose}>
      <div className="grid2">
        <div><label>Art</label><select value={e.type} onChange={set('type')}>{HEALTH_TYPES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
        <div><label>Schwere</label><select value={e.severity} onChange={set('severity')}><option value={1}>leicht</option><option value={2}>mittel</option><option value={3}>schwer</option></select></div>
        <div><label>Beginn</label><input type="date" value={e.start} onChange={set('start')} /></div>
        <div><label>Ende (leer = aktuell)</label><input type="date" value={e.end || ''} onChange={set('end')} /></div>
      </div>
      <label>Bezeichnung</label><input value={e.title} onChange={set('title')} placeholder="z. B. Erkältung, Schienbeinkante" />
      <label>Körperstelle</label><input value={e.bodyPart} onChange={set('bodyPart')} placeholder="optional" />
      <label>Auswirkung aufs Training</label><select value={e.impact} onChange={set('impact')}><option value="pause">kein Training</option><option value="reduced">eingeschränkt</option><option value="none">normal möglich</option></select>
      <label>Notizen (Behandlung, Auslöser)</label><textarea value={e.notes} onChange={set('notes')} />
      <div className="row" style={{ marginTop: 12 }}>
        <button className="primary" onClick={save}>Speichern</button>
        {initial.title !== undefined && <button className="danger" onClick={remove}><Trash2 size={17} />Löschen</button>}
      </div>
    </Sheet>
  );
}

// Für „Heute“: laufende Krankheit/Verletzung.
export function HealthBanner({ go }) {
  const { health, settings } = useData();
  const t = today(settings.timezone);
  const cur = health.filter((e) => !e.end || e.end >= t);
  if (!cur.length) return null;
  return cur.map((e) => <button key={e.id} className="notice" style={{ width: '100%', textAlign: 'left', border: 0, background: 'var(--badbg)', color: 'var(--bad)' }} onClick={() => go('more')}><HeartCrack size={14} /> {e.title || 'Ausfall'} seit {healthDays({ ...e, end: null }, t)} Tagen{e.impact === 'pause' ? ' – Trainingspause' : e.impact === 'reduced' ? ' – eingeschränkt' : ''}</button>);
}

