# Changelog

[Deutsch](CHANGELOG.de.md)

## 0.7.0
- **Notes have a name** (editor → Text → "Note name"). It is shown in the players' journal and for torn-off notes. Empty = headline, then template name.
- **Board window (GM)** fits the screen: it opens small enough to keep the header and toolbar visible and is moved back if it sticks out at the top or bottom.
- **Renamed** to *Xanto's Bulletin Board*. The journal button and window are called "Bulletin Board" in all languages.
- **Sign on the board** can be moved (cross handle on the left, double-click resets) and its text made smaller (handle on the right). Players see it as you set it.
- **Removed:** envelope and paper bird (0.6.0). Notes that used them are now normal flat notes.
- License changed to CC BY-NC 4.0.

## 0.6.0
- Envelope and paper bird as note forms. Removed again in 0.7.0.

## 0.5.1
- Editor: the note preview now adapts to the window size (it was tiny on first open).

## 0.5.0
- **Rotate notes:** rotation handle at the bottom left of a note (Shift = 5° steps, snaps near 0°) or the "Tilt" slider on the Paper tab. Up to ±45°.
- **Seals:** the symbol can be moved on its own, its size and colour can be changed.
- **Decoration:** lines, ornamental lines, frames and corners, freely resizable in width and height without distortion, with style, thickness, rounding, rotation, colour and opacity.
- **Signatures:** type a name in handwriting fonts (5 fonts) or sign with the mouse.
- New fonts (Great Vibes, La Belle Aurore, Mrs Saint Delafield: OFL; Homemade Apple: Apache 2.0). Licenses are in `fonts/`.

## 0.4.1
- Window header buttons show their icons again.
- Publishing asks: *publish + open* (board pops up) or *publish only* (journal only).
- A published board is always in the journal, torn-off notes hang below it.
- The "tear off" button always sits above wax seals. Player window without dimming or blur.
- When a board is withdrawn or deleted, notes in the journal get a check mark ("done").

## 0.1 – 0.4
- First versions: boards and notes, wax seals, images with blend modes and filters, headline and body text, JSON import, publishing to players, tearing notes off into the journal.
