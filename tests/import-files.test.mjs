import test from 'node:test';
import assert from 'node:assert/strict';
import { zipSync, strToU8 } from 'fflate';
import { parseTcx, parseGpx, parsePolarCsv, parsePolarJson, readExport } from '../src/lib/importers.js';
import { polarSport } from '../src/lib/sports.js';

const start = Date.parse('2024-02-10T08:00:00Z');
const iso = (s) => new Date(start + s * 1000).toISOString();

const tcx = `<?xml version="1.0"?><TrainingCenterDatabase xmlns:ns3="http://www.garmin.com/xmlschemas/ActivityExtension/v2"><Activities><Activity Sport="Other"><Id>${iso(0)}</Id>
<Lap StartTime="${iso(0)}"><TotalTimeSeconds>600</TotalTimeSeconds><DistanceMeters>3000</DistanceMeters><Calories>150</Calories><Track>
${Array.from({ length: 600 }, (_, i) => `<Trackpoint><Time>${iso(i)}</Time><HeartRateBpm><Value>${140 + (i % 5)}</Value></HeartRateBpm><Extensions><ns3:TPX><ns3:Watts>${200}</ns3:Watts></ns3:TPX></Extensions></Trackpoint>`).join('\n')}
</Track></Lap><Notes>Rollski Skating</Notes></Activity></Activities></TrainingCenterDatabase>`;

test('TCX mit Puls und Watt', () => {
  const r = parseTcx(tcx);
  assert.equal(r.start, iso(0));
  assert.equal(r.sport, 'rollerski_skate');
  assert.equal(r.elapsedS, 600);
  assert.equal(r.distanceM, 3000);
  assert.equal(r.series.hr.length, 600);
  assert.equal(Math.round(r.avgPower), 200);
});

test('GPX mit Puls-Erweiterung und Distanz aus Koordinaten', () => {
  const gpx = `<gpx><trk><name>Lauf</name><type>running</type><trkseg>${Array.from({ length: 120 }, (_, i) => `<trkpt lat="${47 + i * 0.0001}" lon="9"><ele>500</ele><time>${iso(i)}</time><extensions><gpxtpx:TrackPointExtension><gpxtpx:hr>150</gpxtpx:hr></gpxtpx:TrackPointExtension></extensions></trkpt>`).join('')}</trkseg></trk></gpx>`;
  const r = parseGpx(gpx);
  assert.equal(r.sport, 'run');
  assert.ok(r.distanceM > 1250 && r.distanceM < 1400, String(r.distanceM));
  assert.equal(Math.round(r.avgHr), 150);
});

test('Polar-CSV', () => {
  const csv = ['Name,Sport,Date,Start time,Duration,Total distance (km),Average heart rate (bpm),Calories',
    'Valentin,ROLLER_SKIING_CLASSIC,10-02-2024,08:00:00,00:10:00,3.2,142,160',
    'Sample rate,Time,HR (bpm),Speed (km/h),Pace (min/km),Cadence,Altitude (m),Stride length (m),Distances (m),Temperatures (C),Power (W)',
    ...Array.from({ length: 600 }, (_, i) => `1,00:${String(Math.floor(i / 60)).padStart(2, '0')}:${String(i % 60).padStart(2, '0')},${140},18,,,500,,,,`)].join('\n');
  const r = parsePolarCsv(csv);
  assert.equal(r.sport, 'rollerski_classic');
  assert.equal(r.elapsedS, 600);
  assert.equal(r.distanceM, 3200);
  assert.equal(r.series.hr.length, 600);
});

test('Polar-Konto-JSON (tolerant)', () => {
  const r = parsePolarJson({ exercises: [{ startTime: '2024-02-10T08:00:00.000Z', duration: 'PT1H', sport: 'CROSS_COUNTRY_SKIING', distance: 15000, heartRate: { avg: 138, max: 170 }, samples: { heartRate: Array.from({ length: 100 }, (_, i) => ({ dateTime: iso(i), value: 138 })) } }] });
  assert.equal(r.elapsedS, 3600);
  assert.equal(r.sport, 'xc_classic');
  assert.equal(r.avgHr, 138);
  assert.equal(r.series.hr.length, 100);
});

test('ZIP mit mehreren Dateien, fremde Dateien werden übersprungen', async () => {
  const zip = zipSync({
    'training-session-1.json': strToU8(JSON.stringify({ exercises: [{ startTime: iso(0), duration: 'PT30M', sport: 'RUNNING' }] })),
    'a.tcx': strToU8(tcx),
    'sleep-result.json': strToU8('{"night":"x"}'),
    'readme.txt': strToU8('hallo'),
  });
  const raws = await readExport('export.zip', zip, async () => { throw new Error('kein FIT'); });
  assert.equal(raws.length, 2);
});

test('Polar-Sportnamen deutsch und englisch', () => {
  assert.equal(polarSport('Rollski Skating'), 'rollerski_skate');
  assert.equal(polarSport('Skilanglauf klassisch'), 'xc_classic');
  assert.equal(polarSport('ROAD_BIKING'), 'bike');
  assert.equal(polarSport('Radfahren'), 'bike');
  assert.equal(polarSport('Laufen'), 'run');
  assert.equal(polarSport('Krafttraining'), 'strength');
});

test('Concept2-Intervalle: Zeitachse läuft über alle Intervalle weiter', async () => {
  const { concept2Points } = await import('../src/lib/sync.js');
  const { toSeries } = await import('../src/lib/series.js');
  const { lapsFromConcept2, lapAnalysis } = await import('../src/lib/laps.js');
  const { c2Watts } = await import('../src/lib/sync.js');
  // 3 Intervalle à 10 min, 2 min Pause; Schlagzeit (Zehntelsekunden) beginnt je Intervall bei 0, ein Schlag alle 2 s
  const workout = { intervals: [1, 2, 3].map((k) => ({ time: 6000, distance: 2400 + k * 20, rest_time: 1200, stroke_rate: 40, heart_rate: { average: 150 + k * 3, max: 165 } })) };
  const laps = lapsFromConcept2(workout, 'skierg', c2Watts);
  const strokes = [];
  for (let k = 0; k < 3; k++) for (let t = 0; t <= 6000; t += 20) strokes.push({ t, p: 1250, hr: 150 + k * 3 });
  const pts = concept2Points(strokes, 0, laps, 'skierg');
  assert.equal(Math.round((pts.at(-1).t - pts[0].t) / 1000), 3 * 600 + 2 * 120);
  const series = toSeries(pts, 30);
  assert.ok(Math.abs(series.hr.length - 1800) <= 3, String(series.hr.length)); // Pausen > 30 s werden nicht gezählt
  // Schläge alle 1,5 s dürfen die Zeit nicht strecken
  const odd = toSeries(Array.from({ length: 401 }, (_, i) => ({ t: i * 1500, hr: 140 })), 30);
  assert.ok(Math.abs(odd.hr.length - 601) <= 1, String(odd.hr.length));
  assert.equal(laps.length, 3);
  assert.equal(laps[1].startS, 720);
  assert.equal(Math.round(laps[0].pace), 124); // 600 s für 2420 m = 2:04 /500 m
  const a = lapAnalysis(laps);
  assert.equal(a.count, 3);
  assert.equal(a.hrRise, 6);
  assert.ok(a.fade > 0);
});

test('Pace-Format rundet richtig', async () => {
  const { fmtPace } = await import('../src/lib/laps.js');
  assert.equal(fmtPace(119.7), '2:00');
  assert.equal(fmtPace(121.1), '2:01');
});

test('Polar-Konto-Export: Zeitzone, Tempo, Titel, nur Trainingsdateien, Alpin ≠ Langlauf', async () => {
  const { parsePolarJson, importable, zipEntries } = await import('../src/lib/importers.js');
  const { polarSport } = await import('../src/lib/sports.js');
  const { zipSync, strToU8 } = await import('fflate');
  const samples = Array.from({ length: 60 }, (_, k) => ({ dateTime: `2019-05-05T10:00:${String(k).padStart(2, '0')}.000`, value: 130 }));
  const doc = { startTime: '2019-05-05T10:00:00.000', timeZoneOffset: 120, name: 'Intervalle', note: 'hart', exercises: [{ startTime: '2019-05-05T10:00:00.000', sport: 'RUNNING', samples: { heartRate: samples, speed: samples.map((s) => ({ ...s, value: 36 })) } }] };
  const r = parsePolarJson(doc);
  assert.equal(r.start, '2019-05-05T08:00:00.000Z');
  assert.equal(r.title, 'Intervalle');
  assert.equal(r.notes, 'hart');
  assert.equal(r.series.speed[5], 10);
  assert.ok(importable('x/training-session-2019.json') && !importable('x/activity-2019.json') && importable('a/1.fit.gz') && !importable('x/sleep.json'));
  assert.equal(polarSport('DOWNHILL_SKIING'), 'other');
  assert.equal(polarSport('CROSS-COUNTRY_SKIING'), 'xc_classic');
  const zip = zipSync({ 'e/training-session-1.json': strToU8(JSON.stringify(doc)), 'e/activity-1.json': strToU8('{}') });
  const names = [];
  for await (const e of zipEntries(new File([zip], 'e.zip'))) names.push(e.name);
  assert.deepEqual(names, ['e/training-session-1.json']);
});

test('Polar-Export ohne Zusammenfassung: Puls aus dem Verlauf statt 0, Profil wird gelesen', async () => {
  const { parsePolarJson } = await import('../src/lib/importers.js');
  const hr = Array.from({ length: 120 }, (_, k) => ({ dateTime: `2022-03-19T19:${String(10 + Math.floor(k / 60)).padStart(2, '0')}:${String(k % 60).padStart(2, '0')}.463`, value: 140 + (k % 10) }));
  const r = parsePolarJson({ startTime: '2022-03-19T19:10:00.000', timeZoneOffset: -180, physicalInformationSnapshot: { dateTime: '2022-03-19T23:40:03.000', maximumHeartRate: 192, restingHeartRate: 55, anaerobicThreshold: 173, functionalThresholdPower: 310, 'weight, kg': 79, sex: 'MALE' },
    exercises: [{ startTime: '2022-03-19T19:10:00.000', stopTime: '2022-03-19T19:12:00.000', sport: 'RUNNING', samples: { heartRate: hr } }] });
  assert.equal(Math.round(r.avgHr), 145);
  assert.equal(r.maxHr, 149);
  assert.equal(r.elapsedS, 120);
  assert.deepEqual({ ...r.athlete, date: undefined }, { date: undefined, hrMax: 192, hrRest: 55, lthr: 173, ftp: 310, weightKg: 79, sex: 'm' });
});

test('Neues Polar-Format (samples.samples, distanceMeters, Sport als Nummer)', async () => {
  const { parsePolarJson } = await import('../src/lib/importers.js');
  const { polarSport } = await import('../src/lib/sports.js');
  const n = 600;
  const doc = {
    startTime: '2018-10-06T11:00:00', stopTime: '2018-10-06T11:10:00', name: 'Freistil-Rollski', durationMillis: 600000, distanceMeters: 3000, calories: 120, trainingLoad: 15, timezoneOffsetMinutes: 120,
    physicalInformation: { maximumHeartRate: 200, restingHeartRate: 38, anaerobicThreshold: 180, weightKg: 75, sex: 'SEX_MALE', modified: '2018-10-07T20:46:51.000' },
    sport: { id: '59' },
    exercises: [{ startTime: '2018-10-06T11:00:00', stopTime: '2018-10-06T11:10:00', durationMillis: 600000, distanceMeters: 3000, timezoneOffsetMinutes: 120,
      statistics: { statistics: [{ type: 'STATISTICS_TYPE_HEART_RATE', avg: 150, max: 170 }] },
      samples: { samples: [
        { type: 'HEART_RATE', intervalMillis: 1000, values: Array.from({ length: n }, (_, i) => (i < 5 ? 'NaN' : 150)) },
        { type: 'SPEED', intervalMillis: 1000, values: Array(n).fill(18) },
      ] },
      pauseTimes: [{ startTime: '2018-10-06T11:05:00.000', endTime: '2018-10-06T11:06:00.000' }] }],
  };
  const r = parsePolarJson(doc);
  assert.equal(r.start, '2018-10-06T09:00:00.000Z');
  assert.equal(r.sport, 'rollerski_skate');
  assert.equal(r.distanceM, 3000);
  assert.equal(r.calories, 120);
  assert.equal(r.avgHr, 150);
  assert.equal(r.externalLoad, 15);
  assert.equal(r.series.hr.length, 540); // Pause herausgenommen
  assert.equal(r.series.hr[0], null);
  assert.equal(r.series.speed[10], 5);
  assert.equal(r.athlete.hrMax, 200);
  assert.equal(polarSport('Klassischer Skilanglauf'), 'xc_classic');
  assert.equal(polarSport('Freistil-Skilanglauf'), 'xc_skate');
  assert.equal(polarSport('Schwimmen Freistil'), 'swim');
});

test('Polar: Sportnummer, geplante Einheiten nicht importieren', async () => {
  const { parsePolarJson, readExport, importable } = await import('../src/lib/importers.js');
  const base = { startTime: '2020-01-01T10:00:00', durationMillis: 3600000, timezoneOffsetMinutes: 60, exercises: [{ startTime: '2020-01-01T10:00:00', durationMillis: 3600000, sport: { id: '25' } }] };
  assert.equal(parsePolarJson({ ...base, name: '' }).sport, 'xc_classic');
  assert.equal(parsePolarJson({ ...base, deviceId: 'X' }).recorded, true);
  assert.equal(parsePolarJson(base).recorded, false);
  assert.equal(importable('e/training-target_2020.json'), false);
  const bytes = new TextEncoder().encode(JSON.stringify({ name: 'Plan', startTime: '2020-01-01T10:00:00' }));
  assert.deepEqual(await readExport('training-session_x.json', bytes), []);
});

test('Polar: Zeit wie auf der Uhr, Runden und Autolaps aus dem Export, km-Splits berechnet', async () => {
  const { parsePolarJson } = await import('../src/lib/importers.js');
  const { buildActivity, distanceSplits } = await import('../src/lib/activities.js');
  const n = 1500;
  const doc = { startTime: '2024-05-01T07:00:00', durationMillis: 1500000, distanceMeters: 4500, timezoneOffsetMinutes: 120, deviceId: 'X', name: 'Laufen',
    exercises: [{ startTime: '2024-05-01T07:00:00', durationMillis: 1500000, distanceMeters: 4500, sport: { id: '1' },
      samples: { samples: [{ type: 'HEART_RATE', intervalMillis: 1000, values: Array(n).fill(150) }, { type: 'SPEED', intervalMillis: 1000, values: Array(n).fill(10.8) }] },
      laps: { laps: [{ durationMillis: 600000, distanceMeters: 1800, heartRate: { avg: 145, max: 152 } }, { durationMillis: 900000, distanceMeters: 2700, heartRate: { avg: 155, max: 162 } }],
        autoLaps: Array.from({ length: 4 }, () => ({ duration: 'PT333.3S', distance: 1000 })) },
      // Pause, die die App früher herausgeschnitten hat
      pauseTimes: [{ startTime: '2024-05-01T07:10:00.000', endTime: '2024-05-01T07:12:00.000' }] }] };
  const raw = parsePolarJson(doc);
  assert.equal(raw.timerS, 1500);
  assert.equal(raw.laps.length, 2);
  assert.equal(raw.laps[1].startS, 600);
  assert.equal(raw.laps[1].avgHr, 155);
  assert.equal(raw.deviceAutoLaps.length, 4);
  const { activity } = buildActivity(raw, { hrMax: 196, hrRest: 42, lthr: 172 });
  assert.equal(activity.durationS, 1500); // Polar-Zeit, nicht die gekürzte Bewegungszeit
  assert.equal(activity.autoLaps.length, 4);
  const splits = distanceSplits({ speed: Array(1500).fill(3), hr: Array(1500).fill(150), power: [] }, 'run');
  assert.equal(splits.length, 5); // 4,5 km → 4 volle km + 500 m Rest
  assert.equal(Math.round(splits[0].pace), 334); // 3 m/s: 1000 m nach 334 s
  assert.equal(splits[4].distanceM, 500);
  assert.equal(distanceSplits({ speed: Array(100).fill(3) }, 'strength'), null);
});

test('Polar-Runden im Geräteformat (header + statistics, Dauer als Objekt oder Millis)', async () => {
  const { parsePolarJson } = await import('../src/lib/importers.js');
  const lap = (min, km, hr) => ({ header: { splitTime: { minutes: min * 2 }, duration: { minutes: min }, distance: km * 1000, autolapType: 'AUTOLAP_TYPE_DISTANCE' }, statistics: { heartRate: { average: hr, maximum: hr + 8 }, speed: { average: (km / min) * 60, maximum: 15 } } });
  const doc = { startTime: '2024-05-01T07:00:00', durationMillis: 1200000, timezoneOffsetMinutes: 120, deviceId: 'X', exercises: [{ startTime: '2024-05-01T07:00:00', durationMillis: 1200000, sport: { id: '1' },
    laps: { laps: [{ header: { splitTimeMillis: 300000, durationMillis: 300000, distanceMeters: 1000 }, statistics: { heartRate: { average: 140, maximum: 150 } } }, { header: { splitTimeMillis: 1200000, durationMillis: 900000, distanceMeters: 3200 }, statistics: { heartRate: { average: 160, maximum: 172 }, power: { average: 280 } } }], summary: {} },
    autoLaps: { autoLaps: [lap(5, 1, 141), { ...lap(5, 1, 150), header: { splitTime: { minutes: 10 }, duration: { minutes: 5 }, distance: 1000 } }] } }] };
  const r = parsePolarJson(doc);
  assert.equal(r.laps.length, 2);
  assert.equal(r.laps[1].startS, 300);
  assert.equal(r.laps[1].durationS, 900);
  assert.equal(r.laps[1].avgHr, 160);
  assert.equal(r.laps[1].avgPower, 280);
  assert.equal(r.deviceAutoLaps.length, 2);
  assert.equal(r.deviceAutoLaps[1].startS, 300);
  assert.equal(r.deviceAutoLaps[0].pace, 300);
});
