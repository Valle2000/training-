import { test } from 'node:test';
import assert from 'node:assert/strict';
import { focusSuggestions } from '../src/lib/plan-wizard.js';

test('Lauf-Rennen mit Priorität B: Vorschlag über vier Wochen, nach einem Ski-A-Rennen', () => {
  const races = [
    { id: 'eng', date: '2027-03-14', name: 'Engadiner', technique: 'Skating', priority: 'A' },
    { id: 'fr', date: '2027-04-04', name: 'Freiburg HM', technique: 'Lauf', priority: 'B' },
  ];
  const s = focusSuggestions(races, []);
  assert.equal(s.length, 1);
  assert.equal(s[0].sport, 'run');
  assert.equal(s[0].from, '2027-03-15');
  assert.equal(s[0].to, '2027-04-04');
});

test('A-Rennen im Rad: acht Wochen Vorlauf', () => {
  const s = focusSuggestions([{ id: 'x', date: '2027-06-20', name: 'Alpenbrevet', technique: 'Rad', priority: 'A' }], []);
  assert.equal(s[0].sport, 'bike');
  assert.equal(s[0].from, '2027-04-25');
});

test('C-Rennen und Ski-Rennen erzeugen keinen Vorschlag', () => {
  assert.equal(focusSuggestions([{ id: 'c', date: '2027-06-20', name: 'Trainingslauf', technique: 'Lauf', priority: 'C' }], []).length, 0);
  assert.equal(focusSuggestions([{ id: 's', date: '2027-03-14', name: 'Engadiner', technique: 'Skating', priority: 'A' }], []).length, 0);
});

test('Keine Vorschläge bei Überschneidung mit einem bestehenden Zeitraum', () => {
  const races = [{ id: 'fr', date: '2027-04-04', name: 'Freiburg HM', technique: 'Lauf', priority: 'B' }];
  assert.equal(focusSuggestions(races, [{ id: 'f', sport: 'run', from: '2027-03-01', to: '2027-03-31' }]).length, 0);
});

test('Highlights im Multisport-Sommer: Bergzeitfahren und Herbst-Marathon bekommen eigene Schwerpunkte', async () => {
  const { focusOn, generatePlan } = await import('../src/lib/plan-wizard.js');
  const summer = [{ id: 'tri', sport: 'tri', from: '2027-05-01', to: '2027-09-30' }];
  const races = [
    { id: 'eng', date: '2027-03-14', name: 'Engadiner', technique: 'Skating', priority: 'A' },
    { id: 'berg', date: '2027-07-11', name: 'Schauinsland', technique: 'Rad', priority: 'B', distanceKm: 11 },
    { id: 'mara', date: '2027-10-17', name: 'Herbst-Marathon', technique: 'Lauf', priority: 'A', distanceKm: 42.2 },
  ];
  const s = focusSuggestions(races, summer);
  const bike = s.find((x) => x.sport === 'bike'), run = s.find((x) => x.sport === 'run');
  assert.ok(bike && run, JSON.stringify(s));
  assert.equal(bike.from, '2027-06-13');
  assert.equal(run.from, '2027-08-22');
  const list = [...summer, ...s];
  assert.equal(focusOn('2027-05-20', list), 'tri');
  assert.equal(focusOn('2027-06-20', list), 'bike');
  assert.equal(focusOn('2027-09-10', list), 'run');
  assert.equal(focusOn('2027-11-10', list), null);
  const w = generatePlan({ startHours: 12, peakHours: 14, start: '2027-06-14', end: '2027-07-04', restDays: [1], longDay: 7, strengthPerWeek: 1, keys: [], approach: 'threshold', focusFor: (m) => focusOn(m, list) }, races);
  const hard = w.flatMap((x) => x.days.flatMap((d) => d.sessions)).filter((x) => x.kind === 'hard');
  assert.ok(hard.length > 0 && hard.every((x) => x.sport === 'bike'), hard.map((x) => x.sport).join());
});

test('Rennart bestimmt die Einheiten im Schwerpunkt (Marathon, 10 km, Bergzeitfahren)', async () => {
  const { raceKind, generatePlan } = await import('../src/lib/plan-wizard.js');
  assert.equal(raceKind({ technique: 'Lauf', distanceKm: 42.2 }), 'run_marathon');
  assert.equal(raceKind({ technique: 'Lauf', distanceKm: 21.1 }), 'run_hm');
  assert.equal(raceKind({ technique: 'Lauf', distanceKm: 10 }), 'run_10k');
  assert.equal(raceKind({ technique: 'Rad', distanceKm: 11, name: 'Schauinsland' }), 'bike_climb');
  assert.equal(raceKind({ technique: 'Rad', distanceKm: 90, name: 'Radmarathon' }), 'bike_marathon');
  assert.equal(raceKind({ technique: 'Skating', distanceKm: 42 }), null);
  const s = focusSuggestions([{ id: 'm', date: '2027-10-17', name: 'Herbst-Marathon', technique: 'Lauf', priority: 'A', distanceKm: 42.2 }], []);
  assert.equal(s[0].kind, 'run_marathon');
  assert.match(s[0].label, /\(Marathon\)/);
  const plan = (kind, sport, race) => {
    const block = { sport, kind, from: '2027-08-22', to: race.date };
    const w = generatePlan({ startHours: 10, peakHours: 12, start: '2027-08-23', end: race.date, restDays: [1], longDay: 7, strengthPerWeek: 1, keys: [], approach: 'threshold', focusFor: (m) => (m >= block.from && m <= block.to ? sport : null), focusKindFor: (m) => (m >= block.from && m <= block.to ? kind : null) }, [race]);
    return w.flatMap((x) => x.days.flatMap((d) => d.sessions)).filter((x) => x.kind === 'hard').map((x) => x.title);
  };
  const mara = plan('run_marathon', 'run', { id: 'm', date: '2027-10-17', name: 'Marathon', technique: 'Lauf', priority: 'A', distanceKm: 42.2 });
  assert.ok(mara.some((t) => /Marathontempo/.test(t)), mara.join(' | '));
  assert.ok(!mara.some((t) => /Halbmarathontempo|10-km-Tempo/.test(t)), mara.join(' | '));
  const tenk = plan('run_10k', 'run', { id: 't', date: '2027-10-17', name: 'Stadtlauf', technique: 'Lauf', priority: 'A', distanceKm: 10 });
  assert.ok(tenk.some((t) => /10-km-Tempo/.test(t)), tenk.join(' | '));
  assert.ok(!tenk.some((t) => /Marathontempo/.test(t)), tenk.join(' | '));
  const climb = plan('bike_climb', 'bike', { id: 'b', date: '2027-10-17', name: 'Bergzeitfahren', technique: 'Rad', priority: 'A', distanceKm: 11 });
  assert.ok(climb.some((t) => /Berg/.test(t)), climb.join(' | '));
  assert.ok(!climb.some((t) => /Marathontempo/.test(t)), climb.join(' | '));
});
