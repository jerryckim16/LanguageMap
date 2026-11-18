/*
 * Furigana helpers: split a Japanese word into segments and attach the
 * hiragana reading to its kanji parts.
 *
 *   Furigana.segments("美味しい", "おいしい") → [{ base: "美味", rt: "おい" }, { base: "しい" }]
 *   Furigana.segments("学校", "がっこう", ["がっ", "こう"]) → per-character readings
 *   Furigana.html(...)  → <ruby> markup for HTML
 *   Furigana.svg(...)   → <text> elements for SVG, readings drawn above the kanji
 */
(function () {
  const KANJI = /[㐀-鿿豈-﫿々〆ヶ]/;
  const isKanji = (ch) => KANJI.test(ch);
  const toHira = (s) => String(s).replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
  const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  function runs(text) {
    const out = [];
    for (const ch of text) {
      const k = isKanji(ch);
      const last = out[out.length - 1];
      if (last && last.kanji === k) last.text += ch;
      else out.push({ text: ch, kanji: k });
    }
    return out;
  }

  function segments(text, kana, parts) {
    text = String(text || "");
    if (!kana || ![...text].some(isKanji)) return [{ base: text }];
    const chars = [...text];
    // Exact per-character readings are known (same-character word pairs).
    if (parts && parts.length === chars.length) {
      return chars.map((c, i) => (isKanji(c) ? { base: c, rt: parts[i] } : { base: c }));
    }
    const rs = runs(text);
    const re = new RegExp("^" + rs.map((r) => (r.kanji ? "(.+?)" : "(" + escRe(toHira(r.text)) + ")")).join("") + "$");
    const m = toHira(kana).match(re);
    if (m) return rs.map((r, i) => (r.kanji ? { base: r.text, rt: m[i + 1] } : { base: r.text }));
    return [{ base: text, rt: kana }]; // could not align: reading over the whole word
  }

  function html(text, kana, parts) {
    return segments(text, kana, parts)
      .map((s) => (s.rt ? `<ruby>${esc(s.base)}<rt>${esc(s.rt)}</rt></ruby>` : esc(s.base)))
      .join("");
  }

  /*
   * SVG version: the base text centered at (x, y) with font size fs, and each
   * reading centered above its kanji. Japanese characters are full-width, so a
   * character is about fs wide.
   */
  function svg(text, kana, { x = 0, y = 0, fs = 14, rtSize, cls = "", rtCls = "rt", parts } = {}) {
    const segs = segments(text, kana, parts);
    const total = [...String(text)].length * fs;
    const rs = rtSize || Math.max(7, Math.round(fs * 0.55));
    let pos = -total / 2;
    let out = `<text class="${cls}" x="${x}" y="${y}" font-size="${fs}" lang="ja" text-anchor="middle">${esc(text)}</text>`;
    for (const s of segs) {
      const w = [...s.base].length * fs;
      if (s.rt) {
        const cx = x + pos + w / 2;
        // Squeeze long readings so they don't spill far past their kanji.
        const natural = [...s.rt].length * rs;
        const fit = natural > w + fs * 0.6 ? ` textLength="${(w + fs * 0.6).toFixed(1)}" lengthAdjust="spacingAndGlyphs"` : "";
        out += `<text class="${rtCls}" x="${cx.toFixed(1)}" y="${(y - fs * 0.92).toFixed(1)}" font-size="${rs}" lang="ja" text-anchor="middle"${fit}>${esc(s.rt)}</text>`;
      }
      pos += w;
    }
    return out;
  }

  // Hepburn romanization from kana, for display when no romanization is given.
  const ROMA = {
    きゃ: "kya", きゅ: "kyu", きょ: "kyo", しゃ: "sha", しゅ: "shu", しょ: "sho", ちゃ: "cha", ちゅ: "chu", ちょ: "cho",
    にゃ: "nya", にゅ: "nyu", にょ: "nyo", ひゃ: "hya", ひゅ: "hyu", ひょ: "hyo", みゃ: "mya", みゅ: "myu", みょ: "myo",
    りゃ: "rya", りゅ: "ryu", りょ: "ryo", ぎゃ: "gya", ぎゅ: "gyu", ぎょ: "gyo", じゃ: "ja", じゅ: "ju", じょ: "jo",
    びゃ: "bya", びゅ: "byu", びょ: "byo", ぴゃ: "pya", ぴゅ: "pyu", ぴょ: "pyo", ぢゃ: "ja", ぢゅ: "ju", ぢょ: "jo",
    てぃ: "ti", でぃ: "di", ふぁ: "fa", ふぃ: "fi", ふぇ: "fe", ふぉ: "fo", うぃ: "wi", うぇ: "we", うぉ: "wo",
    しぇ: "she", ちぇ: "che", じぇ: "je", つぁ: "tsa", ゔぁ: "va", ゔぃ: "vi", ゔぇ: "ve", ゔぉ: "vo", でゅ: "dyu", てゅ: "tyu",
    あ: "a", い: "i", う: "u", え: "e", お: "o", か: "ka", き: "ki", く: "ku", け: "ke", こ: "ko",
    さ: "sa", し: "shi", す: "su", せ: "se", そ: "so", た: "ta", ち: "chi", つ: "tsu", て: "te", と: "to",
    な: "na", に: "ni", ぬ: "nu", ね: "ne", の: "no", は: "ha", ひ: "hi", ふ: "fu", へ: "he", ほ: "ho",
    ま: "ma", み: "mi", む: "mu", め: "me", も: "mo", や: "ya", ゆ: "yu", よ: "yo",
    ら: "ra", り: "ri", る: "ru", れ: "re", ろ: "ro", わ: "wa", ゐ: "i", ゑ: "e", を: "o", ん: "n",
    が: "ga", ぎ: "gi", ぐ: "gu", げ: "ge", ご: "go", ざ: "za", じ: "ji", ず: "zu", ぜ: "ze", ぞ: "zo",
    だ: "da", ぢ: "ji", づ: "zu", で: "de", ど: "do", ば: "ba", び: "bi", ぶ: "bu", べ: "be", ぼ: "bo",
    ぱ: "pa", ぴ: "pi", ぷ: "pu", ぺ: "pe", ぽ: "po", ゔ: "vu",
    ぁ: "a", ぃ: "i", ぅ: "u", ぇ: "e", ぉ: "o", ゃ: "ya", ゅ: "yu", ょ: "yo", ゎ: "wa",
  };
  const LONG = { a: "ā", i: "ī", u: "ū", e: "ē", o: "ō" };
  function romaji(kana) {
    const s = toHira(kana);
    let out = "";
    for (let i = 0; i < s.length; i++) {
      const two = s.slice(i, i + 2);
      if (ROMA[two]) { out += ROMA[two]; i++; continue; }
      const c = s[i];
      if (c === "っ") {
        const nx = ROMA[s.slice(i + 1, i + 3)] || ROMA[s[i + 1]] || "";
        out += nx.startsWith("ch") ? "t" : nx[0] || "";
        continue;
      }
      if (c === "ー") {
        const v = out.slice(-1);
        out = LONG[v] ? out.slice(0, -1) + LONG[v] : out;
        continue;
      }
      if (c === "ん" && /^[aiueoy]/.test(ROMA[s.slice(i + 1, i + 3)] || ROMA[s[i + 1]] || "")) { out += "n'"; continue; }
      out += ROMA[c] ?? c;
    }
    // Long vowels: ou/oo → ō, uu → ū (Hepburn). ei is kept.
    return out.replace(/ou/g, "ō").replace(/oo/g, "ō").replace(/uu/g, "ū");
  }

  const root = typeof window !== "undefined" ? window : globalThis;
  root.Furigana = { segments, html, svg, romaji, toHira, isKanji };
})();
