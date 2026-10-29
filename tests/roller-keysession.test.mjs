import { test } from 'node:test';
import assert from 'node:assert/strict';
import { keySessionRows } from '../src/lib/keysessions.js';

test('Key Session: Rollski-Schätzung wird je Runde genutzt und als Schätzung markiert', () => {
  const ks = { id: 'k1', name: 'Intervalle', sport: 'rollerski_skate', keywords: 'intervall', laps: '2-3', intervalSec: 300 };
  const act = {
    id: 'a1', date: '2026-10-20', sport: 'rollerski_skate', title: 'Intervall', durationS: 1200, load: 50,
    laps: [{ n: 1, startS: 0, durationS: 300, avgHr: 150 }, { n: 2, startS: 300, durationS: 300, avgHr: 165 }, { n: 3, startS: 600, durationS: 300, avgHr: 166 }],
    rollPowerLaps: [200, 260, 265],
  };
  const [row] = keySessionRows([act], ks);
  assert.equal(row.powerEstimated, true);
  assert.equal(row.intervalPower, Math.round((260 + 265) / 2));
});
