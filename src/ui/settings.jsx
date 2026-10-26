import React, { useEffect, useState } from 'react';
import { Link2, Unlink, Download, Upload, RefreshCw } from 'lucide-react';
import { useData, update, getData } from '../lib/store.js';
import { recomputeAll } from '../lib/recompute.js';
import { PROVIDERS, startConnect, disconnect, importFiles, testConnection } from '../lib/sync.js';
import { getAccessCode, setAccessCode, getOwnKey, setOwnKey } from '../lib/ai.js';
import { fmtDate, toast } from './common.jsx';

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
  const upload = async (e) => { const r = await importFiles([...e.target.files]); toast(`${r.added} importiert, ${r.dup} schon vorhanden, ${r.failed} fehlerhaft`); };

  return (
    <>
      <h1>Einstellungen</h1>
      <div className="card">
        <h3 style={{ marginTop: 0 }}>Athlet</h3>
        <div className="grid2">
          {FIELDS.map(([k, l, ph]) => <div key={k}><label>{l}</label><input inputMode="decimal" value={s[k] ?? ''} placeholder={ph} onChange={(e) => setS({ ...s, [k]: e.target.value })} /></div>)}
          <div><label>Geschlecht (TRIMP)</label><select value={s.sex || 'm'} onChange={(e) => setS({ ...s, sex: e.target.value })}><option value="m">männlich</option><option value="f">weiblich</option></select></div>
          <div><label>Zeitzone</label><input value={s.timezone || 'Europe/Berlin'} onChange={(e) => setS({ ...s, timezone: e.target.value })} /></div>
        </div>
        <label>Ziele und Wettkämpfe</label>
        <textarea value={s.goals || ''} onChange={(e) => setS({ ...s, goals: e.target.value })} placeholder="z. B. Hauptziel Engadin Skimarathon März, Volkslauf-Serie im Januar" />
        <label>Verfügbarkeit</label>
        <input value={s.availability || ''} onChange={(e) => setS({ ...s, availability: e.target.value })} placeholder="z. B. Mo–Fr morgens 1 h + abends 1,5 h, Wochenende lang" />
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
              {c && <button className="ghost" style={{ flex: 'none' }} onClick={() => runTest(id)}>Testen</button>}
              {c ? <button className="secondary" style={{ flex: 'none' }} onClick={() => disconnect(id)}><Unlink size={16} />Trennen</button>
                : <button className="primary" style={{ flex: 'none' }} disabled={!ready} onClick={() => startConnect(id)}><Link2 size={16} />Verbinden</button>}
            </div>
          );
        })}
        {test && <div className="notice" style={{ fontFamily: 'ui-monospace,Menlo,monospace', fontSize: 12, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{test.busy ? 'Teste …' : test.lines.join('\n')}</div>}
        <label className="secondary wide" style={{ cursor: 'pointer', marginTop: 10 }}><Upload size={17} />FIT-Dateien importieren<input type="file" accept=".fit" multiple hidden onChange={upload} /></label>
        <p className="muted small">Polar liefert über die Schnittstelle nur die letzten 30 Tage. Ältere Daten: Polar Flow → Einstellungen → „Daten herunterladen“ und die FIT-Dateien hier importieren. ErgData lädt Einheiten automatisch ins Concept2 Logbook, von dort holt sie die App.</p>
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
        <p className="muted small">{activities.length} Einheiten auf diesem Gerät. Alles liegt lokal im Browser – regelmäßig ein Backup machen.</p>
        <div className="row">
          <button className="secondary" onClick={exportData}><Download size={17} />Backup</button>
          <label className="secondary" style={{ cursor: 'pointer' }}><RefreshCw size={17} />Einspielen<input type="file" accept=".json" hidden onChange={importData} /></label>
        </div>
      </div>
      <p className="muted small" style={{ textAlign: 'center' }}>Version {__APP_VERSION__}</p>
    </>
  );
}
