import React, { useMemo, useState } from 'react';
import { TrendingUp, TrendingDown, Plus, Trash2 } from 'lucide-react';
import { useData, update, uid } from '../lib/store.js';
import { today, curve as formCurve, ftpFor } from '../lib/activities.js';
import { ZONES, POWER_ZONES, CURVE_DURATIONS, addDays } from '../lib/metrics.js';
import { SPORTS, sportLabel } from '../lib/sports.js';
import { PRESETS, SPORT_FILTERS, periodRange, previousRange, inRange, totals, buckets, delta, bestCurve, estimateFtp, rampRate, rolling, intensityShare, fmtDur, KEY_DURATIONS, daysBetween } from '../lib/analysis.js';
import { KEY_TEMPLATES, keySessionRows, trend } from '../lib/keysessions.js';
import { FormChart, LineChart, StackedBars, CurveChart, ZONE_COLORS } from './charts.jsx';
import { Seg, Sheet, fmtDate, fmtNum, fmtDuration, toast } from './common.jsx';
import { LactateSection } from './lactate.jsx';
import { LongTerm } from './longterm.jsx';

const GROUP_STACKS = [
  { key: 'ski', label: 'Ski/Rollski/SkiErg', color: 'var(--z2)' }, { key: 'endurance', label: 'Ausdauer sonst', color: 'var(--fit)' },
  { key: 'strength', label: 'Kraft', color: 'var(--z4)' }, { key: 'other', label: 'Sonstiges', color: 'var(--load)' },
];
const PZ_COLORS = ['#9fd8c3', '#4fb3a0', '#7cc4e8', '#f2b630', '#e8743b', '#c73d4c', '#7a2f8f'];
const METRICS = [['hours', 'Stunden', ' h'], ['load', 'Belastung', ''], ['distanceKm', 'Distanz', ' km'], ['ascentM', 'Höhenmeter', ' m'], ['kj', 'Arbeit', ' kJ']];

function Delta({ now, prev, invert }) {
  const d = delta(now, prev);
  if (d == null) return null;
  const good = invert ? d < 0 : d > 0;
  return <span className="small" style={{ color: d === 0 ? 'var(--muted)' : good ? 'var(--good)' : 'var(--bad)' }}>{d > 0 ? '+' : ''}{d} %</span>;
}

export function Analysis({ openActivity }) {
  const data = useData();
  const { activities, settings, plan, wellness } = data;
  const t = today(settings.timezone);
  const [preset, setPreset] = useState('3m');
  const [custom, setCustom] = useState({});
  const [filter, setFilter] = useState('all');
  const [by, setBy] = useState('week');
  const [section, setSection] = useState('overview');
  const range = periodRange(preset, t, activities, custom);
  const prev = previousRange(range);
  const acts = useMemo(() => inRange(activities, range, filter), [activities, range.from, range.to, filter]);
  const prevActs = useMemo(() => inRange(activities, prev, filter), [activities, prev.from, prev.to, filter]);

  return (
    <>
      <h1>Analyse</h1>
      <div className="chips">{PRESETS.map(([k, l]) => <button key={k} className={`chip${preset === k ? ' on' : ''}`} onClick={() => setPreset(k)}>{l}</button>)}</div>
      {preset === 'custom' && <div className="grid2"><div><label>Von</label><input type="date" value={range.from} onChange={(e) => setCustom({ ...custom, from: e.target.value })} /></div><div><label>Bis</label><input type="date" value={range.to} onChange={(e) => setCustom({ ...custom, to: e.target.value })} /></div></div>}
      <div className="row" style={{ margin: '6px 0' }}>
        <select value={filter} onChange={(e) => setFilter(e.target.value)} style={{ flex: '1 1 140px' }}>
          {SPORT_FILTERS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          <optgroup label="Sportart">{SPORTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</optgroup>
        </select>
        <span className="muted small" style={{ flex: '2 1 160px' }}>{fmtDate(range.from, { day: 'numeric', month: 'short', year: '2-digit' })} – {fmtDate(range.to, { day: 'numeric', month: 'short', year: '2-digit' })} · Vergleich: Vorzeitraum gleicher Länge</span>
      </div>
      <Seg value={section} onChange={setSection} options={[['overview', 'Überblick'], ['curves', 'Bestwerte'], ['zones', 'Zonen'], ['recovery', 'Form & Erholung'], ['long', 'Langzeit'], ['keys', 'Key Sessions'], ['lactate', 'Laktat']]} />

      {section === 'overview' && <Overview acts={acts} prevActs={prevActs} range={range} by={by} setBy={setBy} />}
      {section === 'curves' && <Curves acts={acts} prevActs={prevActs} all={inRange(activities, { from: '0000', to: t }, filter)} settings={settings} filter={filter} openActivity={openActivity} activities={activities} />}
      {section === 'zones' && <Zones acts={acts} range={range} by={by} setBy={setBy} />}
      {section === 'recovery' && <Recovery activities={activities} plan={plan} wellness={wellness} range={range} t={t} acts={acts} />}
      {section === 'long' && <LongTerm activities={activities} acts={acts} range={range} filter={filter} settings={settings} health={data.health} t={t} openActivity={openActivity} />}
      {section === 'keys' && <KeySessions activities={activities} openActivity={openActivity} />}
      {section === 'lactate' && <LactateSection />}
    </>
  );
}

function Overview({ acts, prevActs, range, by, setBy }) {
  const [metric, setMetric] = useState('hours');
  const now = totals(acts), before = totals(prevActs);
  const bk = buckets(acts, range, by);
  const weeksN = Math.max(1, daysBetween(range.from, range.to) / 7);
  const unit = METRICS.find((m) => m[0] === metric)[2];
  const sports = Object.entries(now.sports).sort((a, b) => b[1].hours - a[1].hours);
  const share = intensityShare(now.zones);
  return (
    <>
      <div className="stats">
        <div><b>{fmtNum(now.hours, 1)}</b><span>Stunden <Delta now={now.hours} prev={before.hours} /></span></div>
        <div><b>{fmtNum(now.hours / weeksN, 1)}</b><span>Ø h/Woche</span></div>
        <div><b>{now.sessions}</b><span>Einheiten <Delta now={now.sessions} prev={before.sessions} /></span></div>
        <div><b>{fmtNum(now.load)}</b><span>Belastung <Delta now={now.load} prev={before.load} /></span></div>
        <div><b>{fmtNum(now.distanceKm)}</b><span>km <Delta now={now.distanceKm} prev={before.distanceKm} /></span></div>
        <div><b>{fmtNum(now.kj)}</b><span>kJ <Delta now={now.kj} prev={before.kj} /></span></div>
      </div>
      <div className="card">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <select value={metric} onChange={(e) => setMetric(e.target.value)} style={{ flex: '1 1 140px' }}>{METRICS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
          <div style={{ flex: '1 1 160px' }}><Seg value={by} onChange={setBy} options={[['week', 'Wochen'], ['month', 'Monate']]} /></div>
        </div>
        <StackedBars buckets={bk} unit={unit} stacks={metric === 'hours' ? GROUP_STACKS : [{ key: metric, label: METRICS.find((m) => m[0] === metric)[1], color: 'var(--accent)' }]}
          value={(b, k) => (metric === 'hours' ? b.groups[k] : b[k])} />
      </div>
      <div className="card">
        <h3 style={{ marginTop: 0 }}>Nach Sportart</h3>
        <table className="t"><thead><tr><th>Sportart</th><th>Einh.</th><th>Std.</th><th>km</th><th>Belastung</th><th>Anteil</th></tr></thead>
          <tbody>{sports.map(([id, s]) => <tr key={id}><td>{sportLabel(id)}</td><td>{s.sessions}</td><td>{fmtNum(s.hours, 1)}</td><td>{fmtNum(s.distanceKm)}</td><td>{fmtNum(s.load)}</td><td>{Math.round((s.hours / (now.hours || 1)) * 100)} %</td></tr>)}</tbody></table>
      </div>
      <div className="card">
        <h3 style={{ marginTop: 0 }}>{by === 'month' ? 'Monate' : 'Wochen'} im Detail</h3>
        <div style={{ overflowX: 'auto' }}>
          <table className="t"><thead><tr><th>{by === 'month' ? 'Monat' : 'Woche'}</th><th>Std.</th><th>Einh.</th><th>Belast.</th><th>km</th><th>I1–2</th><th>I3</th><th>I4–5</th></tr></thead>
            <tbody>{[...bk].reverse().map((b) => { const sh = intensityShare(b.zones); return <tr key={b.from}><td>{b.label}</td><td>{fmtNum(b.hours, 1)}</td><td>{b.sessions}</td><td>{fmtNum(b.load)}</td><td>{fmtNum(b.distanceKm)}</td><td>{sh ? Math.round(sh.low * 100) + '%' : '–'}</td><td>{sh ? Math.round(sh.mid * 100) + '%' : '–'}</td><td>{sh ? Math.round(sh.high * 100) + '%' : '–'}</td></tr>; })}</tbody></table>
        </div>
        {share && <p className="muted small">Gesamt: {Math.round(share.low * 100)} % locker · {Math.round(share.mid * 100)} % Schwelle · {Math.round(share.high * 100)} % hart (Weltklasse-Langläufer: rund 90/4/6, Walther et al. 2023).</p>}
      </div>
    </>
  );
}

function Curves({ acts, prevActs, all, settings, filter, openActivity, activities }) {
  const [kind, setKind] = useState('power');
  const key = kind === 'power' ? 'powerCurve' : 'hrCurve';
  const cur = bestCurve(acts, key), before = bestCurve(prevActs, key), ever = bestCurve(all, key);
  const unit = kind === 'power' ? 'W' : 'bpm';
  const weight = Number(settings.weightKg) || null;
  const sportForFtp = ['skierg', 'row'].includes(filter) ? filter : 'bike';
  const ftpEst = kind === 'power' ? estimateFtp(cur) : null;
  const ftpSet = ftpFor(settings, sportForFtp);
  return (
    <>
      <div style={{ marginTop: 12 }}><Seg value={kind} onChange={setKind} options={[['power', 'Leistungskurve'], ['hr', 'Pulskurve']]} /></div>
      {kind === 'power' && filter === 'all' && <p className="muted small">Tipp: Für eine saubere Leistungskurve oben nach einer Sportart filtern (Rad, SkiErg …) – Watt sind zwischen Sportarten nicht vergleichbar.</p>}
      <div className="card">
        <CurveChart durations={CURVE_DURATIONS} unit={unit} fmt={fmtDur} curves={[
          { label: 'Zeitraum', data: cur, color: 'var(--fit)' },
          { label: 'Vorzeitraum', data: before, color: 'var(--fat)', dashed: true },
          { label: 'Bestwert aller Zeiten', data: ever, color: 'var(--load)', dashed: true },
        ]} />
      </div>
      <div className="card">
        <h3 style={{ marginTop: 0 }}>Bestleistungen</h3>
        <table className="t"><thead><tr><th>Dauer</th><th>Zeitraum</th>{kind === 'power' && weight && <th>W/kg</th>}<th>Vorzeitr.</th><th>Allzeit</th></tr></thead>
          <tbody>{KEY_DURATIONS.map((d) => (
            <tr key={d}>
              <td>{fmtDur(d)}</td>
              <td>{cur[d] ? <button className="ghost" style={{ padding: 0, color: 'var(--ink)' }} onClick={() => openActivity(activities.find((a) => a.id === cur[d].id))}>{cur[d].value} {unit} <span className="muted small">{fmtDate(cur[d].date, { day: 'numeric', month: 'numeric' })}</span></button> : '–'}</td>
              {kind === 'power' && weight && <td>{cur[d] ? fmtNum(cur[d].value / weight, 2) : '–'}</td>}
              <td>{before[d]?.value ?? '–'} <Delta now={cur[d]?.value} prev={before[d]?.value} /></td>
              <td>{ever[d]?.value ?? '–'}</td>
            </tr>
          ))}</tbody></table>
        {kind === 'power' && ftpEst && <p className="muted small">Geschätzte FTP aus dem Zeitraum: <b>{ftpEst} W</b>{weight ? ` (${fmtNum(ftpEst / weight, 2)} W/kg)` : ''} · eingetragen: {ftpSet ?? '–'} W. {ftpSet && Math.abs(ftpEst - ftpSet) / ftpSet > 0.05 ? 'Abweichung über 5 % – FTP unter Einstellungen prüfen.' : ''}</p>}
      </div>
    </>
  );
}

function Zones({ acts, range, by, setBy }) {
  const { settings } = useData();
  const tot = totals(acts);
  const bk = buckets(acts, range, by);
  const hasPower = Object.values(tot.powerZones).some((v) => v > 0);
  const zsum = Object.values(tot.zones).reduce((a, b) => a + b, 0), psum = Object.values(tot.powerZones).reduce((a, b) => a + b, 0);
  // Pulsgrenzen wie in der Auswertung (Laktattest-Grenzen, sonst % der maximalen Herzfrequenz).
  const hrMax = Number(settings.hrMax) || null;
  const bounds = settings.zoneHr?.length === 4 && settings.zoneHr.every(Boolean) ? settings.zoneHr.map(Number) : ZONES.slice(1).map((z) => z.from * (hrMax || 0));
  const edges = hrMax ? [ZONES[0].from * hrMax, ...bounds, hrMax] : null;
  // I1 ist nach unten offen: nur die Obergrenze, kein Mindestpuls.
  const bpm = (i) => (edges ? (i === 0 ? `unter ${Math.round(edges[1])} bpm` : `${Math.round(edges[i])}–${Math.round(edges[i + 1])} bpm`) : '');
  // Kraft zählt als eigene Gruppe, nicht als Pulszone (ohne Pulsverlauf nicht sinnvoll einzuordnen).
  const kraftH = tot.groups.strength || 0;
  const totalH = tot.hours || 0;
  const share = (h) => (totalH ? Math.round((h / totalH) * 100) : 0);
  const withoutHr = Math.max(0, totalH - zsum - kraftH);
  return (
    <>
      <div style={{ marginTop: 12 }}><Seg value={by} onChange={setBy} options={[['week', 'Wochen'], ['month', 'Monate']]} /></div>
      <div className="card">
        <h3 style={{ marginTop: 0 }}>Intensitätsverteilung</h3>
        {totalH ? <>
          <StackedBars buckets={bk} unit=" h" stacks={[...ZONES.map((z) => ({ key: z.id, label: z.label, color: ZONE_COLORS[z.id] })), { key: 'strength', label: 'Kraft', color: 'var(--load)' }]} value={(b, k) => (k === 'strength' ? b.groups.strength : b.zones[k])} />
          <table className="t"><tbody>
            {ZONES.map((z, i) => <tr key={z.id}><td><i style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 3, background: ZONE_COLORS[z.id], marginRight: 6 }} />{z.label}{bpm(i) && <span className="muted small"> · {bpm(i)}</span>}</td><td>{share(tot.zones[z.id])} % · {fmtDuration(tot.zones[z.id] * 3600)} h</td></tr>)}
            <tr><td><i style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 3, background: 'var(--load)', marginRight: 6 }} />Kraft</td><td>{share(kraftH)} % · {fmtDuration(kraftH * 3600)} h</td></tr>
            {withoutHr > 0.05 && <tr><td className="muted">ohne Pulsdaten</td><td className="muted">{share(withoutHr)} %</td></tr>}
          </tbody></table>
          <p className="muted small">Anteil an allen Stunden im Zeitraum. Kraft ist eine eigene Gruppe, nicht Teil der Pulszonen.</p>
        </> : <p className="muted small">Noch keine Einheiten im Zeitraum.</p>}
      </div>
      <div className="card">
        <h3 style={{ marginTop: 0 }}>Pulszonen (I1–I5)</h3>
        <StackedBars buckets={bk} unit=" h" stacks={ZONES.map((z) => ({ key: z.id, label: z.label, color: ZONE_COLORS[z.id] }))} value={(b, k) => b.zones[k]} />
        <table className="t">{ZONES.map((z, i) => <tbody key={z.id}><tr><td><i style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 3, background: ZONE_COLORS[z.id], marginRight: 6 }} />{z.label}{bpm(i) && <span className="muted small"> · {bpm(i)}</span>}</td><td>{fmtDuration(tot.zones[z.id] * 3600)} h</td><td>{zsum ? Math.round((tot.zones[z.id] / zsum) * 100) : 0} %</td></tr></tbody>)}</table>
      </div>
      <div className="card">
        <h3 style={{ marginTop: 0 }}>Leistungszonen (Coggan, % FTP)</h3>
        {hasPower ? <>
          <StackedBars buckets={bk} unit=" h" stacks={POWER_ZONES.map((z, i) => ({ key: z.id, label: z.label, color: PZ_COLORS[i] }))} value={(b, k) => b.powerZones[k]} />
          <table className="t">{POWER_ZONES.map((z, i) => <tbody key={z.id}><tr><td><i style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 3, background: PZ_COLORS[i], marginRight: 6 }} />{z.label}</td><td>{fmtDuration(tot.powerZones[z.id] * 3600)} h</td><td>{psum ? Math.round((tot.powerZones[z.id] / psum) * 100) : 0} %</td></tr></tbody>)}</table>
        </> : <p className="muted small">Noch keine Einheiten mit Wattmessung und eingetragener FTP im Zeitraum.</p>}
      </div>
    </>
  );
}

function Recovery({ activities, plan, wellness, range, t, acts }) {
  const days = useMemo(() => formCurve(activities, plan, t, 0), [activities, plan, t]);
  const shown = days.filter((d) => d.day >= range.from && d.day <= range.to);
  const ramp = rampRate(days, range.to);
  const w = wellness.filter((x) => x.date >= range.from && x.date <= range.to);
  const byDay = Object.fromEntries(w.map((x) => [x.date, x]));
  const labels = shown.map((d) => d.day);
  const hrv = labels.map((d) => byDay[d]?.hrv ?? null);
  const ef = acts.filter((a) => a.ef && (a.zones ? (a.zones.I1 + a.zones.I2) / Math.max(1, Object.values(a.zones).reduce((x, y) => x + y, 0)) > 0.7 : true)).sort((a, b) => a.date.localeCompare(b.date));
  const dec = acts.filter((a) => a.decoupling != null && a.durationS >= 3600).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8);
  return (
    <>
      <div className="stats">
        <div><b>{fmtNum(shown.at(-1)?.fitness)}</b><span>Fitness am Ende</span></div>
        <div><b>{ramp == null ? '–' : (ramp > 0 ? '+' : '') + fmtNum(ramp, 1)}</b><span>Ramp Rate / Woche</span></div>
        <div><b>{fmtNum(Math.min(...shown.map((d) => d.form)))}</b><span>tiefste Form</span></div>
      </div>
      {ramp != null && ramp > 8 && <div className="notice">Fitness steigt um mehr als 8 Punkte pro Woche – das ist ein steiler Anstieg; auf Erholung und Infekte achten (große Belastungssprünge gehen bei Langläufern mit mehr Infekten einher, Svendsen et al. 2016).</div>}
      <div className="card"><h3 style={{ marginTop: 0 }}>Fitness, Ermüdung, Form</h3><FormChart days={shown} /></div>
      <HoursFitness activities={activities} labels={labels} />
      <div className="card">
        <h3 style={{ marginTop: 0 }}>HRV und Form</h3>
        {hrv.some(Boolean) ? <LineChart labels={labels} xFormat={(d) => fmtDate(d, { day: 'numeric', month: 'numeric' })} series={[
          { label: 'HRV 7-Tage-Schnitt (ms)', values: rolling(hrv, 7), color: 'var(--z2)' },
          { label: 'Form', values: shown.map((d) => d.form), color: 'var(--form)', signed: true },
        ]} /> : <p className="muted small">Noch keine HRV-Werte. Polar verbinden: Nightly Recharge liefert HRV und Ruhepuls jeder Nacht.</p>}
        {hrv.some(Boolean) && <p className="muted small">Fällt der 7-Tage-Schnitt der HRV deutlich unter deinen Normalbereich, während die Form tief ist, ist mehr Erholung sinnvoll (Plews et al. 2013).</p>}
      </div>
      {w.some((x) => x.sleepH || x.restHr) && <div className="card">
        <h3 style={{ marginTop: 0 }}>Schlaf und Ruhepuls</h3>
        <LineChart labels={w.map((x) => x.date)} xFormat={(d) => fmtDate(d, { day: 'numeric', month: 'numeric' })} series={[
          { label: 'Schlaf (h)', values: w.map((x) => x.sleepH ?? null), color: 'var(--fit)', dots: true },
          { label: 'Ruhepuls', values: w.map((x) => x.restHr ?? null), color: 'var(--fat)' },
        ]} />
      </div>}
      <div className="card">
        <h3 style={{ marginTop: 0 }}>Effizienz (EF = NP / Ø Puls) in lockeren Einheiten</h3>
        {ef.length > 1 ? <LineChart labels={ef.map((a) => a.date)} xFormat={(d) => fmtDate(d, { day: 'numeric', month: 'numeric' })} series={[{ label: 'EF', values: ef.map((a) => a.ef), color: 'var(--accent)', dots: true }]} />
          : <p className="muted small">Braucht Einheiten mit Watt und Puls. Steigt der EF bei gleicher Intensität, wird deine aerobe Basis besser.</p>}
      </div>
      {dec.length > 0 && <div className="card">
        <h3 style={{ marginTop: 0 }}>Aerobe Entkopplung (Einheiten ≥ 1 h)</h3>
        <table className="t"><tbody>{dec.map((a) => <tr key={a.id}><td>{fmtDate(a.date)}</td><td>{sportLabel(a.sport)}</td><td>{fmtDuration(a.durationS)} h</td><td style={{ color: a.decoupling > 5 ? 'var(--bad)' : 'var(--good)' }}>{fmtNum(a.decoupling, 1)} %</td></tr>)}</tbody></table>
        <p className="muted small">Unter 5 %: Puls bleibt im Verhältnis zur Leistung stabil – gute Grundlagenausdauer für diese Dauer.</p>
      </div>}
    </>
  );
}

function KeySessions({ activities, openActivity }) {
  const { keySessions } = useData();
  const [edit, setEdit] = useState(null);
  const [open, setOpen] = useState(keySessions[0]?.id);
  const ks = keySessions.find((k) => k.id === open);
  return (
    <>
      <p className="muted" style={{ marginTop: 12 }}>Lege wiederkehrende Schlüsseleinheiten fest. Alle passenden Einheiten (Sportart + Stichwort im Titel, oder in der Einheit manuell zugeordnet) werden verglichen.</p>
      <div className="chips">
        {keySessions.map((k) => <button key={k.id} className={`chip${open === k.id ? ' on' : ''}`} onClick={() => setOpen(k.id)}>{k.name}</button>)}
        <button className="chip" onClick={() => setEdit({})}><Plus size={13} /> Neu</button>
      </div>
      {!keySessions.length && <>
        <h3>Vorlagen</h3>
        {KEY_TEMPLATES.map((k) => <button key={k.name} className="item" onClick={() => { const n = { ...k, id: uid() }; update((d) => ({ ...d, keySessions: [...d.keySessions, n] })); setOpen(n.id); }}><div className="grow"><b>{k.name}</b><p>{sportLabel(k.sport)} · {k.description}</p></div><Plus size={18} /></button>)}
      </>}
      {ks && <KeyDetail ks={ks} activities={activities} openActivity={openActivity} onEdit={() => setEdit(ks)} />}
      {edit && <KeyEditor ks={edit} onClose={() => setEdit(null)} onSaved={setOpen} />}
    </>
  );
}

function KeyDetail({ ks, activities, openActivity, onEdit }) {
  const rows = keySessionRows(activities, ks);
  const part = ks.laps ? `Runden ${ks.laps}` : `beste ${fmtDur(ks.intervalSec || 300)}`;
  const hasPower = rows.some((r) => r.intervalPower), hasLac = rows.some((r) => r.lactateAvg);
  const T = ({ k, lower, label }) => {
    const v = trend(rows, k, lower);
    if (!v) return null;
    return <div><b style={{ color: v.pct === 0 ? 'var(--muted)' : v.better ? 'var(--good)' : 'var(--bad)' }}>{v.pct >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />} {v.pct > 0 ? '+' : ''}{fmtNum(v.pct, 1)} %</b><span>{label} {v.pct !== 0 && (v.better ? '· besser' : '· schlechter')}</span></div>;
  };
  return (
    <div className="card">
      <div className="row" style={{ justifyContent: 'space-between' }}><h3 style={{ margin: 0, flex: 'none' }}>{ks.name}</h3><button className="ghost" style={{ flex: 'none' }} onClick={onEdit}>Bearbeiten</button></div>
      <p className="muted small">{ks.sport ? sportLabel(ks.sport) : 'alle Sportarten'} · Stichwörter: {ks.keywords || '–'} · Auswertung: {part}{ks.description ? ` · ${ks.description}` : ''}</p>
      {!rows.length ? <p className="muted">Noch keine passenden Einheiten. Gib deinen Einheiten einen Titel mit einem der Stichwörter oder ordne sie in der Einheit zu.</p> : <>
        <div className="stats">
          <div><b>{rows.length}</b><span>Einheiten</span></div>
          {hasPower ? <T k="intervalPower" label={`Leistung ${part}`} /> : <T k="intervalHr" lower label="Puls" />}
          {hasPower ? <T k="intervalRatio" label="Watt pro Puls" /> : hasLac ? <T k="lactateAvg" lower label="Laktat" /> : <T k="rpe" lower label="RPE" />}
        </div>
        <LineChart labels={rows.map((r) => r.date)} xFormat={(d) => fmtDate(d, { day: 'numeric', month: 'numeric' })} series={[
          ...(hasPower ? [{ label: `${part} (W)`, values: rows.map((r) => r.intervalPower), color: 'var(--fit)', dots: true }] : []),
          { label: `Puls ${part}`, values: rows.map((r) => r.intervalHr ?? r.avgHr), color: 'var(--fat)', dots: true },
        ]} />
        {hasLac && <LineChart labels={rows.map((r) => r.date)} xFormat={(d) => fmtDate(d, { day: 'numeric', month: 'numeric' })} series={[{ label: 'Laktat Ø (mmol/l)', values: rows.map((r) => r.lactateAvg), color: 'var(--z3)', dots: true }]} />}
        <div style={{ overflowX: 'auto' }}>
          <table className="t"><thead><tr><th>Datum</th><th>Min</th>{hasPower && <th>W</th>}<th>Puls</th>{hasPower && <th>W/Puls</th>}<th>Laktat</th><th>RPE</th><th>Entk.</th></tr></thead>
            <tbody>{[...rows].reverse().map((r) => <tr key={r.id} onClick={() => openActivity(activities.find((a) => a.id === r.id))} style={{ cursor: 'pointer' }}>
              <td>{fmtDate(r.date, { day: '2-digit', month: '2-digit', year: '2-digit' })}</td><td>{r.minutes}</td>{hasPower && <td>{r.intervalPower ?? '–'}</td>}<td>{r.intervalHr ?? r.avgHr ?? '–'}</td>{hasPower && <td>{fmtNum(r.intervalRatio, 2)}</td>}<td>{r.lactateAvg ? fmtNum(r.lactateAvg, 1) : '–'}</td><td>{r.rpe ?? '–'}</td><td>{r.decoupling != null ? fmtNum(r.decoupling, 1) + ' %' : '–'}</td>
            </tr>)}</tbody></table>
        </div>
        <p className="muted small">Fortschritt heißt: mehr Watt bei gleichem Puls/Laktat, oder gleiche Watt bei niedrigerem Puls/Laktat und RPE. „Beste {fmtDur(ks.intervalSec || 300)}“ ist der beste Abschnitt dieser Länge in der Einheit – stell die Vergleichsdauer auf deine Intervalllänge.</p>
      </>}
    </div>
  );
}

function KeyEditor({ ks, onClose, onSaved }) {
  const [k, setK] = useState({ name: '', sport: '', keywords: '', intervalSec: 360, description: '', ...ks });
  const save = () => {
    if (!k.name.trim()) return toast('Name fehlt');
    const n = { ...k, id: k.id || uid(), intervalSec: Number(k.intervalSec) || 300 };
    update((d) => ({ ...d, keySessions: [...d.keySessions.filter((x) => x.id !== n.id), n] }));
    onSaved(n.id); onClose();
  };
  const remove = () => { update((d) => ({ ...d, keySessions: d.keySessions.filter((x) => x.id !== k.id) })); onClose(); };
  return (
    <Sheet title={k.id ? 'Key Session bearbeiten' : 'Neue Key Session'} onClose={onClose}>
      <label>Name</label><input value={k.name} onChange={(e) => setK({ ...k, name: e.target.value })} placeholder="z. B. Double Threshold AM 5×6 min" />
      <div className="grid2">
        <div><label>Sportart</label><select value={k.sport} onChange={(e) => setK({ ...k, sport: e.target.value })}><option value="">alle</option>{SPORTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select></div>
        <div><label>Vergleichsdauer (Sek.)</label><input type="number" value={k.intervalSec} onChange={(e) => setK({ ...k, intervalSec: e.target.value })} /></div>
      </div>
      <label>Nur diese Runden auswerten (optional)</label><input value={k.laps || ''} onChange={(e) => setK({ ...k, laps: e.target.value })} placeholder="z. B. 2-4 für die 3×20 min ohne Ein- und Auslaufen" />
      <p className="muted small">Mit Runden: Ø Watt und Ø Puls nur über diese Runden (z. B. Concept2-Intervalle). Ohne: bester Abschnitt der Vergleichsdauer.</p>
      <label>Stichwörter im Titel (mit Komma getrennt)</label><input value={k.keywords} onChange={(e) => setK({ ...k, keywords: e.target.value })} placeholder="5x6, schwelle" />
      <label>Beschreibung</label><textarea value={k.description} onChange={(e) => setK({ ...k, description: e.target.value })} />
      <div className="row" style={{ marginTop: 12 }}>
        <button className="primary" onClick={save}>Speichern</button>
        {k.id && <button className="danger" onClick={remove}><Trash2 size={17} />Löschen</button>}
      </div>
    </Sheet>
  );
}

// Umfang als eigene „Fitness“: Stunden der letzten 7 Tage und Wochenschnitt über 42 Tage (wie CTL, nur in Stunden).
// Belastungsmodelle gewichten lockeren Umfang unterschiedlich – die Stunden zeigen ihn ungewichtet.
function HoursFitness({ activities, labels }) {
  const data = useMemo(() => {
    const perDay = {};
    for (const a of activities) if (a.sport !== 'strength') perDay[a.date] = (perDay[a.date] || 0) + (a.durationS || 0) / 3600;
    const lowPerDay = {};
    for (const a of activities) if (a.zones) lowPerDay[a.date] = (lowPerDay[a.date] || 0) + ((a.zones.I1 || 0) + (a.zones.I2 || 0)) / 3600;
    const sumBack = (map, d, n) => { let s = 0; for (let i = 0; i < n; i++) s += map[addDays(d, -i)] || 0; return s; };
    return labels.map((d) => ({ d, week: sumBack(perDay, d, 7), avg: (sumBack(perDay, d, 42) / 42) * 7, low: (sumBack(lowPerDay, d, 42) / 42) * 7 }));
  }, [activities, labels]);
  if (!data.length || !data.some((x) => x.week > 0)) return null;
  const last = data.at(-1);
  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>Umfang: Stunden pro Woche</h3>
      <div className="stats">
        <div><b>{fmtNum(last.week, 1)}</b><span>letzte 7 Tage</span></div>
        <div><b>{fmtNum(last.avg, 1)}</b><span>Ø Woche (42 Tage)</span></div>
        <div><b>{fmtNum(last.low, 1)}</b><span>davon I1–I2 (Ø/Woche)</span></div>
      </div>
      <LineChart labels={data.map((x) => x.d)} xFormat={(d) => fmtDate(d, { day: 'numeric', month: 'numeric' })} shared series={[
        { label: 'Stunden letzte 7 Tage', values: data.map((x) => x.week), color: 'var(--accent)' },
        { label: 'Ø Woche (42 Tage)', values: data.map((x) => x.avg), color: 'var(--fit)', width: 2.4 },
        { label: 'davon locker I1–I2', values: data.map((x) => x.low), color: 'var(--z2)', dashed: true },
      ]} />
      <p className="muted small">Die Fitness-Kurve oben gewichtet nach Intensität. Hier zählt jede Stunde gleich – die aerobe Basis wächst vor allem über den lockeren Umfang. Wer ihn stärker in Fitness und Form sehen will: unter Einstellungen das Belastungsmodell „Umfangsbetont“ wählen.</p>
    </div>
  );
}
