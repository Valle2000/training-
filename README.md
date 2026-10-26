# Training

Kostenlose, selbst gehostete Trainings-App für Skilanglauf, gebaut wie SkiWax AI: React + Vite als
installierbare Web-App (PWA), Server-Funktionen auf Vercel, KI über Claude.

## Was die App kann

- **Heute**: Fitness, Ermüdung und Form (wie CTL/ATL/TSB) mit Prognose aus dem Trainingsplan,
  Tageseinschätzung aus Form und HRV, Erholungswerte, Essensbedarf des Tages
- **Training**: Wochenkalender mit erledigten und geplanten Einheiten, Liste, Detailansicht mit Puls-
  und Leistungsverlauf, Laktat, RPE und Notizen; Stunden je Woche nach Intensitätszone
  (Olympiatoppen I1–I5) und Verteilung locker/Schwelle/hart
- **Kraft**: Katalog mit gut 30 langlaufrelevanten Übungen (Maximalkraft, Explosiv, spezifisch,
  einbeinig, Rumpf, Prophylaxe) inklusive Begründung und Ausführung, Vorlagen für zwei Einheiten
  pro Woche, Eintragen von Sätzen mit Wiederholungen und Gewicht, „Letztes Mal“-Anzeige,
  geschätztes 1RM und Verlauf je Übung, eigene Übungen
- **Essen**: Tagesbedarf (Kohlenhydrate, Eiweiß, Fett, kcal) nach Trainingsumfang und -intensität,
  KI-Essensplan mit Rezepten, Einkaufsliste und Favoriten, abgestimmt auf Trainingszeiten und Vorlieben
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
| Zonen | % Maximalpuls: I1 55–72, I2 72–82, I3 82–87, I4 87–92, I5 > 92 |
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
- Leistungskurve (Bestwerte 5 s bis 60 min) und Pulskurve
- Workout-Builder und Export geplanter Einheiten
- Laktat-Stufentest mit Schwellenbestimmung
