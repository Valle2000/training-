import React, { useEffect, useState } from 'react';
import { Link2, Unlink, Download, Upload, RefreshCw, History } from 'lucide-react';
import { useData, update, getData } from '../lib/store.js';
import { recomputeAll } from '../lib/recompute.js';
import { PROVIDERS, startConnect, disconnect, importFiles, testConnection, syncHistory, reloadConcept2, deleteActivities, mapPolarSport } from '../lib/sync.js';
import { getAccessCode, setAccessCode, getOwnKey, setOwnKey } from '../lib/ai.js';
import { fmtDate, toast } from './common.jsx';
import { SPORTS } from '../lib/sports.js';
import { AccountCard } from './account.jsx';
import { ThresholdCard } from './week.jsx';

// iPad meldet sich als Mac, hat aber einen Touchscreen; Safari auf iOS kann keine Ordner auswählen.
const IOS = typeof navigator !== 'undefined' && (/iPad|iPhone|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1));

const FIELDS = [
  ['hrMax', 'Maximalpuls', 'z. B. 196'], ['hrRest', 'Ruhepuls', 'z. B. 42'], ['lthr', 'Laktatschwellen-Puls', 'z. B. 172'],
  ['ftp', 'FTP Rad (W)', 'z. B. 300'], ['ftpSkierg', 'FTP SkiErg (W)', 'optional'], ['ftpRow', 'FTP Rudern (W)', 'optional'],
  ['weightKg', 'Gewicht (kg)', 'für W/kg und Ernährung'], ['age', 'Alter', ''],
];

export function Settings() {
  const { settings, connections, activities } = useData();
  const [s, setS] = useState(settings);
  const [configured, setConfigured] = useState(null);
  const [code, setCode] = useState(getAccessCode());
  const [key, setKey] = useState(getOwnKey());
  const [test, setTest] = useState(null);
  const maxSeen = Math.max(0, ...activities.map((a) => a.maxHr || 0));
  const runTest = async (id) => { setTest({ id, busy: true }); setTest({ id, lines: await testConnection(id) }); };
  useEffect(() => { fetch('/api/connect?provider=polar&op=status').then((r) => r.json()).then((j) => setConfigured(j.configured || [])).catch(() => setConfigured([])); }, []);

  const save = async () => {
    update((d) => ({ ...d, settings: { ...d.settings, ...s } }));
    // Alle Einheiten mit den neuen Schwellen neu berechnen.
    toast(`Gespeichert · ${await recomputeAll()} Einheiten neu berechnet`);
  };

  const exportData = () => {
    const blob = new Blob([JSON.stringify(getData(), null, 1)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `training-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
  };
  const importData = async (e) => {
    const file = e.target.files[0];
    if (!file || !confirm('Backup einspielen? Die aktuellen Daten auf diesem Gerät werden ersetzt (Puls-/Leistungsverläufe bleiben).')) return;
    const json = JSON.parse(await file.text());
    update(() => ({ ...getData(), ...json }));
    toast('Backup eingespielt');
  };
  const [progress, setProgress] = useState('');
  const [result, setResult] = useState(null);
  const upload = async (e) => {
    const files = [...e.target.files];
    e.target.value = '';
    setResult(null);
    setProgress('Lese Dateien …');
    try { setResult(await importFiles(files, setProgress)); } catch (err) { setResult({ added: 0, dup: 0, failed: 1, errors: [err.message] }); }
    setProgress('');
  };
  const history = async (id) => {
    setProgress(`${PROVIDERS[id].label}: lade Historie …`);
    try { toast(`${PROVIDERS[id].label}: ${await syncHistory(id, setProgress)} Einheiten importiert`); } catch (err) { toast(err.message); }
    setProgress('');
  };

  return (
    <>
      <AccountCard />
      <ThresholdCard onApplied={(items) => setS((prev) => ({ ...prev, ...Object.fromEntries(items.map((x) => [x.key, String(x.value)])) }))} />
      <div className="card">
        <h3 style={{ marginTop: 0 }}>Athlet</h3>
        <div className="grid2">
          {FIELDS.map(([k, l, ph]) => <div key={k}><label>{l}</label><input inputMode="decimal" value={s[k] ?? ''} placeholder={ph} onChange={(e) => setS({ ...s, [k]: e.target.value })} /></div>)}
          <div><label>Geschlecht (TRIMP)</label><select value={s.sex || 'm'} onChange={(e) => setS({ ...s, sex: e.target.value })}><option value="m">männlich</option><option value="f">weiblich</option></select></div>
          <div><label>Belastungsmodell</label><select value={s.loadModel || 'standard'} onChange={(e) => setS({ ...s, loadModel: e.target.value })}><option value="standard">Standard (Watt-TSS / Puls-TRIMP)</option><option value="lucia">Umfangsbetont (Zonen, Lucia)</option></select></div>
          <div><label>Zeitzone</label><input value={s.timezone || 'Europe/Berlin'} onChange={(e) => setS({ ...s, timezone: e.target.value })} /></div>
        </div>
        {!s.hrMax && maxSeen > 150 && <p className="small">Höchster Puls in deinen Einheiten: <b>{maxSeen}</b> <button className="ghost" style={{ display: 'inline', padding: 0 }} onClick={() => setS({ ...s, hrMax: String(maxSeen) })}>als Maximalpuls übernehmen</button> <span className="muted">(ein echter Test oder Wettkampf ist genauer)</span></p>}
        <label>Ziele und Wettkämpfe</label>
        <textarea value={s.goals || ''} onChange={(e) => setS({ ...s, goals: e.target.value })} placeholder="z. B. Hauptziel Engadin Skimarathon März, Volkslauf-Serie im Januar" />
        <label>Verfügbarkeit</label>
        <input value={s.availability || ''} onChange={(e) => setS({ ...s, availability: e.target.value })} placeholder="z. B. Mo–Fr morgens 1 h + abends 1,5 h, Wochenende lang" />
        {s.loadModel === 'lucia' && <p className="muted small">Umfangsbetont: Minuten in I1–I2 zählen ×1, I3 ×2, I4–I5 ×3 (Lucia-TRIMP), 1 h an der Schwelle = 100. Lockerer Umfang wiegt damit mehr als bei TSS oder Strava. Gilt für alle Einheiten mit Pulsverlauf; Fitness und Form ändern sich entsprechend.</p>}
        <p className="muted small">Zonen nach Olympiatoppen (% Maximalpuls): I1 55–72, I2 72–82, I3 82–87, I4 87–92, I5 &gt; 92. Den Maximalpuls am besten aus einem Test oder Wettkampf nehmen.</p>
        <button className="primary wide" onClick={save}>Speichern und neu berechnen</button>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Verbindungen</h3>
        {Object.entries(PROVIDERS).map(([id, p]) => {
          const c = connections[id];
          const ready = configured?.includes(id);
          return (
            <div key={id} className="item">
              <div className="grow"><b>{p.label}</b><p>{p.hint}</p>{c && <p>Verbunden seit {fmtDate(c.connectedAt.slice(0, 10))}</p>}{configured && !ready && !c && <p>Auf dem Server nicht eingerichtet (siehe README).</p>}</div>
              {c && id !== 'polar' && <button className="ghost" style={{ flex: 'none' }} onClick={() => history(id)} disabled={!!progress}><History size={15} />Ganze Historie</button>}
              {c && id === 'concept2' && <button className="ghost" style={{ flex: 'none' }} disabled={!!progress} onClick={async () => { if (!confirm('Alle Concept2-Einheiten neu laden? Notizen, RPE und Laktat bleiben erhalten.')) return; setProgress('Concept2: lade neu …'); try { toast(`Concept2: ${await reloadConcept2(setProgress)} Einheiten neu geladen`); } catch (err) { toast(err.message); } setProgress(''); }}><RefreshCw size={15} />Neu laden</button>}
              {c && <button className="ghost" style={{ flex: 'none' }} onClick={() => runTest(id)}>Testen</button>}
              {c ? <button className="secondary" style={{ flex: 'none' }} onClick={() => disconnect(id)}><Unlink size={16} />Trennen</button>
                : <button className="primary" style={{ flex: 'none' }} disabled={!ready} onClick={() => startConnect(id)}><Link2 size={16} />Verbinden</button>}
            </div>
          );
        })}
        {test && <div className="notice" style={{ fontFamily: 'ui-monospace,Menlo,monospace', fontSize: 12, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{test.busy ? 'Teste …' : test.lines.join('\n')}</div>}
        {progress && <div className="notice">{progress}</div>}
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Vergangene Einheiten importieren</h3>
        <label className="primary wide" style={{ cursor: 'pointer' }}><Upload size={17} />Dateien wählen (FIT, TCX, GPX, CSV, JSON, ZIP, GZ)<input type="file" accept=".fit,.tcx,.gpx,.csv,.json,.zip,.gz" multiple hidden onChange={upload} disabled={!!progress} /></label>
        {IOS ? <p className="small muted">iPad/iPhone: Ordner lassen sich hier nicht direkt wählen. In der Dateien-App den Ordner lange drücken → „Komprimieren“ und die ZIP oben auswählen (den Polar-Export kannst du auch direkt als ZIP nehmen, ohne ihn zu entpacken). Während des Imports die App im Vordergrund lassen.</p>
          : <label className="secondary wide" style={{ cursor: 'pointer', marginTop: 8 }}><Upload size={17} />Ganzen Ordner wählen<input type="file" webkitdirectory="" directory="" multiple hidden onChange={upload} disabled={!!progress} /></label>}
        {progress && <div className="notice">{progress}<br /><span className="small">App geöffnet lassen – große Exporte dauern einige Minuten.</span></div>}
        {result && <div className="notice"><b>{result.added} importiert</b>{result.refreshed > 0 && ` · ${result.refreshed} ergänzt`}{result.planned > 0 && ` · ${result.planned} geplante in den Kalender`} · {result.dup} schon vorhanden · {result.failed} nicht lesbar{result.errors?.length > 0 && <div className="small" style={{ marginTop: 4, wordBreak: 'break-word' }}>{result.errors.join(' · ')}</div>}{result.filled?.length > 0 && <div className="small" style={{ marginTop: 4 }}>Aus deinem Polar-Profil übernommen: {result.filled.map((k) => ({ hrMax: 'Maximalpuls', hrRest: 'Ruhepuls', lthr: 'Schwellenpuls', ftp: 'FTP', weightKg: 'Gewicht', sex: 'Geschlecht' }[k])).join(', ')} – bitte oben prüfen.</div>}{result.added > 0 && <div className="small" style={{ marginTop: 4 }}>Die Verläufe werden im Hintergrund nach Supabase hochgeladen (wenn angemeldet).</div>}</div>}
        <PolarSports activities={activities} />
        <ul className="small muted" style={{ paddingLeft: 18, lineHeight: 1.55 }}>
          <li><b>Polar:</b> Die Schnittstelle liefert nur Einheiten ab der Verbindung. Ältere Einheiten in Polar Flow (Web) im Tagebuch öffnen → Exportieren (TCX, CSV oder FIT, mehrere auch als ZIP). Den Komplett-Export deines Kontos (account.polar.com, JSON im ZIP) kann die App auch lesen – das Format ist nicht offiziell beschrieben, schick mir eine Rückmeldung, falls Einheiten fehlen.</li>
          <li><b>Concept2 / ErgData:</b> Nach dem Verbinden oben „Ganze Historie“ antippen.</li>
          <li><b>Wahoo:</b> ebenfalls „Ganze Historie“.</li>
          <li><b>Strava / Garmin:</b> Den Konto-Export (ZIP) direkt auswählen. Doppelte Einheiten werden übersprungen; hat die Strava-Datei Watt und die vorhandene Einheit nicht (z. B. Polar-Uhr + Wahoo), werden die Watt übernommen. Namen und Sportarten kommen aus der activities.csv.</li>
          <li>Doppelte Einheiten (gleiche Startzeit und Dauer) werden automatisch übersprungen.</li>
        </ul>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>KI-Zugang</h3>
        <label>Zugangscode (falls auf dem Server gesetzt)</label>
        <input value={code} onChange={(e) => setCode(e.target.value)} onBlur={() => setAccessCode(code)} />
        <label>Eigener Anthropic-API-Schlüssel (optional)</label>
        <input type="password" value={key} onChange={(e) => setKey(e.target.value)} onBlur={() => setOwnKey(key)} placeholder="sk-ant-…" />
        <p className="muted small">Der Schlüssel bleibt nur in diesem Browser und wird pro Anfrage an die Server-Funktion mitgeschickt, aber nicht gespeichert.</p>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Daten</h3>
        <p className="muted small">{activities.length} Einheiten auf diesem Gerät. Ohne Anmeldung liegt alles nur in diesem Browser – dann regelmäßig ein Backup machen.</p>
        <DeleteBySource activities={activities} />
        {Object.keys(settings.titleRules || {}).length > 0 && <details style={{ margin: '0 0 12px' }}>
          <summary className="small" style={{ cursor: 'pointer' }}>Umbenennen-Regeln ({Object.keys(settings.titleRules).length})</summary>
          {Object.entries(settings.titleRules).map(([from, to]) => <div key={from} className="item"><div className="grow"><p>„{from}“ → <b>{to}</b></p></div><button className="ghost" style={{ flex: 'none' }} onClick={() => update((d) => { const r = { ...d.settings.titleRules }; delete r[from]; return { ...d, settings: { ...d.settings, titleRules: r } }; })}>Entfernen</button></div>)}
          <p className="muted small">Neue Regeln entstehen, wenn du eine Einheit umbenennst und „alle umbenennen“ bestätigst.</p>
        </details>}
        <div className="row">
          <button className="secondary" onClick={exportData}><Download size={17} />Backup</button>
          <label className="secondary" style={{ cursor: 'pointer' }}><RefreshCw size={17} />Einspielen<input type="file" accept=".json" hidden onChange={importData} /></label>
        </div>
      </div>
      <p className="muted small" style={{ textAlign: 'center' }}>Version {__APP_VERSION__} · Stand {__BUILD__}</p>
    </>
  );
}

// Einheiten nach Herkunft löschen (z. B. einen fehlerhaften Import, um ihn sauber neu einzuspielen).
const ORIGINS = {
  'upload:polar': 'Polar-Export (Datei)', 'upload:polar-plan': 'Polar-Export ohne Aufzeichnung (geplant oder von Hand)', 'upload:fit': 'FIT-Dateien', 'upload:tcx': 'TCX-Dateien', 'upload:gpx': 'GPX-Dateien',
  'upload:': 'Datei-Importe (ältere, z. B. Polar-Export)', concept2: 'Concept2', polar: 'Polar (Schnittstelle)', wahoo: 'Wahoo', manual: 'Von Hand eingetragen',
};
function DeleteBySource({ activities }) {
  const [busy, setBusy] = useState(false);
  const groups = {};
  for (const a of activities) {
    const k = a.source === 'upload' ? `upload:${a.importFormat || ''}` : a.source;
    (groups[k] ||= []).push(a);
  }
  const remove = async (k, list) => {
    const label = ORIGINS[k] || k;
    if (!confirm(`${list.length} Einheiten aus „${label}“ löschen? Das gilt auch für Supabase und andere Geräte. Notizen, RPE und Laktat dieser Einheiten gehen verloren.`)) return;
    setBusy(true);
    try { toast(`${await deleteActivities(list.map((a) => a.id))} Einheiten gelöscht`); } catch (e) { toast(e.message); }
    setBusy(false);
  };
  const entries = Object.entries(groups).sort((a, b) => b[1].length - a[1].length);
  if (!entries.length) return null;
  return (
    <details style={{ margin: '8px 0 12px' }}>
      <summary className="small" style={{ cursor: 'pointer' }}>Einheiten nach Herkunft löschen</summary>
      {entries.map(([k, list]) => {
        const dates = list.map((a) => a.date).sort();
        return (
          <div key={k} className="item">
            <div className="grow"><b>{ORIGINS[k] || k}</b><p>{list.length} Einheiten · {fmtDate(dates[0], { month: 'short', year: 'numeric' })} – {fmtDate(dates.at(-1), { month: 'short', year: 'numeric' })}</p></div>
            <button className="danger" style={{ flex: 'none' }} disabled={busy} onClick={() => remove(k, list)}>Löschen</button>
          </div>
        );
      })}
      <p className="muted small">Tipp: Vorher ein Backup machen. Danach den Export einfach neu importieren.</p>
    </details>
  );
}

// Polar-Sportnummern, die die App nicht kennt („Sonstiges“): selbst zuordnen, gilt auch für spätere Importe.
function PolarSports({ activities }) {
  const [busy, setBusy] = useState(false);
  const unknown = {};
  for (const a of activities) if (a.polarSportId != null && a.sport === 'other') (unknown[a.polarSportId] ||= []).push(a);
  const list = Object.entries(unknown);
  if (!list.length) return null;
  const set = async (id, sport) => { setBusy(true); await mapPolarSport(id, sport); setBusy(false); toast('Sportart zugeordnet'); };
  return (
    <div className="notice">
      <b>Unbekannte Polar-Sportarten</b>
      <p className="small">Diese Einheiten stehen als „Sonstiges“ da. Wähle die richtige Sportart – das gilt für alle Einheiten mit dieser Nummer und für spätere Importe.</p>
      {list.map(([id, acts]) => (
        <div key={id} className="row" style={{ alignItems: 'center', marginTop: 6 }}>
          <span className="small" style={{ flex: '2 1 160px' }}>Nr. {id} · {acts.length} Einheiten{acts.find((a) => a.title) ? ` (z. B. „${acts.find((a) => a.title).title}“)` : ''}</span>
          <select style={{ flex: '1 1 140px' }} value="" disabled={busy} onChange={(e) => e.target.value && set(id, e.target.value)}>
            <option value="">Sportart wählen …</option>
            {SPORTS.filter((s) => s.id !== 'other').map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </div>
      ))}
    </div>
  );
}
