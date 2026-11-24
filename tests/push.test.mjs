// Text des Wochenrückblicks für die Mitteilung.
import test from 'node:test';
import assert from 'node:assert/strict';
import { weekSummaryText } from '../server/push.mjs';

test('Wochenrückblick: Stunden, Einheiten, Belastung, Vorwoche, nächstes Rennen', () => {
  const t = weekSummaryText({
    week: [{ durationS: 3600 * 2, load: 120 }, { durationS: 3600 * 1.5, load: 90 }],
    prev: [{ durationS: 3600 * 4, load: 200 }],
    races: [{ date: '2026-12-19', name: 'Gastein Classics ' }, { date: '2026-11-01', name: 'Vorbei' }],
    today: '2026-11-29',
  });
  assert.equal(t, 'Diese Woche: 3,5 h in 2 Einheiten · Belastung 210 · Vorwoche 4 h. Nächstes Rennen: Gastein Classics in 20 Tagen.');
});

test('Wochenrückblick ohne Einheiten', () => {
  assert.equal(weekSummaryText({ week: [], prev: [], races: [], today: '2026-11-29' }), 'Diese Woche ist noch keine Einheit eingetragen.');
});
