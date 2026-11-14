# Xanto's Bulletin Board

[English](README.md) · **Deutsch**

Ein visuelles schwarzes Brett für **Foundry VTT** (v13 / v14). Gestalte Zettel (Aufträge, Steckbriefe, Briefe), hänge sie frei an ein Brett, gib das Brett für deine Spieler frei und lass sie Zettel abreißen und in ihr Journal mitnehmen. (Im Englischen: „Bulletin Board“.)

## Installation

In Foundry unter **Add-on Modules → Install Module** unten bei **Manifest URL** diesen Link einfügen:

```
https://github.com/xanto-94/xantos-bulletin-board/releases/latest/download/module.json
```

Danach in der Welt unter *Module verwalten* **Xanto's Bulletin Board** aktivieren.

Von Hand: Ordner `xantos-bulletin-board` nach `{Foundry-Benutzerdaten}/Data/modules/` kopieren.

## Schnellstart

1. **SL:** Im **Journal**-Reiter auf **Bulletin Board** klicken. Ein Brett wird automatisch angelegt.
2. **Zettel anheften** klicken, Überschrift und Text schreiben, Papier wählen, **Strg + Enter** drücken.
3. Den Zettel frei auf dem Brett verschieben. Mit der Maus darüber erscheinen Bearbeiten, Duplizieren, Abnehmen, Größe und Drehen.
4. **Veröffentlichen** klicken, Spieler ankreuzen und *Veröffentlichen + öffnen* oder *Nur veröffentlichen* wählen.
5. **Spieler** sehen nur das Brett, ohne Fensterrahmen und ohne Bedienelemente. Sie klicken Zettel zum Lesen an und können sie **abreißen**, um sie im Journal zu behalten.

## Funktionen

### Für den SL
| | |
|---|---|
| **Bretter** | Mehrere Bretter, fünf Aussehen (Taverne, Gildenhaus, Kontor, Adelshaus, Burg). Bei Taverne und Gildenhaus lässt sich der Name auf dem Schild ändern, das Schild verschieben und die Schrift verkleinern. |
| **Zettel** | 8 Papiervorlagen oder ein eigenes Bild. Überschrift und Fließtext mit Schriftart, Größe, fett, kursiv, Ausrichtung und Trennlinie. Jeder Zettel kann einen eigenen **Namen** bekommen (erscheint im Journal der Spieler). |
| **Wachssiegel** | Mit oder ohne Bänder, Symbol oder eigenes Bild. Symbol verschieben, Größe und Farbe ändern. |
| **Zierde** | Linien, Zierlinien, Rahmen und Ecken. In Breite und Höhe frei ziehbar, ohne Verzerrung. |
| **Unterschriften** | Namen in Schreibschrift tippen oder mit der Maus selbst unterschreiben. |
| **Bilder** | Beliebig viele Bilder auf dem Zettel, mit Ebenenmodi und Filtern, damit sie mit dem Papier verschmelzen. |
| **Anordnung** | Frei platzieren, Größe ändern und drehen (±45°) direkt am Brett. |
| **JSON-Import** | JSON einfügen oder laden, um Überschrift und Text schnell zu füllen. |

### Für Spieler
- Das veröffentlichte Brett steht immer als Eintrag ganz oben im **Journal**.
- Abgerissene Zettel hängen **darunter**. Wird das Brett zurückgezogen oder gelöscht, bekommen die Zettel einen Haken („erledigt“).
- Die Kopien bleiben lesbar, auch wenn der SL den Zettel vom Brett nimmt.

## Veröffentlichen
- **Veröffentlichen + öffnen** zeigt das Brett den gewählten Spielern sofort.
- **Nur veröffentlichen** legt es nur ins Journal, ohne es aufzuklappen.
- **Erneut veröffentlichen** zeigt es wieder (z. B. nach neuen Zetteln). **Zurückziehen** schließt es bei allen und entfernt den Journal-Eintrag.
- Es ist immer nur ein Brett veröffentlicht.

## Sprache
Deutsch oder Englisch, pro Benutzer in den Moduleinstellungen.

## Makros
```js
const api = game.modules.get("xantos-bulletin-board").api;
api.open();                          // Brett öffnen
api.share(boardId, "all");           // für alle veröffentlichen (oder ["userId", …])
api.stopSharing();                   // zurückziehen
```

## Hinweise
- Eigene Bilder (Papiere, Siegel, Bilder im Zettel) werden über Foundrys Dateiauswahl eingebunden. Spieler brauchen Lesezugriff auf den Ordner, in dem sie liegen.
- Bretter und Zettel aus älteren Versionen werden automatisch übernommen.
- Schon mit einer echten Gruppe gespielt. Fehler bitte mit der Meldung aus der Browser-Konsole (F12) unter **Issues** melden.

## Änderungen
Siehe [CHANGELOG.de.md](CHANGELOG.de.md).

## Autor & Lizenz
Made by **Xanto** (Franz Lorek).

Lizenz: **CC BY-NC 4.0** (Namensnennung, nicht kommerziell), siehe [LICENSE](LICENSE). Die Nutzung am eigenen Spieltisch ist immer erlaubt, auch in bezahlten Runden. Das Modul selbst zu verkaufen oder kommerziell weiterzuverbreiten ist nicht erlaubt.

Danksagungen für Schriften, Icons und Grafiken in [CREDITS.md](CREDITS.md). Schriften und Icons behalten ihre eigenen Lizenzen.
