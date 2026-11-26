import React, { useState } from 'react';
import { BrainCircuit, CalendarPlus, Trash2, BookOpen, Search, ImagePlus, MessageCircle, Wand2 } from 'lucide-react';
import { planForEdit, applyPlanEdits } from '../lib/plan-edit.js';
import { shrinkImage } from '../lib/plan-import.js';
import { PlanImportSheet } from './plan-import.jsx';
import { useData, update, getData, uid } from '../lib/store.js';
import { outsideTpWeeks } from '../lib/ical.js';
import { coachSummary, today, weeks as weekStats } from '../lib/activities.js';
import { seasonPlan, seasonStart, PHASES } from '../lib/season.js';
import { addDays } from '../lib/metrics.js';
import { sportLabel } from '../lib/sports.js';
import { kiPost } from '../lib/ai.js';
import { fmtDate, toast, Seg, PageHead } from './common.jsx';
import { TOPICS, FAQ, EVIDENCE_LABEL } from '../lib/knowledge.js';
import { AiQuality, AiCost, aiChoice, logAiCost, budgetOk } from './ai-quality.jsx';
import { requestKey } from '../lib/ai-models.js';

export const DEFAULT_STRATEGY = 'Aktuell ca. 15 h Ausdauer pro Woche plus 2 Krafteinheiten (zusammen ca. 2 h). Bald möchte ich Double-Threshold-Tage einbauen und später auch etwas mehr Intensität.';

export function Coach() {
  const [view, setView] = useState('coach');
  return (
    <>
      <PageHead eyebrow="KI-Analyse · Wissen · FAQ" title="Coach" />
      <Seg value={view} onChange={setView} options={[['coach', 'KI-Coach'], ['wiki', 'Wissen'], ['faq', 'FAQ']]} />
      {view === 'coach' && <CoachAi />}
      {view === 'wiki' && <Knowledge />}
      {view === 'faq' && <Faq onTopic={() => setView('wiki')} />}
    </>
  );
}

const EV_CLASS = { stark: 'b-gut', mittel: 'b-info', gering: 'b-achtung' };

// Kapitel des Wissensteils: Themen nach Kategorie, die Erklärungen aller Werte (k_…) gesammelt in Kapitel 1.
const CHAPTERS = [
  { id: 'basics', title: 'Werte und Kennzahlen verstehen', intro: 'Was die Zahlen in der App bedeuten und ab wann sie auffällig sind.', cats: ['Kennzahlen'] },
  { id: 'training', title: 'Training gestalten', intro: 'Intensität, Schwelle, Umfang, Wochenaufbau und Kraft.', cats: ['Intensität', 'Schwelle', 'Umfang & Entwicklung', 'Periodisierung', 'Kraft'] },
  { id: 'studies', title: 'Trainingsansätze und Studien', intro: 'Welche Ansätze es gibt und was die wichtigsten Studien dazu zeigen.', cats: ['Studien: Trainingsansätze'] },
  { id: 'sports', title: 'Andere Sportarten', intro: 'Laufen, Rad, Schwimmen, Rudern, Triathlon und was sich auf den Langlauf überträgt.', cats: ['Laufen', 'Radsport', 'Schwimmen', 'Rudern', 'Triathlon', 'Sportübergreifend'] },
  { id: 'recovery', title: 'Erholung und Gesundheit', intro: 'HRV, Schlaf, Überlastung, Infekte, Verletzungen, Hitze und Höhe.', cats: ['Erholung', 'Gesundheit', 'Umwelt', 'Höhe'] },
  { id: 'nutrition', title: 'Ernährung und Körper', intro: 'Energie, Kohlenhydrate, Eiweiß, Gewicht.', cats: ['Ernährung', 'Körper'] },
  { id: 'race', title: 'Wettkampf', intro: 'Tapering und Vorbereitung auf das Rennen.', cats: ['Wettkampf'] },
];
// Einzelne Themen gehören inhaltlich in ein anderes Kapitel als ihre Kategorie.
const CHAPTER_OF = { approaches: 'studies' };
const chapterOf = (t) => CHAPTER_OF[t.id] || (t.id.startsWith('k_') || t.cat === 'Kennzahlen' ? 'basics' : CHAPTERS.find((c) => c.cats.includes(t.cat))?.id || 'more');
// Überschrift innerhalb eines Kapitels: in Kapitel 1 nach Bereich, sonst nach Kategorie.
const groupOf = (t, chapter) => (chapter === 'basics' ? (t.cat === 'Kennzahlen' ? 'Training und Leistung' : t.cat === 'Körper' ? 'Körper' : 'Erholung') : chapter === 'studies' ? (['approaches', 'st_overview'].includes(t.id) ? 'Überblick' : 'Einzelstudien') : t.cat);

function TopicBody({ t }) {
  return (
    <>
      <ul style={{ paddingLeft: 18, lineHeight: 1.55, fontSize: 14 }}>{t.facts.map((x, i) => <li key={i}>{x}</li>)}</ul>
      <p style={{ fontSize: 14 }}><b>Für dein Training:</b> {t.practice}</p>
      {t.sources.length > 0 && <div className="small muted"><BookOpen size={13} /> Quellen:<ul style={{ paddingLeft: 18, margin: '4px 0' }}>{t.sources.map((src) => <li key={src.url}><a href={src.url} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>{src.text}</a></li>)}</ul></div>}
    </>
  );
}

function Topic({ t, card = false }) {
  return (
    <details id={'topic-' + t.id} className={card ? 'card' : undefined} style={card ? undefined : { borderTop: '1px solid var(--line)', padding: '8px 0' }}>
      <summary><b>{t.title}</b> <span className={`badge ${EV_CLASS[t.evidence]}`}>{EVIDENCE_LABEL[t.evidence]}</span></summary>
      <TopicBody t={t} />
    </details>
  );
}

function Knowledge() {
  const [q, setQ] = useState('');
  const query = q.trim().toLowerCase();
  const hits = query ? TOPICS.filter((t) => JSON.stringify(t).toLowerCase().includes(query)) : [];
  const chapters = [...CHAPTERS, { id: 'more', title: 'Weiteres', intro: '', cats: [] }]
    .map((c) => ({ ...c, topics: TOPICS.filter((t) => chapterOf(t) === c.id) }))
    .filter((c) => c.topics.length);
  return (
    <>
      <p className="muted" style={{ marginTop: 12 }}>Kernaussagen aus der Trainingswissenschaft mit Fokus Langlauf, dazu übertragbare Erkenntnisse aus Laufen, Rad, Schwimmen und Triathlon. Jede Aussage hat eine Quelle und eine Einschätzung, wie belastbar sie ist.</p>
      <div className="row"><Search size={18} style={{ flex: 'none' }} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Suchen, z. B. Schwelle, HRV, Eiweiß" /></div>
      {query ? <>
        <p className="muted small">{hits.length} Treffer</p>
        {hits.map((t) => <div key={t.id}><p className="small muted" style={{ margin: '8px 0 2px' }}>{CHAPTERS.find((c) => c.id === chapterOf(t))?.title || 'Weiteres'}</p><Topic t={t} card /></div>)}
      </> : chapters.map((c, i) => {
        const groups = [...new Set(c.topics.map((t) => groupOf(t, c.id)))];
        return (
          <details key={c.id} id={'chapter-' + c.id} className="card">
            <summary><b>{i + 1}. {c.title}</b> <span className="muted small">({c.topics.length})</span>{c.intro && <p className="muted small" style={{ margin: '2px 0 0' }}>{c.intro}</p>}</summary>
            {groups.map((g) => (
              <div key={g} style={{ marginTop: 10 }}>
                {groups.length > 1 && <p className="small" style={{ margin: '0 0 2px', fontWeight: 600, color: 'var(--accent)' }}>{g}</p>}
                {c.topics.filter((t) => groupOf(t, c.id) === g).map((t) => <Topic key={t.id} t={t} />)}
              </div>
            ))}
          </details>
        );
      })}
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
          <div className="chips">{f.refs.map((r) => { const t = TOPICS.find((x) => x.id === r); return t && <button key={r} className="chip" onClick={() => { onTopic(); setTimeout(() => { const el = document.getElementById('topic-' + r); if (el) { for (let p = el; p; p = p.parentElement?.closest('details')) p.open = true; el.scrollIntoView({ behavior: 'smooth' }); } }, 50); }}>{t.title}</button>; })}</div>
        </details>
      ))}
    </>
  );
}

function CoachAi() {
  const { settings, coach } = useData();
  const [mode, setMode] = useState('ask');
  const [strategy, setStrategy] = useState(settings.strategy ?? DEFAULT_STRATEGY);
  const [question, setQuestion] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [openId, setOpenId] = useState(coach.at(-1)?.id);
  const current = coach.find((c) => c.id === openId);

  // force: trotzdem neu analysieren (sonst wird bei gleichen Daten und Frage die letzte Antwort gezeigt).
  const run = async (force = false) => {
    setError('');
    update((d) => ({ ...d, settings: { ...d.settings, strategy } }));
    try {
      const data = getData();
      const t = today(data.settings.timezone);
      // Trainingsdaten inkl. Saisonphase und Plan der nächsten 14 Tage.
      const daten = buildDaten(data, t);
      const choice = aiChoice(data.settings, 'coach');
      const key = requestKey({ daten, frage: question, ...choice });
      const same = coach.find((c) => c.key === key);
      if (same && !force) { setOpenId(same.id); toast('Gleiche Daten und Frage: letzte Antwort gezeigt – keine neue Anfrage, keine Kosten.'); return; }
      if (!budgetOk(data.settings, 'coach', choice.model, choice.effort, t)) return;
      setBusy(true);
      const result = await kiPost('/api/coach', { daten, frage: question, ...choice });
      logAiCost('coach', result, t);
      const entry = { id: uid(), date: t, question, result, key };
      update((d) => ({ ...d, coach: [...d.coach, entry].slice(-200) })); // die letzten 200 Analysen bleiben erhalten
      setOpenId(entry.id);
      setQuestion('');
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };

  const adopt = (plan) => {
    const all = plan.filter((p) => p.sport !== 'rest' && p.zone !== 'Ruhe').map((p) => ({ id: uid(), date: p.datum, title: p.titel, sport: p.sport, minutes: p.minuten, zone: p.zone, description: p.beschreibung, load: p.belastung, source: 'coach' }));
    // Plan der Trainerin (TrainingPeaks) hat Vorrang: diese Wochen nicht überschreiben.
    const items = outsideTpWeeks(all, getData().plan);
    if (!items.length) return toast('Diese Tage plant deine Trainerin in TrainingPeaks – nichts übernommen');
    const dates = new Set(items.map((i) => i.date));
    // Der neue Plan ersetzt die noch offenen Einheiten an denselben Tagen (auch frühere KI- oder Wizard-Einheiten).
    // Erledigte Einheiten und Polar-Einträge bleiben erhalten.
    const replaced = getData().plan.filter((p) => !p.done && p.source !== 'polar' && dates.has(p.date)).length;
    update((d) => ({ ...d, plan: [...d.plan.filter((p) => !(!p.done && p.source !== 'polar' && dates.has(p.date))), ...items] }));
    toast(`${items.length} Einheiten übernommen${replaced ? `, ${replaced} vorherige ersetzt` : ''}${all.length > items.length ? ' · TrainingPeaks-Tage ausgelassen' : ''}`);
  };

  return (
    <>
      <div style={{ marginTop: 12 }}><Seg value={mode} onChange={setMode} options={[['ask', 'Frage'], ['edit', 'Plan ändern'], ['import', 'Einlesen'], ['analyse', 'Analyse']]} /></div>
      {mode === 'ask' && <AskPanel onDone={setOpenId} />}
      {mode === 'edit' && <EditPanel />}
      {mode === 'import' && <ImportPanel />}
      {mode === 'analyse' && <>
      <p className="muted" style={{ marginTop: 12 }}>Der Coach bekommt eine Zusammenfassung deiner letzten 12 Wochen (Umfang, Zonen, Kraft, Form, HRV/Schlaf) und deine Strategie. Er bewertet sie anhand der Studienlage im Langlauf und plant die nächsten 7 Tage.</p>
      <label>Deine Strategie und Ziele</label>
      <textarea value={strategy} onChange={(e) => setStrategy(e.target.value)} rows={4} />
      <label>Frage (optional)</label>
      <textarea value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="z. B. Wie baue ich den ersten Double-Threshold-Tag ein? Lieber Rollski oder Laufen?" rows={2} />
      <AiQuality kind="coach" t={today(settings.timezone)} />
      <button className="primary wide" onClick={() => run(false)} disabled={busy} style={{ marginTop: 12 }}><BrainCircuit size={18} className={busy ? 'spin' : ''} />{busy ? 'Analysiere … (bis zu 1–2 Minuten)' : 'Analyse und Wochenplan'}</button>
      {current && !current.result?.antwort && <button className="ghost wide" style={{ marginTop: 6 }} onClick={() => run(true)} disabled={busy}>Trotzdem neu analysieren (kostet erneut)</button>}
      {error && <div className="notice" style={{ color: 'var(--bad)' }}>{error}</div>}
      </>}

      {current && (mode === 'ask' || mode === 'analyse') && <div id="coach-result"><Result entry={current} onAdopt={adopt} /></div>}

      {coach.length > 1 && <>
        <h2>Frühere Fragen und Analysen</h2>
        <p className="muted small">Die letzten 200 Analysen bleiben gespeichert. Ältere werden automatisch entfernt.</p>
        {[...coach].reverse().map((c) => (
          <div key={c.id} className="item">
            <button className="ghost grow" style={{ justifyContent: 'flex-start' }} onClick={() => setOpenId(c.id)}>{c.result?.antwort ? '💬 ' : '📊 '}{fmtDate(c.date)} {c.question ? `· ${c.question.slice(0, 50)}` : ''}</button>
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
      {r.antwort ? <div style={{ whiteSpace: 'pre-line', fontSize: 15, lineHeight: 1.5 }}>{r.antwort}</div> : <p><b>{r.zusammenfassung}</b></p>}
      <AiCost result={r} />
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

// Gemeinsame Trainingszusammenfassung für Frage und Analyse (inkl. Saisonphase).
function buildDaten(data, t) {
  const daten = coachSummary(data, t);
  const ss = data.settings.season || {};
  const avg = weekStats(data.activities, 8, t).slice(0, 7).reduce((a, w) => a + w.hours, 0) / 7;
  const base = Number(ss.baseHours) || Math.round(avg) || 10, peak = Number(ss.peakHours) || Math.round(base * 1.25);
  const start = ss.start || seasonStart(t);
  const wk = seasonPlan(data.races, { start, end: ss.end || addDays(addDays(start, 365), -1), baseHours: base, peakHours: peak });
  daten.saison = wk.filter((w) => w.to >= t).slice(0, 4).map((w) => ({ ab: w.from, phase: PHASES[w.phase].label, zielStunden: w.targetHours }));
  daten.geplant = planForEdit(data.plan, t, 14);
  return daten;
}

function ImagePicker({ imgs, setImgs, max = 4 }) {
  const add = async (files) => { try { const next = await Promise.all([...files].slice(0, max - imgs.length).map((f) => shrinkImage(f))); setImgs((x) => [...x, ...next].slice(0, max)); } catch (e) { toast(e.message); } };
  return (
    <div className="row" style={{ alignItems: 'center', gap: 6, marginTop: 6 }}>
      <label className="chip" style={{ cursor: 'pointer' }}><ImagePlus size={14} /> Bild/Screenshot<input type="file" accept="image/*" multiple hidden onChange={(e) => { add(e.target.files); e.target.value = ''; }} /></label>
      {imgs.map((im, i) => <button key={i} className="chip" onClick={() => setImgs((x) => x.filter((_, j) => j !== i))}>🖼️ {im.name?.slice(0, 14) || `Bild ${i + 1}`} ✕</button>)}
    </div>
  );
}

// Frage: schnelle, günstige Antwort auf Basis deiner Daten – ohne Gesamtanalyse und Wochenplan.
const ASK_EXAMPLES = ['Wie hart soll ich morgen die Schwelle laufen?', 'Was sagt mir die Entkopplung bei meinem letzten langen Lauf?', 'Bin ich für den Halbmarathon auf Kurs?', 'Was esse ich vor einem Double-Threshold-Tag?'];
function AskPanel({ onDone }) {
  const { settings } = useData();
  const [q, setQ] = useState('');
  const [imgs, setImgs] = useState([]);
  const [busy, setBusy] = useState(false);
  const ask = async () => {
    const data = getData(), t = today(data.settings.timezone);
    const choice = aiChoice(data.settings, 'ask');
    if (!budgetOk(data.settings, 'ask', choice.model, choice.effort, t)) return;
    setBusy(true);
    try {
      const result = await kiPost('/api/frage', { daten: buildDaten(data, t), frage: q, bilder: imgs.map(({ type, data: b }) => ({ type, data: b })), ...choice });
      logAiCost('ask', result, t);
      const entry = { id: uid(), date: t, question: q, result, mode: 'frage' };
      update((d) => ({ ...d, coach: [...d.coach, entry].slice(-200) }));
      onDone(entry.id); setQ(''); setImgs([]);
      setTimeout(() => document.getElementById('coach-result')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
    } catch (e) { toast(e.message); }
    setBusy(false);
  };
  return (
    <>
      <p className="muted small">Kurze Frage, kurze Antwort – der Coach kennt dabei deine letzten Wochen, Erholungswerte und den Plan der nächsten 14 Tage. Du kannst einen Screenshot anhängen (z. B. eine Einheit oder einen Plan).</p>
      <textarea value={q} onChange={(e) => setQ(e.target.value)} rows={3} placeholder="Deine Frage …" />
      <div className="chips scroll">{ASK_EXAMPLES.map((x) => <button key={x} className="chip" onClick={() => setQ(x)}>{x}</button>)}</div>
      <ImagePicker imgs={imgs} setImgs={setImgs} />
      <AiQuality kind="ask" t={today(settings.timezone)} />
      <button className="primary wide" style={{ marginTop: 10 }} disabled={busy || !q.trim()} onClick={ask}><MessageCircle size={18} className={busy ? 'spin' : ''} />{busy ? 'Denke nach …' : 'Fragen'}</button>
    </>
  );
}

// Plan ändern: kleine Änderungen per Satz, die mit den normalen Knöpfen umständlich wären. Vorschau vor dem Übernehmen.
const EDIT_EXAMPLES = ['Verschiebe die Schwelle von Donnerstag auf Freitag', 'Nächste Woche 20 % weniger, ich habe Prüfungen', 'Am Samstag habe ich nur 1 Stunde', 'Tausche diese Woche Rollski gegen Rad', 'Ich bin erkältet, plane die nächsten 3 Tage locker'];
const ACT = { neu: ['➕', 'neu'], aendern: ['✏️', 'geändert'], loeschen: ['🗑️', 'entfernt'] };
function EditPanel() {
  const { settings, plan } = useData();
  const [w, setW] = useState('');
  const [imgs, setImgs] = useState([]);
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState(null);
  const byId = Object.fromEntries(plan.map((p) => [p.id, p]));
  const run = async () => {
    const data = getData(), t = today(data.settings.timezone);
    const choice = aiChoice(data.settings, 'edit');
    if (!budgetOk(data.settings, 'edit', choice.model, choice.effort, t)) return;
    setBusy(true);
    try {
      const s0 = coachSummary(data, t);
      const r = await kiPost('/api/plan-edit', { plan: planForEdit(data.plan, t, 28), wunsch: w, heute: t, kontext: { formHeute: s0.formHeute, letzteEinheiten: (s0.letzte21Tage || []).slice(-10), erholung: s0.erholung }, bilder: imgs.map(({ type, data: b }) => ({ type, data: b })), ...choice });
      logAiCost('edit', r, t);
      setRes(r);
      setTimeout(() => document.getElementById('edit-result')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
    } catch (e) { toast(e.message); }
    setBusy(false);
  };
  const apply = () => {
    const t = today(getData().settings.timezone);
    let out = null;
    update((d) => { out = applyPlanEdits(d.plan, res.aenderungen, uid, t); return { ...d, plan: out.plan }; });
    toast([out.added && `${out.added} neu`, out.changed && `${out.changed} geändert`, out.removed && `${out.removed} entfernt`].filter(Boolean).join(', ') + (out.skipped.length ? ` · ${out.skipped.length} übersprungen` : '') || 'Nichts geändert');
    setRes(null); setW(''); setImgs([]);
  };
  return (
    <>
      <p className="muted small">Sag in einem Satz, was sich ändern soll – der Coach passt nur das an und zeigt dir vorher, was er ändert. Einheiten deiner Trainerin (TrainingPeaks) bleiben, außer du verlangst es ausdrücklich.</p>
      <textarea value={w} onChange={(e) => setW(e.target.value)} rows={3} placeholder="Was soll sich ändern?" />
      <div className="chips scroll">{EDIT_EXAMPLES.map((x) => <button key={x} className="chip" onClick={() => setW(x)}>{x}</button>)}</div>
      <ImagePicker imgs={imgs} setImgs={setImgs} max={2} />
      <AiQuality kind="edit" t={today(settings.timezone)} />
      <button className="primary wide" style={{ marginTop: 10 }} disabled={busy || !w.trim()} onClick={run}><Wand2 size={18} className={busy ? 'spin' : ''} />{busy ? 'Plane um …' : 'Änderung vorschlagen'}</button>
      {res && <div className="card" id="edit-result">
        <p style={{ marginTop: 0 }}><b>{res.erklaerung}</b></p>
        <AiCost result={res} />
        {!res.aenderungen.length && <p className="muted small">Keine Änderungen vorgeschlagen.</p>}
        {res.aenderungen.map((o, i) => { const old = o.id && byId[o.id]; return (
          <div key={i} className="item" style={{ alignItems: 'flex-start' }}>
            <span style={{ flex: 'none' }}>{ACT[o.aktion]?.[0]}</span>
            <div className="grow"><b>{o.aktion === 'loeschen' ? (old?.title || o.titel) : o.titel}</b> <span className="muted small">{ACT[o.aktion]?.[1]}</span>
              <p>{o.aktion === 'loeschen' ? `${fmtDate(old?.date || o.datum)} · ${old?.minutes ?? o.minuten} min` : `${fmtDate(o.datum)} · ${sportLabel(o.sport)} · ${o.minuten} min${o.zone ? ` · ${o.zone}` : ''}`}
                {o.aktion === 'aendern' && old ? <span className="muted"> (vorher {fmtDate(old.date)} · {sportLabel(old.sport)} · {old.minutes} min)</span> : null}</p>
            </div>
          </div>); })}
        {res.aenderungen.length > 0 && <div className="row"><button className="secondary" onClick={() => setRes(null)}>Verwerfen</button><button className="primary" onClick={apply}><CalendarPlus size={17} />Übernehmen</button></div>}
      </div>}
    </>
  );
}

// Einlesen: Plan der Trainerin (Screenshot oder Text) – dieselbe Funktion wie im Kalender.
function ImportPanel() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <p className="muted small">Plan deiner Trainerin aus einem Screenshot (TrainingPeaks-App, Polar Flow, Foto, Tabelle) oder aus Text (z. B. die tägliche TrainingPeaks-Mail) übernehmen. Die KI liest die Einheiten aus, du prüfst sie, dann landen sie im Kalender und haben Vorrang vor dem App-Plan.</p>
      <button className="primary wide" onClick={() => setOpen(true)}><ImagePlus size={18} />Plan einlesen</button>
      <p className="muted small">Auch im Kalender unter „Plan der Trainerin“.</p>
      {open && <PlanImportSheet onClose={() => setOpen(false)} />}
    </>
  );
}
