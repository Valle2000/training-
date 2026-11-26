import test from 'node:test';
import assert from 'node:assert/strict';
import { planForEdit, applyPlanEdits } from '../src/lib/plan-edit.js';

const plan = [
  { id: 'a', date: '2026-11-26', title: 'Schwelle 5x6', sport: 'skierg', minutes: 75, zone: 'I3', source: 'wizard' },
  { id: 'b', date: '2026-11-27', title: 'Locker', sport: 'run', minutes: 60, zone: 'I1', source: 'wizard' },
  { id: 'c', date: '2026-11-24', title: 'Vorbei', sport: 'run', minutes: 60, zone: 'I1' },
  { id: 'd', date: '2026-11-28', title: 'Trainerin', sport: 'xc_skate', minutes: 90, zone: 'I1', source: 'trainingpeaks', done: true },
];

test('Plan für die KI: nur ab heute, mit Quelle', () => {
  const p = planForEdit(plan, '2026-11-26');
  assert.deepEqual(p.map((x) => x.id), ['a', 'b', 'd']);
  assert.equal(p[2].quelle, 'trainingpeaks'); assert.equal(p[2].erledigt, true);
});

test('Änderungen anwenden: verschieben, löschen, neu – mit Schutz', () => {
  let n = 0;
  const r = applyPlanEdits(plan, [
    { aktion: 'aendern', id: 'a', datum: '2026-11-27', titel: 'Schwelle 5x6', sport: 'skierg', minuten: 75, zone: 'I3', beschreibung: '' },
    { aktion: 'loeschen', id: 'b', datum: '2026-11-27', titel: 'Locker', sport: 'run', minuten: 60, zone: 'I1', beschreibung: '' },
    { aktion: 'neu', id: null, datum: '2026-11-29', titel: 'Locker Rad', sport: 'bike', minuten: 90, zone: 'I1', beschreibung: 'flach' },
    { aktion: 'loeschen', id: 'c', datum: '2026-11-24', titel: 'Vorbei', sport: 'run', minuten: 60, zone: 'I1', beschreibung: '' },
    { aktion: 'aendern', id: 'd', datum: '2026-11-28', titel: 'x', sport: 'run', minuten: 10, zone: 'I1', beschreibung: '' },
    { aktion: 'aendern', id: 'zzz', datum: '2026-11-28', titel: 'x', sport: 'run', minuten: 10, zone: 'I1', beschreibung: '' },
    { aktion: 'neu', id: null, datum: '2026-11-20', titel: 'alt', sport: 'run', minuten: 30, zone: 'I1', beschreibung: '' },
  ], () => `n${++n}`, '2026-11-26');
  assert.equal(r.changed, 1); assert.equal(r.removed, 1); assert.equal(r.added, 1); assert.equal(r.skipped.length, 4);
  assert.equal(r.plan.find((p) => p.id === 'a').date, '2026-11-27');
  assert.ok(!r.plan.find((p) => p.id === 'b'));
  assert.ok(r.plan.find((p) => p.id === 'c'), 'Vergangenes bleibt');
  assert.equal(r.plan.find((p) => p.id === 'd').title, 'Trainerin', 'Erledigtes bleibt');
  const neu = r.plan.find((p) => p.id === 'n1');
  assert.equal(neu.source, 'coach'); assert.ok(neu.load > 0);
});
