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

test('Rad ohne Gerätezeit: Stopp über 2 min zählt nicht, kurzer Stopp (Ampel) schon', () => {
  const lang = [...Array(600).fill(7), ...Array(300).fill(0), ...Array(300).fill(6)];
  assert.equal(evaluate({ sport: 'bike', series: { hr: Array(1200).fill(140), speed: lang }, elapsedS: 1200 }, settings).durationS, 900);
  const kurz = [...Array(600).fill(7), ...Array(60).fill(0), ...Array(300).fill(6)];
  assert.equal(evaluate({ sport: 'bike', series: { hr: Array(960).fill(140), speed: kurz }, elapsedS: 960 }, settings).durationS, 960);
});
