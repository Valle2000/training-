// Saisonplan-Assistent: Wochen nach Ansatz, Umfang, Ruhetagen und gewählten Key Sessions.
import test from 'node:test';
import assert from 'node:assert/strict';
import { generatePlan, toPlanItems, APPROACHES } from '../src/lib/plan-wizard.js';
import { busyOn } from '../src/lib/week-adapt.js';

const races = [{ date: '2027-02-20', name: 'Engadin', priority: 'A', distanceKm: 42 }];
const base = { startHours: 13, peakHours: 16, start: '2026-11-02', end: '2027-03-01', restDays: [1], longDay: 7, doubles: true, strengthPerWeek: 2 };

test('Alle Ansätze: Stunden passen, max. 2 Einheiten/Tag, Ruhetag frei', () => {
  for (const ap of APPROACHES) {
    const w = generatePlan({ ...base, approach: ap.id }, races);
    assert.ok(w.length >= 17, ap.id);
    for (const x of w) {
      // Eine lockere Einheit pro Tag (kein Zweitaufgebot): in dichten Wochen fehlen bewusst ein bis zwei Stunden – die Vorschau zeigt das.
      assert.ok(Math.abs(x.plannedHours - x.targetHours) <= 3, `${ap.id} ${x.from}: ${x.plannedHours} vs ${x.targetHours}`);
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

test('Alltag: an Uni-Tagen nur so viel, wie in die freie Zeit passt', async () => {
  const { freeMinutes } = await import('../src/lib/week-adapt.js');
  const schedule = { start: '06:30', end: '21:30', buffer: 15, blocks: [{ id: 'u', dows: [2, 3, 4, 5], from: '08:00', to: '19:00' }] };
  const w = generatePlan({ ...base, approach: 'pyramidal', capFor: (d) => freeMinutes(d, schedule) }, races);
  for (const x of w) for (const d of x.days) {
    const free = freeMinutes(d.date, schedule), sum = d.sessions.reduce((a, s) => a + s.minutes, 0) + (d.sessions.length > 1 ? 30 : 0);
    assert.ok(sum <= free, `${d.date}: ${sum} > ${free}`);
  }
});

test('Rennen nach Priorität: B mit Mini-Taper und Vorbelastung, C ersetzt harte Einheit, nie hart neben Rennen', () => {
  const rs = [
    { id: 'a', date: '2027-03-14', name: 'Engadin', priority: 'A', distanceKm: 42 },
    { id: 'b', date: '2027-01-16', name: 'Volkslauf', priority: 'B', distanceKm: 25 },
    { id: 'c', date: '2026-12-12', name: 'Testrennen', priority: 'C', distanceKm: 10 },
  ];
  const o = { ...base, start: '2026-11-02', end: '2027-03-21', approach: 'pyramidal' };
  const w = generatePlan(o, rs);
  const wb = w.find((x) => x.from === '2027-01-11'), wc = w.find((x) => x.from === '2026-12-07');
  assert.ok(wb.mini);
  const prevB = w.find((x) => x.from === '2027-01-04');
  assert.ok(wb.targetHours < prevB.targetHours);
  const all = (x) => x.days.flatMap((d) => d.sessions.map((s) => ({ ...s, date: d.date })));
  assert.ok(all(wb).some((s) => s.keyId === 'opener' && s.date === '2027-01-15'));
  for (const [wk, race] of [[wb, '2027-01-16'], [wc, '2026-12-12']]) {
    const hard = all(wk).filter((s) => s.kind === 'hard' && s.keyId !== 'opener');
    for (const s of hard) assert.ok(Math.abs(Date.parse(s.date) - Date.parse(race)) > 864e5, `${s.title} ${s.date}`);
    assert.ok(all(wk).filter((s) => s.date === race).every((s) => s.kind === 'race'));
  }
  const hardC = all(wc).filter((s) => s.kind === 'hard').length, hardNormal = all(w.find((x) => x.from === '2026-11-30')).filter((s) => s.kind === 'hard').length;
  assert.ok(hardC < hardNormal, `${hardC} vs ${hardNormal}`);
});

test('Hinweise zur Rennplanung', async () => {
  const { raceAdvice } = await import('../src/lib/season.js');
  const adv = raceAdvice([{ name: 'X', date: '2027-01-10', priority: 'A' }, { name: 'Y', date: '2027-01-24', priority: 'A' }], '2026-11-01');
  assert.ok(adv.some((x) => x.text.includes('Wettkampfblock')));
  assert.ok(raceAdvice([{ name: 'Z', date: '2027-01-10', priority: 'C' }], '2026-11-01').some((x) => x.text.includes('Kein A-Rennen')));
});

test('Harte Tage wählbar: Mi + Sa, Norwegisch mit einem Double-Threshold-Tag', async () => {
  const { suggestHardDays, hardDayCount, checkHardDays, KEY_OPTIONS } = await import('../src/lib/plan-wizard.js');
  assert.equal(hardDayCount('norwegian', 1), 2);
  assert.equal(hardDayCount('norwegian', 2), 3);
  assert.ok(suggestHardDays(2, { restDays: [1], longDay: 7 }).some((c) => c.join() === '3,6'));
  assert.ok(checkHardDays([3, 4], { needed: 2 })[0].includes('zu nah'));
  const w = generatePlan({ ...base, start: '2026-11-02', end: '2026-12-06', approach: 'norwegian', dtDays: 1, hardDays: [3, 6] }, []);
  for (const x of w.filter((y) => y.phase === 'build')) {
    const hardDows = [...new Set(x.days.filter((d) => d.sessions.some((s) => s.kind === 'hard')).map((d) => d.dow))];
    assert.ok(hardDows.every((d) => [3, 6].includes(d)), `${x.from}: ${hardDows}`);
    const dt = x.days.filter((d) => d.sessions.filter((s) => s.kind === 'hard').length === 2);
    assert.ok(dt.length <= 1);
  }
  assert.ok(KEY_OPTIONS.filter((k) => k.type !== 'opener' && k.type !== 'speed' && k.type !== 'long' && k.type !== 'strength').every((k) => k.why), 'alle Intervalle haben eine Begründung');
});

test('Multisport: Schwerpunkte setzen die Sportart, Triathlon bekommt Koppeltraining', async () => {
  const { focusOn, raceSport } = await import('../src/lib/plan-wizard.js');
  const list = [{ sport: 'run', from: '2027-06-01', to: '2027-08-31' }, { sport: 'tri', from: '2027-05-01', to: '2027-08-31' }];
  assert.equal(focusOn('2027-06-15', list), 'run');
  assert.equal(focusOn('2027-05-15', list), 'tri');
  assert.equal(focusOn('2027-09-15', list), null);
  assert.equal(raceSport('Triathlon', '2027-07-01'), 'run');
  assert.equal(raceSport('Rad', '2027-07-01'), 'bike');
  const o = { ...base, start: '2027-05-03', end: '2027-08-29', approach: 'pyramidal' };
  const run = generatePlan({ ...o, focusFor: (m) => focusOn(m, [{ sport: 'run', from: '2027-05-01', to: '2027-08-31' }]) }, []);
  const easy = run.flatMap((w) => w.days.flatMap((d) => d.sessions)).filter((s) => s.kind === 'easy' && s.title.startsWith('Locker ('));
  assert.ok(easy.length > 0 && easy.every((s) => s.sport === 'run'), 'lockere Einheiten laufen');
  const tri = generatePlan({ ...o, focusFor: (m) => focusOn(m, list) }, [{ id: 'r', date: '2027-08-15', name: 'Triathlon Sprint', priority: 'A', technique: 'Triathlon', distanceKm: 25 }]);
  const brick = tri.flatMap((w) => w.days.flatMap((d) => d.sessions)).filter((s) => s.title.startsWith('Koppeln'));
  assert.ok(brick.length >= 2, 'Koppeltraining je Woche in Aufbau/Vorbereitung');
  const race = tri.flatMap((w) => w.days.flatMap((d) => d.sessions)).find((s) => s.title.startsWith('Rennen: Triathlon'));
  assert.equal(race.sport, 'run');
});

test('Winter ohne Schnee: Laufen statt Ski, Double Threshold morgens Rad, abends Laufen', async () => {
  const { focusOn, noSnowOn } = await import('../src/lib/plan-wizard.js');
  const snow = [{ snow: false, from: '2027-12-01', to: '2027-12-31' }];
  assert.ok(noSnowOn('2027-12-10', snow));
  assert.equal(focusOn('2027-12-10', [], snow, 'run'), 'run');
  assert.equal(focusOn('2027-12-10', [], snow, 'bike'), 'bike');
  assert.equal(focusOn('2027-01-10', [], snow, 'run'), null);
  const o = { ...base, start: '2027-12-06', end: '2027-12-26', approach: 'norwegian', dtDays: 1, hardDays: [3, 6], focusFor: (m) => focusOn(m, [], snow, 'run') };
  const w = generatePlan(o, []);
  const dt = w.flatMap((x) => x.days.flatMap((d) => d.sessions)).filter((s) => /Double Threshold/.test(s.title));
  assert.ok(dt.some((s) => s.title.includes('morgens') && s.sport === 'bike'), 'DT morgens Rad');
  assert.ok(dt.some((s) => s.title.includes('abends') && s.sport === 'run'), 'DT abends Laufen');
});

test('Winter ohne Schnee mit Rad als Ersatz: beide Double-Threshold-Einheiten auf dem Rad', async () => {
  const { focusOn } = await import('../src/lib/plan-wizard.js');
  const snow = [{ snow: false, from: '2027-12-01', to: '2027-12-31' }];
  const w = generatePlan({ ...base, start: '2027-12-06', end: '2027-12-26', approach: 'norwegian', dtDays: 1, hardDays: [3, 6], focusFor: (m) => focusOn(m, [], snow, 'bike') }, []);
  const dt = w.flatMap((x) => x.days.flatMap((d) => d.sessions)).filter((s) => /Double Threshold/.test(s.title));
  assert.ok(dt.length > 0 && dt.every((s) => s.sport === 'bike'), JSON.stringify(dt.map((s) => s.sport)));
});

test('Rhythmus und Abstand: 3:1 lässt jede 4. Woche Double Threshold aus, Abstand 2 Tage', async () => {
  const { suggestHardDays, checkHardDays } = await import('../src/lib/plan-wizard.js');
  const w = generatePlan({ ...base, start: '2026-11-02', end: '2026-12-27', approach: 'norwegian', dtDays: 1, dtRhythm: '3:1' }, []);
  const dtWeeks = w.map((x, i) => [i, x.days.flatMap((d) => d.sessions).some((s) => s.keyId && /^dt_(am|pm)$/.test(s.keyId))]);
  assert.ok(dtWeeks.filter(([i]) => i % 4 === 3).every(([, on]) => !on), 'jede 4. Woche ohne DT');
  assert.ok(dtWeeks.filter(([i]) => i % 4 !== 3).every(([, on]) => on), 'übrige Wochen mit DT');
  for (const c of suggestHardDays(2, { restDays: [1], longDay: 7, minGap: 2 })) assert.ok(Math.abs(c[0] - c[1]) >= 2 && 7 - Math.abs(c[0] - c[1]) >= 2, c.join());
  assert.ok(checkHardDays([3, 4], { needed: 2, minGap: 2 }).some((x) => x.includes('zu nah')));
});

test('Nur bei Bedarf zwei Einheiten am Tag; Kraft nie am Tag vor einer harten Einheit', () => {
  const w = generatePlan({ ...base, start: '2026-11-02', end: '2027-02-28', approach: 'norwegian', dtDays: 2, hardDays: [3, 6], strengthPerWeek: 2, doubles: false }, []);
  for (const x of w) {
    for (const d of x.days) {
      const hard = d.sessions.filter((s) => s.kind === 'hard').length;
      const easy = d.sessions.filter((s) => s.kind === 'easy' || s.kind === 'long').length;
      if (!(hard === 2)) assert.ok(d.sessions.length <= 2 && easy <= 2, `${d.date}: ${d.sessions.map((s) => s.title)}`);
      const next = x.days[d.dow];
      if (next && next.sessions.some((s) => s.kind === 'hard')) assert.ok(!d.sessions.some((s) => s.kind === 'strength'), `Kraft vor Intervall am ${d.date}`);
    }
  }
});

test('Double Threshold: an Uni-Tagen nur eine Einheit, an freien Tagen zwei', () => {
  const schedule = { start: '06:30', end: '22:00', buffer: 15, blocks: [{ id: 'u', label: 'Uni', dows: [1, 2, 3, 4, 5], from: '08:00', to: '17:00' }], oneOff: [] };
  const busy = (d) => busyOn(d, schedule).length > 0;
  const rs = [{ id: 'a', date: '2027-02-20', name: 'Engadin', priority: 'A', distanceKm: 42 }];
  const w = generatePlan({ ...base, start: '2026-11-02', end: '2026-12-27', approach: 'norwegian', dtDays: 2, hardDays: [3, 6], doubles: false, busyFor: busy }, rs);
  const days = w.flatMap((x) => x.days);
  const dtDoubleBusy = days.filter((d) => busy(d.date) && d.sessions.filter((s) => s.kind === 'hard').length > 1);
  assert.equal(dtDoubleBusy.length, 0, dtDoubleBusy.map((d) => d.date).join());
  assert.ok(days.some((d) => !busy(d.date) && d.sessions.filter((s) => s.kind === 'hard').length === 2), 'an freien Tagen zweimal');
  const never = generatePlan({ ...base, start: '2026-11-02', end: '2026-12-27', approach: 'norwegian', dtDays: 2, hardDays: [3, 6], doubles: false, dtDouble: 'never' }, rs);
  assert.ok(never.flatMap((x) => x.days).every((d) => d.sessions.filter((s) => s.kind === 'hard').length <= 1));
});


test('Standard: zwei Einheiten am Tag, Dienstag eine, Kraft bevorzugt Donnerstag/Sonntag', () => {
  // Langtag Freitag, harte Tage Dienstag und Samstag: Donnerstag und Sonntag sind dann frei für Kraft.
  const w = generatePlan({ ...base, start: '2026-11-02', end: '2026-12-27', approach: 'pyramidal', singleDays: [2], strengthDays: [4, 7], longDay: 5, hardDays: [2, 6] }, []);
  const days = w.flatMap((x) => x.days);
  assert.ok(days.filter((d) => d.dow === 2).every((d) => d.sessions.length <= 1), 'Dienstag eine Einheit');
  const strength = days.filter((d) => d.sessions.some((s) => s.kind === 'strength'));
  assert.ok(strength.length > 0 && strength.every((d) => [4, 7].includes(d.dow)), `Kraft an: ${strength.map((d) => d.dow)}`);
  assert.ok(days.some((d) => d.sessions.length === 2 && d.dow !== 2), 'an anderen Tagen zwei Einheiten');
});
