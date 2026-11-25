import test from 'node:test';
import assert from 'node:assert/strict';
import { aiToPlan } from '../src/lib/plan-import.js';
import { mergeFeedPlan } from '../src/lib/ical.js';

test('KI-Antwort → Plan der Trainerin (Vorrang wie TrainingPeaks)', () => {
  const items = aiToPlan([
    { datum: '2026-12-03', titel: 'XC-Ski 3x12 L4', sport: 'xc_skate', minuten: 95, dauerGeschaetzt: false, zone: 'I4', beschreibung: '20 ein, 3x12 L4' },
    { datum: '2026-12-01', titel: 'Kraft', sport: 'strength', minuten: 60, dauerGeschaetzt: false, zone: 'Kraft', beschreibung: '' },
    { datum: 'Mo', titel: 'kaputt', sport: 'run', minuten: 30, zone: null, beschreibung: '' },
    { datum: '2026-12-02', titel: 'Ruhe', sport: 'rest', minuten: 0, zone: null, beschreibung: '' },
    { datum: '2026-12-04', titel: '', sport: 'unbekannt', minuten: 9999, zone: 'X', beschreibung: '' },
  ]);
  assert.deepEqual(items.map((x) => x.date), ['2026-12-01', '2026-12-03', '2026-12-04']);
  assert.ok(items.every((x) => x.source === 'trainingpeaks'));
  assert.equal(items[2].sport, 'other'); assert.equal(items[2].minutes, 600); assert.equal(items[2].zone, null);
  assert.ok(items[1].load > 0);
  let n = 0;
  const r = mergeFeedPlan([{ id: 'w', date: '2026-12-02', source: 'wizard' }], items, () => `n${++n}`);
  assert.equal(r.replacedOwn, 1); assert.equal(r.added, 3);
});
