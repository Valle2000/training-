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
  assert.equal(recommend({ weak: ['threshold'], seriousness: 'ambitious' }, 10).approach, 'threshold');
  assert.equal(recommend({ weak: ['threshold'], seriousness: 'performance' }, 14).approach, 'norwegian');
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
  const liked = generatePlan({ ...o, profile: { likes: ['bike'], seriousness: 'performance' } }, []);
  assert.ok(count(liked) > count(plain), `${count(liked)} vs ${count(plain)}`);
});

test('Schwellenbetont: 2× Schwelle pro Woche, I4 und I5 je ca. 1× pro Zyklus, nicht in der Entlastungswoche', () => {
  const w = generatePlan({ ...base, start: '2026-11-02', end: '2027-01-31', approach: 'threshold' }, []).filter((x) => x.phase === 'build' || x.phase === 'base');
  const hard = (x) => x.days.flatMap((d) => d.sessions.filter((s) => s.kind === 'hard'));
  w.forEach((x, i) => {
    const deload = i > 0 && x.targetHours < w[i - 1].targetHours * 0.85;
    assert.equal(hard(x).filter((s) => s.zone === 'I3').length, deload ? 1 : 2, x.from);
    if (deload) assert.ok(!hard(x).some((s) => s.zone === 'I4' || s.zone === 'I5'), x.from);
  });
  const i5 = w.filter((x) => hard(x).some((s) => s.zone === 'I5')).length, i4 = w.filter((x) => hard(x).some((s) => s.zone === 'I4')).length;
  if (w.some((x) => x.phase === 'build')) { assert.ok(i5 >= 1 && i5 <= Math.ceil(w.length / 4)); assert.ok(i4 <= Math.ceil(w.length / 2)); }
  assert.ok(hard(w[0]).some((s) => /6×10|3×20|6×8/.test(s.title)));
});

test('Nicht so ernst: lockere Einheiten mit freier Sportart, leistungsorientiert fest', async () => {
  const { flexible } = await import('../src/lib/plan-wizard.js');
  assert.equal(flexible({ seriousness: 'fun' }, '2027-05-10'), true);
  assert.equal(flexible({ seriousness: 'fun' }, '2027-01-10'), false);
  assert.equal(flexible({ seriousness: 'ambitious' }, '2027-08-10'), false);
  assert.equal(flexible({ seriousness: 'performance' }, '2027-05-10'), false);
  const o = { ...base, start: '2027-05-03', end: '2027-06-27', approach: 'polarized' };
  const free = (p) => generatePlan({ ...o, profile: p }, []).flatMap((x) => x.days.flatMap((d) => d.sessions)).filter((s) => s.title === 'Locker nach Lust').length;
  assert.ok(free({ seriousness: 'fun', likes: ['bike', 'run'] }) > 0);
  assert.equal(free({ seriousness: 'performance' }), 0);
});

test('Katalog: Dauer aus Wiederholungen, eigene Double-Threshold-Einheiten im Plan', async () => {
  const { makeKey, allOptions, KEY_OPTIONS } = await import('../src/lib/plan-wizard.js');
  assert.ok(KEY_OPTIONS.length >= 45);
  assert.equal(new Set(KEY_OPTIONS.map((k) => k.id)).size, KEY_OPTIONS.length);
  const k = makeKey({ id: 'x', type: 'dt_am', reps: 3, work: 20, rest: 2 });
  assert.equal(k.name, 'Double Threshold morgens: 3×20 min');
  assert.equal(k.minutes, 100); // 20 + 60 + 4 + 15 → auf 5 gerundet
  assert.equal(makeKey({ id: 'y', type: 'hit', zone: 'I5', reps: 13, work: 30, rest: 15, unit: 's', sets: 3, warm: 15, cool: 10 }).zone, 'I5');
  const customKeys = [{ id: 'c_am', spec: { type: 'dt_am', reps: 3, work: 20, rest: 2, sport: 'specific' } }, { id: 'c_pm', spec: { type: 'dt_pm', reps: 8, work: 4, rest: 1, sport: 'run' } }];
  assert.equal(allOptions(customKeys).length, KEY_OPTIONS.length + 2);
  const w = generatePlan({ ...base, approach: 'norwegian', keys: ['c_am', 'c_pm', 'hit_5x4', 'long'], customKeys }, races);
  const s = w.find((x) => x.phase === 'build').days.flatMap((d) => d.sessions);
  assert.ok(s.some((x) => x.keyId === 'c_am' && x.minutes === 100));
  assert.ok(s.some((x) => x.keyId === 'c_pm' && x.sport === 'run'));
});
