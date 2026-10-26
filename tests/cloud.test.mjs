import test from 'node:test';
import assert from 'node:assert/strict';
import { planSync, applyRows, localRecords, fingerprint } from '../src/lib/cloud.js';

const base = { activities: [{ id: 'a1', load: 50 }, { id: 'a2', load: 60 }], wellness: [{ date: '2026-10-01', hrv: 70 }], settings: { ftp: 300 }, connections: {}, food: null };
const fpOf = (d) => Object.fromEntries(Object.entries(localRecords(d)).map(([k, v]) => [k, fingerprint(v.data)]));

test('Erster Abgleich: alles hochladen, leere Singletons nicht', () => {
  const { push } = planSync(base, {}, []);
  assert.deepEqual(push.map((p) => `${p.collection}:${p.id}`).sort(), ['activities:a1', 'activities:a2', 'singleton:settings', 'wellness:2026-10-01']);
});

test('Nur Server geändert → übernehmen; nur lokal geändert → hochladen', () => {
  const fp = fpOf(base);
  const local = { ...base, activities: [{ id: 'a1', load: 55 }, base.activities[1]] };
  const remote = [{ collection: 'activities', id: 'a2', data: { id: 'a2', load: 99 }, deleted: false }];
  const { apply, push } = planSync(local, fp, remote);
  assert.equal(apply.length, 1);
  assert.deepEqual(push.map((p) => p.id), ['a1']);
  assert.equal(applyRows(local, apply).activities.find((a) => a.id === 'a2').load, 99);
});

test('Beide geändert → Gerät gewinnt', () => {
  const fp = fpOf(base);
  const local = { ...base, activities: [{ id: 'a1', load: 55 }, base.activities[1]] };
  const { apply, push } = planSync(local, fp, [{ collection: 'activities', id: 'a1', data: { id: 'a1', load: 77 }, deleted: false }]);
  assert.equal(apply.length, 0);
  assert.equal(push[0].data.load, 55);
});

test('Lokal gelöscht → Löschung hochladen, Echo bringt es nicht zurück', () => {
  const fp = fpOf(base);
  const local = { ...base, activities: [base.activities[0]] };
  const echo = [{ collection: 'activities', id: 'a2', data: base.activities[1], deleted: false }];
  const { apply, push } = planSync(local, fp, echo);
  assert.equal(apply.length, 0);
  assert.deepEqual(push, [{ collection: 'activities', id: 'a2', data: null, deleted: true }]);
});

test('Auf anderem Gerät gelöscht → lokal entfernen', () => {
  const fp = fpOf(base);
  const { apply, push, nextFp } = planSync(base, fp, [{ collection: 'activities', id: 'a1', data: null, deleted: true }]);
  assert.equal(push.length, 0);
  assert.equal(nextFp['activities:a1'], 'deleted');
  assert.deepEqual(applyRows(base, apply).activities.map((a) => a.id), ['a2']);
});

test('Singletons und Wellness nach Datum', () => {
  const next = applyRows(base, [{ collection: 'singleton', id: 'settings', data: { ftp: 310 }, deleted: false }, { collection: 'wellness', id: '2026-09-30', data: { date: '2026-09-30', hrv: 66 }, deleted: false }]);
  assert.equal(next.settings.ftp, 310);
  assert.deepEqual(next.wellness.map((w) => w.date), ['2026-09-30', '2026-10-01']);
});
