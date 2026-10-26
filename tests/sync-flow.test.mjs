// Kompletter Abgleich gegen eine nachgebaute Schnittstelle (fängt Fehler, die erst ab der zweiten Einheit auftreten).
import test from 'node:test';
import assert from 'node:assert/strict';

test('Concept2-Abgleich mit mehreren Einheiten läuft ohne Fehler durch', async () => {
  const results = [1, 2, 3].map((k) => ({ id: k, date_utc: `2026-10-0${k} 07:00:00`, type: 'skierg', workout_type: k === 2 ? 'VariableInterval' : 'JustRow', time: 18000, distance: 5000, stroke_data: true, heart_rate: { average: 150, max: 165 } }));
  globalThis.fetch = async (url) => {
    const path = new URL(url, 'http://x').searchParams.get('path') || '';
    const body = path.includes('/strokes') ? { data: Array.from({ length: 200 }, (_, i) => ({ t: i * 20, p: 1250, hr: 150 })) }
      : /results\/\d+$/.test(path.split('?')[0]) ? { data: { workout: { intervals: [{ time: 9000, distance: 2500, rest_time: 600 }, { time: 9000, distance: 2500 }] } } }
        : { data: results, meta: { pagination: { total_pages: 1 } } };
    return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  const { update, getData } = await import('../src/lib/store.js');
  const { syncAll } = await import('../src/lib/sync.js');
  update((d) => ({ ...d, settings: { hrMax: 196, hrRest: 42, lthr: 172, ftpSkierg: 230, timezone: 'Europe/Berlin' }, connections: { concept2: { access_token: 't' } } }));
  const res = await syncAll();
  assert.equal(res.concept2.error, undefined, res.concept2.error);
  assert.equal(res.concept2.added, 3);
  const acts = getData().activities;
  assert.equal(acts.length, 3);
  assert.equal(acts.find((a) => a.externalId === '2').laps.length, 2);
  assert.ok(acts.every((a) => a.load > 0));
});

test('„Neu laden“ behält vorhandene Einheiten, wenn die Schnittstelle mittendrin ausfällt', async () => {
  const { update, getData } = await import('../src/lib/store.js');
  const { reloadConcept2 } = await import('../src/lib/sync.js');
  update((d) => ({ ...d, connections: { concept2: { access_token: 't' } } }));
  const before = getData().activities.filter((a) => a.source === 'concept2');
  assert.ok(before.length > 0);
  update((d) => ({ ...d, activities: d.activities.map((a, i) => (i === 0 ? { ...a, notes: 'gut gelaufen' } : a)) }));
  let calls = 0;
  globalThis.fetch = async () => {
    if (++calls > 2) return new Response('kaputt', { status: 500 });
    return new Response(JSON.stringify({ data: [{ id: 1, date_utc: '2026-10-01 07:00:00', type: 'skierg', time: 18000, distance: 5000 }], meta: { pagination: { total_pages: 3 } } }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  await assert.rejects(reloadConcept2());
  const after = getData().activities.filter((a) => a.source === 'concept2');
  assert.equal(after.length, before.length);
  assert.equal(after[0].notes, 'gut gelaufen');
});

test('Concept2-Namen: eigener Name, Kommentar oder Aufbau wie im Logbuch', async () => {
  const { concept2Title, isAutoC2Title } = await import('../src/lib/laps.js');
  assert.equal(concept2Title({ name: 'Double Threshold AM' }), 'Double Threshold AM');
  assert.equal(concept2Title({ comments: 'Schwelle 5x6' }), 'Schwelle 5x6');
  assert.equal(concept2Title({ workout_type: 'FixedTimeSplits', time: 18000 }), '30:00');
  assert.equal(concept2Title({ workout_type: 'FixedDistanceSplits', distance: 10000 }), '10.000m');
  const iv = (n, time, rest) => Array.from({ length: n }, () => ({ type: 'time', time, distance: 1500, rest_time: rest }));
  assert.equal(concept2Title({ workout_type: 'FixedTimeInterval' }, { intervals: [...iv(4, 3600, 600), { type: 'time', time: 3600, distance: 1500, rest_time: 0 }] }), '5×6:00/1:00r');
  assert.equal(concept2Title({ workout_type: 'VariableInterval' }, { intervals: [{ type: 'distance', distance: 2000, time: 4800, rest_time: 1200 }, { type: 'time', time: 6000, distance: 2400, rest_time: 0 }] }), '2.000m/2:00r, 10:00');
  assert.equal(concept2Title({ workout_type: 'JustRow' }), '');
  assert.ok(isAutoC2Title('VariableInterval') && isAutoC2Title('') && !isAutoC2Title('Meine Einheit'));
});
