// Backup zurück nach Supabase spielen (z. B. nach einem verlorenen Projekt).
// Aufruf: SUPABASE_URL=… SUPABASE_SECRET_KEY=… node scripts/restore.mjs <backup-ordner>/<konto-id>
// Vorhandene Datensätze werden überschrieben; alle Geräte holen sich den Stand beim nächsten Abgleich.
// Das Konto (gleiche E-Mail) muss im Supabase-Projekt existieren und dieselbe ID haben – bei einem neuen
// Projekt stattdessen app-backup.json in der App einspielen.
import fs from 'node:fs';
import path from 'node:path';

const dir = process.argv[2];
const url = (process.env.SUPABASE_URL || '').replace(/\/$/, '').replace(/\/rest\/v1$/, '');
const key = process.env.SUPABASE_SECRET_KEY || '';
if (!dir || !url || !key) {
  console.error('Aufruf: SUPABASE_URL=… SUPABASE_SECRET_KEY=… node scripts/restore.mjs <backup-ordner>/<konto-id>');
  process.exit(1);
}
const owner = path.basename(path.resolve(dir));
const headers = { apikey: key, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal', ...(key.startsWith('eyJ') ? { Authorization: `Bearer ${key}` } : {}) };

async function upsert(table, rows) {
  for (let i = 0; i < rows.length; i += 200) {
    const res = await fetch(`${url}/rest/v1/${table}`, { method: 'POST', headers, body: JSON.stringify(rows.slice(i, i + 200)) });
    if (!res.ok) throw new Error(`Supabase ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
}

const recDir = path.join(dir, 'records');
const records = fs.readdirSync(recDir).filter((f) => f.endsWith('.json')).flatMap((f) =>
  JSON.parse(fs.readFileSync(path.join(recDir, f), 'utf8')).map((r) => ({ owner, collection: f.slice(0, -5), id: r.id, data: r.data, deleted: r.deleted })));
await upsert('training_records', records);

const serDir = path.join(dir, 'series');
const files = fs.existsSync(serDir) ? fs.readdirSync(serDir).filter((f) => f.endsWith('.json')) : [];
for (let i = 0; i < files.length; i += 20) {
  await upsert('training_series', files.slice(i, i + 20).map((f) => ({ owner, activity_id: f.slice(0, -5), data: JSON.parse(fs.readFileSync(path.join(serDir, f), 'utf8')) })));
}
console.log(`Wiederhergestellt: ${records.length} Datensätze, ${files.length} Verläufe.`);
