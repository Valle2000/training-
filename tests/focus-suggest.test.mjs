import { test } from 'node:test';
import assert from 'node:assert/strict';
import { focusSuggestions } from '../src/lib/plan-wizard.js';

test('Lauf-Rennen mit Priorität B: Vorschlag über vier Wochen, nach einem Ski-A-Rennen', () => {
  const races = [
    { id: 'eng', date: '2027-03-14', name: 'Engadiner', technique: 'Skating', priority: 'A' },
    { id: 'fr', date: '2027-04-04', name: 'Freiburg HM', technique: 'Lauf', priority: 'B' },
  ];
  const s = focusSuggestions(races, []);
  assert.equal(s.length, 1);
  assert.equal(s[0].sport, 'run');
  assert.equal(s[0].from, '2027-03-15');
  assert.equal(s[0].to, '2027-04-04');
});

test('A-Rennen im Rad: acht Wochen Vorlauf', () => {
  const s = focusSuggestions([{ id: 'x', date: '2027-06-20', name: 'Alpenbrevet', technique: 'Rad', priority: 'A' }], []);
  assert.equal(s[0].sport, 'bike');
  assert.equal(s[0].from, '2027-04-25');
});

test('C-Rennen und Ski-Rennen erzeugen keinen Vorschlag', () => {
  assert.equal(focusSuggestions([{ id: 'c', date: '2027-06-20', name: 'Trainingslauf', technique: 'Lauf', priority: 'C' }], []).length, 0);
  assert.equal(focusSuggestions([{ id: 's', date: '2027-03-14', name: 'Engadiner', technique: 'Skating', priority: 'A' }], []).length, 0);
});

test('Keine Vorschläge bei Überschneidung mit einem bestehenden Zeitraum', () => {
  const races = [{ id: 'fr', date: '2027-04-04', name: 'Freiburg HM', technique: 'Lauf', priority: 'B' }];
  assert.equal(focusSuggestions(races, [{ id: 'f', sport: 'run', from: '2027-03-01', to: '2027-03-31' }]).length, 0);
});
