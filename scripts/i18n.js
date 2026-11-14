import STRINGS from "./lang.js";

const MODULE_ID = "xantos-bulletin-board";
export const LANGS = { de: "Deutsch", en: "English" };

export function defaultLang() {
  return String(globalThis.game?.i18n?.lang ?? "en").toLowerCase().startsWith("de") ? "de" : "en";
}

export function lang() {
  try {
    const v = game.settings.get(MODULE_ID, "language");
    if (LANGS[v]) return v;
  } catch { /* noch nicht registriert */ }
  return defaultLang();
}

/** Text zum Schlüssel; {name} wird durch vars.name ersetzt. */
export function t(key, vars) {
  let s = STRINGS[lang()]?.[key] ?? STRINGS.de[key] ?? STRINGS.en[key];
  if (s === undefined) {
    console.warn(`${MODULE_ID} | missing translation: ${key}`);
    s = key;
  }
  if (vars) s = String(s).replace(/\{(\w+)\}/g, (m, k) => (vars[k] ?? m));
  return s;
}
