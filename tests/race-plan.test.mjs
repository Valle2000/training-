// Rennplan mit Verpflegung.
import test from 'node:test';
import assert from 'node:assert/strict';
import { racePlan, lessons, estimateMinutes } from '../src/lib/race-plan.js';

test('Langdistanz: Carboloading, 90 g/h, Verpflegungsstellen und Gels, warmes Getränk bei Kälte', () => {
  const race = { name: 'Engadin', date: '2027-03-14', technique: 'Skating', distanceKm: 42 };
  const p = racePlan(race, { weightKg: 75, minutes: 150, startTime: '08:40', tempC: -8, feedKm: '12, 25, 36', gelG: 25, caffeine: true });
  assert.equal(p.carbPerHour, 90);
  assert.ok(p.steps[0].title.startsWith('Carboloading'));
  assert.ok(p.steps[0].text.includes('750–900 g'));
  assert.ok(p.during.filter((d) => d.km != null && d.what.startsWith('Verpflegung')).length >= 2);
  assert.ok(p.gels >= 2);
  assert.equal(p.fluid.perHour, 350);
  assert.ok(p.pack.some((x) => x.includes('Thermoflasche')));
  assert.equal(p.steps.find((s) => s.title === 'Koffein').when, '07:40');
  assert.equal(p.finish, '11:10');
  for (let i = 1; i < p.during.length; i++) assert.ok(p.during[i].min >= p.during[i - 1].min);
});

test('Sprint und kurzes Rennen: keine Gels, intensives Aufwärmen', () => {
  const p = racePlan({ name: 'Sprint', date: '2027-01-10', technique: 'Skating', distanceKm: 1.4 }, { minutes: 4, startTime: '10:00' });
  assert.equal(p.carbPerHour, 0);
  assert.equal(p.gels, 0);
  assert.ok(p.steps.find((s) => s.title === 'Aufwärmen').text.includes('Renntempo'));
  assert.equal(estimateMinutes({ distanceKm: 10, technique: 'Klassisch' }), 34);
  assert.deepEqual(lessons([{ name: 'A', date: '2026-02-01', report: { lesson: 'zu schnell gestartet' } }, { name: 'B', date: '2027-02-01', report: { lesson: 'x' } }], '2027-01-01').map((x) => x.name), ['A']);
});

test('Eigene Verpflegung (Coxa Carry): Flasche reicht bis ins Ziel, Gels ergänzen; mit Stationen auffüllen', () => {
  const race = { name: 'Engadin', date: '2027-03-14', technique: 'Skating', distanceKm: 42 };
  const carry = racePlan(race, { weightKg: 75, minutes: 145, tempC: -5, mode: 'carry', bottleMl: 600, bottleCarbG: 80, feedKm: '12, 25' });
  assert.ok(carry.carry.drank <= 600);
  assert.equal(carry.carry.empty, null);
  assert.ok(!carry.during.some((d) => d.what.includes('km 12')));
  assert.ok(carry.carry.fromDrink + carry.gels * 25 >= 0.8 * 60 * 137 / 60);
  assert.ok(carry.pack.some((x) => x.startsWith('Coxa Carry')));
  const mixed = racePlan(race, { weightKg: 75, minutes: 145, tempC: -5, mode: 'mixed', bottleMl: 600, bottleCarbG: 80, feedKm: '12, 25, 36' });
  assert.ok(mixed.during.some((d) => d.what.includes('auffüllen')));
  assert.ok(mixed.carry.drank > 600);
});
