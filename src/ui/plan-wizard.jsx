import React, { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Check, CalendarPlus, Sparkles, Pencil, Plus, Trash2 } from 'lucide-react';
import { useData, update, uid } from '../lib/store.js';
import { today, weeks as weekStats } from '../lib/activities.js';
import { addDays } from '../lib/metrics.js';
import { sportLabel, SPORTS } from '../lib/sports.js';
import { PHASES } from '../lib/season.js';
import { APPROACHES, KEY_TYPES, allOptions, makeKey, PLAN_SOURCES, GOALS, SERIOUSNESS, STYLES, ABILITIES, MODES, generatePlan, toPlanItems, nextMonday, recommend } from '../lib/plan-wizard.js';
import { Sheet, fmtDate, fmtNum, toast } from './common.jsx';
import { freeMinutes, hasSchedule } from '../lib/week-adapt.js';

const DOW = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
// Gruppen im Katalog; Intervalle nach Zone getrennt.
const GROUPS = [
  ...KEY_TYPES.map(([id, label]) => ({ id, label, match: (k) => (id.startsWith('hit_') ? k.type === 'hit' && k.zone === id.slice(4) : k.type === id) })),
  { id: 'other', label: 'Schnelligkeit und lange Einheit', match: (k) => k.type === 'speed' || k.type === 'long' },
];

// Saisonplan zum Durchklicken: Über dich → Ansatz → Umfang → Key Sessions → Vorschau → in den Kalender.
export function PlanWizard({ onClose }) {
  const { activities, races, settings } = useData();
  const custom = settings.customKeys || [];
  const options = useMemo(() => allOptions(custom), [custom]);
  const [edit, setEdit] = useState(null);
  const t = today(settings.timezone);
  const recent = weekStats(activities, 8, t).slice(0, 7);
  const avg = Math.round(recent.reduce((a, w) => a + w.hours, 0) / (recent.length || 1)) || 10;
  const nextA = races.filter((r) => r.priority === 'A' && r.date > t).sort((a, b) => a.date.localeCompare(b.date))[0];
  const saved = settings.season?.wizard || {};
  const [step, setStep] = useState(0);
  const [o, setO] = useState({
    approach: 'pyramidal', startHours: avg, peakHours: Math.round(avg * 1.2), start: nextMonday(t),
    end: nextA ? addDays(nextA.date, 7) : addDays(nextMonday(t), 7 * 16 - 1), restDays: [1], longDay: 7, doubles: true, strengthPerWeek: 2, keys: null, horizon: 8, profile: {},
    ...saved, start: saved.start && saved.start >= t ? saved.start : nextMonday(t),
  });
  const ap = APPROACHES.find((a) => a.id === o.approach);
  const keys = o.keys || ap.defaults;
  const pr = o.profile || {};
  const rec = recommend(pr, Number(o.startHours) || 10);
  const plan = useMemo(() => (step >= 4 ? generatePlan({ ...o, keys, customKeys: custom, capFor: hasSchedule(settings.schedule) ? (d) => freeMinutes(d, settings.schedule) : null }, races) : []), [step, o, keys, races, custom, settings.schedule]);
  const set = (k, v) => setO({ ...o, [k]: v });
  const toggleKey = (id) => set('keys', keys.includes(id) ? keys.filter((k) => k !== id) : [...keys, id]);
  const setPr = (k, v) => set('profile', { ...pr, [k]: v });
  // Mehrfachauswahl; stark/schwach bzw. gern/ungern schließen sich gegenseitig aus.
  const togglePr = (k, id, other) => {
    const cur = pr[k] || [];
    const next = { ...pr, [k]: cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id] };
    if (other) next[other] = (pr[other] || []).filter((x) => x !== id);
    set('profile', next);
  };
  const takeRec = () => { setO({ ...o, approach: rec.approach, keys: rec.keys, strengthPerWeek: rec.strengthPerWeek }); toast('Empfehlung übernommen'); };

  const apply = () => {
    const weeks = plan.slice(0, Number(o.horizon) || plan.length);
    const items = toPlanItems(weeks, uid);
    const until = weeks.at(-1)?.to;
    update((d) => ({
      ...d,
      // Frühere Assistenten-Einträge im Zeitraum ersetzen, eigene Einträge bleiben.
      plan: [...d.plan.filter((p) => !(p.source === 'wizard' && p.date >= o.start && p.date <= until && !p.done)), ...items],
      settings: { ...d.settings, season: { ...(d.settings.season || {}), baseHours: o.startHours, peakHours: o.peakHours, wizard: { ...o, keys } } },
    }));
    toast(`${items.length} Einheiten für ${weeks.length} Wochen eingetragen`);
    onClose();
  };

  const steps = ['Über dich', 'Ansatz', 'Umfang', 'Key Sessions', 'Vorschau'];
  return (
    <Sheet title="Saisonplan-Assistent" onClose={onClose}>
      <div className="chips">{steps.map((s, i) => <button key={s} className={`chip${i === step ? ' on' : ''}`} onClick={() => setStep(i)}>{i + 1}. {s}</button>)}</div>

      {step === 0 && <>
        <p className="muted small">Ein paar Fragen, damit der Plan zu dir passt. Am wichtigsten ist, dass du dranbleibst – deshalb zählt auch, was dir Spaß macht.</p>
        <label>Ziel</label>
        <div className="chips">{GOALS.map(([id, l]) => <button key={id} className={`chip${pr.goal === id ? ' on' : ''}`} onClick={() => setPr('goal', id)}>{l}</button>)}</div>
        <label>Wie ernst nimmst du es?</label>
        <div className="chips">{SERIOUSNESS.map(([id, l]) => <button key={id} className={`chip${pr.seriousness === id ? ' on' : ''}`} onClick={() => setPr('seriousness', id)}>{l}</button>)}</div>
        <label>Trainingsstil</label>
        <div className="chips">{STYLES.map(([id, l]) => <button key={id} className={`chip${pr.style === id ? ' on' : ''}`} onClick={() => setPr('style', id)}>{l}</button>)}</div>
        <label>Stärken</label>
        <div className="chips">{ABILITIES.map(([id, l]) => <button key={id} className={`chip${(pr.strong || []).includes(id) ? ' on' : ''}`} onClick={() => togglePr('strong', id, 'weak')}>{l}</button>)}</div>
        <label>Schwächen</label>
        <div className="chips">{ABILITIES.map(([id, l]) => <button key={id} className={`chip${(pr.weak || []).includes(id) ? ' on' : ''}`} onClick={() => togglePr('weak', id, 'strong')}>{l}</button>)}</div>
        <label>Trainiere ich gern</label>
        <div className="chips">{MODES.map(([id, l]) => <button key={id} className={`chip${(pr.likes || []).includes(id) ? ' on' : ''}`} onClick={() => togglePr('likes', id, 'dislikes')}>{l}</button>)}</div>
        <label>Mag ich nicht so</label>
        <div className="chips">{MODES.map(([id, l]) => <button key={id} className={`chip${(pr.dislikes || []).includes(id) ? ' on' : ''}`} onClick={() => togglePr('dislikes', id, 'likes')}>{l}</button>)}</div>
        <p className="muted small">Lieblingssportarten kommen vor allem im Frühjahr oft dran – je nach Ernsthaftigkeit bis in den Spätsommer, bei „leistungsorientiert“ wird es ab Herbst spezifischer.</p>
      </>}

      {step === 1 && <>
        <div className="card">
          <b><Sparkles size={16} style={{ verticalAlign: -3 }} /> Empfehlung: {APPROACHES.find((a) => a.id === rec.approach).name}</b>
          <ul className="small" style={{ paddingLeft: 18, margin: '6px 0' }}>{rec.reasons.map((r) => <li key={r}>{r}</li>)}</ul>
          <p className="small muted">Key Sessions: {rec.keys.map((k) => options.find((x) => x.id === k)?.name).filter(Boolean).join(', ')} · Kraft {rec.strengthPerWeek}×/Woche</p>
          <button className="secondary" onClick={takeRec}><Check size={16} />Empfehlung übernehmen</button>
        </div>
        <p className="muted small">Oder wähle selbst einen Trainingsansatz. Alle sind studienbasiert beschrieben – die Unterschiede liegen vor allem in Art und Zahl der harten Einheiten; locker bleibt bei allen der größte Teil.</p>
        {APPROACHES.map((a) => (
          <button key={a.id} className="item" style={{ borderColor: o.approach === a.id ? 'var(--accent)' : undefined, borderWidth: o.approach === a.id ? 2 : 1 }} onClick={() => setO({ ...o, approach: a.id, keys: null })}>
            <div className="grow">
              <b>{a.name}</b> <span className="badge b-info">Evidenz: {a.evidence}</span>
              <p>{a.short}</p>
              {o.approach === a.id && <>
                <p className="small">{a.detail}</p>
                <p className="small muted">Harte Einheiten pro Woche – Aufbau: {fmtSlots(a.phases.build)}, Wettkampfvorbereitung: {fmtSlots(a.phases.specific)}</p>
                <p className="small muted">Quellen: {a.sources.map((s, i) => <span key={s}>{i > 0 && ' · '}<a href={PLAN_SOURCES[s].url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>{PLAN_SOURCES[s].text}</a></span>)}</p>
              </>}
            </div>
            {o.approach === a.id && <Check size={18} />}
          </button>
        ))}
      </>}

      {step === 2 && <>
        <div className="grid2">
          <div><label>Stunden/Woche jetzt</label><input type="number" value={o.startHours} onChange={(e) => set('startHours', e.target.value)} /></div>
          <div><label>Spitze Stunden/Woche</label><input type="number" value={o.peakHours} onChange={(e) => set('peakHours', e.target.value)} /></div>
          <div><label>Start (Montag)</label><input type="date" value={o.start} onChange={(e) => set('start', e.target.value)} /></div>
          <div><label>Planen bis</label><input type="date" value={o.end} onChange={(e) => set('end', e.target.value)} /></div>
          <div><label>Langer Tag</label><select value={o.longDay} onChange={(e) => set('longDay', Number(e.target.value))}>{DOW.map((d, i) => <option key={d} value={i + 1}>{d}</option>)}</select></div>
          <div><label>Krafteinheiten/Woche (Vorbereitung)</label><select value={o.strengthPerWeek} onChange={(e) => set('strengthPerWeek', Number(e.target.value))}>{[0, 1, 2, 3].map((n) => <option key={n} value={n}>{n}</option>)}</select></div>
        </div>
        <label>Ruhetage</label>
        <div className="chips">{DOW.map((d, i) => <button key={d} className={`chip${o.restDays.includes(i + 1) ? ' on' : ''}`} onClick={() => set('restDays', o.restDays.includes(i + 1) ? o.restDays.filter((x) => x !== i + 1) : [...o.restDays, i + 1])}>{d}</button>)}</div>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 400, marginTop: 8 }}><input type="checkbox" checked={o.doubles !== false} onChange={(e) => set('doubles', e.target.checked)} style={{ width: 18, height: 18 }} />Zwei Einheiten an einem Tag erlaubt</label>
        <p className="muted small">Dein Schnitt der letzten 7 Wochen: {fmtNum(recent.reduce((a, w) => a + w.hours, 0) / (recent.length || 1), 1)} h. {hasSchedule(settings.schedule) ? 'Deine Uni-/Arbeitszeiten aus „Alltag“ werden berücksichtigt – pro Tag wird nur so viel geplant, wie frei ist. ' : 'Tipp: Unter Kalender → Woche → „Alltag“ Uni/Arbeit eintragen, dann plant der Assistent nur in deine freie Zeit. '}Steigerung im 3:1-Rhythmus (3 Wochen aufbauen, 1 leichter), Tapering vor A-Rennen 2 Wochen. {nextA ? `Nächstes A-Rennen: ${nextA.name} am ${fmtDate(nextA.date)}.` : 'Tipp: A-Rennen unter „Rennen“ eintragen – dann plant der Assistent die Phasen rückwärts davon.'}</p>
      </>}

      {step === 3 && <>
        <p className="muted small">Welche Schlüsseleinheiten willst du machen? Vorausgewählt passend zu „{ap.name}“. Pro Typ werden die gewählten Einheiten abgewechselt.</p>
        <button className="secondary" onClick={() => setEdit({ spec: { type: 'threshold', reps: 6, work: 10, rest: 1, unit: 'min', restUnit: 'min', sets: 1, setRest: 3, sport: 'specific', warm: 20, cool: 15, note: '' } })}><Plus size={16} />Eigene Einheit</button>
        {edit && <KeyEditor edit={edit} onClose={() => setEdit(null)} onSaved={(id) => { if (!keys.includes(id)) set('keys', [...keys, id]); setEdit(null); }} />}
        {GROUPS.map((g) => {
          const list = options.filter(g.match);
          const on = list.filter((k) => keys.includes(k.id)).length;
          return (
            <details key={g.id} open={on > 0 || g.id === 'other'} style={{ marginTop: 8 }}>
              <summary className="small" style={{ cursor: 'pointer' }}><b>{g.label}</b> <span className="muted">· {on ? `${on} gewählt · ` : ''}{list.length} Einheiten</span></summary>
              {list.map((k) => (
                <div key={k.id} className="item" style={{ fontWeight: 400 }}>
                  <input type="checkbox" checked={keys.includes(k.id)} onChange={() => toggleKey(k.id)} style={{ width: 20, height: 20, flex: 'none' }} aria-label={k.name} />
                  <div className="grow" onClick={() => toggleKey(k.id)} style={{ cursor: 'pointer' }}><b>{k.name}</b>{k.custom && <span className="badge b-info" style={{ marginLeft: 6 }}>eigene</span>}<p>{k.desc}{k.minutes ? ` · ca. ${k.minutes} min` : ''}{k.sport !== 'specific' && k.sport !== 'strength' ? ` · ${sportLabel(k.sport)}` : ''}</p></div>
                  {k.spec && <button className="ghost" style={{ flex: 'none' }} title={k.custom ? 'Bearbeiten' : 'Als eigene Einheit anpassen'} onClick={() => setEdit(k.custom ? { id: k.id, name: k.name, spec: k.spec } : { spec: k.spec, from: k.id })}><Pencil size={16} /></button>}
                </div>
              ))}
            </details>
          );
        })}
      </>}

      {step === 4 && <>
        <div className="grid2">
          <div><label>In den Kalender übernehmen</label><select value={o.horizon} onChange={(e) => set('horizon', Number(e.target.value))}>{[4, 8, 12, 16].map((n) => <option key={n} value={n}>nächste {n} Wochen</option>)}<option value={0}>ganzer Zeitraum ({plan.length} Wochen)</option></select></div>
          <div><label>Ansatz</label><input value={ap.name} disabled /></div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="t nowrap"><thead><tr><th>Woche</th><th>Phase</th><th>Std.</th><th>Harte Einheiten</th></tr></thead>
            <tbody>{plan.map((w) => <tr key={w.from}><td>{fmtDate(w.from, { day: 'numeric', month: 'short' })}</td><td><i style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 3, background: PHASES[w.phase].color, marginRight: 6 }} />{PHASES[w.phase].label}{w.block ? ' · Block' : ''}</td><td>{fmtNum(w.plannedHours, 1)}</td><td>{w.days.flatMap((d) => d.sessions.filter((s) => s.kind === 'hard' || s.kind === 'race').map((s) => `${DOW[d.dow - 1]} ${s.title.split(':')[0].replace(' (vormittags)', '').replace(' (nachmittags)', '')}`)).join(', ') || '–'}</td></tr>)}</tbody>
          </table>
        </div>
        {plan.slice(0, 2).map((w) => (
          <div key={w.from} className="card">
            <b>Woche ab {fmtDate(w.from)} · {PHASES[w.phase].label} · {fmtNum(w.plannedHours, 1)} h</b>
            {w.days.map((d) => (
              <div key={d.date} className="row" style={{ fontSize: 13, margin: '4px 0', flexWrap: 'nowrap', alignItems: 'flex-start' }}>
                <span style={{ flex: '0 0 34px', fontWeight: 700 }}>{DOW[d.dow - 1]}</span>
                <span className="grow">{d.sessions.length ? d.sessions.map((s, i) => <span key={i} style={{ display: 'block' }}>{s.title} · {s.minutes}′ · {sportLabel(s.sport)}</span>) : <span className="muted">{d.rest ? 'Ruhetag' : 'frei'}</span>}</span>
              </div>
            ))}
          </div>
        ))}
        <p className="muted small">Die Einheiten landen als „geplant“ im Kalender (mit Belastung für die Formprognose). Ändern, verschieben oder löschen kannst du sie dort jederzeit. Erneutes Übernehmen ersetzt nur Einträge des Assistenten.</p>
        <button className="primary wide" onClick={apply}><CalendarPlus size={18} />In den Kalender übernehmen</button>
      </>}

      <div className="row" style={{ marginTop: 12 }}>
        {step > 0 && <button className="secondary" onClick={() => setStep(step - 1)}><ChevronLeft size={17} />Zurück</button>}
        {step < 4 && <button className="primary" onClick={() => setStep(step + 1)}>Weiter<ChevronRight size={17} /></button>}
      </div>
    </Sheet>
  );
}

const SLOT_LABEL = { rot: 'I4 bzw. I5 je ca. 1× in 4 Wochen', dt: 'Double-Threshold-Tag', threshold: 'Schwelle', hit: 'hart', race: 'Wettkampftempo', opener: 'Vorbelastung' };
function fmtSlots(slots) {
  if (slots === 'block') return 'alle 4 Wochen 5× hart, sonst 1 Schwelle + 1 hart';
  if (!slots?.length) return 'keine';
  const c = {};
  for (const s of slots) c[s] = (c[s] || 0) + 1;
  return Object.entries(c).map(([k, n]) => `${n}× ${SLOT_LABEL[k] || k}`).join(' + ');
}

const UNITS = [['min', 'min'], ['s', 's']];
// Eigene Schlüsseleinheit anlegen oder eine aus dem Katalog anpassen (z. B. Double Threshold 3×20 morgens, 8×4 abends).
function KeyEditor({ edit, onClose, onSaved }) {
  const [f, setF] = useState({ ...edit.spec, type: edit.spec.type === 'hit' ? `hit_${edit.spec.zone || 'I4'}` : edit.spec.type, name: edit.id ? edit.name : '' });
  const set = (k, v) => setF({ ...f, [k]: v });
  const spec = () => { const hit = f.type.startsWith('hit_'); const { name, ...rest } = f; void name; return { ...rest, type: hit ? 'hit' : f.type, zone: hit ? f.type.slice(4) : f.type === 'race' ? 'I4' : 'I3' }; };
  const preview = makeKey({ ...spec(), id: 'x', name: f.name || undefined });
  const save = () => {
    const id = edit.id || `c_${uid()}`;
    const entry = { id, name: f.name.trim() || undefined, spec: spec() };
    update((d) => ({ ...d, settings: { ...d.settings, customKeys: [...(d.settings.customKeys || []).filter((c) => c.id !== id), entry] } }));
    toast(edit.id ? 'Einheit gespeichert' : 'Eigene Einheit angelegt');
    onSaved(id);
  };
  const remove = () => {
    if (!confirm('Eigene Einheit löschen?')) return;
    update((d) => ({ ...d, settings: { ...d.settings, customKeys: (d.settings.customKeys || []).filter((c) => c.id !== edit.id) } }));
    onClose();
  };
  const sports = [['specific', 'Rollski/Ski (je nach Jahreszeit)'], ...SPORTS.filter((x) => ['ski', 'endurance'].includes(x.group)).map((x) => [x.id, x.label])];
  return (
    <div className="card" style={{ marginTop: 8 }}>
      <b>{edit.id ? 'Eigene Einheit bearbeiten' : edit.from ? 'Einheit anpassen (als eigene speichern)' : 'Eigene Einheit'}</b>
      <div className="grid2">
        <div><label>Art</label><select value={f.type} onChange={(e) => set('type', e.target.value)}>{KEY_TYPES.map(([id, l]) => <option key={id} value={id}>{l}</option>)}</select></div>
        <div><label>Sportart</label><select value={f.sport} onChange={(e) => set('sport', e.target.value)}>{sports.map(([id, l]) => <option key={id} value={id}>{l}</option>)}</select></div>
        <div><label>Serien</label><input type="number" min="1" value={f.sets} onChange={(e) => set('sets', e.target.value)} /></div>
        <div><label>Wiederholungen</label><input type="number" min="1" value={f.reps} onChange={(e) => set('reps', e.target.value)} /></div>
        <div><label>Belastung</label><div className="row" style={{ flexWrap: 'nowrap' }}><input type="number" min="0" step="any" value={f.work} onChange={(e) => set('work', e.target.value)} /><select value={f.unit} onChange={(e) => set('unit', e.target.value)} style={{ width: 70 }}>{UNITS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div></div>
        <div><label>Pause</label><div className="row" style={{ flexWrap: 'nowrap' }}><input type="number" min="0" step="any" value={f.rest} onChange={(e) => set('rest', e.target.value)} /><select value={f.restUnit || f.unit} onChange={(e) => set('restUnit', e.target.value)} style={{ width: 70 }}>{UNITS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div></div>
        {Number(f.sets) > 1 && <div><label>Serienpause (min)</label><input type="number" min="0" value={f.setRest} onChange={(e) => set('setRest', e.target.value)} /></div>}
        <div><label>Ein-/Auslaufen (min)</label><div className="row" style={{ flexWrap: 'nowrap' }}><input type="number" min="0" value={f.warm} onChange={(e) => set('warm', e.target.value)} /><input type="number" min="0" value={f.cool} onChange={(e) => set('cool', e.target.value)} /></div></div>
      </div>
      <label>Name (optional)</label><input value={f.name} placeholder={makeKey({ ...spec(), id: 'x' }).name} onChange={(e) => set('name', e.target.value)} />
      <label>Hinweis (optional)</label><input value={f.note || ''} placeholder="z. B. Laktat 2,5–3 mmol/l, flache Runde" onChange={(e) => set('note', e.target.value)} />
      <p className="small muted" style={{ marginTop: 8 }}><b>{preview.name}</b> · ca. {preview.minutes} min<br />{preview.desc}</p>
      <div className="row">
        <button className="primary" onClick={save}><Check size={16} />Speichern</button>
        <button className="secondary" onClick={onClose}>Abbrechen</button>
        {edit.id && <button className="secondary" onClick={remove}><Trash2 size={16} />Löschen</button>}
      </div>
    </div>
  );
}
