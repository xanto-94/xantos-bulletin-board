/** Darstellung eines Zettels (am Brett, groß und im Editor) und Bereinigung des Textes. */
import { SEALS, FONTS, SIGN_FONTS, SIGN_FONT_SCALE, DECO_GLYPHS, paperOf, TITLE_DEFAULT, BODY_DEFAULT } from "./skins.js";
import { icon } from "./icons.js";
import { lang } from "./i18n.js";

export const esc = (v) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

/**
 * HTML eines Zettels (am Brett, groß und als Vorschau im Editor).
 * Text = Überschrift (title) + Fließtext (body). Die Schrift skaliert über Container-Einheiten mit der Zettelbreite,
 * daher sieht der Zettel klein und groß gleich aus.
 */
export function noteHTML(note, { selected = null, editable = false, selectedDeco = null } = {}) {
  const tpl = paperOf(note);
  const [t, r, b, l] = tpl.inset;
  const imgs = note.images ?? [];
  const layer = (back) => imgs.filter(i => !!i.back === back).map(i => imageHTML(i, { editable, selected: selected === i.id })).join("");
  return `
    <div class="sb-paper ${tpl.custom ? "custom" : ""}" style="aspect-ratio:${tpl.w}/${tpl.h}">
      <img class="sb-paper-img" src="${esc(tpl.img)}" alt="" draggable="false">
      ${layer(true)}
      <div class="sb-text-box" style="top:${t}%;right:${r}%;bottom:${b}%;left:${l}%">${noteTextHTML(note)}</div>
      ${decoLayer(note, { editable, selected: selectedDeco })}
      ${layer(false)}
      ${sealHTML(note.seal)}
    </div>`;
}

/** Nur der Textteil – der Editor tauscht ihn beim Tippen live aus. */
export function noteTextHTML(note) {
  const tf = FONTS[note.titleFont] ?? FONTS[TITLE_DEFAULT.font];
  const bf = FONTS[note.bodyFont] ?? FONTS[BODY_DEFAULT.font];
  const ts = (Number(note.titleSize) || TITLE_DEFAULT.size) / 12;
  const bs = (Number(note.bodySize) || BODY_DEFAULT.size) / 12;
  const align = note.titleAlign === "left" ? "left" : "center";
  const title = String(note.title ?? "").trim();
  const hex = (v) => (typeof v === "string" && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v.trim()) ? v.trim() : "");
  const tc = hex(note.titleColor), bc = hex(note.bodyColor);
  return `
    <div class="sb-text" lang="${lang()}" style="--sb-ts:${ts};--sb-bs:${bs};--sb-head:${tf};--sb-bodyf:${bf}${tc ? `;--sb-tc:${tc}` : ""}${bc ? `;--sb-bc:${bc};--sb-bb:${bc}` : ""}">
      ${title ? `<h1 class="sb-title" data-part="title" style="text-align:${align}">${esc(title)}</h1>` : ""}
      <div class="sb-body" data-part="body">${sanitize(note.body ?? "")}</div>
    </div>`;
}

/**
 * Alte Zettel (bis 0.3) hatten Überschrift und Text gemeinsam in „html“.
 * Die erste Überschrift wird zur Headline, der Rest zum Fließtext.
 */
export function splitLegacyHTML(html, headFont) {
  const doc = new DOMParser().parseFromString(`<body>${sanitize(html)}</body>`, "text/html");
  const first = doc.body.firstElementChild;
  const out = { title: "", titleFont: headFont || TITLE_DEFAULT.font, titleSize: TITLE_DEFAULT.size, titleAlign: "center", bodyFont: BODY_DEFAULT.font, bodySize: BODY_DEFAULT.size };
  if (first && /^H[1-3]$/.test(first.tagName)) {
    out.title = first.textContent.trim();
    const base = first.tagName === "H1" ? 25 : first.tagName === "H2" ? 18 : 14;
    const f = first.classList.contains("sb-l") ? 1.25 : first.classList.contains("sb-s") ? 0.77 : 1;
    out.titleSize = nearest([14, 16, 18, 20, 24, 28, 32, 36, 42, 48, 56, 64], base * f);
    out.titleAlign = first.classList.contains("sb-center") ? "center" : "left";
    first.remove();
  }
  out.body = doc.body.innerHTML.trim();
  return out;
}

const nearest = (list, v) => list.reduce((a, b) => (Math.abs(b - v) < Math.abs(a - v) ? b : a));

/** Text aus JSON übernehmen. Erlaubt u. a. { title, text | body, titleFont, bodyFont, titleSize, bodySize, align }. */
export function textFromJSON(obj) {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return null;
  const pick = (...keys) => keys.map(k => obj[k]).find(v => v !== undefined && v !== null);
  const out = {};
  const title = pick("title", "heading", "headline", "titel", "ueberschrift", "überschrift", "name");
  if (title !== undefined) out.title = String(title);
  let body = pick("text", "body", "content", "description", "beschreibung", "fliesstext", "fließtext");
  if (Array.isArray(body)) body = body.map(String).join("\n\n");
  if (body !== undefined) out.body = plainToHTML(String(body));
  const align = pick("align", "alignment", "ausrichtung");
  const center = align === "center" || align === "zentriert";
  if (body !== undefined && center) out.body = out.body.replace(/<p>/g, '<p class="sb-center">');
  if (align !== undefined) out.titleAlign = center ? "center" : "left";
  for (const [k, keys] of [["titleFont", ["titleFont", "headingFont"]], ["bodyFont", ["bodyFont", "textFont", "font"]]]) {
    const v = pick(...keys);
    if (v !== undefined && FONTS[v]) out[k] = v;
  }
  for (const [k, keys] of [["titleSize", ["titleSize", "headingSize"]], ["bodySize", ["bodySize", "textSize", "size"]]]) {
    const v = Number(pick(...keys));
    if (Number.isFinite(v) && v > 0) out[k] = v;
  }
  return Object.keys(out).length ? out : null;
}

/** Klartext → Absätze (Leerzeile = neuer Absatz, einfacher Umbruch = Zeilenumbruch). **fett** und *kursiv* werden übernommen. */
export function plainToHTML(text) {
  return String(text).replace(/\r/g, "").split(/\n{2,}/).map(par => {
    const p = par.trim();
    if (!p) return "";
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(p)) return "<hr>";
    const html = esc(p).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/\*(.+?)\*/g, "<i>$1</i>").replace(/\n/g, "<br>");
    return `<p>${html}</p>`;
  }).join("");
}

/** CSS-Filter eines Bildes im Zettel */
export function imageFilter(f = {}) {
  return `sepia(${f.sepia ?? 0}%) grayscale(${f.gray ?? 0}%) contrast(${f.contrast ?? 100}%) brightness(${f.bright ?? 100}%)`;
}

/**
 * Frei liegendes Bild im Zettel. Der Rahmen-Div bekommt bewusst kein transform/filter/z-index,
 * damit er keinen eigenen Stapelkontext bildet – nur so wird der Ebenenmodus des Bildes mit dem Papier verrechnet.
 * Zentriert wird über negative Ränder (Prozent-Ränder beziehen sich immer auf die Zettelbreite).
 */
export function imageHTML(i, { editable = false, selected = false } = {}) {
  const ml = -(i.w / 2), mt = -(i.w / i.ar / 2);
  return `
    <div class="sb-img ${i.back ? "back" : ""} ${selected ? "selected" : ""}" data-img="${esc(i.id)}"
      style="left:${i.x}%;top:${i.y}%;width:${i.w}%;aspect-ratio:${i.ar};margin:${mt}% 0 0 ${ml}%">
      <img src="${esc(i.src)}" alt="" draggable="false" style="mix-blend-mode:${i.blend};opacity:${(i.f?.opacity ?? 100) / 100};filter:${imageFilter(i.f)}">
      ${editable ? `<span class="sb-img-handle" aria-hidden="true"></span>` : ""}
    </div>`;
}

const DECO_RANK = { corners: 0, line: 1, ornate: 1, ink: 2, sign: 3 };

/** Zierelemente und Unterschriften: Ecken liegen unten, Unterschriften oben. */
export function decoLayer(note, { editable = false, selected = null } = {}) {
  const list = [...(note.deco ?? [])].sort((a, b) => (DECO_RANK[a.kind] ?? 1) - (DECO_RANK[b.kind] ?? 1));
  return list.map(d => decoHTML(d, { editable, selected: selected === d.id })).join("");
}

/**
 * Ein Zierelement. Maße in % des Zettels (Breite/Höhe getrennt), Linienstärke in cqw (= Zettelbreite),
 * dadurch wächst nichts verzerrt: Rahmen und Linien sind CSS-Rahmen, keine gestreckten Bilder.
 */
export function decoHTML(d, { editable = false, selected = false } = {}) {
  const cls = `sb-deco ${d.kind} ${selected ? "selected" : ""}`;
  const pos = `left:${d.x}%;top:${d.y}%;transform:translate(-50%,-50%) rotate(${d.rot}deg);opacity:${d.opacity / 100};--c:${d.color};--t:${d.t}`;
  const handle = editable ? `<span class="sb-deco-handle" aria-hidden="true"></span>` : "";
  const attrs = `class="${cls}" data-deco="${esc(d.id)}"`;
  if (d.kind === "sign") {
    const sz = d.sz * (SIGN_FONT_SCALE[d.font] ?? 1);
    return `<div ${attrs} style="${pos};font-family:${SIGN_FONTS[d.font] ?? SIGN_FONTS.vibes};font-size:calc(${sz} * 1cqw)">${esc(d.text)}</div>`;
  }
  if (d.kind === "ink") {
    return `<div ${attrs} style="${pos};width:${d.w}%;aspect-ratio:${d.ar}">
      <svg viewBox="0 0 100 ${100 / d.ar}" preserveAspectRatio="xMidYMid meet" aria-hidden="true"><path d="${esc(d.path)}" fill="none" stroke="var(--c)" stroke-linecap="round" stroke-linejoin="round" style="stroke-width:max(1px, calc(var(--t) * 1cqw));vector-effect:non-scaling-stroke"/></svg>${handle}</div>`;
  }
  if (d.kind === "line") {
    const th = d.style === "double" ? "calc(var(--t) * 3cqw)" : "calc(var(--t) * 1cqw)";
    return `<div ${attrs} style="${pos};width:${d.w}%"><i class="sb-d-ln" style="border-top:max(1px, ${th}) ${d.style} var(--c)"></i>${handle}</div>`;
  }
  if (d.kind === "ornate") {
    return `<div ${attrs} style="${pos};width:${d.w}%"><i class="sb-d-ln"></i><b style="font-size:calc(var(--t) * 7cqw)">${DECO_GLYPHS[d.style] ?? "◆"}</b><i class="sb-d-ln"></i>${handle}</div>`;
  }
  if (d.kind === "corners") {
    const L = `calc(${d.r} * 1cqw)`, T = `max(1px, calc(var(--t) * 1cqw))`;
    const g = (pos2, sz) => `linear-gradient(var(--c), var(--c)) ${pos2} / ${sz} no-repeat`;
    const bg = [g("0 0", `${L} ${T}`), g("0 0", `${T} ${L}`), g("100% 0", `${L} ${T}`), g("100% 0", `${T} ${L}`),
      g("0 100%", `${L} ${T}`), g("0 100%", `${T} ${L}`), g("100% 100%", `${L} ${T}`), g("100% 100%", `${T} ${L}`)].join(",");
    return `<div ${attrs} style="${pos};width:${d.w}%;height:${d.h}%"><i class="sb-d-fill" style="background:${bg}"></i>${handle}</div>`;
  }
  return "";
}

export function sealHTML(seal) {
  if (!seal || !SEALS[seal.id]) return "";
  const s = SEALS[seal.id];
  let emb = "";
  if (seal.img) emb = `<img class="sb-emb-img" src="${esc(seal.img)}" alt="" draggable="false">`;
  else if (seal.icon) emb = icon(seal.icon, { cls: `sb-emb-ico${seal.ic ? " tinted" : ""}` });
  const ix = Number(seal.ix) || 0, iy = Number(seal.iy) || 0, isz = (Number(seal.isz) || 100) / 100;
  return `
    <div class="sb-seal ${s.band ? "band" : ""}" style="left:${seal.x}%;top:${seal.y}%;width:${seal.size}%;aspect-ratio:${s.aspect};transform:translate(-${s.cx}%,-${s.cy}%)">
      <img class="sb-seal-img" src="${s.img}" alt="" draggable="false">
      ${emb ? `<div class="sb-emb" style="left:${s.cx + ix}%;top:${s.cy + iy}%;width:${s.r * 2 * isz}%${seal.ic && !seal.img ? `;color:${esc(seal.ic)}` : ""}">${emb}</div>` : ""}
    </div>`;
}

/**
 * Verkleinert die Schrift, bis der Text in seinen Bereich passt (bis 70 %).
 * Passt er dann noch nicht: scrollen (große Ansicht) bzw. abschneiden (am Brett). Gibt true zurück, wenn er übersteht.
 */
export function fitText(paper, { scroll = false } = {}) {
  const box = paper?.querySelector(".sb-text-box");
  const text = paper?.querySelector(".sb-text");
  if (!box || !text || !box.clientHeight) return false;
  let fit = 1;
  text.style.setProperty("--sb-fit", fit);
  box.classList.remove("scroll", "clip");
  const tooBig = () => text.scrollHeight > box.clientHeight + 1 || text.scrollWidth > box.clientWidth + 1;
  while (tooBig() && fit > 0.6) {
    fit = Math.round((fit - 0.05) * 100) / 100;
    text.style.setProperty("--sb-fit", fit);
  }
  if (text.scrollWidth > box.clientWidth + 1) text.classList.add("sb-wrap-hard");
  else text.classList.remove("sb-wrap-hard");
  const over = text.scrollHeight > box.clientHeight + 1;
  if (over) box.classList.add(scroll ? "scroll" : "clip");
  return over;
}

/* ---------------- Bereinigung ---------------- */

const ALLOWED = new Set(["P", "H1", "H2", "H3", "B", "STRONG", "I", "EM", "U", "HR", "BR", "IMG", "DIV", "SPAN"]);
const DROP = new Set(["SCRIPT", "STYLE", "IFRAME", "OBJECT", "EMBED", "LINK", "META", "SVG", "MATH", "FORM", "INPUT", "BUTTON", "TEXTAREA", "SELECT", "TEMPLATE", "NOSCRIPT", "VIDEO", "AUDIO", "CANVAS"]);
const CLASS_OK = /^sb-(left|center|right|s|l)$/;
const SRC_OK = /^(https?:\/\/[^\s"'<>]+|[\w\-./%~ ()]+)$/i;

/** Lässt nur einfache Textformatierung, Trennlinien und Bilder durch. */
export function sanitize(html) {
  const doc = new DOMParser().parseFromString(`<body>${String(html ?? "")}</body>`, "text/html");
  const walk = (node) => {
    for (const child of [...node.childNodes]) {
      if (child.nodeType === Node.COMMENT_NODE) { child.remove(); continue; }
      if (child.nodeType !== Node.ELEMENT_NODE) continue;
      const tag = child.tagName.toUpperCase();
      if (DROP.has(tag)) { child.remove(); continue; }
      walk(child);
      if (!ALLOWED.has(tag)) { child.replaceWith(...child.childNodes); continue; }
      const cls = [...child.classList].filter(c => CLASS_OK.test(c));
      const src = tag === "IMG" ? child.getAttribute("src") : null;
      for (const a of [...child.attributes]) child.removeAttribute(a.name);
      if (cls.length) child.setAttribute("class", cls.join(" "));
      if (tag === "IMG") {
        if (src && SRC_OK.test(src) && !/^\s*javascript:/i.test(src)) child.setAttribute("src", src);
        else child.remove();
      }
    }
  };
  walk(doc.body);
  return doc.body.innerHTML.trim();
}
