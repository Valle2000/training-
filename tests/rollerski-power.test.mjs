import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rollerPower, crrFor } from '../src/lib/rollerski-power.js';

const flat = (n, v) => ({ speed: Array(n).fill(v), alt: Array(n).fill(100) });
const slope = (n, v, g) => ({ speed: Array(n).fill(v), alt: Array.from({ length: n }, (_, i) => 100 + g * v * i) });

test('Rollwiderstand: Mittel aus vorne und hinten', () => {
  assert.equal(crrFor(3, 4), (0.018 + 0.022) / 2);
  assert.equal(crrFor(1, 1), 0.010);
});

test('Flach: 5 m/s, Gewicht 75 kg, Stufe 3/3 ≈ 92 W', () => {
  const r = rollerPower(flat(300, 5), { massKg: 75, front: 3, rear: 3, cdA: 0.35 });
  assert.ok(Math.abs(r.watts - 92) <= 2, `watts ${r.watts}`);
});

test('5 % Steigung bei 5 m/s ≈ 276 W', () => {
  const r = rollerPower(slope(600, 5, 0.05), { massKg: 75, front: 3, rear: 3, cdA: 0.35 });
  assert.ok(Math.abs(r.watts - 276) <= 8, `watts ${r.watts}`);
});

test('Stufe 4 braucht mehr Leistung als Stufe 1', () => {
  const leicht = rollerPower(flat(300, 5), { front: 1, rear: 1 }).watts;
  const schwer = rollerPower(flat(300, 5), { front: 4, rear: 4 }).watts;
  assert.ok(schwer > leicht);
});

test('Stillstand ergibt kein Ergebnis', () => {
  assert.equal(rollerPower({ speed: Array(100).fill(0), alt: Array(100).fill(0) }), null);
});
