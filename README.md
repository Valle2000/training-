# Training

Eine selbst gehostete, kostenlose Trainingsauswertung als Alternative zu TrainingPeaks.
Sie holt Einheiten von Polar (oder per FIT-Upload), berechnet eine Belastung pro Einheit
und zeigt Fitness, Ermüdung und Form über die Zeit.

## Was die erste Version kann

- **Polar-Sync** über die AccessLink API (OAuth, manueller Sync-Button, optional Webhook)
- **FIT-Upload**, mehrere Dateien auf einmal, z. B. aus dem Polar-Flow-Export für ältere Daten
- **Belastung pro Einheit**
  - mit Wattmesser: Dauer × NP × IF / (FTP × 3600) × 100
  - sonst aus dem Pulsverlauf (Banister-TRIMP, so skaliert, dass 1 h an der Laktatschwelle = 100)
  - notfalls aus dem Durchschnittspuls
- **Fitness / Ermüdung / Form** (42- bzw. 7-Tage-Schnitt, Form = Fitness − Ermüdung vom Vortag),
  inklusive 14-Tage-Prognose ohne weiteres Training
- **Einheiten-Liste und Detailansicht** mit Puls- und Leistungsverlauf
- Dubletten werden erkannt (gleiche Startzeit), Änderungen an FTP oder Schwelle berechnen alles neu

Die Namen Fitness, Ermüdung, Form und Belastung stehen für das, was TrainingPeaks CTL, ATL,
TSB und TSS nennt (dort Markennamen).

## Starten

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env        # Polar-Zugangsdaten eintragen (optional)
uvicorn app.main:app --env-file .env --reload
```

Dann <http://localhost:8000> öffnen, unter **Einstellungen** FTP und/oder Puls-Schwellen eintragen
und Einheiten hochladen oder Polar verbinden. Daten liegen in `./data` (SQLite + FIT-Dateien).

## Polar einrichten

1. Auf <https://admin.polaraccesslink.com> mit dem Polar-Konto anmelden und einen Client anlegen.
2. Als Redirect-URL `http://localhost:8000/polar/callback` eintragen (bzw. die URL deines Servers).
3. Client-ID und Secret in `.env` eintragen, Server neu starten.
4. In der App auf **Polar verbinden** klicken, danach **Mit Polar synchronisieren**.

Die AccessLink API liefert nur Einheiten der letzten 30 Tage. Ältere Daten:
in Polar Flow unter *Einstellungen → Daten herunterladen* exportieren und die FIT-Dateien hochladen.

Optional kann Polar bei neuen Einheiten selbst Bescheid geben: Webhook für
`https://<dein-server>/polar/webhook` mit Event `EXERCISE` anlegen
(`POST https://www.polaraccesslink.com/v3/webhooks`, Basic-Auth mit Client-ID/Secret) und den
zurückgegebenen `signature_secret_key` als `POLAR_WEBHOOK_SECRET` setzen. Dafür muss der Server
öffentlich erreichbar sein.

## Tests

```bash
pip install -r requirements-dev.txt
pytest
```

## Aufbau

| Datei | Inhalt |
| --- | --- |
| `app/metrics.py` | NP, Belastung (Leistung/Puls), TRIMP, Fitness/Ermüdung/Form |
| `app/fitfile.py` | FIT einlesen, auf 1-Hz-Raster bringen, Pausen erkennen |
| `app/service.py` | Import, Neuberechnung, Tagesbelastung, Verlauf |
| `app/polar.py` | Polar AccessLink: OAuth, Sync, Webhook-Signatur |
| `app/db.py` | SQLite-Schema und Einstellungen |
| `app/main.py` | FastAPI-Routen und JSON-API für die Diagramme |
| `app/templates/` | Oberfläche (Jinja2 + Chart.js) |

## Nächste Schritte

- Trainingskalender mit geplanten Einheiten und geplanter Belastung (fließt in die Prognose ein)
- Leistungs- und Pulskurve (beste Werte über 5 s bis 60 min), Zeit in Zonen
- Polar Nightly Recharge / HRV und Schlaf als Trend neben der Form
- Strava-Import, FTP-Verlauf über die Zeit statt eines festen Werts
