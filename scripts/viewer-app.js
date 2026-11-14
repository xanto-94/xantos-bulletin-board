/** Ein eingesteckter Zettel, einzeln geöffnet (Spieler). Ohne sichtbaren Fensterrahmen, mit X und „Wegwerfen“. */
import { paperOf, CUSTOM } from "./skins.js";
import { t } from "./i18n.js";
import { noteHTML, fitText, esc } from "./note.js";
import { getTaken, dropTaken, isBoardLive, noteLabel } from "./data.js";

const { ApplicationV2 } = foundry.applications.api;

export class NoteViewer extends ApplicationV2 {
  static DEFAULT_OPTIONS = {
    classes: ["sb-app", "sb-note-viewer", "sb-player"],
    window: { title: "Zettel", icon: "fa-solid fa-note-sticky", resizable: false, minimizable: false },
    position: { width: 520, height: "auto" },
    actions: {
      closeViewer: NoteViewer._onCloseViewer,
      dropNote: NoteViewer._onDrop
    }
  };

  /** offene Zettel nach id */
  static windows = new Map();

  static toggle(noteId) {
    const app = this.windows.get(noteId);
    if (app?.rendered) return app.close();
    return this.show(noteId);
  }

  static show(noteId) {
    const entry = getTaken().find(e => e.id === noteId);
    if (!entry) return null;
    let app = this.windows.get(noteId);
    if (!app) {
      const tpl = paperOf(entry.note);
      const ar = tpl.w / tpl.h;
      const sb = document.getElementById("sidebar")?.getBoundingClientRect();
      const free = sb && sb.width && sb.left > window.innerWidth / 2 ? sb.left : window.innerWidth;
      const height = Math.round(Math.min(window.innerHeight * 0.82, 900));
      const width = Math.round(Math.min(height * ar, free - 80));
      // mehrere Zettel leicht versetzt öffnen
      const off = (this.windows.size % 5) * 28;
      app = new this({
        id: `xantos-bulletin-board-note-${noteId}`, noteId,
        position: { width, height: "auto", left: Math.max(10, Math.round((free - width) / 2) + off), top: Math.max(10, Math.round((window.innerHeight - width / ar) / 2) - 10 + off) }
      });
      this.windows.set(noteId, app);
    }
    app.render({ force: true });
    app.bringToFront?.();
    return app;
  }

  constructor(options = {}) {
    super(options);
    this.noteId = options.noteId;
  }

  get entry() {
    return getTaken().find(e => e.id === this.noteId) ?? null;
  }

  get title() {
    const n = this.entry?.note;
    return n ? noteLabel(n) : t("app.title");
  }

  async _renderHTML() {
    const entry = this.entry;
    const n = entry?.note;
    if (!n) return `<div class="sb-viewer"></div>`;
    const done = !isBoardLive(entry.boardId);
    return `
      <div class="sb-viewer${done ? " is-done" : ""}">
        <div class="sb-viewer-note">${noteHTML(n)}</div>
        ${done ? `<div class="sb-viewer-done"><i class="fa-solid fa-circle-check"></i>${esc(t("take.doneBadge"))}</div>` : ""}
        <div class="sb-viewer-tools">
          <button type="button" class="sb-viewer-btn" data-action="dropNote" data-tooltip="${esc(t("take.drop"))}" aria-label="${esc(t("take.drop"))}"><i class="fa-solid fa-trash"></i></button>
          <button type="button" class="sb-viewer-btn close" data-action="closeViewer" data-tooltip="${esc(t("view.close"))}" aria-label="${esc(t("view.close"))}"><i class="fa-solid fa-xmark"></i></button>
        </div>
      </div>`;
  }

  _replaceHTML(result, content) {
    content.innerHTML = result;
  }

  _onRender() {
    const paper = this.element.querySelector(".sb-viewer-note .sb-paper");
    if (paper) {
      fitText(paper, { scroll: true });
      document.fonts?.ready?.then(() => fitText(paper, { scroll: true }));
    }
  }

  _onClose(options) {
    super._onClose?.(options);
    if (NoteViewer.windows.get(this.noteId) === this) NoteViewer.windows.delete(this.noteId);
  }

  static _onCloseViewer() {
    this.close();
  }

  static async _onDrop() {
    const ok = await foundry.applications.api.DialogV2.confirm({
      window: { title: t("take.drop") },
      content: `<p>${esc(t("take.dropConfirm"))}</p>`,
      rejectClose: false
    });
    if (!ok) return;
    await dropTaken(this.noteId);
    this.close();
  }
}
