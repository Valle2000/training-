import React, { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Check, CalendarPlus, Sparkles } from 'lucide-react';
import { useData, update, uid } from '../lib/store.js';
import { today, weeks as weekStats } from '../lib/activities.js';
import { addDays } from '../lib/metrics.js';
import { sportLabel } from '../lib/sports.js';
import { PHASES } from '../lib/season.js';
import { APPROACHES, KEY_OPTIONS, PLAN_SOURCES, GOALS, SERIOUSNESS, STYLES, ABILITIES, MODES, generatePlan, toPlanItems, nextMonday, recommend } from '../lib/plan-wizard.js';
import { Sheet, fmtDate, fmtNum, toast } from './common.jsx';

const DOW = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const TYPE_LABEL = { dt_am: 'Double Threshold (morgens)', dt_pm: 'Double Threshold (abends)', threshold: 'Schwelle', hit: 'Hart / VO2max', race: 'Wettkampftempo', speed: 'Schnelligkeit', long: 'Lange Einheit' };

// Saisonplan zum Durchklicken: Über dich → Ansatz → Umfang → Key Sessions → Vorschau → in den Kalender.
export function PlanWizard({ onClose }) {
  const { activities, races, settings } = useData();
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
  const plan = useMemo(() => (step >= 4 ? generatePlan({ ...o, keys }, races) : []), [step, o, keys, races]);
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
          <p className="small muted">Key Sessions: {rec.keys.map((k) => KEY_OPTIONS.find((x) => x.id === k)?.name).filter(Boolean).join(', ')} · Kraft {rec.strengthPerWeek}×/Woche</p>
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
        <p className="muted small">Dein Schnitt der letzten 7 Wochen: {fmtNum(recent.reduce((a, w) => a + w.hours, 0) / (recent.length || 1), 1)} h. Steigerung im 3:1-Rhythmus (3 Wochen aufbauen, 1 leichter), Tapering vor A-Rennen 2 Wochen. {nextA ? `Nächstes A-Rennen: ${nextA.name} am ${fmtDate(nextA.date)}.` : 'Tipp: A-Rennen unter „Rennen“ eintragen – dann plant der Assistent die Phasen rückwärts davon.'}</p>
      </>}

      {step === 3 && <>
        <p className="muted small">Welche Schlüsseleinheiten willst du machen? Vorausgewählt passend zu „{ap.name}“. Pro Typ werden die gewählten Einheiten abgewechselt.</p>
        {Object.entries(TYPE_LABEL).map(([type, label]) => {
          const opts = KEY_OPTIONS.filter((k) => k.type === type);
          if (!opts.length) return null;
          return (
            <div key={type} style={{ marginTop: 8 }}>
              <b className="small">{label}</b>
              {opts.map((k) => (
                <label key={k.id} className="item" style={{ cursor: 'pointer', fontWeight: 400 }}>
                  <input type="checkbox" checked={keys.includes(k.id)} onChange={() => toggleKey(k.id)} style={{ width: 20, height: 20, flex: 'none' }} />
                  <div className="grow"><b>{k.name}</b><p>{k.desc}{k.minutes ? ` · ca. ${k.minutes} min` : ''}{k.sport !== 'specific' && k.sport !== 'strength' ? ` · ${sportLabel(k.sport)}` : ''}</p></div>
                </label>
              ))}
            </div>
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

const SLOT_LABEL = { dt: 'Double-Threshold-Tag', threshold: 'Schwelle', hit: 'hart', race: 'Wettkampftempo', opener: 'Vorbelastung' };
function fmtSlots(slots) {
  if (slots === 'block') return 'alle 4 Wochen 5× hart, sonst 1 Schwelle + 1 hart';
  if (!slots?.length) return 'keine';
  const c = {};
  for (const s of slots) c[s] = (c[s] || 0) + 1;
  return Object.entries(c).map(([k, n]) => `${n}× ${SLOT_LABEL[k] || k}`).join(' + ');
}
