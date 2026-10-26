import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeLactate, atLactate } from '../src/lib/lactate.js';
import { readinessFor } from '../src/lib/readiness.js';

// Synthetische Laktatkurve: flach bis ~250 W, dann exponentiell.
const steps = [150, 175, 200, 225, 250, 275, 300, 325].map((w, i) => ({ load: w, hr: 120 + i * 8, lactate: (0.9 + 0.05 * Math.exp((w - 150) / 35)).toFixed(2) }));

test('Laktat: LT1 < LT2, feste Werte interpoliert', () => {
  const r = analyzeLactate(steps);
  assert.ok(r.lt1.load > 175 && r.lt1.load < r.lt2.load, JSON.stringify([r.lt1, r.lt2]));
  assert.ok(r.lt2.load > 250 && r.lt2.load < 325);
  assert.ok(r.at4.load > r.at2.load);
  assert.equal(r.zoneHr.length, 4);
});

test('Laktat: zu wenige Stufen', () => {
  assert.ok(analyzeLactate(steps.slice(0, 3)).error);
  assert.equal(atLactate([{ load: 100, lactate: 1, hr: 120 }, { load: 200, lactate: 3, hr: 160 }], 2).hr, 140);
});

test('Ampel: Fieber ist rot, normaler Tag grün', () => {
  const base = Array.from({ length: 20 }, (_, i) => ({ date: `2026-10-${String(i + 1).padStart(2, '0')}`, hrv: 70 + (i % 3), restHr: 42 }));
  assert.equal(readinessFor('2026-10-21', [...base, { date: '2026-10-21', symptoms: ['fever'], feel: 3 }]).level, 'rot');
  assert.equal(readinessFor('2026-10-21', [...base, { date: '2026-10-21', hrv: 71, restHr: 42, feel: 4 }]).level, 'gruen');
  const low = readinessFor('2026-10-21', [...base, { date: '2026-10-21', hrv: 55, restHr: 48, feel: 3 }]);
  assert.equal(low.level, 'rot');
  assert.ok(low.reasons.length >= 2);
});

test('Zonen aus Laktattest-Grenzen', async () => {
  const { zoneOf } = await import('../src/lib/metrics.js');
  const b = [140, 155, 168, 178];
  assert.equal(zoneOf(130, 196, b), 'I1');
  assert.equal(zoneOf(160, 196, b), 'I3');
  assert.equal(zoneOf(185, 196, b), 'I5');
  assert.equal(zoneOf(160, 196), 'I2'); // ohne Test: % HFmax
});

test('Saison: Phasen rückwärts vom A-Rennen', async () => {
  const { seasonPlan } = await import('../src/lib/season.js');
  const w = seasonPlan([{ date: '2027-03-07', priority: 'A', name: 'Engadin' }], { start: '2026-05-04', end: '2027-04-25', baseHours: 10, peakHours: 16 });
  const at = (d) => w.find((x) => x.from <= d && x.to >= d);
  assert.equal(at('2027-03-07').phase, 'race');
  assert.equal(at('2027-02-24').phase, 'taper');
  assert.equal(at('2027-01-20').phase, 'specific');
  assert.equal(at('2026-06-01').phase, 'base');
  assert.equal(at('2027-03-10').phase, 'recovery');
  assert.ok(at('2027-02-24').targetHours < at('2027-01-20').targetHours);
  const base = w.filter((x) => x.phase === 'base' || x.phase === 'build').map((x) => x.targetHours);
  assert.ok(Math.max(...base) <= 16.5 && Math.min(...base) >= 6);
});

test('Wettkampf: Zeiten und Rückstand', async () => {
  const { parseTime, gapPct, fmtTime } = await import('../src/lib/season.js');
  assert.equal(parseTime('1:02:30'), 3750);
  assert.equal(gapPct(3750, 3600), 4.2);
  assert.equal(fmtTime(3750), '1:02:30');
});

test('Material: km aus Standard-Sportart, Service fällig', async () => {
  const { gearUsage } = await import('../src/lib/gear.js');
  const acts = [{ date: '2026-09-01', sport: 'rollerski_skate', distanceM: 300000, durationS: 36000 }, { date: '2026-09-02', sport: 'run', distanceM: 10000 }, { date: '2026-09-03', sport: 'run', distanceM: 5000, gearIds: ['g1'] }];
  const u = gearUsage({ id: 'g1', defaultSports: ['rollerski_skate'], serviceKm: 250, lastServiceKm: 0 }, acts);
  assert.equal(u.km, 305);
  assert.ok(u.serviceDue);
});

test('Gesundheit: Ausfalltage im Zeitraum', async () => {
  const { healthStats, loadBefore } = await import('../src/lib/gear.js');
  const s = healthStats([{ type: 'ill', start: '2026-10-10', end: '2026-10-14' }], '2026-10-12', '2026-10-31', '2026-10-26');
  assert.equal(s.ill, 3);
  const acts = Array.from({ length: 42 }, (_, i) => ({ date: new Date(Date.UTC(2026, 8, 1 + i)).toISOString().slice(0, 10), load: i >= 28 ? 150 : 100 }));
  assert.equal(loadBefore({ start: '2026-10-13' }, acts), 50);
});

test('Workout: Dauer, Belastung, FIT-Export lässt sich wieder lesen', async () => {
  const { TEMPLATES, durationOf, workoutLoad, toFit, toZwo, mainZone } = await import('../src/lib/workouts.js');
  const w = TEMPLATES[2]; // 4×8 min Rad
  assert.equal(durationOf(w), (20 + 4 * 10 + 15) * 60);
  assert.ok(workoutLoad(w) > 60 && workoutLoad(w) < 110);
  assert.equal(mainZone(w), 'I3');
  const bytes = await toFit(w, { ftp: 300, hrMax: 196 });
  const { Decoder, Stream } = await import('@garmin/fitsdk');
  const { messages, errors } = new Decoder(Stream.fromByteArray(Array.from(bytes))).read();
  assert.equal(errors.length, 0);
  const st = messages.workoutStepMesgs;
  assert.equal(messages.workoutMesgs[0].numValidSteps, st.length);
  const work = st.find((s) => s.intensity === 'active');
  assert.equal(work.customTargetValueLow ?? work.customTargetPowerLow, 264 + 1000);
  assert.ok(st.some((s) => s.durationType === 'repeatUntilStepsCmplt'));
  assert.ok(toZwo(w).includes('<SteadyState Duration="480" Power="0.92"/>'));
});
