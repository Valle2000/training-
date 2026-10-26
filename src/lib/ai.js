// Aufruf der KI-Endpunkte inkl. optionalem Zugangscode (APP_ACCESS_CODE auf dem Server)
// oder eigenem Anthropic-Schlüssel (bleibt nur in diesem Browser, wird pro Anfrage mitgeschickt).
const CODE_KEY = 'trainings-app-access-code';
const OWN_KEY = 'trainings-app-own-key';
const read = (k) => { try { return localStorage.getItem(k) || ''; } catch { return ''; } };
const write = (k, v) => { try { v ? localStorage.setItem(k, v.trim()) : localStorage.removeItem(k); } catch { /* nur Komfort */ } };
export const getAccessCode = () => read(CODE_KEY);
export const setAccessCode = (v) => write(CODE_KEY, v);
export const getOwnKey = () => read(OWN_KEY);
export const setOwnKey = (v) => write(OWN_KEY, v);

export async function kiPost(path, payload) {
  const headers = { 'Content-Type': 'application/json', 'x-access-code': getAccessCode() };
  if (getOwnKey()) headers['x-anthropic-key'] = getOwnKey();
  const r = await fetch(path, { method: 'POST', headers, body: JSON.stringify(payload) });
  const json = await r.json().catch(() => ({ error: 'Ungültige Serverantwort (HTTP ' + r.status + ')' }));
  if (!r.ok) throw new Error(json.error || 'HTTP ' + r.status);
  return json;
}
