import test from 'node:test';
import assert from 'node:assert/strict';
import { Encoder, Profile } from '@garmin/fitsdk';
import { parseFit } from '../src/lib/fit.js';
import { buildActivity, findDuplicate, weeks, reevaluate } from '../src/lib/activities.js';
import { c2Watts } from '../src/lib/sync.js';
import { e1rm, exerciseHistory } from '../src/lib/strength.js';
import { dayTargets } from '../src/lib/nutrition.js';

export function makeFit({ start = new Date('2026-10-20T08:00:00Z'), seconds = 3600, power = 250, hr = 150, sport = 'crossCountrySkiing', subSport = 'skateSkiing' } = {}) {
  const enc = new Encoder();
  enc.onMesg(Profile.MesgNum.FILE_ID, { type: 'activity', manufacturer: 'development', product: 0, timeCreated: start, serialNumber: 1 });
  for (let i = 0; i < seconds; i++) enc.onMesg(Profile.MesgNum.RECORD, { timestamp: new Date(start.getTime() + i * 1000), heartRate: hr, power });
  enc.onMesg(Profile.MesgNum.SESSION, { timestamp: new Date(start.getTime() + seconds * 1000), startTime: start, totalElapsedTime: seconds, totalTimerTime: seconds, totalDistance: 20000, sport, subSport });
  return enc.close();
}

const settings = { ftp: 250, lthr: 165, hrMax: 190, hrRest: 50, timezone: 'Europe/Berlin' };

test('FIT einlesen → Langlauf Skating mit Belastung aus Puls', () => {
  const raw = parseFit(makeFit());
  assert.equal(raw.sport, 'xc_skate');
  assert.equal(raw.series.hr.length, 3600);
  const { activity, series } = buildActivity(raw, settings);
  assert.equal(activity.date, '2026-10-20');
  assert.equal(activity.loadSource, 'hr'); // Skating hat keine Wattmessung
  assert.ok(activity.zones.I2 > 3500);
  assert.equal(series.hr.length, 720);
  // Neuberechnung aus dem ausgedünnten Verlauf ergibt dasselbe
  const again = reevaluate(activity, settings, series);
  assert.ok(Math.abs(again.load - activity.load) < 0.5);
});

test('Rad-FIT nutzt Leistung', () => {
  const { activity } = buildActivity(parseFit(makeFit({ sport: 'cycling', subSport: 'road' })), settings);
  assert.equal(activity.sport, 'bike');
  assert.ok(Math.abs(activity.load - 100) < 0.5);
});

test('Dubletten über Startzeit und Dauer', () => {
  const a = { start: '2026-10-20T08:00:00Z', durationS: 3600 };
  assert.ok(findDuplicate([a], { start: '2026-10-20T08:01:00Z', durationS: 3500 }));
  assert.ok(!findDuplicate([a], { start: '2026-10-20T08:01:00Z', durationS: 1200 }));
});

test('Wochenübersicht', () => {
  const acts = [{ date: '2026-10-20', durationS: 7200, load: 120, sport: 'xc_skate', zones: { I1: 3600, I2: 0, I3: 1800, I4: 0, I5: 0 } }, { date: '2026-10-21', durationS: 3600, load: 40, sport: 'strength' }];
  const w = weeks(acts, 2, '2026-10-26').at(0);
  assert.equal(w.hours, 3);
  assert.equal(w.strengthSessions, 1);
  assert.equal(w.thresholdSessions, 1);
  assert.equal(w.zones.I3, 0.5);
});

test('Concept2: Watt aus Pace', () => {
  assert.equal(c2Watts(1200, 'rower'), 203); // 2:00/500 m ≈ 203 W
});

test('Kraft: 1RM und Verlauf', () => {
  assert.equal(e1rm(100, 1), 100);
  assert.ok(Math.abs(e1rm(100, 5) - 116.7) < 0.1);
  const h = exerciseHistory([{ date: '2026-10-01', items: [{ ex: 'pullup', sets: [{ reps: 5, kg: 10 }] }] }], 'pullup', 75);
  assert.ok(Math.abs(h[0].best - 85 * (1 + 5 / 30)) < 0.01);
});

test('Ernährungsziele steigen mit Umfang', () => {
  const easy = dayTargets({ weightKg: 70, minutes: 0 });
  const hard = dayTargets({ weightKg: 70, minutes: 180, hardMinutes: 40 });
  assert.equal(easy.carbs, 245);
  assert.ok(hard.carbs > 600 && hard.duringPerHour === 90);
});

test('Dubletten: anders gestartet oder Pausen unterschiedlich gezählt', () => {
  const polar = { start: '2026-08-01T08:00:00Z', durationS: 8400, elapsedS: 10800 }; // 2:20 Bewegung, 3 h gesamt
  assert.ok(findDuplicate([polar], { start: '2026-08-01T08:00:30Z', elapsedS: 10800 }));
  assert.ok(findDuplicate([polar], { start: '2026-08-01T08:06:00Z', durationS: 10200, elapsedS: 10200 }));
  assert.ok(!findDuplicate([polar], { start: '2026-08-01T08:30:00Z', durationS: 3600 }));
});
