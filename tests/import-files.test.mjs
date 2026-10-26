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
