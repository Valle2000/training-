import test from 'node:test';
import assert from 'node:assert/strict';
import { parseIcs, icsToPlan, minutesFromText, sportFromText, zoneFromText, mergeFeedPlan } from '../src/lib/ical.js';

const ICS = [
  'BEGIN:VCALENDAR', 'VERSION:2.0',
  'BEGIN:VEVENT', 'UID:tp-1', 'DTSTART;VALUE=DATE:20261201', 'DTEND;VALUE=DATE:20261202', 'SUMMARY:XC-Ski: 3x12 L4 Skating',
  'DESCRIPTION:Planned Time: 1:30:00\\nEinlaufen 20 min\\, dann 3x12 min L4', '  mit 3 min Pause', 'END:VEVENT',
  'BEGIN:VEVENT', 'UID:tp-2', 'DTSTART;VALUE=DATE:20261202', 'SUMMARY:Run - easy 50min', 'END:VEVENT',
  'BEGIN:VEVENT', 'UID:tp-3', 'DTSTART:20261203T060000Z', 'DTEND:20261203T071500Z', 'SUMMARY:Strength', 'END:VEVENT',
  'BEGIN:VEVENT', 'UID:tp-4', 'DTSTART;VALUE=DATE:20261204', 'SUMMARY:Ruhetag', 'END:VEVENT',
  'END:VCALENDAR',
].join('\r\n');

test('iCal: Ereignisse, Fortsetzungszeilen, Escapes', () => {
  const ev = parseIcs(ICS);
  assert.equal(ev.length, 4);
  assert.match(ev[0].DESCRIPTION, /dann 3x12 min L4 mit 3 min Pause/);
  assert.match(ev[0].DESCRIPTION, /20 min, dann/);
});

test('iCal → Plan: Dauer, Sportart, Zone', () => {
  const p = icsToPlan(ICS);
  assert.deepEqual(p.map((x) => x.date), ['2026-12-01', '2026-12-02', '2026-12-03', '2026-12-04']);
  assert.equal(p[0].sport, 'xc_skate'); assert.equal(p[0].minutes, 90); assert.equal(p[0].zone, 'I4');
  assert.equal(p[1].sport, 'run'); assert.equal(p[1].minutes, 50); assert.equal(p[1].zone, 'I1');
  assert.equal(p[2].sport, 'strength'); assert.equal(p[2].minutes, 75);
  assert.equal(p[3].minutes, 0);
  assert.ok(p.every((x) => x.source === 'trainingpeaks'));
});

test('Textheuristiken', () => {
  assert.equal(minutesFromText('Dauer: 1:15'), 75);
  assert.equal(minutesFromText('Long ride 2,5 h'), 150);
  assert.equal(minutesFromText('PT45M'), 45);
  assert.equal(minutesFromText('5x4 min'), null);
  assert.equal(sportFromText('Rollski klassisch'), 'rollerski_classic');
  assert.equal(sportFromText('Bike: Sweet Spot'), 'bike');
  assert.equal(zoneFromText('Schwelle 3x10'), 'I3');
});

test('Feed hat Vorrang: offene App-Einheiten in TP-Wochen fliegen raus, erledigte und andere Wochen bleiben', () => {
  let n = 0; const id = () => `n${++n}`;
  const plan = [
    { id: 'a', source: 'trainingpeaks', externalId: 'tp-old', date: '2026-12-02', done: false },
    { id: 'b', source: 'trainingpeaks', externalId: 'tp-1', date: '2026-12-01', done: true },
    { id: 'c', date: '2026-12-02', title: 'eigene', source: 'wizard' },
    { id: 'e', date: '2026-12-06', title: 'Sonntag gleiche Woche', source: 'coach' },
    { id: 'f', date: '2026-12-03', title: 'erledigt', source: 'wizard', done: true },
    { id: 'g', date: '2026-12-08', title: 'nächste Woche', source: 'wizard' },
    { id: 'd', source: 'trainingpeaks', externalId: 'tp-x', date: '2026-11-20', done: false },
  ];
  const r = mergeFeedPlan(plan, icsToPlan(ICS), id);
  assert.equal(r.removed, 3); assert.equal(r.replacedOwn, 2);
  assert.ok(!r.plan.find((p) => p.id === 'c') && !r.plan.find((p) => p.id === 'e'));
  assert.ok(['b', 'd', 'f', 'g'].every((id) => r.plan.find((p) => p.id === id)));
  assert.equal(r.plan.filter((p) => p.externalId === 'tp-1').length, 1);
  assert.equal(r.added, 3);
});

test('Proxy erlaubt nur TrainingPeaks', async () => {
  const { checkFeedUrl, fetchFeed } = await import('../server/ical.mjs');
  assert.ok(checkFeedUrl('webcal://www.trainingpeaks.com/ical/ABC.ics'));
  assert.equal(checkFeedUrl('https://evil.com/trainingpeaks.com'), null);
  assert.equal(checkFeedUrl('https://trainingpeaks.com.evil.com/x'), null);
  assert.equal(checkFeedUrl('http://www.trainingpeaks.com/x'), null);
  assert.equal(checkFeedUrl('https://www.trainingpeaks.com:8443/x'), null);
  const redirectOut = async () => ({ status: 302, headers: new Map([['location', 'https://169.254.169.254/']]), ok: false });
  await assert.rejects(fetchFeed('webcal://www.trainingpeaks.com/ical/x', redirectOut), /fremde Adresse/);
  const ok = async () => ({ status: 200, ok: true, headers: new Map(), text: async () => 'BEGIN:VCALENDAR\nEND:VCALENDAR' });
  assert.match(await fetchFeed('webcal://www.trainingpeaks.com/ical/x', ok), /VCALENDAR/);
});

test('App-Pläne nur außerhalb der TrainingPeaks-Wochen', async () => {
  const { outsideTpWeeks } = await import('../src/lib/ical.js');
  const plan = [{ source: 'trainingpeaks', date: '2026-12-02', minutes: 60 }];
  const items = [{ date: '2026-11-30' }, { date: '2026-12-06' }, { date: '2026-12-07' }];
  assert.deepEqual(outsideTpWeeks(items, plan).map((x) => x.date), ['2026-12-07']);
});
