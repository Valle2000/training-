import test from 'node:test';
import assert from 'node:assert/strict';
import { sportSummary } from '../src/lib/activities.js';

test('Wochensumme je Sportart mit Ist/Soll und Gefühl', () => {
  const plan = [{ date: '2026-11-23', sport: 'xc_skate', minutes: 90 }, { date: '2026-11-24', sport: 'run', minutes: 45 }, { date: '2026-12-01', sport: 'run', minutes: 99 }];
  const acts = [
    { date: '2026-11-23', sport: 'xc_classic', durationS: 6000, distanceM: 25000, ascentM: 300, feel: 'strong' },
    { date: '2026-11-25', sport: 'skierg', durationS: 3600, kj: 700, avgPower: 190, feel: 'weak' },
  ];
  const r = sportSummary(plan, acts, '2026-11-23', '2026-11-29');
  const ski = r.find((x) => x.group === 'ski');
  assert.equal(r[0].group, 'ski');
  assert.equal(ski.planMin, 90); assert.equal(ski.doneMin, 160); assert.equal(ski.km, 25); assert.equal(ski.kj, 700);
  assert.deepEqual(ski.feel, { strong: 1, normal: 0, weak: 1 });
  assert.equal(r.find((x) => x.group === 'run').planMin, 45);
});

test('Soll/Ist je Einheit', async () => {
  const { sessionCompliance } = await import('../src/lib/activities.js');
  const plan = [{ date: '2026-11-23', sport: 'xc_skate', minutes: 90, title: '3x12' }, { date: '2026-11-23', sport: 'run', minutes: 0 }];
  assert.equal(sessionCompliance({ date: '2026-11-23', sport: 'rollerski_skate', durationS: 5400 }, plan).level, 'good');
  assert.equal(sessionCompliance({ date: '2026-11-23', sport: 'xc_classic', durationS: 3000 }, plan).level, 'off');
  assert.equal(sessionCompliance({ date: '2026-11-23', sport: 'run', durationS: 3000 }, plan), null);
});
