import React, { useState } from 'react';
import { ChefHat, Heart, ShoppingCart } from 'lucide-react';
import { useData, update, uid } from '../lib/store.js';
import { today } from '../lib/activities.js';
import { addDays } from '../lib/metrics.js';
import { sportLabel } from '../lib/sports.js';
import { dayTargets } from '../lib/nutrition.js';
import { kiPost } from '../lib/ai.js';
import { Sheet, Seg, fmtDate, toast } from './common.jsx';

const HARD = ['I3', 'I4', 'I5'];

// Training je Tag: erledigte Einheiten + offene Planung.
function trainingOf(date, activities, plan) {
  const done = activities.filter((a) => a.date === date).map((a) => ({ sport: a.sport, minutes: Math.round((a.durationS || 0) / 60), hard: Math.round(((a.zones?.I3 || 0) + (a.zones?.I4 || 0) + (a.zones?.I5 || 0)) / 60), title: a.title, time: new Date(a.start).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) }));
  const planned = plan.filter((p) => p.date === date && !p.done).map((p) => ({ sport: p.sport, minutes: p.minutes, hard: HARD.includes(p.zone) ? p.minutes : 0, title: p.title, planned: true }));
  return [...done, ...planned];
}

export function Food() {
  const { activities, plan, settings, food, recipes } = useData();
  const t = today(settings.timezone);
  const [days, setDays] = useState(3);
  const [view, setView] = useState('plan');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [recipe, setRecipe] = useState(null);
  const prefs = settings.food || {};
  const setPref = (k, v) => update((d) => ({ ...d, settings: { ...d.settings, food: { ...(d.settings.food || {}), [k]: v } } }));
  const weight = Number(settings.weightKg);

  const dayList = Array.from({ length: days }, (_, i) => addDays(t, i)).map((date) => {
    const tr = trainingOf(date, activities, plan);
    const minutes = tr.reduce((a, x) => a + x.minutes, 0), hard = tr.reduce((a, x) => a + x.hard, 0);
    return { date, training: tr, targets: dayTargets({ weightKg: weight, minutes, hardMinutes: hard, strength: tr.some((x) => x.sport === 'strength'), longestMinutes: Math.max(0, ...tr.filter((x) => x.sport !== 'strength').map((x) => x.minutes)) }) };
  });

  const generate = async () => {
    setBusy(true); setError('');
    try {
      const tage = dayList.map((d) => ({ datum: d.date, training: d.training.map((x) => ({ sport: sportLabel(x.sport), minuten: x.minutes, davonHartMin: x.hard, titel: x.title, uhrzeit: x.time || prefs.trainingTime || undefined })), ziele: d.targets && { kcal: d.targets.kcal, khG: d.targets.carbs, eiweissG: d.targets.protein, fettG: d.targets.fat, khProStundeImTraining: d.targets.duringPerHour } }));
      const vorlieben = { ernaehrungsform: prefs.diet || 'alles', unvertraeglichkeiten: prefs.avoid || '', mag: prefs.likes || '', kochzeitMinMax: Number(prefs.cookTime) || 30, mahlzeitenProTag: Number(prefs.meals) || 5, portionenFuer: Number(prefs.people) || 1, budget: prefs.budget || 'normal', gewichtKg: weight || undefined, lieblingsrezepte: recipes.slice(-10).map((r) => r.name) };
      const result = await kiPost('/api/ernaehrung', { tage, vorlieben });
      update((d) => ({ ...d, food: { id: uid(), created: t, ...result } }));
      setView('plan');
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };

  const recipeByName = (n) => food?.rezepte?.find((r) => r.name === n) || recipes.find((r) => r.name === n);
  const fav = (r) => {
    const has = recipes.some((x) => x.name === r.name);
    update((d) => ({ ...d, recipes: has ? d.recipes.filter((x) => x.name !== r.name) : [...d.recipes, r] }));
    toast(has ? 'Aus Favoriten entfernt' : 'Zu Favoriten hinzugefügt');
  };

  return (
    <>
      <h1>Ernährung</h1>
      {!weight && <div className="notice">Trag unter „Mehr → Einstellungen → Athlet“ dein Gewicht ein, dann rechnet die App deinen Bedarf aus.</div>}
      {dayList.map((d) => d.targets && (
        <div key={d.date} className="item">
          <div className="grow"><b>{fmtDate(d.date)}</b> <span className={`badge ${d.targets.level === 'hoch' ? 'b-achtung' : d.targets.level === 'mittel' ? 'b-info' : 'b-gut'}`}>Bedarf {d.targets.level}</span>
            <p>{d.training.length ? d.training.map((x) => `${x.minutes}′ ${sportLabel(x.sport)}${x.planned ? ' (Plan)' : ''}`).join(', ') : 'Kein Training'}</p>
            <p>KH {d.targets.carbs} g ({String(d.targets.perKg.carbs).replace('.', ',')} g/kg) · Eiweiß {d.targets.protein} g · Fett {d.targets.fat} g{d.targets.duringPerHour ? ` · im Training ${d.targets.duringPerHour} g KH/h` : ''}</p></div>
          <span className="num">{d.targets.kcal}<span className="muted small"> kcal</span></span>
        </div>
      ))}

      <details className="card">
        <summary><b>Vorlieben</b> <span className="muted small">{prefs.diet || 'alles'} · max. {prefs.cookTime || 30} min</span></summary>
        <div className="grid2">
          <div><label>Ernährungsform</label><select value={prefs.diet || 'alles'} onChange={(e) => setPref('diet', e.target.value)}>{['alles', 'vegetarisch', 'vegan', 'pescetarisch', 'wenig Fleisch'].map((o) => <option key={o}>{o}</option>)}</select></div>
          <div><label>Kochzeit max. (min)</label><input type="number" value={prefs.cookTime || 30} onChange={(e) => setPref('cookTime', e.target.value)} /></div>
          <div><label>Mahlzeiten pro Tag</label><input type="number" value={prefs.meals || 5} onChange={(e) => setPref('meals', e.target.value)} /></div>
          <div><label>Portionen für Personen</label><input type="number" value={prefs.people || 1} onChange={(e) => setPref('people', e.target.value)} /></div>
          <div><label>Übliche Trainingszeit</label><input value={prefs.trainingTime || ''} onChange={(e) => setPref('trainingTime', e.target.value)} placeholder="z. B. 7:00 und 17:00" /></div>
          <div><label>Budget</label><select value={prefs.budget || 'normal'} onChange={(e) => setPref('budget', e.target.value)}>{['günstig', 'normal', 'egal'].map((o) => <option key={o}>{o}</option>)}</select></div>
        </div>
        <label>Unverträglichkeiten / mag ich nicht</label><input value={prefs.avoid || ''} onChange={(e) => setPref('avoid', e.target.value)} />
        <label>Mag ich besonders</label><input value={prefs.likes || ''} onChange={(e) => setPref('likes', e.target.value)} />
      </details>

      <div className="row">
        <Seg value={String(days)} onChange={(v) => setDays(Number(v))} options={[['1', '1 Tag'], ['3', '3 Tage'], ['7', '7 Tage']]} />
      </div>
      <button className="primary wide" onClick={generate} disabled={busy || !weight} style={{ marginTop: 10 }}><ChefHat size={18} className={busy ? 'spin' : ''} />{busy ? 'Plane Mahlzeiten …' : 'Essensplan mit Rezepten erstellen'}</button>
      {error && <div className="notice" style={{ color: 'var(--bad)' }}>{error}</div>}

      {(food || recipes.length > 0) && <div style={{ marginTop: 16 }}><Seg value={view} onChange={setView} options={[['plan', 'Plan'], ['shop', 'Einkauf'], ['fav', `Favoriten (${recipes.length})`]]} /></div>}
      {view === 'plan' && food && <>
        {food.tage.map((d) => (
          <div key={d.datum} className="card">
            <h3 style={{ marginTop: 0 }}>{fmtDate(d.datum)}</h3>
            {d.mahlzeiten.map((m, i) => (
              <button key={i} className="item" onClick={() => setRecipe(recipeByName(m.rezept))}>
                <div className="grow"><b>{m.typ}</b> <span className="muted small">{m.zeit}</span><p>{m.rezept}{m.portionen !== 1 ? ` · ${m.portionen} Portion(en)` : ''}</p></div>
              </button>
            ))}
          </div>
        ))}
        {food.hinweise?.length > 0 && <div className="notice">{food.hinweise.map((h, i) => <div key={i}>• {h}</div>)}</div>}
      </>}
      {view === 'shop' && food && <ShoppingList items={food.einkaufsliste} planId={food.id} />}
      {view === 'fav' && recipes.map((r) => <button key={r.name} className="item" onClick={() => setRecipe(r)}><div className="grow"><b>{r.name}</b><p>{r.zeitMin} min · {r.makros.kcal} kcal · KH {r.makros.kh} g · Eiweiß {r.makros.eiweiss} g</p></div></button>)}
      {recipe && <RecipeSheet r={recipe} onClose={() => setRecipe(null)} isFav={recipes.some((x) => x.name === recipe.name)} onFav={() => fav(recipe)} />}
      <p className="muted small">Bedarf nach IOC-Konsens und Positionspapieren (Thomas, Erdman & Burke 2016): Kohlenhydrate nach Umfang, Eiweiß 1,6–2,0 g/kg, im langen Training 60–90 g KH pro Stunde. Richtwerte, keine medizinische Beratung.</p>
    </>
  );
}

function ShoppingList({ items, planId }) {
  const key = 'trainings-app-shop-' + planId;
  const [done, setDone] = useState(() => { try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch { return []; } });
  const toggle = (z) => { const n = done.includes(z) ? done.filter((x) => x !== z) : [...done, z]; setDone(n); try { localStorage.setItem(key, JSON.stringify(n)); } catch { /* nur Komfort */ } };
  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}><ShoppingCart size={16} /> Einkaufsliste</h3>
      {items.map((it) => (
        <label key={it.zutat} style={{ display: 'flex', gap: 10, alignItems: 'center', fontWeight: 400, margin: '8px 0', textDecoration: done.includes(it.zutat) ? 'line-through' : 'none', opacity: done.includes(it.zutat) ? 0.5 : 1 }}>
          <input type="checkbox" checked={done.includes(it.zutat)} onChange={() => toggle(it.zutat)} style={{ width: 20, height: 20 }} />
          <span className="grow">{it.zutat}</span><span className="muted">{it.menge}</span>
        </label>
      ))}
    </div>
  );
}

function RecipeSheet({ r, onClose, isFav, onFav }) {
  if (!r) return null;
  return (
    <Sheet title={r.name} onClose={onClose}>
      <div className="macro"><span>{r.zeitMin} min</span><span>{r.portionen} Portion(en)</span><span>pro Portion: {r.makros.kcal} kcal</span><span>KH {r.makros.kh} g</span><span>Eiweiß {r.makros.eiweiss} g</span><span>Fett {r.makros.fett} g</span></div>
      <div className="chips">{r.tags?.map((t) => <span key={t} className="chip">{t}</span>)}</div>
      <div className="recipe">
        <h3>Zutaten</h3><ul>{r.zutaten.map((z, i) => <li key={i}>{z.menge} {z.zutat}</li>)}</ul>
        <h3>Zubereitung</h3><ol>{r.schritte.map((s, i) => <li key={i}>{s}</li>)}</ol>
      </div>
      <button className={isFav ? 'secondary wide' : 'primary wide'} onClick={onFav}><Heart size={17} fill={isFav ? 'currentColor' : 'none'} />{isFav ? 'Aus Favoriten entfernen' : 'Als Favorit speichern'}</button>
    </Sheet>
  );
}
