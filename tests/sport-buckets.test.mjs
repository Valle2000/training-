import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tempoGroup } from '../src/lib/sport-buckets.js';

test('Tempo-Gruppen nach Tempo und Jahreszeit', () => {
  assert.equal(tempoGroup({ distanceM: 20000, durationS: 4800, start: '2025-01-10T09:00:00Z' }), '5–17 km/h|Winter');
  assert.equal(tempoGroup({ distanceM: 20000, durationS: 4800, start: '2025-06-10T09:00:00Z' }), '5–17 km/h|Sommer');
  assert.equal(tempoGroup({ distanceM: 40000, durationS: 4800, start: '2025-06-10T09:00:00Z' }), 'über 17 km/h|Sommer');
  assert.equal(tempoGroup({ distanceM: 1000, durationS: 4800, start: '2025-06-10T09:00:00Z' }), 'unter 5 km/h|Sommer');
  assert.equal(tempoGroup({ distanceM: null, durationS: 3600, start: '2025-02-01T09:00:00Z' }), 'ohne Distanz|Winter');
  assert.equal(tempoGroup({ distanceM: 1000, durationS: 120, start: '2025-02-01T09:00:00Z' }), null);
});
