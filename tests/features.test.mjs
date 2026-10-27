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

test('Einheit zuschneiden: Dauer, Distanz, Startzeit, Original bleibt', async () => {
  const { buildActivity, cropActivity } = await import('../src/lib/activities.js');
  const settings = { hrMax: 196, hrRest: 42, lthr: 172, ftp: 300, timezone: 'Europe/Berlin' };
  const n = 3600;
  const { activity, series } = buildActivity({ start: '2026-08-01T08:00:00Z', sport: 'bike', distanceM: 36000, calories: 900, series: { hr: Array.from({ length: n }, (_, i) => (i < 2700 ? 140 : 100)), power: Array.from({ length: n }, (_, i) => (i < 2700 ? 200 : 0)), speed: Array(n).fill(10) } }, settings, { id: 'x' });
  const { activity: c, series: cut } = cropActivity(activity, series, 0, 2700 / 5 - 1, settings);
  assert.equal(c.durationS, 2700);
  assert.equal(Math.round(c.distanceM), 27000);
  assert.equal(c.avgHr, 140);
  assert.equal(c.avgPower, 200);
  assert.equal(cut.hr.length, 540);
  assert.equal(c.original.durationS, 3600);
  const late = cropActivity(activity, series, 120, 539, settings).activity;
  assert.equal(late.start, '2026-08-01T08:10:00.000Z');
});

test('Key Session: nur Runden 2–4 auswerten (3×20 min ohne Ein-/Auslaufen)', async () => {
  const { keySessionRows, parseLapRange } = await import('../src/lib/keysessions.js');
  assert.deepEqual(parseLapRange('2-4'), [2, 3, 4]);
  assert.deepEqual(parseLapRange('1, 3-4'), [1, 3, 4]);
  const laps = [{ n: 1, durationS: 1200, avgPower: 120, avgHr: 120 }, ...[2, 3, 4].map((n) => ({ n, durationS: 1200, avgPower: 200 + n, avgHr: 150 })), { n: 5, durationS: 1200, avgPower: 100, avgHr: 115 }];
  const rows = keySessionRows([{ id: 'a', date: '2026-10-01', sport: 'skierg', title: '3x20min', laps, durationS: 6000 }], { id: 'k', sport: 'skierg', keywords: '3x20', laps: '2-4', intervalSec: 1200 });
  assert.equal(rows[0].intervalPower, 203);
  assert.equal(rows[0].intervalHr, 150);
  assert.equal(rows[0].fromLaps, true);
});

test('Umfangsbetontes Belastungsmodell (Lucia-TRIMP)', async () => {
  const { luciaLoad } = await import('../src/lib/metrics.js');
  const { evaluate } = await import('../src/lib/activities.js');
  assert.equal(luciaLoad({ I1: 3600, I2: 0, I3: 0, I4: 0, I5: 0 }), 50);
  assert.equal(luciaLoad({ I1: 0, I2: 0, I3: 3600, I4: 0, I5: 0 }), 100);
  const hr = Array(3600).fill(130);
  const base = { sport: 'run', series: { hr } }, st = { hrMax: 196, hrRest: 42, lthr: 172 };
  const std = evaluate(base, st), vol = evaluate(base, { ...st, loadModel: 'lucia' });
  assert.equal(vol.loadSource, 'lucia');
  assert.ok(vol.load > std.load, `${vol.load} > ${std.load}`);
});

test('Wiedereinstieg nach Krankheit: Stufen nach Dauer und Fieber', async () => {
  const { returnPlan } = await import('../src/lib/gear.js');
  const cold = { type: 'ill', start: '2026-10-01', end: '2026-10-04', systemic: false }; // 4 Tage
  const r = returnPlan(cold, '2026-10-06');
  assert.equal(r.steps[0].from, '2026-10-05'); // 1 Tag beschwerdefrei
  assert.equal(r.steps.length, 4);
  assert.equal(r.current, 1);
  assert.equal(returnPlan(cold, '2026-10-20'), null); // vorbei
  const flu = { type: 'ill', start: '2026-10-01', end: '2026-10-08', systemic: true }; // 8 Tage, Fieber
  const f = returnPlan(flu, '2026-10-09');
  assert.equal(f.current, -1);
  assert.equal(f.steps[0].from, '2026-10-10');
  assert.equal(f.steps[0].to, '2026-10-13'); // 4 Tage je Stufe
  assert.equal(returnPlan({ ...flu, end: null }, '2026-10-05').active, true);
  assert.equal(returnPlan({ type: 'injury', start: '2026-10-01' }, '2026-10-05'), null);
});
