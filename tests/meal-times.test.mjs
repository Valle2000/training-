// Essenszeiten nach Training und Alltag.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mealTimes, trainingOf } from '../src/lib/food-day.js';
import { planDay, dayTargets } from '../src/lib/nutrition.js';

const schedule = { start: '06:30', end: '22:00', buffer: 15, blocks: [{ id: 'u', label: 'Uni', dows: [1, 2, 3, 4, 5], from: '08:00', to: '17:00' }] };
test('Training am Abend nach der Uni: Mittag 3 h vorher, Snack vorher, Essen danach; in der Uni zum Mitnehmen', () => {
  const data = { activities: [], races: [], plan: [{ id: 'h', date: '2026-11-03', minutes: 100, zone: 'I3', sport: 'rollerski_skate' }], settings: { schedule } };
  const today = trainingOf('2026-11-03', data);
  assert.equal(today[0].time, '17:15'); // erste freie Zeit nach der Uni
  const targets = dayTargets({ weightKg: 70, minutes: 100, hardMinutes: 60, longestMinutes: 100 });
  const plan = planDay({ today, tomorrow: [], targets, weightKg: 70, diet: 'alles', seed: 1, trainLow: true, offsets: {} });
  const meals = mealTimes(plan.meals, today, '2026-11-03', schedule);
  const by = Object.fromEntries(meals.map((m) => [m.role, m]));
  assert.equal(by.pre.time, 16 * 60 + 15);
  assert.equal(by.pre.takeaway, 'Uni');
  assert.equal(by.post.time, 17 * 60 + 15 + 100 + 15);
  assert.ok(by.preLunch.time <= 14 * 60 + 15 && by.preLunch.takeaway === 'Uni');
  assert.ok(by.dinner.time >= by.post.time);
  for (let i = 1; i < meals.length; i++) assert.ok(meals[i].time >= meals[i - 1].time);
});
