// Kalender-Feed holen (Browser darf fremde Seiten wegen CORS nicht direkt lesen).
// Nur TrainingPeaks-Adressen, damit der Dienst nicht als offener Proxy taugt. Weiterleitungen werden einzeln geprüft.
const ALLOWED = /(^|\.)trainingpeaks\.com$/i;
const MAX_BYTES = 3 * 1024 * 1024;

export function checkFeedUrl(raw) {
  let u;
  try { u = new URL(String(raw || '').trim().replace(/^webcals?:\/\//i, 'https://')); } catch { return null; }
  if (u.protocol !== 'https:' || !ALLOWED.test(u.hostname) || u.port || u.username || u.password) return null;
  return u;
}

export async function fetchFeed(raw, fetchImpl = fetch) {
  let u = checkFeedUrl(raw);
  if (!u) throw Object.assign(new Error('Nur TrainingPeaks-Kalenderadressen (webcal:// oder https://…trainingpeaks.com) sind erlaubt.'), { status: 400 });
  for (let hop = 0; hop < 4; hop++) {
    const r = await fetchImpl(u.href, { redirect: 'manual', headers: { Accept: 'text/calendar, */*' }, signal: AbortSignal.timeout(15000) });
    if (r.status >= 300 && r.status < 400 && r.headers.get('location')) {
      u = checkFeedUrl(new URL(r.headers.get('location'), u).href);
      if (!u) throw Object.assign(new Error('Der Feed leitet auf eine fremde Adresse weiter.'), { status: 502 });
      continue;
    }
    if (!r.ok) throw Object.assign(new Error(`TrainingPeaks antwortet mit ${r.status}${r.status === 404 ? ' – Adresse prüfen oder Feed neu erzeugen' : ''}`), { status: 502 });
    const txt = await r.text();
    if (txt.length > MAX_BYTES) throw Object.assign(new Error('Feed zu groß'), { status: 502 });
    if (!/BEGIN:VCALENDAR/.test(txt)) throw Object.assign(new Error('Unter der Adresse liegt kein Kalender (iCal).'), { status: 502 });
    return txt;
  }
  throw Object.assign(new Error('Zu viele Weiterleitungen'), { status: 502 });
}
