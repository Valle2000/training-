// Speicher: Alle Daten in IndexedDB (groß, auf iOS deutlich mehr als localStorage) und zusätzlich, solange es passt,
// im localStorage (schneller Start). Verlaufsdaten (Puls/Leistung je Einheit) liegen nur in IndexedDB.
import { useEffect, useState } from 'react';

const KEY = 'trainings-app-v1';
const EMPTY = { activities: [], strength: [], plan: [], recipes: [], coach: [], food: null, settings: {}, wellness: [], connections: {}, customExercises: [], keySessions: [], lactateTests: [], races: [], gear: [], health: [], workouts: [] };

export function loadData() {
  try { return { ...EMPTY, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return { ...EMPTY }; }
}
export function saveData(data) {
  try { localStorage.setItem(KEY, JSON.stringify(data)); return true; } catch { return false; }
}

// Speicherfehler sichtbar machen statt still Daten zu verlieren.
let saveError = null;
const errorListeners = new Set();
export const onSaveError = (fn) => { errorListeners.add(fn); return () => errorListeners.delete(fn); };
const reportSave = (err) => { if (err === saveError) return; saveError = err; errorListeners.forEach((l) => l(err)); };

// Ein globaler Zustand mit Speichern bei jeder Änderung.
let state = loadData();
const listeners = new Set();
export function getData() { return state; }
let idbTimer = null;
export function update(fn) {
  state = fn(state);
  state.savedAt = Date.now();
  const lsOk = saveData(state);
  clearTimeout(idbTimer);
  idbTimer = setTimeout(() => {
    kvPut('state', state).then(() => reportSave(null)).catch(() => reportSave(lsOk ? null : 'Speichern fehlgeschlagen – der Speicher des Browsers ist voll oder gesperrt (privater Modus?).'));
  }, 300);
  listeners.forEach((l) => l(state));
}

// Beim Start: Stand aus IndexedDB laden, falls er neuer ist als der aus localStorage (z. B. weil localStorage voll war).
export async function hydrate() {
  try { await navigator.storage?.persist?.(); } catch { /* nur Bitte an den Browser */ }
  const stored = await kvGet('state').catch(() => null);
  if (stored && (stored.savedAt || 0) > (state.savedAt || 0)) {
    state = { ...EMPTY, ...stored };
    listeners.forEach((l) => l(state));
  } else if (!stored && state.activities.length) {
    kvPut('state', state).catch(() => {});
  }
}
// Für den Online-Abgleich: über jede Änderung informiert werden.
export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }

export function useData() {
  const [d, setD] = useState(state);
  useEffect(() => { listeners.add(setD); return () => listeners.delete(setD); }, []);
  return d;
}
export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

// --- IndexedDB für Verlaufsreihen -------------------------------------------
function db() {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open('trainings-app', 2);
    r.onupgradeneeded = () => {
      if (!r.result.objectStoreNames.contains('series')) r.result.createObjectStore('series');
      if (!r.result.objectStoreNames.contains('kv')) r.result.createObjectStore('kv');
    };
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
async function tx(mode, fn, storeName = 'series') {
  const d = await db();
  return new Promise((resolve, reject) => {
    const t = d.transaction(storeName, mode);
    const req = fn(t.objectStore(storeName));
    t.oncomplete = () => resolve(req?.result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}
const kvPut = (key, value) => (typeof indexedDB === 'undefined' ? Promise.reject(new Error('kein IndexedDB')) : tx('readwrite', (s) => s.put(value, key), 'kv'));
const kvGet = (key) => (typeof indexedDB === 'undefined' ? Promise.resolve(null) : tx('readonly', (s) => s.get(key), 'kv'));
export const putSeries = (id, series) => tx('readwrite', (s) => s.put(series, id)).catch(() => null);
export const getLocalSeries = (id) => tx('readonly', (s) => s.get(id)).catch(() => null);
// Fehlt ein Verlauf lokal (anderes Gerät), kann der Online-Abgleich ihn nachladen.
let seriesFallback = null;
export const setSeriesFallback = (fn) => { seriesFallback = fn; };
export const getSeries = async (id) => {
  const local = await tx('readonly', (s) => s.get(id)).catch(() => null);
  if (local || !seriesFallback) return local;
  const remote = await seriesFallback(id).catch(() => null);
  if (remote) await putSeries(id, remote);
  return remote;
};
export const deleteSeries = (id) => tx('readwrite', (s) => s.delete(id)).catch(() => null);
