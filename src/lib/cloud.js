// Abgleich mit Supabase (gleiches Projekt wie SkiWax, eigene Tabellen training_records / training_series).
// Pro Datensatz merkt sich das Gerät einen Fingerabdruck des zuletzt abgeglichenen Stands:
// Hat sich nur eine Seite geändert, gewinnt sie; haben sich beide geändert, gewinnt das Gerät.
// Gelöschte Datensätze werden als „deleted“ weitergegeben.

export const COLLECTIONS = ['activities', 'strength', 'plan', 'recipes', 'coach', 'wellness', 'customExercises', 'keySessions', 'lactateTests', 'races', 'gear', 'health', 'workouts'];
export const SINGLETONS = ['settings', 'connections', 'food'];
const idOf = (c, r) => (c === 'wellness' ? r.date : r.id);

export function stable(v) {
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return '[' + v.map(stable).join(',') + ']';
  return '{' + Object.keys(v).filter((k) => v[k] !== undefined).sort().map((k) => JSON.stringify(k) + ':' + stable(v[k])).join(',') + '}';
}
export function fingerprint(v) {
  let h = 0x811c9dc5;
  const s = stable(v);
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(36) + ':' + s.length;
}

// Alle lokalen Datensätze als {"<sammlung>:<id>": {collection, id, data}}.
export function localRecords(data) {
  const out = {};
  for (const c of COLLECTIONS) for (const r of data[c] || []) { const id = idOf(c, r); if (id) out[`${c}:${id}`] = { collection: c, id: String(id), data: r }; }
  for (const k of SINGLETONS) if (data[k] != null && (typeof data[k] !== 'object' || Object.keys(data[k]).length)) out[`singleton:${k}`] = { collection: 'singleton', id: k, data: data[k] };
  return out;
}

// Was vom Server übernommen und was hochgeladen wird. fp: Fingerabdrücke des letzten Abgleichs.
export function planSync(data, fp, remoteRows) {
  const local = localRecords(data);
  const apply = [], nextFp = { ...fp };
  for (const row of remoteRows) {
    const key = `${row.collection}:${row.id}`;
    const l = local[key];
    // Server-Stand unverändert seit dem letzten Abgleich (z. B. Echo des eigenen Hochladens) → nichts übernehmen,
    // sonst käme ein lokal gelöschter Datensatz zurück.
    if ((row.deleted ? 'deleted' : fingerprint(row.data)) === fp[key]) continue;
    const localChanged = l ? fingerprint(l.data) !== fp[key] : fp[key] !== undefined && fp[key] !== 'deleted';
    if (localChanged && l) continue; // beide geändert → Gerät gewinnt, wird unten hochgeladen
    apply.push(row);
    nextFp[key] = row.deleted ? 'deleted' : fingerprint(row.data);
  }
  const applied = new Set(apply.map((r) => `${r.collection}:${r.id}`));
  const push = [];
  for (const [key, l] of Object.entries(local)) if (!applied.has(key) && fingerprint(l.data) !== nextFp[key]) push.push({ collection: l.collection, id: l.id, data: l.data, deleted: false });
  for (const key of Object.keys(nextFp)) if (!local[key] && !applied.has(key) && nextFp[key] !== 'deleted') {
    const [collection, ...rest] = key.split(':');
    push.push({ collection, id: rest.join(':'), data: null, deleted: true });
  }
  return { apply, push, nextFp };
}

// Server-Zeilen in den lokalen Stand übernehmen.
export function applyRows(data, rows) {
  if (!rows.length) return data;
  const next = { ...data };
  for (const c of COLLECTIONS) next[c] = [...(data[c] || [])];
  for (const row of rows) {
    if (row.collection === 'singleton') { if (SINGLETONS.includes(row.id)) next[row.id] = row.deleted ? (row.id === 'food' ? null : {}) : row.data; continue; }
    if (!COLLECTIONS.includes(row.collection)) continue;
    const list = next[row.collection];
    const i = list.findIndex((r) => String(idOf(row.collection, r)) === row.id);
    if (row.deleted) { if (i >= 0) list.splice(i, 1); } else if (i >= 0) list[i] = row.data; else list.push(row.data);
  }
  if (rows.some((r) => r.collection === 'wellness')) next.wellness.sort((a, b) => a.date.localeCompare(b.date));
  return next;
}
