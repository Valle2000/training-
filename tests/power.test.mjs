import test from 'node:test';
import assert from 'node:assert/strict';
import { meanMax, decoupling, powerZoneSeconds, seriesStats } from '../src/lib/metrics.js';

test('Mean-Max findet den besten Abschnitt', () => {
  const p = [...Array(600).fill(200), ...Array(300).fill(350), ...Array(600).fill(200)];
  const c = meanMax(p);
  assert.equal(c[5], 350);
  assert.equal(c[300], 350);
  assert.equal(c[600], Math.round((300 * 350 + 300 * 200) / 600));
  assert.equal(c[3600], undefined); // zu kurz
});

test('Puls-Kurve füllt Lücken', () => {
  assert.equal(meanMax([150, null, 150, 150, 150, 150], { fill: true })[5], 150);
});

test('Entkopplung: gleichbleibend 0 %, steigender Puls positiv', () => {
  assert.equal(decoupling(Array(3600).fill(200), Array(3600).fill(140)), 0);
  const hr = Array.from({ length: 3600 }, (_, i) => (i < 1800 ? 140 : 150));
  assert.ok(Math.abs(decoupling(Array(3600).fill(200), hr) - 6.7) < 0.1);
});

test('Leistungszonen nach Coggan', () => {
  const z = powerZoneSeconds([100, 180, 220, 250, 290, 350, 400], 250);
  assert.deepEqual(Object.values(z), [1, 1, 1, 1, 1, 1, 1]);
});

test('Kennzahlen einer Einheit', () => {
  const s = seriesStats({ power: Array(3600).fill(200), hr: Array(3600).fill(140) }, { ftp: 250, powerSport: true });
  assert.equal(s.kj, 720);
  assert.equal(s.vi, 1);
  assert.equal(s.ef, 1.43);
  assert.equal(s.powerZones.P3, 3600);
  assert.equal(s.powerCurve[3600], 200);
});

test('Key Session: Wert der Kurve für beliebige Intervalllänge', async () => {
  const { curveAt, trend } = await import('../src/lib/keysessions.js');
  assert.equal(curveAt({ 300: 280, 600: 260 }, 360), 280);
  assert.equal(curveAt({ 360: 290 }, 360), 290);
  assert.deepEqual(trend([{ l: 2.8 }, { l: 2.4 }], 'l', true), { pct: -14.3, better: true });
});
