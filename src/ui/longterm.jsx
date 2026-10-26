import React, { useMemo, useState } from 'react';
import { ZONES } from '../lib/metrics.js';
import { sportById, sportLabel } from '../lib/sports.js';
import { buckets, rolling } from '../lib/analysis.js';
import { seasonCumulative, seasonTable, seasonStart, seasonLabel, bandSeconds, hrAtPower, powerAtHr, tolerance, healthRatios } from '../lib/longterm.js';
import { HEALTH_TYPES } from '../lib/gear.js';
import { LineChart, StackedBars, ZONE_COLORS } from './charts.jsx';
import { Seg, fmtDate, fmtNum } from './common.jsx';

const SEASON_COLORS = ['var(--load)', 'var(--fat)', 'var(--form)', 'var(--fit)'];
const WINDOWS = [[90, '3 Monate'], [182, '6 Monate'], [365, '1 Jahr'], [730, '2 Jahre'], [100000, 'Alles']];
const short = (d) => fmtDate(d, { day: 'numeric', month: 'numeric', year: '2-digit' });

export function LongTerm({ activities, acts, range, filter, settings, health, t, openActivity }) {
  const [part, setPart] = useState('band');
  return (
    <>
      <div style={{ marginTop: 12 }}><Seg value={part} onChange={setPart} options={[['band', 'Stunden im Bereich'], ['hrpower', 'Puls bei Watt'], ['tolerance', 'Belastbarkeit'], ['seasons', 'Saisons']]} /></div>
      {part === 'band' && <BandHours acts={acts} range={range} settings={settings} />}
      {part === 'hrpower' && <HrAtPower acts={acts} filter={filter} openActivity={openActivity} />}
      {part === 'tolerance' && <Tolerance activities={activities} health={health} t={t} />}
      {part === 'seasons' && <Seasons activities={activities} t={t} />}
    </>
  );
}

// Stunden zwischen zwei frei wählbaren Puls- oder Wattwerten, je Woche/Monat/Saison über den gewählten Zeitraum.
function BandHours({ acts, range, settings }) {
  const hrMax = Number(settings.hrMax) || null;
  const [kind, setKind] = useState('hr');
  const [band, setBand] = useState({ hr: [hrMax ? Math.round(hrMax * 0.72) : 130, hrMax ? Math.round(hrMax * 0.82) : 150], power: [150, 200] });
  const [by, setBy] = useState('month');
  const [lo, hi] = band[kind].map(Number);
  const key = kind === 'power' ? 'powerHist' : 'hrHist';
  const withData = acts.filter((a) => a[key]);
  const bk = useMemo(() => {
    const val = (list) => list.reduce((s, a) => s + bandSeconds(a, kind, lo, hi), 0) / 3600;
    if (by === 'season') {
      const g = {};
      for (const a of withData) (g[seasonStart(a.date)] ||= []).push(a);
      return Object.keys(g).sort().map((s) => ({ from: s, label: seasonLabel(s), band: val(g[s]), total: g[s].reduce((x, a) => x + (a.durationS || 0) / 3600, 0) }));
    }
    return buckets(withData, range, by).map((b) => { const list = withData.filter((a) => a.date >= b.from && a.date <= b.to); return { ...b, band: val(list), total: b.hours }; });
  }, [withData, kind, lo, hi, by, range.from, range.to]);
  const total = bk.reduce((s, b) => s + b.band, 0);
  // Zonen als Schnellwahl: Grenzen aus dem Laktattest, sonst % HFmax.
  const b = settings.zoneHr?.length === 4 && settings.zoneHr.every(Boolean) ? settings.zoneHr : null;
  const edges = hrMax ? (b ? [Math.round(ZONES[0].from * hrMax), ...b, hrMax] : [...ZONES.map((z) => Math.round(z.from * hrMax)), hrMax]) : [];
  const presets = kind === 'hr' && hrMax ? ZONES.map((z, i) => [z.id, edges[i], edges[i + 1]]) : [];
  const set = (i, v) => setBand({ ...band, [kind]: band[kind].map((x, k) => (k === i ? v : x)) });
  return (
    <>
      <div className="card">
        <Seg value={kind} onChange={setKind} options={[['hr', 'Puls (bpm)'], ['power', 'Leistung (W)']]} />
        <div className="grid2">
          <div><label>Von</label><input inputMode="numeric" value={band[kind][0]} onChange={(e) => set(0, e.target.value)} /></div>
          <div><label>Bis</label><input inputMode="numeric" value={band[kind][1]} onChange={(e) => set(1, e.target.value)} /></div>
        </div>
        {presets.length > 0 && <div className="chips">{presets.map(([id, a, b]) => <button key={id} className="chip" onClick={() => setBand({ ...band, hr: [a, b] })}>{id} ({a}–{b})</button>)}</div>}
        {kind === 'power' && <p className="muted small">Watt sind zwischen Sportarten nicht vergleichbar – oben nach einer Sportart filtern (Rad, SkiErg …).</p>}
        <div className="stats">
          <div><b>{fmtNum(total, 1)}</b><span>Stunden {lo}–{hi} {kind === 'hr' ? 'bpm' : 'W'}</span></div>
          <div><b>{fmtNum(total / Math.max(1, bk.length), 1)}</b><span>Ø je {by === 'week' ? 'Woche' : by === 'month' ? 'Monat' : 'Saison'}</span></div>
          <div><b>{withData.length}</b><span>Einheiten mit Verlauf</span></div>
        </div>
      </div>
      <div className="card">
        <Seg value={by} onChange={setBy} options={[['week', 'Wochen'], ['month', 'Monate'], ['season', 'Saisons']]} />
        <StackedBars buckets={bk} unit=" h" stacks={[{ key: 'band', label: `${lo}–${hi} ${kind === 'hr' ? 'bpm' : 'W'}`, color: 'var(--accent)' }]} value={(b) => b.band} />
        <div style={{ overflowX: 'auto' }}>
          <table className="t"><thead><tr><th>{by === 'season' ? 'Saison' : by === 'month' ? 'Monat' : 'Woche'}</th><th>im Bereich</th><th>gesamt</th><th>Anteil</th></tr></thead>
            <tbody>{[...bk].reverse().map((b) => <tr key={b.from}><td>{b.label}</td><td>{fmtNum(b.band, 1)} h</td><td>{fmtNum(b.total, 1)} h</td><td>{b.total ? Math.round((b.band / b.total) * 100) + ' %' : '–'}</td></tr>)}</tbody></table>
        </div>
        <p className="muted small">Gezählt werden nur Einheiten mit Puls- bzw. Wattverlauf. Für mehr Vergangenheit oben „Alles“ wählen und alte Einheiten importieren.</p>
      </div>
    </>
  );
}

// Puls bei gleicher Leistung über die Zeit: sinkt er, wird die aerobe Basis besser (und umgekehrt Watt bei gleichem Puls).
function HrAtPower({ acts, filter, openActivity }) {
  const withTable = acts.filter((a) => a.powerHr?.length);
  const sports = Object.entries(withTable.reduce((m, a) => ({ ...m, [a.sport]: (m[a.sport] || 0) + 1 }), {})).sort((a, b) => b[1] - a[1]);
  const [sport, setSport] = useState(null);
  const sp = sportById(filter).power ? filter : sport || sports[0]?.[0];
  const list = withTable.filter((a) => a.sport === sp).sort((a, b) => a.date.localeCompare(b.date));
  // Vorschlag: der Wattbereich, in dem am meisten trainiert wurde.
  const common = useMemo(() => {
    const m = {};
    for (const a of list) for (const [w, , s] of a.powerHr) m[w] = (m[w] || 0) + s;
    return Number(Object.entries(m).sort((a, b) => b[1] - a[1])[0]?.[0]) || 150;
  }, [list]);
  const [mode, setMode] = useState('hr');
  const [watt, setWatt] = useState('');
  const [bpm, setBpm] = useState('');
  const w = Number(watt) || common, h = Number(bpm) || 140;
  const rows = list.map((a) => ({ a, v: mode === 'hr' ? hrAtPower(a, w) : powerAtHr(a, h) })).filter((r) => r.v);
  const first = rows.slice(0, 3), last = rows.slice(-3);
  const avg = (r) => r.reduce((s, x) => s + x.v, 0) / r.length;
  const change = rows.length >= 6 ? avg(last) - avg(first) : null;
  if (!withTable.length) return <div className="card"><p className="muted">Braucht Einheiten mit Watt und Puls (Rad mit Wattmesser, SkiErg, Rudergerät). Nach dem nächsten Abgleich bzw. Import erscheinen sie hier.</p></div>;
  return (
    <div className="card">
      <div className="row">
        {!sportById(filter).power && <select value={sp} onChange={(e) => setSport(e.target.value)} style={{ flex: '1 1 140px' }}>{sports.map(([id, n]) => <option key={id} value={id}>{sportLabel(id)} ({n})</option>)}</select>}
        <div style={{ flex: '1 1 200px' }}><Seg value={mode} onChange={setMode} options={[['hr', 'Puls bei Watt'], ['power', 'Watt bei Puls']]} /></div>
      </div>
      {mode === 'hr' ? <><label>Leistung (W, ±10)</label><input inputMode="numeric" value={watt} placeholder={String(common)} onChange={(e) => setWatt(e.target.value)} /></>
        : <><label>Puls (bpm, ±3)</label><input inputMode="numeric" value={bpm} placeholder="140" onChange={(e) => setBpm(e.target.value)} /></>}
      <div className="stats">
        <div><b>{rows.length}</b><span>Einheiten mit ≥ 3 min</span></div>
        <div><b>{rows.at(-1)?.v ?? '–'}</b><span>zuletzt {mode === 'hr' ? 'bpm' : 'W'}</span></div>
        <div><b style={{ color: change == null || Math.round(change) === 0 ? undefined : (mode === 'hr' ? change < 0 : change > 0) ? 'var(--good)' : 'var(--bad)' }}>{change == null ? '–' : (change > 0 ? '+' : '') + Math.round(change)}</b><span>Veränderung (erste vs. letzte 3)</span></div>
      </div>
      {rows.length > 1 && <LineChart labels={rows.map((r) => r.a.date)} xFormat={short} series={[
        { label: mode === 'hr' ? `Puls bei ${w} W` : `Watt bei ${h} bpm`, values: rows.map((r) => r.v), color: mode === 'hr' ? 'var(--fat)' : 'var(--fit)', dots: true },
        { label: 'Trend (5 Einheiten)', values: rolling(rows.map((r) => r.v), 5), color: 'var(--ink)', dashed: true },
      ]} shared />}
      <div style={{ overflowX: 'auto' }}>
        <table className="t"><tbody>{[...rows].reverse().slice(0, 12).map((r) => <tr key={r.a.id} style={{ cursor: 'pointer' }} onClick={() => openActivity(r.a)}><td>{short(r.a.date)}</td><td>{r.a.title || sportLabel(r.a.sport)}</td><td>{r.v} {mode === 'hr' ? 'bpm' : 'W'}</td></tr>)}</tbody></table>
      </div>
      <p className="muted small">Ohne die ersten 10 Minuten (Puls noch nicht eingeschwungen), Leistung als 60-s-Schnitt. Sinkt der Puls bei gleicher Leistung (oder steigen die Watt bei gleichem Puls), wird die aerobe Basis besser. Hitze, Müdigkeit, Koffein und Krankheit verschieben den Puls – auf den Trend schauen, nicht auf einzelne Punkte.</p>
    </div>
  );
}

// Belastbarkeit aus der eigenen Historie: frei wählbarer Rückblick statt fester 4 Wochen.
function Tolerance({ activities, health, t }) {
  const [win, setWin] = useState(365);
  const tol = useMemo(() => tolerance(activities, t, win), [activities, t, win]);
  const hr = useMemo(() => healthRatios(health || [], activities, win).filter((e) => e.ratio != null).sort((a, b) => b.start.localeCompare(a.start)), [health, activities, win]);
  if (!tol) return <div className="card"><p className="muted">Noch keine Einheiten mit Belastung.</p></div>;
  const { now, weeks, status } = tol;
  const color = { good: 'var(--good)', warn: 'var(--warn)', bad: 'var(--bad)', muted: 'var(--muted)' }[status.tone];
  const high = hr.filter((e) => e.ratio > 1.3).length;
  return (
    <>
      <div className="card">
        <label>Wie viel Vergangenheit einbeziehen?</label>
        <div className="chips">{WINDOWS.map(([d, l]) => <button key={d} className={`chip${win === d ? ' on' : ''}`} onClick={() => setWin(d)}>{l}</button>)}</div>
        <div className="stats">
          <div><b>{fmtNum(now.acute)}</b><span>letzte 7 Tage</span></div>
          <div><b>{fmtNum(now.chronic)}</b><span>Ø Woche im Rückblick</span></div>
          <div><b>{fmtNum(now.capacity)}</b><span>bisher vertragen (beste 4 Wochen, Ø/Woche)</span></div>
        </div>
        <p><b style={{ color }}>{now.ratio ? fmtNum(now.ratio, 2) : '–'}</b> · <span style={{ color }}>{status.label}</span>{tol.headroom > 0 ? <span className="muted"> · bis zu deinem bisherigen Höchstblock fehlen {fmtNum(tol.headroom)} pro Woche</span> : <span className="muted"> · du liegst über deinem bisherigen Höchstblock</span>}</p>
        <LineChart labels={weeks.map((w) => w.day)} xFormat={short} shared series={[
          { label: '7-Tage-Belastung', values: weeks.map((w) => Math.round(w.acute)), color: 'var(--accent)', dots: weeks.length < 60 },
          { label: 'Ø Woche im Rückblick', values: weeks.map((w) => Math.round(w.chronic)), color: 'var(--fit)' },
          { label: 'bisher vertragen', values: weeks.map((w) => Math.round(w.capacity)), color: 'var(--load)', dashed: true },
        ]} />
        <p className="muted small">Anders als Polar (feste 28 Tage) rechnet die App mit deinem eigenen, frei wählbaren Rückblick. „Bisher vertragen“ ist der stärkste 4-Wochen-Block in diesem Zeitraum – realistische Obergrenze für die nächste Steigerung. Verhältnis 7 Tage zu deinem Schnitt: 0,8–1,3 gilt als gewohnter Bereich, über 1,5 als Sprung (Gabbett 2016). Die Grenzen sind wissenschaftlich umstritten (Impellizzeri 2020) – Orientierung, keine Verletzungsprognose. Bei Langläufern gingen große Belastungssprünge mit mehr Infekten einher (Svendsen 2016).</p>
      </div>
      <div className="card">
        <h3 style={{ marginTop: 0 }}>Deine Ausfälle und die Belastung davor</h3>
        {hr.length ? <>
          <table className="t"><thead><tr><th>Beginn</th><th>Art</th><th>Verhältnis davor</th></tr></thead>
            <tbody>{hr.map((e) => <tr key={e.id || e.start}><td>{short(e.start)}</td><td>{e.title || HEALTH_TYPES.find((h) => h[0] === e.type)?.[1] || e.type}</td><td style={{ color: e.ratio > 1.3 ? 'var(--bad)' : undefined }}>{fmtNum(e.ratio, 2)}</td></tr>)}</tbody></table>
          <p className="muted small">{high} von {hr.length} Ausfällen kamen nach einer Woche mit mehr als dem 1,3-Fachen deines Schnitts. Je mehr Einträge im Gesundheitslog, desto besser erkennst du deine persönliche Grenze.</p>
        </> : <p className="muted small">Trag Krankheiten und Verletzungen unter Mehr → Gesundheit ein – dann siehst du hier, ob sie nach Belastungssprüngen kamen.</p>}
      </div>
    </>
  );
}

// Saisonvergleich (Saison ab 1. Mai): kumulierte Stunden und Kennzahlen je Saison.
function Seasons({ activities, t }) {
  const cum = useMemo(() => seasonCumulative(activities, t), [activities, t]);
  const table = useMemo(() => seasonTable(activities), [activities]);
  if (!table.length) return <div className="card"><p className="muted">Noch keine Einheiten.</p></div>;
  return (
    <>
      <div className="card">
        <h3 style={{ marginTop: 0 }}>Stunden kumuliert je Saison</h3>
        <LineChart labels={Array.from({ length: 53 }, (_, i) => i)} xFormat={(i) => new Date(Date.UTC(2001, 4, 1 + i * 7)).toLocaleDateString('de-DE', { month: 'short' })} shared
          series={cum.map((s, i) => ({ label: s.label, values: s.values, color: SEASON_COLORS[i + SEASON_COLORS.length - cum.length], width: i === cum.length - 1 ? 2.6 : 1.4 }))} />
        <p className="muted small">Saison jeweils ab 1. Mai. So siehst du, ob du gegenüber den Vorjahren vorne oder hinten liegst.</p>
      </div>
      <div className="card" style={{ overflowX: 'auto' }}>
        <table className="t"><thead><tr><th>Saison</th><th>Std.</th><th>Einh.</th><th>Ø h/Wo</th><th>max Wo</th><th>Fitness max</th>{ZONES.map((z) => <th key={z.id} style={{ color: ZONE_COLORS[z.id] }}>{z.id}</th>)}</tr></thead>
          <tbody>{table.map((r) => <tr key={r.start}><td>{r.label}</td><td>{fmtNum(r.hours)}</td><td>{r.sessions}</td><td>{fmtNum(r.hours / Math.max(1, r.weeksActive), 1)}</td><td>{fmtNum(r.maxWeek, 1)}</td><td>{fmtNum(r.peakFitness)}</td>{ZONES.map((z) => <td key={z.id}>{fmtNum(r.zones[z.id])}</td>)}</tr>)}</tbody></table>
        <p className="muted small">Zonen in Stunden. Ø h/Woche zählt nur Wochen mit Training.</p>
      </div>
    </>
  );
}
