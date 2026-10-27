import React, { useMemo, useState } from 'react';
import { ChefHat, Heart, ShoppingCart, Shuffle, Sun, Lightbulb, Search } from 'lucide-react';
import { useData, update, uid } from '../lib/store.js';
import { today } from '../lib/activities.js';
import { addDays } from '../lib/metrics.js';
import { sportLabel } from '../lib/sports.js';
import { dayTargets, planDay } from '../lib/nutrition.js';
import { trainingOf, tipsFor, mealTimes } from '../lib/food-day.js';
import { fmtTime } from '../lib/week-adapt.js';
import { CATALOG, SLOTS, CONTEXTS, filterCatalog, toRecipe, recipeNutrients, highlights } from '../lib/recipes.js';
import { NUTRIENTS, REFERENCE } from '../lib/foods.js';
import { GUIDE, NUTRITION_SOURCES, sweatRate } from '../lib/nutrition-guide.js';
import { kiPost } from '../lib/ai.js';
import { Sheet, Seg, fmtDate, toast } from './common.jsx';
import { AiQuality, AiCost, aiChoice, logAiCost } from './ai-quality.jsx';

export function Food() {
  const data = useData();
  const { settings, food, recipes } = data;
  const t = today(settings.timezone);
  const [view, setView] = useState('heute');
  const [recipe, setRecipe] = useState(null);
  const prefs = settings.food || {};
  const setPref = (k, v) => update((d) => ({ ...d, settings: { ...d.settings, food: { ...(d.settings.food || {}), [k]: v } } }));
  const weight = Number(settings.weightKg);
  const heat = prefs.heatDate === t;
  const tips = useMemo(() => tipsFor(data, t), [data, t]);

  const dayList = Array.from({ length: 3 }, (_, i) => addDays(t, i)).map((date) => {
    const tr = trainingOf(date, data);
    const end = tr.filter((x) => x.sport !== 'strength');
    return { date, training: tr, targets: dayTargets({ weightKg: weight, minutes: end.reduce((a, x) => a + x.minutes, 0), hardMinutes: tr.reduce((a, x) => a + x.hard, 0), strength: tr.some((x) => x.sport === 'strength'), longestMinutes: Math.max(0, ...end.map((x) => x.minutes)) }) };
  });

  const fav = (r) => {
    const has = recipes.some((x) => x.name === r.name);
    update((d) => ({ ...d, recipes: has ? d.recipes.filter((x) => x.name !== r.name) : [...d.recipes, r] }));
    toast(has ? 'Aus Favoriten entfernt' : 'Zu Favoriten hinzugefügt');
  };

  return (
    <>
      <h1>Ernährung</h1>
      {!weight && <div className="notice">Trag unter „Mehr → Einstellungen → Athlet“ dein Gewicht ein, dann rechnet die App deinen Bedarf aus und passt die Rezeptmengen an.</div>}

      <div className="card">
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, flex: 'none' }}><Lightbulb size={16} /> Ernährungstipp heute</h3>
          <button className={`chip${heat ? ' on' : ''}`} style={{ flex: 'none' }} onClick={() => setPref('heatDate', heat ? null : t)}><Sun size={13} /> Heute heiß</button>
        </div>
        {tips.map((x, i) => <div key={i} style={{ marginTop: 10 }}><b className="small">{x.title}</b><p className="small" style={{ margin: '2px 0 0' }}>{x.text}</p></div>)}
      </div>

      {dayList.map((d) => d.targets && (
        <div key={d.date} className="item">
          <div className="grow"><b>{fmtDate(d.date)}</b> <span className={`badge ${d.targets.level === 'hoch' ? 'b-achtung' : d.targets.level === 'mittel' ? 'b-info' : 'b-gut'}`}>Bedarf {d.targets.level}</span>
            <p>{d.training.length ? d.training.map((x) => `${x.minutes}′ ${x.race ? 'Rennen' : sportLabel(x.sport)}${x.planned && !x.race ? ' (Plan)' : ''}`).join(', ') : 'Kein Training'}</p>
            <p>KH {d.targets.carbs} g ({String(d.targets.perKg.carbs).replace('.', ',')} g/kg) · Eiweiß {d.targets.protein} g · Fett {d.targets.fat} g{d.targets.duringPerHour ? ` · im Training ${d.targets.duringPerHour} g KH/h` : ''}</p></div>
          <span className="num">{d.targets.kcal}<span className="muted small"> kcal</span></span>
        </div>
      ))}

      <div style={{ marginTop: 14 }}><Seg value={view} onChange={setView} options={[['heute', 'Tagesplan'], ['katalog', `Rezepte (${CATALOG.length})`], ['wissen', 'Wissen'], ['ki', 'KI-Plan'], ['fav', `Favoriten (${recipes.length})`]]} /></div>
      {view === 'heute' && <DaySuggestion data={data} t={t} prefs={prefs} weight={weight} open={setRecipe} />}
      {view === 'katalog' && <Catalog prefs={prefs} weight={weight} open={setRecipe} sex={settings.sex} />}
      {view === 'wissen' && <Knowledge prefs={prefs} setPref={setPref} />}
      {view === 'ki' && <AiPlan data={data} t={t} prefs={prefs} setPref={setPref} weight={weight} open={setRecipe} />}
      {view === 'fav' && (recipes.length ? recipes.map((r) => <button key={r.name} className="item" onClick={() => setRecipe(r)}><div className="grow"><b>{r.name}</b><p>{r.zeitMin} min · {r.makros.kcal} kcal · KH {r.makros.kh} g · Eiweiß {r.makros.eiweiss} g</p></div></button>) : <p className="muted">Noch keine Favoriten – im Rezept auf das Herz tippen.</p>)}
      {recipe && <RecipeSheet r={recipe} onClose={() => setRecipe(null)} isFav={recipes.some((x) => x.name === recipe.name)} onFav={() => fav(recipe)} sex={settings.sex} />}
      <p className="muted small">Bedarf nach IOC-Konsens und Positionspapieren (Thomas, Erdman & Burke 2016). Nährwerte der Rezepte aus einer Lebensmitteltabelle berechnet (Richtwerte). Keine medizinische Beratung.</p>
    </>
  );
}

// Tagesplan aus dem Katalog: Bedarf je nach Einheiten auf die Mahlzeiten verteilt, Portionen darauf berechnet.
function DaySuggestion({ data, t, prefs, weight, open }) {
  const [date, setDate] = useState(t);
  const [seed, setSeed] = useState(() => Number(t.replaceAll('-', '')) % 97);
  const [offsets, setOffsets] = useState({});
  const days = Array.from({ length: 7 }, (_, i) => addDays(t, i));
  const today = trainingOf(date, data), tomorrow = trainingOf(addDays(date, 1), data);
  const end = today.filter((x) => x.sport !== 'strength');
  const targets = dayTargets({ weightKg: weight, minutes: end.reduce((a, x) => a + x.minutes, 0), hardMinutes: today.reduce((a, x) => a + x.hard, 0), strength: today.some((x) => x.sport === 'strength'), longestMinutes: Math.max(0, ...end.map((x) => x.minutes)) });
  const plan = planDay({ today, tomorrow, targets, weightKg: weight, diet: prefs.diet || 'alles', heat: prefs.heatDate === date, seed, trainLow: prefs.trainLow !== false, offsets });
  const pick = (d) => { setDate(d); setOffsets({}); };
  const Bar = ({ label, got, goal, unit }) => {
    const pct = goal ? got / goal : 0;
    return (
      <div className="row" style={{ alignItems: 'center', fontSize: 12, margin: '3px 0', flexWrap: 'nowrap' }}>
        <span style={{ flex: '0 0 92px' }}>{label}</span>
        <span style={{ flex: 1, height: 8, background: 'var(--line)', borderRadius: 4, overflow: 'hidden' }}><i style={{ display: 'block', height: '100%', width: `${Math.min(1, pct) * 100}%`, background: pct >= 0.9 && pct <= 1.15 ? 'var(--good)' : 'var(--form)' }} /></span>
        <span className="muted nowrap" style={{ flex: '0 0 auto', minWidth: 110, textAlign: 'right' }}>{Math.round(got)} / {Math.round(goal)} {unit}</span>
      </div>
    );
  };
  return (
    <>
      <div className="chips" style={{ marginTop: 10 }}>{days.map((d) => <button key={d} className={`chip${d === date ? ' on' : ''}`} onClick={() => pick(d)}>{d === t ? 'Heute' : fmtDate(d, { weekday: 'short', day: 'numeric' })}</button>)}</div>
      <p className="muted small">{today.length ? today.map((x) => `${x.time ? x.time + ' ' : ''}${x.minutes}′ ${x.race ? 'Rennen' : sportLabel(x.sport)}${x.hard ? ` (${x.hard}′ hart)` : ''}`).join(' · ') : 'Kein Training'}{tomorrow.length ? ` · morgen: ${tomorrow.map((x) => `${x.minutes}′ ${x.race ? 'Rennen' : sportLabel(x.sport)}`).join(', ')}` : ''}. Uhrzeiten aus den Einheiten, dem Alltag (Kalender → Alltag) oder „Übliche Trainingszeit“ (KI-Plan → Vorlieben); Essenszeiten richten sich danach.</p>
      {plan.totals && <div className="card">
        <b className="small">Tag gesamt (Portionen unten eingerechnet)</b>
        <Bar label="Energie" got={plan.totals.kcal} goal={plan.targets.kcal} unit="kcal" />
        <Bar label="Kohlenhydrate" got={plan.totals.kh} goal={plan.targets.carbs} unit="g" />
        <Bar label="Eiweiß" got={plan.totals.eiweiss} goal={plan.targets.protein} unit="g" />
        <Bar label="Fett" got={plan.totals.fett} goal={plan.targets.fat} unit="g" />
        {plan.extras?.map((e, i) => <p key={i} className="small" style={{ margin: '6px 0 0' }}>• {e}</p>)}
      </div>}
      {mealTimes(plan.meals, today, date, data.settings.schedule).map((m, i) => (
        <div key={i} className="item">
          <button className="grow ghost" style={{ display: 'block', textAlign: 'left', padding: 0, color: 'var(--ink)', fontWeight: 400 }} onClick={() => open(toRecipe(m.r, weight, m.factor))}>
            <span className="muted small">{m.time != null && <b>{fmtTime(m.time)} · </b>}{m.label}{m.takeaway && <span className="badge b-info" style={{ marginLeft: 6 }}>zum Mitnehmen ({m.takeaway})</span>}</span><b style={{ display: 'block' }}>{m.r.name}</b>
            <p style={{ margin: 0 }}>{String(m.factor).replace('.', ',')}× Portion · {m.got ? `${Math.round(m.got.kcal)} kcal · KH ${Math.round(m.got.kh)} g${m.goal ? ` (Ziel ${Math.round(m.goal.kh)})` : ''} · Eiweiß ${Math.round(m.got.eiweiss)} g` : `${m.r.min} min`}</p>
          </button>
          <button className="ghost" style={{ flex: 'none' }} aria-label="Anderes Rezept" title="Anderes Rezept" onClick={() => setOffsets({ ...offsets, [m.role]: (offsets[m.role] || 0) + 1 })}><Shuffle size={16} /></button>
        </div>
      ))}
      <p className="small muted">So rechnet der Plan: rund ums Training feste Kohlenhydratmengen (vor harten Einheiten ca. 1–1,5 g/kg, unterwegs nach Dauer, danach ca. 1 g/kg), Eiweiß 0,3–0,4 g/kg pro Hauptmahlzeit, der Rest des Tagesbedarfs auf Mittag, Abend und Snacks – vor harten Tagen mehr am Abend, vor Train Low weniger. Die Portionen werden darauf skaliert.</p>
      <button className="secondary wide" onClick={() => { setSeed(seed + 1); setOffsets({}); }}><Shuffle size={16} />Alle Rezepte neu mischen</button>
    </>
  );
}

function Catalog({ prefs, weight, open, sex }) {
  const [slot, setSlot] = useState('');
  const [ctx, setCtx] = useState('');
  const [q, setQ] = useState('');
  const list = filterCatalog({ slot, ctx, diet: prefs.diet || 'alles', q });
  return (
    <>
      <div className="grid2" style={{ marginTop: 10 }}>
        <div><label>Wann</label><select value={slot} onChange={(e) => setSlot(e.target.value)}><option value="">alle</option>{SLOTS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
        <div><label>Situation</label><select value={ctx} onChange={(e) => setCtx(e.target.value)}><option value="">alle</option>{CONTEXTS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
      </div>
      <div style={{ position: 'relative' }}><Search size={15} style={{ position: 'absolute', left: 10, top: 13, color: 'var(--muted)' }} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Suchen, z. B. Lachs, Haferflocken" style={{ paddingLeft: 32 }} /></div>
      <p className="muted small">{list.length} Rezepte{prefs.diet && prefs.diet !== 'alles' ? ` · ${prefs.diet} (Vorlieben im KI-Plan)` : ''}</p>
      {list.map((r) => {
        const n = recipeNutrients(r, weight), hl = highlights(n, sex, 0.3).slice(0, 3);
        return (
          <button key={r.id} className="item" onClick={() => open(toRecipe(r, weight))}>
            <div className="grow"><b>{r.name}</b>
              <p>{r.min} min · {Math.round(n.kcal)} kcal · KH {Math.round(n.kh)} g · Eiweiß {Math.round(n.eiweiss)} g · Fett {Math.round(n.fett)} g</p>
              {hl.length > 0 && <div className="chips" style={{ margin: '4px 0 0' }}>{hl.map((h) => <span key={h.key} className="badge b-gut">{h.label} {Math.round(h.pct * 100)} %</span>)}</div>}
            </div>
          </button>
        );
      })}
    </>
  );
}

function Knowledge({ prefs, setPref }) {
  const [f, setF] = useState({ before: '', after: '', drankMl: '', minutes: '60', salty: false, ...(prefs.sweatInput || {}) });
  const res = sweatRate(f);
  const save = () => { setPref('sweat', res); setPref('sweatInput', f); toast('Schweißrate gespeichert – die Tipps nutzen sie jetzt'); };
  return (
    <>
      <div className="card" style={{ marginTop: 10 }}>
        <h3 style={{ marginTop: 0 }}>Schweißraten-Rechner</h3>
        <p className="muted small">Vor und nach einer Einheit nackt wiegen (abgetrocknet), Getrunkenes eintragen. Am besten bei typischen Bedingungen und noch einmal bei Hitze.</p>
        <div className="grid2">
          <div><label>Gewicht vorher (kg)</label><input inputMode="decimal" value={f.before} onChange={(e) => setF({ ...f, before: e.target.value.replace(',', '.') })} /></div>
          <div><label>Gewicht nachher (kg)</label><input inputMode="decimal" value={f.after} onChange={(e) => setF({ ...f, after: e.target.value.replace(',', '.') })} /></div>
          <div><label>Getrunken (ml)</label><input inputMode="numeric" value={f.drankMl} onChange={(e) => setF({ ...f, drankMl: e.target.value })} /></div>
          <div><label>Dauer (min)</label><input inputMode="numeric" value={f.minutes} onChange={(e) => setF({ ...f, minutes: e.target.value })} /></div>
        </div>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 400 }}><input type="checkbox" checked={f.salty} onChange={(e) => setF({ ...f, salty: e.target.checked })} style={{ width: 18, height: 18 }} />Salzige Schweißränder auf der Kleidung</label>
        {res && <div className="notice">
          Schweißrate <b>{String(res.perHour).replace('.', ',')} l/h</b> · Gewichtsverlust {String(res.lossPct).replace('.', ',')} %{res.lossPct > 2 ? ' (über 2 % – mehr trinken)' : ''}<br />
          Empfehlung: ca. <b>{String(res.drinkPerHour).replace('.', ',')} l pro Stunde</b> mit ca. <b>{res.sodiumPerL} mg Natrium pro Liter</b> ({res.sodiumPerHour} mg/h). Danach ca. {String(res.rehydrateL).replace('.', ',')} l trinken.
        </div>}
        {res && <button className="primary wide" onClick={save}>Für die Tipps speichern</button>}
        {prefs.sweat && <p className="muted small">Gespeichert: {String(prefs.sweat.perHour).replace('.', ',')} l/h, {prefs.sweat.sodiumPerL} mg Natrium/l.</p>}
      </div>
      {GUIDE.map((g) => (
        <details key={g.id} className="card">
          <summary><b>{g.title}</b></summary>
          <ul className="small" style={{ paddingLeft: 18, lineHeight: 1.55 }}>{g.points.map((p, i) => <li key={i}>{p}</li>)}</ul>
          <p className="small"><b>Praxis:</b> {g.practice}</p>
          <p className="muted small">Quellen: {g.sources.map((s, i) => <span key={s}>{i > 0 && ' · '}<a href={NUTRITION_SOURCES[s].url} target="_blank" rel="noreferrer">{NUTRITION_SOURCES[s].text}</a></span>)}</p>
        </details>
      ))}
    </>
  );
}

// KI-Essensplan (wie bisher), jetzt mit Katalog, Hitze und Schweißrate als Rahmen.
function AiPlan({ data, t, prefs, setPref, weight, open }) {
  const { food, recipes, settings } = data;
  const [days, setDays] = useState(3);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sub, setSub] = useState('plan');
  const generate = async () => {
    setBusy(true); setError('');
    try {
      const tage = Array.from({ length: days }, (_, i) => addDays(t, i)).map((date) => {
        const tr = trainingOf(date, data), end = tr.filter((x) => x.sport !== 'strength');
        const z = dayTargets({ weightKg: weight, minutes: end.reduce((a, x) => a + x.minutes, 0), hardMinutes: tr.reduce((a, x) => a + x.hard, 0), strength: tr.some((x) => x.sport === 'strength'), longestMinutes: Math.max(0, ...end.map((x) => x.minutes)) });
        return { datum: date, training: tr.map((x) => ({ sport: x.race ? 'Rennen' : sportLabel(x.sport), minuten: x.minutes, davonHartMin: x.hard, titel: x.title, uhrzeit: x.time || undefined })), hitze: prefs.heatDate === date || undefined, ziele: z && { kcal: z.kcal, khG: z.carbs, eiweissG: z.protein, fettG: z.fat, khProStundeImTraining: z.duringPerHour } };
      });
      const vorlieben = { ernaehrungsform: prefs.diet || 'alles', unvertraeglichkeiten: prefs.avoid || '', mag: prefs.likes || '', kochzeitMinMax: Number(prefs.cookTime) || 30, mahlzeitenProTag: Number(prefs.meals) || 5, portionenFuer: Number(prefs.people) || 1, budget: prefs.budget || 'normal', gewichtKg: weight || undefined, geschlecht: settings.sex === 'f' ? 'weiblich' : 'männlich', schweissrate: prefs.sweat ? { literProStunde: prefs.sweat.perHour, natriumMgProLiter: prefs.sweat.sodiumPerL } : undefined, trainLowErlaubt: prefs.trainLow !== false, lieblingsrezepte: recipes.slice(-10).map((r) => r.name) };
      const katalog = CATALOG.map((r) => `${r.name} [${r.slots.join('/')}; ${r.ctx.join('/')}; ${r.diet}]`);
      const result = await kiPost('/api/ernaehrung', { tage, vorlieben, katalog, ...aiChoice(settings, 'food') });
      logAiCost('food', result, t);
      update((d) => ({ ...d, food: { id: uid(), created: t, ...result } }));
      setSub('plan');
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };
  const recipeByName = (n) => food?.rezepte?.find((r) => r.name === n) || recipes.find((r) => r.name === n) || (() => { const c = CATALOG.find((r) => r.name === n); return c ? toRecipe(c, weight) : null; })();
  return (
    <>
      <details className="card" style={{ marginTop: 10 }}>
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
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 400, marginTop: 10 }}><input type="checkbox" checked={prefs.trainLow !== false} onChange={(e) => setPref('trainLow', e.target.checked)} style={{ width: 18, height: 18 }} />Train-Low-Vorschläge an lockeren Tagen</label>
      </details>
      <Seg value={String(days)} onChange={(v) => setDays(Number(v))} options={[['1', '1 Tag'], ['3', '3 Tage'], ['7', '7 Tage']]} />
      <AiQuality kind="food" t={t} />
      <button className="primary wide" onClick={generate} disabled={busy || !weight} style={{ marginTop: 10 }}><ChefHat size={18} className={busy ? 'spin' : ''} />{busy ? 'Plane Mahlzeiten …' : 'Essensplan mit Rezepten erstellen'}</button>
      {error && <div className="notice" style={{ color: 'var(--bad)' }}>{error}</div>}
      {food && <div style={{ marginTop: 12 }}><Seg value={sub} onChange={setSub} options={[['plan', 'Plan'], ['shop', 'Einkauf']]} /></div>}
      {sub === 'plan' && food && <>
        <AiCost result={food} />
        {food.tage.map((d) => (
          <div key={d.datum} className="card">
            <h3 style={{ marginTop: 0 }}>{fmtDate(d.datum)}</h3>
            {d.mahlzeiten.map((m, i) => (
              <button key={i} className="item" onClick={() => { const r = recipeByName(m.rezept); if (r) open(r); }}>
                <div className="grow"><b>{m.typ}</b> <span className="muted small">{m.zeit}</span><p>{m.rezept}{m.portionen !== 1 ? ` · ${m.portionen} Portion(en)` : ''}</p></div>
              </button>
            ))}
          </div>
        ))}
        {food.hinweise?.length > 0 && <div className="notice">{food.hinweise.map((h, i) => <div key={i}>• {h}</div>)}</div>}
      </>}
      {sub === 'shop' && food && <ShoppingList items={food.einkaufsliste} planId={food.id} />}
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

const fmtMicro = (v) => (v == null ? '–' : v >= 10 ? String(Math.round(v)) : String(Math.round(v * 10) / 10).replace('.', ','));

function RecipeSheet({ r, onClose, isFav, onFav, sex }) {
  if (!r) return null;
  const ref = REFERENCE[sex] || REFERENCE.m;
  return (
    <Sheet title={r.name} onClose={onClose}>
      <div className="macro"><span>{r.zeitMin} min</span><span>{r.portionen} Portion(en)</span><span>pro Portion: {r.makros.kcal} kcal</span><span>KH {r.makros.kh} g</span><span>Eiweiß {r.makros.eiweiss} g</span><span>Fett {r.makros.fett} g</span></div>
      <div className="chips">{r.tags?.map((t) => <span key={t} className="chip">{t}</span>)}</div>
      <div className="recipe">
        <h3>Zutaten</h3><ul>{r.zutaten.map((z, i) => <li key={i}>{z.menge ? `${z.menge} ` : ''}{z.zutat}</li>)}</ul>
        <h3>Zubereitung</h3><ol>{r.schritte.map((s, i) => <li key={i}>{s}</li>)}</ol>
      </div>
      {r.tip && <div className="notice small"><Lightbulb size={14} /> {r.tip}</div>}
      {r.mikro && <>
        <h3>Mikronährstoffe pro Portion</h3>
        {Object.entries(ref).map(([k, v]) => {
          const pct = Math.min(1, (r.mikro[k] || 0) / v);
          return (
            <div key={k} className="row" style={{ alignItems: 'center', fontSize: 12, margin: '3px 0', flexWrap: 'nowrap' }}>
              <span style={{ flex: '0 0 88px' }}>{NUTRIENTS[k].label}</span>
              <span style={{ flex: 1, height: 8, background: 'var(--line)', borderRadius: 4, overflow: 'hidden' }}><i style={{ display: 'block', height: '100%', width: `${pct * 100}%`, background: pct >= 0.25 ? 'var(--good)' : 'var(--load)' }} /></span>
              <span className="muted nowrap" style={{ flex: '0 0 auto', minWidth: 104, textAlign: 'right' }}>{fmtMicro(r.mikro[k])} {NUTRIENTS[k].unit} · {Math.round(((r.mikro[k] || 0) / v) * 100)} %</span>
            </div>
          );
        })}
        <p className="muted small">Natrium: {fmtMicro(r.mikro.natrium)} mg. Prozent vom Tagesreferenzwert (DGE); Omega-3 inklusive pflanzlicher Quellen. Mengen für dein Gewicht berechnet.</p>
      </>}
      <button className={isFav ? 'secondary wide' : 'primary wide'} onClick={onFav}><Heart size={17} fill={isFav ? 'currentColor' : 'none'} />{isFav ? 'Aus Favoriten entfernen' : 'Als Favorit speichern'}</button>
    </Sheet>
  );
}
