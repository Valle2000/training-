// Wochenplanung mit Alltag und Anpassung an Morgen-Check, Krankheit und verpasste Einheiten.
import test from 'node:test';
import assert from 'node:assert/strict';
import { freeWindows, freeMinutes, slotDay, adaptWeek, applyOps } from '../src/lib/week-adapt.js';

const schedule = { start: '06:30', end: '21:30', buffer: 15, blocks: [{ id: 'u', dows: [1, 2, 3, 4, 5], from: '08:00', to: '17:00', label: 'Uni' }], oneOff: [{ id: 'o', date: '2026-11-04', from: '17:00', to: '21:00', label: 'Geburtstag' }] };
const P = (id, date, minutes, zone, title = '') => ({ id, date, minutes, zone, title, sport: zone === 'Kraft' ? 'strength' : 'rollerski_skate', load: 60 });

test('Freie Zeit: Uni mit Puffer, einzelner Termin', () => {
  assert.deepEqual(freeWindows('2026-11-02', schedule), [[390, 465], [1035, 1290]]); // 6:30–7:45, 17:15–21:30
  assert.equal(freeMinutes('2026-11-07', schedule), 900); // Samstag ganz frei
  assert.deepEqual(freeWindows('2026-11-04', schedule), [[390, 465]]); // Mittwoch abends belegt
  const { slots, overflow } = slotDay('2026-11-02', [P('a', '2026-11-02', 60, 'I1'), P('b', '2026-11-02', 100, 'I3')], schedule);
  assert.deepEqual(slots.b, { from: 1035, to: 1135 });
  assert.deepEqual(slots.a, { from: 390, to: 450 });
  assert.equal(overflow.length, 0);
});

test('Morgen-Check rot: harte Einheit an anderen Tag statt einer lockeren, heute Ruhe', () => {
  const plan = [P('h', '2026-11-03', 90, 'I3'), P('e1', '2026-11-03', 40, 'I1'), P('e2', '2026-11-05', 60, 'I1'), P('e3', '2026-11-06', 60, 'I1')];
  const wellness = [{ date: '2026-11-03', feel: 1, symptoms: ['cough'] }];
  const s = adaptWeek({ plan, wellness, settings: {} }, '2026-11-03');
  const r = s.find((x) => x.id === 'readiness');
  assert.equal(r.level, 'rot');
  const next = applyOps(plan, r.ops);
  assert.equal(next.find((p) => p.id === 'h').date, '2026-11-05');
  assert.ok(!next.find((p) => p.id === 'e2') && !next.find((p) => p.id === 'e1'));
});

test('Verpasste harte Einheit wird nachgeholt, nie direkt neben einer anderen harten', () => {
  const plan = [P('h1', '2026-11-03', 90, 'I3'), P('e', '2026-11-05', 60, 'I1'), P('h2', '2026-11-06', 80, 'I4'), P('e2', '2026-11-07', 60, 'I1'), P('e3', '2026-11-08', 60, 'I1'), P('m', '2026-11-02', 50, 'I1')];
  const s = adaptWeek({ plan, settings: {} }, '2026-11-04');
  const m = s.find((x) => x.id === 'missed-h1');
  const next = applyOps(plan, m.ops);
  assert.equal(next.find((p) => p.id === 'h1').date, '2026-11-08'); // Do und Sa liegen neben Fr (hart)
  assert.ok(s.some((x) => x.id === 'missed-easy'));
});

test('Krank mit Fieber: Einheiten streichen; Wiedereinstieg: kurz und locker', () => {
  const plan = [P('h', '2026-11-04', 90, 'I3'), P('e', '2026-11-05', 90, 'I1')];
  const ill = adaptWeek({ plan, health: [{ id: 'x', type: 'ill', start: '2026-11-02', systemic: true }], settings: {} }, '2026-11-03');
  assert.equal(ill[0].id, 'ill');
  assert.equal(applyOps(plan, ill[0].ops).length, 0);
  const back = adaptWeek({ plan, health: [{ id: 'x', type: 'ill', start: '2026-10-28', end: '2026-11-01' }], settings: {} }, '2026-11-03');
  assert.equal(back[0].id, 'return');
  const n = applyOps(plan, back[0].ops);
  assert.ok(n.every((p) => p.zone === 'I1' && p.minutes <= 90));
});

test('Zu wenig Zeit wegen Uni: lockere kürzen, harte verschieben', () => {
  const plan = [P('h', '2026-11-04', 100, 'I3'), P('e', '2026-11-02', 150, 'I1'), P('x', '2026-11-07', 120, 'I1')];
  const s = adaptWeek({ plan, settings: { schedule } }, '2026-11-02');
  const all = s.flatMap((x) => x.ops);
  const next = applyOps(plan, all);
  assert.ok(next.find((p) => p.id === 'e').minutes <= 255);
  assert.notEqual(next.find((p) => p.id === 'h').date, '2026-11-04');
});
