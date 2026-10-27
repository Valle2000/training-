// Rezeptkatalog, Nährwertberechnung, Tagestipp und Schweißrate.
import test from 'node:test';
import assert from 'node:assert/strict';
import { CATALOG, recipeNutrients, toRecipe, filterCatalog, scaleFor, SLOTS } from '../src/lib/recipes.js';
import { nutrientsOf, amountText } from '../src/lib/foods.js';
import { nutritionTips, suggestDay, dayKind } from '../src/lib/nutrition.js';
import { sweatRate, GUIDE, NUTRITION_SOURCES } from '../src/lib/nutrition-guide.js';
import { trainingOf, raceSoon } from '../src/lib/food-day.js';

test('Katalog: gültige Zutaten, eindeutige IDs, jede Mahlzeit vorhanden', () => {
  assert.ok(CATALOG.length >= 60);
  assert.equal(new Set(CATALOG.map((r) => r.id)).size, CATALOG.length);
  for (const r of CATALOG) { const n = recipeNutrients(r, 70); assert.ok(n.kcal > 50, r.id); assert.ok(r.steps.length && r.tip, r.id); }
  for (const [slot] of SLOTS) assert.ok(filterCatalog({ slot }).length >= 4, slot);
  for (const ctx of ['hart', 'trainlow', 'hitze', 'kaelte', 'wettkampf']) assert.ok(filterCatalog({ ctx }).length >= 3, ctx);
  assert.ok(filterCatalog({ diet: 'vegan' }).every((r) => r.diet === 'vegan'));
  for (const s of GUIDE.flatMap((g) => g.sources)) assert.ok(NUTRITION_SOURCES[s], s);
});

test('Nährwerte und Mengen skalieren mit dem Gewicht', () => {
  const n = nutrientsOf([['hafer', 100], ['milch', 200]]);
  assert.equal(Math.round(n.kh), 69);
  assert.equal(Math.round(n.calcium), 290);
  const r = CATALOG.find((x) => x.id === 'porridge-banane');
  assert.ok(recipeNutrients(r, 84).kh > recipeNutrients(r, 70).kh * 1.15);
  assert.equal(scaleFor(200), 1.35);
  assert.equal(amountText('banane', 120), '1 × Banane (120 g)');
  assert.equal(amountText('milch', 300), '300 ml Milch 1,5 %');
  const rec = toRecipe(r, 70);
  assert.ok(rec.makros.kh > 100 && rec.mikro.magnesium > 150 && rec.zutaten.length === r.items.length);
});

test('Tagestipp: Double Threshold, Hitze, Ruhetag, Rennen', () => {
  const dt = [{ sport: 'skierg', minutes: 100, hard: 40, time: '08:00' }, { sport: 'rollerski_skate', minutes: 80, hard: 30, time: '17:00' }];
  assert.equal(dayKind(dt).double, true);
  const tips = nutritionTips({ date: '2026-07-10', today: dt, weightKg: 75, heat: true, sweat: { drinkPerHour: 1, sodiumPerHour: 700, sodiumPerL: 700 } });
  assert.match(tips[0].title + tips[1].title, /Double Threshold/);
  assert.ok(tips.some((x) => /Hitze/.test(x.title) && /700 mg/.test(x.text)));
  assert.ok(tips.some((x) => /1 l und ca. 700 mg/.test(x.text)));
  assert.ok(nutritionTips({ date: '2026-07-11', today: [], weightKg: 75 }).some((x) => x.title === 'Ruhetag'));
  const race = nutritionTips({ date: '2026-03-06', today: [], weightKg: 70, raceSoon: { days: 1, long: true } });
  assert.match(race[0].text, /700–840 g/);
  assert.ok(nutritionTips({ date: '2026-01-05', today: [{ sport: 'xc_skate', minutes: 60, hard: 0 }], cold: true }).some((x) => x.title === 'Kälte'));
});

test('Tagesvorschlag: passt zur Situation, keine doppelten Rezepte, Ernährungsform', () => {
  const day = suggestDay({ today: [{ sport: 'bike', minutes: 180, hard: 30, time: '09:00' }], tomorrow: [{ sport: 'run', minutes: 120, hard: 40 }], diet: 'vegan', seed: 5 });
  const ids = day.map((m) => m.r.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(day.every((m) => m.r.diet === 'vegan'));
  assert.ok(day.some((m) => m.slot === 'waehrend') && day.some((m) => m.slot === 'nachher'));
  assert.ok(day.find((m) => m.slot === 'abend').r.ctx.includes('hart'));
  const low = suggestDay({ today: [{ sport: 'run', minutes: 50, hard: 0, time: '07:00' }], tomorrow: [{ sport: 'run', minutes: 50, hard: 0 }], seed: 1 });
  assert.ok(low.find((m) => m.slot === 'fruehstueck').r.ctx.some((c) => c === 'trainlow' || c === 'locker'));
});

test('Schweißrate und Trainingstag aus Plan/Rennen', () => {
  const s = sweatRate({ before: 75, after: 74, drankMl: 500, minutes: 60 });
  assert.equal(s.perHour, 1.5);
  assert.equal(s.lossPct, 1.3);
  assert.equal(s.drinkPerHour, 1.2);
  assert.equal(sweatRate({ before: '', after: 70, minutes: 60 }), null);
  const data = { activities: [], plan: [{ date: '2026-08-01', sport: 'run', minutes: 60, zone: 'I4' }], races: [{ date: '2026-08-02', name: 'Testlauf', distanceKm: 42 }], settings: { food: { trainingTime: '7:30 und 17:00' } } };
  const tr = trainingOf('2026-08-01', data);
  assert.equal(tr[0].time, '07:30');
  assert.equal(tr[0].hard, 60);
  assert.deepEqual(raceSoon('2026-08-01', data.races), { name: 'Testlauf', days: 1, long: true });
});
