// Anbindung an Polar AccessLink, Concept2 Logbook (ErgData) und Wahoo Cloud.
// Der Server macht nur, was der Browser nicht darf: Client-Secret beim Token-Tausch verwenden und
// Anfragen an die Anbieter weiterreichen (dort ist meist kein CORS erlaubt). Die Zugangs-Tokens liegen
// im Browser des Nutzers und werden nicht gespeichert.
//
// Ein Endpunkt: /api/connect
//   GET  ?provider=polar&op=start        → Weiterleitung zur Anmeldung beim Anbieter
//   GET  ?code=…&state=polar.xyz          → Rückkehr vom Anbieter, Tokens per URL-Fragment an die App
//   POST ?provider=wahoo&op=refresh       → abgelaufenes Token erneuern (Body: {refresh_token})
//   GET  ?provider=polar&op=get&path=/v3/exercises   (Header x-provider-token) → Weiterleitung der Anfrage
//   GET  ?provider=wahoo&op=file&url=…    → FIT-Datei von Wahoo laden

const PROVIDERS = {
  polar: {
    auth: 'https://flow.polar.com/oauth2/authorization',
    token: 'https://polarremote.com/v2/oauth2/token',
    api: 'https://www.polaraccesslink.com',
    prefix: '/v3/',
    scope: 'accesslink.read_all',
    basicAuth: true,
  },
  concept2: {
    auth: 'https://log.concept2.com/oauth/authorize',
    token: 'https://log.concept2.com/oauth/access_token',
    api: 'https://log.concept2.com',
    prefix: '/api/',
    scope: 'user:read,results:read',
  },
  wahoo: {
    auth: 'https://api.wahooligan.com/oauth/authorize',
    token: 'https://api.wahooligan.com/oauth/token',
    api: 'https://api.wahooligan.com',
    prefix: '/v1/',
    scope: 'user_read workouts_read offline_data',
  },
};

const envKey = (p, k) => process.env[`${p.toUpperCase()}_${k}`] || '';
export const configuredProviders = () => Object.keys(PROVIDERS).filter((p) => envKey(p, 'CLIENT_ID') && envKey(p, 'CLIENT_SECRET'));

function origin(req) {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, '');
  const proto = req.headers['x-forwarded-proto'] || (req.socket?.encrypted ? 'https' : 'http');
  return `${proto}://${req.headers['x-forwarded-host'] || req.headers.host}`;
}
const redirectUri = (req) => `${origin(req)}/api/connect`;

function httpError(status, message) { const e = new Error(message); e.status = status; return e; }

async function exchange(provider, params) {
  const p = PROVIDERS[provider];
  const id = envKey(provider, 'CLIENT_ID'), secret = envKey(provider, 'CLIENT_SECRET');
  const body = new URLSearchParams(params);
  const headers = { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' };
  if (p.basicAuth) headers.Authorization = 'Basic ' + Buffer.from(`${id}:${secret}`).toString('base64');
  else { body.set('client_id', id); body.set('client_secret', secret); }
  const r = await fetch(p.token, { method: 'POST', headers, body });
  const json = await r.json().catch(() => ({}));
  if (!r.ok) throw httpError(502, `${provider}: Token-Abruf fehlgeschlagen (${r.status}) ${json.error_description || json.error || ''}`);
  const out = { access_token: json.access_token, refresh_token: json.refresh_token || null, expires_at: json.expires_in ? Date.now() + json.expires_in * 1000 : null };
  if (provider === 'polar') {
    out.user_id = String(json.x_user_id);
    // Nutzer bei der eigenen Polar-App registrieren; 409 heißt: schon registriert.
    const reg = await fetch(`${p.api}/v3/users`, { method: 'POST', headers: { Authorization: `Bearer ${out.access_token}`, 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ 'member-id': `user-${out.user_id}` }) });
    if (!reg.ok && reg.status !== 409) throw httpError(502, `Polar: Registrierung fehlgeschlagen (${reg.status})`);
  }
  return out;
}

const WAHOO_FILE_HOST = /(^|\.)wahooligan\.com$|(^|\.)amazonaws\.com$|(^|\.)cloudfront\.net$/;

export async function handleConnect(req, res) {
  const url = new URL(req.url, 'http://x');
  const q = Object.fromEntries(url.searchParams);
  const redirect = (to) => { res.statusCode = 302; res.setHeader('Location', to); res.end(); };
  const json = (status, body) => { res.statusCode = status; res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.end(JSON.stringify(body)); };
  try {
    // Rückkehr vom Anbieter: Anbieter steckt im state.
    if (q.code || q.error) {
      const provider = String(q.state || '').split('.')[0];
      if (!PROVIDERS[provider]) throw httpError(400, 'Unbekannter Anbieter');
      if (q.error) return redirect(`/#verbindung=${provider}&fehler=${encodeURIComponent(q.error)}`);
      const tokens = await exchange(provider, { grant_type: 'authorization_code', code: q.code, redirect_uri: redirectUri(req) });
      const payload = Buffer.from(JSON.stringify(tokens)).toString('base64url');
      return redirect(`/#verbindung=${provider}&state=${encodeURIComponent(q.state)}&daten=${payload}`);
    }
    const provider = q.provider, p = PROVIDERS[provider];
    if (!p) throw httpError(400, 'Unbekannter Anbieter');
    if (q.op === 'status') return json(200, { configured: configuredProviders() });
    if (!envKey(provider, 'CLIENT_ID')) throw httpError(503, `${provider} ist auf dem Server nicht eingerichtet (${provider.toUpperCase()}_CLIENT_ID fehlt).`);

    if (q.op === 'start') {
      const params = new URLSearchParams({ response_type: 'code', client_id: envKey(provider, 'CLIENT_ID'), redirect_uri: redirectUri(req), state: q.state || provider, scope: p.scope });
      return redirect(`${p.auth}?${params}`);
    }
    if (q.op === 'refresh') {
      let raw = '';
      for await (const c of req) raw += c;
      const body = typeof req.body === 'object' && req.body ? req.body : JSON.parse(raw || '{}');
      if (!body.refresh_token) throw httpError(400, 'refresh_token fehlt');
      return json(200, await exchange(provider, { grant_type: 'refresh_token', refresh_token: body.refresh_token }));
    }
    const token = req.headers['x-provider-token'];
    if (!token) throw httpError(401, 'Nicht verbunden');
    let target;
    if (q.op === 'get') {
      if (!q.path?.startsWith(p.prefix) || q.path.includes('..')) throw httpError(400, 'Pfad nicht erlaubt');
      target = p.api + q.path;
    } else if (q.op === 'file' && provider === 'wahoo') {
      const u = new URL(q.url);
      if (u.protocol !== 'https:' || !WAHOO_FILE_HOST.test(u.hostname)) throw httpError(400, 'Adresse nicht erlaubt');
      target = u.toString();
    } else throw httpError(400, 'Unbekannte Aktion');

    const isFile = q.op === 'file' || q.path?.endsWith('/fit');
    const headers = q.op === 'file' ? {} : { Authorization: `Bearer ${token}`, Accept: isFile ? '*/*' : provider === 'concept2' ? 'application/vnd.c2logbook.v1+json' : 'application/json' };
    const r = await fetch(target, { headers });
    res.statusCode = r.status;
    res.setHeader('Content-Type', r.headers.get('content-type') || 'application/octet-stream');
    res.end(Buffer.from(await r.arrayBuffer()));
  } catch (e) {
    console.error('[connect]', e);
    json(e.status || 500, { error: e.message || String(e) });
  }
}
