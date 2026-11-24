// Rad wetterabhängig tauschen und Rad-Saison im Saisonplan.
import test from 'node:test';
import assert from 'node:assert/strict';
import { swapPlanItem, bikeInSeason } from '../src/lib/weather-swap.js';
import { generatePlan } from '../src/lib/plan-wizard.js';

test('Lockere Radeinheit wird zu kürzerem Lauf, harte behält die Struktur', () => {
  const easy = swapPlanItem({ id: 'a', sport: 'bike', title: 'Locker (Rad)', minutes: 120, zone: 'I1', description: 'locker' }, 'run');
  assert.equal(easy.sport, 'run');
  assert.equal(easy.minutes, 90);
  assert.equal(easy.title, 'Locker (Laufen)');
  assert.match(easy.description, /statt Rad \(120 → 90 min\)/);
  assert.ok(easy.load > 0);
  const longRide = swapPlanItem({ sport: 'bike', title: 'Lange Ausfahrt', minutes: 240, zone: 'I1' }, 'run');
  assert.equal(longRide.minutes, 150);
  const hard = swapPlanItem({ sport: 'bike', title: 'Rad Schwelle: 2×20 min', minutes: 80, zone: 'I3' }, 'skierg');
  assert.equal(hard.minutes, 80);
  assert.equal(hard.title, 'SkiErg: Schwelle: 2×20 min');
  const roll = swapPlanItem({ sport: 'bike', title: 'Locker (Rad)', minutes: 90, zone: 'I1' }, 'rollerski_skate');
  assert.equal(roll.minutes, 90);
});

test('Rad-Saison: Monate, auch über den Jahreswechsel', () => {
  assert.ok(bikeInSeason('2027-05-10', 4, 10));
  assert.ok(!bikeInSeason('2027-02-10', 4, 10));
  assert.ok(bikeInSeason('2027-02-10', null, null));
  assert.ok(bikeInSeason('2027-01-10', 11, 2));
});

test('Saisonplan plant außerhalb der Rad-Saison kein Rad', () => {
  const o = { startHours: 12, peakHours: 14, start: '2027-01-04', end: '2027-05-30', restDays: [1], longDay: 7, strengthPerWeek: 1, keys: [], approach: 'norwegian', bikeFrom: 4, bikeTo: 10, focusFor: () => 'run' };
  const w = generatePlan(o, []);
  const sess = (from, to) => w.filter((x) => x.from >= from && x.from < to).flatMap((x) => x.days.flatMap((d) => d.sessions));
  assert.ok(!sess('2027-01-04', '2027-03-29').some((s) => s.sport === 'bike'), 'kein Rad bis Ende März');
  const ref = generatePlan({ ...o, bikeFrom: null, bikeTo: null }, []);
  assert.ok(ref.flatMap((x) => x.days.flatMap((d) => d.sessions)).some((s) => s.sport === 'bike' && s.date < '2027-03-29') || ref.slice(0, 12).some((x) => x.days.some((d) => d.sessions.some((s) => s.sport === 'bike'))), 'ohne Saison gäbe es Rad');
  assert.ok(sess('2027-04-05', '2027-05-31').some((s) => s.sport === 'bike'), 'ab April wieder Rad');
});
