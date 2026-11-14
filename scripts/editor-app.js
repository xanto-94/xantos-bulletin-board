import {
  NOTE_ORDER, SEALS, SEAL_ORDER, SEAL_ICONS, FONTS, FONT_ORDER, noteImg, paperOf, CUSTOM, NOTES,
  BLENDS, IMAGE_LOOKS, IMAGE_LOOK_ORDER, TITLE_SIZES, BODY_SIZES, SIGN_FONTS, SIGN_FONT_ORDER, INK_COLORS, TEXT_COLORS, EMB_COLORS, DECO_KINDS, DECO_GLYPHS
} from "./skins.js";
import { t } from "./i18n.js";
import { noteHTML, noteTextHTML, fitText, sanitize, esc, imageFilter, textFromJSON, plainToHTML, decoHTML, sealHTML } from "./note.js";
import { icon } from "./icons.js";
import { getBoard, newNote, upsertNote, normalizeNote, newImage, normalizeImage, newDeco, normalizeDeco, ROT_MAX } from "./data.js";

const { ApplicationV2 } = foundry.applications.api;

const TABS = [["paper", "fa-scroll"], ["text", "fa-font"], ["seal", "fa-stamp"], ["sign", "fa-signature"], ["images", "fa-image"]];
const DECO_TABS = { deco: ["line", "ornate", "corners"], sign: ["sign", "ink"] };
const isDecoTab = (tab) => tab in DECO_TABS;
const DECO_ICON = { line: "fa-minus", ornate: "fa-diamond", corners: "fa-vector-square", sign: "fa-signature", ink: "fa-pen-nib" };
const FILTERS = [["opacity", 5, 100], ["sepia", 0, 100], ["gray", 0, 100], ["contrast", 40, 220], ["bright", 40, 180]];
/** Formatierung des Fließtexts: [Befehl, fa-Icon, Tooltip-Schlüssel] */
const BODY_TOOLS = [["bold", "fa-bold", "tool.bold"], ["italic", "fa-italic", "tool.italic"], "|",
  ["left", "fa-align-left", "tool.left"], ["center", "fa-align-center", "tool.center"], "|", ["hr", "fa-minus", "tool.hr"]];

function filePicker(callback) {
  const FP = foundry.applications?.apps?.FilePicker?.implementation ?? globalThis.FilePicker;
  if (!FP) return ui.notifications.warn("FilePicker not available");
  new FP({ type: "image", callback }).render(true);
}

/** Natürliche Größe eines Bildes (für Seitenverhältnisse). */
function imageSize(src) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth || 1000, h: img.naturalHeight || 1000 });
    img.onerror = () => resolve({ w: 1000, h: 1000 });
    img.src = src;
  });
}

export class NoteEditor extends ApplicationV2 {
  static DEFAULT_OPTIONS = {
    id: "xantos-bulletin-board-editor",
    classes: ["sb-app", "sb-editor-app"],
    window: { title: "Bulletin Board", icon: "fa-solid fa-feather-pointed", resizable: true },
    position: { width: 1180, height: 820 },
    actions: {
      // nicht „tab“ nennen – den Namen fängt Foundry für eigene Reiter ab
      sbTab: NoteEditor._onTab,
      pickTemplate: NoteEditor._onPickTemplate,
      uploadPaper: NoteEditor._onUploadPaper,
      titleAlign: NoteEditor._onTitleAlign,
      textColor: NoteEditor._onTextColor,
      loadJson: NoteEditor._onLoadJson,
      pickSeal: NoteEditor._onPickSeal,
      pickIcon: NoteEditor._onPickIcon,
      uploadIcon: NoteEditor._onUploadIcon,
      addImage: NoteEditor._onAddImage,
      selectImage: NoteEditor._onSelectImage,
      imageLook: NoteEditor._onImageLook,
      imageBack: NoteEditor._onImageBack,
      replaceImage: NoteEditor._onReplaceImage,
      removeImage: NoteEditor._onRemoveImage,
      resetRot: NoteEditor._onResetRot,
      pickEmbColor: NoteEditor._onPickEmbColor,
      resetEmb: NoteEditor._onResetEmb,
      addDeco: NoteEditor._onAddDeco,
      selectDeco: NoteEditor._onSelectDeco,
      decoStyle: NoteEditor._onDecoStyle,
      decoColor: NoteEditor._onDecoColor,
      removeDeco: NoteEditor._onRemoveDeco,
      addSign: NoteEditor._onAddSign,
      signFont: NoteEditor._onSignFont,
      padClear: NoteEditor._onPadClear,
      padTake: NoteEditor._onPadTake,
      cancel: NoteEditor._onCancel,
      save: NoteEditor._onSave
    }
  };

  static instance = null;

  static open(boardId, noteId = null) {
    if (!game.user.isGM) return null;
    this.instance?.close();
    const app = this.instance = new this({ boardId, noteId });
    app.render({ force: true });
    return app;
  }

  constructor(options = {}) {
    super(options);
    this.boardId = options.boardId;
    const existing = options.noteId ? getBoard(this.boardId)?.notes.find(n => n.id === options.noteId) : null;
    this.isNew = !existing;
    this.draft = existing ? foundry.utils.deepClone(existing) : normalizeNote(newNote());
    this.draft.images ??= [];
    this.draft.deco ??= [];
    this.selDeco = null;
    this.pad = [];
    this.signText = "";
    this.range = null;
    // Neuer Zettel: gleich beim Text anfangen
    this.tab = this.isNew ? "text" : "paper";
    this.selImg = null;
  }

  get title() {
    return t(this.isNew ? "editor.titleNew" : "editor.titleEdit");
  }

  get paperEl() {
    return this.element?.querySelector(".sb-ed-note .sb-paper");
  }

  get bodyEl() {
    return this.element?.querySelector(".sb-rte-area");
  }

  get deco() {
    return this.draft.deco.find(d => d.id === this.selDeco) ?? null;
  }

  get image() {
    return this.draft.images.find(i => i.id === this.selImg) ?? null;
  }

  /* ------------------------------------------------------------ */

  async _renderHTML() {
    const d = this.draft;
    const tpl = paperOf(d);
    return `
      <div class="sb-editor">
        <section class="sb-ed-main">
          <div class="sb-ed-canvas">
            <div class="sb-ed-note ${this.selImg ? "img-mode" : ""} ${isDecoTab(this.tab) ? "deco-mode" : ""}" data-aspect="${tpl.w / tpl.h}">${noteHTML(d, { editable: true, selected: this.selImg, selectedDeco: this.selDeco })}</div>
          </div>
          <p class="sb-ed-hint"><i class="fa-solid fa-circle-info"></i><span></span></p>
        </section>

        <aside class="sb-ed-side">
          <nav class="sb-tabs" role="tablist">${this._tabsHTML()}</nav>
          <div class="sb-tab-body">${this._tabHTML()}</div>
        </aside>

        <footer class="sb-ed-footer">
          <span class="sb-ed-kbd">${esc(t("editor.saveHint"))}</span>
          <button type="button" class="sb-btn" data-action="cancel">${esc(t("editor.cancel"))}</button>
          <button type="button" class="sb-btn primary" data-action="save"><i class="fa-solid fa-thumbtack"></i>${esc(t(this.isNew ? "editor.pin" : "editor.save"))}</button>
        </footer>
        <input type="file" class="sb-json-file" accept=".json,application/json" hidden>
      </div>`;
  }

  _tabsHTML() {
    const d = this.draft;
    return TABS.map(([id, ic]) => {
      const nDeco = (k) => d.deco.filter(x => DECO_TABS[k].includes(x.kind)).length;
      const badge = id === "images" && d.images.length ? `<span class="sb-badge">${d.images.length}</span>`
        : (id === "deco" || id === "sign") && nDeco(id) ? `<span class="sb-badge">${nDeco(id)}</span>`
        : id === "seal" && d.seal ? `<span class="sb-badge dot"></span>` : "";
      return `<button type="button" class="sb-tab ${this.tab === id ? "on" : ""}" data-action="sbTab" data-tab="${id}" role="tab" aria-selected="${this.tab === id}"><i class="fa-solid ${ic}"></i><span>${esc(t(`editor.tab.${id}`))}</span>${badge}</button>`;
    }).join("");
  }

  _fontSelect(field, value) {
    return `
      <select class="sb-select sb-font-select" data-field="${field}" aria-label="${esc(t("editor.fontLabel"))}" data-tooltip="${esc(t("editor.fontLabel"))}" style="font-family:${FONTS[value]}">
        ${FONT_ORDER.map(f => `<option value="${f}" ${f === value ? "selected" : ""} style="font-family:${FONTS[f]}">${esc(t(`font.${f}`))}</option>`).join("")}
      </select>`;
  }

  _sizeSelect(field, value, sizes) {
    const list = sizes.includes(value) ? sizes : [...sizes, value].sort((a, b) => a - b);
    return `
      <select class="sb-select sb-size-select" data-field="${field}" aria-label="${esc(t("editor.sizeLabel"))}" data-tooltip="${esc(t("editor.sizeLabel"))}">
        ${list.map(s => `<option value="${s}" ${s === value ? "selected" : ""}>${s} pt</option>`).join("")}
      </select>`;
  }

  _tabHTML() {
    const d = this.draft;
    if (this.tab === "paper") {
      const custom = d.template === CUSTOM && d.paper;
      return `
        <p class="sb-lead">${esc(t("editor.lead.paper"))}</p>
        <div class="sb-grid sb-tpls">
          ${NOTE_ORDER.map(id => `
            <button type="button" class="sb-tile ${id === d.template ? "on" : ""}" data-action="pickTemplate" data-id="${id}" aria-label="${esc(t(`note.${id}`))}" data-tooltip="${esc(t(`note.${id}`))}">
              <img src="${noteImg(id)}" alt="" draggable="false">
            </button>`).join("")}
          <button type="button" class="sb-tile add ${custom ? "on" : ""}" data-action="uploadPaper" aria-label="${esc(t("editor.customPaper"))}" data-tooltip="${esc(t(custom ? "editor.customPaperReplace" : "editor.customPaperHint"))}">
            ${custom ? `<img src="${esc(d.paper.img)}" alt="" draggable="false">` : `<i class="fa-solid fa-upload"></i><span>${esc(t("editor.customPaper"))}</span>`}
          </button>
        </div>
        ${custom ? `<p class="sb-note-small"><i class="fa-solid fa-circle-check"></i>${esc(t("editor.customPaperOn"))}</p>` : ""}
        <h3>${esc(t("editor.rot"))}</h3>
        ${this._sliderHTML("rot", t("editor.rotLabel"), Math.round(d.rot ?? 0), -ROT_MAX, ROT_MAX, "°")}
        <div class="sb-row"><button type="button" class="sb-btn" data-action="resetRot"><i class="fa-solid fa-arrows-up-down"></i>${esc(t("editor.rotReset"))}</button></div>
        <p class="sb-note-small"><i class="fa-solid fa-lightbulb"></i>${esc(t("editor.rotHint"))}</p>`;
    }
    if (this.tab === "text") {
      const tools = BODY_TOOLS.map(x => x === "|" ? `<span class="sb-sep"></span>` :
        `<button type="button" class="sb-tool" data-cmd="${x[0]}" data-tooltip="${esc(t(x[2]))}" aria-label="${esc(t(x[2]))}"><i class="fa-solid ${x[1]}"></i></button>`).join("");
      return `
        <div class="sb-tgroup">
          <label class="sb-tlabel" for="sb-name-input">${esc(t("editor.name"))}</label>
          <input type="text" id="sb-name-input" class="sb-input sb-name-input" data-field="name" value="${esc(d.name ?? "")}" placeholder="${esc(t("editor.namePh"))}" maxlength="80" autocomplete="off">
          <p class="sb-note-small"><i class="fa-solid fa-tag"></i>${esc(t("editor.nameHint"))}</p>
        </div>

        <div class="sb-tgroup">
          <label class="sb-tlabel" for="sb-title-input">${esc(t("editor.headline"))}</label>
          <input type="text" id="sb-title-input" class="sb-input sb-title-input" data-field="title" value="${esc(d.title)}" placeholder="${esc(t("editor.headlinePh"))}" maxlength="300" autocomplete="off">
          <div class="sb-trow">
            ${this._fontSelect("titleFont", d.titleFont)}
            ${this._sizeSelect("titleSize", d.titleSize, TITLE_SIZES)}
            <div class="sb-seg sb-align" role="group" aria-label="${esc(t("editor.alignLabel"))}">
              <button type="button" class="${d.titleAlign === "left" ? "on" : ""}" data-action="titleAlign" data-align="left" data-tooltip="${esc(t("tool.left"))}" aria-label="${esc(t("tool.left"))}"><i class="fa-solid fa-align-left"></i></button>
              <button type="button" class="${d.titleAlign !== "left" ? "on" : ""}" data-action="titleAlign" data-align="center" data-tooltip="${esc(t("tool.center"))}" aria-label="${esc(t("tool.center"))}"><i class="fa-solid fa-align-center"></i></button>
            </div>
          </div>
          ${this._textColorHTML("title", d.titleColor)}
        </div>

        <div class="sb-tgroup">
          <div class="sb-tlabel-row">
            <label class="sb-tlabel">${esc(t("editor.bodyLabel"))}</label>
            <button type="button" class="sb-linkbtn" data-action="loadJson" data-tooltip="${esc(t("editor.json.hint"))}"><i class="fa-solid fa-file-import"></i>${esc(t("editor.json.load"))}</button>
          </div>
          <div class="sb-trow">
            ${this._fontSelect("bodyFont", d.bodyFont)}
            ${this._sizeSelect("bodySize", d.bodySize, BODY_SIZES)}
          </div>
          ${this._textColorHTML("body", d.bodyColor)}
          <div class="sb-rte">
            <div class="sb-rte-bar" role="toolbar">${tools}</div>
            <div class="sb-rte-area" contenteditable="true" spellcheck="true" lang="${esc(game.i18n?.lang ?? "de")}" data-placeholder="${esc(t("editor.bodyPh"))}">${sanitize(d.body)}</div>
          </div>
          <p class="sb-note-small"><i class="fa-solid fa-lightbulb"></i>${esc(t("editor.bodyTip"))}</p>
        </div>`;
    }
    if (this.tab === "seal") {
      const seal = d.seal;
      return `
        <p class="sb-lead">${esc(t("editor.lead.seal"))}</p>
        <div class="sb-grid sb-seals">
          <button type="button" class="sb-tile none ${!seal ? "on" : ""}" data-action="pickSeal" data-id="" aria-label="${esc(t("editor.sealNone"))}" data-tooltip="${esc(t("editor.sealNone"))}"><i class="fa-solid fa-ban"></i></button>
          ${SEAL_ORDER.map(id => {
            const s = SEALS[id];
            const label = `${t(`seal.${s.color}`)} · ${t(s.band ? "editor.sealBand" : "editor.sealPlain")}`;
            return `<button type="button" class="sb-tile ${seal?.id === id ? "on" : ""}" data-action="pickSeal" data-id="${id}" aria-label="${esc(label)}" data-tooltip="${esc(label)}"><img src="${s.img}" alt="" draggable="false"></button>`;
          }).join("")}
        </div>
        ${seal ? `
          <h3>${esc(t("editor.symbol"))}</h3>
          <div class="sb-grid sb-icons">
            <button type="button" class="sb-tile none ${!seal.icon && !seal.img ? "on" : ""}" data-action="pickIcon" data-id="" aria-label="${esc(t("editor.symbolNone"))}" data-tooltip="${esc(t("editor.symbolNone"))}"><i class="fa-solid fa-ban"></i></button>
            ${SEAL_ICONS.map(n => `<button type="button" class="sb-tile ${seal.icon === n && !seal.img ? "on" : ""}" data-action="pickIcon" data-id="${n}" aria-label="${n}">${icon(n)}</button>`).join("")}
            <button type="button" class="sb-tile upload ${seal.img ? "on" : ""}" data-action="uploadIcon" aria-label="${esc(t("editor.symbolUpload"))}" data-tooltip="${esc(t("editor.symbolUpload"))}">
              ${seal.img ? `<img src="${esc(seal.img)}" alt="">` : `<i class="fa-solid fa-upload"></i>`}
            </button>
          </div>
          ${this._sliderHTML("sealSize", t("editor.sealSize"), seal.size, 8, 60, "%")}
          ${seal.icon || seal.img ? `
            ${this._sliderHTML("embSize", t("editor.symbolSize"), Math.round(seal.isz ?? 100), 30, 170, "%")}
            ${seal.icon ? `
              <h3>${esc(t("editor.symbolColor"))}</h3>
              <div class="sb-swatches">
                <button type="button" class="sb-swatch auto ${!seal.ic ? "on" : ""}" data-action="pickEmbColor" data-color="" data-tooltip="${esc(t("editor.symbolColorAuto"))}" aria-label="${esc(t("editor.symbolColorAuto"))}"></button>
                ${EMB_COLORS.map(c => `<button type="button" class="sb-swatch ${seal.ic?.toLowerCase() === c ? "on" : ""}" style="background:${c}" data-action="pickEmbColor" data-color="${c}" aria-label="${c}"></button>`).join("")}
                <input type="color" class="sb-colorpick" data-field="embColor" value="${/^#[0-9a-f]{6}$/i.test(seal.ic ?? "") ? seal.ic : "#f3d27a"}" aria-label="${esc(t("editor.deco.color"))}">
              </div>` : ""}
            <div class="sb-row"><button type="button" class="sb-btn" data-action="resetEmb"><i class="fa-solid fa-crosshairs"></i>${esc(t("editor.symbolReset"))}</button></div>` : ""}
          <p class="sb-note-small"><i class="fa-solid fa-hand-pointer"></i>${esc(t("editor.sealHint"))}</p>` : ""}`;
    }
    if (isDecoTab(this.tab)) return this._decoTabHTML(this.tab);
    // Bilder
    const img = this.image;
    return `
      <p class="sb-lead">${esc(t("editor.lead.images"))}</p>
      <div class="sb-img-list">
        ${d.images.map(i => `
          <button type="button" class="sb-img-chip ${i.id === this.selImg ? "on" : ""}" data-action="selectImage" data-id="${esc(i.id)}" data-tooltip="${esc(t(i.back ? "editor.img.behind" : "editor.img.front"))}">
            <img src="${esc(i.src)}" alt="" draggable="false">${i.back ? `<i class="fa-solid fa-layer-group"></i>` : ""}
          </button>`).join("")}
        <button type="button" class="sb-img-chip add" data-action="addImage" data-tooltip="${esc(t("editor.img.add"))}" aria-label="${esc(t("editor.img.add"))}"><i class="fa-solid fa-plus"></i></button>
      </div>
      ${img ? `
        <h3>${esc(t("editor.img.look"))}</h3>
        <div class="sb-looks">
          ${IMAGE_LOOK_ORDER.map(k => {
            const L = IMAGE_LOOKS[k];
            const on = img.blend === L.blend && Object.entries(L.f).every(([fk, v]) => img.f[fk] === v);
            return `<button type="button" class="sb-look ${on ? "on" : ""}" data-action="imageLook" data-id="${k}">
              <span class="sb-look-prev" style="background-image:url('${noteImg("01-pergament-gemalt")}')"><img src="${esc(img.src)}" alt="" style="mix-blend-mode:${L.blend};opacity:${L.f.opacity / 100};filter:${imageFilter(L.f)}"></span>
              <small>${esc(t(`look.${k}`))}</small></button>`;
          }).join("")}
        </div>
        <h3>${esc(t("editor.img.blend"))}</h3>
        <select class="sb-select wide" data-field="blend">
          ${BLENDS.map(b => `<option value="${b}" ${img.blend === b ? "selected" : ""}>${esc(t(`blend.${b}`))}</option>`).join("")}
        </select>
        <h3>${esc(t("editor.img.filters"))}</h3>
        ${FILTERS.map(([k, min, max]) => this._sliderHTML(`f-${k}`, t(`filter.${k}`), img.f[k], min, max, "%")).join("")}
        <label class="sb-switch">
          <input type="checkbox" data-action="imageBack" ${img.back ? "checked" : ""}>
          <span class="sb-switch-ui"></span>
          <span class="sb-switch-text">${esc(t("editor.img.back"))}<small>${esc(t("editor.img.backHint"))}</small></span>
        </label>
        <div class="sb-row">
          <button type="button" class="sb-btn" data-action="replaceImage"><i class="fa-solid fa-arrows-rotate"></i>${esc(t("editor.img.replace"))}</button>
          <button type="button" class="sb-btn danger" data-action="removeImage"><i class="fa-solid fa-trash"></i>${esc(t("editor.img.remove"))}</button>
        </div>` : d.images.length ? `<p class="sb-note-small"><i class="fa-solid fa-hand-pointer"></i>${esc(t("editor.img.pick"))}</p>` : ""}`;
  }

  /* ---------------- Reiter „Zierde“ und „Unterschrift“ ---------------- */

  _swatchesHTML(current, action = "decoColor", field = "d-color") {
    const cur = String(current ?? "").toLowerCase();
    return `<div class="sb-swatches">
      ${INK_COLORS.map((c, i) => `<button type="button" class="sb-swatch ${cur === c ? "on" : ""}" style="background:${c}" data-action="${action}" data-color="${c}" data-tooltip="${esc(t(["color.brown", "color.ink", "color.blood"][i]))}" aria-label="${c}"></button>`).join("")}
      <input type="color" class="sb-colorpick ${cur && !INK_COLORS.includes(cur) ? "on" : ""}" data-field="${field}" value="${/^#[0-9a-f]{6}$/i.test(cur) ? cur : "#2a1a0e"}" aria-label="${esc(t("editor.deco.color"))}">
    </div>`;
  }

  /** Farbwahl für Überschrift / Fließtext: Braun (Standard), Tinte, Blut, freie Farbe. */
  _textColorHTML(part, current) {
    const cur = String(current ?? "").toLowerCase();
    const preset = TEXT_COLORS.some(x => x.v === cur);
    return `<div class="sb-tcolor" data-tcolor="${part}">
      <span>${esc(t("editor.textColor"))}</span>
      <div class="sb-swatches">
        ${TEXT_COLORS.map((x, i) => `<button type="button" class="sb-swatch ${cur === x.v ? "on" : ""}" style="background:${x.c}" data-action="textColor" data-part="${part}" data-color="${x.v}" data-tooltip="${esc(t(["color.brown", "color.ink", "color.blood"][i]))}" aria-label="${esc(t(["color.brown", "color.ink", "color.blood"][i]))}"></button>`).join("")}
        <input type="color" class="sb-colorpick ${cur && !preset ? "on" : ""}" data-field="${part}ColorPick" value="${/^#[0-9a-f]{6}$/i.test(cur) ? cur : "#3d1607"}" data-tooltip="${esc(t("color.custom"))}" aria-label="${esc(t("color.custom"))}">
      </div>
    </div>`;
  }

  /** Markierung der Farbfelder nach einer Auswahl aktualisieren (ohne den Reiter neu zu bauen). */
  _markTextColor(part) {
    const box = this.element?.querySelector(`[data-tcolor="${part}"]`);
    if (!box) return;
    const cur = String(this.draft[`${part}Color`] ?? "").toLowerCase();
    const preset = TEXT_COLORS.some(x => x.v === cur);
    for (const b of box.querySelectorAll(".sb-swatch")) b.classList.toggle("on", b.dataset.color === cur);
    const pick = box.querySelector(".sb-colorpick");
    pick?.classList.toggle("on", !!cur && !preset);
    if (pick && /^#[0-9a-f]{6}$/i.test(cur)) pick.value = cur;
  }

  _decoSample(kind) {
    const sty = "stroke:currentColor;fill:none;stroke-width:2;vector-effect:non-scaling-stroke";
    if (kind === "line") return `<svg viewBox="0 0 34 14"><path d="M2 7H32" style="${sty}"/></svg>`;
    if (kind === "ornate") return `<svg viewBox="0 0 34 14"><path d="M2 7H12M22 7H32" style="${sty}"/><path d="M17 3L21 7L17 11L13 7Z" fill="currentColor"/></svg>`;
    return `<svg viewBox="0 0 34 14"><path d="M3 6V2H8M26 2H31V6M31 8V12H26M8 12H3V8" style="${sty}"/></svg>`;
  }

  _decoTabHTML(tab) {
    const d = this.draft;
    const kinds = DECO_TABS[tab];
    const list = d.deco.filter(x => kinds.includes(x.kind));
    const sel = this.deco && kinds.includes(this.deco.kind) ? this.deco : null;
    const chips = list.length ? `<div class="sb-deco-chips">${list.map(x => `
      <button type="button" class="sb-deco-chip ${x.id === this.selDeco ? "on" : ""}" data-action="selectDeco" data-id="${esc(x.id)}" data-tooltip="${esc(t(`editor.deco.${x.kind}`))}">
        <i class="fa-solid ${DECO_ICON[x.kind]}"></i><span>${esc(x.kind === "sign" ? x.text : t(`editor.deco.${x.kind}`))}</span></button>`).join("")}</div>` : "";

    if (tab === "deco") {
      return `
        <p class="sb-lead">${esc(t("editor.lead.deco"))}</p>
        <div class="sb-deco-list">
          ${kinds.map(k => `<button type="button" class="sb-deco-add" data-action="addDeco" data-kind="${k}">${this._decoSample(k)}<span>${esc(t(`editor.deco.${k}`))}</span></button>`).join("")}
        </div>
        ${chips}
        ${sel ? this._decoPanelHTML(sel) : list.length ? `<p class="sb-note-small"><i class="fa-solid fa-hand-pointer"></i>${esc(t("editor.deco.pick"))}</p>` : ""}`;
    }
    // Unterschrift
    const text = this.signText;
    return `
      <p class="sb-lead">${esc(t("editor.lead.sign"))}</p>
      <div class="sb-tgroup">
        <label class="sb-tlabel" for="sb-sign-text">${esc(t("editor.sign.text"))}</label>
        <input type="text" id="sb-sign-text" class="sb-input sign-input" data-field="signText" value="${esc(text)}" placeholder="${esc(t("editor.sign.textPh"))}" maxlength="60" autocomplete="off">
        <div class="sb-row"><button type="button" class="sb-btn primary" data-action="addSign"><i class="fa-solid fa-signature"></i>${esc(t("editor.sign.add"))}</button></div>
      </div>
      <div class="sb-tgroup">
        <h3>${esc(t("editor.sign.draw"))}</h3>
        <canvas class="sb-pad" aria-label="${esc(t("editor.sign.padHint"))}"></canvas>
        <div class="sb-row">
          <button type="button" class="sb-btn" data-action="padClear"><i class="fa-solid fa-eraser"></i>${esc(t("editor.sign.clear"))}</button>
          <button type="button" class="sb-btn primary" data-action="padTake"><i class="fa-solid fa-check"></i>${esc(t("editor.sign.take"))}</button>
        </div>
      </div>
      ${chips}
      ${sel ? this._decoPanelHTML(sel) : ""}`;
  }

  /** Eigenschaften des gewählten Zierelements bzw. der Unterschrift. */
  _decoPanelHTML(x) {
    const K = DECO_KINDS[x.kind];
    const sl = (f, label, v, min, max, unit = "") => this._sliderHTML(f, label, v, min, max, unit);
    const parts = [];
    parts.push(`<h3>${esc(t(`editor.deco.${x.kind}`))}</h3>`);
    if (x.kind === "sign") {
      parts.push(`<input type="text" class="sb-input sign-input" data-field="d-text" value="${esc(x.text)}" maxlength="60" aria-label="${esc(t("editor.sign.text"))}">`);
      parts.push(`<div class="sb-seg-row">${SIGN_FONT_ORDER.map(f => `<button type="button" class="sb-pill sign-font ${x.font === f ? "on" : ""}" style="font-family:${SIGN_FONTS[f]}" data-action="signFont" data-font="${f}">${esc((x.text || "Aldric").slice(0, 10))}</button>`).join("")}</div>`);
      parts.push(sl("d-sz", t("editor.sign.size"), Math.round(x.sz), 2, 40));
    } else if (K?.styles.length > 1) {
      parts.push(`<div class="sb-seg-row">${K.styles.map(st => `<button type="button" class="sb-pill ${x.style === st ? "on" : ""}" data-action="decoStyle" data-style="${st}">${x.kind === "ornate" ? `${DECO_GLYPHS[st]} ` : ""}${esc(t(`editor.style.${st}`))}</button>`).join("")}</div>`);
    }
    if (x.kind !== "sign") parts.push(sl("d-w", t("editor.deco.width"), Math.round(x.w), 3, x.kind === "ink" ? 120 : 130, "%"));
    if (x.kind === "corners") parts.push(sl("d-h", t("editor.deco.height"), Math.round(x.h), 3, 130, "%"));
    parts.push(sl("d-t", t("editor.deco.thickness"), Math.round(x.t * 10), 1, 40));
    if (x.kind === "corners") parts.push(sl("d-r", t("editor.deco.cornerLen"), Math.round(x.r), 2, 40));
    parts.push(sl("d-rot", t("editor.deco.rotation"), Math.round(x.rot), -180, 180, "°"));
    parts.push(sl("d-opacity", t("editor.deco.opacity"), Math.round(x.opacity), 10, 100, "%"));
    parts.push(`<h3>${esc(t("editor.deco.color"))}</h3>${this._swatchesHTML(x.color)}`);
    parts.push(`<div class="sb-row"><button type="button" class="sb-btn danger" data-action="removeDeco"><i class="fa-solid fa-trash"></i>${esc(t("editor.deco.remove"))}</button></div>`);
    return parts.join("");
  }

  _sliderHTML(field, label, value, min, max, unit = "") {
    return `
      <label class="sb-slider">
        <span class="sb-slider-head"><span>${esc(label)}</span><output>${value}${unit}</output></span>
        <input type="range" class="sb-range" data-field="${field}" min="${min}" max="${max}" step="1" value="${value}" data-unit="${unit}">
      </label>`;
  }

  _replaceHTML(result, content) {
    const scroll = content.querySelector(".sb-tab-body")?.scrollTop ?? 0;
    content.innerHTML = result;
    const body = content.querySelector(".sb-tab-body");
    if (body) body.scrollTop = scroll;
  }

  _onRender() {
    const root = this.element;
    this._layoutNote();
    // Beim ersten Öffnen ist das Fenster beim Zeichnen oft noch nicht fertig dimensioniert → Vorschau neu einpassen,
    // sobald sich die Fläche ändert (auch beim Vergrößern des Fensters)
    this._ro?.disconnect();
    const canvasEl = root.querySelector(".sb-ed-canvas");
    if (canvasEl && typeof ResizeObserver !== "undefined") {
      this._ro = new ResizeObserver(() => { this._layoutNote(); this._refreshPreview(); });
      this._ro.observe(canvasEl);
    }
    requestAnimationFrame(() => { if (this.rendered) this._layoutNote(); });
    try { document.execCommand("defaultParagraphSeparator", false, "p"); } catch { /* egal */ }
    this._bindTab();
    this._bindSealDrag();
    this._bindImages();
    this._bindDecos();
    this._bindPad();
    this._bindPreviewClicks();

    const file = root.querySelector(".sb-json-file");
    file?.addEventListener("change", async () => {
      const f = file.files?.[0];
      file.value = "";
      if (f) this._applyJSONText(await f.text());
    });

    if (!this._onKey) {
      // Auf dem Dokument, damit es auch greift, wenn der Fokus nach einem Klick verloren ging
      this._onKey = (ev) => {
        if (!this.rendered) return;
        const other = ev.target.closest?.(".application, .app");
        if (other && other !== this.element) return;
        if (ev.key === "Enter" && (ev.ctrlKey || ev.metaKey)) { ev.preventDefault(); NoteEditor._onSave.call(this); }
        if ((ev.key === "Delete" || ev.key === "Backspace") && this.selDeco && !this.selImg && !ev.target.closest?.("[contenteditable], input, select, textarea, button")) {
          ev.preventDefault();
          NoteEditor._onRemoveDeco.call(this);
        }
        // Entf löscht das gewählte Bild, wenn gerade kein Text bearbeitet wird
        if ((ev.key === "Delete" || ev.key === "Backspace") && this.selImg && !ev.target.closest?.("[contenteditable], input, select, textarea")) {
          ev.preventDefault();
          NoteEditor._onRemoveImage.call(this);
        }
      };
      document.addEventListener("keydown", this._onKey);
      this._onSel = () => this._updateTools();
      document.addEventListener("selectionchange", this._onSel);
    }

    // Neuer Zettel: Überschrift markiert, damit man sofort lostippen kann
    if (this.isNew && !this._focused && this.tab === "text") {
      this._focused = true;
      const input = root.querySelector(".sb-title-input");
      input?.focus();
      input?.select();
    }
    this._refreshPreview();
    document.fonts?.ready?.then(() => this._refreshPreview());
  }

  _onClose(options) {
    super._onClose?.(options);
    if (this._onKey) document.removeEventListener("keydown", this._onKey);
    if (this._onSel) document.removeEventListener("selectionchange", this._onSel);
    this._onKey = this._onSel = null;
    this._ro?.disconnect();
    this._ro = null;
    if (NoteEditor.instance === this) NoteEditor.instance = null;
  }

  _layoutNote() {
    const note = this.element.querySelector(".sb-ed-note");
    if (!note) return;
    const box = note.parentElement.getBoundingClientRect();
    const aspect = Number(note.dataset.aspect) || 0.7;
    let h = box.height * 0.94, w = h * aspect;
    if (w > box.width * 0.94) { w = box.width * 0.94; h = w / aspect; }
    note.style.width = `${w}px`;
    note.style.height = `${h}px`;
  }

  /** Text in der Vorschau neu setzen und einpassen (ohne den ganzen Editor neu zu zeichnen). */
  _refreshPreview() {
    const paper = this.paperEl;
    const box = paper?.querySelector(".sb-text-box");
    if (!box) return;
    box.innerHTML = noteTextHTML(this.draft);
    this._over = fitText(paper, { scroll: true });
    this._hint();
  }

  /** Hinweiszeile unter dem Zettel – passend zu dem, was gerade ausgewählt ist. */
  _hint() {
    const hint = this.element?.querySelector(".sb-ed-hint");
    if (!hint) return;
    let key = "editor.hintText";
    if (this._over) key = "editor.overflow";
    else if (this.selImg) key = "editor.hintImage";
    else if (this.tab === "seal" && this.draft.seal) key = "editor.sealHint";
    else if (this.tab === "deco") key = "editor.hintDeco";
    else if (this.tab === "sign") key = "editor.hintSign";
    hint.classList.toggle("warn", !!this._over);
    hint.querySelector("span").textContent = t(key);
  }

  /* ---------------- Reiter-Inhalt ---------------- */

  /** Nur die Seitenleiste neu zeichnen (Vorschau, Bilder und Siegel bleiben unberührt). */
  _swapTab() {
    const side = this.element?.querySelector(".sb-ed-side");
    if (!side) return;
    this._syncBody();
    this.element.querySelector(".sb-ed-note")?.classList.toggle("deco-mode", isDecoTab(this.tab));
    side.querySelector(".sb-tabs").innerHTML = this._tabsHTML();
    side.querySelector(".sb-tab-body").innerHTML = this._tabHTML();
    this._bindTab();
    this._bindPad();
    this._hint();
  }

  _bindTab() {
    const body = this.element.querySelector(".sb-tab-body");
    if (!body) return;
    for (const el of body.querySelectorAll("[data-field]")) {
      el.addEventListener("input", ev => this._onField(ev));
      el.addEventListener("change", ev => this._onField(ev));
    }
    const title = body.querySelector(".sb-title-input");
    title?.addEventListener("keydown", ev => {
      // Enter in der Überschrift springt in den Fließtext
      if (ev.key === "Enter" && !ev.ctrlKey && !ev.metaKey) { ev.preventDefault(); this._focusBody(true); }
    });
    const area = this.bodyEl;
    if (!area) return;
    area.addEventListener("input", () => { this._syncBody(); this._refreshPreview(); });
    area.addEventListener("paste", ev => this._onPaste(ev));
    area.addEventListener("focus", () => this._deselectImage());
    for (const b of body.querySelectorAll(".sb-rte-bar .sb-tool")) {
      b.addEventListener("mousedown", ev => ev.preventDefault());
      b.addEventListener("click", () => this._exec(b.dataset.cmd));
    }
    this._updateTools();
  }

  _syncBody() {
    const area = this.bodyEl;
    if (area) this.draft.body = area.innerHTML;
  }

  _focusBody(atEnd = false) {
    const area = this.bodyEl;
    if (!area) return;
    area.focus();
    if (atEnd) {
      const r = document.createRange();
      r.selectNodeContents(area);
      r.collapse(false);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(r);
    }
  }

  _onField(ev) {
    const el = ev.currentTarget;
    const f = el.dataset.field;
    const out = el.closest(".sb-slider")?.querySelector("output");
    if (out) out.textContent = `${el.value}${el.dataset.unit ?? ""}`;
    const d = this.draft;
    if (f === "name") { d.name = el.value; return; }
    if (f === "titleColorPick" || f === "bodyColorPick") {
      const part = f === "titleColorPick" ? "title" : "body";
      d[`${part}Color`] = el.value.toLowerCase();
      this._markTextColor(part);
      return this._refreshPreview();
    }
    if (f === "title") { d.title = el.value; return this._refreshPreview(); }
    if (f === "titleFont" || f === "bodyFont") {
      d[f] = el.value;
      el.style.fontFamily = FONTS[el.value];
      return this._refreshPreview();
    }
    if (f === "titleSize" || f === "bodySize") { d[f] = Number(el.value); return this._refreshPreview(); }
    if (f === "rot") { d.rot = Number(el.value); return; }
    if (f === "signText") { this.signText = el.value; return; }
    if (f === "embSize" && d.seal) { d.seal.isz = Number(el.value); return this._redrawSeal(); }
    if (f === "embColor" && d.seal) { d.seal.ic = el.value; return this._redrawSeal(true); }
    if (f.startsWith("d-")) return this._onDecoField(f.slice(2), el);
    if (f === "sealSize" && d.seal) {
      d.seal.size = Number(el.value);
      const s = this.element.querySelector(".sb-ed-note .sb-seal");
      if (s) s.style.width = `${d.seal.size}%`;
      return;
    }
    const img = this.image;
    if (!img) return;
    if (f === "blend") img.blend = el.value;
    else if (f.startsWith("f-")) img.f[f.slice(2)] = Number(el.value);
    this._applyImageStyle(img);
    // Die Schnellwahl stimmt nicht mehr
    for (const b of this.element.querySelectorAll(".sb-look.on")) b.classList.remove("on");
  }

  _applyImageStyle(img) {
    const el = this.element.querySelector(`.sb-ed-note .sb-img[data-img="${CSS.escape(img.id)}"] img`);
    if (!el) return;
    el.style.mixBlendMode = img.blend;
    el.style.opacity = img.f.opacity / 100;
    el.style.filter = imageFilter(img.f);
  }

  /* ---------------- Fließtext: Formatierung, Einfügen, JSON ---------------- */

  /** Absatz, in dem der Cursor im Textfeld steht. */
  _currentBlock(create = true) {
    const area = this.bodyEl;
    const sel = window.getSelection();
    let node = sel?.anchorNode;
    if (!area || !node || !area.contains(node)) return null;
    if (node.nodeType === Node.TEXT_NODE) node = node.parentElement;
    let block = node.closest("h1,h2,h3,p,div");
    if ((!block || !area.contains(block) || block === area) && create) {
      document.execCommand("formatBlock", false, "p");
      node = window.getSelection()?.anchorNode;
      if (node?.nodeType === Node.TEXT_NODE) node = node.parentElement;
      block = node?.closest?.("h1,h2,h3,p,div");
    }
    return block && area.contains(block) && block !== area ? block : null;
  }

  /** Alle Absätze, die von der Markierung berührt werden (ohne Markierung: der Absatz am Cursor). */
  _selectedBlocks() {
    const area = this.bodyEl;
    const sel = window.getSelection();
    if (area && sel?.rangeCount && area.contains(sel.anchorNode)) this._wrapLoose(sel.getRangeAt(0));
    const first = this._currentBlock(); // legt im leeren Feld einen Absatz an
    if (!area || !sel?.rangeCount || sel.isCollapsed) return first ? [first] : [];
    const range = sel.getRangeAt(0);
    // Endet die Markierung ganz am Anfang eines Absatzes (Dreifachklick), gehört er nicht dazu
    const endsAtStart = (el) => {
      if (!el.contains(range.endContainer) || el.contains(range.startContainer)) return false;
      const r = document.createRange();
      r.setStart(el, 0);
      r.setEnd(range.endContainer, range.endOffset);
      return !r.toString() && !r.cloneContents().querySelector?.("img,hr,br");
    };
    const list = [...area.children].filter(el => /^(P|H1|H2|H3|DIV)$/.test(el.tagName) && range.intersectsNode(el) && !endsAtStart(el));
    return list.length ? list : (first ? [first] : []);
  }

  /**
   * Lose Inhalte direkt im Textfeld (Text, <b>, <br> … ohne Absatz, z. B. die erste getippte Zeile)
   * in Absätze packen, soweit die Markierung sie berührt – sonst ließen sie sich nicht ausrichten.
   */
  _wrapLoose(range) {
    const area = this.bodyEl;
    const sel = window.getSelection();
    const loose = (n) => n.nodeType === Node.TEXT_NODE || (n.nodeType === Node.ELEMENT_NODE && !/^(P|H1|H2|H3|DIV|HR)$/.test(n.tagName));
    const runs = [];
    let run = [];
    for (const n of [...area.childNodes]) {
      if (loose(n)) run.push(n);
      else { if (run.length) runs.push(run); run = []; }
    }
    if (run.length) runs.push(run);
    const todo = runs.filter(r => r.some(n => range.intersectsNode(n)) && r.some(n => n.textContent.trim() || n.nodeName === "IMG"));
    if (!todo.length) return;
    const saved = [sel.anchorNode, sel.anchorOffset, sel.focusNode, sel.focusOffset];
    for (const r of todo) {
      const p = document.createElement("p");
      r[0].before(p);
      p.append(...r);
    }
    try { if (saved[0] !== area && saved[2] !== area) sel.setBaseAndExtent(...saved); } catch { /* Auswahl bleibt, wie sie ist */ }
  }

  /** Formatierungsknöpfe zeigen, was an der Cursorstelle gilt. */
  _updateTools() {
    const root = this.element;
    const area = this.bodyEl;
    if (!root || !area) return;
    const inText = area.contains(window.getSelection()?.anchorNode);
    const block = inText ? this._currentBlock(false) : null;
    const st = (c) => { try { return document.queryCommandState(c); } catch { return false; } };
    const on = {
      bold: inText && st("bold"), italic: inText && st("italic"),
      center: !!block?.classList.contains("sb-center"), left: !!block && !block.classList.contains("sb-center")
    };
    for (const b of root.querySelectorAll(".sb-rte-bar .sb-tool")) b.classList.toggle("on", !!on[b.dataset.cmd]);
  }

  _exec(cmd) {
    const area = this.bodyEl;
    if (!area) return;
    if (!area.contains(window.getSelection()?.anchorNode)) this._focusBody(true);
    switch (cmd) {
      case "bold": case "italic":
        document.execCommand(cmd);
        break;
      case "left": case "center": {
        for (const b of this._selectedBlocks()) { b.classList.remove("sb-left", "sb-center"); b.classList.add(`sb-${cmd}`); }
        break;
      }
      case "hr":
        document.execCommand("insertHorizontalRule");
        break;
    }
    this._syncBody();
    this._refreshPreview();
    this._updateTools();
  }

  /** Einfügen: JSON füllt Überschrift und Text, sonst wird Klartext in Absätze umgewandelt. */
  _onPaste(ev) {
    const text = ev.clipboardData?.getData("text/plain") ?? "";
    ev.preventDefault();
    if (/^\s*[[{]/.test(text) && this._applyJSONText(text, { quiet: true })) return;
    if (/\n/.test(text)) document.execCommand("insertHTML", false, sanitize(plainToHTML(text)));
    else document.execCommand("insertText", false, text);
    this._syncBody();
    this._refreshPreview();
  }

  /** JSON-Text übernehmen. Gibt true zurück, wenn etwas übernommen wurde. */
  _applyJSONText(text, { quiet = false } = {}) {
    let data;
    try { data = JSON.parse(text); }
    catch {
      if (!quiet) ui.notifications.error(t("editor.json.bad"));
      return false;
    }
    if (Array.isArray(data)) {
      if (data.length > 1) ui.notifications.info(t("editor.json.first", { n: data.length }));
      data = data[0];
    }
    const patch = textFromJSON(data);
    if (!patch) {
      if (!quiet) ui.notifications.error(t("editor.json.empty"));
      return false;
    }
    if (typeof data.template === "string" && NOTES[data.template]) { this.draft.template = data.template; this.draft.paper = null; }
    Object.assign(this.draft, patch);
    this.draft = normalizeNote({ ...this.draft, body: sanitize(this.draft.body) });
    ui.notifications.info(t("editor.json.done"));
    this.tab = "text";
    this.render();
    return true;
  }

  /* ---------------- Vorschau: Klick auf den Text öffnet das passende Feld ---------------- */

  _bindPreviewClicks() {
    const box = this.paperEl?.querySelector(".sb-text-box");
    box?.addEventListener("click", ev => {
      if (this.selImg) return;
      const part = ev.target.closest("[data-part]")?.dataset.part ?? "body";
      if (this.tab !== "text") { this.tab = "text"; this._swapTab(); }
      if (part === "title") this.element.querySelector(".sb-title-input")?.focus();
      else this._focusBody(true);
    });
  }

  /* ---------------- Siegel verschieben ---------------- */

  _bindSealDrag() {
    const paper = this.paperEl;
    const seal = paper?.querySelector(".sb-seal");
    if (!seal) return;
    seal.addEventListener("pointerdown", ev => {
      ev.preventDefault();
      this._deselectImage();
      if (this.tab !== "seal") { this.tab = "seal"; this._swapTab(); }
      // Auf dem Symbol gegriffen → nur das Symbol im Siegel verschieben
      const emb = ev.target.closest(".sb-emb");
      if (emb && this.draft.seal) return this._dragEmb(ev, seal, emb);
      const rect = paper.getBoundingClientRect();
      seal.classList.add("dragging");
      const move = (e) => {
        const x = Math.min(100, Math.max(0, (e.clientX - rect.left) / rect.width * 100));
        const y = Math.min(100, Math.max(0, (e.clientY - rect.top) / rect.height * 100));
        this.draft.seal.x = Math.round(x * 10) / 10;
        this.draft.seal.y = Math.round(y * 10) / 10;
        seal.style.left = `${x}%`;
        seal.style.top = `${y}%`;
      };
      const up = () => {
        seal.classList.remove("dragging");
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
    });
  }

  /** Symbol innerhalb des Siegels verschieben (Versatz in % der Siegelgröße). */
  _dragEmb(ev, seal, emb) {
    const sd = this.draft.seal;
    const rect = seal.getBoundingClientRect();
    const sx = ev.clientX, sy = ev.clientY;
    const start = { x: sd.ix ?? 0, y: sd.iy ?? 0 };
    const cx = SEALS[sd.id].cx, cy = SEALS[sd.id].cy;
    emb.classList.add("dragging");
    const move = (e) => {
      sd.ix = Math.round(Math.min(40, Math.max(-40, start.x + (e.clientX - sx) / rect.width * 100)) * 10) / 10;
      sd.iy = Math.round(Math.min(40, Math.max(-40, start.y + (e.clientY - sy) / rect.height * 100)) * 10) / 10;
      emb.style.left = `${cx + sd.ix}%`;
      emb.style.top = `${cy + sd.iy}%`;
    };
    const up = () => {
      emb.classList.remove("dragging");
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  /** Siegel im Vorschau-Zettel neu zeichnen (Größe/Farbe des Symbols). */
  _redrawSeal() {
    const paper = this.paperEl;
    const old = paper?.querySelector(".sb-seal");
    if (!old) return;
    const tmp = document.createElement("div");
    tmp.innerHTML = sealHTML(this.draft.seal);
    const neu = tmp.firstElementChild;
    if (!neu) return;
    old.replaceWith(neu);
    this._bindSealDrag();
  }

  /* ---------------- Zierde & Unterschriften ---------------- */

  _selectDeco(id, { swap = true } = {}) {
    const kind = this.draft.deco.find(d => d.id === id)?.kind;
    // Linien/Ornamente/Ecken aus alten Zetteln haben keinen eigenen Reiter mehr (nur Unterschriften) → nicht auswählbar
    if (kind && kind !== "sign" && kind !== "ink") return;
    this.selDeco = id;
    for (const el of this.element.querySelectorAll(".sb-ed-note .sb-deco")) el.classList.toggle("selected", el.dataset.deco === id);
    if (kind && this.tab !== "sign") this.tab = "sign";
    if (swap) this._swapTab();
  }

  _deselectDeco() {
    if (!this.selDeco) return;
    this.selDeco = null;
    for (const el of this.element.querySelectorAll(".sb-ed-note .sb-deco.selected")) el.classList.remove("selected");
    this._swapTab();
  }

  /** Ein Element im Vorschau-Zettel ersetzen (nach Änderung von Stil, Farbe, Größe …). */
  _redrawDeco(d) {
    const paper = this.paperEl;
    const old = paper?.querySelector(`.sb-deco[data-deco="${CSS.escape(d.id)}"]`);
    if (!old) return;
    const tmp = document.createElement("div");
    tmp.innerHTML = decoHTML(d, { editable: true, selected: d.id === this.selDeco });
    const neu = tmp.firstElementChild;
    old.replaceWith(neu);
    this._bindDeco(neu);
  }

  _onDecoField(name, el) {
    const d = this.deco;
    if (!d) return;
    const v = el.type === "range" ? Number(el.value) : el.value;
    if (name === "text") { if (!String(v).trim()) return; d.text = String(v).slice(0, 60); }
    else if (name === "t") d.t = v / 10;
    else if (name === "color") d.color = this.lastInk = v;
    else d[name] = v;
    const n = normalizeDeco(d);
    if (!n) { // z. B. leerer Text: alten Wert behalten, damit die Unterschrift nicht beim Speichern verschwindet
      if (name === "text") d.text = this._lastText?.[d.id] ?? d.text;
      return;
    }
    if (name === "text") (this._lastText ??= {})[d.id] = d.text;
    Object.assign(d, n);
    this._redrawDeco(d);
  }

  _bindDecos() {
    // Klick ins Leere hebt die Auswahl auf (Bilder und Zierde)
    const canvas = this.element.querySelector(".sb-ed-canvas");
    canvas?.addEventListener("pointerdown", ev => {
      if (ev.target.closest(".sb-deco")) return;
      this._deselectDeco();
    });
    for (const el of this.paperEl?.querySelectorAll(".sb-deco") ?? []) this._bindDeco(el);
  }

  _bindDeco(el) {
    const paper = this.paperEl;
    el.addEventListener("pointerdown", ev => {
      if (ev.button !== 0 || !isDecoTab(this.tab)) return;
      const d = this.draft.deco.find(x => x.id === el.dataset.deco);
      // alte Zierde (Linie/Ornament/Ecken) bleibt erhalten, ist aber nicht mehr bearbeitbar
      if (!d || !DECO_TABS[this.tab].includes(d.kind)) return;
      ev.preventDefault();
      const wasSel = this.selDeco === d.id;
      if (!wasSel) this._selectDeco(d.id);
      const live = paper.querySelector(`.sb-deco[data-deco="${CSS.escape(d.id)}"]`) ?? el;
      const rect = paper.getBoundingClientRect();
      const resize = !!ev.target.closest(".sb-deco-handle");
      const sx = ev.clientX, sy = ev.clientY;
      const start = { x: d.x, y: d.y, w: d.w, h: d.h, sz: d.sz };
      const cx = rect.left + start.x / 100 * rect.width, cy = rect.top + start.y / 100 * rect.height;
      const startDist = Math.max(6, Math.hypot(sx - cx, sy - cy));
      const th = (d.rot || 0) * Math.PI / 180, cos = Math.cos(th), sin = Math.sin(th);
      live.classList.add(resize ? "resizing" : "dragging");
      const move = (e) => {
        if (resize) {
          const dx = e.clientX - cx, dy = e.clientY - cy;
          const lx = Math.abs(dx * cos + dy * sin), ly = Math.abs(-dx * sin + dy * cos);
          if (d.kind === "corners") {
            let w = 2 * lx / rect.width * 100, h = 2 * ly / rect.height * 100;
            if (e.shiftKey && start.w && start.h) { const k = Math.max(w / start.w, h / start.h); w = start.w * k; h = start.h * k; }
            d.w = Math.round(Math.min(130, Math.max(3, w)) * 10) / 10;
            d.h = Math.round(Math.min(130, Math.max(3, h)) * 10) / 10;
            live.style.width = `${d.w}%`;
            live.style.height = `${d.h}%`;
          } else if (d.kind === "line" || d.kind === "ornate") {
            d.w = Math.round(Math.min(130, Math.max(3, 2 * lx / rect.width * 100)) * 10) / 10;
            live.style.width = `${d.w}%`;
          } else if (d.kind === "ink") {
            d.w = Math.round(Math.min(120, Math.max(5, start.w * Math.hypot(dx, dy) / startDist)) * 10) / 10;
            live.style.width = `${d.w}%`;
          }
        } else {
          d.x = Math.round(Math.min(110, Math.max(-10, start.x + (e.clientX - sx) / rect.width * 100)) * 10) / 10;
          d.y = Math.round(Math.min(110, Math.max(-10, start.y + (e.clientY - sy) / rect.height * 100)) * 10) / 10;
          live.style.left = `${d.x}%`;
          live.style.top = `${d.y}%`;
        }
      };
      const up = () => {
        live.classList.remove("resizing", "dragging");
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        if (resize) this._swapTab(); // Schieberegler aktualisieren
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
    });
  }

  /** Zeichenfläche für die handgemalte Unterschrift. */
  _bindPad() {
    const cv = this.element.querySelector(".sb-pad");
    if (!cv) return;
    const r = cv.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    cv.width = Math.max(10, Math.round(r.width * dpr));
    cv.height = Math.max(10, Math.round(r.height * dpr));
    const ctx = cv.getContext("2d");
    const paint = () => {
      ctx.clearRect(0, 0, cv.width, cv.height);
      ctx.lineCap = ctx.lineJoin = "round";
      ctx.lineWidth = 2.6 * dpr;
      ctx.strokeStyle = this.lastInk ?? INK_COLORS[0];
      for (const st of this.pad) {
        ctx.beginPath();
        st.forEach(([x, y], i) => (i ? ctx.lineTo(x * dpr, y * dpr) : ctx.moveTo(x * dpr, y * dpr)));
        if (st.length === 1) ctx.lineTo(st[0][0] * dpr + 0.1, st[0][1] * dpr);
        ctx.stroke();
      }
    };
    this._paintPad = paint;
    paint();
    cv.addEventListener("pointerdown", ev => {
      if (ev.button !== 0) return;
      ev.preventDefault();
      cv.setPointerCapture?.(ev.pointerId);
      const box = cv.getBoundingClientRect();
      const pt = (e) => [e.clientX - box.left, e.clientY - box.top];
      const stroke = [pt(ev)];
      this.pad.push(stroke);
      const move = (e) => {
        const p = pt(e), l = stroke.at(-1);
        if (Math.hypot(p[0] - l[0], p[1] - l[1]) < 1.2) return;
        stroke.push(p);
        paint();
      };
      const up = () => {
        cv.removeEventListener("pointermove", move);
        cv.removeEventListener("pointerup", up);
        cv.removeEventListener("pointercancel", up);
        paint();
      };
      cv.addEventListener("pointermove", move);
      cv.addEventListener("pointerup", up);
      cv.addEventListener("pointercancel", up);
      paint();
    });
  }

  /** Gemalte Striche → SVG-Pfad in einem Raster von 100 Einheiten Breite. */
  _padPath() {
    const pts = this.pad.flat();
    if (!pts.length) return null;
    const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
    const minx = Math.min(...xs), miny = Math.min(...ys);
    const bh = Math.max(1, Math.max(...ys) - miny), bw = Math.max(1, Math.max(...xs) - minx, bh * 0.12);
    const f = (v) => Math.round(v * 10) / 10;
    let path = "";
    for (const st of this.pad) {
      // Punkte ausdünnen, damit der Pfad klein bleibt
      const keep = st.filter((p, i) => i === 0 || i === st.length - 1 || i % 2 === 0);
      keep.forEach((p, i) => { path += `${i ? "L" : "M"}${f((p[0] - minx) / bw * 100)} ${f((p[1] - miny) / bw * 100)} `; });
      if (keep.length === 1) path += `L${f((keep[0][0] - minx) / bw * 100 + 0.2)} ${f((keep[0][1] - miny) / bw * 100)} `;
    }
    return { path: path.trim(), ar: bw / bh };
  }

  /* ---------------- Bilder im Zettel ---------------- */

  _selectImage(id) {
    this.selImg = id;
    this.element.querySelector(".sb-ed-note")?.classList.toggle("img-mode", !!id);
    for (const el of this.element.querySelectorAll(".sb-ed-note .sb-img")) el.classList.toggle("selected", el.dataset.img === id);
    if (id) this.tab = "images";
    this._swapTab();
  }

  _deselectImage() {
    if (!this.selImg) return;
    this.selImg = null;
    this.element.querySelector(".sb-ed-note")?.classList.remove("img-mode");
    for (const el of this.element.querySelectorAll(".sb-ed-note .sb-img.selected")) el.classList.remove("selected");
    this._swapTab();
  }

  _bindImages() {
    const paper = this.paperEl;
    if (!paper) return;
    // Klick daneben hebt die Auswahl auf
    this.element.querySelector(".sb-ed-canvas")?.addEventListener("pointerdown", ev => {
      if (ev.target.closest(".sb-img")) return;
      this._deselectImage();
    });
    for (const el of paper.querySelectorAll(".sb-img")) {
      el.addEventListener("pointerdown", ev => {
        if (ev.button !== 0) return;
        ev.preventDefault();
        const img = this.draft.images.find(i => i.id === el.dataset.img);
        if (!img) return;
        if (this.selImg !== img.id) this._selectImage(img.id);
        const rect = paper.getBoundingClientRect();
        const resize = !!ev.target.closest(".sb-img-handle");
        const sx = ev.clientX, sy = ev.clientY;
        const start = { x: img.x, y: img.y, w: img.w };
        const cx = rect.left + start.x / 100 * rect.width, cy = rect.top + start.y / 100 * rect.height;
        const startDist = Math.max(6, Math.hypot(sx - cx, sy - cy));
        el.classList.add(resize ? "resizing" : "dragging");
        const move = (e) => {
          if (resize) {
            // Größe proportional zum Abstand vom Mittelpunkt; die Mitte bleibt stehen
            img.w = Math.round(Math.min(160, Math.max(5, start.w * Math.hypot(e.clientX - cx, e.clientY - cy) / startDist)) * 10) / 10;
            el.style.width = `${img.w}%`;
            el.style.margin = `${-(img.w / img.ar / 2)}% 0 0 ${-(img.w / 2)}%`;
          } else {
            img.x = Math.round(Math.min(110, Math.max(-10, start.x + (e.clientX - sx) / rect.width * 100)) * 10) / 10;
            img.y = Math.round(Math.min(110, Math.max(-10, start.y + (e.clientY - sy) / rect.height * 100)) * 10) / 10;
            el.style.left = `${img.x}%`;
            el.style.top = `${img.y}%`;
          }
        };
        const up = () => {
          el.classList.remove("resizing", "dragging");
          window.removeEventListener("pointermove", move);
          window.removeEventListener("pointerup", up);
        };
        window.addEventListener("pointermove", move);
        window.addEventListener("pointerup", up);
      });
    }
  }

  /* ---------------- Aktionen ---------------- */

  static _onTab(event, target) {
    this.tab = target.dataset.tab;
    // Auswahl von Zierde/Unterschrift gilt nur im passenden Reiter
    if (this.selDeco && !(this.deco && DECO_TABS[this.tab]?.includes(this.deco.kind))) {
      this.selDeco = null;
      for (const el of this.element.querySelectorAll(".sb-ed-note .sb-deco.selected")) el.classList.remove("selected");
    }
    this._swapTab();
  }

  static _onPickTemplate(event, target) {
    this._syncBody();
    this.draft.template = target.dataset.id;
    this.draft.paper = null;
    this.render();
  }

  static _onUploadPaper() {
    this._syncBody();
    filePicker(async path => {
      const { w, h } = await imageSize(path);
      this.draft.template = CUSTOM;
      this.draft.paper = { img: path, w, h };
      this.render();
    });
  }

  static _onTextColor(event, target) {
    const part = target.dataset.part === "body" ? "body" : "title";
    this.draft[`${part}Color`] = target.dataset.color || "";
    this._markTextColor(part);
    this._refreshPreview();
  }

  static _onTitleAlign(event, target) {
    this.draft.titleAlign = target.dataset.align === "left" ? "left" : "center";
    for (const b of this.element.querySelectorAll('[data-action="titleAlign"]')) b.classList.toggle("on", b === target);
    this._refreshPreview();
  }

  static _onLoadJson() {
    this._syncBody();
    this.element.querySelector(".sb-json-file")?.click();
  }

  static _onPickSeal(event, target) {
    this._syncBody();
    const id = target.dataset.id;
    if (!id) this.draft.seal = null;
    else {
      const prev = this.draft.seal;
      const band = SEALS[id].band;
      this.draft.seal = {
        id,
        x: prev?.x ?? 76,
        y: prev?.y ?? (band ? 66 : 84),
        size: prev && SEALS[prev.id]?.band === band ? prev.size : (band ? 16 : 20),
        icon: prev ? prev.icon : "crown",
        img: prev?.img ?? null,
        ix: prev?.ix ?? 0, iy: prev?.iy ?? 0, isz: prev?.isz ?? 100, ic: prev?.ic ?? null
      };
    }
    this.render();
  }

  static _onPickIcon(event, target) {
    if (!this.draft.seal) return;
    this.draft.seal.icon = target.dataset.id || null;
    this.draft.seal.img = null;
    this.render();
  }

  static _onUploadIcon() {
    filePicker(path => {
      if (!this.draft.seal) return;
      this.draft.seal.img = path;
      this.draft.seal.icon = null;
      this.render();
    });
  }

  static _onAddImage() {
    this._syncBody();
    filePicker(async path => {
      const { w, h } = await imageSize(path);
      const img = newImage(path, w / h);
      if (!img) return ui.notifications.warn(t("editor.img.bad"));
      // nicht genau übereinander stapeln
      const n = this.draft.images.length;
      img.x += (n % 3) * 6;
      img.y += (n % 3) * 6;
      if (w / h < 0.8) img.w = 45;
      this.draft.images.push(img);
      this.selImg = img.id;
      this.tab = "images";
      this.render();
    });
  }

  static _onSelectImage(event, target) {
    this._selectImage(target.dataset.id);
  }

  static _onImageLook(event, target) {
    const img = this.image;
    const L = IMAGE_LOOKS[target.dataset.id];
    if (!img || !L) return;
    img.blend = L.blend;
    img.f = { ...L.f };
    this._applyImageStyle(img);
    this._swapTab();
  }

  static _onImageBack(event, target) {
    const img = this.image;
    if (!img) return;
    img.back = !!target.checked;
    this.render();
  }

  static _onReplaceImage() {
    const img = this.image;
    if (!img) return;
    filePicker(async path => {
      const { w, h } = await imageSize(path);
      const n = normalizeImage({ ...img, src: path, ar: w / h });
      if (n) Object.assign(img, n);
      this.render();
    });
  }

  static _onRemoveImage() {
    if (!this.selImg) return;
    this.draft.images = this.draft.images.filter(i => i.id !== this.selImg);
    this.selImg = null;
    this.render();
  }

  static _onResetRot() {
    this.draft.rot = 0;
    this._swapTab();
  }

  static _onPickEmbColor(event, target) {
    if (!this.draft.seal) return;
    this.draft.seal.ic = target.dataset.color || null;
    this._redrawSeal();
    this._swapTab();
  }

  static _onResetEmb() {
    const s = this.draft.seal;
    if (!s) return;
    s.ix = 0; s.iy = 0; s.isz = 100;
    this._redrawSeal();
    this._swapTab();
  }

  static _onAddDeco(event, target) {
    this._syncBody();
    const kind = target.dataset.kind;
    const n = this.draft.deco.length;
    const d = newDeco(kind, { x: 50, y: 50 + (n % 4) * 5, color: this.lastInk ?? INK_COLORS[0] });
    if (!d) return;
    this.draft.deco.push(d);
    this.tab = "deco";
    this.selDeco = d.id;
    this.render();
  }

  static _onSelectDeco(event, target) {
    this._selectDeco(target.dataset.id);
  }

  static _onDecoStyle(event, target) {
    const d = this.deco;
    if (!d) return;
    d.style = target.dataset.style;
    this._redrawDeco(d);
    this._swapTab();
  }

  static _onDecoColor(event, target) {
    const d = this.deco;
    if (!d) return;
    d.color = this.lastInk = target.dataset.color;
    this._redrawDeco(d);
    this._swapTab();
  }

  static _onRemoveDeco() {
    if (!this.selDeco) return;
    this.draft.deco = this.draft.deco.filter(x => x.id !== this.selDeco);
    this.selDeco = null;
    this.render();
  }

  static _onAddSign() {
    this._syncBody();
    const text = (this.element.querySelector("#sb-sign-text")?.value ?? this.signText ?? "").trim();
    if (!text) { this.element.querySelector("#sb-sign-text")?.focus(); return; }
    const n = this.draft.deco.filter(x => x.kind === "sign").length;
    const d = newDeco("sign", { text, font: this.lastSignFont ?? "vibes", sz: Math.max(4, Math.min(9, Math.round(110 / text.length))), x: 68, y: 86 - (n % 3) * 6, rot: -4, color: this.lastInk ?? INK_COLORS[0], opacity: 92 });
    if (!d) return;
    this.draft.deco.push(d);
    this.signText = "";
    this.tab = "sign";
    this.selDeco = d.id;
    this.render();
  }

  static _onSignFont(event, target) {
    const d = this.deco;
    if (!d || d.kind !== "sign") return;
    d.font = this.lastSignFont = target.dataset.font;
    this._redrawDeco(d);
    this._swapTab();
  }

  static _onPadClear() {
    this.pad = [];
    this._paintPad?.();
  }

  static _onPadTake() {
    const res = this._padPath();
    if (!res) return;
    const n = this.draft.deco.filter(x => x.kind === "ink").length;
    const d = newDeco("ink", { path: res.path, ar: res.ar, w: Math.min(60, Math.max(18, res.ar * 12)), x: 68, y: 84 - (n % 3) * 7, rot: -3, t: 0.45, color: this.lastInk ?? INK_COLORS[0], opacity: 92 });
    if (!d) return ui.notifications.warn(t("editor.sign.tooLong"));
    this.draft.deco.push(d);
    this.pad = [];
    this.tab = "sign";
    this.selDeco = d.id;
    this.render();
  }

  static _onCancel() {
    this.close();
  }

  static async _onSave() {
    if (this._saving) return;
    this._saving = true;
    this._syncBody();
    const title = this.element.querySelector(".sb-title-input");
    if (title) this.draft.title = title.value;
    const name = this.element.querySelector(".sb-name-input");
    if (name) this.draft.name = name.value;
    const note = normalizeNote({ ...this.draft, body: sanitize(this.draft.body) });
    await upsertNote(this.boardId, note);
    this.close();
  }
}
