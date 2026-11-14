/** Bretter, Zettel-Vorlagen, Siegel, Symbole und Schriften. Bereiche in Prozent [links, oben, rechts, unten]. */
export const MODULE_ID = "xantos-bulletin-board";
const P = `modules/${MODULE_ID}/assets`;

export const SKINS = {
  tavern: { img: `${P}/boards/tavern.webp`, w: 2000, h: 1356, area: [15, 31, 85, 84], plate: [33, 9.5, 67, 19.5] },
  castle: { img: `${P}/boards/castle.webp`, w: 1961, h: 1568, area: [10, 22, 87, 82], plate: null },
  guild: { img: `${P}/boards/guild.webp`, w: 2000, h: 1263, area: [15, 30, 85, 85], plate: [31.5, 8.6, 70, 18.8] },
  office: { img: `${P}/boards/office.webp`, w: 2000, h: 1352, area: [9.5, 15, 90.5, 86], plate: null },
  noble: { img: `${P}/boards/noble.webp`, w: 2000, h: 1433, area: [13, 18, 87, 83.5], plate: null }
};
export const SKIN_ORDER = ["tavern", "guild", "office", "noble", "castle"];

/** inset = Schreibbereich [oben, rechts, unten, links] in % der Zettelgröße */
export const NOTES = {
  "08-steckbrief-naegel-gemalt": { w: 745, h: 1198, inset: [14, 13, 10, 13] },
  "01-pergament-gemalt": { w: 810, h: 1048, inset: [10, 12, 10, 12] },
  "05-aushang-quadrat-gemalt": { w: 1193, h: 1199, inset: [11, 12, 11, 12] },
  "02-edel-goldrand": { w: 788, h: 1112, inset: [9, 11, 9, 11] },
  "03-schmuddel-kaffeering": { w: 757, h: 1200, inset: [9, 12, 16, 12] },
  "07-brief-gefaltet": { w: 827, h: 1112, inset: [9, 11, 9, 11] },
  "06-papierstapel": { w: 1199, h: 1146, inset: [9, 10, 9, 10] },
  "04-fetzen-quer": { w: 1199, h: 703, inset: [12, 10, 12, 10] }
};
export const NOTE_ORDER = Object.keys(NOTES);
export const noteImg = (id) => `${P}/notes/${id}.webp`;

/** Vorlage „Eigenes Bild“: das hochgeladene Bild ist der ganze Zettel. */
export const CUSTOM = "custom";
const CUSTOM_INSET = [9, 9, 9, 9];

/** Maße, Schreibbereich und Bild eines Zettels – für Vorlagen und eigene Bilder gleich. */
export function paperOf(note) {
  if (note?.template === CUSTOM && note.paper?.img) {
    return { w: note.paper.w || 1000, h: note.paper.h || 1300, inset: CUSTOM_INSET, img: note.paper.img, custom: true };
  }
  const id = NOTES[note?.template] ? note.template : NOTE_ORDER[0];
  return { ...NOTES[id], img: noteImg(id), custom: false };
}

/** Ebenenmodi für Bilder im Zettel (CSS mix-blend-mode) */
export const BLENDS = ["normal", "multiply", "darken", "color-burn", "overlay", "soft-light", "luminosity"];

/** Schnellwahl für Bilder: Ebenenmodus + Filter */
export const IMAGE_LOOKS = {
  original: { blend: "normal", f: { opacity: 100, sepia: 0, gray: 0, contrast: 100, bright: 100 } },
  print: { blend: "multiply", f: { opacity: 92, sepia: 45, gray: 0, contrast: 110, bright: 100 } },
  ink: { blend: "multiply", f: { opacity: 88, sepia: 20, gray: 100, contrast: 160, bright: 110 } },
  faded: { blend: "multiply", f: { opacity: 62, sepia: 70, gray: 0, contrast: 90, bright: 108 } },
  burnt: { blend: "color-burn", f: { opacity: 80, sepia: 60, gray: 0, contrast: 115, bright: 100 } }
};
export const IMAGE_LOOK_ORDER = Object.keys(IMAGE_LOOKS);

/** Siegel: cx/cy = Mitte des Wachskopfs in % des Bildes, r = Radius der Prägefläche in % der Bildbreite */
const COLORS = { red: "rot", blue: "blau", green: "gruen", black: "schwarz", gold: "gold" };
export const SEALS = {};
for (const [id, file] of Object.entries(COLORS)) {
  SEALS[id] = { color: id, band: false, img: `${P}/seals/siegel-${file}.webp`, aspect: 1, cx: 50, cy: 50, r: 31 };
}
for (const [id, file] of Object.entries(COLORS)) {
  SEALS[`${id}-band`] = { color: id, band: true, img: `${P}/seals/siegel-band-${file}.webp`, aspect: 224 / 520, cx: 50, cy: 21.5, r: 33 };
}
export const SEAL_ORDER = Object.keys(SEALS);

/** Symbole aus game-icons.net (CC BY 3.0), Namen wie in icons.js */
export const SEAL_ICONS = ["crown", "shield", "sword", "skull", "crossbones", "dragon", "claw", "star", "moon", "eye", "flame",
  "rune", "pentacle", "crystalBall", "wand", "potion", "coins", "chest", "anchor", "shipWheel", "compass", "anvil", "flower", "butterfly", "mushroom", "leaf"];

export const FONTS = {
  fell: "'SB Fell', 'IM Fell English', Georgia, serif",
  cinzel: "'SB Cinzel', Cinzel, Georgia, serif",
  pirate: "'SB Pirata', 'Pirata One', Georgia, serif",
  uncial: "'SB Uncial', 'Uncial Antiqua', Georgia, serif",
  meta: "'SB Meta', Metamorphous, Georgia, serif",
  hand: "'SB Caveat', Caveat, cursive"
};
export const FONT_ORDER = Object.keys(FONTS);

/** Schriften für Unterschriften */
export const SIGN_FONTS = {
  vibes: "'SB Vibes', 'Great Vibes', cursive",
  apple: "'SB Apple', 'Homemade Apple', cursive",
  aurore: "'SB Aurore', 'La Belle Aurore', cursive",
  delafield: "'SB Delafield', 'Mrs Saint Delafield', cursive",
  hand: "'SB Caveat', Caveat, cursive"
};
export const SIGN_FONT_ORDER = Object.keys(SIGN_FONTS);
export const SIGN_FONT_SCALE = { vibes: 1, apple: 0.62, aurore: 0.85, delafield: 1.25, hand: 0.9 }; // gleicht optische Größe an

/** Tintenfarben für Unterschrift & Zierde */
export const INK_COLORS = ["#2a1a0e", "#1b2a5c", "#6b1d1d", "#111111", "#7a5a12", "#ffffff"];
/** Farben für Symbole auf Siegeln */
export const EMB_COLORS = ["#f3d27a", "#e8e8e8", "#ffffff", "#1a1208", "#8a1c1c", "#2b4a8a"];

/** Zierelemente auf dem Zettel (alles Vektoren/CSS – lässt sich ohne Verzerrung in Breite und Höhe ziehen) */
export const DECO_KINDS = {
  line: { w: 60, h: 0, styles: ["solid", "double", "dashed", "dotted"] },
  ornate: { w: 60, h: 0, styles: ["diamond", "star", "flower", "cross"] },
  frame: { w: 84, h: 84, styles: ["solid", "double", "dashed", "dotted"] },
  corners: { w: 84, h: 84, styles: ["solid"] }
};
export const DECO_GLYPHS = { diamond: "◆", star: "✦", flower: "❀", cross: "✚" };

/** Schriftgrößen in pt (12 pt = Grundgröße des Fließtexts; skaliert mit der Zettelbreite) */
export const TITLE_SIZES = [14, 16, 18, 20, 24, 28, 32, 36, 42, 48, 56, 64];
export const BODY_SIZES = [7, 8, 9, 10, 11, 12, 13, 14, 16, 18, 20, 24];
export const TITLE_DEFAULT = { font: "pirate", size: 28, align: "center" };
export const BODY_DEFAULT = { font: "fell", size: 12 };

