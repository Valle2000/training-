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
