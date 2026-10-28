// KI-Modelle: Kosten aus Token-Zahlen und Schätzung pro Anfrage.
import test from 'node:test';
import assert from 'node:assert/strict';
import { costOf, estimateCost, modelById, fmtUsd } from '../src/lib/ai-models.js';

test('Kosten aus Tokens: Opus 5.5 $4/$20, Cache günstiger', () => {
  assert.equal(costOf('claude-opus-5-5', { input: 20000, output: 10000 }), 0.28);
  assert.equal(costOf('claude-sonnet-5-5', { input: 20000, output: 10000 }), 0.14);
  assert.ok(costOf('claude-opus-5-5', { cacheRead: 20000, output: 10000 }) < 0.21);
  assert.equal(modelById('unbekannt').id, 'claude-opus-5-5');
  assert.ok(estimateCost('coach', 'claude-haiku-5-5', 'high') < estimateCost('coach', 'claude-opus-5-5', 'low'));
  assert.equal(fmtUsd(0.32), '32 Cent');
  assert.equal(fmtUsd(1.5), '1,5 $');
});
