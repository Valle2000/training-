import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectIntervals } from '../src/lib/intervals.js';

// 20 min Grundlage bei 200 W, dazwischen 4 × 2 min bei 280 W, Pausen bei 200 W
const build = () => {
  const out = [];
  for (let i = 0; i < 600; i++) out.push(200);
  for (let k = 0; k < 4; k++) { for (let i = 0; i < 120; i++) out.push(280); for (let i = 0; i < 120; i++) out.push(200); }
  return out;
};

test('vier Intervalle über dem Schnitt werden erkannt', () => {
  const r = detectIntervals(build());
  assert.equal(r.length, 4, JSON.stringify(r));
  assert.ok(r.every((x) => x.durationS >= 110 && x.avg > 250));
});

test('gleichmäßige Einheit hat keine Intervalle', () => {
  const r = detectIntervals(Array(1200).fill(210));
  assert.equal(r.length, 0);
});

test('kurze Ausreißer unter einer Minute zählen nicht', () => {
  const v = Array(900).fill(200);
  for (let i = 300; i < 330; i++) v[i] = 300;
  assert.equal(detectIntervals(v).length, 0);
});

test('Key Session nutzt erkannte Intervalle, wenn keine Runden passen', async () => {
  const { keySessionRows } = await import('../src/lib/keysessions.js');
  const act = { id: 'k', keySessionId: 'k1', date: '2026-10-20', sport: 'bike', durationS: 1800, load: 40, intervals: [
    { durationS: 120, avg: 280, watts: true, hr: 170 }, { durationS: 120, avg: 280, watts: true, hr: 172 },
  ] };
  const ks = { id: 'k1', name: 'Test', sport: 'bike', keywords: 'test', intervalSec: 120 };
  const [row] = keySessionRows([act], ks);
  assert.equal(row.intervalPower, 280);
  assert.equal(row.intervalCount, 2);
});

test('Kurzer Einbruch innerhalb eines Intervalls trennt es nicht', () => {
  const v = [];
  for (let i = 0; i < 300; i++) v.push(120);
  for (let i = 0; i < 1200; i++) v.push(i >= 500 && i < 530 ? 190 : 260);
  for (let i = 0; i < 300; i++) v.push(120);
  const r = detectIntervals(v);
  assert.equal(r.length, 1, JSON.stringify(r));
});
