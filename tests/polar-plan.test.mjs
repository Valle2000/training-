// Polar-Export: geplante Einheiten landen im Kalender, unbekannte Sportnummern lassen sich zuordnen.
import test from 'node:test';
import assert from 'node:assert/strict';
import { zipSync, strToU8 } from 'fflate';

test('Geplante Polar-Einheiten → Kalender, Sportnummer zuordnen', async () => {
  const { importFiles, mapPolarSport } = await import('../src/lib/sync.js');
  const { getData } = await import('../src/lib/store.js');
  const plan = { startTime: '2026-08-12T09:00:00', name: 'DT vormittag SkiErg 3x20min', durationMillis: 6300000, timezoneOffsetMinutes: 120, sport: { id: '83' }, exercises: [{ startTime: '2026-08-12T09:00:00', durationMillis: 6300000, sport: { id: '83' } }] };
  const rec = { startTime: '2026-08-12T17:00:00', name: '', deviceId: 'X', durationMillis: 600000, distanceMeters: 2000, timezoneOffsetMinutes: 120, sport: { id: '10' },
    exercises: [{ startTime: '2026-08-12T17:00:00', durationMillis: 600000, distanceMeters: 2000, sport: { id: '10' }, samples: { samples: [{ type: 'HEART_RATE', intervalMillis: 1000, values: Array(600).fill(140) }] } }] };
  const zip = zipSync({ 'x/training-session_a.json': strToU8(JSON.stringify(plan)), 'x/training-session_b.json': strToU8(JSON.stringify(rec)) });
  const r = await importFiles([new File([zip], 'p.zip')], () => {});
  assert.equal(r.added, 1);
  assert.equal(r.planned, 1);
  assert.equal(r.dup, 0);
  const d = getData();
  assert.equal(d.activities.length, 1);
  assert.equal(d.plan[0].title, 'DT vormittag SkiErg 3x20min');
  assert.equal(d.plan[0].minutes, 105);
  assert.equal(d.activities[0].sport, 'other');
  await mapPolarSport('10', 'rollerski_skate');
  assert.equal(getData().activities[0].sport, 'rollerski_skate');
  const r2 = await importFiles([new File([zip], 'p.zip')], () => {});
  assert.equal(r2.planned, 0); // Plan nicht doppelt
  assert.equal(getData().plan.length, 1);
});
