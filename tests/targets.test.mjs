// Konkrete Zielwerte für geplante Einheiten.
import test from 'node:test';
import assert from 'node:assert/strict';
import { planTargets, parsePace } from '../src/lib/targets.js';

const settings = { hrMax: 190, thresholdPace: '3:35', ftp: 300, ftpSkierg: 260 };

test('Laufen: Tempo aus der Schwellenpace und Puls aus dem Maximalpuls', () => {
  assert.equal(parsePace('3:35'), 215);
  assert.equal(planTargets({ sport: 'run', zone: 'I3' }, settings), '3:35–3:44 min/km · 156–165 bpm');
  assert.match(planTargets({ sport: 'run', zone: 'I1' }, settings), /^langsamer als 4:29 min\/km · unter 137 bpm$/);
  assert.match(planTargets({ sport: 'run', zone: 'I4', keyId: 'run_mp3x15' }, settings), /^3:48–3:54 min\/km/);
});

test('Rad und SkiErg: Watt aus der FTP der Sportart', () => {
  assert.match(planTargets({ sport: 'bike', zone: 'I3', keyId: 'bike_sweet2x15' }, settings), /^264–282 W/);
  assert.match(planTargets({ sport: 'bike', zone: 'I3', keyId: 'bike_overunder' }, settings), /^315 \/ 285 W im Wechsel/);
  assert.match(planTargets({ sport: 'skierg', zone: 'I3' }, settings), /^234–260 W/);
});

test('Ohne Angaben oder ohne Zone kein Ziel', () => {
  assert.equal(planTargets({ sport: 'run', zone: 'I3' }, {}), null);
  assert.equal(planTargets({ sport: 'strength', zone: 'Kraft' }, settings), null);
});
