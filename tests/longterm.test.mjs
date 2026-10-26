import test from 'node:test';
import assert from 'node:assert/strict';
import { histogram, secondsBetween, powerHrTable, seriesStats } from '../src/lib/metrics.js';
import { hrAtPower, powerAtHr, tolerance, seasonStart, seasonCumulative, seasonTable, bandSeconds } from '../src/lib/longterm.js';
import { addDays } from '../src/lib/metrics.js';

test('Verteilung und Stunden in frei gewähltem Bereich', () => {
  const h = histogram([140, 141, 144, 145, 150, 0, null], 5);
  assert.deepEqual(h, { 140: 3, 145: 1, 150: 1 });
  assert.equal(secondsBetween(h, 140, 150, 5), 4);
  assert.equal(secondsBetween(h, 142.5, 145, 5), 1.5); // anteilig
});

test('Puls bei Leistung: Aufwärmen ausgelassen, Bereiche getrennt', () => {
  const n = 3600, power = [], hr = [];
  for (let i = 0; i < n; i++) { power.push(i < 1800 ? 200 : 250); hr.push(i < 600 ? 100 : i < 1800 ? 140 : 155); }
  const tab = powerHrTable(power, hr);
  const at200 = tab.find((r) => r[0] === 200), at250 = tab.find((r) => r[0] === 250);
  assert.equal(Math.round(at200[1]), 140); // Aufwärmpuls 100 ignoriert
  assert.equal(Math.round(at250[1]), 155);
  const a = { powerHr: tab };
  assert.equal(hrAtPower(a, 205), 140);
  assert.equal(powerAtHr(a, 154), 250);
  assert.equal(hrAtPower(a, 400), null);
  const st = seriesStats({ power, hr }, { ftp: 250, powerSport: true });
  assert.ok(st.hrHist && st.powerHist && st.powerHr.length);
  assert.equal(Math.round(bandSeconds(st, 'power', 240, 260)), 1800);
});

test('Belastbarkeit: langer Rückblick, Sprung wird erkannt', () => {
  const acts = [];
  const t = '2026-10-25';
  for (let i = 400; i >= 8; i--) acts.push({ date: addDays(t, -i), load: 80 });
  for (let i = 6; i >= 0; i--) acts.push({ date: addDays(t, -i), load: 160 });
  const r = tolerance(acts, t, 365);
  assert.equal(Math.round(r.now.acute), 1120);
  assert.ok(r.now.ratio > 1.5);
  assert.equal(r.status.tone, 'bad');
  assert.ok(Math.abs(r.now.capacity - 560) < 1); // 4 Wochen à 7×80
  assert.ok(r.weeks.length >= 52);
  const all = tolerance(acts, t, 100000);
  assert.ok(all.now.chronic < r.now.chronic + 1);
});

test('Saisons ab 1. Mai', () => {
  assert.equal(seasonStart('2026-04-30'), '2025-05-01');
  assert.equal(seasonStart('2026-05-01'), '2026-05-01');
  const acts = [{ date: '2025-05-02', durationS: 3600 }, { date: '2025-12-01', durationS: 7200, zones: { I1: 3600, I2: 3600 } }, { date: '2026-05-03', durationS: 3600 }];
  const cum = seasonCumulative(acts, '2026-05-10');
  assert.equal(cum.length, 2);
  assert.equal(cum[0].values.at(-1), 3);
  assert.equal(cum[1].values[1], 1);
  assert.equal(cum[1].values[2], null); // Zukunft der laufenden Saison leer
  const tab = seasonTable(acts);
  assert.equal(tab[1].hours, 3);
  assert.equal(tab[1].zones.I1, 1);
});
