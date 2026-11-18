// Consistency checks for data/words.js and data/translations.js.
// Run with: node scripts/validate-data.mjs
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const sandbox = {};
vm.createContext(sandbox);
for (const f of ["../data/words.js", "../data/translations.js", "../js/model.js"]) {
  vm.runInContext(readFileSync(fileURLToPath(new URL(f, import.meta.url)), "utf8"), sandbox);
}
const { WORDS, TRANSLATIONS, CATEGORIES } = sandbox.LANGUAGE_MAP_DATA;
const model = sandbox.LANGUAGE_MAP_MODEL;

const HANGUL = /^[가-힣]+$/;
const KANA = /^[぀-ゟ゠-ヿ]+$/;
const KINDS = new Set(["translation", "loan", "char"]);
const ORIGINS = new Set(["native", "sino", "loan"]);
const errors = [];

// Same-character pairs.
const seen = new Set();
for (const e of WORDS) {
  const err = (m) => errors.push(`words.js ${e.kanji} (${e.ko}): ${m}`);
  const n = [...e.kanji].length;
  if ([...e.hanja].length !== n) err(`hanja "${e.hanja}" and kanji "${e.kanji}" differ in length`);
  if (!HANGUL.test(e.ko)) err(`Korean "${e.ko}" is not pure Hangul`);
  else if ([...e.ko].length !== n) err(`Korean has ${[...e.ko].length} syllables for ${n} characters`);
  if (e.jaParts.length !== n) err(`Japanese has ${e.jaParts.length} reading parts for ${n} characters`);
  for (const p of e.jaParts) if (!KANA.test(p)) err(`Japanese part "${p}" is not kana`);
  if (!e.koRom || !e.jaRom) err("missing romanization");
  if (!CATEGORIES[e.category]) err(`unknown category "${e.category}"`);
  if (!e.en && !e.falseFriend) err("needs an English meaning or a falseFriend entry");
  if (e.falseFriend && (!e.falseFriend.ko || !e.falseFriend.ja)) err("falseFriend needs ko and ja meanings");
  if (seen.has(e.kanji)) err("duplicate entry");
  seen.add(e.kanji);
}
const variant = new Map();
for (const e of WORDS) {
  [...e.kanji].forEach((k, i) => {
    const h = [...e.hanja][i];
    if (variant.has(k) && variant.get(k) !== h) errors.push(`kanji ${k} maps to both ${variant.get(k)} and ${h}`);
    variant.set(k, h);
  });
}

// General translations.
const pairs = new Set();
for (const t of TRANSLATIONS) {
  const err = (m) => errors.push(`translations.js ${t.ko} → ${t.ja}: ${m}`);
  if (!HANGUL.test(t.ko)) err(`Korean "${t.ko}" is not pure Hangul`);
  if (!KANA.test(t.jaKana)) err(`Japanese reading "${t.jaKana}" is not kana`);
  if (!t.koRom || !t.jaRom) err("missing romanization");
  if (!t.en) err("missing English gloss");
  if (!CATEGORIES[t.category]) err(`unknown category "${t.category}"`);
  if (t.kind && !KINDS.has(t.kind)) err(`unknown kind "${t.kind}"`);
  if (t.kind === "char" && (!t.hanja || ![...t.ja].includes(t.hanja))) err(`kind "char" needs a hanja found in "${t.ja}"`);
  if (t.hanja && [...t.hanja].length !== [...t.ko].length) err(`hanja "${t.hanja}" does not match the syllables of ${t.ko}`);
  for (const o of [t.koOrigin, t.jaOrigin]) if (o && !ORIGINS.has(o)) err(`unknown origin "${o}"`);
  const key = `${t.ko}#${t.sense || ""}→${t.ja}`;
  if (pairs.has(key)) err("duplicate link");
  pairs.add(key);
}

// One written Japanese word should always have the same reading.
for (const w of model.jaWords.values()) {
  for (const t of TRANSLATIONS.filter((t) => t.ja === w.text)) {
    if (t.jaKana !== w.kana) errors.push(`${w.text} is read both ${w.kana} and ${t.jaKana}`);
  }
}
// Korean homonyms should all carry a sense number.
const byText = new Map();
for (const w of model.koWords.values()) byText.set(w.text, [...(byText.get(w.text) || []), w]);
for (const [text, ws] of byText) {
  if (ws.length > 1 && ws.some((w) => !w.sense)) errors.push(`${text} has homonyms, so every entry needs a sense number`);
}

if (errors.length) {
  console.error(errors.join("\n"));
  console.error(`\n${errors.length} problem(s) found.`);
  process.exit(1);
}
const types = {};
for (const c of model.comps) types[c.type] = (types[c.type] || 0) + 1;
console.log(`OK: ${model.koWords.size} Korean words, ${model.jaWords.size} Japanese words, ${model.links.length} links, ${model.chars.size} characters.`);
console.log(`Mappings: ${Object.entries(types).map(([k, v]) => `${k} ×${v}`).join(", ")}`);
