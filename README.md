# Hochlandrinder – Gilden-Dashboard (WoW Forever, EU)

Statistik-Seite für die Gilde. Die Daten kommen automatisch aus der Blizzard-API
und werden alle 3 Stunden aktualisiert. Läuft kostenlos auf GitHub Pages.

## Was liegt wo?

| Datei | Wozu |
|---|---|
| `index.html` | Die Website |
| `mitglieder.json` | **Liste der Charaktere** – hier Mitglieder eintragen/austragen |
| `scripts/update-data.mjs` | Holt die Daten von Blizzard |
| `.github/workflows/update.yml` | Startet den Abruf automatisch und veröffentlicht die Seite |
| `data/snapshots.json` | Gespeicherte Tagesstände (entsteht automatisch, nicht von Hand ändern) |

## Mitglieder pflegen

`mitglieder.json` auf GitHub öffnen → Stift-Symbol → bearbeiten → „Commit changes“.

```json
{ "vorname": "Bruno", "nachname": "Hornfels", "rang": "Gildenmeister" }
```

- Vor- und Nachname genau wie im Spiel (Groß-/Kleinschreibung egal).
- Rang: frei wählbar, z. B. Gildenmeister, Offizier, Mitglied, Rekrut.
- Nach dem Speichern wird die Seite automatisch neu gebaut (dauert 1–2 Minuten).

## Gut zu wissen

- Blizzard zeigt Charaktere erst ab **Stufe 10** und erst, nachdem sie sich **einmal ausgeloggt** haben.
- „Diese Woche“ zählt ab dem Reset am Mittwoch. Verläufe entstehen ab dem ersten Abruf – je länger die Seite läuft, desto schöner die Diagramme.
- Die Forever-Schnittstelle von Blizzard ist noch inoffiziell. Wenn ein Abruf fehlschlägt,
  bleibt die Seite mit dem letzten Stand online. Fehler siehst du unter **Actions**.
- Manuell aktualisieren: **Actions** → „Daten aktualisieren und Seite veröffentlichen“ → **Run workflow**.

Inoffizielle Fanseite, nicht mit Blizzard Entertainment verbunden.
