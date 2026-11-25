import test from 'node:test';
import assert from 'node:assert/strict';
import { needsFitRepair, mergeRepaired } from '../src/lib/sync.js';

test('Polar-Einheit ohne Pulsverlauf wird nachgeladen (höchstens 3 Versuche)', () => {
  const ex = { id: 1, heart_rate: { average: 150 } };
  assert.equal(needsFitRepair({ hasSeries: false, avgHr: 150 }, ex), true);
  assert.equal(needsFitRepair({ hasSeries: true }, ex), false);
  assert.equal(needsFitRepair({ hasSeries: false, fitRetries: 3 }, ex), false);
  assert.equal(needsFitRepair({ hasSeries: false, fitOk: true }, ex), false, 'FIT gelesen, Uhr hatte keinen Puls');
  assert.equal(needsFitRepair({ hasSeries: false }, { id: 2 }), false, 'ohne Puls in der Zusammenfassung kein Nachladen');
});

test('Beim Ergänzen bleiben eigene Angaben erhalten', () => {
  const fresh = { id: 'a', sport: 'other', title: 'Laufen', notes: '', rpe: null, hasSeries: true };
  const old = { id: 'a', sport: 'run', title: 'Freiburg Probelauf', notes: 'gute Beine', rpe: 7, feel: 'strong', polarSportId: '1' };
  const m = mergeRepaired(fresh, old);
  assert.equal(m.sport, 'run'); assert.equal(m.title, 'Freiburg Probelauf'); assert.equal(m.notes, 'gute Beine');
  assert.equal(m.rpe, 7); assert.equal(m.feel, 'strong'); assert.equal(m.fitOk, true); assert.equal(m.hasSeries, true);
});

test('Abgleich: FIT erst nicht abrufbar (503), beim nächsten Abgleich mit Puls ergänzt', async () => {
  const { Encoder, Profile } = await import('@garmin/fitsdk');
  const start = new Date('2026-11-20T07:00:00Z');
  const enc = new Encoder();
  enc.onMesg(Profile.MesgNum.FILE_ID, { type: 'activity', manufacturer: 'development', timeCreated: start });
  for (let i = 0; i < 600; i++) enc.onMesg(Profile.MesgNum.RECORD, { timestamp: new Date(start.getTime() + i * 1000), heartRate: 140 + (i % 10), distance: i * 3 });
  enc.onMesg(Profile.MesgNum.LAP, { timestamp: new Date(start.getTime() + 600000), startTime: start, totalElapsedTime: 600, totalTimerTime: 600, totalDistance: 1800 });
  enc.onMesg(Profile.MesgNum.SESSION, { timestamp: new Date(start.getTime() + 600000), startTime: start, totalElapsedTime: 600, totalTimerTime: 600, totalDistance: 1800, sport: 'running', subSport: 'generic', avgHeartRate: 145, maxHeartRate: 149 });
  enc.onMesg(Profile.MesgNum.ACTIVITY, { timestamp: new Date(start.getTime() + 600000), numSessions: 1, totalTimerTime: 600 });
  const fit = enc.close();

  let fitDown = true;
  const ex = { id: 777, start_time: '2026-11-20T08:00:00', start_time_utc_offset: 60, duration: 'PT10M', distance: 1800, sport: 'RUNNING', detailed_sport_info: 'RUNNING', heart_rate: { average: 145, maximum: 149 } };
  globalThis.fetch = async (url) => {
    const path = new URL(url, 'http://x').searchParams.get('path') || '';
    if (path.endsWith('/fit')) return fitDown ? new Response('down', { status: 503 }) : new Response(fit, { status: 200 });
    if (path === '/v3/exercises') return new Response(JSON.stringify([ex]), { status: 200, headers: { 'content-type': 'application/json' } });
    return new Response('null', { status: 404 });
  };
  const { update, getData } = await import('../src/lib/store.js');
  const { syncAll } = await import('../src/lib/sync.js');
  update((d) => ({ ...d, activities: [], settings: { hrMax: 196, hrRest: 42, lthr: 172, timezone: 'Europe/Berlin' }, connections: { polar: { access_token: 't' } } }));
  const r1 = await syncAll();
  assert.equal(r1.polar.added, 1, r1.polar.error);
  let a = getData().activities.find((x) => x.externalId === '777');
  assert.equal(a.hasSeries, false);
  update((d) => ({ ...d, activities: d.activities.map((x) => (x.id === a.id ? { ...x, notes: 'Probelauf', rpe: 6 } : x)) }));
  fitDown = false;
  const r2 = await syncAll();
  assert.equal(r2.polar.refreshed, 1);
  a = getData().activities.find((x) => x.externalId === '777');
  assert.equal(a.hasSeries, true);
  assert.ok(a.zones, 'Zonen aus dem Pulsverlauf');
  assert.equal(a.notes, 'Probelauf'); assert.equal(a.rpe, 6);
  const r3 = await syncAll();
  assert.equal(r3.polar.refreshed, undefined, 'kein erneutes Nachladen');
});
