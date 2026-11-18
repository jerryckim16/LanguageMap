// Consistency checks for data/words.js. Run with: node scripts/validate-data.mjs
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const file = fileURLToPath(new URL("../data/words.js", import.meta.url));
const sandbox = {};
vm.runInNewContext(readFileSync(file, "utf8"), sandbox);
const { WORDS, CATEGORIES } = sandbox.LANGUAGE_MAP_DATA;

const HANGUL = /^[가-힣]+$/;
const KANA = /^[぀-ゟ゠-ヿ]+$/;
const errors = [];
const seen = new Set();

for (const e of WORDS) {
  const id = `${e.kanji} (${e.ko})`;
  const err = (m) => errors.push(`${id}: ${m}`);
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

// A kanji should always map to the same hanja.
const variant = new Map();
for (const e of WORDS) {
  [...e.kanji].forEach((k, i) => {
    const h = [...e.hanja][i];
    if (variant.has(k) && variant.get(k) !== h)
      errors.push(`kanji ${k} maps to both ${variant.get(k)} and ${h}`);
    variant.set(k, h);
  });
}

if (errors.length) {
  console.error(errors.join("\n"));
  console.error(`\n${errors.length} problem(s) found.`);
  process.exit(1);
}
const shared = [...variant.keys()].filter(
  (k) => WORDS.filter((e) => e.kanji.includes(k)).length > 1
).length;
console.log(`OK: ${WORDS.length} words, ${variant.size} characters (${shared} shared by 2+ words).`);
