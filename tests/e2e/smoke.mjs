// Klicktest der Hauptseiten im echten Browser (Chromium über Playwright).
// Start: `npm run test:e2e` (baut die App, startet die Vorschau, spielt Testdaten ein und klickt durch).
// Prüft, dass Seiten laden, nachgeladene Teile erscheinen und keine JavaScript-Fehler auftreten.
import { createRequire } from 'module';
import { writeFileSync, mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { preview } from 'vite';

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch {
  console.log('Playwright ist nicht installiert – Klicktest übersprungen.');
  process.exit(0);
}

// Testdaten mit heutigem Datum (Zeitzone wie in der App).
const day = (offset) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(Date.now() + offset * 864e5));
const today = day(0), yesterday = day(-1);
const fixture = {
  settings: { hrMax: 190, hrRest: 40, lthr: 170, thresholdPace: '3:35', ftp: 280, weightKg: 70, sex: 'm' },
  activities: [{ id: 'e2e-a1', date: yesterday, start: `${yesterday}T07:00:00Z`, sport: 'run', title: 'Testlauf', durationS: 3600, avgHr: 142, load: 62, zones: { I1: 3000, I2: 600, I3: 0, I4: 0, I5: 0 }, source: 'manual' }],
  plan: [
    { id: 'e2e-p1', date: today, sport: 'bike', minutes: 90, zone: 'I1', title: 'Locker (Rad)', load: 60, done: false, source: 'manual' },
    { id: 'e2e-p2', date: today, sport: 'run', minutes: 65, zone: 'I3', title: 'Laufen Tempo: 4×8 min', keyId: 'run_tempo4x8', load: 70, done: false, source: 'wizard' },
  ],
  wellness: Array.from({ length: 14 }, (_, i) => ({ date: day(-13 + i), hrv: 140 + (i % 5) * 4, restHr: 40 + (i % 3), sleepH: 7 + (i % 2) * 0.4 })),
  races: [{ id: 'e2e-r1', date: day(30), name: 'Testrennen', technique: 'Lauf', priority: 'B', distanceKm: 21.1 }],
};
const dir = mkdtempSync(join(tmpdir(), 'training-e2e-'));
const file = join(dir, 'backup.json');
writeFileSync(file, JSON.stringify(fixture));

const server = await preview({ preview: { port: 4189, strictPort: false }, logLevel: 'silent' });
const url = server.resolvedUrls.local[0];
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
const errors = [], failures = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('dialog', (d) => d.accept());

const step = async (name, fn) => {
  try { await fn(); console.log(`ok    ${name}`); } catch (e) { failures.push(name); console.log(`FEHLER ${name}: ${e.message.split('\n')[0]}`); }
};
const tab = (name) => page.getByRole('button', { name: new RegExp(`^${name}$`) }).first().click();
const see = (text, opts = {}) => page.getByText(text, opts).first().waitFor({ timeout: 8000 });

await page.goto(url, { waitUntil: 'networkidle' });
await step('Testdaten einspielen (Mehr → Backup)', async () => {
  await page.getByRole('button', { name: /Mehr/ }).first().click();
  await page.locator('input[type=file][accept=".json"]').setInputFiles(file);
  await see('Backup eingespielt');
});
await step('Heute: geplante Einheiten mit Ziel und Knöpfen', async () => {
  await tab('Heute');
  await see('Laufen Tempo: 4×8 min');
  await see(/Ziel:.*min\/km/);
  await page.getByRole('button', { name: 'Erledigt' }).first().waitFor();
});
await step('Heute: Rad wegen Wetter tauschen', async () => {
  await page.getByRole('button', { name: 'Wetter: tauschen' }).first().click();
  await page.getByRole('button', { name: 'Laufen', exact: true }).first().click();
  await see('Getauscht');
});
await step('Heute: „Wie war die Einheit?“ beantworten (RPE + Gefühl)', async () => {
  await see('Wie war die Einheit?');
  await page.getByRole('button', { name: '6', exact: true }).first().click();
  await see('Gespeichert: 6/10');
  await page.getByRole('button', { name: /Stark/ }).first().click();
});
await step('Kalender und Wochenliste', async () => {
  await tab('Kalender');
  await page.getByRole('heading', { name: 'Kalender' }).waitFor();
  await see('Summe je Sportart');
  await page.locator('.ag-vit').first().waitFor();
  if (process.env.SHOT) await page.locator('.agenda').screenshot({ path: process.env.SHOT });
  await page.getByRole('button', { name: 'Plan der Trainerin' }).click();
  await see('Plan der Trainerin übernehmen');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Wochenliste' }).click();
  await see(/Ziel:/);
});
await step('Saisonplan-Assistent öffnet sich', async () => {
  await page.getByRole('button', { name: 'Saison', exact: true }).click();
  await page.getByRole('button', { name: /Saisonplan-Assistent/ }).click();
  await page.getByRole('heading', { name: 'Saisonplan-Assistent' }).waitFor();
  await page.getByRole('button', { name: 'Schließen' }).first().click();
});
await step('Analyse', async () => { await tab('Analyse'); await page.getByRole('heading', { name: 'Analyse' }).waitFor(); });
await step('Kraft', async () => { await tab('Kraft'); await page.getByRole('heading', { name: 'Kraft' }).waitFor(); });
await step('Essen', async () => { await tab('Essen'); await page.getByRole('heading', { name: 'Ernährung', exact: true, level: 1 }).waitFor(); });
await step('Coach → Wissen mit Kapiteln, FAQ', async () => {
  await tab('Coach');
  await page.getByRole('button', { name: 'Wissen', exact: true }).click();
  const n = await page.locator('details[id^="chapter-"]').count();
  if (n < 6) throw new Error(`nur ${n} Kapitel`);
  await page.getByRole('button', { name: 'FAQ', exact: true }).click();
  await see('Soll ich im Langlauf Gewicht verlieren?');
});
await step('Mehr: Einstellungen', async () => { await page.getByRole('button', { name: /Mehr/ }).first().click(); await see('Konto & Abgleich'); });
await step('Keine JavaScript-Fehler', async () => { if (errors.length) throw new Error(errors.join(' | ')); });

await browser.close();
await new Promise((r) => server.httpServer.close(r));
console.log(failures.length ? `\n${failures.length} Schritt(e) fehlgeschlagen.` : '\nAlle Schritte bestanden.');
process.exit(failures.length ? 1 : 0);
