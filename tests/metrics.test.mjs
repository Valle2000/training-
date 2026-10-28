import test from 'node:test';
import assert from 'node:assert/strict';
import { powerLoad, normalizedPower, trimp, hrLoadFromTrimp, computeLoad, performanceCurve, zoneSeconds, rpeLoad } from '../src/lib/metrics.js';

const near = (a, b, eps = 0.5) => assert.ok(Math.abs(a - b) <= eps, `${a} ≈ ${b}`);
const ath = { ftp: 250, lthr: 165, hrMax: 190, hrRest: 50, sex: 'm' };

test('1 h an der FTP = 100', () => near(powerLoad(3600, 250, 250), 100, 1e-9));
test('NP konstant = Mittel', () => near(normalizedPower(Array(600).fill(200)), 200, 1e-9));
test('NP belohnt Schwankungen', () => {
  const v = Array.from({ length: 1200 }, (_, i) => (Math.floor(i / 60) % 2 ? 100 : 300));
  assert.ok(normalizedPower(v) > 200);
});
test('1 h an der Pulsschwelle = 100', () => near(hrLoadFromTrimp(trimp(Array(3600).fill(165), ath), ath), 100, 1e-6));
test('Leistung nur bei Sportarten mit Wattmessung', () => {
  const args = { durationS: 3600, power: Array(3600).fill(250), hr: Array(3600).fill(140) };
  assert.equal(computeLoad(ath, args).source, 'power');
  assert.equal(computeLoad(ath, { ...args, powerSport: false }).source, 'hr');
});
test('Fallback Durchschnittspuls und RPE', () => {
  near(computeLoad(ath, { durationS: 3600, avgHr: 165 }).load, 100, 1e-6);
  assert.equal(computeLoad({}, { durationS: 3600, rpe: 7.5 }).source, 'rpe');
  near(rpeLoad(3600, 7, 'strength'), 49, 1e-9);
});
test('Zonen nach % HFmax', () => {
  const z = zoneSeconds([100, 120, 150, 160, 170, 180], 190);
  assert.deepEqual(z, { I1: 2, I2: 1, I3: 1, I4: 1, I5: 1 }); // I1 ist nach unten offen: 100 zählt als I1
});
test('Fitness konvergiert, Form nutzt Vortag', () => {
  const loads = {};
  for (let i = 0; i < 400; i++) loads[new Date(Date.UTC(2025, 0, 1 + i)).toISOString().slice(0, 10)] = 80;
  const c = performanceCurve(loads, '2025-01-01', '2026-02-04');
  near(c.at(-1).fitness, 80, 0.1);
  const d = performanceCurve({ '2026-01-01': 100 }, '2026-01-01', '2026-01-02');
  assert.equal(d[0].form, 0);
  near(d[1].form, 100 / 42 - 100 / 7, 1e-9);
});
test('Geplante Belastung nur in der Zukunft', () => {
  const c = performanceCurve({ '2026-01-01': 100 }, '2026-01-01', '2026-01-03', { planned: { '2026-01-01': 999, '2026-01-03': 50 }, today: '2026-01-02' });
  assert.equal(c[0].load, 100);
  assert.equal(c[2].load, 50);
  assert.ok(c[2].future);
});
