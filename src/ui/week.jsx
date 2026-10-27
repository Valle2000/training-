import React, { useMemo, useState } from 'react';
import { Plus, Trash2, Wand2, Check, X, Gauge, CalendarCheck } from 'lucide-react';
import { useData, update, uid } from '../lib/store.js';
import { curve, today } from '../lib/activities.js';
import { addDays } from '../lib/metrics.js';
import { adaptWeek, applyOps, hasSchedule, PERIOD_TYPES } from '../lib/week-adapt.js';
import { suggestThresholds } from '../lib/thresholds.js';
import { weekReview } from '../lib/review.js';
import { recomputeAll } from '../lib/recompute.js';
import { Sheet, toast } from './common.jsx';

const DOW = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const PRESETS = ['Uni', 'Arbeit', 'Lernen', 'Pendeln', 'Termin'];

// Alltag: feste Wochentermine (Vorlesungen, Arbeit …) und einzelne Termine. Daraus berechnet die App die freie
// Trainingszeit je Tag – für den Saisonplan-Assistenten, Uhrzeit-Vorschläge und die Wochen-Anpassung.
export function ScheduleSheet({ onClose }) {
  const { settings } = useData();
  const t = today(settings.timezone);
  const [s, setS] = useState({ start: '06:30', end: '21:30', buffer: 15, blocks: [], oneOff: [], periods: [], ...(settings.schedule || {}) });
  const setPer = (id, k, v) => set('periods', s.periods.map((b) => (b.id === id ? { ...b, [k]: v } : b)));
  const set = (k, v) => setS({ ...s, [k]: v });
  const setBlock = (id, k, v) => set('blocks', s.blocks.map((b) => (b.id === id ? { ...b, [k]: v } : b)));
  const setOne = (id, k, v) => set('oneOff', s.oneOff.map((b) => (b.id === id ? { ...b, [k]: v } : b)));
  const save = () => {
    // Vergangene Einzeltermine aufräumen.
    update((d) => ({ ...d, settings: { ...d.settings, schedule: { ...s, oneOff: s.oneOff.filter((b) => b.date >= t), periods: s.periods.filter((b) => b.to >= addDays(t, -60)) } } }));
    toast('Alltag gespeichert');
    onClose();
  };
  return (
    <Sheet title="Alltag & freie Zeit" onClose={onClose}>
      <p className="muted small">Trag feste Termine wie Uni, Arbeit oder Pendeln ein. Die App plant Training nur in die freien Zeiten, schlägt Uhrzeiten vor und meldet, wenn eine Einheit nicht mehr in den Tag passt.</p>
      <div className="grid2">
        <div><label>Tag beginnt</label><input type="time" value={s.start} onChange={(e) => set('start', e.target.value)} /></div>
        <div><label>Tag endet</label><input type="time" value={s.end} onChange={(e) => set('end', e.target.value)} /></div>
        <div><label>Puffer vor/nach Terminen (min)</label><input type="number" min="0" value={s.buffer} onChange={(e) => set('buffer', Number(e.target.value))} /></div>
      </div>

      <h3>Jede Woche</h3>
      {s.blocks.map((b) => (
        <div key={b.id} className="card">
          <div className="row" style={{ flexWrap: 'nowrap' }}>
            <input value={b.label} onChange={(e) => setBlock(b.id, 'label', e.target.value)} placeholder="z. B. Uni" />
            <button className="ghost" style={{ flex: 'none' }} onClick={() => set('blocks', s.blocks.filter((x) => x.id !== b.id))} aria-label="Entfernen"><Trash2 size={16} /></button>
          </div>
          <div className="chips">{DOW.map((d, i) => <button key={d} className={`chip${b.dows.includes(i + 1) ? ' on' : ''}`} onClick={() => setBlock(b.id, 'dows', b.dows.includes(i + 1) ? b.dows.filter((x) => x !== i + 1) : [...b.dows, i + 1].sort())}>{d}</button>)}</div>
          <div className="grid2">
            <div><label>von</label><input type="time" value={b.from} onChange={(e) => setBlock(b.id, 'from', e.target.value)} /></div>
            <div><label>bis</label><input type="time" value={b.to} onChange={(e) => setBlock(b.id, 'to', e.target.value)} /></div>
            <div><label>gilt bis (optional, z. B. Semesterende)</label><input type="date" value={b.until || ''} onChange={(e) => setBlock(b.id, 'until', e.target.value || null)} /></div>
          </div>
        </div>
      ))}
      <div className="chips">{PRESETS.map((l) => <button key={l} className="chip" onClick={() => set('blocks', [...s.blocks, { id: uid(), label: l, dows: [1, 2, 3, 4, 5], from: l === 'Pendeln' ? '07:30' : '08:00', to: l === 'Pendeln' ? '08:00' : l === 'Arbeit' ? '17:00' : '16:00' }])}><Plus size={13} /> {l}</button>)}</div>

      <h3>Einzelne Termine</h3>
      {s.oneOff.map((b) => (
        <div key={b.id} className="card">
          <div className="row" style={{ flexWrap: 'nowrap' }}>
            <input value={b.label} onChange={(e) => setOne(b.id, 'label', e.target.value)} placeholder="z. B. Klausur, Reise" />
            <button className="ghost" style={{ flex: 'none' }} onClick={() => set('oneOff', s.oneOff.filter((x) => x.id !== b.id))} aria-label="Entfernen"><Trash2 size={16} /></button>
          </div>
          <div className="grid2">
            <div><label>Datum</label><input type="date" value={b.date} onChange={(e) => setOne(b.id, 'date', e.target.value)} /></div>
            <div><label>ganzer Tag</label><input type="checkbox" checked={b.from === '00:00' && b.to === '23:59'} onChange={(e) => setS({ ...s, oneOff: s.oneOff.map((x) => (x.id === b.id ? { ...x, from: e.target.checked ? '00:00' : '09:00', to: e.target.checked ? '23:59' : '12:00' } : x)) })} style={{ width: 20, height: 20 }} /></div>
            {!(b.from === '00:00' && b.to === '23:59') && <>
              <div><label>von</label><input type="time" value={b.from} onChange={(e) => setOne(b.id, 'from', e.target.value)} /></div>
              <div><label>bis</label><input type="time" value={b.to} onChange={(e) => setOne(b.id, 'to', e.target.value)} /></div>
            </>}
          </div>
        </div>
      ))}
      <button className="secondary" onClick={() => set('oneOff', [...s.oneOff, { id: uid(), label: '', date: t, from: '09:00', to: '12:00' }])}><Plus size={16} />Termin</button>
      <h3>Besondere Zeiten</h3>
      <p className="muted small">Prüfungsphase, Reise oder Trainingslager: Der Saisonplan-Assistent und „Woche anpassen“ passen Umfang und harte Einheiten automatisch an.</p>
      {s.periods.map((b) => (
        <div key={b.id} className="card">
          <div className="row" style={{ flexWrap: 'nowrap' }}>
            <select value={b.type} onChange={(e) => setPer(b.id, 'type', e.target.value)}>{Object.entries(PERIOD_TYPES).map(([id, x]) => <option key={id} value={id}>{x.label}</option>)}</select>
            <button className="ghost" style={{ flex: 'none' }} onClick={() => set('periods', s.periods.filter((x) => x.id !== b.id))} aria-label="Entfernen"><Trash2 size={16} /></button>
          </div>
          <input value={b.label || ''} onChange={(e) => setPer(b.id, 'label', e.target.value)} placeholder={`Name (optional), z. B. ${b.type === 'exam' ? 'Klausuren WiSe' : b.type === 'camp' ? 'Trainingslager Ramsau' : 'Urlaub'}`} style={{ marginTop: 6 }} />
          <div className="grid2">
            <div><label>von</label><input type="date" value={b.from} onChange={(e) => setPer(b.id, 'from', e.target.value)} /></div>
            <div><label>bis</label><input type="date" value={b.to} onChange={(e) => setPer(b.id, 'to', e.target.value)} /></div>
          </div>
          <p className="muted small" style={{ marginBottom: 0 }}>{PERIOD_TYPES[b.type]?.note}</p>
        </div>
      ))}
      <div className="chips">{Object.entries(PERIOD_TYPES).map(([id, x]) => <button key={id} className="chip" onClick={() => set('periods', [...s.periods, { id: uid(), type: id, label: '', from: t, to: addDays(t, 13) }])}><Plus size={13} /> {x.label}</button>)}</div>
      <button className="primary wide" style={{ marginTop: 12 }} onClick={save}><Check size={17} />Speichern</button>
    </Sheet>
  );
}

// Vorschläge für die restliche Woche (Morgen-Check, Krankheit, verpasste Einheiten, zu wenig Zeit).
export function AdaptCard() {
  const data = useData();
  const t = today(data.settings.timezone);
  const form = useMemo(() => curve(data.activities, data.plan, t, 0).find((d) => d.day === t)?.form ?? null, [data.activities, data.plan, t]);
  const [hidden, setHidden] = useState([]);
  const list = useMemo(() => adaptWeek(data, t, form), [data, t, form]).filter((s) => !hidden.includes(s.id));
  if (!list.length) return null;
  const apply = (s) => { update((d) => ({ ...d, plan: applyOps(d.plan, s.ops) })); toast('Plan angepasst'); };
  const color = { rot: 'var(--bad)', gelb: 'var(--warn, #c88a00)', info: 'var(--accent)' };
  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}><Wand2 size={16} /> Woche anpassen</h3>
      {list.map((s) => (
        <div key={s.id} style={{ borderLeft: `3px solid ${color[s.level] || color.info}`, paddingLeft: 10, margin: '10px 0' }}>
          <b className="small">{s.title}</b>
          <p className="small" style={{ margin: '2px 0 6px' }}>{s.text}</p>
          <div className="row">
            {s.ops.length > 0 && <button className="secondary" style={{ flex: 'none' }} onClick={() => apply(s)}><Check size={15} />Übernehmen</button>}
            <button className="ghost" style={{ flex: 'none' }} onClick={() => setHidden([...hidden, s.id])}><X size={15} />Ignorieren</button>
          </div>
        </div>
      ))}
      {list.length > 1 && list.some((s) => s.ops.length) && <button className="primary wide" onClick={() => { update((d) => ({ ...d, plan: list.reduce((p, s) => applyOps(p, s.ops), d.plan) })); toast('Alle Vorschläge übernommen'); }}>Alle übernehmen</button>}
      {!hasSchedule(data.settings.schedule) && <p className="muted small" style={{ marginBottom: 0 }}>Tipp: Unter Kalender → Woche → „Alltag“ Uni/Arbeit eintragen, dann berücksichtigt die Anpassung auch deine freie Zeit.</p>}
    </div>
  );
}

// Schwellen-Vorschläge aus Laktattests, Bestwerten und Ruhepuls.
export function ThresholdCard({ compact = false, onApplied }) {
  const data = useData();
  const t = today(data.settings.timezone);
  const list = useMemo(() => suggestThresholds(data, t), [data, t]).filter((x) => data.settings.thresholdDismissed?.[x.key] !== x.value);
  const [busy, setBusy] = useState(false);
  if (!list.length) return null;
  const take = async (items) => {
    setBusy(true);
    update((d) => ({ ...d, settings: { ...d.settings, ...Object.fromEntries(items.map((x) => [x.key, String(x.value)])) } }));
    onApplied?.(items);
    toast(`Übernommen · ${await recomputeAll()} Einheiten neu berechnet`);
    setBusy(false);
  };
  const dismiss = (x) => update((d) => ({ ...d, settings: { ...d.settings, thresholdDismissed: { ...(d.settings.thresholdDismissed || {}), [x.key]: x.value } } }));
  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}><Gauge size={16} /> Schwellen aktualisieren?</h3>
      {list.map((x) => (
        <div key={x.key} style={{ margin: '8px 0' }}>
          <b className="small">{x.label}: {x.current ?? '–'} → {x.value}{x.unit ? ` ${x.unit}` : ''}</b>
          {!compact && <p className="small muted" style={{ margin: '2px 0 4px' }}>{x.reason}</p>}
          <div className="row">
            <button className="secondary" style={{ flex: 'none' }} disabled={busy} onClick={() => take([x])}><Check size={15} />Übernehmen</button>
            <button className="ghost" style={{ flex: 'none' }} onClick={() => dismiss(x)}><X size={15} />Nein</button>
          </div>
        </div>
      ))}
      <p className="muted small" style={{ marginBottom: 0 }}>Danach werden Zonen und Belastung aller Einheiten neu berechnet.</p>
    </div>
  );
}


const TIP_COLOR = { gelb: 'var(--warn)', info: 'var(--accent)', gut: 'var(--good)' };
// Wochenrückblick als Inhalt (für Karte und Sheet).
function ReviewBody({ r, full }) {
  const n1 = (v) => String(Math.round(v * 10) / 10).replace('.', ',');
  return <>
    <div className="stats">
      <div><b>{n1(r.hours)}<small className="muted">{r.comp.plannedMin ? `/${n1(r.comp.plannedMin / 60)}` : ''}</small></b><span>Stunden Ist/Soll</span></div>
      <div><b>{r.hardSessions}</b><span>harte Einheiten{r.missedHard ? ` (${r.missedHard} ausgefallen)` : ''}</span></div>
      <div><b>{r.deltaPct != null ? `${r.deltaPct > 0 ? '+' : ''}${r.deltaPct} %` : '–'}</b><span>vs. Ø 4 Wochen</span></div>
    </div>
    {r.tips.map((x) => <p key={x.text} className="small" style={{ borderLeft: `3px solid ${TIP_COLOR[x.level]}`, paddingLeft: 8, margin: '8px 0' }}>{x.text}</p>)}
    {full && <>
      {r.share && <p className="small">Intensität: locker {r.share.easy} % · Schwelle {r.share.thr} % · hart {r.share.hard} % · Kraft {r.strength}×</p>}
      {r.sports.length > 0 && <p className="small">Sportarten: {r.sports.map((s) => `${s.label} ${n1(s.hours)} h`).join(' · ')}</p>}
      {r.longest && <p className="small">Längste Einheit: {r.longest.title} ({r.longest.minutes} min)</p>}
      {r.keys.length > 0 && <p className="small">Key Sessions: {r.keys.map((k) => `${k.name}${k.power ? ` ${Math.round(k.power)} W` : ''}${k.hr ? ` @ ${Math.round(k.hr)} bpm` : ''}${k.lactate != null ? `, ${String(k.lactate).replace('.', ',')} mmol/l` : ''}${k.ratioPct != null ? ` (${k.ratioPct > 0 ? '+' : ''}${String(k.ratioPct).replace('.', ',')} % Leistung je Puls ggü. ${new Date(k.beforeDate + 'T12:00:00').toLocaleDateString('de-DE', { day: 'numeric', month: 'short' })})` : ''}`).join(' · ')}</p>}
      {(r.hrv || r.sleep || r.feel) && <p className="small">Erholung: {[r.hrv && `HRV ${r.hrv.avg7} ms (${r.hrv.status === 'low' ? 'unter' : r.hrv.status === 'high' ? 'über' : 'im'} Normalbereich)`, r.sleep && `Schlaf Ø ${n1(r.sleep)} h`, r.feel && `Gefühl Ø ${n1(r.feel)}/5`].filter(Boolean).join(' · ')}</p>}
      <p className="small">Nächste Woche: {r.next.count ? `${n1(r.next.hours)} h geplant, ${r.next.hard} harte Einheit(en)` : 'noch nichts geplant'}{r.next.races.length ? `, Rennen: ${r.next.races.map((x) => x.name).join(', ')}` : ''}.</p>
    </>}
  </>;
}

export function WeekReviewSheet({ monday, onClose }) {
  const data = useData();
  const t = today(data.settings.timezone);
  const r = useMemo(() => weekReview(data, monday, t), [data, monday, t]);
  return (
    <Sheet title={`Wochenrückblick ${new Date(monday + 'T12:00:00').toLocaleDateString('de-DE', { day: 'numeric', month: 'short' })} – ${new Date(r.sunday + 'T12:00:00').toLocaleDateString('de-DE', { day: 'numeric', month: 'short' })}`} onClose={onClose}>
      <ReviewBody r={r} full />
    </Sheet>
  );
}

// Auf „Heute“: sonntags die laufende Woche, montags und dienstags die vergangene.
export function WeekReviewCard() {
  const data = useData();
  const t = today(data.settings.timezone);
  const dow = ((new Date(t + 'T12:00:00Z').getUTCDay() + 6) % 7) + 1;
  const monday = dow === 7 ? addDays(t, -6) : dow <= 2 ? addDays(t, -(dow - 1) - 7) : null;
  const [open, setOpen] = useState(false);
  const r = useMemo(() => (monday ? weekReview(data, monday, t) : null), [data, monday, t]);
  if (!r || !r.sessions || data.settings.reviewSeen === monday) return null;
  return (
    <div className="card">
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0, flex: 'none' }}><CalendarCheck size={16} /> Wochenrückblick</h3>
        <button className="ghost" style={{ flex: 'none' }} onClick={() => update((d) => ({ ...d, settings: { ...d.settings, reviewSeen: monday } }))} aria-label="Ausblenden"><X size={16} /></button>
      </div>
      <ReviewBody r={r} />
      <button className="secondary" onClick={() => setOpen(true)}>Details</button>
      {open && <WeekReviewSheet monday={monday} onClose={() => setOpen(false)} />}
    </div>
  );
}
