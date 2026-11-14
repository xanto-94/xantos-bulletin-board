import { MODULE_ID, SKINS, SKIN_ORDER, paperOf, CUSTOM } from "./skins.js";
import { t } from "./i18n.js";
import { noteHTML, fitText, esc } from "./note.js";
import {
  getBoards, newBoard, upsertBoard, deleteBoard, patchNote, bringToFront, removeNote, duplicateNote,
  getShare, setShare, shareAppliesTo, noteLabel, SCALE_MIN, SCALE_MAX, ROT_MAX, takeNote, isTaken
} from "./data.js";

const { ApplicationV2 } = foundry.applications.api;
const EDGE = 0.4; // Mindestabstand zum Rand des Brettbilds in %

/** Mittelpunkt so begrenzen, dass der ganze Zettel (Größe in % des Bretts) auf dem Brettbild bleibt. */
function clampInside(pos, size) {
  const half = size / 2 + EDGE;
  if (half >= 50) return 50;
  return Math.min(100 - half, Math.max(half, pos));
}

/** Größe der Hülle eines gedrehten Zettels (w/h in % des Bretts, r = Breite/Höhe des Brettbilds). */
function rotatedSize(w, h, rot, r) {
  const a = Math.abs(Number(rot) || 0) * Math.PI / 180;
  const W = w / 100 * r, H = h / 100;
  const W2 = Math.abs(W * Math.cos(a)) + Math.abs(H * Math.sin(a));
  const H2 = Math.abs(W * Math.sin(a)) + Math.abs(H * Math.cos(a));
  return [W2 / r * 100, H2 * 100];
}

/** Schild-Einstellungen eines Bretts (Versatz in % des Brettbilds, Textgröße 0.3–1). */
export function plateOf(board) {
  const p = board?.plate ?? {};
  const n = (v, d) => (Number.isFinite(Number(v)) ? Number(v) : d);
  return { dx: Math.max(-40, Math.min(40, n(p.dx, 0))), dy: Math.max(-12, Math.min(40, n(p.dy, 0))), s: Math.max(0.3, Math.min(1, n(p.s, 1))) };
}

export class BoardApp extends ApplicationV2 {
  static DEFAULT_OPTIONS = {
    id: "xantos-bulletin-board",
    classes: ["sb-app", "sb-board-app"],
    window: { title: "Bulletin Board", icon: "fa-solid fa-thumbtack", resizable: true },
    position: { width: 1100, height: "auto" },
    actions: {
      newBoard: BoardApp._onNewBoard,
      deleteBoard: BoardApp._onDeleteBoard,
      togglePublish: BoardApp._onTogglePublish,
      publish: BoardApp._onPublish,
      unpublish: BoardApp._onUnpublish,
      closeBoard: BoardApp._onCloseBoard,
      takeNote: BoardApp._onTakeNote,
      addNote: BoardApp._onAddNote,
      closeView: BoardApp._onCloseView,
      editNote: BoardApp._onEditNote,
      duplicateNote: BoardApp._onDuplicateNote,
      removeNote: BoardApp._onRemoveNote
    }
  };

  static instance = null;

  /** Offen → schließen, zu → öffnen (Journal-Eintrag der Spieler). */
  static toggle() {
    const app = this.instance;
    if (app?.rendered) return app.close();
    return this.open();
  }

  /** Öffnet (oder holt nach vorn) das Brett. Spieler sehen nur das freigegebene Brett. */
  static open({ boardId = null, noteId = null } = {}) {
    if (!game.user.isGM) {
      const share = getShare();
      if (!shareAppliesTo(game.user, share)) return null;
      boardId = share.boardId;
    }
    let app = this.instance;
    if (!app) {
      const gm = game.user.isGM;
      let position = { width: 1100, height: "auto" };
      if (gm) {
        // SL: Fenster so groß, dass das ganze Brett samt Kopfzeile und Werkzeugleiste auf den Bildschirm passt
        const b = getBoards().find(x => x.id === boardId) ?? getBoards()[0];
        const ar = (SKINS[b?.skin] ?? SKINS.tavern);
        const r = ar.w / ar.h;
        const width = Math.round(Math.max(640, Math.min(1100, window.innerWidth - 40, (window.innerHeight - 190) * r + 40)));
        position = { width, height: "auto", top: 30, left: Math.max(10, Math.round((window.innerWidth - width) / 2)) };
      }
      if (!gm) {
        // Spieler: Fenster passend zum Brett auf den Bildschirm setzen (mittig, ganz sichtbar)
        const skin = SKINS[getBoards().find(b => b.id === boardId)?.skin] ?? SKINS.tavern;
        const ar = skin.w / skin.h;
        // freie Fläche links von der Seitenleiste (Chat, Journal …)
        const sb = document.getElementById("sidebar")?.getBoundingClientRect();
        const free = sb && sb.width && sb.left > window.innerWidth / 2 ? sb.left : window.innerWidth;
        const width = Math.round(Math.min(free - 80, (window.innerHeight - 100) * ar, 1300));
        const height = Math.round(width / ar);
        position = { width, height: "auto", left: Math.max(10, Math.round((free - width) / 2)), top: Math.max(10, Math.round((window.innerHeight - height) / 2)) };
      }
      // Auch Spieler bekommen ein echtes Foundry-Fenster (sonst rutscht es in die Oberfläche und verschiebt sie);
      // Kopfzeile und Rahmen werden per CSS ausgeblendet, geschlossen wird über das eigene X.
      app = this.instance = new this({ boardId, window: { frame: true, resizable: gm, minimizable: gm }, position });
    }
    if (boardId) app.boardId = boardId;
    if (noteId !== null) app.viewId = noteId;
    app.render({ force: true });
    app.bringToFront?.();
    return app;
  }

  constructor(options = {}) {
    super(options);
    this.boardId = options.boardId ?? null;
    this.viewId = null;
    this.pubOpen = false; // Veröffentlichen-Fenster offen?
  }

  get title() {
    return t("app.title");
  }

  get board() {
    const boards = getBoards();
    if (!game.user.isGM) return boards.find(b => b.id === getShare()?.boardId) ?? null;
    return boards.find(b => b.id === this.boardId) ?? boards[0] ?? null;
  }

  /** Nach Änderungen an Brettern oder Freigabe neu zeichnen. */
  refresh() {
    if (!this.rendered) return;
    if (!game.user.isGM && !shareAppliesTo(game.user)) return this.close();
    this.render();
  }

  /* ------------------------------------------------------------ */

  async _prepareBoard() {
    if (game.user.isGM && !getBoards().length) await upsertBoard(newBoard("tavern"));
  }

  async _renderHTML() {
    await this._prepareBoard();
    const board = this.board;
    if (board) this.boardId = board.id;
    const gm = game.user.isGM;
    return `
      <div class="sb-root ${gm ? "is-gm" : "is-player"}">
        ${gm ? this._toolbarHTML(board) : ""}
        <div class="sb-stage-wrap">
          ${board ? this._stageHTML(board) : `<div class="sb-empty">${esc(t("board.empty"))}</div>`}
          ${gm ? "" : `<button type="button" class="sb-player-close" data-action="closeBoard" data-tooltip="${esc(t("view.close"))}" aria-label="${esc(t("view.close"))}"><i class="fa-solid fa-xmark"></i></button>`}
          ${board ? this._viewHTML(board) : ""}
        </div>
      </div>`;
  }

  _replaceHTML(result, content) {
    content.innerHTML = result;
  }

  _toolbarHTML(board) {
    const boards = getBoards();
    const share = getShare();
    const sharedHere = !!(share && board && share.boardId === board.id);
    const sharedElsewhere = share && !sharedHere ? boards.find(b => b.id === share.boardId) : null;
    return `
      <header class="sb-toolbar">
        <div class="sb-group">
          <label class="sb-field" data-tooltip="${esc(t("toolbar.board"))}">
            <i class="fa-solid fa-chalkboard"></i>
            <select data-field="board" aria-label="${esc(t("toolbar.board"))}">
              ${boards.map(b => `<option value="${b.id}" ${b.id === board?.id ? "selected" : ""}>${esc(b.name)}</option>`).join("")}
            </select>
          </label>
          <button type="button" class="sb-icon-btn" data-action="newBoard" data-tooltip="${esc(t("toolbar.newBoard"))}" aria-label="${esc(t("toolbar.newBoard"))}"><i class="fa-solid fa-plus"></i></button>
          ${board ? `
            <input type="text" class="sb-input" data-field="name" value="${esc(board.name)}" aria-label="${esc(t("toolbar.name"))}" placeholder="${esc(t("toolbar.name"))}" data-tooltip="${esc(t("toolbar.name"))}">
            <label class="sb-field" data-tooltip="${esc(t("toolbar.skin"))}">
              <i class="fa-solid fa-palette"></i>
              <select data-field="skin" aria-label="${esc(t("toolbar.skin"))}">
                ${SKIN_ORDER.map(id => `<option value="${id}" ${id === board.skin ? "selected" : ""}>${esc(t(`skin.${id}`))}</option>`).join("")}
              </select>
            </label>
            <button type="button" class="sb-icon-btn danger" data-action="deleteBoard" data-tooltip="${esc(t("toolbar.deleteBoard"))}" aria-label="${esc(t("toolbar.deleteBoard"))}"><i class="fa-solid fa-trash"></i></button>` : ""}
        </div>
        ${board ? `
        <div class="sb-group">
          <label class="sb-check sb-gmj" data-tooltip="${esc(t("gmj.tip"))}">
            <input type="checkbox" data-field="gmJournal" ${board.gmJournal ? "checked" : ""}>
            <span class="sb-box"><i class="fa-solid fa-check"></i></span>
            <span class="sb-check-text">${esc(t("gmj.label"))}</span>
          </label>
          ${sharedElsewhere ? `<span class="sb-status" data-tooltip="${esc(t("toolbar.sharedElsewhereHint"))}"><i class="fa-solid fa-circle-info"></i>${esc(t("toolbar.sharedElsewhere", { name: sharedElsewhere.name }))}</span>` : ""}
          <div class="sb-pub-wrap">
            <button type="button" class="sb-btn ${sharedHere ? "accent on" : ""}" data-action="togglePublish" aria-expanded="${this.pubOpen}">
              <i class="fa-solid ${sharedHere ? "fa-eye" : "fa-bullhorn"}"></i>${esc(sharedHere ? t("pub.published", { who: this._whoLabel(share) }) : t("pub.button"))}
              <i class="fa-solid fa-chevron-down sb-caret"></i>
            </button>
            ${this.pubOpen ? this._publishHTML(share, sharedHere) : ""}
          </div>
          <button type="button" class="sb-btn primary" data-action="addNote"><i class="fa-solid fa-thumbtack"></i>${esc(t("board.addNote"))}</button>
        </div>` : ""}
      </header>`;
  }

  /** „Alle“, „Anna“ oder „3 Spieler“ */
  _whoLabel(share) {
    if (share.users === "all") return t("pub.whoAll");
    const names = share.users.map(id => game.users.get(id)?.name).filter(Boolean);
    return names.length === 1 ? names[0] : t("pub.whoCount", { n: names.length });
  }

  /** Auswahlfenster: bei wem ploppt das Brett auf? */
  _publishHTML(share, sharedHere) {
    const all = sharedHere ? share.users === "all" : false;
    const shared = sharedHere && Array.isArray(share.users) ? new Set(share.users) : new Set();
    // Nur wer gerade in der Runde ist – plus wer schon freigegeben ist, damit man ihn abwählen kann
    const players = [...game.users].filter(u => !u.isGM && (u.active || shared.has(u.id)))
      .sort((a, b) => (b.active - a.active) || a.name.localeCompare(b.name));
    const sel = sharedHere && !all ? shared : new Set(players.filter(u => u.active).map(u => u.id));
    const hidden = [...game.users].filter(u => !u.isGM && !u.active && !shared.has(u.id)).length;
    return `
      <div class="sb-pub" role="dialog" aria-label="${esc(t("pub.title"))}">
        <h4>${esc(t("pub.title"))}</h4>
        <label class="sb-check all">
          <input type="checkbox" data-pub="all" ${all ? "checked" : ""}>
          <span class="sb-box"><i class="fa-solid fa-check"></i></span>
          <span class="sb-check-text"><b>${esc(t("pub.all"))}</b><small>${esc(t("pub.allHint"))}</small></span>
        </label>
        <div class="sb-pub-list ${all ? "disabled" : ""}">
          ${players.length ? players.map(u => `
            <label class="sb-check">
              <input type="checkbox" data-pub="${u.id}" ${all || sel.has(u.id) ? "checked" : ""} ${all ? "disabled" : ""}>
              <span class="sb-box"><i class="fa-solid fa-check"></i></span>
              <span class="sb-dot ${u.active ? "on" : ""}" data-tooltip="${esc(t(u.active ? "pub.online" : "pub.offline"))}"></span>
              <span class="sb-check-text">${esc(u.name)}${u.character ? `<small>${esc(u.character.name)}</small>` : ""}</span>
            </label>`).join("") : `<p class="sb-pub-empty">${esc(t("pub.noPlayers"))}</p>`}
        </div>
        ${hidden ? `<p class="sb-pub-hidden">${esc(hidden === 1 ? t("pub.hiddenOne") : t("pub.hidden", { n: hidden }))}</p>` : ""}
        <p class="sb-pub-hint"><i class="fa-solid fa-book-open"></i>${esc(t("pub.hint"))}</p>
        <div class="sb-pub-foot">
          ${sharedHere ? `<button type="button" class="sb-btn danger" data-action="unpublish"><i class="fa-solid fa-eye-slash"></i>${esc(t("pub.unpublish"))}</button>` : ""}
          <button type="button" class="sb-btn primary" data-action="publish"><i class="fa-solid fa-bullhorn"></i>${esc(t(sharedHere ? "pub.update" : "pub.publish"))}</button>
        </div>
      </div>`;
  }

  _stageHTML(board) {
    const skin = SKINS[board.skin] ?? SKINS.tavern;
    const gm = game.user.isGM;
    const notes = [...board.notes].sort((a, c) => a.z - c.z).map(n => {
      const tpl = paperOf(n);
      // Umrechnung Größe → % des Brettbilds (für Anzeige und Live-Ziehen)
      const kh = skin.w / skin.h * 100;
      const kw = tpl.w / tpl.h * 100;
      const h = n.scale * kh, w = n.scale * kw;
      const [bw, bh] = rotatedSize(w, h, n.rot, kh / 100);
      const x = clampInside(n.x, bw), y = clampInside(n.y, bh);
      return `<div class="sb-pin" data-note="${n.id}" data-kh="${kh}" data-kw="${kw}" style="left:${x}%;top:${y}%;width:${w}%;height:${h}%;z-index:${n.z};--rot:${n.rot}deg" tabindex="0" role="button" aria-label="${esc(noteLabel(n))}">${noteHTML(n)}${gm ? this._pinToolsHTML() : ""}</div>`;
    }).join("");
    const plate = skin.plate;
    const pl = plateOf(board);
    const pw = plate ? plate[2] - plate[0] : 0, ph = plate ? plate[3] - plate[1] : 0;
    const px = plate ? Math.max(0, Math.min(100 - pw, plate[0] + pl.dx)) : 0, py = plate ? Math.max(0, Math.min(100 - ph, plate[1] + pl.dy)) : 0;
    return `
      <div class="sb-stage" style="aspect-ratio:${skin.w}/${skin.h};--sb-ar:${skin.w / skin.h}">
        <img class="sb-board-img" src="${skin.img}" alt="" draggable="false">
        ${plate ? `<div class="sb-plate" style="left:${px}%;top:${py}%;width:${pw}%;height:${ph}%" data-s="${pl.s}"><span ${gm ? `contenteditable="plaintext-only" spellcheck="false" data-tooltip="${esc(t("board.plateHint"))}" aria-label="${esc(t("toolbar.place"))}"` : ""}>${esc(board.place)}</span>${gm ? `<span class="sb-plate-grip move" data-tooltip="${esc(t("board.plateMove"))}" aria-hidden="true"><i class="fa-solid fa-up-down-left-right"></i></span><span class="sb-plate-grip size" data-tooltip="${esc(t("board.plateSize"))}" aria-hidden="true"><i class="fa-solid fa-text-height"></i></span>` : ""}</div>` : ""}
        <div class="sb-area">${notes}</div>
      </div>`;
  }

  /** Werkzeuge am Zettel (nur SL): erscheinen beim Darüberfahren. */
  _pinToolsHTML() {
    const b = (action, iconName, key, cls = "") =>
      `<button type="button" class="sb-pin-btn ${cls}" data-action="${action}" data-tooltip="${esc(t(key))}" aria-label="${esc(t(key))}"><i class="fa-solid ${iconName}"></i></button>`;
    return `
      <div class="sb-pin-tools">
        ${b("editNote", "fa-pen", "view.edit")}
        ${b("duplicateNote", "fa-clone", "view.duplicate")}
        ${b("removeNote", "fa-thumbtack-slash", "view.remove", "danger")}
      </div>
      <span class="sb-rotate" data-tooltip="${esc(t("board.rotateHint"))}" aria-hidden="true"><i class="fa-solid fa-rotate"></i></span>
      <span class="sb-resize" data-tooltip="${esc(t("board.resizeHint"))}" aria-hidden="true"><i class="fa-solid fa-up-right-and-down-left-from-center"></i></span>`;
  }

  _viewHTML(board) {
    const note = board.notes.find(n => n.id === this.viewId);
    if (!note) return "";
    const tpl = paperOf(note);
    const gm = game.user.isGM;
    if (!gm) {
      return `
      <div class="sb-view player" data-action="closeView" data-any="1">
        <div class="sb-view-note" data-aspect="${tpl.w / tpl.h}">${noteHTML(note)}</div>
        ${isTaken(note.id)
          ? `<button type="button" class="sb-take done" data-action="takeNote" data-done="1"><i class="fa-solid fa-check"></i>${esc(t("take.already"))}</button>`
          : `<button type="button" class="sb-take" data-action="takeNote"><i class="fa-solid fa-hand"></i>${esc(t("take.button"))}</button>`}
      </div>`;
    }
    return `
      <div class="sb-view" data-action="closeView">
        <div class="sb-view-note" data-aspect="${tpl.w / tpl.h}">${noteHTML(note)}</div>
        <aside class="sb-view-actions">
          <button type="button" class="sb-btn primary" data-action="editNote"><i class="fa-solid fa-pen"></i>${esc(t("view.edit"))}</button>
          <button type="button" class="sb-btn" data-action="duplicateNote"><i class="fa-solid fa-clone"></i>${esc(t("view.duplicate"))}</button>
          <button type="button" class="sb-btn danger" data-action="removeNote"><i class="fa-solid fa-thumbtack-slash"></i>${esc(t("view.remove"))}</button>
          <button type="button" class="sb-btn" data-action="closeView"><i class="fa-solid fa-xmark"></i>${esc(t("view.close"))}</button>
        </aside>
      </div>`;
  }

  /* ------------------------------------------------------------ */

  _onRender() {
    const root = this.element;
    root.classList.toggle("sb-player", !game.user.isGM);
    const board = this.board;
    for (const el of root.querySelectorAll("[data-field]")) el.addEventListener("change", ev => this._onField(ev));
    for (const pin of root.querySelectorAll(".sb-pin")) this._bindPin(pin, board);
    this._layoutView();
    const fitAll = () => {
      for (const p of root.querySelectorAll(".sb-pin .sb-paper")) fitText(p);
      const v = root.querySelector(".sb-view-note .sb-paper");
      if (v) fitText(v, { scroll: true });
    };
    fitAll();
    this._fitPlate();
    this._clampWindow();
    this._bindPlate();
    this._bindPublish();
    document.fonts?.ready?.then(() => { fitAll(); this._fitPlate(); });
    root.querySelector(".sb-view")?.addEventListener("keydown", ev => { if (ev.key === "Escape") this._closeView(); });
  }

  /** SL-Fenster: nie höher als der Bildschirm, Kopfzeile und Werkzeugleiste bleiben erreichbar. */
  _clampWindow() {
    if (!game.user.isGM || !this.element) return;
    // Breite nur beim ersten Zeichnen bzw. nach Wechsel des Brettbilds anpassen – sonst würde jede
    // Änderung am Brett ein vom SL selbst groß gezogenes Fenster (feste Höhe) immer schmaler machen.
    const key = this.board?.skin ?? "";
    const mayShrink = this._sbFitKey !== key;
    this._sbFitKey = key;
    const fit = () => {
      const el = this.element;
      if (!el?.isConnected) return;
      const vh = window.innerHeight, vw = window.innerWidth;
      const pos = this.position ?? {};
      const rect = el.getBoundingClientRect();
      const upd = {};
      let width = Number(pos.width) || rect.width;
      if (mayShrink && rect.height > vh - 16) {
        width = Math.max(640, Math.floor(width * (vh - 16) / rect.height));
        upd.width = width;
      }
      if (width > vw - 8) { width = Math.max(480, vw - 8); upd.width = width; }
      const h = Math.min(rect.height * (upd.width ? upd.width / (rect.width || 1) : 1), vh - 16);
      const top = Math.max(8, Math.min(Number(pos.top) || 0, vh - h - 8));
      const left = Math.max(0, Math.min(Number(pos.left) || 0, vw - width));
      if (top !== Number(pos.top)) upd.top = top;
      if (left !== Number(pos.left)) upd.left = left;
      if (Object.keys(upd).length) this.setPosition?.(upd);
    };
    fit();
    requestAnimationFrame(fit);
    document.fonts?.ready?.then(fit);
  }

  /** Ortsname auf dem Schild: Schrift verkleinern, bis er passt. */
  _fitPlate() {
    const plate = this.element?.querySelector(".sb-plate");
    const span = plate?.querySelector("span:not(.sb-plate-grip)");
    if (!span) return;
    let size = 9 * (Number(plate.dataset.s) || 1);
    span.style.fontSize = `${size}cqw`;
    while (span.scrollWidth > plate.clientWidth * 0.92 && size > 4) {
      size -= 0.25;
      span.style.fontSize = `${size}cqw`;
    }
  }

  /** Ortsname direkt auf dem Schild bearbeiten (SL). */
  _bindPlate() {
    const span = this.element.querySelector(".sb-plate span[contenteditable]");
    if (!span) return;
    this._bindPlateGrips();
    span.addEventListener("keydown", ev => {
      if (ev.key === "Enter") { ev.preventDefault(); span.blur(); }
      if (ev.key === "Escape") { ev.preventDefault(); ev.stopPropagation(); span.textContent = this.board?.place ?? ""; span.blur(); }
    });
    span.addEventListener("input", () => this._fitPlate());
    span.addEventListener("blur", async () => {
      const board = this.board;
      const value = span.textContent.replace(/\s+/g, " ").trim();
      if (!board || value === board.place) return;
      if (!value) { span.textContent = board.place; return this._fitPlate(); }
      await upsertBoard({ ...board, place: value });
    });
  }

  /** Schild per Ziehen verschieben (Kreuz-Griff) und Schrift verkleinern (Griff rechts); Doppelklick auf den Kreuz-Griff setzt zurück. */
  _bindPlateGrips() {
    const root = this.element;
    const plateEl = root.querySelector(".sb-plate");
    const stage = root.querySelector(".sb-stage");
    if (!plateEl || !stage) return;
    const skin = SKINS[this.board?.skin] ?? SKINS.tavern;
    const pl0 = skin.plate;
    const pw = pl0[2] - pl0[0], ph = pl0[3] - pl0[1];
    const state = () => plateOf(this.board);
    const save = async (pl) => { const b = this.board; if (b) await upsertBoard({ ...b, plate: pl }); };
    const place = (pl) => {
      plateEl.style.left = `${Math.max(0, Math.min(100 - pw, pl0[0] + pl.dx))}%`;
      plateEl.style.top = `${Math.max(0, Math.min(100 - ph, pl0[1] + pl.dy))}%`;
    };

    const move = plateEl.querySelector(".sb-plate-grip.move");
    move?.addEventListener("pointerdown", ev => {
      if (ev.button !== 0) return;
      ev.preventDefault(); ev.stopPropagation();
      const r = stage.getBoundingClientRect();
      // Versatz auf den Bereich begrenzen, in dem das Schild sichtbar wandert (sonst „tote Zone“ beim Zurückziehen)
      const lim = (p) => ({
        ...p,
        dx: Math.max(Math.max(-40, -pl0[0]), Math.min(Math.min(40, 100 - pw - pl0[0]), p.dx)),
        dy: Math.max(Math.max(-12, -pl0[1]), Math.min(Math.min(40, 100 - ph - pl0[1]), p.dy))
      });
      const start = lim(state()), x0 = ev.clientX, y0 = ev.clientY;
      let cur = start;
      move.setPointerCapture?.(ev.pointerId);
      plateEl.classList.add("moving");
      const onMove = (e) => {
        cur = lim({ ...start, dx: start.dx + (e.clientX - x0) / r.width * 100, dy: start.dy + (e.clientY - y0) / r.height * 100 });
        place(cur);
      };
      const end = () => {
        move.removeEventListener("pointermove", onMove);
        move.removeEventListener("pointerup", end);
        move.removeEventListener("pointercancel", end);
        plateEl.classList.remove("moving");
        if (cur.dx !== start.dx || cur.dy !== start.dy) save(cur);
      };
      move.addEventListener("pointermove", onMove);
      move.addEventListener("pointerup", end);
      move.addEventListener("pointercancel", end);
    });
    move?.addEventListener("dblclick", ev => { ev.preventDefault(); save({ dx: 0, dy: 0, s: 1 }); });

    const size = plateEl.querySelector(".sb-plate-grip.size");
    size?.addEventListener("pointerdown", ev => {
      if (ev.button !== 0) return;
      ev.preventDefault(); ev.stopPropagation();
      const start = state(), x0 = ev.clientX;
      const wpx = plateEl.getBoundingClientRect().width || 1;
      let cur = start;
      size.setPointerCapture?.(ev.pointerId);
      plateEl.classList.add("moving");
      const onMove = (e) => {
        cur = { ...start, s: Math.max(0.3, Math.min(1, start.s + (e.clientX - x0) / wpx)) };
        plateEl.dataset.s = cur.s;
        this._fitPlate();
      };
      const end = () => {
        size.removeEventListener("pointermove", onMove);
        size.removeEventListener("pointerup", end);
        size.removeEventListener("pointercancel", end);
        plateEl.classList.remove("moving");
        if (cur.s !== start.s) save(cur);
      };
      size.addEventListener("pointermove", onMove);
      size.addEventListener("pointerup", end);
      size.addEventListener("pointercancel", end);
    });
  }

  /** Haken im Veröffentlichen-Fenster; Klick daneben schließt es. */
  _bindPublish() {
    const panel = this.element.querySelector(".sb-pub");
    document.removeEventListener("pointerdown", this._pubOutside, true);
    if (!panel) return;
    const all = panel.querySelector('[data-pub="all"]');
    all?.addEventListener("change", () => {
      const list = panel.querySelector(".sb-pub-list");
      list.classList.toggle("disabled", all.checked);
      for (const c of list.querySelectorAll("input")) { c.disabled = all.checked; if (all.checked) c.checked = true; }
    });
    this._pubOutside = (ev) => {
      if (!this.pubOpen || ev.target.closest(".sb-pub-wrap, .application.dialog, dialog")) return;
      this.pubOpen = false;
      document.removeEventListener("pointerdown", this._pubOutside, true);
      this.render();
    };
    document.addEventListener("pointerdown", this._pubOutside, true);
    panel.addEventListener("keydown", ev => { if (ev.key === "Escape") { ev.stopPropagation(); this.pubOpen = false; this.render(); } });
  }

  _onClose(options) {
    document.removeEventListener("pointerdown", this._pubOutside, true);
    super._onClose?.(options);
    if (BoardApp.instance === this) BoardApp.instance = null;
  }

  /** Große Ansicht: Breite aus der verfügbaren Höhe und dem Seitenverhältnis des Zettels. */
  _layoutView() {
    const view = this.element.querySelector(".sb-view-note");
    if (!view) return;
    const box = view.parentElement.getBoundingClientRect();
    const aspect = Number(view.dataset.aspect) || 0.7;
    const maxH = box.height * 0.92 - (game.user.isGM ? 0 : 56); // Spieler: Platz für „Abreißen“
    const maxW = (box.width - (game.user.isGM ? 240 : 0)) * 0.96;
    let h = maxH, w = h * aspect;
    if (w > maxW) { w = maxW; h = w / aspect; }
    view.style.width = `${w}px`;
    view.style.height = `${h}px`;
  }

  _bindPin(pin, board) {
    const gm = game.user.isGM;
    const id = pin.dataset.note;
    pin.addEventListener("keydown", ev => {
      if (ev.target !== pin) return;
      if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); this._openView(id); }
      if (gm && (ev.key === "Delete" || ev.key === "Backspace")) { ev.preventDefault(); this._removeNote(id); }
    });
    if (gm) pin.querySelector(".sb-resize")?.addEventListener("pointerdown", ev => this._startResize(ev, pin, board));
    if (gm) pin.querySelector(".sb-rotate")?.addEventListener("pointerdown", ev => this._startRotate(ev, pin, board));
    pin.addEventListener("pointerdown", ev => {
      if (ev.button !== 0 || ev.target.closest(".sb-pin-tools, .sb-resize, .sb-rotate")) return;
      const area = pin.parentElement.getBoundingClientRect();
      const sx = ev.clientX, sy = ev.clientY;
      // Abstand Mauszeiger ↔ Mittelpunkt merken, damit der Zettel nicht springt
      const ox = sx - (area.left + parseFloat(pin.style.left) / 100 * area.width);
      const oy = sy - (area.top + parseFloat(pin.style.top) / 100 * area.height);
      let dragging = false;
      const move = (e) => {
        if (!gm) return;
        if (!dragging && Math.hypot(e.clientX - sx, e.clientY - sy) < 5) return;
        dragging = true;
        pin.classList.add("dragging");
        const [bw, bh] = rotatedSize(parseFloat(pin.style.width), parseFloat(pin.style.height), parseFloat(pin.style.getPropertyValue("--rot")), Number(pin.dataset.kh) / 100);
        const x = clampInside((e.clientX - ox - area.left) / area.width * 100, bw);
        const y = clampInside((e.clientY - oy - area.top) / area.height * 100, bh);
        pin.style.left = `${x}%`;
        pin.style.top = `${y}%`;
        pin.style.zIndex = 9999;
      };
      const up = async () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        pin.classList.remove("dragging");
        if (!dragging) return this._openView(id);
        const top = Math.max(0, ...board.notes.map(n => Number(n.z) || 0));
        await patchNote(board.id, id, { x: parseFloat(pin.style.left), y: parseFloat(pin.style.top), z: top + 1 });
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
    });
  }

  /** Drehen: Winkel zwischen Mittelpunkt und Mauszeiger bestimmt die Neigung. Umschalt = 5°-Schritte, nahe 0° rastet ein. */
  _startRotate(ev, pin, board) {
    if (ev.button !== 0) return;
    ev.preventDefault();
    ev.stopPropagation();
    const id = pin.dataset.note;
    const note = board.notes.find(n => n.id === id);
    if (!note) return;
    const rect = pin.getBoundingClientRect(); // Mittelpunkt bleibt beim Drehen gleich
    const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
    const ang = (e) => Math.atan2(e.clientY - cy, e.clientX - cx) * 180 / Math.PI;
    const a0 = ang(ev), start = Number(note.rot) || 0;
    let rot = start;
    const badge = document.createElement("span");
    badge.className = "sb-rot-badge";
    pin.append(badge);
    pin.classList.add("rotating");
    document.body.classList.add("sb-resizing");
    const move = (e) => {
      let d = ang(e) - a0;
      d = ((d + 540) % 360) - 180; // kürzester Weg
      let r = start + d;
      if (e.shiftKey) r = Math.round(r / 5) * 5;
      else r = Math.round(r);
      if (Math.abs(r) <= 2) r = 0;
      rot = Math.max(-ROT_MAX, Math.min(ROT_MAX, r));
      pin.style.setProperty("--rot", `${rot}deg`);
      badge.textContent = `${rot}°`;
    };
    badge.textContent = `${rot}°`;
    const up = async () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      badge.remove();
      pin.classList.remove("rotating");
      document.body.classList.remove("sb-resizing");
      if (rot === start) return;
      const [bw, bh] = rotatedSize(parseFloat(pin.style.width), parseFloat(pin.style.height), rot, Number(pin.dataset.kh) / 100);
      const x = clampInside(parseFloat(pin.style.left), bw), y = clampInside(parseFloat(pin.style.top), bh);
      await patchNote(board.id, id, { rot, x, y });
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  /** Größe ziehen: Abstand Ecke ↔ Mittelpunkt bestimmt die neue Größe, der Mittelpunkt bleibt stehen. */
  _startResize(ev, pin, board) {
    if (ev.button !== 0) return;
    ev.preventDefault();
    ev.stopPropagation();
    const id = pin.dataset.note;
    const note = board.notes.find(n => n.id === id);
    if (!note) return;
    const area = pin.parentElement.getBoundingClientRect();
    const kh = Number(pin.dataset.kh), kw = Number(pin.dataset.kw);
    const cx = () => area.left + parseFloat(pin.style.left) / 100 * area.width;
    const cy = () => area.top + parseFloat(pin.style.top) / 100 * area.height;
    const startDist = Math.max(8, Math.hypot(ev.clientX - cx(), ev.clientY - cy()));
    const start = note.scale;
    // Größte Größe, bei der der Zettel noch ganz auf die Bretter passt
    const maxFit = Math.min(SCALE_MAX, (100 - 2 * EDGE) / kh, (100 - 2 * EDGE) / kw);
    let scale = start;
    pin.classList.add("resizing");
    document.body.classList.add("sb-resizing");
    const move = (e) => {
      const d = Math.hypot(e.clientX - cx(), e.clientY - cy());
      scale = Math.min(maxFit, Math.max(SCALE_MIN, start * d / startDist));
      const w = scale * kw, h = scale * kh;
      pin.style.width = `${w}%`;
      pin.style.height = `${h}%`;
      const [bw, bh] = rotatedSize(w, h, note.rot, kh / 100);
      pin.style.left = `${clampInside(note.x, bw)}%`;
      pin.style.top = `${clampInside(note.y, bh)}%`;
      const paper = pin.querySelector(".sb-paper");
      if (paper) fitText(paper);
    };
    const up = async () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      pin.classList.remove("resizing");
      document.body.classList.remove("sb-resizing");
      if (Math.abs(scale - start) < 0.002) return;
      await patchNote(board.id, id, { scale: Math.round(scale * 1000) / 1000, x: parseFloat(pin.style.left), y: parseFloat(pin.style.top) });
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  /** Zettel-ID: aus der großen Ansicht oder vom Zettel, an dem der Knopf sitzt. */
  _noteIdFrom(target) {
    return target.closest(".sb-pin")?.dataset.note ?? this.viewId;
  }

  async _removeNote(id) {
    const ok = await foundry.applications.api.DialogV2.confirm({
      window: { title: t("view.remove") },
      content: `<p>${esc(t("board.confirmRemove"))}</p>`,
      rejectClose: false
    });
    if (!ok) return;
    if (this.viewId === id) this.viewId = null;
    await removeNote(this.boardId, id);
  }

  _openView(noteId) {
    this.viewId = noteId;
    if (game.user.isGM) bringToFront(this.boardId, noteId);
    this.render();
  }

  _closeView() {
    this.viewId = null;
    this.render();
  }

  async _onField(ev) {
    const el = ev.currentTarget;
    const board = this.board;
    const f = el.dataset.field;
    if (f === "board") { this.boardId = el.value; this.viewId = null; return this.render(); }
    if (!board) return;
    if (f === "gmJournal") return void await upsertBoard({ ...board, gmJournal: !!el.checked });
    if (["name", "skin"].includes(f)) {
      const value = el.value.trim();
      if (f === "name" && !value) return this.render();
      await upsertBoard({ ...board, [f]: value });
    }
  }

  /* ------------------------------------------------------------ */

  static async _onNewBoard() {
    const b = newBoard(this.board?.skin ?? "tavern");
    await upsertBoard(b);
    this.boardId = b.id;
    this.viewId = null;
    this.render();
  }

  static async _onDeleteBoard() {
    const board = this.board;
    if (!board) return;
    const ok = await foundry.applications.api.DialogV2.confirm({
      window: { title: t("toolbar.deleteBoard") },
      content: `<p>${esc(t("board.confirmDelete", { name: board.name }))}</p>`,
      rejectClose: false
    });
    if (!ok) return;
    if (getShare()?.boardId === board.id) await setShare(null);
    await deleteBoard(board.id);
    this.boardId = getBoards()[0]?.id ?? null;
    this.render();
  }

  /** Spieler reißt den Zettel ab: Abschrift landet im Journal, der Zettel bleibt für die anderen hängen. */
  static async _onTakeNote(event, target) {
    const id = this.viewId;
    if (!id) return;
    if (target.dataset.done) {
      this._closeView();
      return game.modules.get(MODULE_ID).api.openTaken(id);
    }
    const note = this.element.querySelector(".sb-view-note");
    note?.classList.add("torn");
    target.disabled = true;
    await new Promise(r => setTimeout(r, 420));
    const ok = await takeNote(this.boardId, id);
    this._closeView();
    if (ok) ui.notifications.info(t("take.done"));
  }

  static _onCloseBoard() {
    this.close();
  }

  static _onTogglePublish() {
    this.pubOpen = !this.pubOpen;
    this.render();
  }

  static async _onPublish() {
    const panel = this.element.querySelector(".sb-pub");
    const board = this.board;
    if (!panel || !board) return;
    let users;
    if (panel.querySelector('[data-pub="all"]')?.checked) users = "all";
    else users = [...panel.querySelectorAll(".sb-pub-list input:checked")].map(c => c.dataset.pub);
    if (users !== "all" && !users.length) return ui.notifications.warn(t("pub.pickSomeone"));
    // Rückfrage: nur veröffentlichen (Journal) oder zusätzlich direkt bei den Spielern öffnen?
    const choice = await foundry.applications.api.DialogV2.wait({
      window: { title: t("pub.askTitle"), icon: "fa-solid fa-bullhorn" },
      position: { width: 440 },
      content: `
        <div class="sb-pubask">
          <p>${esc(t("pub.askText", { who: this._whoLabel({ users }) }))}</p>
          <label class="sb-pubask-opt"><input type="radio" name="sbmode" value="open" checked>
            <span><b>${esc(t("pub.askOpen"))}</b><small>${esc(t("pub.askOpenHint"))}</small></span></label>
          <label class="sb-pubask-opt"><input type="radio" name="sbmode" value="only">
            <span><b>${esc(t("pub.askOnly"))}</b><small>${esc(t("pub.askOnlyHint"))}</small></span></label>
        </div>`,
      buttons: [
        {
          action: "go", label: t("pub.publish"), icon: "fa-solid fa-bullhorn", default: true,
          callback: (ev, button) => button.form?.elements?.sbmode?.value ?? "open"
        },
        { action: "cancel", label: t("pub.askCancel"), icon: "fa-solid fa-xmark" }
      ],
      rejectClose: false
    });
    if (choice !== "open" && choice !== "only") return; // Abbrechen / Schließen
    this.pubOpen = false;
    await setShare(board.id, users, choice === "open");
    ui.notifications.info(t("pub.done", { who: this._whoLabel({ users }) }));
  }

  static async _onUnpublish() {
    this.pubOpen = false;
    await setShare(null);
  }

  static _onAddNote() {
    const board = this.board;
    if (board) game.modules.get(MODULE_ID).api.editNote(board.id, null);
  }

  static _onCloseView(event, target) {
    // Klick auf den Hintergrund oder den Schließen-Knopf, nicht auf den Zettel selbst
    if (target.classList.contains("sb-view") && !target.dataset.any && event.target !== target) return;
    this._closeView();
  }

  static _onEditNote(event, target) {
    const id = this._noteIdFrom(target);
    if (this.viewId) { this.viewId = null; this.render(); }
    game.modules.get(MODULE_ID).api.editNote(this.boardId, id);
  }

  static async _onDuplicateNote(event, target) {
    const id = this._noteIdFrom(target);
    this.viewId = null;
    await duplicateNote(this.boardId, id);
  }

  static _onRemoveNote(event, target) {
    return this._removeNote(this._noteIdFrom(target));
  }
}
