// Dauer wie bei Polar/Strava: Gerätezeit, sonst Gesamtzeit der Datei (Aufzeichnungslücken zählen nicht als Pause).
import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluate } from '../src/lib/activities.js';

const settings = { hrMax: 190, hrRest: 50, lthr: 170 };
const series = { hr: Array(3000).fill(140) };

test('Gerätezeit hat Vorrang', () => {
  assert.equal(evaluate({ sport: 'run', series, timerS: 3150, elapsedS: 3400 }, settings).durationS, 3150);
});
test('Ohne Gerätezeit: Gesamtzeit der Datei statt nur aufgezeichneter Sekunden', () => {
  assert.equal(evaluate({ sport: 'run', series, elapsedS: 3300 }, settings).durationS, 3300);
});
test('Sehr lange Unterbrechung (Einkehr): aufgezeichnete Zeit', () => {
  assert.equal(evaluate({ sport: 'run', series, elapsedS: 6000 }, settings).durationS, 3000);
});
test('Concept2 und manuell', () => {
  assert.equal(evaluate({ sport: 'skierg', source: 'concept2', series, elapsedS: 3300 }, settings).durationS, 3000);
  assert.equal(evaluate({ sport: 'run', durationS: 2700, elapsedS: 2700 }, settings).durationS, 2700);
});
