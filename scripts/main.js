import { MODULE_ID, SKINS } from "./skins.js";
import { t, LANGS, defaultLang } from "./i18n.js";
import { esc } from "./note.js";
import { getShare, shareAppliesTo, setShare, getBoard, getTaken, dropTaken, noteLabel } from "./data.js";
import { BoardApp } from "./board-app.js";
import { NoteEditor } from "./editor-app.js";
import { NoteViewer } from "./viewer-app.js";

const SOCKET = `module.${MODULE_ID}`;
let lastShareKey = null;

// Jedes Veröffentlichen hat einen neuen stamp → das Brett ploppt erneut auf
const shareKey = (s) => (s ? `${s.boardId}|${s.stamp ?? ""}` : "");

/** Freigabe geändert: Spielern das Brett öffnen bzw. schließen, Journal-Button aktualisieren. */
function onShareChange() {
  const share = getShare();
  if (game.user.isGM) BoardApp.instance?.refresh();
  else {
    const mine = shareAppliesTo(game.user, share);
    const key = mine ? shareKey(share) : "";
    // nur aufploppen, wenn der SL „veröffentlichen + öffnen“ gewählt hat; sonst erscheint das Brett nur im Journal
    if (mine && key !== lastShareKey && share.open !== false) BoardApp.open();
    else if (mine) BoardApp.instance?.refresh(); // z. B. Brettwechsel ohne Aufploppen: offenes Brett aktualisieren
    if (!mine) BoardApp.instance?.close();
    lastShareKey = key;
  }
  ui.journal?.render?.();
  refreshViewers();
}

/** Offene Einzel-Zettel neu zeichnen (Erledigt-Haken). */
function refreshViewers() {
  if (game.user.isGM) return;
  for (const app of NoteViewer.windows.values()) if (app.rendered) app.render();
}

function onBoardsChange() {
  BoardApp.instance?.refresh();
  if (!game.user.isGM) { ui.journal?.render?.(); refreshViewers(); }
}

function showToGroup(boardId, noteId) {
  game.socket.emit(SOCKET, { t: "show", boardId, noteId, userId: game.user.id });
}

function onSocket(msg) {
  if (msg?.t !== "show") return;
  if (!getBoard(msg.boardId)?.notes.some(n => n.id === msg.noteId)) return;
  if (!game.user.isGM && !shareAppliesTo(game.user)) return;
  if (!game.user.isGM && getShare()?.boardId !== msg.boardId) return;
  BoardApp.open({ boardId: msg.boardId, noteId: msg.noteId });
  const name = game.users.get(msg.userId)?.name ?? "?";
  ui.notifications.info(t("view.shown", { name }));
}

Hooks.once("init", () => {
  game.settings.register(MODULE_ID, "language", {
    name: t("setting.language.name"),
    hint: t("setting.language.hint"),
    scope: "client", config: true, type: String, default: defaultLang(),
    choices: LANGS,
    onChange: () => {
      BoardApp.instance?.render();
      NoteEditor.instance?.render();
      ui.journal?.render?.();
    }
  });
  game.settings.register(MODULE_ID, "boards", {
    scope: "world", config: false, type: Object, default: { list: [] },
    onChange: onBoardsChange
  });
  game.settings.register(MODULE_ID, "share", {
    scope: "world", config: false, type: Object, default: {},
    onChange: onShareChange
  });
});

Hooks.once("ready", () => {
  game.socket.on(SOCKET, onSocket);
  const share = getShare();
  lastShareKey = shareAppliesTo(game.user, share) ? shareKey(share) : "";
  game.modules.get(MODULE_ID).api = {
    open: (boardId) => BoardApp.open({ boardId }),
    editNote: (boardId, noteId = null) => NoteEditor.open(boardId, noteId),
    share: (boardId, users = "all") => setShare(boardId, users),
    stopSharing: () => setShare(null),
    showToGroup,
    openTaken: (noteId) => NoteViewer.show(noteId)
  };
});

/* Spieler kommt oder geht: Liste im Veröffentlichen-Fenster aktualisieren */
Hooks.on("userConnected", () => {
  if (game.user.isGM && BoardApp.instance?.pubOpen) BoardApp.instance.render();
});

/* Im Journal: SL bekommt oben einen Button, Spieler sehen das veröffentlichte Brett als Eintrag ganz oben in der Liste. */
Hooks.on("renderJournalDirectory", (app, html) => {
  const root = html instanceof HTMLElement ? html : html?.[0];
  if (!root) return;
  root.querySelectorAll(".sb-journal-btn, .sb-journal-entry").forEach(e => e.remove());
  if (game.user.isGM) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "sb-journal-btn";
    btn.innerHTML = `<i class="fa-solid fa-thumbtack"></i><span>${t("app.journalButton")}</span>`;
    btn.addEventListener("click", () => BoardApp.open());
    const header = root.querySelector(".directory-header .header-actions")
      ?? root.querySelector(".directory-header")
      ?? root;
    header.append(btn);
    return;
  }
  const list = root.querySelector(".directory-list");
  const frag = document.createDocumentFragment();

  const taken = getTaken();
  const share = getShare();
  const liveId = shareAppliesTo(game.user, share) ? share.boardId : null;

  /** Eine Zeile pro Zettel; erledigt = Brett nicht mehr veröffentlicht oder gelöscht → Haken. */
  const noteRow = (e, done) => {
    const n = e.note;
    const name = noteLabel(n);
    const li = document.createElement("li");
    li.className = `sb-taken${done ? " done" : ""}`;
    li.dataset.id = e.id;
    li.innerHTML = `
      <button type="button" class="sb-taken-open" data-tooltip="${esc(done ? t("take.doneTip") : t("take.open"))}">
        <i class="fa-solid ${done ? "fa-circle-check" : "fa-scroll"}"></i><span>${esc(name)}</span>
      </button>
      <button type="button" class="sb-taken-drop" data-tooltip="${esc(t("take.drop"))}" aria-label="${esc(t("take.drop"))}"><i class="fa-solid fa-xmark"></i></button>`;
    li.querySelector(".sb-taken-open").addEventListener("click", ev => { ev.preventDefault(); ev.stopPropagation(); NoteViewer.toggle(e.id); });
    li.querySelector(".sb-taken-drop").addEventListener("click", async ev => {
      ev.preventDefault();
      ev.stopPropagation();
      const ok = await foundry.applications.api.DialogV2.confirm({
        window: { title: t("take.drop") }, content: `<p>${esc(t("take.dropConfirm"))}</p>`, rejectClose: false
      });
      if (ok) await dropTaken(e.id);
    });
    return li;
  };

  // 1) Das veröffentlichte Brett – immer als Eintrag da, die abgerissenen Zettel darunter
  if (liveId) {
    const board = getBoard(liveId);
    const mine = taken.filter(e => e.boardId === liveId);
    const entry = document.createElement("li");
    entry.className = `sb-journal-entry${mine.length ? " sb-has-notes" : ""}`;
    entry.innerHTML = `
      <button type="button" class="sb-journal-open">
        <span class="sb-journal-ico"><i class="fa-solid fa-thumbtack"></i></span>
        <span class="sb-journal-text"><b>${esc(board?.place && SKINS[board.skin]?.plate ? board.place : (board?.name ?? t("app.title")))}</b><small>${esc(t("app.journalEntryHint"))}</small></span>
        <i class="fa-solid fa-chevron-right sb-journal-arrow"></i>
      </button>`;
    entry.querySelector("button").addEventListener("click", ev => {
      ev.preventDefault();
      ev.stopPropagation();
      BoardApp.toggle(); // öffnen / schließen im Wechsel
    });
    if (mine.length) {
      const sub = document.createElement("ul");
      sub.className = "sb-journal-sub";
      for (const e of mine) sub.append(noteRow(e, false));
      entry.append(sub);
    }
    frag.append(entry);
  }

  // 2) Zettel von Brettern, die nicht mehr veröffentlicht oder gelöscht sind → erledigt
  const old = new Map();
  for (const e of taken) {
    if (e.boardId === liveId) continue;
    if (!old.has(e.boardId)) old.set(e.boardId, []);
    old.get(e.boardId).push(e);
  }
  for (const [boardId, entries] of old) {
    const b = getBoard(boardId);
    const label = (b?.place && SKINS[b.skin]?.plate ? b.place : b?.name) || entries[0].boardName || t("take.oldBoard");
    const sec = document.createElement("li");
    sec.className = "sb-journal-entry sb-journal-group";
    sec.innerHTML = `<div class="sb-journal-head old"><i class="fa-solid fa-circle-check"></i>${esc(label)}<small>${esc(t("take.finished"))}</small></div>`;
    const sub = document.createElement("ul");
    sub.className = "sb-taken-list";
    for (const e of entries) sub.append(noteRow(e, true));
    sec.append(sub);
    frag.append(sec);
  }

  if (frag.childNodes.length) (list ?? root).prepend(frag);
});

/* Eingesteckte Zettel geändert (eigener Benutzer): Journal neu zeichnen, weggeworfene Zettel schließen */
Hooks.on("updateUser", (user, changes) => {
  if (user.id !== game.user.id || !foundry.utils.hasProperty(changes, `flags.${MODULE_ID}`)) return;
  const ids = new Set(getTaken().map(e => e.id));
  for (const [id, app] of NoteViewer.windows) if (!ids.has(id)) app.close();
  ui.journal?.render?.();
  BoardApp.instance?.refresh();
});
