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

test('Festgelegte Runden passen nicht zur Einheit: erkannte Intervalle statt Teilwerte', async () => {
  const { keySessionRows } = await import('../src/lib/keysessions.js');
  const act = { id: 'k2', keySessionId: 'k3', date: '2026-11-03', sport: 'skierg', durationS: 6000, load: 40,
    laps: [{ n: 1, durationS: 1200, avgPower: 118 }, { n: 2, durationS: 1200, avgPower: 209 }, { n: 3, durationS: 1200, avgPower: 209 }, { n: 4, durationS: 1200, avgPower: 213 }, { n: 5, durationS: 1200, avgPower: 89 }],
    intervals: [{ durationS: 1200, avg: 209, watts: true, hr: 150 }, { durationS: 1200, avg: 209, watts: true, hr: 156 }, { durationS: 1200, avg: 213, watts: true, hr: 160 }] };
  const ks = { id: 'k3', name: '3x20', sport: 'skierg', keywords: '3x20', laps: '2,4,6', intervalSec: 1200 };
  const [row] = keySessionRows([act], ks);
  assert.equal(row.intervalPower, 210);
});

test('Key Session: Arbeitsrunden wie in der Rundentabelle (210 W statt 208)', async () => {
  const { keySessionRows } = await import('../src/lib/keysessions.js');
  const act = { id: 'k4', keySessionId: 'k5', date: '2026-11-03', sport: 'skierg', durationS: 6000, load: 40,
    laps: [{ n: 1, durationS: 1200, avgPower: 118 }, { n: 2, durationS: 1200, avgPower: 209, avgHr: 150 }, { n: 3, durationS: 1200, avgPower: 209, avgHr: 156 }, { n: 4, durationS: 1200, avgPower: 213, avgHr: 160 }, { n: 5, durationS: 1200, avgPower: 89, avgHr: 123 }],
    intervals: [{ durationS: 1190, avg: 206, watts: true, hr: 150 }, { durationS: 1210, avg: 208, watts: true, hr: 156 }, { durationS: 1180, avg: 209, watts: true, hr: 160 }] };
  const ks = { id: 'k5', name: '3x20', sport: 'skierg', keywords: '3x20', laps: '2,4,6', intervalSec: 1200 };
  const [row] = keySessionRows([act], ks);
  assert.equal(row.intervalPower, 210);
});
