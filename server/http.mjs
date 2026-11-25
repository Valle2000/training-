// Gemeinsame Einbindung für Vercel-Funktionen (api/*.js) und den Vite-Server (npm run dev / preview).
import { handleAi, aiRoutes } from './ai.mjs';
import { handleConnect } from './connect.mjs';
import { handlePush } from './push.mjs';
import { fetchFeed } from './ical.mjs';

function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

async function readJson(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') return JSON.parse(req.body);
  let raw = '';
  for await (const chunk of req) raw += chunk;
  return JSON.parse(raw || '{}');
}

export function aiHandler(path) {
  return async (req, res) => {
    if (req.method !== 'POST') return sendJson(res, 405, { error: 'Nur POST' });
    try {
      sendJson(res, 200, await handleAi(path, await readJson(req), req.headers));
    } catch (e) {
      console.error('[ki]', e);
      sendJson(res, e.status && e.status < 600 ? e.status : 500, { error: e.message || String(e) });
    }
  };
}

export const connectHandler = handleConnect;

// Mitteilungen: Abo verwalten (POST) und Wochenrückblick per Zeitplan (GET ?cron=1).
export async function pushHandler(req, res) {
  try {
    const query = Object.fromEntries(new URL(req.url, 'http://x').searchParams);
    const body = req.method === 'POST' ? await readJson(req) : {};
    sendJson(res, 200, await handlePush({ method: req.method, query, body, headers: req.headers }));
  } catch (e) {
    console.error('[push]', e.message);
    sendJson(res, e.status && e.status < 600 ? e.status : 500, { error: e.message || String(e) });
  }
}

// Kalender-Feed (TrainingPeaks) als Text zurückgeben. Adresse im Body, damit sie nicht in Zugriffsprotokollen landet.
export async function icalHandler(req, res) {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Nur POST' });
  try {
    const { url } = await readJson(req);
    sendJson(res, 200, { ics: await fetchFeed(url) });
  } catch (e) {
    sendJson(res, e.status && e.status < 600 ? e.status : 502, { error: e.message || String(e) });
  }
}

export function devMiddleware() {
  const ai = Object.fromEntries(aiRoutes.map((p) => [p, aiHandler(p)]));
  return (req, res, next) => {
    const path = req.url.split('?')[0];
    if (ai[path]) return ai[path](req, res);
    if (path === '/api/connect') return handleConnect(req, res);
    if (path === '/api/push') return pushHandler(req, res);
    if (path === '/api/ical') return icalHandler(req, res);
    next();
  };
}
