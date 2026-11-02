import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// balancePlan lebt in der UI-Datei; hier wird die Funktion aus dem Quelltext geladen.
const src = readFileSync(new URL('../src/ui/training.jsx', import.meta.url), 'utf8');
const body = src.slice(src.indexOf('export function balancePlan('), src.indexOf('// Wochenliste: alle Einheiten'));
const estimatePlanLoad = (m) => m;
const { balancePlan } = new Function('estimatePlanLoad', `${body.replace('export ', '')}; return { balancePlan };`)(estimatePlanLoad);

const plan = [
  { id: 'a', date: '2026-11-02', zone: 'I1', minutes: 120, load: 1 },
  { id: 'b', date: '2026-11-03', zone: 'I1', minutes: 60, load: 1 },
  { id: 'h', date: '2026-11-04', zone: 'I4', minutes: 60, load: 1 },
];
const sum = (p) => p.reduce((a, x) => a + x.minutes, 0);

test('Verlängern: Summe bleibt, lockere Einheit wird kürzer', () => {
  const r = balancePlan(plan, '2026-11-02', '2026-11-08', 'h', 75);
  assert.equal(sum(r), sum(plan));
  assert.equal(r.find((x) => x.id === 'h').minutes, 75);
  assert.equal(r.find((x) => x.id === 'a').minutes, 105);
});

test('Streichen: Minuten gehen auf eine lockere Einheit', () => {
  const r = balancePlan(plan, '2026-11-02', '2026-11-08', 'h', 0).filter((x) => x.id !== 'h');
  assert.equal(sum(r), sum(plan));
});

test('Ohne lockere Einheit: kein Ausgleich', () => {
  const only = [{ id: 'h', date: '2026-11-04', zone: 'I4', minutes: 60 }];
  assert.equal(balancePlan(only, '2026-11-02', '2026-11-08', 'h', 75), null);
});
