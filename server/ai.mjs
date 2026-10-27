// KI-Coach und Ernährungsplanung mit Claude. Der API-Schlüssel bleibt auf dem Server (ANTHROPIC_API_KEY),
// der Browser schickt nur eine kompakte Zusammenfassung der Trainingsdaten.
import Anthropic from '@anthropic-ai/sdk';
import { AsyncLocalStorage } from 'node:async_hooks';

const MODEL = 'claude-opus-5-5';

const COACH_SYSTEM = `Du bist ein erfahrener Skilanglauf-Trainer mit sportwissenschaftlichem Hintergrund und berätst einen ambitionierten Athleten.
Du bekommst eine kompakte Zusammenfassung seiner Trainingsdaten: Wochenumfänge je Intensitätszone (Olympiatoppen I1–I5 nach % HFmax), Belastung, Fitness/Ermüdung/Form (Modell wie CTL/ATL/TSB), Einheiten der letzten 21 Tage, Krafttraining, Erholungswerte (HRV, Schlaf, Ruhepuls) und seine eigene Strategie.

Stütze deine Empfehlungen auf die Studienlage im Ausdauer- und Langlaufsport, unter anderem:
- Intensitätsverteilung: Weltklasse-Langläufer trainieren rund 90 % der Ausdauerzeit locker (91/3/6 als Junioren, 92/4/4 als Senioren; Walther et al. 2023), pyramidal bis polarisiert (Seiler & Kjerland 2006; Sandbakk & Holmberg 2017). Polarisiert ist laut Metaanalyse nicht klar überlegen (Oliveira et al. 2024). Typischer Fehler: zu viel Zeit in der Grauzone zwischen I2 und I3.
- Umfangsentwicklung: Der Weg zur Weltklasse lief über lange, schrittweise Steigerung vor allem des lockeren Volumens (Walther et al. 2023; Staff et al. 2025).
- Wochenstruktur: harte Tage alle 3–4 Tage, leichter Tag/Ruhe alle 8–9 Tage, Tage entweder lang oder intensiv (Walther, Kocbach & Sandbakk 2025); 2–3 Schlüsseltage pro Woche mit 3–5 intensiven Einheiten (Sandbakk et al. 2025).
- Schwellentraining und Double Threshold (norwegisches Modell): zwei kontrollierte Schwelleneinheiten am selben Tag, Laktat etwa 2–3,5 mmol/l, Intervalle statt Dauerläufe (z. B. 5×6 min, 4×8–10 min, 10×3 min), bewusst nicht "auf Anschlag". Einstieg mit einem Double-Threshold-Tag pro Woche, die übrigen Tage dann wirklich locker. Die Evidenz kommt überwiegend aus Praxisberichten und kleinen Studien – sag das.
- Hochintensives Training (I4/I5): kleiner Anteil, gezielt in der wettkampfnahen Phase; 1–2 harte Einheiten pro Woche zusätzlich zu Schwellenarbeit sind für die meisten das Maximum.
- Krafttraining: schwere Maximalkraft (3–5 Wdh., hohe Lasten, explosive konzentrische Phase) plus Schnellkraft verbessert Ökonomie und Doppelstockleistung (Rønnestad & Mujika 2014; Losnegard et al. 2011; Østerås et al. 2002). 2 Einheiten pro Woche in der Vorbereitung, 1 zum Erhalt in der Saison. Kraft nicht direkt vor wichtigen Schwellen- oder Intervalleinheiten.
- Spezifität: Rollski, Skigang/Sprunglauf mit Stöcken bergauf, SkiErg/Doppelstock im Sommer; Schnee so bald wie möglich.
- Belastungssteuerung: Umfang pro Woche um höchstens ~10 % steigern, Entlastungswoche etwa alle 3–4 Wochen; Form deutlich unter −30 über längere Zeit ist ein Warnsignal. Tapering 7–14 Tage mit 40–60 % weniger Umfang bei erhaltener Intensität (Bosquet et al. 2007).
- Erholung: fallende HRV-Werte über mehrere Tage, erhöhter Ruhepuls oder schlechter Schlaf sprechen für weniger Intensität (Plews et al. 2013; HRV-Metaanalysen 2020/2021). Große Belastungsschwankungen gehen mit mehr Infekten einher (Svendsen et al. 2016). Energiemangel (REDs, IOC-Konsens 2023) ist bei Langläufern in umfangreichen Phasen verbreitet (Bushmanova et al. 2024).
- Key Sessions: Wenn Daten zu wiederkehrenden Schlüsseleinheiten mitkommen, beurteile den Fortschritt (mehr Watt bei gleichem Puls/Laktat).
- Saison und Rennen: Richte den Wochenplan an der Saisonphase (Feld saison: Phase und Zielstunden) und an kommenden Rennen aus; vor A-Rennen Tapering, nach Rennen Erholung.
- Gesundheit: Bei aktuellen Krankheiten/Verletzungen oder Symptomen im Morgen-Check kein intensives Training planen; bei Symptomen unterhalb des Halses Pause.
- Laktat: Liegt ein Laktattest vor, nutze dessen Pulswerte für Zonen- und Intensitätsangaben (z. B. Schwellenintervalle mit konkretem Pulsbereich).

Regeln:
- Beziehe dich konkret auf die Daten (Wochen, Daten, Zonenanteile). Erfinde keine Einheiten oder Messwerte.
- Prüfe die Strategie des Athleten ehrlich: Was passt, was ist riskant, was fehlt?
- Wenn Daten fehlen (z. B. keine Schwellenwerte, keine Pulsdaten), sag es und berücksichtige die Unsicherheit.
- Der Wochenplan beginnt am Tag nach "heute" (oder heute, falls dort noch nichts trainiert wurde), umfasst 7 Tage und nutzt nur die Sportarten aus der Liste. Krafteinheiten bekommen konkrete Übungen mit Sätzen, Wiederholungen und Belastungshinweis in der Beschreibung.
- Schätze die Belastung jeder geplanten Einheit im gleichen Maßstab (1 h an der Schwelle = 100, 1 h locker I1 ≈ 50–60, Kraft 1 h ≈ 40–50).
- Keine medizinischen Diagnosen; bei Schmerzen, Krankheit oder auffälligen Werten Arztbesuch empfehlen.
- Antworte auf Deutsch, knapp und praxisnah.`;

const SPORT_IDS = ['xc_skate', 'xc_classic', 'rollerski_skate', 'rollerski_classic', 'skierg', 'run', 'hike', 'bike', 'row', 'bikeerg', 'swim', 'strength', 'mobility', 'other', 'rest'];

const COACH_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['zusammenfassung', 'analyse', 'warnungen', 'wochenplan', 'quellen'],
  properties: {
    zusammenfassung: { type: 'string', description: 'Kurzfazit in 2–4 Sätzen' },
    analyse: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['titel', 'text', 'bewertung'], properties: {
      titel: { type: 'string' }, text: { type: 'string' }, bewertung: { type: 'string', enum: ['gut', 'achtung', 'kritisch', 'info'] } } } },
    warnungen: { type: 'array', items: { type: 'string' } },
    wochenplan: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['datum', 'titel', 'sport', 'minuten', 'zone', 'beschreibung', 'belastung'], properties: {
      datum: { type: 'string', description: 'YYYY-MM-DD' }, titel: { type: 'string' }, sport: { type: 'string', enum: SPORT_IDS },
      minuten: { type: 'integer' }, zone: { type: 'string', enum: ['I1', 'I2', 'I3', 'I4', 'I5', 'Kraft', 'Ruhe'] },
      beschreibung: { type: 'string' }, belastung: { type: 'integer' } } } },
    quellen: { type: 'array', items: { type: 'string' }, description: 'Studien/Autoren, auf die sich die Empfehlungen stützen' },
  },
};

const FOOD_SYSTEM = `Du bist Sporternährungsberater für Ausdauersportler (Skilanglauf). Du erstellst alltagstaugliche Tagespläne mit Rezepten.
Grundlagen: IOC-Konsens und Positionspapiere (Thomas, Erdman & Burke 2016; Burke et al. 2011/2019): Kohlenhydrate nach Trainingsumfang periodisieren, Eiweiß 1,6–2,0 g/kg auf 4–5 Mahlzeiten verteilt (je ~0,3–0,4 g/kg), vor harten Einheiten kohlenhydratbetont und fettarm, danach innerhalb von 1–2 h Kohlenhydrate + 20–40 g Eiweiß, bei Einheiten über 90 min 60–90 g Kohlenhydrate pro Stunde während des Trainings. Energiemangel (RED-S) vermeiden.
Regeln:
- Halte dich an die vorgegebenen Tagesziele (±10 %) und an Vorlieben, Unverträglichkeiten und Kochzeit.
- Plane die Mahlzeiten um die Trainingszeiten herum, inklusive Verpflegung während langer Einheiten.
- Rezepte mit realistischen Mengen für die angegebene Portionszahl, einfachen Zutaten aus dem deutschen Supermarkt und klaren Schritten. Makros pro Portion schätzen.
- Rezepte dürfen über Tage wiederverwendet werden (Meal Prep), das spart Zeit.
- Ein Rezeptkatalog der App wird mitgeschickt (Name [Mahlzeit; Situation; Ernährungsform]). Nutze passende Katalogrezepte gern mit genau diesem Namen (Mengen an die Ziele anpassen) und ergänze eigene Rezepte für Abwechslung.
- Vor harten Einheiten (Schwelle, Intervalle, Double Threshold) kohlenhydratreich und leicht verdaulich; zwischen zwei Einheiten am selben Tag schnell auffüllen (ca. 1 g KH/kg pro Stunde bis zur nächsten Einheit). Vor lockeren Einheiten unter 90 min darf es gelegentlich eiweiß- und gemüsebetont mit wenig Kohlenhydraten sein (Train Low, max. 1–2× pro Woche, nur wenn erlaubt).
- Mikronährstoffe: über die Tage Eisen (Hülsenfrüchte, Hirse, Haferflocken, rotes Fleisch 1–2×/Woche, mit Vitamin C kombiniert), Calcium, Vitamin D (Fisch, Eier; Winter), Omega-3 (1–2× Fisch/Woche, Leinöl, Walnüsse), Magnesium/Kalium (Vollkorn, Nüsse, Kerne, Kartoffeln) und Folat (grünes Gemüse) gezielt abdecken; vegan: B12-Hinweis.
- Hitze (Feld hitze): mehr Flüssigkeit und Natrium einplanen (Getränk mit 500–1000 mg Natrium pro Liter, salzige Snacks), kühle, leichte Mahlzeiten; bei angegebener Schweißrate die Trinkmenge pro Stunde daraus ableiten (ca. 70–80 % ersetzen).
- Während Einheiten über 75 min konkrete Verpflegung pro Stunde angeben (Getränk, Gel, Riegel, Banane).
- Hinweise: 2–4 kurze, konkrete Tipps zu Timing, Trinken und Mikronährstoffen für genau diese Tage.
- Antworte auf Deutsch.`;

const FOOD_SCHEMA = {
  type: 'object', additionalProperties: false, required: ['tage', 'rezepte', 'einkaufsliste', 'hinweise'],
  properties: {
    tage: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['datum', 'mahlzeiten'], properties: {
      datum: { type: 'string' },
      mahlzeiten: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['zeit', 'typ', 'rezept', 'portionen'], properties: {
        zeit: { type: 'string', description: 'z. B. 07:00 oder "während Training"' }, typ: { type: 'string' }, rezept: { type: 'string', description: 'Name des Rezepts aus rezepte' }, portionen: { type: 'number' } } } } } } },
    rezepte: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['name', 'portionen', 'zeitMin', 'zutaten', 'schritte', 'makros', 'tags'], properties: {
      name: { type: 'string' }, portionen: { type: 'integer' }, zeitMin: { type: 'integer' },
      zutaten: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['menge', 'zutat'], properties: { menge: { type: 'string' }, zutat: { type: 'string' } } } },
      schritte: { type: 'array', items: { type: 'string' } },
      makros: { type: 'object', additionalProperties: false, required: ['kcal', 'kh', 'eiweiss', 'fett'], description: 'pro Portion', properties: { kcal: { type: 'integer' }, kh: { type: 'integer' }, eiweiss: { type: 'integer' }, fett: { type: 'integer' } } },
      tags: { type: 'array', items: { type: 'string' } } } } },
    einkaufsliste: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['zutat', 'menge'], properties: { zutat: { type: 'string' }, menge: { type: 'string' } } } },
    hinweise: { type: 'array', items: { type: 'string' } },
  },
};

// Eigener Schlüssel: Schickt der Browser einen eigenen Anthropic-API-Schlüssel mit (Header x-anthropic-key),
// läuft die Anfrage über dieses Konto. Der Schlüssel wird nicht gespeichert oder geloggt.
const requestKey = new AsyncLocalStorage();
const ownKeyOf = (headers) => { const k = String(headers['x-anthropic-key'] || '').trim(); return /^sk-ant-[\w-]{20,}$/.test(k) ? k : null; };
function httpError(status, message) { const e = new Error(message); e.status = status; return e; }

function client() {
  const apiKey = requestKey.getStore()?.apiKey || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw httpError(503, 'Kein Anthropic-API-Schlüssel: ANTHROPIC_API_KEY auf dem Server setzen oder unter Einstellungen einen eigenen Schlüssel eintragen.');
  return new Anthropic({ apiKey });
}

async function askClaude({ system, schema, content, effort }) {
  const response = await client().beta.messages.stream({
    model: MODEL,
    max_tokens: 64000,
    // Lehnt das Modell ab, springt automatisch ein passendes Ersatzmodell ein.
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    cache_control: { type: 'ephemeral' },
    system,
    output_config: { effort, format: { type: 'json_schema', schema } },
    messages: [{ role: 'user', content }],
  }).finalMessage().catch((e) => {
    if (requestKey.getStore()?.apiKey && e?.status === 401) throw httpError(400, 'Dein Anthropic-API-Schlüssel wurde abgelehnt.');
    throw e;
  });
  if (response.stop_reason === 'refusal') throw httpError(422, 'Die KI hat die Anfrage abgelehnt.');
  if (response.stop_reason === 'max_tokens') throw httpError(502, 'Antwort wurde abgeschnitten.');
  const text = response.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
  return { ...JSON.parse(text), model: response.model };
}

async function coach(body) {
  const { daten, frage } = body;
  if (!daten) throw httpError(400, 'Trainingsdaten fehlen');
  const content = `Trainingsdaten (JSON):\n${JSON.stringify(daten)}\n\n${frage ? `Frage des Athleten: ${frage}` : 'Analysiere mein Training und erstelle den Plan für die nächsten 7 Tage.'}`;
  return askClaude({ system: COACH_SYSTEM, schema: COACH_SCHEMA, content, effort: 'high' });
}

async function food(body) {
  const { tage, vorlieben } = body;
  if (!tage?.length) throw httpError(400, 'Tage fehlen');
  const content = `Tagesziele und Training (JSON):\n${JSON.stringify(tage)}\n\nVorlieben und Rahmen:\n${JSON.stringify(vorlieben || {})}${Array.isArray(body.katalog) ? `\n\nRezeptkatalog der App:\n${body.katalog.slice(0, 150).map((x) => String(x).slice(0, 160)).join('\n')}` : ''}\n\nErstelle den Ernährungsplan mit Rezepten und Einkaufsliste.`;
  return askClaude({ system: FOOD_SYSTEM, schema: FOOD_SCHEMA, content, effort: 'medium' });
}

const routes = { '/api/coach': coach, '/api/ernaehrung': food };

// Optionaler Zugangscode: Ist APP_ACCESS_CODE gesetzt, muss der Browser ihn im Header x-access-code mitsenden.
function checkAccess(headers) {
  const code = process.env.APP_ACCESS_CODE;
  if (code && headers['x-access-code'] !== code) throw httpError(401, 'Zugangscode fehlt oder ist falsch.');
}

export async function handleAi(path, body, headers) {
  const apiKey = ownKeyOf(headers);
  if (!apiKey) checkAccess(headers);
  return requestKey.run({ apiKey }, () => routes[path](body || {}));
}
export const aiRoutes = Object.keys(routes);
