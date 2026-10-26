import React, { useState } from 'react';
import { BrainCircuit, CalendarPlus, Trash2, BookOpen, Search } from 'lucide-react';
import { useData, update, getData, uid } from '../lib/store.js';
import { coachSummary, today, weeks as weekStats } from '../lib/activities.js';
import { seasonPlan, seasonStart, PHASES } from '../lib/season.js';
import { addDays } from '../lib/metrics.js';
import { sportLabel } from '../lib/sports.js';
import { kiPost } from '../lib/ai.js';
import { fmtDate, toast, Seg } from './common.jsx';
import { TOPICS, FAQ, EVIDENCE_LABEL } from '../lib/knowledge.js';

export const DEFAULT_STRATEGY = 'Aktuell ca. 15 h Ausdauer pro Woche plus 2 Krafteinheiten (zusammen ca. 2 h). Bald möchte ich Double-Threshold-Tage einbauen und später auch etwas mehr Intensität.';

export function Coach() {
  const [view, setView] = useState('coach');
  return (
    <>
      <h1>Coach</h1>
      <Seg value={view} onChange={setView} options={[['coach', 'KI-Coach'], ['wiki', 'Wissen'], ['faq', 'FAQ']]} />
      {view === 'coach' && <CoachAi />}
      {view === 'wiki' && <Knowledge />}
      {view === 'faq' && <Faq onTopic={() => setView('wiki')} />}
    </>
  );
}

const EV_CLASS = { stark: 'b-gut', mittel: 'b-info', gering: 'b-achtung' };

function Knowledge() {
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const cats = [...new Set(TOPICS.map((t) => t.cat))];
  const list = TOPICS.filter((t) => (!cat || t.cat === cat) && (!q || JSON.stringify(t).toLowerCase().includes(q.toLowerCase())));
  return (
    <>
      <p className="muted" style={{ marginTop: 12 }}>Kernaussagen aus der Trainingswissenschaft mit Fokus Langlauf, inklusive aktueller Studien (2023–2026). Jede Aussage hat eine Quelle und eine Einschätzung, wie belastbar sie ist.</p>
      <div className="row"><Search size={18} style={{ flex: 'none' }} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Suchen, z. B. Schwelle, HRV, Eiweiß" /></div>
      <div className="chips"><button className={`chip${!cat ? ' on' : ''}`} onClick={() => setCat('')}>Alle</button>{cats.map((c) => <button key={c} className={`chip${cat === c ? ' on' : ''}`} onClick={() => setCat(c)}>{c}</button>)}</div>
      {list.map((t) => (
        <details key={t.id} id={'topic-' + t.id} className="card">
          <summary><b>{t.title}</b> <span className={`badge ${EV_CLASS[t.evidence]}`}>{EVIDENCE_LABEL[t.evidence]}</span></summary>
          <ul style={{ paddingLeft: 18, lineHeight: 1.55, fontSize: 14 }}>{t.facts.map((f, i) => <li key={i}>{f}</li>)}</ul>
          <p style={{ fontSize: 14 }}><b>Für dein Training:</b> {t.practice}</p>
          {t.sources.length > 0 && <div className="small muted"><BookOpen size={13} /> Quellen:<ul style={{ paddingLeft: 18, margin: '4px 0' }}>{t.sources.map((s) => <li key={s.url}><a href={s.url} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>{s.text}</a></li>)}</ul></div>}
        </details>
      ))}
      <p className="muted small">Studien beschreiben Durchschnitte und oft kleine Gruppen. Sie ersetzen kein Körpergefühl und keine ärztliche Abklärung.</p>
    </>
  );
}

function Faq({ onTopic }) {
  return (
    <>
      {FAQ.map((f, i) => (
        <details key={i} className="card">
          <summary><b>{f.q}</b></summary>
          <p style={{ fontSize: 14 }}>{f.a}</p>
          <div className="chips">{f.refs.map((r) => { const t = TOPICS.find((x) => x.id === r); return t && <button key={r} className="chip" onClick={() => { onTopic(); setTimeout(() => { const el = document.getElementById('topic-' + r); if (el) { el.open = true; el.scrollIntoView({ behavior: 'smooth' }); } }, 50); }}>{t.title}</button>; })}</div>
        </details>
      ))}
    </>
  );
}

function CoachAi() {
  const { settings, coach } = useData();
  const [strategy, setStrategy] = useState(settings.strategy ?? DEFAULT_STRATEGY);
  const [question, setQuestion] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [openId, setOpenId] = useState(coach.at(-1)?.id);
  const current = coach.find((c) => c.id === openId);

  const run = async () => {
    setBusy(true); setError('');
    update((d) => ({ ...d, settings: { ...d.settings, strategy } }));
    try {
      const data = getData();
      const t = today(data.settings.timezone);
      const daten = coachSummary(data, t);
      // Saisonphase und Wochenziel aus der Saisonplanung mitgeben.
      const ss = data.settings.season || {};
      const avg = weekStats(data.activities, 8, t).slice(0, 7).reduce((a, w) => a + w.hours, 0) / 7;
      const base = Number(ss.baseHours) || Math.round(avg) || 10, peak = Number(ss.peakHours) || Math.round(base * 1.25);
      const start = ss.start || seasonStart(t);
      const wk = seasonPlan(data.races, { start, end: ss.end || addDays(addDays(start, 365), -1), baseHours: base, peakHours: peak });
      daten.saison = wk.filter((w) => w.to >= t).slice(0, 4).map((w) => ({ ab: w.from, phase: PHASES[w.phase].label, zielStunden: w.targetHours }));
      const result = await kiPost('/api/coach', { daten, frage: question });
      const entry = { id: uid(), date: t, question, result };
      update((d) => ({ ...d, coach: [...d.coach, entry].slice(-20) }));
      setOpenId(entry.id);
      setQuestion('');
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };

  const adopt = (plan) => {
    const items = plan.filter((p) => p.sport !== 'rest' && p.zone !== 'Ruhe').map((p) => ({ id: uid(), date: p.datum, title: p.titel, sport: p.sport, minutes: p.minuten, zone: p.zone, description: p.beschreibung, load: p.belastung, source: 'coach' }));
    const dates = new Set(items.map((i) => i.date));
    // Offene Coach-Einheiten an denselben Tagen ersetzen, eigene Planungen behalten.
    update((d) => ({ ...d, plan: [...d.plan.filter((p) => !(p.source === 'coach' && !p.done && dates.has(p.date))), ...items] }));
    toast(`${items.length} Einheiten in den Kalender übernommen`);
  };

  return (
    <>
      <p className="muted" style={{ marginTop: 12 }}>Der Coach bekommt eine Zusammenfassung deiner letzten 12 Wochen (Umfang, Zonen, Kraft, Form, HRV/Schlaf) und deine Strategie. Er bewertet sie anhand der Studienlage im Langlauf und plant die nächsten 7 Tage.</p>
      <label>Deine Strategie und Ziele</label>
      <textarea value={strategy} onChange={(e) => setStrategy(e.target.value)} rows={4} />
      <label>Frage (optional)</label>
      <textarea value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="z. B. Wie baue ich den ersten Double-Threshold-Tag ein? Lieber Rollski oder Laufen?" rows={2} />
      <button className="primary wide" onClick={run} disabled={busy} style={{ marginTop: 12 }}><BrainCircuit size={18} className={busy ? 'spin' : ''} />{busy ? 'Analysiere … (bis zu 1–2 Minuten)' : 'Analyse und Wochenplan'}</button>
      {error && <div className="notice" style={{ color: 'var(--bad)' }}>{error}</div>}

      {current && <Result entry={current} onAdopt={adopt} />}

      {coach.length > 1 && <>
        <h2>Frühere Analysen</h2>
        {[...coach].reverse().map((c) => (
          <div key={c.id} className="item">
            <button className="ghost grow" style={{ justifyContent: 'flex-start' }} onClick={() => setOpenId(c.id)}>{fmtDate(c.date)} {c.question ? `· ${c.question.slice(0, 50)}` : ''}</button>
            <button className="ghost" aria-label="Löschen" onClick={() => update((d) => ({ ...d, coach: d.coach.filter((x) => x.id !== c.id) }))}><Trash2 size={15} /></button>
          </div>
        ))}
      </>}
    </>
  );
}

function Result({ entry, onAdopt }) {
  const r = entry.result;
  return (
    <div className="card">
      <p className="muted small" style={{ marginTop: 0 }}>{fmtDate(entry.date)} {entry.question && `· „${entry.question}“`}</p>
      <p><b>{r.zusammenfassung}</b></p>
      {r.warnungen?.length > 0 && <div className="notice" style={{ background: 'var(--badbg)', color: 'var(--bad)' }}>{r.warnungen.map((w, i) => <div key={i}>⚠ {w}</div>)}</div>}
      {r.analyse?.map((a, i) => (
        <div key={i} style={{ borderTop: '1px solid var(--line)', padding: '8px 0' }}>
          <b>{a.titel}</b> <span className={`badge b-${a.bewertung}`}>{a.bewertung}</span>
          <p style={{ margin: '4px 0', fontSize: 14 }}>{a.text}</p>
        </div>
      ))}
      {r.wochenplan?.length > 0 && <>
        <h3>Wochenplan</h3>
        {r.wochenplan.map((p, i) => (
          <div key={i} className="item" style={{ alignItems: 'flex-start' }}>
            <div className="grow"><b>{fmtDate(p.datum)} · {p.titel}</b><p>{p.sport === 'rest' ? 'Ruhetag' : `${sportLabel(p.sport)} · ${p.minuten} min · ${p.zone} · Belastung ~${p.belastung}`}</p><p style={{ whiteSpace: 'pre-line', color: 'var(--ink)' }}>{p.beschreibung}</p></div>
          </div>
        ))}
        <button className="primary wide" onClick={() => onAdopt(r.wochenplan)}><CalendarPlus size={18} />In den Kalender übernehmen</button>
      </>}
      {r.quellen?.length > 0 && <details style={{ marginTop: 12 }}><summary className="muted">Quellen</summary><ul className="small">{r.quellen.map((q, i) => <li key={i}>{q}</li>)}</ul></details>}
    </div>
  );
}
