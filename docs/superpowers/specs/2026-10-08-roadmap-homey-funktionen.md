# Roadmap: Funktionen nach Vorbild Homey

Stand: 08.10.2026. Wunsch von Maxim: Die Zentrale soll den räumlichen Aufbau von Homey
übernehmen und langfristig alle Homey-Funktionen bieten, aber über alle Anbieter hinweg
(Homey bindet viele Marken an, Yandex, Xiaomi und Aqara-Konten aber nur eingeschränkt).

Quelle: homey.app/de-de/homey-cloud und die Funktionsseiten unter homey.app/de-de/features
(Geräte, Apps, Flow, Advanced Flow, Energie, Einblicke, Dashboards, Moods).

## Grundsatz für alle Stufen

- Die Zentrale bleibt anbieterneutral: jede Funktion wirkt auf Geräte aller verbundenen
  Dienste gleich.
- Alles, was die Dienste selbst nicht speichern (Zonen, eigene Gruppen, Moods, Flows,
  Verlauf), speichert die Zentrale selbst.
- Automationen brauchen einen Rechner, der immer läuft. Solange nur die Desktop-App läuft,
  laufen Flows nur bei eingeschaltetem Mac. Für echten Dauerbetrieb kommt später ein kleiner
  Dienst auf einem Raspberry Pi, NAS oder Server dazu (derselbe Kern aus `core/`).

## Stufen

### Stufe 1b: Räumlicher Aufbau (Zonen), als Nächstes nach dem Grundgerüst

- [ ] Zonen frei verschachtelt: Haus, Etage, Raum (beliebige Tiefe), eigene Namen und Symbole
- [ ] Räume aller Dienste lassen sich einer Zone zuordnen; gleichnamige Räume werden wie
  bisher automatisch zusammengelegt
- [ ] Ohne eigene Einrichtung ergibt sich die Zone automatisch aus Haus und Raum der Dienste
- [ ] Zonen-Ansicht: Unterzonen und Geräte der Zone, oben eine Zusammenfassung
  (Temperatur, Licht an, Bewegung, offene Fenster)
- [ ] Zonen-Steuerung: Kategorien oben (Licht, Aktivität, Lautsprecher, Energie, Klima);
  eine ganze Zone auf einmal schalten oder dimmen, zum Beispiel alle Lichter im Erdgeschoss
- [ ] Zonenaktivität: Bewegungs- oder Türsensor meldet etwas, die Zone wird „aktiv“;
  nach Ruhe wieder „inaktiv“
- [ ] Eigene Gerätegruppen über Anbieter hinweg (Lampen, Stecker, Jalousien, Vorhänge)

### Stufe 5: Moods (Lichtstimmungen)

- [ ] Lichter verschiedener Marken zu einer Stimmung zusammenfassen
- [ ] Aktuelle Farben und Helligkeit als Mood speichern, Vorlagen mitliefern
- [ ] Moods gehören zu einer Zone und erscheinen dort
- [ ] Start per Fingertipp, aus einem Flow, aus dem Tray-Menü

### Stufe 6: Flows (Automationen)

- [ ] Wenn / Und / Dann über alle Dienste hinweg
- [ ] Auslöser: Gerätezustand, Sensorwert, Zeit, Sonnenauf- und -untergang, Zonenaktivität,
  Anwesenheit, Strompreis
- [ ] Bedingungen: Zeitfenster, Wochentag, Gerätezustand, Variablen
- [ ] Aktionen: Geräte, Gruppen, Zonen, Moods, Szenarien der Dienste, Benachrichtigung,
  Verzögerung
- [ ] Advanced Flow: Leinwand mit Start-Block, Verzögerung, ANY/ALL, Tags zwischen Karten,
  Notizzettel
- [ ] Logik und Variablen (Zahl, Text, Ja/Nein)
- [ ] Eigene Skripte (wie HomeyScript), nur für Fortgeschrittene
- [ ] Dauerbetrieb: Zentrale-Dienst für Raspberry Pi oder Docker

### Stufe 7: Einblicke (Verlauf)

- [ ] Alle Messwerte aller Geräte über die Zeit speichern (lokale Datenbank)
- [ ] Diagramme je Gerät und je Zone, frei kombinierbar
- [ ] Widgets für Messwerte

### Stufe 8: Energie

- [ ] Verbrauch je Gerät (Geräte mit Messung, smarte Steckdosen), Anteil am Gesamtverbrauch
- [ ] Smart Meter für Strom, Gas, Wasser (Live und Verlauf)
- [ ] Solaranlage, Eigenverbrauch, Batteriespeicher, E-Auto-Laden
- [ ] Preise fest oder dynamisch (z. B. Tibber, aWATTar), Kosten je Gerät
- [ ] Flow-Auslöser für Preis und Solarleistung

### Stufe 9: Dashboards

- [ ] Mehrere Dashboards (pro Raum, Energie, Sicherheit), Widgets in Spalten frei anordnen
- [ ] Widgets: Licht, Thermostat, Medien, Flow, Mood, Einblicke, Energie, Kamera
- [ ] Kiosk-Modus für ein Wand-Tablet

### Stufe 3 erweitert: Handy und Zugang

- [ ] Handy-App (Android, iPhone) mit demselben Kern
- [ ] Widgets für den Startbildschirm, Apple Watch
- [ ] Web-App im Browser, Fernzugriff von unterwegs
- [ ] Anwesenheit (wer ist zu Hause) über das Handy
- [ ] Push-Benachrichtigungen, Alarme

### Stufe 4 erweitert: Anbieter und Dienste

- [ ] Weitere Anbieter: Philips Hue, Tuya/Smart Life, Shelly, AVM FRITZ!, IKEA, Home Assistant,
  Netatmo, Somfy, Sonos, Bosch-Siemens Home Connect, Daikin
- [ ] Dienste: Regenradar, Spotify, Telegram, Discord, Slack, Google Sheets
- [ ] Sprachassistenten: Siri-Kurzbefehle zuerst (machbar), Alexa und Google später
  (brauchen eine eigene Cloud-Anbindung)
- [ ] Geführte Einrichtung neuer Geräte mit Bildern, Schritt für Schritt

### Stufe 10: Eigene Funktechnik (Hardware nötig)

- [ ] Matter und Thread (über matter.js, Thread braucht einen Border Router)
- [ ] Zigbee über einen USB-Stick (z. B. mit Zigbee2MQTT)
- [ ] Z-Wave, Bluetooth, 433 MHz, Infrarot nur mit passender Hardware

## Offene Fragen für später

- Wo soll der Dauerbetrieb laufen (Raspberry Pi, NAS, gemieteter Server)?
- Sollen Daten zwischen Mac, Handy und Vater geteilt werden (gemeinsames Konto)?
