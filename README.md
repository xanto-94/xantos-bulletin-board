# Xanto's Bulletin Board

**English** · [Deutsch](README.de.md)

A visual bulletin board for **Foundry VTT** (v13 / v14). Design notes (quests, wanted posters, letters), pin them freely on a board, share the board with your players, and let them tear notes off into their journal. (In German: "Schwarzes Brett".)

## Install

In Foundry go to **Add-on Modules → Install Module** and paste this link into the **Manifest URL** field at the bottom:

```
https://github.com/xanto-94/xantos-bulletin-board/releases/latest/download/module.json
```

Then enable **Xanto's Bulletin Board** in your world under *Manage Modules*.

Manual install: copy the folder `xantos-bulletin-board` into `{Foundry user data}/Data/modules/`.

## Quick start

1. **GM:** open the **Journal** tab and click **Bulletin Board**. A board is created automatically.
2. Click **Pin a note**, write a headline and text, pick a paper, press **Ctrl + Enter**.
3. Drag the note anywhere on the board. Hover it to edit, duplicate, remove, resize or rotate it.
4. Click **Publish**, tick the players and choose *publish + open* or *publish only*.
5. **Players** see only the board, with no window frame and no controls. They click a note to read it, and can **tear it off** to keep it in their journal.

## Features

### For the GM
| | |
|---|---|
| **Boards** | Several boards, five looks (tavern, guild hall, counting house, noble house, castle). On tavern and guild boards you can edit the name on the sign, move the sign and make its text smaller. |
| **Notes** | 8 paper templates or your own image. Headline and body text with fonts, sizes, bold, italic, alignment and dividers. Every note can get its own **name** (shown in the players' journal). |
| **Wax seals** | With or without ribbons, symbol or own image. Move, resize and recolour the symbol. |
| **Decoration** | Lines, ornamental lines, frames and corners. Resize freely in width and height without distortion. |
| **Signatures** | Type a name in a handwriting font or sign with the mouse. |
| **Images** | Place any number of images on a note, with blend modes and filters so they melt into the paper. |
| **Layout** | Free placement, resizing and rotation (±45°) directly on the board. |
| **JSON import** | Paste or load JSON to fill headline and text quickly. |

### For players
- The published board always appears as an entry at the top of their **Journal**.
- Notes they tear off are listed **under that board**. When the board is unpublished or deleted, the notes get a ✔ ("done").
- Their copies stay readable even if the GM removes the note from the board.

## Publish options
- **Publish + open** shows the board to the chosen players immediately.
- **Publish only** puts it into their journal without opening it.
- **Re-publish** shows it again (for example after adding notes). **Withdraw** closes it for everyone and removes the journal entry.
- Only one board is published at a time.

## Language
German or English, set per user in the module settings.

## Macros
```js
const api = game.modules.get("xantos-bulletin-board").api;
api.open();                          // open the board
api.share(boardId, "all");           // publish to everybody (or ["userId", …])
api.stopSharing();                   // withdraw
```

## Notes
- Custom images (papers, seals, images on notes) are chosen via Foundry's file picker. Players need read access to the folder they are stored in.
- Boards and notes from older versions are upgraded automatically.
- First used in play with a real group. Please report bugs with the message from the browser console (F12) under **Issues**.

## Changelog
See [CHANGELOG.md](CHANGELOG.md).

## Author & license
Made by **Xanto** (Franz Lorek).

Licensed under **CC BY-NC 4.0** (attribution, non-commercial), see [LICENSE](LICENSE). Using the module at your own table is always allowed, including paid sessions. Selling the module itself or redistributing it commercially is not.

Fonts, icons and artwork credits are in [CREDITS.md](CREDITS.md). Fonts and icons keep their own licenses.
