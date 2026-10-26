// Tägliches Backup aus Supabase in einen Ordner (der GitHub-Workflow legt ihn im Branch „backup“ ab).
// Aufruf: SUPABASE_URL=… SUPABASE_SECRET_KEY=… node scripts/backup.mjs <ordner>
// Pro Konto entsteht <ordner>/<konto-id>/:
//   app-backup.json   kompletter App-Stand → in der App unter Einstellungen → Daten → Einspielen
//   records/*.json    alle Datensätze je Sammlung (auch gelöschte, mit Zeitstempel)
//   series/<id>.json  Puls-/Leistungsverläufe je Einheit (nur neue/geänderte werden geholt)
// Verbindungsschlüssel (Polar, Concept2, Wahoo) werden bewusst nicht gesichert.
import fs from 'node:fs';
import path from 'node:path';
import { applyRows } from '../src/lib/cloud.js';

const dir = process.argv[2];
const url = (process.env.SUPABASE_URL || '').replace(/\/$/, '').replace(/\/rest\/v1$/, '');
const key = process.env.SUPABASE_SECRET_KEY || '';
if (!dir || !url || !key) {
  console.error('Aufruf: SUPABASE_URL=… SUPABASE_SECRET_KEY=… node scripts/backup.mjs <ordner>');
  process.exit(1);
}

// Neue Schlüssel (sb_secret_…) gehören nur in den apikey-Header, alte (JWT) zusätzlich als Bearer.
const headers = { apikey: key, ...(key.startsWith('eyJ') ? { Authorization: `Bearer ${key}` } : {}) };

async function rest(query) {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(`${url}/rest/v1/${query}`, { headers });
    if (res.ok) return res.json();
    const text = await res.text();
    if (attempt >= 3 || res.status < 500) throw new Error(`Supabase ${res.status}: ${text.slice(0, 300)}`);
    await new Promise((r) => setTimeout(r, 2000 * attempt));
  }
}
async function all(table, select, order, extra = '', page = 1000) {
  const out = [];
  for (let offset = 0; ; offset += page) {
    const rows = await rest(`${table}?select=${select}&order=${order}&limit=${page}&offset=${offset}${extra}`);
    out.push(...rows);
    if (rows.length < page) return out;
  }
}
const write = (file, value) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 1) + '\n');
};

const metaFile = path.join(dir, 'meta.json');
const meta = fs.existsSync(metaFile) ? JSON.parse(fs.readFileSync(metaFile, 'utf8')) : {};

// 1) Alle Datensätze (klein, jedes Mal komplett).
const records = await all('training_records', 'owner,collection,id,data,deleted,updated_at', 'owner,collection,id');
const owners = {};
for (const r of records) {
  if (r.collection === 'singleton' && r.id === 'connections') continue;
  ((owners[r.owner] ||= {})[r.collection] ||= []).push({ id: r.id, deleted: r.deleted, updated_at: r.updated_at, data: r.data });
}
for (const [owner, cols] of Object.entries(owners)) {
  const base = path.join(dir, owner);
  fs.rmSync(path.join(base, 'records'), { recursive: true, force: true });
  for (const [c, rows] of Object.entries(cols)) write(path.join(base, 'records', `${c}.json`), rows);
  const live = Object.entries(cols).flatMap(([collection, rows]) => rows.filter((r) => !r.deleted).map((r) => ({ collection, id: r.id, data: r.data, deleted: false })));
  const state = applyRows({ settings: {}, food: null }, live);
  write(path.join(base, 'app-backup.json'), state);
}

// 2) Verläufe: nur neue oder geänderte seit dem letzten Lauf.
const since = meta.seriesUpdatedAt;
const series = await all('training_series', 'owner,activity_id,data,updated_at', 'updated_at', since ? `&updated_at=gt.${encodeURIComponent(since)}` : '', 200);
for (const s of series) write(path.join(dir, s.owner, 'series', `${s.activity_id.replace(/[^\w.-]/g, '_')}.json`), s.data);
const newest = series.map((s) => s.updated_at).sort().at(-1);

write(metaFile, { lastRun: new Date().toISOString(), seriesUpdatedAt: newest || since || null, accounts: Object.keys(owners).length, records: records.length });
console.log(`Backup: ${records.length} Datensätze, ${series.length} neue/geänderte Verläufe, ${Object.keys(owners).length} Konto/Konten.`);
