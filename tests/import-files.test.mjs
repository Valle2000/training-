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
