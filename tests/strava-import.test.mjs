// Strava-Konto-Export: Dubletten überspringen, Watt in vorhandene Polar-Einheit übernehmen, Namen aus activities.csv.
import test from 'node:test';
import assert from 'node:assert/strict';
import { zipSync, gzipSync, strToU8 } from 'fflate';

const tcx = (startIso, n, watts) => `<?xml version="1.0"?><TrainingCenterDatabase><Activities><Activity Sport="Biking"><Id>${startIso}</Id><Lap StartTime="${startIso}"><TotalTimeSeconds>${n}</TotalTimeSeconds><DistanceMeters>30000</DistanceMeters><Track>${
  Array.from({ length: n }, (_, i) => `<Trackpoint><Time>${new Date(Date.parse(startIso) + i * 1000).toISOString()}</Time>${watts ? `<Extensions><ns3:TPX><ns3:Watts>${watts}</ns3:Watts></ns3:TPX></Extensions>` : ''}</Trackpoint>`).join('')}</Track></Lap></Activity></Activities></TrainingCenterDatabase>`;

test('Strava-Export: Dubletten, Watt-Zusammenführung, Namen', async () => {
  const { importFiles } = await import('../src/lib/sync.js');
  const { update, getData } = await import('../src/lib/store.js');
  const { buildActivity } = await import('../src/lib/activities.js');
  const settings = { hrMax: 196, hrRest: 42, lthr: 172, ftp: 300 };
  // Vorhanden: Polar-Fahrt mit Puls, ohne Watt (Start 3 min früher) und ein Lauf
  const ride = buildActivity({ start: '2025-06-01T07:57:00Z', sport: 'bike', series: { hr: Array(3600).fill(135) }, source: 'upload', title: 'Rennrad' }, settings, { id: 'polar-ride' }).activity;
  ride.notes = 'mit Gruppe';
  const run = buildActivity({ start: '2025-06-02T06:00:00Z', sport: 'run', series: { hr: Array(2400).fill(140) }, source: 'upload' }, settings, { id: 'polar-run' }).activity;
  update((d) => ({ ...d, settings, activities: [ride, run] }));
  const csv = 'Activity ID,Activity Date,Activity Name,Activity Type,Activity Description,Elapsed Time,Filename\n'
    + '1,"Jun 1, 2025",Morgenrunde mit Watt,Ride,,3600,activities/1.tcx.gz\n'
    + '2,"Jun 2, 2025",Lauf,Run,,2400,activities/2.tcx.gz\n'
    + '3,"Jun 5, 2025","Rollski, klassisch",Roller Ski,"locker, schön",3000,activities/3.tcx.gz\n';
  const zip = zipSync({
    'activities.csv': strToU8(csv), 'comments.csv': strToU8('Comment ID,Text\n1,Hallo'),
    'activities/1.tcx.gz': gzipSync(strToU8(tcx('2025-06-01T08:00:00Z', 3600, 210))),
    'activities/2.tcx.gz': gzipSync(strToU8(tcx('2025-06-02T06:00:20Z', 2400, 0))),
    'activities/3.tcx.gz': gzipSync(strToU8(tcx('2025-06-05T09:00:00Z', 3000, 0))),
  });
  const r = await importFiles([new File([zip], 'export_123.zip')], () => {});
  assert.equal(r.failed, 0, r.errors.join(' | '));
  assert.equal(r.added, 1);      // nur die Rollski-Einheit ist neu
  assert.equal(r.refreshed, 1);  // Polar-Fahrt bekommt die Watt
  assert.equal(r.dup, 1);        // Lauf ist doppelt
  const acts = getData().activities;
  assert.equal(acts.length, 3);
  const merged = acts.find((a) => a.id === 'polar-ride');
  assert.equal(merged.avgPower, 210);
  assert.equal(merged.avgHr, 135);
  assert.equal(merged.notes, 'mit Gruppe');
  const ski = acts.find((a) => a.date === '2025-06-05');
  assert.equal(ski.title, 'Rollski, klassisch');
  assert.equal(ski.sport, 'rollerski_classic');
  assert.equal(ski.notes, 'locker, schön');
});

test('Strava-CSV: Bewegungszeit und Gesamtzeit werden übernommen', async () => {
  const { parseStravaCsv } = await import('../src/lib/importers.js');
  const csv = 'Activity ID,Activity Date,Activity Name,Activity Type,Elapsed Time,Moving Time,Filename\n1,x,Morgenrunde,Ride,4500,3600,activities/1.fit.gz\n';
  const r = parseStravaCsv(csv);
  assert.equal(r['1.fit.gz'].movingS, 3600);
  assert.equal(r['1.fit.gz'].elapsedS, 4500);
});
