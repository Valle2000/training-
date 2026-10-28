// Wahoo-Fahrt mit Watt, die schon von der Polar-Uhr (nur Puls) importiert war → zusammenführen.
import test from 'node:test';
import assert from 'node:assert/strict';

test('Wahoo-Watt + Polar-Puls werden zu einer Einheit', async () => {
  const store = await import('../src/lib/store.js');
  const { mergeIntoExisting } = await import('../src/lib/sync.js');
  const { buildActivity } = await import('../src/lib/activities.js');
  const settings = { hrMax: 196, hrRest: 42, lthr: 172, ftp: 300 };
  const n = 3600;
  const polar = buildActivity({ start: '2026-08-01T08:00:00Z', sport: 'bike', series: { hr: Array(n).fill(140) }, source: 'upload' }, settings, { id: 'p1' });
  polar.activity.notes = 'Beine schwer';
  store.update((d) => ({ ...d, settings, activities: [polar.activity] }));
  // Ohne IndexedDB (Node) liefert getLocalSeries null → Puls kommt dann aus der Zusammenfassung.
  const raw = { start: '2026-08-01T08:00:10Z', sport: 'bike', elapsedS: n, series: { power: Array(n).fill(220), hr: Array(n).fill(null) }, source: 'wahoo', externalId: 'w1', title: 'Grundlage' };
  assert.equal(await mergeIntoExisting(raw, polar.activity), true);
  const a = store.getData().activities;
  assert.equal(a.length, 1);
  assert.equal(a[0].id, 'p1');
  assert.equal(a[0].source, 'wahoo');
  assert.equal(a[0].avgPower, 220);
  assert.equal(a[0].avgHr, 140);
  assert.equal(a[0].notes, 'Beine schwer');
  assert.ok(a[0].powerCurve && a[0].load > 0);
  // Schon mit Watt vorhanden → nicht anfassen
  assert.equal(await mergeIntoExisting(raw, a[0]), false);
});
