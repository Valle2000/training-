import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// balancePlan lebt in der UI-Datei; hier wird die Funktion aus dem Quelltext geladen.
const src = readFileSync(new URL('../src/ui/training.jsx', import.meta.url), 'utf8');
const body = src.slice(src.indexOf('export function balancePlan('), src.indexOf('// Wochenabstand') >= 0 ? src.indexOf('// Wochenabstand') : src.indexOf('// Wochenziel bewusst'));
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

test('Wochenziel senken: lockere Einheiten zuerst, harte bleiben', () => {
  const p = [
    { id: 'e1', date: '2026-11-02', zone: 'I1', minutes: 120, load: 1 },
    { id: 'e2', date: '2026-11-03', zone: 'I2', minutes: 90, load: 1 },
    { id: 'h', date: '2026-11-04', zone: 'I4', minutes: 60, load: 1 },
  ];
  const sum = (x) => x.reduce((a, y) => a + y.minutes, 0);
  const src = readFileSync(new URL('../src/ui/training.jsx', import.meta.url), 'utf8');
  const body2 = src.slice(src.indexOf('export function scaleWeek('), src.indexOf('// Wochenliste: alle Einheiten'));
  const { scaleWeek } = new Function('estimatePlanLoad', `${body2.replace('export ', '')}; return { scaleWeek };`)((m) => m);
  const r = scaleWeek(p, '2026-11-02', '2026-11-08', 180);
  assert.equal(r.find((x) => x.id === 'h').minutes, 60);
  assert.ok(Math.abs(sum(r) - 180) <= 3, `sum ${sum(r)}`);
});
