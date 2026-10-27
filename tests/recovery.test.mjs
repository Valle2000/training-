// HRV-Normalbereich, Monotonie/Strain und Belastungssprung im Morgen-Check.
import test from 'node:test';
import assert from 'node:assert/strict';
import { hrvStatus, loadStatus, readinessFor } from '../src/lib/readiness.js';
import { addDays } from '../src/lib/metrics.js';

const t = '2026-11-01';
const days = (n, f) => Array.from({ length: n }, (_, i) => f(addDays(t, -n + 1 + i), i));

test('HRV: eine schlechte Nacht ist kein Trend, ein anhaltender Abfall schon', () => {
  const base = days(60, (date, i) => ({ date, hrv: [62, 78, 70, 66, 75, 72, 68][i % 7] }));
  const oneBad = base.map((w) => (w.date === t ? { ...w, hrv: 50 } : w));
  const s1 = hrvStatus(t, oneBad);
  assert.equal(s1.status, 'normal');
  const r1 = readinessFor(t, oneBad);
  assert.notEqual(r1.level, 'rot');
  const drop = base.map((w) => (w.date > addDays(t, -7) ? { ...w, hrv: 56 } : w));
  const s2 = hrvStatus(t, drop);
  assert.equal(s2.status, 'low');
  assert.ok(s2.low > 60 && s2.high < 80);
  const r2 = readinessFor(t, drop);
  assert.ok(r2.reasons.some((x) => x.includes('Normalbereich')));
  assert.ok(r2.level !== 'gruen');
});

test('Monotonie/Strain: jeden Tag gleich viel ist eintönig, Belastungssprung erkannt', () => {
  const varied = days(100, (date, i) => ({ date, load: [60, 120, 0, 80, 150, 40, 0][i % 7] }));
  const v = loadStatus(t, varied);
  assert.ok(v.monotony < 2);
  const mono = [...varied.filter((a) => a.date <= addDays(t, -7)), ...days(7, (date) => ({ date, load: 140 }))];
  const m = loadStatus(t, mono);
  assert.equal(m.monotony, 10);
  assert.ok(m.strainHigh);
  assert.ok(m.acwr > 1.5);
  const r = readinessFor(addDays(t, 1), [], null, mono);
  assert.ok(r.reasons.some((x) => x.includes('eintönig')) && r.reasons.some((x) => x.includes('Belastungssprung')));
  assert.equal(loadStatus(t, []), null);
});
