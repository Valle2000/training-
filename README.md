# Training

Kostenlose, selbst gehostete Trainings-App für Skilanglauf, gebaut wie SkiWax AI: React + Vite als
installierbare Web-App (PWA), Server-Funktionen auf Vercel, KI über Claude.

## Was die App kann

- **Heute**: Fitness, Ermüdung und Form (wie CTL/ATL/TSB) mit Prognose aus dem Trainingsplan,
  Tageseinschätzung aus Form und HRV, HRV/Schlaf/Form als Verlauf, Essensbedarf des Tages
- **Kalender**: Einheiten planen (Belastung wird geschätzt und fließt in die Formprognose ein),
  Soll/Ist je Woche, verpasste Einheiten, Vorwoche kopieren; Liste und Detailansicht mit Puls- und
  Leistungsverlauf, IF, EF, Entkopplung, kJ, VI, Laktat, RPE, Key-Session-Zuordnung
- **Analyse** (wie TrainingPeaks/WKO): frei wählbare Zeiträume (4 Wochen bis alles, Saison ab 1. Mai,
  eigener Zeitraum), Filter nach Sportart, Vergleich zum Vorzeitraum, Stunden/Belastung/Distanz/
  Höhenmeter/kJ je Woche oder Monat, Tabelle nach Sportart und Monat, Puls- und Leistungszonen
  (I1–I5 und Coggan Z1–Z7), Leistungs- und Pulskurve (Bestwerte 5 s bis 3 h) mit Vorzeitraum und
  Allzeit, W/kg, FTP-Schätzung, Ramp Rate, HRV/Schlaf/Ruhepuls, Effizienz-Trend, aerobe Entkopplung
- **Key Sessions**: eigene Schlüsseleinheiten (z. B. Double Threshold 5×6 min); alle passenden
  Einheiten werden verglichen (Watt über die Intervalllänge, Puls, Watt pro Puls, Laktat, RPE)
- **Kraft**: Katalog mit gut 30 langlaufrelevanten Übungen (Maximalkraft, Explosiv, spezifisch,
  einbeinig, Rumpf, Prophylaxe) inklusive Begründung und Ausführung, Vorlagen für zwei Einheiten
  pro Woche, Eintragen von Sätzen mit Wiederholungen und Gewicht, „Letztes Mal“-Anzeige,
  geschätztes 1RM und Verlauf je Übung, eigene Übungen
- **Essen**: Tagesbedarf (Kohlenhydrate, Eiweiß, Fett, kcal) nach Trainingsumfang und -intensität,
  KI-Essensplan mit Rezepten, Einkaufsliste und Favoriten, abgestimmt auf Trainingszeiten und Vorlieben
- **Laktat-Stufentest** (Analyse → Laktat): Stufen eintragen, LT1 (Basis + 0,5 mmol), LT2 (modifizierte
  Dmax), 2/4 mmol, persönliche Pulszonen nach Laktat; Zonen, Schwellenpuls und FTP übernehmen; Vergleich
  mit dem Vortest
- **Morgen-Check und Tagesampel**: Gefühl, Schlaf, Muskelkater, Stress, Symptome, Gewicht; Ampel aus
  Check, HRV-Trend, Ruhepuls und Form
- **Saisonplanung** (Kalender → Saison): Phasen rückwärts vom A-Rennen, Wochenziele im 3:1-Rhythmus,
  Tapering, Ist/Ziel, Form-Prognose für den Renntag
- **Rennen**: A/B/C-Rennen, Ergebnisse mit Zeit, Platz und Rückstand auf den Sieger in %, Verlauf
- **Workouts** (Kalender → Workouts): Baukasten mit Wiederholungen und Zielen (Zone, % FTP, Puls),
  Belastungsschätzung, Planen im Kalender, Export als FIT (Garmin, Wahoo) und ZWO (Zwift)
- **Material und Gesundheit** (Mehr): km/Stunden je Ski, Rollski, Schuh, Rad mit Service-Erinnerung;
  Krankheiten/Verletzungen mit Ausfalltagen und der Belastungsentwicklung davor
- **Wissen & FAQ**: Lexikon mit Kernaussagen aus der Trainingswissenschaft (inkl. Studien 2023–2026),
  Evidenzstufe und Quellen
- **Coach**: KI-Analyse der letzten 12 Wochen anhand der Studienlage im Langlauf (Intensitäts-
  verteilung, Double Threshold, Kraft, Belastungssteuerung, Erholung) mit 7-Tage-Plan, der sich mit
  einem Klick in den Kalender übernehmen lässt
- **Datenquellen**: Polar (Einheiten, Nightly Recharge/HRV, Schlaf), Concept2 Logbook (ErgData:
  SkiErg, RowErg, BikeErg mit Schlagdaten und Watt), Wahoo, FIT-Upload, manuelle Einheiten.
  Doppelt aufgezeichnete Einheiten (z. B. Polar-Uhr und Wahoo gleichzeitig) werden erkannt.

### Wie gerechnet wird

| Größe | Berechnung |
| --- | --- |
| Belastung (≈ TSS) | mit Watt (Rad, Ergometer): Dauer × NP × IF / (FTP × 3600) × 100; sonst Banister-TRIMP aus dem Pulsverlauf, skaliert auf 100 pro Stunde an der Laktatschwelle; notfalls Durchschnittspuls oder RPE |
| Fitness / Ermüdung | exponentieller Schnitt der Tagesbelastung über 42 bzw. 7 Tage |
| Form | Fitness − Ermüdung vom Vortag |
| Zonen | % Maximalpuls: I1 55–72, I2 72–82, I3 82–87, I4 87–92, I5 > 92; Leistung nach Coggan (% FTP) |
| FTP | getrennt für Rad, SkiErg und Rudern |
| EF / Entkopplung | NP / Ø Puls; Abfall Leistung:Puls von 1. zu 2. Hälfte in % |
| Bestwertkurve | höchster Durchschnitt je Dauer (5 s … 3 h) |
| Kraft-Belastung | Dauer × (RPE/10)² × 100 |
| Concept2-Watt | 2,80 / (Pace in s/m)³ |

## Starten

```bash
npm install
cp .env.example .env   # Schlüssel eintragen (siehe unten)
npm run dev
```

Die App läuft dann auf <http://localhost:5173>. Alle Daten liegen lokal im Browser (localStorage
und IndexedDB). Unter „Mehr“ gibt es ein JSON-Backup.

## Online stellen (Vercel)

Wie bei SkiWax: Repo bei Vercel importieren, die Variablen aus `.env.example` als Environment
Variables eintragen, `APP_URL` auf die Vercel-Adresse setzen. Auf dem Handy die Seite öffnen und
„Zum Home-Bildschirm“ wählen.

## Datenquellen einrichten

Bei jedem Anbieter eine eigene App anlegen. Als Redirect-URL immer `<APP_URL>/api/connect`
eintragen (lokal: `http://localhost:5173/api/connect`).

| Anbieter | Registrierung | Variablen |
| --- | --- | --- |
| Polar AccessLink | <https://admin.polaraccesslink.com> | `POLAR_CLIENT_ID`, `POLAR_CLIENT_SECRET` |
| Concept2 Logbook | <https://log.concept2.com/developers> | `CONCEPT2_CLIENT_ID`, `CONCEPT2_CLIENT_SECRET` |
| Wahoo Cloud API | <https://developers.wahooligan.com> | `WAHOO_CLIENT_ID`, `WAHOO_CLIENT_SECRET` |

Hinweise:
- Unter Einstellungen → Verbindungen → „Testen“ zeigt die App die Rohantworten der Anbieter
  (Status, Anzahl, Feldnamen) – hilfreich, falls beim ersten Abgleich etwas nicht passt.
- Ältere Einheiten: unter Mehr → Einstellungen → „Vergangene Einheiten importieren“ Dateien wählen
  (FIT, TCX, GPX, Polar-CSV, Polar-Konto-Export als JSON, ZIP). Bei Concept2 und Wahoo lädt
  „Ganze Historie“ alles über die Schnittstelle.
- Polar liefert über die Schnittstelle nur Einheiten der letzten 30 Tage. Ältere Daten in Polar Flow
  exportieren und als FIT importieren.
- ErgData lädt Einheiten automatisch ins Concept2 Logbook; die App holt sie dort ab (letzte 90 Tage).
- Bei Wahoo sind neue Apps zunächst im Sandbox-Modus; für dauerhaften Zugriff muss die App bei
  Wahoo freigeschaltet werden.

## KI

`ANTHROPIC_API_KEY` bleibt auf dem Server. Coach und Essensplan nutzen Claude Opus 5.5 mit
automatischem Ersatzmodell, falls eine Anfrage abgelehnt wird. Mit `APP_ACCESS_CODE` lässt sich der
Zugang schützen; alternativ kann jeder Nutzer unter „Mehr“ einen eigenen Schlüssel eintragen.
Gesendet wird nur eine kompakte Zusammenfassung, keine Rohdaten.

## Entwicklung

```bash
npm test        # ESLint + Tests (Rechenkern, FIT-Import, Kraft, Ernährung)
npm run build
```

| Pfad | Inhalt |
| --- | --- |
| `src/lib/metrics.js` | Belastung, Zonen, Fitness/Ermüdung/Form |
| `src/lib/activities.js` | Einheiten anlegen, Dubletten, Wochen, Zusammenfassung für den Coach |
| `src/lib/fit.js`, `series.js` | FIT einlesen (Garmin FIT SDK), 1-Hz-Raster |
| `src/lib/sync.js` | Abgleich Polar, Concept2, Wahoo; FIT-Import |
| `src/lib/strength.js` | Kraftkatalog, Vorlagen, 1RM |
| `src/lib/nutrition.js` | Tagesbedarf |
| `server/connect.mjs` | OAuth und Weiterleitung zu den Anbietern |
| `server/ai.mjs` | KI-Coach und Essensplan (Claude) |
| `src/ui/` | Bildschirme |

## Nächste Schritte

- Geräteübergreifender Sync über Supabase (wie in SkiWax)
- Automatischer Abgleich im Hintergrund (Webhooks) und Sync zwischen Geräten über Supabase
