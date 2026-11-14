# Xanto's Bulletin Board – „Schwarzes Brett“ (Foundry VTT v13/v14)

Ein visuelles schwarzes Brett für Aufträge, Steckbriefe und Aushänge. Du gestaltest Zettel, hängst sie frei auf und gibst das Brett für alle oder einzelne Spieler frei. Spieler klicken Zettel an und lesen sie groß. Mehr müssen sie nicht tun.

## Installation

**Per Manifest-URL (empfohlen):** In Foundry *Add-on Modules → Install Module*, unten bei *Manifest URL* einfügen:

`https://github.com/xanto-94/xantos-bulletin-board/releases/latest/download/module.json`

**Von Hand:** Ordner `xantos-bulletin-board` nach `{Foundry-Benutzerdaten}/Data/modules/` kopieren (so dass `Data/modules/xantos-bulletin-board/module.json` existiert).

Danach in der Welt: **Module verwalten → „Xanto's Bulletin Board“** aktivieren.

## So funktioniert es

- **Öffnen (SL):** Im Journal-Reiter oben auf **„Bulletin Board“**. Beim ersten Öffnen wird automatisch ein Brett angelegt.
- **Brett einrichten:** Oben links Brett wählen oder neu anlegen (+), Namen ändern, **Aussehen** wählen (Taverne, Gildenhaus, Kontor, Adelshaus, Burg). Den **Namen auf dem Schild** (Taverne, Gildenhaus) klickst du direkt an und tippst ihn ein (Enter speichert, Esc bricht ab).
- **Zettel anheften:** Button **„Zettel anheften“** oben rechts öffnet den Editor. Er öffnet direkt im Reiter „Text“, die Beispielüberschrift ist markiert – sofort lostippen. Rechts gibt es vier Reiter:
  - **Papier:** Zettel aus der Bibliothek – oder **„Eigenes Bild“**: dein hochgeladenes Bild ist dann der ganze Zettel (PNG/WebP mit Transparenz wirkt am besten). Text und Siegel kannst du trotzdem daraufsetzen.
  - **Text:** Feld für die **Überschrift** mit Schriftart, Größe in pt und Ausrichtung. Darunter das Feld für den **Fließtext** mit eigener Schriftart und Größe sowie fett, kursiv, linksbündig/zentriert und Trennlinie. Die Vorschau links aktualisiert sich beim Tippen; ein Klick auf den Text in der Vorschau springt ins passende Feld. Enter in der Überschrift springt in den Fließtext.
  - **JSON:** Über „JSON laden“ eine Datei wählen oder JSON einfach ins Textfeld einfügen – Überschrift und Text werden dann automatisch gefüllt. Beispiel:
    ```json
    { "title": "Die verlorene Karawane", "text": "Seit drei Tagen fehlt jede Spur.\n\nMeldet euch beim **Kontor**.", "align": "center", "titleFont": "cinzel", "titleSize": 32, "bodySize": 12 }
    ```
    Leerzeile = neuer Absatz, `**fett**`, `*kursiv*`, `---` = Trennlinie. Schriften: `fell`, `cinzel`, `pirate`, `uncial`, `meta`, `hand`.
  - **Siegel:** mit/ohne Bänder, Symbol oder eigenes Bild, Größe per Regler. Auf dem Zettel mit der Maus verschieben.
  - **Bilder:** beliebig viele Bilder frei auf den Zettel legen. Ziehen verschiebt, der Griff unten rechts ändert die Größe, Entf löscht. **Schnellwahl** (Original, Gedruckt, Tusche, Verblasst, Gebrannt), **Ebenenmodus** (Multiplizieren, Abdunkeln, Farbig nachbelichten, Ineinanderkopieren, Weiches Licht, Luminanz) und **Filter** (Deckkraft, Sepia, Schwarzweiß, Kontrast, Helligkeit), damit das Bild mit dem Papier verschmilzt. „Hinter den Text legen“ schiebt es unter die Schrift.
  - **Strg + Enter** heftet den Zettel an. Wird der Text zu lang, verkleinert sich die Schrift automatisch; in der großen Ansicht kann man dann scrollen.
- **Direkt am Brett (SL):** Fährst du mit der Maus über einen Zettel, erscheinen oben **Bearbeiten**, **Duplizieren** und **Abnehmen** und unten rechts ein **Griff für die Größe**.
  - **Verschieben:** Zettel frei überall auf das Brett ziehen – auch auf den Rahmen oder das Schild.
  - **Größe:** am Griff ziehen.
  - **Entf** auf einem ausgewählten Zettel nimmt ihn ab (mit Rückfrage).
  - Ein Klick zeigt den Zettel groß, so wie ihn die Spieler sehen.
- **Veröffentlichen:** Button **„Veröffentlichen“** oben rechts. Haken bei den Spielern setzen, bei denen das Brett aufploppen soll. Angezeigt werden nur Spieler, die gerade verbunden sind, oder **„Alle Spieler“** – dann sehen es auch alle, die später dazukommen.
  - Bei den Ausgewählten öffnet sich das Brett sofort. Danach steht es bei ihnen **im Journal ganz oben** und lässt sich dort per Klick öffnen und schließen.
  - **„Erneut veröffentlichen“** lässt es wieder aufploppen (z. B. nach neuen Zetteln), **„Zurückziehen“** schließt es bei allen und entfernt den Journal-Eintrag.
  - Es ist immer nur ein Brett veröffentlicht.
- **Zettel abreißen (Spieler):** In der großen Ansicht eines Zettels gibt es „Abreißen & mitnehmen“. Der Zettel landet dann als Abschrift im Journal des Spielers unter „Eingesteckte Zettel“ und lässt sich dort einzeln öffnen und schließen – auch wenn das Brett längst zurückgezogen oder der Zettel abgenommen ist. Am Brett bleibt er für die anderen hängen. Mit dem Papierkorb bzw. dem × im Journal wirft man ihn weg.
- **Spieler:** sehen nur das Brett mit den Zetteln, mittig im freien Bereich links von der Seitenleiste, ohne Fensterrahmen. Zettel anklicken → groß lesen, nochmal klicken → zu. Das **X** oben rechts am Brett oder ein Klick auf den Eintrag im Journal schließt das Brett.
- **Sprache:** Deutsch/Englisch in den Moduleinstellungen, gilt pro Spieler.

Makros: `game.modules.get("xantos-bulletin-board").api.open()`, `.share(boardId, "all" | ["userId", …])`, `.stopSharing()`.

## English

A visual bulletin board. Open it from the Journal tab, pin notes (paper template or your own image, optional wax seal, rich text written directly on the note, freely placed images with blend modes and filters), drag and resize them anywhere on the board, and publish the board to the players you tick. Published boards appear at the top of their Journal. Players only see the board itself (no window, no controls) and can click notes to read them. Language: module settings (per user).

## Hinweise

- Version 0.7.0 – in einer nachgebauten Testumgebung mit SL und Spielern durchgespielt, noch nicht in einer echten v14-Welt. Vorher Backup machen; Fehler bitte mit der Meldung aus der Konsole (F12) melden.
- Eigene Bilder (Zettel, Siegel, Bilder im Zettel) werden über Foundrys Dateiauswahl eingebunden. Spieler brauchen Lesezugriff auf den Ordner, in dem sie liegen (z. B. `Data/worlds/<welt>/…` oder `Data/assets/…`).
- Bretter und Zettel aus älteren Versionen werden beim Öffnen automatisch übernommen: Zettel bleiben an ihrer Stelle, die erste Überschrift wird zur Headline, der Rest zum Fließtext.

## Changelog 0.4.1 / Änderungen 0.4.1
- Fensterkopf-Knöpfe („Steuerung“, „Schließen“) zeigen wieder ihre Icons.
- Veröffentlichen fragt nach: *Veröffentlichen + öffnen* (Brett ploppt auf) oder *Nur veröffentlichen* (nur Journal).
- Veröffentlichtes Brett steht immer im Journal; abgerissene Zettel hängen darunter.
- „Abreißen“-Knopf liegt immer über Siegeln. Spielerfenster ohne Abdunkeln/Weichzeichnen.
- Ist ein Brett nicht mehr veröffentlicht oder gelöscht, bekommen die Zettel im Journal einen Haken („erledigt“).

## Changelog 0.5.0
- **Zettel drehen:** Drehgriff unten links am Zettel (Umschalt = 5°-Schritte, nahe 0° rastet ein) oder Regler „Neigung“ im Reiter Papier. Bis ±45°.
- **Siegel:** Symbol einzeln verschiebbar (direkt greifen), Symbolgröße und Symbolfarbe einstellbar.
- **Zierde:** Linien, Zierlinien, Rahmen und Ecken – in Breite und Höhe frei ziehbar ohne Verzerrung (CSS-Rahmen, keine gestreckten Bilder), mit Stil, Stärke, Rundung, Drehung, Farbe, Deckkraft.
- **Unterschriften:** Namen in Schreibschrift tippen (5 Schriften) oder mit der Maus selbst unterschreiben.
- Neue Schriften (Great Vibes, La Belle Aurore, Mrs Saint Delafield: OFL; Homemade Apple: Apache 2.0) – Lizenzen in `fonts/`.

## Changelog 0.5.1
- Editor: Die Zettel-Vorschau passt sich jetzt automatisch an die Fenstergröße an (war beim ersten Öffnen winzig).

## Changelog 0.7.0
- **Zettel haben einen Namen** (Editor → Text → „Name des Zettels“). Der Name erscheint im Journal der Spieler und bei abgerissenen Zetteln. Leer = Überschrift, ohne Überschrift der Vorlagenname.
- **Brettfenster (SL)** passt sich dem Bildschirm an: öffnet sich so groß, dass Kopfzeile und Werkzeugleiste sichtbar bleiben, und wird zurückgeholt, wenn es oben oder unten herausragt.
- **Journal-Button** heißt in allen Sprachen „Bulletin Board“.
- **Schild am Brett** lässt sich verschieben (Kreuz-Griff links, Doppelklick = zurücksetzen) und die Schrift verkleinern (Griff rechts). Spieler sehen es so, wie du es eingestellt hast.
- **Entfernt:** Umschlag und Papiervogel (0.6.0) sind wieder draußen. Zettel, die so eingestellt waren, sind jetzt normale flache Zettel.

## Changelog 0.6.0
- Umschlag und Papiervogel als Zettelformen – in 0.7.0 wieder entfernt.

## Autor & Lizenz
Made by **Xanto** (Franz Lorek) – MIT-Lizenz, siehe `LICENSE`. Danksagungen für Schriften, Icons und Grafiken in `CREDITS.md`.
