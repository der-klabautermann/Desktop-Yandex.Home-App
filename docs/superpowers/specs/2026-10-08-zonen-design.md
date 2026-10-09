# Stufe 1b: Räumlicher Aufbau (Zonen)

Stand: 08.10.2026. Wunsch Maxim: räumlicher Aufbau wie bei Homey. Gesamtliste in
`2026-10-08-roadmap-homey-funktionen.md`.

## Prinzip

- Oberste Ebene bleibt das Haus (Household). Darunter ein frei verschachtelter Baum aus
  **Räumen** (kommen aus den Diensten, gleichnamige sind schon zusammengelegt) und
  **eigenen Zonen** (z. B. „Erdgeschoss", „Obergeschoss", „Garten"), die nur die Zentrale kennt.
- Ohne Einrichtung sieht alles aus wie bisher: alle Räume direkt unter dem Haus.
- Ein Raum oder eine Zone kann in eine eigene Zone verschoben werden. Zonen können Zonen
  enthalten (beliebige Tiefe). Ringe werden verhindert.
- Eine Zone zeigt alle Geräte ihrer Räume und Unterzonen.

## Speicherung

- Datei `zones.json` im App-Datenordner, gelesen und geschrieben über den Hauptprozess
  (`zones:load`, `zones:save`), damit später auch Handy und Dauerbetrieb sie nutzen können.
- Format:
  ```json
  { "version": 1,
    "zones": [{ "id": "zone:abc", "name": "Erdgeschoss", "householdId": "h1", "icon": "layers" }],
    "parents": { "<raum-id oder zone-id>": "zone:abc" } }
  ```
- Raum-IDs sind die bestehenden IDs (für Navigation, Favoriten, Einklappen bleibt alles gleich).
- Verschwindet ein Raum oder eine Zone, wird der Eintrag ignoriert (kein Fehler).

## Logik im Kern (`core/zones.ts`, getestet)

- `buildZoneTree(home, config, householdId)`: Baum mit Knoten `{ id, kind: 'room' | 'zone',
  name, icon, children, deviceIds (direkt), allDeviceIds (mit Unterzonen) }`.
- `addZone`, `renameZone`, `setZoneIcon`, `moveNode`, `removeZone` (Kinder rücken eine Ebene
  hoch), alle als reine Funktionen auf der Konfiguration.
- `summarizeDevices(devices)`: Licht (an/gesamt), Steckdosen (an/gesamt), Temperatur und
  Luftfeuchte (Mittelwert), Bewegung erkannt, offene Fenster und Türen, nicht erreichbare.
- `isZoneActive(summary)`: Bewegung erkannt oder etwas offen (Zonenaktivität).

## Oberfläche

- Seitenleiste: „Räume" wird „Räume und Zonen" als aufklappbarer Baum, mit grünem Punkt
  bei aktiver Zone. Unten „+ Zone hinzufügen".
- Zonen-Ansicht (Klick auf Raum oder Zone): oben Zusammenfassungs-Chips (Temperatur,
  Luftfeuchte, Bewegung, offen); darunter Zonen-Steuerung: „Licht" und „Steckdosen" mit
  Zähler, ein Klick schaltet alle in der Zone aus (oder an, wenn alle aus sind). Darunter
  Geräte; bei Zonen mit Unterräumen je Unterraum ein Abschnitt.
- „Zone bearbeiten" (Stift in der Kopfzeile der Zonen-Ansicht): Name und Symbol (nur eigene
  Zonen), „Gehört zu" (Haus oder eine Zone), Löschen (nur eigene Zonen).
- Startansicht „Alle Geräte": Räume in Baum-Reihenfolge, eigene Zonen als Zwischenüberschrift.
- Nicht erreichbare Geräte zählen in der Zusammenfassung nicht als an und werden bei
  Zonen-Schaltern übersprungen.

## Umsetzung (Aufgaben)

- [x] `core/zones.ts` mit Tests (Baum, Verschieben ohne Ringe, Löschen, Zusammenfassung)
- [x] Hauptprozess: `zones:load`, `zones:save`; Preload; Typen; Vorschau-Mock
- [x] Hook `useZones` (laden, speichern, Baum für das aktive Haus)
- [x] Seitenleiste mit Zonenbaum und „Zone hinzufügen"
- [x] Zonen-Ansicht mit Zusammenfassung, Zonen-Steuerung, Unterzonen
- [x] Zonen-Dialog (anlegen, umbenennen, Symbol, verschieben, löschen)
- [x] Startansicht in Baum-Reihenfolge mit Zonen-Überschriften
- [x] Texte DE/EN/RU, Prüfung in der Vorschau

## Nachtrag 09.10.2026: Rest der Stufe 1b

- **Zonen-Steuerung nach Kategorien** (`zoneCategories`, `categoryOf` in `core/zones.ts`):
  Licht, Steckdosen, Klima (Thermostat, Lüftung, Befeuchter, Reiniger), Vorhänge, Medien.
  Nur Geräte mit An/Aus zählen. Klick schaltet alle aus, wenn eines an ist, sonst alle an.
  Licht hat einen angesetzten Einstellknopf (Helligkeit, Farbe), Klima ebenso, wenn alle
  Geräte Thermostate oder alle Ventilatoren sind. Die Zone gibt sich dafür als Gruppe aus,
  die vorhandenen Gruppen-Dialoge schalten Gerät für Gerät über den Hub.
- **Energie:** Summe aller `power`-Messwerte der Zone in Watt.
- **Aktivität mit Nachlauf:** aktiv bei Bewegung oder Offenem; nach dem letzten
  Bewegungsereignis noch 5 Minuten (`ACTIVITY_HOLD_MS`). Ein altes „Bewegung erkannt“ mit
  Zeitstempel zählt nicht mehr als aktuell. Die Zonenleiste zeigt dann „vor 3 Min.“.
- **Eigene Gerätegruppen** (`core/groups.ts`): gespeichert als `groups` in `zones.json`
  (`{ id: "cgroup:…", name, householdId, deviceIds }`). In der Oberfläche erscheinen sie
  wie Gruppen der Dienste (Seitenleiste, Räume, Favoriten, Tray). Schalten läuft über
  `onSetPower` je Gerät. Anlegen über „+“ bei „Gerätegruppen“, ändern und löschen über
  „Bearbeiten“ in der Gruppen-Ansicht. Auswahl nur Geräte mit An/Aus, nach Räumen sortiert.
- Steuerleiste `ZoneControls` gilt für Zonen und Gruppen gleichermaßen.
