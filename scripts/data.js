/**
 * Bretter und Zettel liegen in der Welt-Einstellung „boards“ (nur der SL schreibt, alle lesen).
 * Board: { id, name, skin, place, coords: 2, notes: Note[] }
 * Note:  { id, template, paper, x, y, scale, rot, z, title, titleFont, titleSize, titleAlign, body, bodyFont, bodySize, seal, images, deco }
 * seal:  { id, x, y, size, icon, img, ix, iy, isz, ic }  (ix/iy = Versatz des Symbols, isz = Symbolgröße in %, ic = Symbolfarbe)
 * titleColor / bodyColor: Hex-Farbe der Schrift oder "" (= Standardbraun der Vorlage)
 * name:  eigener Name des Zettels (Journal, Abgerissen-Liste); leer = Überschrift bzw. Vorlagenname
 * deco:  { id, kind: line|ornate|corners|sign|ink, style, x, y, w, h, rot, color, t, r, opacity, text, font, sz, path, ar }
 *   title  = Überschrift (Klartext), body = Fließtext (bereinigtes HTML), Größen in pt (12 = Grundgröße)
 *   x, y   = Mittelpunkt in % des ganzen Brettbilds (coords 2; bis 0.2 in % der Bretterfläche)
 *   scale  = Zettelhöhe als Anteil der Brettbreite (frei per Ziehen)
 *   paper  = null | { img, w, h }  (nur bei template "custom": eigenes Bild als Zettel)
 *   seal   = null | { id, x, y, size, icon, img }  (x, y, size in % der Zettelbreite/-höhe)
 *   images = [{ id, src, x, y, w, ar, blend, back, f: { opacity, sepia, gray, contrast, bright } }]
 *            x, y = Mitte in % des Zettels, w = Breite in % der Zettelbreite, ar = Breite/Höhe des Bildes
 */
import { MODULE_ID, SKINS, NOTES, CUSTOM, BLENDS, IMAGE_LOOKS, FONTS, TITLE_DEFAULT, BODY_DEFAULT, SIGN_FONTS, DECO_KINDS, INK_COLORS } from "./skins.js";
import { splitLegacyHTML, sanitize } from "./note.js";
import { t } from "./i18n.js";

const randomID = () => foundry.utils.randomID(12);
const clone = (o) => foundry.utils.deepClone(o);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const num = (v, d) => (Number.isFinite(Number(v)) && v !== null && v !== "" ? Number(v) : d);
const SRC_OK = /^(https?:\/\/[^\s"'<>]+|[\w\-./%~ ()]+)$/i;
export const safeSrc = (v) => (typeof v === "string" && SRC_OK.test(v) && !/^\s*javascript:/i.test(v) ? v : null);

/** Alte Größenstufen (bis 0.1.2) → freie Größe */
const LEGACY_SIZE = { s: 0.14, m: 0.18, l: 0.24 };
export const ROT_MAX = 45;
export const SCALE_MIN = 0.06, SCALE_MAX = 0.6, SCALE_DEFAULT = 0.18;

/** Bis 0.2 lagen Positionen in % der Bretterfläche, jetzt in % des ganzen Brettbilds. */
function migrateBoard(b) {
  const notes = Array.isArray(b.notes) ? b.notes : [];
  if (b.coords === 2) return { ...b, notes: notes.map(normalizeNote) };
  const [l, tp, r, bt] = (SKINS[b.skin] ?? SKINS.tavern).area;
  return {
    ...b, coords: 2,
    notes: notes.map(n => normalizeNote({ ...n, x: l + num(n.x, 50) / 100 * (r - l), y: tp + num(n.y, 50) / 100 * (bt - tp) }))
  };
}

export function getBoards() {
  const list = game.settings.get(MODULE_ID, "boards")?.list;
  if (!Array.isArray(list)) return [];
  // Ältere Daten beim Lesen angleichen; gespeichert wird beim nächsten Schreiben
  return clone(list).map(migrateBoard);
}

export function getBoard(id) {
  return getBoards().find(b => b.id === id) ?? null;
}

export async function saveBoards(list) {
  if (!game.user.isGM) return;
  await game.settings.set(MODULE_ID, "boards", { list });
}

export function newBoard(skin = "tavern") {
  const n = getBoards().length + 1;
  return { id: randomID(), name: t("board.defaultName", { n }), skin: SKINS[skin] ? skin : "tavern", place: t("board.defaultPlace"), coords: 2, notes: [] };
}

export async function upsertBoard(board) {
  const list = getBoards();
  const i = list.findIndex(b => b.id === board.id);
  if (i >= 0) list[i] = { ...list[i], ...board, notes: board.notes ?? list[i].notes };
  else list.push(board);
  await saveBoards(list);
  return board;
}

export async function deleteBoard(id) {
  await saveBoards(getBoards().filter(b => b.id !== id));
}

export function newNote(template = "08-steckbrief-naegel-gemalt") {
  return {
    id: randomID(), template: NOTES[template] ? template : Object.keys(NOTES)[0], paper: null, images: [],
    x: 50, y: 50, scale: SCALE_DEFAULT, rot: Math.round((Math.random() * 6 - 3) * 10) / 10, z: 1,
    title: t("note.defaultTitle"), titleFont: TITLE_DEFAULT.font, titleSize: TITLE_DEFAULT.size, titleAlign: TITLE_DEFAULT.align,
    body: `<p class="sb-center">${t("note.defaultBody")}</p>`, bodyFont: BODY_DEFAULT.font, bodySize: BODY_DEFAULT.size,
    seal: null
  };
}

/** Speichert einen Zettel. Neue Zettel bekommen eine freie Position und liegen oben. */
export async function upsertNote(boardId, note) {
  const list = getBoards();
  const board = list.find(b => b.id === boardId);
  if (!board) return null;
  const n = normalizeNote(note);
  const i = board.notes.findIndex(x => x.id === n.id);
  const top = Math.max(0, ...board.notes.map(x => Number(x.z) || 0));
  if (i >= 0) board.notes[i] = n;
  else {
    const spot = freeSpot(board);
    board.notes.push({ ...n, x: spot.x, y: spot.y, z: top + 1 });
  }
  await saveBoards(list);
  return n;
}

export async function patchNote(boardId, noteId, patch) {
  const list = getBoards();
  const note = list.find(b => b.id === boardId)?.notes.find(x => x.id === noteId);
  if (!note) return;
  const i = list.find(b => b.id === boardId).notes.indexOf(note);
  list.find(b => b.id === boardId).notes[i] = normalizeNote({ ...note, ...patch });
  await saveBoards(list);
}

export async function bringToFront(boardId, noteId) {
  const board = getBoard(boardId);
  if (!board) return;
  const top = Math.max(0, ...board.notes.map(x => Number(x.z) || 0));
  const note = board.notes.find(x => x.id === noteId);
  if (note && note.z !== top) await patchNote(boardId, noteId, { z: top + 1 });
}

/** Kopie eines Zettels an einer freien Stelle. */
export async function duplicateNote(boardId, noteId) {
  const src = getBoard(boardId)?.notes.find(x => x.id === noteId);
  if (!src) return null;
  const copy = { ...clone(src), id: randomID(), rot: Math.max(-ROT_MAX, Math.min(ROT_MAX, Math.round(((Number(src.rot) || 0) + (Math.random() * 2 - 1)) * 10) / 10)) };
  return upsertNote(boardId, copy);
}

export async function removeNote(boardId, noteId) {
  const list = getBoards();
  const board = list.find(b => b.id === boardId);
  if (!board) return;
  board.notes = board.notes.filter(x => x.id !== noteId);
  await saveBoards(list);
}

export function normalizeNote(n) {
  // „size“, „html“ und „font“ gibt es nur noch in alten Daten
  // „form“, „formColor“, „formSeal“ (Umschlag/Papiervogel, nur 0.6.x) gibt es nicht mehr
  const { size, html, font, form, formColor, formSeal, ...rest } = n;
  if (rest.title === undefined && rest.body === undefined && html !== undefined) Object.assign(rest, splitLegacyHTML(html, font));
  const pt = (v, d, min, max) => clamp(Math.round(num(v, d)), min, max);
  const custom = rest.template === CUSTOM && safeSrc(rest.paper?.img);
  return {
    ...rest,
    template: custom ? CUSTOM : (Object.hasOwn(NOTES, rest.template) ? rest.template : Object.keys(NOTES)[0]),
    paper: custom ? { img: rest.paper.img, w: clamp(num(rest.paper.w, 1000), 10, 20000), h: clamp(num(rest.paper.h, 1300), 10, 20000) } : null,
    x: clamp(num(rest.x, 50), 0, 100),
    y: clamp(num(rest.y, 50), 0, 100),
    scale: clamp(num(rest.scale, LEGACY_SIZE[size] ?? SCALE_DEFAULT), SCALE_MIN, SCALE_MAX),
    rot: clamp(num(rest.rot, 0), -ROT_MAX, ROT_MAX),
    z: Number(rest.z) || 1,
    name: String(rest.name ?? "").replace(/\s+/g, " ").trim().slice(0, 80),
    title: String(rest.title ?? "").slice(0, 300),
    titleFont: Object.hasOwn(FONTS, rest.titleFont) ? rest.titleFont : TITLE_DEFAULT.font,
    titleSize: pt(rest.titleSize, TITLE_DEFAULT.size, 8, 96),
    titleAlign: rest.titleAlign === "left" ? "left" : "center",
    titleColor: safeColor(rest.titleColor, ""),
    bodyColor: safeColor(rest.bodyColor, ""),
    body: sanitize(rest.body ?? ""),
    bodyFont: Object.hasOwn(FONTS, rest.bodyFont) ? rest.bodyFont : BODY_DEFAULT.font,
    bodySize: pt(rest.bodySize, BODY_DEFAULT.size, 6, 40),
    seal: rest.seal ? {
      ...rest.seal, x: clamp(num(rest.seal.x, 50), 0, 100), y: clamp(num(rest.seal.y, 80), 0, 100), size: clamp(num(rest.seal.size, 22), 8, 60), img: safeSrc(rest.seal.img),
      ix: clamp(num(rest.seal.ix, 0), -40, 40), iy: clamp(num(rest.seal.iy, 0), -40, 40), isz: clamp(num(rest.seal.isz, 100), 30, 170), ic: safeColor(rest.seal.ic, null)
    } : null,
    images: Array.isArray(rest.images) ? rest.images.map(normalizeImage).filter(Boolean) : [],
    deco: Array.isArray(rest.deco) ? rest.deco.map(normalizeDeco).filter(Boolean).slice(0, 40) : []
  };
}

/** Anzeigename eines Zettels: eigener Name → Überschrift → Vorlagenname. */
export function noteLabel(n) {
  const own = String(n?.name ?? "").trim();
  if (own) return own;
  const head = String(n?.title ?? "").replace(/\s+/g, " ").trim();
  if (head) return head.slice(0, 80);
  return t(n?.template === CUSTOM ? "note.custom" : `note.${n?.template}`);
}

/** Nur echte Hex-Farben (#rgb / #rrggbb) – alles andere fällt auf den Standard zurück. */
export function safeColor(v, fallback = "#2a1a0e") {
  return typeof v === "string" && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v.trim()) ? v.trim() : fallback;
}

/** Neues Zierelement / neue Unterschrift in der Mitte des Zettels. */
export function newDeco(kind, extra = {}) {
  const K = DECO_KINDS[kind];
  return normalizeDeco({
    id: randomID(), kind, style: K?.styles[0], x: 50, y: 50, w: K?.w ?? 40, h: K?.h ?? 0, rot: 0,
    color: INK_COLORS[0], t: kind === "ornate" ? 0.6 : 0.5, r: 8, opacity: 90, ...extra
  });
}

export function normalizeDeco(d) {
  const kind = d?.kind;
  if (kind !== "sign" && kind !== "ink" && !(typeof kind === "string" && Object.hasOwn(DECO_KINDS, kind))) return null;
  const out = {
    id: String(d.id || randomID()).slice(0, 40), kind,
    x: clamp(num(d.x, 50), -10, 110), y: clamp(num(d.y, 50), -10, 110),
    rot: clamp(num(d.rot, 0), -180, 180),
    color: safeColor(d.color), opacity: clamp(num(d.opacity, 90), 10, 100),
    t: clamp(num(d.t, 0.5), 0.1, 4)
  };
  if (kind === "sign") {
    out.text = String(d.text ?? "").slice(0, 60);
    if (!out.text.trim()) return null;
    out.font = Object.hasOwn(SIGN_FONTS, d.font) ? d.font : "vibes";
    out.sz = clamp(num(d.sz, 9), 2, 40);
    return out;
  }
  if (kind === "ink") {
    const path = String(d.path ?? "");
    if (!path || path.length > 8000 || !/^[MLQ0-9 .,\-]+$/.test(path)) return null;
    out.path = path;
    out.ar = clamp(num(d.ar, 3), 0.1, 30);
    out.w = clamp(num(d.w, 40), 5, 120);
    return out;
  }
  const K = DECO_KINDS[kind];
  out.style = K.styles.includes(d.style) ? d.style : K.styles[0];
  out.w = clamp(num(d.w, K.w), 3, 130);
  out.h = K.h ? clamp(num(d.h, K.h), 3, 130) : 0;
  out.r = clamp(num(d.r, 8), 0, 40);
  return out;
}

export function newImage(src, ar = 1, look = "print") {
  const L = IMAGE_LOOKS[look] ?? IMAGE_LOOKS.print;
  return normalizeImage({ id: randomID(), src, x: 50, y: 50, w: 60, ar, back: false, blend: L.blend, f: { ...L.f } });
}

export function normalizeImage(i) {
  const src = safeSrc(i?.src);
  if (!src) return null;
  const f = i.f ?? {};
  return {
    id: String(i.id || randomID()), src,
    x: clamp(num(i.x, 50), -20, 120), y: clamp(num(i.y, 50), -20, 120),
    w: clamp(num(i.w, 60), 5, 160), ar: clamp(num(i.ar, 1), 0.05, 20),
    back: !!i.back,
    blend: BLENDS.includes(i.blend) ? i.blend : "normal",
    f: {
      opacity: clamp(num(f.opacity, 100), 5, 100), sepia: clamp(num(f.sepia, 0), 0, 100), gray: clamp(num(f.gray, 0), 0, 100),
      contrast: clamp(num(f.contrast, 100), 40, 220), bright: clamp(num(f.bright, 100), 40, 180)
    }
  };
}

/** Grobe freie Stelle im Inneren des Bretts: Raster durchgehen, Abstand zu vorhandenen Zetteln maximieren. */
export function freeSpot(board) {
  const notes = board?.notes ?? [];
  const [l, tp, r, bt] = (SKINS[board?.skin] ?? SKINS.tavern).area;
  let best = { x: 50, y: 50, d: -1 };
  for (let fx = 0.12; fx <= 0.881; fx += 0.095) {
    for (let fy = 0.18; fy <= 0.821; fy += 0.16) {
      const gx = l + fx * (r - l), gy = tp + fy * (bt - tp);
      const cx = (l + r) / 2, cy = (tp + bt) / 2;
      const d = notes.length ? Math.min(...notes.map(n => Math.hypot((n.x - gx) * 1.4, n.y - gy))) : 100 - Math.hypot(gx - cx, gy - cy);
      if (d > best.d) best = { x: Math.round(gx * 10) / 10, y: Math.round(gy * 10) / 10, d };
    }
  }
  return best;
}

/* ---------------- Freigabe ---------------- */

/** share = { boardId, users: "all" | string[], stamp } oder leer. stamp ändert sich bei jedem Veröffentlichen → Brett ploppt erneut auf. */
export function getShare() {
  const s = game.settings.get(MODULE_ID, "share");
  return s && s.boardId ? s : null;
}

export function shareAppliesTo(user, share = getShare()) {
  if (!share || user.isGM) return false;
  if (!getBoard(share.boardId)) return false;
  return share.users === "all" || (Array.isArray(share.users) && share.users.includes(user.id));
}

/** open: true → das Brett ploppt bei den Spielern direkt auf; false → nur im Journal veröffentlicht. */
export async function setShare(boardId, users, open = true) {
  if (!game.user.isGM) return;
  await game.settings.set(MODULE_ID, "share", boardId ? { boardId, users, open: !!open, stamp: Date.now() } : {});
}

/** Ist das Brett für diesen Spieler gerade veröffentlicht? */
export function isBoardLive(boardId, user = game.user) {
  const share = getShare();
  return !!share && share.boardId === boardId && shareAppliesTo(user, share);
}

/* ---------------- Eingesteckte Zettel (je Spieler, als User-Flag) ---------------- */

/** [{ id, boardId, at, note }] – note ist eine Abschrift zum Zeitpunkt des Abreißens. */
export function getTaken(user = game.user) {
  const list = user?.getFlag?.(MODULE_ID, "taken");
  return Array.isArray(list) ? list.filter(e => e?.note).map(e => ({ ...e, note: normalizeNote(e.note) })) : [];
}

export function isTaken(noteId, user = game.user) {
  return getTaken(user).some(e => e.id === noteId);
}

export async function takeNote(boardId, noteId) {
  const note = getBoard(boardId)?.notes.find(n => n.id === noteId);
  if (!note) return false;
  const list = getTaken().filter(e => e.id !== noteId);
  const b = getBoard(boardId);
  const boardName = (b?.place && SKINS[b.skin]?.plate ? b.place : b?.name) || "";
  list.unshift({ id: noteId, boardId, boardName, at: Date.now(), note: clone(note) });
  await game.user.setFlag(MODULE_ID, "taken", list.slice(0, 100));
  return true;
}

export async function dropTaken(noteId) {
  await game.user.setFlag(MODULE_ID, "taken", getTaken().filter(e => e.id !== noteId));
}
