# sevDesk Belege exportieren

Dieses Skript exportiert die Belege von sevDesk für einen gewissen Zeitraum als PDFs.
Der Zeitraum wird dabei über das `payDate` (also das in sevDesk hinterlegte Zahlungsdatum) eingeschränkt.
Das ist besonders für Einnahmen-Ausgaben-Rechner nützlich, da hier in der monatlichen Buchhaltung einfach alle Belege die in diesem Monat **bezahlt** wurden exportiert werden können. 
Die Belege werden als PDF mit den Dateinamen `YYYY-MM-DD-Name-ID.pdf` gespeichert. Durch das Datum ist die Sortierung und Zuordnung zum Kontoauszug einfacher. Der Name ist der Liefernanten- oder Kundenname. Die ID wird für eindeutige Dateinamen verwendet.

## Verwendung

Zum Ausführen wird mindestens NodeJS v16 (mit ES-Module-Support) benötigt. 
Das Skript bietet via `--help` eine Übersicht über die Parameter. 

1. `git clone https://github.com/gaambo/sevdesk-export`
2. `cd sevdesk-export`
3. `npm install`
4. `node .`

### Globale Verwendung

Mit `npm install -g .` kann das Skript global verfügbar gemacht werden und somit von jedem Verzeichnis via Shell/CMD `sevdesk-export` ausgeführt werden.

### Parameter

`--start`: Startdatum (YYYY-MM-DD) *(Standard: 1. Tag des letzten Monats)* 
`--end`: Enddatum (YYYY-MM-DD) *(Standard: Letzter Tag des letzten Monats)* 
`--dir`: Export-Verzeichnis *(Standard: Verzeichnis "export" im ausführenden Verzeichnis)* 
`--delete`: Ob bestehende Dateien im Export-Verzeichnis gelöscht werden sollen *(Standard: Falsch)* 
`--report`: Ob ein Journal/Report im CSV-Format erstellt werden soll *(Standard: Falsch)* 
`--api-token`: Der API-Token für sevDesk (siehe [Infos](#sevdesk-api)).

### Beispiel Aufruf: 
`$ sevdesk-export --start 2022-02-01 --end 2022-02-28 --dir ~/buchhaltung/2022/02 --delete --api-token 1234`

## sevDesk API

Ein API-Token kann in sevDesk unter `Einstellungen > Benutzer > API-Token` kopiert werden.
Der API-Token kann bei jedem Aufruf als Parameter übergeben werden oder in der `.env` (siehe `.env.example`) Datei gespeichert werden. 
Außerdem kann der API-Token auch als globale Umgebungsvariable gespeichert werden (zB in der `.bashrc` Datei).

## Rechtliches

Dieses Programm wird ohne Haftung und Gewährleistung übermittelt. Es werden nur Daten von der sevDesk-API gelesen und lokal verarbeitet. Es werden **keine** Daten in sevDesk geschrieben/verändert oder übermittelt.

Dieses Programm steht in keinem Zusammenhang mit sevDesk und wird nicht von sevDesk entwickelt oder betrieben.

## Changelog

### v1.3.0

- Sanitize filenames
- Extra infos (sevDesk Kategorien) in Dateiname (optional via Flag)

### v1.2.0

- Bericht/Journal-Funktionalität hinzugefügt
- Nicht-PDFs werden nun korrekt gespeichert
