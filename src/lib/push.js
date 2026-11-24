// Mitteilungen im Browser: Abo für den Wochenrückblick am Sonntag (Web Push).
// Auf dem iPhone nur in der Home-Bildschirm-App ab iOS 16.4.
import { sb } from './supabase.js';

const VAPID = (import.meta.env?.VITE_VAPID_PUBLIC_KEY || '').trim();
export const pushAvailable = () => typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
export const pushReady = () => pushAvailable() && !!VAPID;

const toBytes = (b64) => {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
};

async function call(body) {
  const client = await sb();
  const { data: { session } } = client ? await client.auth.getSession() : { data: {} };
  if (!session) throw new Error('Bitte zuerst anmelden.');
  const res = await fetch('/api/push', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify(body) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `Fehler ${res.status}`);
  return json;
}

export async function currentSubscription() {
  if (!pushAvailable()) return null;
  const reg = await navigator.serviceWorker.getRegistration();
  return reg ? reg.pushManager.getSubscription() : null;
}

export async function enablePush() {
  if (!pushReady()) throw new Error('Mitteilungen sind hier nicht verfügbar.');
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') throw new Error('Mitteilungen wurden nicht erlaubt (Einstellungen → Mitteilungen).');
  const reg = await navigator.serviceWorker.ready;
  const sub = (await reg.pushManager.getSubscription()) || (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toBytes(VAPID) }));
  await call({ action: 'subscribe', subscription: sub.toJSON() });
  return sub;
}

export async function disablePush() {
  const sub = await currentSubscription();
  if (!sub) return;
  await call({ action: 'unsubscribe', endpoint: sub.endpoint }).catch(() => {});
  await sub.unsubscribe();
}

export const testPush = () => call({ action: 'test' });
