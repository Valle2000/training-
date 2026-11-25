import React, { useState } from 'react';
import { ImagePlus, Sparkles, Trash2, Check } from 'lucide-react';
import { getData, update, uid } from '../lib/store.js';
import { kiPost } from '../lib/ai.js';
import { aiToPlan, shrinkImage } from '../lib/plan-import.js';
import { mergeFeedPlan } from '../lib/ical.js';
import { today } from '../lib/activities.js';
import { SPORTS, sportEmoji } from '../lib/sports.js';
import { Sheet, fmtDate, toast } from './common.jsx';
import { aiChoice, logAiCost, budgetOk, AiQuality } from './ai-quality.jsx';

// Plan der Trainerin ohne TrainingPeaks-Premium: Screenshot(s) oder Text → KI liest aus → prüfen → in den Kalender.
export function PlanImportSheet({ onClose }) {
  const [imgs, setImgs] = useState([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [items, setItems] = useState(null);
  const [hint, setHint] = useState('');

  const addFiles = async (files) => {
    try {
      const next = await Promise.all([...files].slice(0, 6 - imgs.length).map((f) => shrinkImage(f)));
      setImgs((x) => [...x, ...next].slice(0, 6));
    } catch (e) { toast(e.message); }
  };
  const read = async () => {
    const data = getData(), t = today(data.settings.timezone);
    const choice = aiChoice(data.settings, 'planImport');
    if (!budgetOk(data.settings, 'planImport', choice.model, choice.effort, t)) return;
    setBusy(true);
    try {
      const r = await kiPost('/api/plan-import', { bilder: imgs.map(({ type, data: d }) => ({ type, data: d })), text, heute: t, ...choice });
      logAiCost('planImport', r, t);
      const list = aiToPlan(r.einheiten);
      setItems(list); setHint(r.hinweis || '');
      if (!list.length) toast('Keine Einheiten erkannt – ist der Plan gut lesbar?');
    } catch (e) { toast(e.message); }
    setBusy(false);
  };
  const edit = (i, k, v) => setItems((xs) => xs.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  const save = () => {
    const list = items.filter((x) => x.date).sort((a, b) => a.date.localeCompare(b.date));
    let res = null;
    update((d) => { res = mergeFeedPlan(d.plan, list, uid); return { ...d, plan: res.plan }; });
    toast(`${res.added} Einheit(en) der Trainerin eingetragen${res.replacedOwn ? `, ${res.replacedOwn} App-Einheiten in diesen Wochen entfernt` : ''}`);
    onClose();
  };

  return (
    <Sheet title="Plan der Trainerin übernehmen" onClose={onClose}>
      {!items && <>
        <p className="muted small" style={{ marginTop: 0 }}>Ohne TrainingPeaks-Premium: Mach einen Screenshot vom Kalender (TrainingPeaks-App oder -Web, Polar Flow, auch ein Foto oder eine Tabelle geht) oder füge Text ein, z. B. aus der täglichen TrainingPeaks-Mail. Die KI liest die Einheiten aus, du prüfst sie und übernimmst sie.</p>
        <label className="secondary wide" style={{ cursor: 'pointer' }}><ImagePlus size={17} />Screenshots wählen ({imgs.length}/6)<input type="file" accept="image/*" multiple hidden onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} /></label>
        {imgs.length > 0 && <div className="chips" style={{ marginTop: 8 }}>{imgs.map((im, i) => <button key={i} className="chip" onClick={() => setImgs((x) => x.filter((_, j) => j !== i))}>🖼️ {im.name?.slice(0, 18) || `Bild ${i + 1}`} ✕</button>)}</div>}
        <label>oder Text einfügen</label>
        <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder={'z. B.\nDi 2.12. XC-Ski 1:30 – 20 min ein, 3×12 min L4, 3 min Pause\nMi Lauf locker 50 min'} rows={5} />
        <button className="primary wide" style={{ marginTop: 10 }} disabled={busy || (!imgs.length && !text.trim())} onClick={read}><Sparkles size={17} className={busy ? 'spin' : ''} />{busy ? 'Lese aus …' : 'Einheiten auslesen'}</button>
        <AiQuality kind="planImport" t={today(getData().settings.timezone)} />
        <p className="muted small">Tipp: In der TrainingPeaks-App die Wochenansicht oder einzelne Tage mit Beschreibung abfotografieren, dann stimmen Dauer und Ablauf am besten.</p>
      </>}
      {items && <>
        {hint && <div className="notice small">{hint}</div>}
        {items.map((x, i) => (
          <div key={i} className="card" style={{ padding: 12, borderLeft: x.minutesGuessed ? '4px solid var(--warn)' : undefined }}>
            <div className="row" style={{ flexWrap: 'nowrap', gap: 8 }}>
              <span className="ico-badge" style={{ flex: 'none' }}>{sportEmoji(x.sport)}</span>
              <input value={x.title} onChange={(e) => edit(i, 'title', e.target.value)} style={{ flex: 1 }} />
              <button className="ghost" style={{ flex: 'none' }} aria-label="Entfernen" onClick={() => setItems((xs) => xs.filter((_, j) => j !== i))}><Trash2 size={16} /></button>
            </div>
            <div className="row" style={{ gap: 6, marginTop: 6 }}>
              <input type="date" value={x.date} onChange={(e) => edit(i, 'date', e.target.value)} style={{ flex: '1 1 130px' }} />
              <select value={x.sport} onChange={(e) => edit(i, 'sport', e.target.value)} style={{ flex: '1 1 130px' }}>{SPORTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select>
              <input type="number" min="0" max="600" value={x.minutes} onChange={(e) => edit(i, 'minutes', Number(e.target.value) || 0)} style={{ flex: '0 0 80px' }} aria-label="Minuten" />
              <select value={x.zone || ''} onChange={(e) => edit(i, 'zone', e.target.value || null)} style={{ flex: '0 0 84px' }}>{['', 'I1', 'I2', 'I3', 'I4', 'I5', 'Kraft'].map((z) => <option key={z} value={z}>{z || 'Zone?'}</option>)}</select>
            </div>
            <div className="small muted" style={{ marginTop: 4 }}>{fmtDate(x.date, { weekday: 'short', day: 'numeric', month: 'short' })}{x.minutesGuessed ? ' · Dauer geschätzt' : ''}{x.description ? ` · ${x.description.slice(0, 160)}` : ''}</div>
          </div>
        ))}
        <div className="row" style={{ marginTop: 8 }}>
          <button className="secondary" onClick={() => setItems(null)}>Zurück</button>
          <button className="primary" disabled={!items.length} onClick={save}><Check size={17} />{items.length} übernehmen</button>
        </div>
        <p className="muted small">Der Plan der Trainerin hat Vorrang: In diesen Wochen werden offene Einheiten aus der App entfernt; erledigte bleiben. Liest du dieselbe Woche später noch einmal ein, ersetzt das die vorherige Fassung.</p>
      </>}
    </Sheet>
  );
}
