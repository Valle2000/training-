// Multisport im Saisonplan: Rad-Ansätze, Schwimm-Technik, lange Einheit je Sportart, Schwimm-Rennen.
import test from 'node:test';
import assert from 'node:assert/strict';
import { generatePlan, focusSuggestions, raceSport } from '../src/lib/plan-wizard.js';

const base = { startHours: 8, peakHours: 10, start: '2027-04-05', end: '2027-07-04', restDays: [1], longDay: 7, strengthPerWeek: 1, keys: [] };
const hard = (w) => w.flatMap((x) => x.days.flatMap((d) => d.sessions)).filter((s) => s.kind === 'hard');

test('Bergzeitfahren: harte Einheiten auf dem Rad, mit Berg-Einheiten', () => {
  const w = generatePlan({ ...base, approach: 'bike_climb' }, [{ id: 'b', date: '2027-06-27', name: 'Schauinsland', technique: 'Rad', priority: 'A', distanceKm: 11 }]);
  const h = hard(w);
  assert.ok(h.length > 0);
  assert.ok(h.every((s) => s.sport === 'bike'), h.map((s) => s.sport).join());
  assert.ok(h.some((s) => /Berg/.test(s.title)));
});

test('Radmarathon: lange Ausfahrt statt Rollski, Marathontempo vor dem Rennen', () => {
  const w = generatePlan({ ...base, approach: 'bike_marathon' }, [{ id: 'm', date: '2027-06-27', name: 'Radmarathon', technique: 'Rad', priority: 'A', distanceKm: 90 }]);
  const all = w.flatMap((x) => x.days.flatMap((d) => d.sessions));
  const long = all.filter((s) => s.kind === 'long');
  assert.ok(long.length > 0 && long.every((s) => s.sport === 'bike' && s.title === 'Lange Ausfahrt'));
  assert.ok(hard(w).some((s) => /Marathontempo/.test(s.title)));
  const race = all.find((s) => s.kind === 'race');
  assert.ok(race.minutes < 260, `Renndauer ${race.minutes}`);
});

test('Schwimm-Technik pro Woche: Einheiten mit Übungen in Aufbauwochen', () => {
  const w = generatePlan({ ...base, approach: 'pyramidal', swimPerWeek: 1 }, []);
  const weeks = w.filter((x) => ['base', 'build'].includes(x.phase));
  assert.ok(weeks.length > 0);
  for (const x of weeks) {
    const swims = x.days.flatMap((d) => d.sessions).filter((s) => s.sport === 'swim');
    assert.ok(swims.length >= 1, x.from);
    assert.ok(swims.every((s) => /Schwimmen/.test(s.title) && s.minutes <= 60));
  }
});

test('Lauf-Ansatz: lange Einheit ist ein Lauf', () => {
  const w = generatePlan({ ...base, approach: 'run_hm' }, [{ id: 'h', date: '2027-06-27', name: 'HM', technique: 'Lauf', priority: 'A', distanceKm: 21.1 }]);
  const long = w.flatMap((x) => x.days.flatMap((d) => d.sessions)).filter((s) => s.kind === 'long');
  assert.ok(long.length > 0 && long.every((s) => s.sport === 'run'));
});

test('Schwimm-Rennen: Sportart und Schwerpunkt-Vorschlag', () => {
  assert.equal(raceSport('Schwimmen', '2027-07-01'), 'swim');
  const s = focusSuggestions([{ id: 's', date: '2027-07-10', name: 'Seequerung', technique: 'Schwimmen', priority: 'B' }], []);
  assert.equal(s[0].sport, 'swim');
  assert.match(s[0].label, /Schwimmen/);
});
