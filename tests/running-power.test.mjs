import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runPower } from '../src/lib/running-power.js';

test('Flach: schneller ist mehr Leistung', () => {
  assert.ok(runPower(5.95, 0, 75) > runPower(2.72, 0, 75) * 2);
});
test('Bergauf kostet mehr als flach bei gleichem Tempo', () => {
  assert.ok(runPower(3, 5, 75) > runPower(3, 0, 75));
});
test('Bergab kostet weniger als flach bei gleichem Tempo', () => {
  assert.ok(runPower(3, -5, 75) < runPower(3, 0, 75));
});
