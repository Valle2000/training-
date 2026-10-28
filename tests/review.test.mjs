// Wochenrückblick
import test from 'node:test';
import assert from 'node:assert/strict';
import { weekReview } from '../src/lib/review.js';

const A = (id, date, min, zones, extra = {}) => ({ id, date, start: date + 'T10:00:00Z', sport: 'rollerski_skate', durationS: min * 60, load: min, zones, ...extra });
test('Bilanz mit Soll/Ist, Intensität, ausgefallener harter Einheit und Sprung in der nächsten Woche', () => {
  const activities = [
    A('a', '2026-11-03', 90, { I1: 5000, I2: 400, I3: 0, I4: 0, I5: 0 }),
    A('b', '2026-11-05', 100, { I1: 3000, I2: 600, I3: 2400, I4: 0, I5: 0 }, { title: 'Schwelle 3x20' }),
    A('c', '2026-11-08', 150, { I1: 8500, I2: 500, I3: 0, I4: 0, I5: 0 }),
    ...[1, 2, 3, 4].map((k) => A('p' + k, `2026-10-${String(30 - 7 * k + 7).padStart(2, '0')}`, 300, null)),
  ];
  const plan = [
    { id: 'x', date: '2026-11-03', minutes: 90, zone: 'I1', sport: 'rollerski_skate' },
    { id: 'y', date: '2026-11-05', minutes: 100, zone: 'I3', sport: 'rollerski_skate' },
    { id: 'z', date: '2026-11-07', minutes: 80, zone: 'I4', sport: 'run' },
    { id: 'n1', date: '2026-11-10', minutes: 300, zone: 'I1', sport: 'rollerski_skate' },
    { id: 'n2', date: '2026-11-12', minutes: 300, zone: 'I1', sport: 'rollerski_skate' },
  ];
  const r = weekReview({ activities, plan, settings: {} }, '2026-11-02', '2026-11-09');
  assert.equal(Math.round(r.hours * 60), 340);
  assert.equal(r.hardSessions, 1);
  assert.equal(r.missedHard, 1);
  assert.ok(r.share.easy >= 80);
  assert.equal(r.longest.minutes, 150);
  assert.ok(r.tips.some((x) => x.text.includes('ausgefallen')));
  assert.ok(r.tips.some((x) => x.text.includes('Sprung')));
  assert.equal(r.next.count, 2);
});
