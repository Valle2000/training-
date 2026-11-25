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

test('Schwimm-Aufbau: Stufen, Tempo vom aktuellen zum Ziel, Tempotest alle 6 Wochen', async () => {
  const { swimSession, parsePace, fmtPace } = await import('../src/lib/plan-wizard.js');
  assert.equal(parsePace('2:20'), 140);
  assert.equal(parsePace('1:45'), 105);
  assert.equal(parsePace('abc'), null);
  assert.equal(fmtPace(105), '1:45');
  const first = swimSession({ wi: 0, weeks: 30, k: 0, cur: 140, goal: 105 });
  assert.equal(first.stage, 1);
  assert.match(first.title, /Wasserlage/);
  const mid = swimSession({ wi: 15, weeks: 30, k: 1, cur: 140, goal: 105 });
  assert.equal(mid.stage, 2);
  assert.match(mid.description, /pro 100 m/);
  const last = swimSession({ wi: 28, weeks: 29, k: 0, cur: 140, goal: 105 }); // Woche 29 wäre Testwoche
  assert.equal(last.stage, 3);
  assert.match(last.description, /1:45 pro 100 m/);
  assert.match(swimSession({ wi: 5, weeks: 30, k: 0, cur: 140, goal: 105 }).title, /Tempotest/);
  assert.doesNotMatch(swimSession({ wi: 20, weeks: 30, k: 0 }).description, /pro 100 m/);
});

test('Drei Schwimmeinheiten pro Woche werden untergebracht', () => {
  const w = generatePlan({ ...base, approach: 'pyramidal', swimPerWeek: 3, swimPace: 140, swimGoal: 105 }, []);
  const build = w.filter((x) => ['base', 'build'].includes(x.phase));
  const counts = build.map((x) => x.days.flatMap((d) => d.sessions).filter((s) => s.sport === 'swim').length);
  assert.ok(counts.every((n) => n >= 2), counts.join());
  assert.ok(counts.some((n) => n === 3), counts.join());
});

test('Allrounder: im Sommer Rad und Laufen gleichwertig, harte Rollski-Einheit bleibt', async () => {
  const { generatePlan } = await import('../src/lib/plan-wizard.js');
  const opts = { startHours: 10, peakHours: 14, start: '2026-05-04', end: '2027-03-14', restDays: [1], longDay: 7, strengthPerWeek: 2, bikeFrom: 4, bikeTo: 10, profile: { multi: 'multi' } };
  const summer = generatePlan(opts, [{ date: '2027-03-14', priority: 'A', name: 'E' }]).filter((w) => w.from >= '2026-05-04' && w.from < '2026-10-01');
  const all = summer.flatMap((w) => w.days.flatMap((d) => d.sessions));
  const min = (re) => all.filter((s) => re.test(s.sport)).reduce((a, s) => a + s.minutes, 0);
  assert.ok(min(/^bike$/) > 0.6 * min(/^run$/) && min(/^run$/) > 0.6 * min(/^bike$/), 'Rad und Laufen ähnlich viel');
  assert.ok(min(/^bike$/) > 0.35 * min(/^rollerski/), 'Rad nicht nur Beiwerk');
  const hardBike = all.filter((s) => s.sport === 'bike' && s.kind === 'hard').length, hardRun = all.filter((s) => s.sport === 'run' && s.kind === 'hard').length;
  assert.ok(hardBike >= 6 && hardRun >= 6, `harte Rad ${hardBike} / Lauf ${hardRun}`);
  for (const w of summer) assert.ok(w.days.some((d) => d.sessions.some((s) => s.kind === 'hard' && /^rollerski/.test(s.sport))) || w.phase === 'recovery', `Rollski hart in ${w.from}`);
  const longs = new Set(all.filter((s) => s.kind === 'long').map((s) => s.sport.replace(/_.*/, '')));
  assert.ok(longs.has('bike') && longs.has('run') && longs.has('rollerski'));
});
