import React, { useMemo, useState } from 'react';
import { Utensils, Clock, Flag, Backpack, Lightbulb, Check } from 'lucide-react';
import { useData, update } from '../lib/store.js';
import { racePlan, lessons, estimateMinutes } from '../lib/race-plan.js';
import { parseTime, fmtTime } from '../lib/season.js';
import { Sheet, toast } from './common.jsx';

// Rennplan: Verpflegung, Zeitplan am Renntag, Pacing und Packliste – Eingaben werden am Rennen gespeichert.
export function RacePlanSheet({ race, onClose }) {
  const { settings, races } = useData();
  const saved = race.plan || {};
  const [f, setF] = useState({ target: saved.target || '', startTime: saved.startTime || '09:00', tempC: saved.tempC ?? '-5', feedKm: saved.feedKm || '', gelG: saved.gelG || 25, caffeine: !!saved.caffeine, mode: saved.mode || 'carry', bottleMl: saved.bottleMl || 600, bottleCarbG: saved.bottleCarbG ?? 60, bottles: saved.bottles || 1 });
  const set = (k, v) => setF({ ...f, [k]: v });
  const targetS = parseTime(f.target);
  const sweat = settings.food?.sweat || null;
  const p = useMemo(() => racePlan(race, { weightKg: settings.weightKg, minutes: targetS ? targetS / 60 : null, startTime: f.startTime, tempC: f.tempC, feedKm: f.feedKm, gelG: f.gelG, caffeine: f.caffeine, sweat, mode: f.mode, bottleMl: f.bottleMl, bottleCarbG: f.bottleCarbG, bottles: f.bottles }), [race, settings.weightKg, targetS, f, sweat]);
  const learned = lessons(races, race.date);
  const save = () => { update((d) => ({ ...d, races: d.races.map((r) => (r.id === race.id ? { ...r, plan: f } : r)) })); toast('Rennplan gespeichert'); };
  return (
    <Sheet title={`Rennplan: ${race.name || 'Rennen'}`} onClose={onClose}>
      <div className="grid2">
        <div><label>Zielzeit (h:mm:ss)</label><input value={f.target} onChange={(e) => set('target', e.target.value)} placeholder={`ca. ${fmtTime(estimateMinutes(race) * 60)}`} /></div>
        <div><label>Startzeit</label><input type="time" value={f.startTime} onChange={(e) => set('startTime', e.target.value)} /></div>
        <div><label>Temperatur (°C)</label><input inputMode="decimal" value={f.tempC} onChange={(e) => set('tempC', e.target.value)} /></div>
        <div><label>Gel-Größe (g KH)</label><input inputMode="numeric" value={f.gelG} onChange={(e) => set('gelG', e.target.value)} /></div>
      </div>
      <label>Verpflegung</label>
      <select value={f.mode} onChange={(e) => set('mode', e.target.value)}>
        <option value="carry">Eigene Verpflegung (Coxa Carry / Trinkgürtel + Gels)</option>
        <option value="mixed">Eigene Verpflegung + Verpflegungsstellen zum Auffüllen</option>
        <option value="stations">Nur Verpflegungsstellen + Gels</option>
      </select>
      {f.mode !== 'carry' && <><label>Verpflegungsstellen (km, mit Komma)</label><input value={f.feedKm} onChange={(e) => set('feedKm', e.target.value)} placeholder="z. B. 12, 25, 36" /></>}
      {f.mode !== 'stations' && <div className="grid3">
        <div><label>Flasche (ml)</label><input inputMode="numeric" value={f.bottleMl} onChange={(e) => set('bottleMl', e.target.value)} /></div>
        <div><label>KH pro Flasche (g)</label><input inputMode="numeric" value={f.bottleCarbG} onChange={(e) => set('bottleCarbG', e.target.value)} /></div>
        <div><label>Flaschen</label><input inputMode="numeric" value={f.bottles} onChange={(e) => set('bottles', e.target.value)} /></div>
      </div>}
      <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 400 }}><input type="checkbox" checked={f.caffeine} onChange={(e) => set('caffeine', e.target.checked)} style={{ width: 18, height: 18 }} />Koffein einplanen (nur wenn im Training getestet)</label>
      <p className="muted small">{race.distanceKm ? `${race.distanceKm} km · ` : ''}{race.technique} · geschätzt {fmtTime(p.minutes * 60)} h, Ziel ca. {p.finish} Uhr{sweat ? ' · mit deiner Schweißrate' : ' · Tipp: Schweißrate unter Essen → Wissen messen'}.</p>

      {learned.length > 0 && <div className="notice"><Lightbulb size={14} /> <b>Aus früheren Rennen:</b>{learned.map((l) => <div key={l.date} className="small">{l.name}: {l.text}</div>)}</div>}

      <h3><Utensils size={16} /> Verpflegung unterwegs</h3>
      {p.carbPerHour ? <p className="small">Ziel: <b>{p.carbPerHour} g Kohlenhydrate pro Stunde</b>{p.carbPerHour >= 90 ? ' (Glukose + Fruktose, nur wenn im Training geübt – sonst 60 g)' : ''}{p.fluid ? ` · trinken ca. ${p.fluid.perHour} ml/h (gesamt ca. ${String(p.fluid.total / 1000).replace('.', ',')} l) mit ca. ${p.fluid.sodiumPerL} mg Natrium/l` : ''}.</p> : <p className="small">Bei dieser Dauer brauchst du unterwegs nichts – volle Speicher vom Vortag und die Vorstartmahlzeit reichen.</p>}
      {p.carry && <p className="small">Getränk liefert ca. <b>{p.carry.fromDrink} g</b> Kohlenhydrate, dazu {p.gels} Gel(s){p.fluid ? ` · Flasche deckt ca. ${p.carry.fluidShare} % des Trinkbedarfs` : ''}.{p.carry.fluidShare != null && p.carry.fluidShare < 70 && Number(f.tempC) > 0 ? ' Bei diesen Temperaturen eher zu wenig – zweite Flasche, Becher an Stationen oder Betreuer einplanen.' : ''}{p.carry.perBottleNoGels ? ` Ganz ohne Gels: ca. ${p.carry.perBottleNoGels} g KH pro Flasche.` : ''}{p.carry.bottleCarb / p.carry.bottleMl > 0.16 ? ' Achtung: über ca. 16 % (80 g pro 500 ml) wird das Getränk für den Magen sehr konzentriert – nur mit Hydrogel und Übung.' : ''}</p>}
      {p.during.length > 0 && <table className="t"><thead><tr><th>Min</th><th>km</th><th>Was</th></tr></thead><tbody>{p.during.map((d, i) => <tr key={i}><td>{d.min}′</td><td>{d.km ?? '–'}</td><td>{d.what}</td></tr>)}</tbody></table>}
      {p.cold && <p className="muted small">Kälte: Gels nah am Körper tragen, Getränk warm in der Thermoflasche; ein Kohlenhydrat-Hydrogel bleibt bei Minusgraden flüssiger.</p>}

      <h3><Clock size={16} /> Ablauf</h3>
      {p.steps.map((s) => <div key={s.title} className="item" style={{ alignItems: 'flex-start' }}><b style={{ flex: '0 0 74px', fontSize: 13 }}>{s.when}</b><div className="grow"><b>{s.title}</b><p>{s.text}</p></div></div>)}

      {p.splits.length > 0 && <>
        <h3><Flag size={16} /> Zwischenzeiten (gleichmäßig)</h3>
        <table className="t"><thead><tr><th>km</th><th>Zeit</th><th>Uhrzeit</th></tr></thead><tbody>{p.splits.map((x) => <tr key={x.km}><td>{x.km}</td><td>{x.time}</td><td>{x.clock}</td></tr>)}</tbody></table>
        <p className="muted small">Erstes Drittel lieber etwas langsamer, dann gleichmäßig – ein zu schneller Start kostet hinten mehr, als er vorne bringt.</p>
      </>}

      <h3><Backpack size={16} /> Packliste</h3>
      <ul className="small" style={{ paddingLeft: 18 }}>{p.pack.map((x) => <li key={x}>{x}</li>)}</ul>
      <p className="muted small">Richtwerte nach ACSM/AND/DC-Positionspapier (Thomas, Erdman & Burke 2016) und Jeukendrup 2014; Koffein nach ISSN (Guest et al. 2021). Neue Produkte oder Mengen nie zum ersten Mal im Rennen.</p>
      <button className="primary wide" onClick={save}><Check size={17} />Eingaben speichern</button>
    </Sheet>
  );
}

const SCALE = ['sehr schlecht', 'schlecht', 'okay', 'gut', 'super'];
// Rennbericht: Bedingungen, Material, Verpflegung, Gefühl, Erkenntnis – fließt in künftige Rennpläne ein.
export function RaceReport({ report = {}, onChange }) {
  const set = (k, v) => onChange({ ...report, [k]: v });
  return (
    <>
      <h3>Rennbericht</h3>
      <div className="grid2">
        <div><label>Temperatur (°C)</label><input inputMode="decimal" value={report.tempC ?? ''} onChange={(e) => set('tempC', e.target.value)} /></div>
        <div><label>Schnee / Spur</label><input value={report.snow ?? ''} onChange={(e) => set('snow', e.target.value)} placeholder="z. B. Neuschnee, eisig, nass" /></div>
        <div><label>Ski / Wachs</label><input value={report.wax ?? ''} onChange={(e) => set('wax', e.target.value)} placeholder="z. B. Ski 2, Fluorfrei kalt" /></div>
        <div><label>Ski-Gefühl</label><select value={report.skiFeel ?? ''} onChange={(e) => set('skiFeel', e.target.value)}><option value="">–</option>{SCALE.map((s, i) => <option key={s} value={i + 1}>{s}</option>)}</select></div>
        <div><label>Energie hinten raus</label><select value={report.energy ?? ''} onChange={(e) => set('energy', e.target.value)}><option value="">–</option>{SCALE.map((s, i) => <option key={s} value={i + 1}>{s}</option>)}</select></div>
        <div><label>Magen</label><select value={report.stomach ?? ''} onChange={(e) => set('stomach', e.target.value)}><option value="">–</option><option value="ok">problemlos</option><option value="leicht">leichte Probleme</option><option value="stark">starke Probleme</option></select></div>
      </div>
      <label>Verpflegung: was genommen, was hat funktioniert?</label><input value={report.nutritionNote ?? ''} onChange={(e) => set('nutritionNote', e.target.value)} placeholder="z. B. 4 Gels + 2 Becher, ab km 30 leer" />
      <label>Was lief gut, was nicht?</label><textarea value={report.notes ?? ''} onChange={(e) => set('notes', e.target.value)} />
      <label>Wichtigste Erkenntnis fürs nächste Rennen</label><input value={report.lesson ?? ''} onChange={(e) => set('lesson', e.target.value)} placeholder="z. B. Start ruhiger, früher essen" />
      <p className="muted small">Erkenntnis und Verpflegungsnotiz erscheinen im Rennplan der nächsten Rennen.</p>
    </>
  );
}
