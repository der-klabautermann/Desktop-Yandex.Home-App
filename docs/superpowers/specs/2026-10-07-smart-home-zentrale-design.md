# Smart-Home-Zentrale: Design (Stufe 1)

Stand: 07.10.2026. Freigegeben von Maxim im Gespräch am selben Tag.

## Ziel

Die App wird von einer reinen Yandex-Oberfläche zu einer Zentrale, an die mehrere
Smart-Home-Dienste angebunden werden. Man wählt einen Dienst aus, meldet sich dort an,
und dessen Geräte erscheinen in der gemeinsamen Übersicht und werden dort bedient.
Zielnutzer: Maxim und sein Vater. Zielgeräte: Mac, Windows, später Handy.

## Umfang Stufe 1

Enthalten:

- Dienste-Verwaltung („Мои сервисы") mit Anbieter-Auswahl und Anmeldung je Dienst
- Drei Dienste: Яндекс (bestehender Code, umgezogen), Xiaomi Home, Aqara
- Gemeinsames Dashboard über alle Dienste, Räume zusammengeführt
- Anleitung zur Anmeldung bei jedem Dienst, direkt neben dem Anmeldeformular
- Oberfläche in drei Sprachen: Deutsch, Englisch, Russisch
- Lauffähig auf dem Mac

Nicht enthalten (spätere Stufen):

- Stufe 2: Windows-Installer
- Stufe 3: Handy-App (Android, iPhone)
- Stufe 4: weitere Dienste (Tuya, Hue, Shelly, AVM FRITZ!, Home Assistant …)
- Automationen, Push-Benachrichtigungen, Fernzugriff von unterwegs
- Kameras anderer Dienste als Яндекс

## Bedienung

### Dienste

- Neuer Bereich „Мои сервисы": je verbundenem Dienst eine Karte mit Logo, Kontoname und
  Status („подключено", „нет связи", „войдите снова").
- Knopf „Добавить сервис" öffnet eine Kachelauswahl: Яндекс, Xiaomi Home, Aqara.
  Weitere Anbieter erscheinen ausgegraut mit „скоро".
- Ein Dienst lässt sich trennen („Отключить"); seine Zugangsdaten werden dabei gelöscht.
- Beim ersten Start ohne verbundenen Dienst führt die App direkt zur Anbieter-Auswahl.

### Anmeldung je Dienst

| Dienst | Ablauf |
|---|---|
| Яндекс | Wie bisher: OAuth-Token eintragen; QR-Anmeldung für Kameras bleibt. |
| Xiaomi Home | Serverregion wählen (Европа, Россия, Китай, США, Сингапур, Индия). Knopf „Войти через Xiaomi" öffnet die offizielle Xiaomi-Login-Seite in einem App-Fenster. Nach der Anmeldung schließt sich das Fenster, die App übernimmt den Code. |
| Aqara | Einmalig: Entwicklerschlüssel (App ID, App Key, Key ID) unter „Ключ разработчика" eintragen. Danach Serverregion, Telefon oder Mail eingeben, Aqara schickt einen Code, Code eintragen. |

### Anleitung zur Anmeldung

- Jedes Anmeldeformular hat daneben (bei schmalem Fenster darüber, aufklappbar) eine
  nummerierte Schritt-für-Schritt-Anleitung „Как войти" in der gewählten Sprache.
- Inhalt je Dienst:
  - Яндекс: Token über oauth.yandex.ru erzeugen (Rechte `iot:view`, `iot:control`), wie im
    bisherigen README, plus QR-Anmeldung für Kameras.
  - Xiaomi Home: welche Region das Konto hat und wo man sie in der Mi-Home-App sieht
    (Профиль, Настройки, Регион), dann die Anmeldung.
  - Aqara: Entwicklerkonto auf developer.aqara.com anlegen, App erstellen, Region Europa,
    die drei Schlüssel kopieren; danach Anmeldung per Code. Die Region des Aqara-Kontos
    sieht man in der Aqara-Home-App.
- Typische Fehler mit Lösung am Ende jeder Anleitung (falsche Region, Code abgelaufen,
  Schlüssel vertauscht).
- Externe Links öffnen im normalen Browser.

### Dashboard

- Alle Geräte aller Dienste gemeinsam, nach Räumen gruppiert.
- Räume mit gleichem Namen (Groß-/Kleinschreibung und Leerzeichen egal) werden zu einem
  Raum zusammengelegt.
- Jede Gerätekarte zeigt ein kleines Herkunftszeichen: „Я", „Mi", „Aqara".
- „Сценарии" enthält Yandex-Szenarien und Aqara-Szenen, jeweils mit Herkunftszeichen.
- Themes, „Автосмена“, Favoriten, Tray-Menü und der Vorssaint-Button funktionieren weiter.
- Anrede in Russisch „Вы", in Deutsch „Sie", in Englisch neutral.

### Sprachen

- Deutsch, Englisch, Russisch. Beim ersten Start gilt die Systemsprache, sonst Englisch.
  Umschalten in einem Sprachmenü neben dem Paletten-Knopf; die Wahl wird gespeichert.
- Alle Texte der App, auch die heute fest russischen, kommen aus Sprachdateien
  (`src/i18n/de.ts`, `en.ts`, `ru.ts`) über eine kleine eigene Funktion `t()`, ohne
  zusätzliche Bibliothek. Fehlt ein Text in einer Sprache, wird Englisch angezeigt.
- Nicht übersetzt werden Namen, die aus den Diensten kommen (Geräte, Räume, Szenarien).
- Theme-Namen werden übersetzt; die Yandex-Bezüge bleiben erkennbar (z. B. „Моя волна",
  „My Wave", „Meine Welle").
- Tray-Menü und Systembenachrichtigungen folgen derselben Sprache.

## Aufbau

### Kern ohne Desktop-Bezug

Neuer Ordner `core/` in TypeScript ohne Electron-Abhängigkeit, damit die Handy-App ihn
später übernehmen kann. Netzwerkzugriff nur über `fetch`.

```
core/
  model.ts            gemeinsames Geräteformat, Typen
  registry.ts         Verteiler: Dienste verwalten, zusammenführen, Befehle weiterleiten
  providers/
    provider.ts       Schnittstelle, die jeder Dienst erfüllt
    yandex/           bisheriger Yandex-Code, an die Schnittstelle angepasst
    xiaomi/           Anmeldung, Geräteliste, MIoT-Übersetzung
    aqara/            Anmeldung, Signatur, Geräteliste, Übersetzung
```

### Schnittstelle je Dienst

Jeder Dienst bietet dieselben Fähigkeiten:

- `login(...)`: dienstspezifischer Ablauf, liefert gespeicherte Zugangsdaten
- `refresh(credentials)`: Token erneuern, wo der Dienst das verlangt
- `loadHome()`: Geräte, Räume, Szenarien im gemeinsamen Format
- `execute(deviceId, action)`: Gerät schalten oder Wert setzen
- `runScenario(scenarioId)`

### Gemeinsames Geräteformat

Grundlage ist das Format, das die Oberfläche heute schon versteht (Yandex Smart Home:
`type`, `capabilities`, `properties`). Erweiterungen:

- `providerId` am Gerät, an Raum und Szenario
- Geräte-ID global eindeutig: `"<providerId>:<ursprüngliche ID>"`

Stufe 1 übersetzt diese Funktionen:

| Funktion | Yandex-Format |
|---|---|
| An/Aus | `on_off` |
| Helligkeit | `range` / `brightness` |
| Farbtemperatur, Farbe | `color_setting` |
| Temperatur, Luftfeuchte | `float` / `temperature`, `humidity` |
| Bewegung, Tür offen/zu | `event` / `motion`, `open` |
| Batterie | `float` / `battery_level` |

Geräte oder Funktionen ohne Übersetzung erscheinen mit Name und dem Hinweis
„не поддерживается", statt zu fehlen.

### Xiaomi Home

- Offizielle OAuth-Anmeldung, die Xiaomi für Home Assistant veröffentlicht hat
  (github.com/XiaoMi/ha_xiaomi_home): Client-ID `2882303761520251711`,
  Authorize `https://account.xiaomi.com/oauth2/authorize`, Redirect
  `http://homeassistant.local:8123`. Das App-Fenster fängt die Weiterleitung ab, bevor sie
  geladen wird, und liest den Code aus.
- Token-Tausch und Erneuerung über `/app/v2/ha/oauth/get_token`.
- Geräte und Räume über `/app/v2/homeroom/gethome` und `/app/v2/home/device_list_page`,
  Werte über `/app/v2/miotspec/prop/get`, `/prop/set`, `/action`.
- Die Bedeutung der Werte (siid/piid) kommt aus der öffentlichen MIoT-Spezifikation
  (miot-spec.org) je Gerätetyp; geladene Spezifikationen werden lokal zwischengespeichert.

### Aqara

- Aqara Open API v3 mit Entwicklerschlüssel. Signatur je Anfrage per MD5 über die
  sortierten Kopfdaten plus App Key, wie in der offiziellen Dokumentation beschrieben.
- Anmeldung: `config.auth.getAuthCode` (Code an Telefon/Mail), dann `config.auth.getToken`;
  Erneuerung per Refresh-Token.
- Räume über `query.position.info`, Geräte über `query.device.info`, Werte über
  `query.resource.value`, Schalten über `write.resource.device`, Szenen über
  `query.scene.listByPositionId` und `config.scene.run`. Die genauen Intent-Namen und
  Ressourcen-IDs werden bei der Umsetzung gegen die aktuelle Aqara-Dokumentation geprüft.

### Desktop-Anbindung

- Electron-Hauptprozess lädt den Kern. Die Oberfläche spricht nur noch über allgemeine
  Kanäle (`hub:loadHome`, `hub:execute`, `hub:runScenario`, `hub:accounts:*`) statt über
  Yandex-spezifische.
- Zugangsdaten je Dienst im Schlüsselbund (keytar), Dienst `SmartHomeControlApp`,
  Konto `provider:<id>`. Der bisherige Yandex-Eintrag wird übernommen, damit niemand sich
  neu anmelden muss.
- Aktualisierung wie bisher alle 30 Sekunden, je Dienst unabhängig.

## Fehlerverhalten

- Jeder Dienst lädt für sich. Fällt einer aus, zeigt nur seine Karte in „Мои сервисы"
  den Fehler, seine Geräte erscheinen ausgegraut mit „нет связи", der Rest läuft weiter.
- Abgelaufene Anmeldung: Status „войдите снова", ein Klick führt zur Anmeldung dieses Dienstes.
- Befehl schlägt fehl: Karte springt auf den alten Zustand zurück, kurze Meldung.

## Tests

- Sprachdateien: alle Schlüssel in allen drei Sprachen vorhanden (Test schlägt sonst fehl).
- Übersetzer (Xiaomi zu gemeinsamem Format, Aqara zu gemeinsamem Format) mit gespeicherten
  echten Beispielantworten als Unit-Tests (vitest).
- Aqara-Signatur gegen das Beispiel aus der offiziellen Dokumentation.
- Verteiler: Räume zusammenführen, Befehle an den richtigen Dienst, Ausfall eines Dienstes.
- Ende-zu-Ende nur mit echten Konten: Yandex mit Maxims Konto; Xiaomi und Aqara erst,
  wenn Maxim oder sein Vater sich einmal anmeldet.

## Risiken

- Xiaomi könnte die für Home Assistant freigegebene Anmeldung für fremde Apps einschränken.
- Aqara verlangt den Entwicklerschlüssel; ohne ihn ist der Dienst nicht nutzbar.
- Die Serverregion des Kontos muss stimmen, sonst findet der Dienst keine Geräte.
