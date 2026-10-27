// Saisonplan-Assistent: Wochen nach Ansatz, Umfang, Ruhetagen und gewählten Key Sessions.
import test from 'node:test';
import assert from 'node:assert/strict';
import { generatePlan, toPlanItems, APPROACHES } from '../src/lib/plan-wizard.js';

const races = [{ date: '2027-02-20', name: 'Engadin', priority: 'A', distanceKm: 42 }];
const base = { startHours: 13, peakHours: 16, start: '2026-11-02', end: '2027-03-01', restDays: [1], longDay: 7, doubles: true, strengthPerWeek: 2 };

test('Alle Ansätze: Stunden passen, max. 2 Einheiten/Tag, Ruhetag frei', () => {
  for (const ap of APPROACHES) {
    const w = generatePlan({ ...base, approach: ap.id }, races);
    assert.ok(w.length >= 17, ap.id);
    for (const x of w) {
      assert.ok(Math.abs(x.plannedHours - x.targetHours) <= 1, `${ap.id} ${x.from}: ${x.plannedHours} vs ${x.targetHours}`);
      for (const d of x.days) { assert.ok(d.sessions.length <= 2, `${ap.id} ${d.date}`); if (d.dow === 1) assert.equal(d.sessions.length, 0); }
    }
  }
});

test('Norwegisch: zwei Double-Threshold-Tage im Aufbau; Rennwoche mit Vorbelastung am Vortag', () => {
  const w = generatePlan({ ...base, approach: 'norwegian' }, races);
  const build = w.find((x) => x.phase === 'build');
  const dtDays = build.days.filter((d) => d.sessions.filter((s) => s.keyId === 'dt_am' || s.keyId === 'dt_pm').length === 2);
  assert.equal(dtDays.length, 2);
  const race = w.find((x) => x.phase === 'race');
  assert.ok(race.days.find((d) => d.date === '2027-02-19').sessions.some((s) => s.title.startsWith('Vorbelastung')));
  assert.ok(race.days.find((d) => d.date === '2027-02-20').sessions.some((s) => s.kind === 'race'));
});

test('Gewählte Key Sessions, Polarisiert ohne Schwelle, Block-Woche, Kalendereinträge', () => {
  const pol = generatePlan({ ...base, approach: 'polarized', keys: ['hit_30_15', 'long'] }, races);
  const hard = pol.flatMap((x) => x.days.flatMap((d) => d.sessions.filter((s) => s.kind === 'hard')));
  assert.ok(hard.length > 0 && hard.every((s) => ['hit_30_15', 'opener'].includes(s.keyId) || s.title.startsWith('Vorbelastung')));
  const blk = generatePlan({ ...base, approach: 'block' }, races);
  const bw = blk.find((x) => x.block);
  assert.equal(bw.days.flatMap((d) => d.sessions.filter((s) => s.kind === 'hard')).length, 5);
  let n = 0;
  const items = toPlanItems(pol.slice(0, 2), () => `id${n++}`);
  assert.ok(items.length > 10 && items.every((i) => i.source === 'wizard' && i.load >= 0 && i.date >= '2026-11-02'));
});

test('Profil: Empfehlung nach Zielen, Stil und Schwächen', async () => {
  const { recommend } = await import('../src/lib/plan-wizard.js');
  assert.equal(recommend({ weak: ['threshold'], seriousness: 'ambitious' }, 10).approach, 'norwegian');
  assert.equal(recommend({ style: 'varied', seriousness: 'performance' }, 12).approach, 'block');
  assert.equal(recommend({ goal: 'fitness' }, 14).approach, 'polarized');
  const r = recommend({ weak: ['strength', 'hills'], style: 'steady', likes: ['bike'] }, 12);
  assert.equal(r.strengthPerWeek, 3);
  assert.ok(r.keys.includes('hit_hill'));
  assert.ok(r.reasons.some((x) => x.includes('Kontinuität')));
});

test('Profil: Lieblingssport im Frühjahr und je nach Ernst bis Spätsommer; gleichmäßiger Stil', async () => {
  const { specificShare } = await import('../src/lib/plan-wizard.js');
  const none = specificShare('base', '2027-05-03', {});
  const bike = specificShare('base', '2027-05-03', { likes: ['bike'] });
  assert.ok(bike < none);
  assert.ok(specificShare('base', '2027-08-09', { likes: ['bike'], seriousness: 'fun' }) < specificShare('base', '2027-08-09', { likes: ['bike'], seriousness: 'performance' }));
  const { seasonPlan } = await import('../src/lib/season.js');
  const opts = { start: '2027-05-03', end: '2027-07-25', baseHours: 10, peakHours: 12 };
  const steady = seasonPlan([], { ...opts, style: 'steady' }).map((w) => w.targetHours);
  const varied = seasonPlan([], { ...opts, style: 'varied' }).map((w) => w.targetHours);
  assert.ok(Math.max(...steady) - Math.min(...steady) < Math.max(...varied) - Math.min(...varied));
});

test('Profil: Rad gern → mehr Rad im Frühjahr, Plan bleibt gültig', () => {
  const o = { ...base, start: '2027-05-03', end: '2027-07-25', approach: 'pyramidal' };
  const count = (w) => w.flatMap((x) => x.days.flatMap((d) => d.sessions)).filter((s) => s.sport === 'bike' || s.sport === 'cycling').length;
  const plain = generatePlan(o, []);
  const liked = generatePlan({ ...o, profile: { likes: ['bike'], seriousness: 'fun' } }, []);
  assert.ok(count(liked) > count(plain), `${count(liked)} vs ${count(plain)}`);
});
