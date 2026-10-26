// Speicher: kleine Daten im localStorage, Verlaufsdaten (Puls/Leistung je Einheit) in IndexedDB.
import { useEffect, useState } from 'react';

const KEY = 'trainings-app-v1';
const EMPTY = { activities: [], strength: [], plan: [], recipes: [], coach: [], food: null, settings: {}, wellness: [], connections: {}, customExercises: [], keySessions: [] };

export function loadData() {
  try { return { ...EMPTY, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return { ...EMPTY }; }
}
export function saveData(data) {
  try { localStorage.setItem(KEY, JSON.stringify(data)); return true; } catch { return false; }
}

// Ein globaler Zustand mit Speichern bei jeder Änderung.
let state = loadData();
const listeners = new Set();
export function getData() { return state; }
export function update(fn) {
  state = fn(state);
  saveData(state);
  listeners.forEach((l) => l(state));
}
export function useData() {
  const [d, setD] = useState(state);
  useEffect(() => { listeners.add(setD); return () => listeners.delete(setD); }, []);
  return d;
}
export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

// --- IndexedDB für Verlaufsreihen -------------------------------------------
function db() {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open('trainings-app', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('series');
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
async function tx(mode, fn) {
  const d = await db();
  return new Promise((resolve, reject) => {
    const t = d.transaction('series', mode);
    const req = fn(t.objectStore('series'));
    t.oncomplete = () => resolve(req?.result);
    t.onerror = () => reject(t.error);
  });
}
export const putSeries = (id, series) => tx('readwrite', (s) => s.put(series, id)).catch(() => null);
export const getSeries = (id) => tx('readonly', (s) => s.get(id)).catch(() => null);
export const deleteSeries = (id) => tx('readwrite', (s) => s.delete(id)).catch(() => null);
