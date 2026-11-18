/*
 * Builds the word graph from data/words.js and data/translations.js.
 * No DOM access, so it can also run under Node (see scripts/validate-data.mjs).
 *
 *   koWords / jaWords: Map<key, word>   one node per distinct word
 *   links:            arrows Korean word → Japanese word
 *   comps:            translation components (connected groups, false friends excluded),
 *                     used to tell one-to-one mappings from splits and merges
 *   bands:            connected groups including false friends (used for layout)
 *   chars:            Map<kanji, char>   characters shared by Sino words
 */
(function () {
  const root = typeof window !== "undefined" ? window : globalThis;
  const { WORDS, CATEGORIES, TRANSLATIONS = [], NO_EQUIVALENT = [] } = root.LANGUAGE_MAP_DATA;

  const KINDS = {
    cognate:     { label: "Same characters", color: "#3b7dd8",
                   desc: "The same Sino word in both languages, written with the same characters." },
    char:        { label: "Same character, other reading", color: "#9061c2",
                   desc: "Written with the same character, but Japanese reads it with a native word." },
    translation: { label: "Different words", color: "#3e9a5b",
                   desc: "Unrelated words with the same meaning, such as native words or Sino words with different characters." },
    loan:        { label: "Loanword", color: "#e0861b",
                   desc: "A word borrowed from the other language or from a third language." },
    false:       { label: "False friend", color: "#d1495b",
                   desc: "Looks the same but means something different. Not a translation." },
    approx:      { label: "Closest match", color: "#8a8f98",
                   desc: "No exact equivalent; this is the nearest word, with a different nuance." },
    none:        { label: "No equivalent", color: "#b0b4ba",
                   desc: "The other language has no word for this; it has to be explained with a phrase." },
  };
  // Links that are not real translations, so they don't count toward one-to-one / split / merge.
  const NOT_TRANSLATION = new Set(["false", "approx", "none"]);

  const ORIGINS = {
    ko: { native: "Native Korean · 고유어", sino: "Sino-Korean · 한자어", loan: "Loanword · 외래어" },
    ja: { native: "Native Japanese · 和語", sino: "Sino-Japanese · 漢語", loan: "Loanword · 外来語" },
  };

  const SUP = "⁰¹²³⁴⁵⁶⁷⁸⁹";
  const sup = (n) => String(n).split("").map((d) => SUP[d]).join("");
  const isKatakana = (s) => /^[゠-ヿ]+$/.test(s);

  const koWords = new Map();
  const jaWords = new Map();
  const links = [];
  const chars = new Map();

  function getKo(text, rom, { sense, hanja, origin }) {
    const key = sense ? `${text}#${sense}` : text;
    let w = koWords.get(key);
    if (!w) {
      w = { lang: "ko", key, text, rom, sense, hanja, origin, label: text + (sense ? sup(sense) : ""), links: [] };
      koWords.set(key, w);
    } else {
      if (!w.hanja && hanja) w.hanja = hanja;
      if (origin === "sino" && w.origin !== "sino") w.origin = "sino";
    }
    return w;
  }

  function getJa(text, kana, rom, origin) {
    let w = jaWords.get(text);
    if (!w) {
      w = { lang: "ja", key: text, text, kana, rom, origin, label: text, links: [] };
      jaWords.set(text, w);
    }
    return w;
  }

  function getChar(k, hanja) {
    if (!chars.has(k)) chars.set(k, { key: k, hanja: hanja || k, ko: new Map(), ja: new Map(), entries: [], alone: [] });
    return chars.get(k);
  }

  function addLink(l) {
    l.id = links.length;
    links.push(l);
    l.ko.links.push(l);
    l.ja.links.push(l);
    return l;
  }

  // Same-character (cognate) pairs.
  for (const e of WORDS) {
    e.chars = [...e.kanji];
    e.hanjaChars = [...e.hanja];
    e.koChars = [...e.ko];
    const ko = getKo(e.ko, e.koRom, { origin: "sino", hanja: e.hanja });
    const ja = getJa(e.kanji, e.ja, e.jaRom, "sino");
    e.link = addLink({
      ko, ja, kind: e.falseFriend ? "false" : "cognate", en: e.en, category: e.category,
      note: e.note, falseFriend: e.falseFriend, entry: e,
    });
    e.chars.forEach((k, i) => {
      const c = getChar(k, e.hanjaChars[i]);
      c.ko.set(e.koChars[i], (c.ko.get(e.koChars[i]) || 0) + 1);
      c.ja.set(e.jaParts[i], (c.ja.get(e.jaParts[i]) || 0) + 1);
      if (!c.entries.includes(e)) c.entries.push(e);
    });
  }

  // Words with no equivalent: an arrow to a ∅ placeholder, plus dotted lines to the closest words.
  for (const n of NO_EQUIVALENT) {
    const isKo = n.lang === "ko";
    const word = isKo
      ? getKo(n.word, n.rom, { hanja: n.hanja, origin: n.hanja ? "sino" : "native" })
      : getJa(n.word, n.kana, n.rom, isKatakana(n.kana) ? "loan" : "native");
    word.noEquiv = { en: n.en, note: n.note };
    const empty = { lang: isKo ? "ja" : "ko", key: "∅:" + n.word, text: "∅", label: "∅", rom: "no equivalent",
      kana: "", pseudo: true, links: [] };
    addLink({ ko: isKo ? word : empty, ja: isKo ? empty : word, kind: "none", en: n.en, category: n.category, note: n.note });
    for (const c of n.closest || []) {
      const other = isKo
        ? getJa(c.word, c.kana, c.rom, isKatakana(c.kana) ? "loan" : "native")
        : getKo(c.word, c.rom, { origin: "native" });
      addLink({ ko: isKo ? word : other, ja: isKo ? other : word, kind: "approx", en: c.en, category: n.category,
        from: n.lang });
    }
  }

  // General translations.
  for (const t of TRANSLATIONS) {
    const ko = getKo(t.ko, t.koRom, {
      sense: t.sense, hanja: t.hanja, origin: t.koOrigin || (t.hanja ? "sino" : "native"),
    });
    const ja = getJa(t.ja, t.jaKana, t.jaRom, t.jaOrigin || (isKatakana(t.jaKana) ? "loan" : "native"));
    const l = addLink({ ko, ja, kind: t.kind || "translation", en: t.en, category: t.category, note: t.note });
    if (l.kind === "char" && t.hanja) {
      l.sharedChar = t.hanja;
      getChar(t.hanja).alone.push(l);
    }
  }

  const byCount = (m) => [...m.entries()].sort((a, b) => b[1] - a[1]).map(([r]) => r);
  for (const c of chars.values()) {
    c.koList = byCount(c.ko);
    c.jaList = byCount(c.ja);
    c.links = [...c.entries.map((e) => e.link), ...c.alone];
  }

  // Connected components via union-find.
  function components(list) {
    const parent = new Map();
    const find = (x) => {
      while (parent.get(x) !== x) { parent.set(x, parent.get(parent.get(x))); x = parent.get(x); }
      return x;
    };
    const add = (x) => { if (!parent.has(x)) parent.set(x, x); };
    for (const l of list) {
      const a = "k:" + l.ko.key, b = "j:" + l.ja.key;
      add(a); add(b);
      parent.set(find(a), find(b));
    }
    const groups = new Map();
    for (const l of list) {
      const r = find("k:" + l.ko.key);
      if (!groups.has(r)) groups.set(r, { links: [], ko: new Set(), ja: new Set() });
      const g = groups.get(r);
      g.links.push(l); g.ko.add(l.ko); g.ja.add(l.ja);
    }
    return [...groups.values()];
  }

  const comps = components(links.filter((l) => !NOT_TRANSLATION.has(l.kind)));
  for (const c of comps) {
    const a = c.ko.size, b = c.ja.size;
    c.type = a === 1 && b === 1 ? "1:1" : a === 1 ? "1:N" : b === 1 ? "N:1" : "N:M";
    for (const l of c.links) l.tr = c;
    for (const w of [...c.ko, ...c.ja]) w.tr = c;
  }

  const bands = components(links);
  for (const b of bands) {
    b.category = b.links[0].category; // a group is shown under its first link's category
    for (const l of b.links) l.band = b;
  }

  root.LANGUAGE_MAP_MODEL = { NOT_TRANSLATION, NO_EQUIVALENT, CATEGORIES, KINDS, ORIGINS, WORDS, TRANSLATIONS, koWords, jaWords, links, comps, bands, chars };
})();
