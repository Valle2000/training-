# Training-App auf eigenem Konto betreiben

Diese Anleitung ist für alle, die die App selbst betreiben möchten – mit eigenem Supabase-Projekt,
eigenem Vercel-Konto und eigenen Schlüsseln. Deine Daten liegen dann nur bei dir.

> Du bekommst den Code als **eigene Kopie** (Fork). Änderungen machst du nur in deiner Kopie.
> Die Adresse und die Datenbank des Betreibers der ursprünglichen App brauchst du nicht.

## Was du brauchst

- Ein GitHub-Konto (kostenlos)
- Ein Vercel-Konto (kostenlos, Anmeldung mit GitHub)
- Ein Supabase-Konto (kostenlos)
- Optional: einen Anthropic-Schlüssel für den KI-Coach, Zugänge bei Polar, Concept2 oder Wahoo

Die kostenlosen Pläne reichen für eine Person völlig aus. Die Speichergrenzen gelten pro Projekt.

## Schritt 1: Eigene Kopie des Codes anlegen

1. Auf GitHub die Seite des Projekts öffnen und **Fork** wählen. Ziel: dein eigenes Konto.
2. Optional: Die Kopie privat stellen (Settings → Danger Zone → Change visibility), damit dein Code
   nicht öffentlich ist. Deine Schlüssel gehören sowieso nie ins Repository.

## Schritt 2: Supabase-Projekt anlegen

1. Auf <https://supabase.com> ein Konto anlegen und **New project** wählen.
2. Name frei wählen, eine Region in Europa nehmen, ein Datenbankpasswort vergeben und gut aufbewahren.
3. Warten, bis das Projekt bereit ist (ein bis zwei Minuten).
4. Im Menü **SQL Editor** öffnen, eine neue Abfrage anlegen, den Inhalt der Datei
   `supabase/training.sql` aus deiner Kopie einfügen und ausführen. Das legt die Tabellen und die
   Zugriffsregeln an, mit denen jeder nur seine eigenen Daten sieht.
5. Unter **Project Settings → API** zwei Werte kopieren:
   - **Project URL** → das wird `VITE_SUPABASE_URL`
   - **anon public** Schlüssel → das wird `VITE_SUPABASE_ANON_KEY`

**Wichtig:** Den Schlüssel mit der Bezeichnung **service_role** brauchst du nicht. Trage ihn nirgends ein
und gib ihn niemandem weiter. Der anon-Schlüssel ist für den Browser gedacht und darf öffentlich sein.

## Schritt 3: Vercel-Projekt anlegen

1. Auf <https://vercel.com> **Add New → Project** wählen und deine GitHub-Kopie auswählen.
2. Bei **Environment Variables** die Werte eintragen (siehe Tabelle unten).
3. **Deploy** wählen. Nach dem ersten Lauf steht die Adresse des Projekts fest, z. B.
   `https://mein-training.vercel.app`.
4. In den Variablen `APP_URL` mit dieser Adresse füllen und das Projekt neu deployen
   (Deployments → drei Punkte → Redeploy).

| Variable | Pflicht | Wert |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | ja | Project URL aus Schritt 2 |
| `VITE_SUPABASE_ANON_KEY` | ja | anon public Schlüssel aus Schritt 2 |
| `APP_URL` | ja | die Vercel-Adresse deines Projekts |
| `ANTHROPIC_API_KEY` | für KI | eigener Schlüssel von <https://console.anthropic.com> |
| `APP_ACCESS_CODE` | optional | ein Code, den nur du kennst, schützt die KI-Funktionen |
| `POLAR_CLIENT_ID`, `POLAR_CLIENT_SECRET` | nur für Polar | siehe Schritt 5 |
| `CONCEPT2_CLIENT_ID`, `CONCEPT2_CLIENT_SECRET` | nur für Concept2 | siehe Schritt 5 |
| `WAHOO_CLIENT_ID`, `WAHOO_CLIENT_SECRET` | nur für Wahoo | siehe Schritt 5 |

## Schritt 4: Anmeldung in Supabase erlauben

1. In Supabase unter **Authentication → URL Configuration** deine Vercel-Adresse bei
   **Site URL** und bei **Redirect URLs** eintragen. Das braucht die Passwort-Zurücksetzen-Mail.
2. Unter **Authentication → Providers** die E-Mail-Anmeldung aktiviert lassen (Standard).

## Schritt 5: Datenquellen anbinden (optional)

Jede Quelle braucht eine eigene App beim Anbieter. Als Redirect-URL immer
`<deine Vercel-Adresse>/api/connect` eintragen.

| Anbieter | Anmeldung für Entwickler | Hinweis |
| --- | --- | --- |
| Polar AccessLink | <https://admin.polaraccesslink.com> | Die Schnittstelle liefert nur die letzten 30 Tage. Ältere Einheiten über den Polar-Export (ZIP) importieren |
| Concept2 Logbook | <https://log.concept2.com/developers> | Liefert die ganze Historie über „Ganze Historie“ |
| Wahoo Cloud API | <https://developers.wahooligan.com> | Freigabe kann dauern |

Die Client-ID und das Geheimnis trägst du in Vercel ein, nie in den Code.

**Ohne eigene Anbieter-Apps läuft die App trotzdem:** Dann importierst du Einheiten als Datei
(FIT, TCX, GPX, Polar-Export als ZIP) unter **Mehr → Einstellungen → Vergangene Einheiten importieren**.

## Schritt 6: Auf dem Handy installieren

1. Die Vercel-Adresse im Browser des Handys öffnen.
2. **Teilen → Zum Home-Bildschirm** (iPhone) bzw. Menü → **App installieren** (Android).
3. In der App unter **Mehr → Einstellungen** mit deinem Supabase-Konto anmelden (E-Mail, Passwort).

Ab dann gleicht die App deine Daten zwischen Geräten ab.

## Mit oder ohne Anmeldung

- **Mit Anmeldung:** Daten werden zwischen deinen Geräten abgeglichen und in deinem Supabase-Projekt gespeichert.
- **Ohne Anmeldung:** Die App speichert alles nur auf dem Gerät. Exportiere regelmäßig ein Backup
  (**Einstellungen → Backup**), denn gelöschte Website-Daten im Browser sind weg.

## Eigener Anthropic-Schlüssel (für den KI-Coach)

Wenn du den Schlüssel nicht in Vercel hinterlegen willst, trägst du ihn in der App selbst ein
(**Einstellungen → Karte „KI-Zugang“**). Er bleibt auf deinem Gerät und wird nur bei jeder Anfrage mitgeschickt.
Die Kosten werden dann über dein Anthropic-Konto abgerechnet. In der App lässt sich außerdem ein
Monatsbudget einstellen.

## Häufige Probleme

- **„Anmeldung fehlgeschlagen“ oder keine Mail:** Redirect-URLs in Supabase prüfen (Schritt 4).
- **Verbindung zu Polar/Concept2/Wahoo schlägt fehl:** Redirect-URL beim Anbieter prüfen
  (`<deine Adresse>/api/connect`) und `APP_URL` in Vercel korrigieren, danach neu deployen.
- **KI antwortet nicht:** Eigener Schlüssel in der App hinterlegt oder `ANTHROPIC_API_KEY` in Vercel gesetzt?
  Wenn `APP_ACCESS_CODE` gesetzt ist, musst du den Code in der App eintragen.
- **Änderungen erscheinen nicht:** Nach Änderungen an Variablen immer neu deployen.
- **Daten fehlen auf dem zweiten Gerät:** Auf dem anderen Gerät mit demselben Konto anmelden und kurz warten.

## Updates aus dem Original übernehmen

In deiner Kopie auf GitHub **Sync fork** wählen, dann in Vercel neu deployen. Deine Umgebungsvariablen
bleiben dabei erhalten.
