/*
 * Full Korean ↔ Japanese dictionary: search, entries, and a meaning map.
 *
 * Data lives in data/dict/ (built by scripts/build_dictionary.py from Wiktionary):
 *   ko/<n>.json, ja/<n>.json  entries, sharded by djb2(word) % 256
 *   m/<n>.json                meanings (word senses), 512 per file
 *   en/<n>.json               English word → meaning ids, djb2 % 64
 *   s/<key>.txt               search index lines: type \t word \t key \t hint
 *
 * The meaning map is a three-column graph: Korean words → meanings → Japanese words.
 * Several words per meaning are synonyms; several meanings per word are polysemy.
 */
(() => {
  "use strict";
  const root = document.querySelector("#view-dictionary");
  if (!root) return;

  const F = window.Furigana;
  const MODEL = window.LANGUAGE_MAP_MODEL;
  const BASE = "data/dict/";
  const $ = (s) => root.querySelector(s);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const truncate = (s, n) => (s.length > n ? s.slice(0, n - 1) + "…" : s);
  const djb2 = (s) => { let h = 5381; for (const ch of s) h = (Math.imul(h, 33) + ch.codePointAt(0)) >>> 0; return h; };
  const fold = (s) => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z]/g, "");
  const KANJI_RE = /[㐀-鿿豈-﫿々]/;
  const splitJ = (s) => { const i = s.indexOf("|"); return i < 0 ? [s, ""] : [s.slice(0, i), s.slice(i + 1)]; };

  // ── Loading ───────────────────────────────────────────────────────
  const cache = new Map();
  function load(path, asText = false) {
    if (!cache.has(path)) {
      cache.set(path, fetch(BASE + path).then((r) => {
        if (!r.ok) throw new Error(r.status === 404 ? "missing" : "HTTP " + r.status);
        return asText ? r.text() : r.json();
      }).catch((e) => { cache.delete(path); throw e; }));
    }
    return cache.get(path);
  }
  let meta = null;
  const metaReady = load("meta.json").then((m) => { meta = m; return m; });

  async function entry(t, w) {
    if (t === "e") {
      const m = await metaReady;
      const d = await load(`en/${djb2(w) % m.enShards}.json`).catch(() => ({}));
      return d[w] ? { m: d[w] } : null;
    }
    const m = await metaReady;
    const d = await load(`${t === "k" ? "ko" : "ja"}/${djb2(w) % m.entryShards}.json`).catch(() => ({}));
    return d[w] || null;
  }
  async function meaning(id) {
    const m = await metaReady;
    const d = await load(`m/${Math.floor(id / m.meaningBlock)}.json`);
    const [en, pos, sense, ko, ja] = d[id];
    return { id, en, pos, sense, ko, ja };
  }

  // ── Search ────────────────────────────────────────────────────────
  function shardFor(q) {
    const c = q[0], o = q.codePointAt(0);
    if (o >= 0xac00 && o <= 0xd7a3) return { shard: "h" + Math.floor((o - 0xac00) / 28), key: q, kind: "raw" };
    if (o >= 0x3040 && o <= 0x30ff) return { shard: "k" + F.toHira(c).codePointAt(0).toString(16), key: F.toHira(q), kind: "kana" };
    if (KANJI_RE.test(c)) return { shard: "c" + (o % 64), key: q, kind: "raw" };
    const f = fold(q);
    if (f.length >= 2) return { shard: "l" + f.slice(0, 2), key: f, kind: "latin" };
    return null;
  }

  async function search(q) {
    q = q.trim();
    if (!q) return [];
    const keys = [q];
    const f = fold(q);
    if (/ou|uu|ei/.test(f)) keys.push(f.replace(/ou/g, "o").replace(/uu/g, "u")); // gakkou → gakko
    const seen = new Set();
    const out = [];
    for (const k of keys) {
      const s = shardFor(k);
      if (!s) continue;
      const text = await load(`s/${s.shard}.txt`, true).catch(() => "");
      for (const line of text.split("\n")) {
        const [t, w, key, hint] = line.split("\t");
        if (!key) continue;
        const kk = s.kind === "kana" ? F.toHira(key) : key;
        if (!kk.startsWith(s.key)) continue;
        const id = t + w;
        if (seen.has(id)) continue;
        seen.add(id);
        out.push({ t, w, key, hint, exact: kk === s.key || w === q, len: kk.length });
        if (out.length > 400) break;
      }
    }
    out.sort((a, b) => b.exact - a.exact || a.len - b.len || (a.t === "e") - (b.t === "e"));
    return out.slice(0, 60);
  }

  // ── Rendering helpers ─────────────────────────────────────────────
  const rubyJ = (w, r) => (r && r !== w ? F.html(w, r) : esc(w));
  const chip = (t, w, r = "", extra = "") =>
    `<button class="dchip ${t}" data-t="${t}" data-w="${esc(w)}" ${extra}><span lang="${t === "k" ? "ko" : t === "j" ? "ja" : "en"}">${t === "j" ? rubyJ(w, r) : esc(w)}</span></button>`;
  const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
  const typeName = { k: "Korean", j: "Japanese", e: "English" };
  const canSpeak = "speechSynthesis" in window;
  const speakBtn = (text, lang) => canSpeak && text
    ? `<button class="speak" data-say="${esc(text)}" data-lang="${lang}" aria-label="Play pronunciation">🔊</button>` : "";

  const els = {
    q: $("#dict-q"), results: $("#dict-results"), entry: $("#dict-entry"),
    svg: $("#dict-graph"), stats: $("#dict-stats"), reset: $("#dict-reset"), status: $("#dict-status"),
  };

  metaReady.then((m) => {
    els.q.placeholder = `Search ${m.koEntries.toLocaleString()} Korean and ${m.jaEntries.toLocaleString()} Japanese words…`;
    els.stats.textContent = `${m.koEntries.toLocaleString()} Korean · ${m.jaEntries.toLocaleString()} Japanese entries · ${m.meanings.toLocaleString()} shared meanings`;
  }).catch(() => {
    els.entry.innerHTML = `<div class="dict-error">The dictionary data could not be loaded. If you opened this file directly,
      serve the folder over HTTP instead (for example <code>python3 -m http.server</code>).</div>`;
  });

  let searchSeq = 0, searchTimer = null, results = [];
  els.q.addEventListener("input", () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(runSearch, 120);
  });
  els.q.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter" && results[0]) open(results[0].t, results[0].w);
  });

  async function runSearch() {
    const seq = ++searchSeq;
    const q = els.q.value;
    if (!q.trim()) { els.results.innerHTML = ""; return; }
    if (q.trim().length === 1 && /[a-z]/i.test(q)) {
      els.results.innerHTML = `<p class="dict-hint">Type at least two letters.</p>`;
      return;
    }
    els.results.innerHTML = `<p class="dict-hint">Searching…</p>`;
    const r = await search(q);
    if (seq !== searchSeq) return;
    results = r;
    els.results.innerHTML = r.length
      ? r.map((x) => `<button class="dres" data-t="${x.t}" data-w="${esc(x.w)}">
          <span class="sr-lang ${x.t === "k" ? "ko" : x.t === "j" ? "ja" : "en"}">${x.t === "k" ? "KO" : x.t === "j" ? "JA" : "EN"}</span>
          <span class="dres-w" lang="${x.t === "k" ? "ko" : x.t === "j" ? "ja" : "en"}">${x.t === "j" && x.key !== x.w && /[぀-ヿ]/.test(x.key) ? rubyJ(x.w, x.key) : esc(x.w)}</span>
          <span class="dres-h">${esc(x.hint || "")}</span></button>`).join("")
      : `<p class="dict-hint">No matches.</p>`;
  }
  els.results.addEventListener("click", (ev) => {
    const b = ev.target.closest("[data-t]");
    if (b) open(b.dataset.t, b.dataset.w);
  });

  // ── Entry view ────────────────────────────────────────────────────
  let current = null;
  async function open(t, w, { expand = true, reset = false } = {}) {
    current = { t, w };
    history.replaceState(null, "", `#d=${t}:${encodeURIComponent(w)}`);
    els.entry.innerHTML = `<p class="dict-hint">Loading ${esc(w)}…</p>`;
    let e;
    try { e = await entry(t, w); } catch { e = null; }
    if (current.t !== t || current.w !== w) return;
    const ms = await Promise.all((e?.m || []).slice(0, 24).map(meaning)).catch(() => []);
    if (current.t !== t || current.w !== w) return;
    els.entry.innerHTML = t === "e" ? englishView(w, ms) : wordView(t, w, e, ms);
    els.entry.scrollTop = 0;
    if (reset) graph.clear();
    if (expand) await graph.expand(t, w, e, ms);
  }

  // Drop kana-only spellings when the same reading is already present as a kanji word (かみ next to 髪|かみ).
  function directList(list) {
    list = list || [];
    const readings = new Set(list.map((x) => splitJ(x)[1]).filter(Boolean));
    return list.filter((x) => { const [w, r] = splitJ(x); return r || !readings.has(F.toHira(w)); });
  }

  function curatedFor(t, w) {
    if (!MODEL) return [];
    const words = t === "k"
      ? [...MODEL.koWords.values()].filter((x) => x.text === w)
      : [...MODEL.jaWords.values()].filter((x) => x.text === w);
    return words.flatMap((x) => x.links.map((l) => ({ l, self: x })));
  }

  function wordView(t, w, e, ms) {
    const isK = t === "k";
    const otherT = isK ? "j" : "k";
    const reading = !isK ? (e?.k || [])[0] : "";
    const head = isK
      ? `<div class="de-word" lang="ko">${esc(w)}</div>`
      : `<div class="de-word" lang="ja">${reading ? F.html(w, reading) : esc(w)}</div>`;
    const sub = [];
    if (e?.r) sub.push(esc(e.r));
    if (isK && e?.h?.length) sub.push(`hanja <span lang="ko">${e.h.map(esc).join(", ")}</span>`);
    if (!isK && e?.k?.length > 1) sub.push(`readings <span lang="ja">${e.k.slice(0, 8).map(esc).join("、")}</span>`);
    const pos = (e?.p || []).map((p) => `<span class="tag">${esc(p)}</span>`).join("");

    const defs = [];
    if (e?.e?.length) defs.push(`<ol class="de-defs">${e.e.map((g) => `<li>${esc(g)}</li>`).join("")}</ol>`);
    if (e?.d?.length) defs.push(`<div class="de-native"><span class="de-src">${isK ? "국어사전" : "国語辞典"}</span> <span lang="${isK ? "ko" : "ja"}">${e.d.map(esc).join(" / ")}</span></div>`);

    // Japanese (or Korean) equivalents grouped by meaning.
    const sideOther = (m) => (isK ? m.ja : m.ko);
    const sideSelf = (m) => (isK ? m.ko : m.ja.map((x) => splitJ(x)[0]));
    const withOther = ms.filter((m) => sideOther(m).length);
    const meaningsHtml = withOther.map((m) => {
      const syn = sideSelf(m).filter((x) => x !== w);
      return `<div class="dm">
        <div class="dm-gloss"><button class="dm-en" data-t="e" data-w="${esc(m.en)}">${esc(m.en)}</button>${m.pos ? ` <span class="dm-pos">${esc(m.pos)}</span>` : ""}${m.sense ? ` — ${esc(m.sense)}` : ""}</div>
        <div class="dm-row"><span class="dm-lbl">${isK ? "日本語" : "한국어"}</span><span>${sideOther(m).map((x) => { const [a, r] = splitJ(x); return chip(otherT, a, r); }).join("")}</span></div>
        ${syn.length ? `<div class="dm-row syn"><span class="dm-lbl">synonyms</span><span>${syn.map((x) => chip(t, x)).join("")}</span></div>` : ""}
      </div>`;
    }).join("");

    const direct = directList(isK ? e?.j : e?.o);
    const cogs = e?.c || [];
    const curated = curatedFor(t, w);
    const curatedHtml = curated.map(({ l }) => {
      const o = isK ? l.ja : l.ko;
      const kind = MODEL.KINDS[l.kind];
      const target = o.pseudo ? `<span class="none-mark">∅ no ${isK ? "Japanese" : "Korean"} equivalent</span>`
        : chip(isK ? "j" : "k", o.text, o.kana || "");
      return `<div class="dcur" style="--kc:${kind.color}"><span class="dcur-kind">${esc(kind.label)}</span>${target}
        <span class="dcur-en">${esc(l.kind === "false" ? `KO: ${l.falseFriend.ko} · JA: ${l.falseFriend.ja}` : l.en)}</span>
        ${l.note ? `<div class="dcur-note">${esc(l.note)}</div>` : ""}</div>`;
    }).join("");
    const hasAny = withOther.length || direct.length || curated.some(({ l }) => !l.ja.pseudo && !l.ko.pseudo);

    const wikt = `https://${isK ? "en" : "en"}.wiktionary.org/wiki/${encodeURIComponent(w)}#${isK ? "Korean" : "Japanese"}`;
    return `
      <div class="de-tags"><span class="tag lang-${isK ? "ko" : "ja"}">${typeName[t]}</span>${pos}</div>
      <div class="de-hero ${isK ? "ko" : "ja"}">${head}<div class="de-sub">${sub.join(" · ")}</div>
        ${speakBtn(isK ? w : reading || w, isK ? "ko-KR" : "ja-JP")}</div>
      ${e ? defs.join("") : `<p class="dict-hint">Not in the dictionary data.</p>`}
      ${curatedHtml ? `<h3 class="de-h">Curated</h3>${curatedHtml}` : ""}
      ${meaningsHtml ? `<h3 class="de-h">${isK ? "Japanese" : "Korean"} by meaning <small>${withOther.length}</small></h3>${meaningsHtml}` : ""}
      ${direct.length ? `<h3 class="de-h">Also translated as <small>from ${isK ? "Japanese" : "Korean"} Wiktionary</small></h3>
        <div class="dchips">${direct.slice(0, 40).map((x) => { const [a, r] = splitJ(x); return chip(otherT, a, r); }).join("")}</div>` : ""}
      ${cogs.length ? `<h3 class="de-h">Same characters <small>${isK ? "Japanese word written with this hanja" : "Korean word with this hanja"}</small></h3>
        <div class="dchips">${cogs.map((x) => { const [a, r] = splitJ(x); return chip(otherT, a, r); }).join("")}</div>
        <p class="de-note">Written with the same characters. The meaning is often the same, but can differ (false friends).</p>` : ""}
      ${!hasAny ? `<div class="dm-none"><strong>∅ No ${isK ? "Japanese" : "Korean"} equivalent found</strong> in the dataset.
        This can mean the word has no equivalent, or just that Wiktionary doesn't list one yet.</div>` : ""}
      ${ms.length > withOther.length ? `<p class="de-note">${ms.length - withOther.length} more meaning(s) have no ${isK ? "Japanese" : "Korean"} translation listed.</p>` : ""}
      <p class="de-source">Source: <a href="${wikt}" target="_blank" rel="noopener">Wiktionary</a> (CC BY-SA 4.0)</p>`;
  }

  function englishView(w, ms) {
    return `
      <div class="de-tags"><span class="tag">English</span></div>
      <div class="de-hero en"><div class="de-word">${esc(w)}</div><div class="de-sub">${plural(ms.length, "meaning")} with Korean or Japanese translations</div></div>
      ${ms.map((m) => `<div class="dm">
        <div class="dm-gloss"><span class="dm-pos">${esc(m.pos)}</span> ${esc(m.sense || m.en)}</div>
        <div class="dm-row"><span class="dm-lbl">한국어</span><span>${m.ko.map((x) => chip("k", x)).join("") || '<span class="none-mark">∅</span>'}</span></div>
        <div class="dm-row"><span class="dm-lbl">日本語</span><span>${m.ja.map((x) => { const [a, r] = splitJ(x); return chip("j", a, r); }).join("") || '<span class="none-mark">∅</span>'}</span></div>
      </div>`).join("")}`;
  }

  els.entry.addEventListener("click", (ev) => {
    const say = ev.target.closest("[data-say]");
    if (say) {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(say.dataset.say);
      u.lang = say.dataset.lang;
      return speechSynthesis.speak(u);
    }
    const b = ev.target.closest("[data-t]");
    if (b) open(b.dataset.t, b.dataset.w);
  });

  // ── Meaning map (three-column graph) ──────────────────────────────
  const graph = (() => {
    const svg = d3.select(els.svg);
    const layer = svg.append("g");
    const edgeLayer = layer.append("g");
    const nodeLayer = layer.append("g");
    const zoom = d3.zoom().scaleExtent([0.15, 3]).on("zoom", (ev) => layer.attr("transform", ev.transform));
    svg.call(zoom).on("dblclick.zoom", null);
    const nodes = new Map();
    const edges = new Map();
    const COL = { k: -300, m: 0, j: 300 };
    const MAX_NODES = 220;
    let focusId = null;

    const ROW = { k: 44, m: 34, j: 50 };

    // Three ordered columns. Each column is sorted by the average position of
    // its neighbours (barycenter heuristic) so that lines cross as little as possible.
    function layout(es) {
      const cols = { k: [], m: [], j: [] };
      for (const n of nodes.values()) cols[n.t].push(n);
      const adj = new Map([...nodes.keys()].map((id) => [id, []]));
      for (const e of es) {
        const s = e.source.id || e.source, t = e.target.id || e.target;
        adj.get(s)?.push(t); adj.get(t)?.push(s);
      }
      const rank = new Map();
      const setRanks = () => { for (const t in cols) cols[t].forEach((n, i) => rank.set(n.id, cols[t].length > 1 ? i / (cols[t].length - 1) : 0.5)); };
      setRanks();
      for (let pass = 0; pass < 6; pass++) {
        for (const t of pass % 2 ? ["k", "j", "m"] : ["m", "k", "j"]) {
          const score = new Map(cols[t].map((n) => {
            const nb = adj.get(n.id).filter((id) => nodes.get(id).t !== t);
            return [n, nb.length ? nb.reduce((a, id) => a + rank.get(id), 0) / nb.length : rank.get(n.id)];
          }));
          cols[t].sort((a, b) => score.get(a) - score.get(b));
          setRanks();
        }
      }
      for (const t in cols) cols[t].forEach((n, i) => { n.x = COL[t]; n.y = (i - (cols[t].length - 1) / 2) * ROW[t]; });
    }

    function addNode(t, w, extra = {}) {
      const id = t + ":" + w;
      if (!nodes.has(id)) {
        if (nodes.size >= MAX_NODES) return null;
        const near = [...nodes.values()].find((n) => n.t !== t) || { y: 0 };
        const n = { id, t, w, x: COL[t] + (Math.random() - 0.5) * 30, y: near.y + (Math.random() - 0.5) * 120, ...extra };
        n.label = t === "m" ? truncate(`${n.en}: ${n.sense || n.pos}`, 34) : w;
        n.width = t === "m" ? Math.min(240, n.label.length * 6.3 + 20) : Math.max([...w].length * 15, 30) + 22;
        n.h = t === "m" ? 26 : t === "j" ? 40 : 32;
        nodes.set(id, n);
      } else if (extra.r && !nodes.get(id).r) nodes.get(id).r = extra.r;
      return nodes.get(id);
    }
    function addEdge(a, b, kind) {
      if (!a || !b) return;
      const id = a.id + ">" + b.id;
      if (!edges.has(id)) edges.set(id, { id, source: a.id, target: b.id, kind });
    }

    async function expand(t, w, e, ms) {
      if (t === "e") {
        for (const m of ms) addMeaning(m);
      } else {
        const self = addNode(t, w, t === "j" ? { r: (e?.k || [])[0] } : {});
        if (!self) return render();
        for (const m of ms.slice(0, 16)) addMeaning(m);
        const otherT = t === "k" ? "j" : "k";
        const viaMeaning = new Set(ms.slice(0, 16).flatMap((m) => (t === "k" ? m.ja.map((x) => splitJ(x)[0]) : m.ko)));
        for (const x of directList(t === "k" ? e?.j : e?.o).filter((x) => !viaMeaning.has(splitJ(x)[0])).slice(0, 12)) {
          const [a, r] = splitJ(x);
          const o = addNode(otherT, a, { r });
          addEdge(t === "k" ? self : o, t === "k" ? o : self, "direct");
        }
        for (const x of (e?.c || []).slice(0, 6)) {
          const [a, r] = splitJ(x);
          const o = addNode(otherT, a, { r });
          addEdge(t === "k" ? self : o, t === "k" ? o : self, "cog");
        }
        for (const { l } of curatedFor(t, w)) {
          const ko = l.ko.pseudo ? addNode("k", "∅ " + l.ja.text, { pseudo: true }) : addNode("k", l.ko.text);
          const ja = l.ja.pseudo ? addNode("j", "∅ " + l.ko.text, { pseudo: true }) : addNode("j", l.ja.text, { r: l.ja.kana });
          addEdge(ko, ja, "cur-" + l.kind);
        }
        focusId = self.id;
      }
      render();
    }

    function addMeaning(m) {
      const mn = addNode("m", "m" + m.id, { en: m.en, sense: m.sense, pos: m.pos, mid: m.id });
      if (!mn) return;
      for (const k of m.ko.slice(0, 8)) addEdge(addNode("k", k), mn, "m");
      for (const x of m.ja.slice(0, 8)) { const [a, r] = splitJ(x); addEdge(mn, addNode("j", a, { r }), "m"); }
    }

    function clear() { nodes.clear(); edges.clear(); focusId = null; render(); }

    function render() {
      const ns = [...nodes.values()];
      const es = [...edges.values()].filter((e) => nodes.has(e.source.id || e.source) && nodes.has(e.target.id || e.target));
      edgeLayer.selectAll("path").data(es, (d) => d.id).join("path")
        .attr("class", (d) => "dedge " + d.kind)
        .attr("marker-end", (d) => (d.kind === "direct" || d.kind.startsWith("cur-") && !["cur-false", "cur-approx"].includes(d.kind) ? "url(#m-translation)" : null));
      const sel = nodeLayer.selectAll("g.dnode").data(ns, (d) => d.id).join((enter) => {
        const g = enter.append("g").attr("class", (d) => `dnode ${d.t}${d.pseudo ? " pseudo" : ""}`).attr("tabindex", 0).attr("role", "button");
        g.each(function (d) {
          const s = d3.select(this);
          s.append("rect").attr("x", -d.width / 2).attr("y", -d.h / 2).attr("width", d.width).attr("height", d.h).attr("rx", d.t === "m" ? 13 : 8);
          if (d.t === "j") s.append("g").attr("class", "jtext").html(F.svg(d.w, d.r, { y: 11, fs: 14, rtSize: 8, cls: "lbl" }));
          else s.append("text").attr("class", "lbl").attr("y", d.t === "m" ? 4 : 5).attr("lang", d.t === "k" ? "ko" : "en").text(d.label);
        });
        g.on("click", (ev, d) => {
          if (d.pseudo) return;
          if (d.t === "m") open("e", d.en, { expand: true });
          else open(d.t, d.w);
        });
        g.on("mouseenter", (ev, d) => highlight(d.id)).on("mouseleave", () => highlight(focusId));
        g.on("keydown", (ev, d) => { if ((ev.key === "Enter" || ev.key === " ") && !d.pseudo) { ev.preventDefault(); d.t === "m" ? open("e", d.en) : open(d.t, d.w); } });
        return g;
      });
      // Japanese nodes can learn their reading after being created.
      sel.filter((d) => d.t === "j").each(function (d) {
        const g = d3.select(this).select(".jtext");
        if (d.r && !g.select(".rt").size()) g.html(F.svg(d.w, d.r, { y: 11, fs: 14, rtSize: 8, cls: "lbl" }));
      });
      // Resolve edge endpoints to node objects, then lay out the columns.
      for (const e of es) {
        if (typeof e.source === "string") e.source = nodes.get(e.source);
        if (typeof e.target === "string") e.target = nodes.get(e.target);
      }
      layout(es);
      draw();
      highlight(focusId);
      fit();
      els.status.textContent = ns.length
        ? `${ns.filter((n) => n.t === "k").length} Korean · ${plural(ns.filter((n) => n.t === "m").length, "meaning")} · ${ns.filter((n) => n.t === "j").length} Japanese${nodes.size >= MAX_NODES ? " (map full: reset to explore further)" : ""}`
        : "Search for a word to start the map.";
    }

    function draw() {
      edgeLayer.selectAll("path").attr("d", (d) => {
        const s = d.source, t = d.target;
        const x1 = s.x + s.width / 2, x2 = t.x - t.width / 2;
        if (x2 > x1) {
          const mx = (x1 + x2) / 2;
          return `M${x1},${s.y} C${mx},${s.y} ${mx},${t.y} ${x2 - 3},${t.y}`;
        }
        return `M${s.x},${s.y} L${t.x},${t.y}`;
      });
      nodeLayer.selectAll("g.dnode").attr("transform", (d) => `translate(${d.x},${d.y})`);
    }

    function highlight(id) {
      const n = id && nodes.get(id);
      const near = new Set(n ? [id] : []);
      if (n) for (const e of edges.values()) {
        const s = e.source.id || e.source, t = e.target.id || e.target;
        if (s === id) near.add(t);
        if (t === id) near.add(s);
      }
      // Also light up words two steps away through a meaning (synonyms and translations).
      if (n && n.t !== "m") for (const e of edges.values()) {
        const s = e.source.id || e.source, t = e.target.id || e.target;
        if (near.has(s) && nodes.get(s)?.t === "m") near.add(t);
        if (near.has(t) && nodes.get(t)?.t === "m") near.add(s);
      }
      nodeLayer.selectAll("g.dnode").classed("dim", (d) => !!n && !near.has(d.id)).classed("focus", (d) => d.id === focusId);
      edgeLayer.selectAll("path").classed("dim", (d) => !!n && !(near.has(d.source.id) && near.has(d.target.id)));
    }

    function fit() {
      const ns = [...nodes.values()];
      const { width, height } = els.svg.getBoundingClientRect();
      if (!ns.length || !width) return;
      const x0 = Math.min(...ns.map((n) => n.x - n.width / 2)), x1 = Math.max(...ns.map((n) => n.x + n.width / 2));
      const y0 = Math.min(...ns.map((n) => n.y - n.h / 2)), y1 = Math.max(...ns.map((n) => n.y + n.h / 2));
      const k = Math.min(1.4, (width - 40) / (x1 - x0), (height - 40) / (y1 - y0));
      svg.transition().duration(450).call(zoom.transform,
        d3.zoomIdentity.translate(width / 2, height / 2).scale(k).translate(-(x0 + x1) / 2, -(y0 + y1) / 2));
    }

    return { expand, clear, fit };
  })();

  els.reset.addEventListener("click", () => {
    graph.clear();
    if (current) open(current.t, current.w);
  });
  root.querySelector("#dict-fit").addEventListener("click", () => graph.fit());

  // Example searches.
  root.querySelectorAll("[data-example]").forEach((b) => b.addEventListener("click", () => {
    const [t, w] = b.dataset.example.split(":");
    els.q.value = w;
    runSearch();
    open(t, w, { reset: true });
  }));

  // Deep link: #d=k:머리
  function fromHash() {
    const m = location.hash.match(/^#d=([kje]):(.+)$/);
    if (m) {
      const w = decodeURIComponent(m[2]);
      els.q.value = w;
      runSearch();
      open(m[1], w, { reset: true });
      return true;
    }
    return false;
  }
  window.DictionaryPage = {
    fromHash,
    start() { if (!current && !fromHash()) open("k", "머리", { reset: true }); },
    fit: () => graph.fit(),
  };
  window.addEventListener("hashchange", () => fromHash());
  // app.js runs first and may already have switched to this view.
  if (document.body.dataset.active === "dictionary") window.DictionaryPage.start();
})();
