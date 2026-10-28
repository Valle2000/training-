// Automatische Schwellen-Vorschläge.
import test from 'node:test';
import assert from 'node:assert/strict';
import { suggestThresholds } from '../src/lib/thresholds.js';

const t = '2026-11-01';
test('Maximalpuls ohne Ausreißer, Schwellenpuls aus 30-min-Bestwert, FTP aus Kurve', () => {
  const activities = [
    { date: '2026-10-01', maxHr: 225, sport: 'run' }, // Ausreißer
    { date: '2026-09-01', maxHr: 199, sport: 'run', hrCurve: { 1800: 178 } },
    { date: '2026-08-01', maxHr: 197, sport: 'run' },
    { date: '2026-10-10', sport: 'skierg', powerCurve: { 1200: 260 } },
  ];
  const s = suggestThresholds({ activities, settings: { hrMax: 194, lthr: 172 } }, t);
  const by = Object.fromEntries(s.map((x) => [x.key, x]));
  assert.equal(by.hrMax.value, 199);
  assert.equal(by.lthr.value, 178);
  assert.equal(by.ftpSkierg.value, 247);
  assert.ok(!by.ftp);
});

test('Laktattest hat Vorrang, kleine Abweichungen werden nicht vorgeschlagen', () => {
  const steps = [[150, 1.1, 130], [175, 1.2, 140], [200, 1.4, 150], [225, 1.9, 160], [250, 2.8, 168], [275, 4.5, 176], [300, 7.2, 183]].map(([load, lactate, hr]) => ({ load, lactate, hr }));
  const s = suggestThresholds({ lactateTests: [{ id: 'l', date: '2026-10-20', steps }], settings: { lthr: 150 } }, t);
  const lt = s.find((x) => x.key === 'lthr');
  assert.ok(lt && lt.value > 160 && lt.value < 180, String(lt?.value));
  assert.equal(suggestThresholds({ activities: [{ date: '2026-10-01', hrCurve: { 1800: 173 } }], settings: { lthr: 172 } }, t).length, 0);
});
