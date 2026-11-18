/* Kanji overlap map: Korean and Japanese words built from the same characters. */
(() => {
  "use strict";

  const { WORDS, CATEGORIES } = window.LANGUAGE_MAP_DATA;
  const $ = (sel) => document.querySelector(sel);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fold = (s) => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const catColor = (key) => CATEGORIES[key]?.color || "#888";
  const ruby = (e) => window.Furigana.html(e.kanji, e.ja, e.jaParts);
  const meaningOf = (e) => e.falseFriend ? `KO: ${e.falseFriend.ko} · JA: ${e.falseFriend.ja}` : e.en;

  // ── Index the data ────────────────────────────────────────────────
  const wordById = new Map();   // kanji string → entry
  const charByKey = new Map();  // kanji character → char info

  for (const e of WORDS) {
    e.id = e.kanji;
    e.chars = [...e.kanji];
    e.hanjaChars = [...e.hanja];
    e.koChars = [...e.ko];
    e.search = fold([e.ko, e.hanja, e.kanji, e.ja, e.koRom, e.jaRom, e.en,
      e.falseFriend?.ko, e.falseFriend?.ja].filter(Boolean).join(" "));
    wordById.set(e.id, e);

    e.chars.forEach((k, i) => {
      if (!charByKey.has(k)) {
        charByKey.set(k, { key: k, hanja: e.hanjaChars[i], ko: new Map(), ja: new Map(), words: [] });
      }
      const c = charByKey.get(k);
      c.ko.set(e.koChars[i], (c.ko.get(e.koChars[i]) || 0) + 1);
      c.ja.set(e.jaParts[i], (c.ja.get(e.jaParts[i]) || 0) + 1);
      if (!c.words.includes(e)) c.words.push(e);
    });
  }
  const sortedReadings = (m) => [...m.entries()].sort((a, b) => b[1] - a[1]).map(([r]) => r);
  for (const c of charByKey.values()) {
    c.koList = sortedReadings(c.ko);
    c.jaList = sortedReadings(c.ja);
  }

  // ── State ─────────────────────────────────────────────────────────
  const state = {
    view: "map",
    cats: new Set(Object.keys(CATEGORIES)),
    falseOnly: false,
    sharedOnly: false,
    showEnglish: true,
    selected: null,     // { type: "word" | "char", id }
    hover: null,        // same shape
    query: "",
  };

  const isWordVisible = (e) => state.cats.has(e.category) && (!state.falseOnly || e.falseFriend);
  const visibleWords = () => WORDS.filter(isWordVisible);

  // ── Speech ────────────────────────────────────────────────────────
  const canSpeak = "speechSynthesis" in window;
  function speak(text, lang) {
    if (!canSpeak) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang;
    const voice = speechSynthesis.getVoices().find((v) => v.lang.replace("_", "-").startsWith(lang.slice(0, 2)));
    if (voice) u.voice = voice;
    u.rate = 0.85;
    speechSynthesis.speak(u);
  }
  const speakBtn = (text, lang) => canSpeak
    ? `<button class="speak" data-say="${esc(text)}" data-lang="${lang}" aria-label="Play pronunciation" title="Play pronunciation">🔊</button>`
    : "";

  // ── Filters UI ────────────────────────────────────────────────────
  function renderChips() {
    const counts = {};
    for (const e of WORDS) counts[e.category] = (counts[e.category] || 0) + 1;
    const allOn = state.cats.size === Object.keys(CATEGORIES).length;
    $("#category-chips").innerHTML =
      `<button class="chip chip-all" data-cat="*" aria-pressed="${allOn}">All</button>` +
      Object.entries(CATEGORIES).filter(([key]) => counts[key]).map(([key, c]) =>
        `<button class="chip" data-cat="${key}" aria-pressed="${state.cats.has(key)}" title="Click to toggle. Double-click to show only this category.">
           <span class="dot" style="background:${c.color}"></span>${esc(c.label)}<span class="count">${counts[key] || 0}</span>
         </button>`).join("");
  }

  let chipClickTimer = null;
  $("#category-chips").addEventListener("click", (ev) => {
    const btn = ev.target.closest(".chip");
    if (!btn) return;
    const cat = btn.dataset.cat;
    clearTimeout(chipClickTimer);
    if (ev.detail > 1) return; // part of a double-click, handled below
    chipClickTimer = setTimeout(() => {
      if (cat === "*") state.cats = new Set(Object.keys(CATEGORIES));
      else if (state.cats.has(cat)) state.cats.delete(cat);
      else state.cats.add(cat);
      refresh({ refit: true });
    }, cat === "*" ? 0 : 200);
  });
  $("#category-chips").addEventListener("dblclick", (ev) => {
    const btn = ev.target.closest(".chip");
    if (!btn || btn.dataset.cat === "*") return;
    clearTimeout(chipClickTimer);
    state.cats = new Set([btn.dataset.cat]);
    refresh({ refit: true });
  });

  $("#opt-false-friends").addEventListener("change", (e) => { state.falseOnly = e.target.checked; refresh({ refit: true }); });
  $("#opt-shared").addEventListener("change", (e) => { state.sharedOnly = e.target.checked; refresh({ refit: true }); });
  $("#opt-english").addEventListener("change", (e) => {
    state.showEnglish = e.target.checked;
    $("#graph").classList.toggle("hide-en", !state.showEnglish);
  });

  // ── Graph ─────────────────────────────────────────────────────────
  const svg = d3.select("#graph");
  const stageEl = $("#view-map");
  const zoomLayer = svg.append("g");
  const linkLayer = zoomLayer.append("g");
  const nodeLayer = zoomLayer.append("g");
  const emptyMsg = svg.append("text").attr("class", "empty-msg")
    .attr("text-anchor", "middle").attr("fill", "currentColor").attr("opacity", 0.6)
    .text("No words match these filters.").style("display", "none");

  const WORD_H = 50;
  const nodeCache = new Map(); // id → node object (keeps positions between filter changes)
  let nodes = [], links = [], adjacency = new Map();
  let refitOnEnd = false;
  let pendingFit = false;

  const zoom = d3.zoom().scaleExtent([0.15, 4]).on("zoom", (ev) => zoomLayer.attr("transform", ev.transform));
  svg.call(zoom).on("dblclick.zoom", null);
  svg.on("click", (ev) => { if (ev.target === svg.node()) select(null); });

  const simulation = d3.forceSimulation()
    .force("link", d3.forceLink().id((d) => d.id)
      .distance((l) => 34 + l.target.r + l.source.w / 3).strength(0.9))
    .force("charge", d3.forceManyBody().strength((d) => d.type === "char" ? -90 - 35 * d.deg : -170))
    .force("collide", d3.forceCollide().radius((d) => d.type === "char" ? d.r + 5 : d.w / 2 + 14).iterations(2))
    .force("x", d3.forceX().strength(0.045))
    .force("y", d3.forceY().strength(0.06))
    .on("tick", () => {
      ticked();
      // After a filter change, re-fit once the layout has mostly settled.
      if (refitOnEnd && simulation.alpha() < 0.3) { refitOnEnd = false; fit(true); }
    })
    .stop();

  function wordWidth(e) {
    const ko = [...e.ko].length * 14;
    const ja = [...e.kanji].length * 13;
    return Math.max(ko, ja) + 22;
  }

  function buildGraphData() {
    const words = visibleWords();
    const charCounts = new Map();
    for (const e of words) for (const k of new Set(e.chars)) charCounts.set(k, (charCounts.get(k) || 0) + 1);

    const next = [];
    const nextLinks = [];
    const getNode = (id, make) => {
      if (!nodeCache.has(id)) nodeCache.set(id, make());
      const n = nodeCache.get(id);
      next.push(n);
      return n;
    };

    for (const [k, count] of charCounts) {
      if (state.sharedOnly && count < 2) continue;
      const n = getNode("c:" + k, () => ({ id: "c:" + k, type: "char", char: charByKey.get(k) }));
      n.deg = count;
      n.r = 13 + 5 * Math.sqrt(count - 1);
    }
    const charIds = new Set(next.map((n) => n.id));
    for (const e of words) {
      const n = getNode("w:" + e.id, () => ({ id: "w:" + e.id, type: "word", entry: e, w: wordWidth(e) }));
      n.r = n.w / 2;
      for (const k of new Set(e.chars)) {
        if (charIds.has("c:" + k)) nextLinks.push({ source: n.id, target: "c:" + k });
      }
    }

    adjacency = new Map(next.map((n) => [n.id, new Set()]));
    for (const l of nextLinks) {
      adjacency.get(l.source).add(l.target);
      adjacency.get(l.target).add(l.source);
    }
    return { next, nextLinks };
  }

  function updateGraph({ refit = false, initial = false } = {}) {
    const { next, nextLinks } = buildGraphData();
    nodes = next;
    links = nextLinks;

    linkLayer.selectAll("line").data(links, (d) => `${d.source.id || d.source}-${d.target.id || d.target}`)
      .join("line").attr("class", "link");

    const sel = nodeLayer.selectAll("g.node").data(nodes, (d) => d.id).join((enter) => {
      const g = enter.append("g")
        .attr("class", (d) => `node ${d.type}-node${d.entry?.falseFriend ? " ff" : ""}`)
        .attr("tabindex", 0)
        .attr("role", "button")
        .attr("aria-label", (d) => d.type === "word"
          ? `${d.entry.ko} ${d.entry.kanji}: ${meaningOf(d.entry)}`
          : `Character ${d.char.key}`);
      g.filter((d) => d.type === "word").each(function (d) { drawWord(d3.select(this), d.entry, d.w); });
      g.filter((d) => d.type === "char").each(function (d) { drawChar(d3.select(this), d.char); });
      g.call(drag)
        .on("click", (ev, d) => { ev.stopPropagation(); select(toRef(d)); })
        .on("keydown", (ev, d) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); select(toRef(d)); } })
        .on("mouseenter", (ev, d) => { state.hover = toRef(d); applyHighlight(); showTooltip(ev, d); })
        .on("mousemove", (ev, d) => showTooltip(ev, d))
        .on("mouseleave", () => { state.hover = null; applyHighlight(); hideTooltip(); });
      return g;
    });

    // Character size depends on how many visible words use it.
    sel.filter((d) => d.type === "char").each(function (d) {
      const g = d3.select(this);
      g.select("circle").attr("r", d.r);
      g.select(".glyph").attr("font-size", d.r * 1.1);
      g.select(".variant").attr("x", d.r * 0.78).attr("y", -d.r * 0.72);
    });

    emptyMsg.style("display", nodes.length ? "none" : null);
    const { width, height } = svg.node().getBoundingClientRect();
    emptyMsg.attr("x", width / 2).attr("y", height / 2);

    simulation.nodes(nodes);
    simulation.force("link").links(links);

    if (initial) {
      simulation.alpha(1);
      for (let i = 0; i < 320; i++) simulation.tick();
      ticked();
      fit(false);
      simulation.alpha(0);
    } else {
      // Seed new nodes near a neighbour so they don't fly in from the origin.
      for (const n of nodes) {
        if (n.x === undefined) {
          const nb = [...adjacency.get(n.id)].map((id) => nodeCache.get(id)).find((m) => m.x !== undefined);
          n.x = (nb?.x ?? 0) + (Math.random() - 0.5) * 40;
          n.y = (nb?.y ?? 0) + (Math.random() - 0.5) * 40;
        }
      }
      refitOnEnd = refit;
      simulation.alpha(0.7).restart();
    }
    applyHighlight();
  }

  function drawWord(g, e, w) {
    const color = catColor(e.category);
    g.append("rect").attr("class", "box")
      .attr("x", -w / 2).attr("y", -WORD_H / 2).attr("width", w).attr("height", WORD_H).attr("rx", 8)
      .attr("stroke", color);
    g.append("rect").attr("class", "tint")
      .attr("x", -w / 2).attr("y", -WORD_H / 2).attr("width", w).attr("height", WORD_H).attr("rx", 8)
      .attr("fill", color).attr("fill-opacity", 0.13).attr("pointer-events", "none");
    g.append("text").attr("class", "ko-t").attr("lang", "ko").attr("y", -10).text(e.ko);
    // Japanese with its hiragana reading drawn above the kanji.
    g.append("g").html(window.Furigana.svg(e.kanji, e.ja, { y: 18, fs: 13, rtSize: 7.5, cls: "ja-t", rtCls: "rt", parts: e.jaParts }));
    g.append("text").attr("class", "en-t").attr("y", WORD_H / 2 + 12)
      .text(e.falseFriend ? "false friend" : truncate(e.en.split(",")[0], 22));
  }

  function drawChar(g, c) {
    g.append("circle");
    g.append("text").attr("class", "glyph").attr("lang", "ja").text(c.key);
    if (c.hanja !== c.key) g.append("text").attr("class", "variant").attr("lang", "ko").text(c.hanja);
  }

  const truncate = (s, n) => (s.length > n ? s.slice(0, n - 1) + "…" : s);
  const toRef = (d) => d.type === "word" ? { type: "word", id: d.entry.id } : { type: "char", id: d.char.key };
  const nodeId = (ref) => ref && (ref.type === "word" ? "w:" + ref.id : "c:" + ref.id);

  function ticked() {
    linkLayer.selectAll("line")
      .attr("x1", (d) => d.source.x).attr("y1", (d) => d.source.y)
      .attr("x2", (d) => d.target.x).attr("y2", (d) => d.target.y);
    nodeLayer.selectAll("g.node").attr("transform", (d) => `translate(${d.x},${d.y})`);
  }

  const drag = d3.drag()
    .clickDistance(4)
    .on("start", (ev, d) => {
      if (!ev.active) simulation.alphaTarget(0.25).restart();
      d.fx = d.x; d.fy = d.y;
      hideTooltip();
    })
    .on("drag", (ev, d) => { d.fx = ev.x; d.fy = ev.y; })
    .on("end", (ev, d) => {
      if (!ev.active) simulation.alphaTarget(0);
      d.fx = null; d.fy = null;
    });

  function bounds(list) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const n of list) {
      const rx = n.type === "word" ? n.w / 2 : n.r;
      const ry = n.type === "word" ? WORD_H / 2 + 14 : n.r;
      x0 = Math.min(x0, n.x - rx); x1 = Math.max(x1, n.x + rx);
      y0 = Math.min(y0, n.y - ry); y1 = Math.max(y1, n.y + ry);
    }
    return { x0, y0, x1, y1 };
  }

  function fit(animate = true) {
    if (!nodes.length) return;
    const { width, height } = svg.node().getBoundingClientRect();
    if (!width || !height) { pendingFit = true; return; }
    pendingFit = false;
    const b = bounds(nodes);
    const pad = 30;
    const k = Math.min(2, Math.min((width - pad * 2) / (b.x1 - b.x0), (height - pad * 2) / (b.y1 - b.y0)));
    const t = d3.zoomIdentity
      .translate(width / 2, height / 2)
      .scale(k)
      .translate(-(b.x0 + b.x1) / 2, -(b.y0 + b.y1) / 2);
    (animate ? svg.transition().duration(600) : svg).call(zoom.transform, t);
  }

  function focusNode(id) {
    const n = nodeCache.get(id);
    if (!n || !nodes.includes(n) || state.view !== "map") return;
    const { width, height } = svg.node().getBoundingClientRect();
    const mobile = window.matchMedia("(max-width: 760px)").matches;
    const k = Math.max(d3.zoomTransform(svg.node()).k, 1.1);
    const cy = mobile ? height * 0.22 : height / 2;
    svg.transition().duration(550)
      .call(zoom.transform, d3.zoomIdentity.translate(width / 2, cy).scale(k).translate(-n.x, -n.y));
  }

  $("#zoom-in").addEventListener("click", () => svg.transition().duration(250).call(zoom.scaleBy, 1.35));
  $("#zoom-out").addEventListener("click", () => svg.transition().duration(250).call(zoom.scaleBy, 1 / 1.35));
  $("#zoom-reset").addEventListener("click", () => fit(true));

  // Highlight: hover beats selection, selection beats search matches.
  function applyHighlight() {
    const strong = new Set();
    const context = new Set();
    const hiLinks = new Set();
    const focus = state.hover || state.selected;
    const focusId = nodeId(focus);

    if (focus && adjacency.has(focusId)) {
      strong.add(focusId);
      for (const nb of adjacency.get(focusId)) {
        strong.add(nb);
        hiLinks.add(focusId + "|" + nb);
      }
      for (const id of strong) {
        context.add(id);
        for (const nb2 of adjacency.get(id)) context.add(nb2);
      }
    } else if (state.query) {
      for (const n of nodes) {
        if (matchesQuery(n)) {
          strong.add(n.id);
          context.add(n.id);
          for (const nb of adjacency.get(n.id)) context.add(nb);
        }
      }
    }

    const active = context.size > 0;
    nodeLayer.selectAll("g.node")
      .classed("dim", (d) => active && !context.has(d.id))
      .classed("selected", (d) => d.id === nodeId(state.selected))
      .classed("match", (d) => !focus && !!state.query && strong.has(d.id));
    linkLayer.selectAll("line")
      .classed("hi", (d) => hiLinks.has(d.source.id + "|" + d.target.id) || hiLinks.has(d.target.id + "|" + d.source.id))
      .classed("dim", (d) => active && !(context.has(d.source.id) && context.has(d.target.id) &&
        (strong.has(d.source.id) || strong.has(d.target.id))));
  }

  // ── Tooltip ───────────────────────────────────────────────────────
  const tooltip = $("#tooltip");
  function showTooltip(ev, d) {
    if (ev.buttons) return;
    let html;
    if (d.type === "word") {
      const e = d.entry;
      html = `<div class="tt-title"><span lang="ko">${esc(e.ko)}</span> · <span lang="ja">${ruby(e)}</span></div>
              <div class="tt-sub">${esc(e.koRom)} · ${esc(e.jaRom)}</div>
              <div>${esc(meaningOf(e))}</div>`;
    } else {
      const c = d.char;
      html = `<div class="tt-title"><span lang="ja">${esc(c.key)}</span>${c.hanja !== c.key ? ` <span lang="ko">(${esc(c.hanja)})</span>` : ""}</div>
              <div><span lang="ko">${c.koList.map(esc).join(", ")}</span> · <span lang="ja">${c.jaList.map(esc).join(", ")}</span></div>
              <div class="tt-sub">in ${d.deg} word${d.deg === 1 ? "" : "s"} shown</div>`;
    }
    tooltip.innerHTML = html;
    tooltip.hidden = false;
    const [x, y] = d3.pointer(ev, stageEl);
    const { width } = stageEl.getBoundingClientRect();
    const tw = tooltip.offsetWidth;
    tooltip.style.left = Math.min(x + 14, width - tw - 8) + "px";
    tooltip.style.top = y + 14 + "px";
  }
  const hideTooltip = () => { tooltip.hidden = true; };

  // ── Selection & detail panel ──────────────────────────────────────
  function select(ref, { focus = true } = {}) {
    state.selected = ref;
    if (ref?.type === "word") ensureVisible(wordById.get(ref.id));
    applyHighlight();
    renderDetail();
    renderList();
    updateHash();
    if (ref && focus) setTimeout(() => focusNode(nodeId(ref)), 30);
  }

  // If a word hidden by the filters is selected, relax the filters to show it.
  function ensureVisible(e) {
    if (!e || isWordVisible(e)) return;
    state.cats.add(e.category);
    if (state.falseOnly && !e.falseFriend) {
      state.falseOnly = false;
      $("#opt-false-friends").checked = false;
    }
    refresh({ keepDetail: true });
  }

  const detail = $("#detail");
  const detailBody = $("#detail-body");
  $("#detail-close").addEventListener("click", () => select(null));

  function renderDetail() {
    const ref = state.selected;
    if (!ref) { detail.hidden = true; return; }
    detail.hidden = false;
    detailBody.innerHTML = ref.type === "word" ? wordDetail(wordById.get(ref.id)) : charDetail(charByKey.get(ref.id));
    detail.scrollTop = 0;
  }

  function wordDetail(e) {
    const cat = CATEGORIES[e.category];
    const anyDiff = e.hanja !== e.kanji;
    const cols = e.chars.map((k, i) => `
      <button class="align-col" data-char="${esc(k)}" title="See every word with ${esc(k)}">
        <span class="a-ko" lang="ko">${esc(e.koChars[i])}</span>
        ${anyDiff ? `<span class="a-h ${e.hanjaChars[i] !== k ? "diff" : ""}" lang="ko">${esc(e.hanjaChars[i])}</span>` : ""}
        <span class="a-k" lang="ja">${esc(k)}</span>
        <span class="a-ja" lang="ja">${esc(e.jaParts[i])}</span>
      </button>`).join("");
    const legend = `<div class="align-legend" aria-hidden="true">
        <span class="h17">Korean</span>
        ${anyDiff ? `<span class="h24">Hanja</span><span class="h24">Kanji</span>` : `<span class="h24">Character</span>`}
        <span class="h14">Japanese</span></div>`;

    const related = relatedWords(e);
    const meaning = e.falseFriend
      ? `<div class="ff-box">
           <div><span class="who">In Korean</span><span>${esc(e.falseFriend.ko)}</span></div>
           <div><span class="who">In Japanese</span><span>${esc(e.falseFriend.ja)}</span></div>
         </div>`
      : `<p class="d-meaning">${esc(e.en)}</p>`;

    return `
      <div class="d-tags">
        <span class="tag"><span class="dot" style="background:${cat.color}"></span>${esc(cat.label)}</span>
        ${e.falseFriend ? `<span class="tag ff">⚠ False friend</span>` : ""}
      </div>
      <div class="d-pair">
        <div class="d-lang">
          <div class="lbl">Korean</div>
          <div class="big ko" lang="ko">${esc(e.ko)}</div>
          <div class="rom">${esc(e.koRom)}</div>
          ${speakBtn(e.ko, "ko-KR")}
        </div>
        <div class="d-lang">
          <div class="lbl">Japanese</div>
          <div class="big ja" lang="ja">${ruby(e)}</div>
          <div class="rom">${esc(e.jaRom)}</div>
          ${speakBtn(e.ja, "ja-JP")}
        </div>
      </div>
      ${meaning}
      <div class="d-section">Character by character</div>
      <div class="align">${legend}${cols}</div>
      ${e.note ? `<div class="d-note">${esc(e.note)}</div>` : ""}
      ${related.length ? `<div class="d-section">Words sharing a character (${related.length})</div>
        <div class="related">${related.map((r) => relatedBtn(r, new Set(e.chars))).join("")}</div>` : ""}`;
  }

  function relatedWords(e) {
    const mine = new Set(e.chars);
    return WORDS.filter((o) => o !== e && o.chars.some((k) => mine.has(k)))
      .map((o) => ({ o, n: o.chars.filter((k) => mine.has(k)).length }))
      .sort((a, b) => b.n - a.n || a.o.ko.localeCompare(b.o.ko, "ko"))
      .map((x) => x.o);
  }

  function relatedBtn(o, markChars) {
    const ko = o.koChars.map((s, i) => markChars.has(o.chars[i]) ? `<mark>${esc(s)}</mark>` : esc(s)).join("");
    const ja = o.chars.map((k) => markChars.has(k) ? `<mark>${esc(k)}</mark>` : esc(k)).join("");
    return `<button data-word="${esc(o.id)}" title="${esc(meaningOf(o))}">
      <span class="r-ko" lang="ko">${ko}</span><span class="r-ja" lang="ja">${ja}</span></button>`;
  }

  function charDetail(c) {
    const diff = c.hanja !== c.key;
    return `
      <div class="d-tags"><span class="tag">Character</span></div>
      <div class="char-hero">
        <div class="glyph" lang="ja">${esc(c.key)}</div>
        <div class="variant-note">${diff
          ? `Korean uses the traditional form <span class="h" lang="ko">${esc(c.hanja)}</span>; Japanese uses the simplified form ${esc(c.key)}.`
          : `Written the same way in Korean and Japanese.`}
          <br>Appears in ${c.words.length} word${c.words.length === 1 ? "" : "s"} on this map.</div>
      </div>
      <div class="d-section">Readings in these words</div>
      <div class="readings">
        <div class="d-lang"><div class="lbl">Korean</div>
          <div class="big ko" lang="ko">${c.koList.map(esc).join(" · ")}</div>
          ${speakBtn(c.koList[0], "ko-KR")}</div>
        <div class="d-lang"><div class="lbl">Japanese</div>
          <div class="big ja" lang="ja">${c.jaList.map(esc).join(" · ")}</div>
          ${speakBtn(c.jaList[0], "ja-JP")}</div>
      </div>
      ${c.jaList.length > 1 || c.koList.length > 1 ? `<div class="d-note">Readings shift inside words: Japanese doubles consonants (がく → がっこう) and voices them (こく → ちゅうごく); Korean drops initial ㄹ/ㄴ at the start of a word (력 → 역사).</div>` : ""}
      <div class="d-section">Words with ${esc(c.key)}</div>
      <div class="related">${c.words.map((o) => relatedBtn(o, new Set([c.key]))).join("")}</div>`;
  }

  detailBody.addEventListener("click", (ev) => {
    const say = ev.target.closest("[data-say]");
    if (say) return speak(say.dataset.say, say.dataset.lang);
    const ch = ev.target.closest("[data-char]");
    if (ch) return select({ type: "char", id: ch.dataset.char });
    const wd = ev.target.closest("[data-word]");
    if (wd) return select({ type: "word", id: wd.dataset.word });
  });

  // ── Search ────────────────────────────────────────────────────────
  const searchInput = $("#search");
  const resultsEl = $("#search-results");
  let results = [];
  let activeResult = 0;

  function matchesQuery(n) {
    const q = fold(state.query);
    if (!q) return false;
    if (n.type === "word") return n.entry.search.includes(q);
    const c = n.char;
    return q === c.key || q === c.hanja || c.koList.includes(q) || c.jaList.includes(q);
  }

  function computeResults(q) {
    const f = fold(q);
    if (!f) return [];
    const out = [];
    for (const c of charByKey.values()) {
      if (c.koList.includes(q) || c.jaList.includes(q)) out.push({ type: "char", id: c.key, score: 0 });
    }
    for (const ch of [...q]) {
      const c = charByKey.get(ch) || [...charByKey.values()].find((x) => x.hanja === ch);
      if (c && !out.some((r) => r.type === "char" && r.id === c.key)) out.push({ type: "char", id: c.key, score: 0 });
    }
    for (const e of WORDS) {
      if (!e.search.includes(f)) continue;
      const exact = [e.ko, e.kanji, e.hanja, e.ja, e.koRom, e.jaRom].map(fold).includes(f) || fold(e.en) === f;
      const starts = e.search.split(/[\s,]+/).some((t) => t.startsWith(f));
      out.push({ type: "word", id: e.id, score: exact ? 1 : starts ? 2 : 3 });
    }
    return out.sort((a, b) => a.score - b.score).slice(0, 12);
  }

  function renderResults() {
    if (!state.query) { resultsEl.hidden = true; return; }
    resultsEl.hidden = false;
    if (!results.length) {
      resultsEl.innerHTML = `<li class="empty">No matches</li>`;
      return;
    }
    resultsEl.innerHTML = results.map((r, i) => {
      if (r.type === "char") {
        const c = charByKey.get(r.id);
        return `<li role="option" data-i="${i}" aria-selected="${i === activeResult}">
          <span class="sr-main" lang="ja">${esc(c.key)}${c.hanja !== c.key ? ` <span lang="ko">${esc(c.hanja)}</span>` : ""}</span>
          <span class="sr-sub">character · ${c.words.length} words</span></li>`;
      }
      const e = wordById.get(r.id);
      return `<li role="option" data-i="${i}" aria-selected="${i === activeResult}">
        <span class="sr-main"><span lang="ko">${esc(e.ko)}</span> · <span lang="ja">${ruby(e)}</span></span>
        <span class="sr-sub">${esc(truncate(meaningOf(e), 40))}</span></li>`;
    }).join("");
  }

  function pickResult(i) {
    const r = results[i];
    if (!r) return;
    resultsEl.hidden = true;
    searchInput.blur();
    if (state.view === "sounds") setView("map");
    select({ type: r.type, id: r.id });
  }

  searchInput.addEventListener("input", () => {
    state.query = searchInput.value.trim();
    results = computeResults(state.query);
    activeResult = 0;
    renderResults();
    applyHighlight();
    renderList();
  });
  searchInput.addEventListener("keydown", (ev) => {
    if (ev.key === "ArrowDown" || ev.key === "ArrowUp") {
      ev.preventDefault();
      if (!results.length) return;
      activeResult = (activeResult + (ev.key === "ArrowDown" ? 1 : -1) + results.length) % results.length;
      renderResults();
    } else if (ev.key === "Enter") {
      pickResult(activeResult);
    } else if (ev.key === "Escape") {
      searchInput.value = "";
      searchInput.dispatchEvent(new Event("input"));
      searchInput.blur();
    }
  });
  searchInput.addEventListener("focus", renderResults);
  searchInput.addEventListener("blur", () => setTimeout(() => { resultsEl.hidden = true; }, 150));
  resultsEl.addEventListener("mousedown", (ev) => {
    const li = ev.target.closest("li[data-i]");
    if (li) { ev.preventDefault(); pickResult(+li.dataset.i); }
  });
  document.addEventListener("keydown", (ev) => {
    if (ev.key === "/" && document.activeElement !== searchInput && !$("#about").open) {
      ev.preventDefault();
      searchInput.focus();
    } else if (ev.key === "Escape" && document.activeElement !== searchInput && state.selected && !$("#about").open) {
      select(null);
    }
  });

  // ── List view ─────────────────────────────────────────────────────
  function renderList() {
    if (state.view !== "list") return;
    const q = fold(state.query);
    const words = visibleWords().filter((e) => !q || e.search.includes(q));
    if (!words.length) {
      $("#word-list").innerHTML = `<p class="empty-state">No words match.</p>`;
      return;
    }
    const sel = state.selected?.type === "word" ? state.selected.id : null;
    $("#word-list").innerHTML = Object.entries(CATEGORIES).map(([key, cat]) => {
      const group = words.filter((e) => e.category === key);
      if (!group.length) return "";
      return `<section class="list-group">
        <h3><span class="dot" style="background:${cat.color}"></span>${esc(cat.label)}</h3>
        <div class="cards">${group.map((e) => `
          <button class="card${e.falseFriend ? " ff" : ""}${e.id === sel ? " selected" : ""}" data-word="${esc(e.id)}" style="--cat:${cat.color}">
            <span class="c-ko" lang="ko">${esc(e.ko)}</span>
            <span class="c-ja" lang="ja">${ruby(e)}<small>${esc(e.jaRom)}</small></span>
            ${e.falseFriend ? `<span class="ff-tag">False friend</span>` : `<span class="c-en">${esc(e.en)}</span>`}
          </button>`).join("")}</div></section>`;
    }).join("");
  }
  $("#word-list").addEventListener("click", (ev) => {
    const card = ev.target.closest("[data-word]");
    if (card) select({ type: "word", id: card.dataset.word }, { focus: false });
  });

  // ── Sound patterns view ───────────────────────────────────────────
  const FINALS = [
    { idx: 0, jamo: "∅", title: "No final consonant",
      rule: "Open syllables usually match one Japanese syllable or a long vowel: 家 가 → か, 午 오 → ご, 数 수 → すう." },
    { idx: 1, jamo: "ㄱ", title: "Final -k",
      rule: "→ く (ku) or き (ki), and often っ before another consonant: 学 학 → がく / がっ, 食 식 → しょく." },
    { idx: 4, jamo: "ㄴ", title: "Final -n",
      rule: "→ ん (n): 文 문 → ぶん, 電 전 → でん." },
    { idx: 8, jamo: "ㄹ", title: "Final -l",
      rule: "Middle Chinese -t became Korean ㄹ and Japanese つ (tsu) or ち (chi): 結 결 → けつ, 日 일 → にち, 物 물 → ぶつ." },
    { idx: 16, jamo: "ㅁ", title: "Final -m",
      rule: "→ ん (n), because Japanese merged -m into -n: 心 심 → しん, 音 음 → おん." },
    { idx: 17, jamo: "ㅂ", title: "Final -p",
      rule: "→ う (u), from an older ふ (fu), or っ: 入 입 → にゅう, 法 법 → ほう, 雑 잡 → ざっ." },
    { idx: 21, jamo: "ㅇ", title: "Final -ng",
      rule: "→ う (u) or い (i), often as a long vowel: 生 생 → せい, 東 동 → とう, 兄 형 → きょう." },
  ];
  const finalIndex = (syl) => {
    const code = syl.charCodeAt(0) - 0xac00;
    return code >= 0 && code < 11172 ? code % 28 : -1;
  };

  function renderSounds() {
    const visible = new Set(visibleWords());
    const chars = [...charByKey.values()].filter((c) => c.words.some((e) => visible.has(e)));
    const groups = FINALS.map((f) => ({ ...f, chars: [] }));
    const other = { jamo: "…", title: "Other", rule: "", chars: [] };
    for (const c of chars) {
      const g = groups.find((x) => x.idx === finalIndex(c.koList[0])) || other;
      g.chars.push(c);
    }
    if (other.chars.length) groups.push(other);
    for (const g of groups) g.chars.sort((a, b) => b.words.length - a.words.length);

    $("#sound-groups").innerHTML = groups.filter((g) => g.chars.length).map((g) => `
      <article class="sound-card">
        <h3><span class="jamo" lang="ko">${g.jamo}</span>${esc(g.title)} <small class="count">(${g.chars.length})</small></h3>
        <p class="rule">${esc(g.rule)}</p>
        <div class="sound-chips">${g.chars.map((c) => `
          <button class="sound-chip" data-char="${esc(c.key)}" title="${c.words.length} word(s)">
            <span class="k" lang="ja">${esc(c.key)}</span>
            <span class="r-ko" lang="ko">${c.koList.map(esc).join("·")}</span>
            <span class="r-ja" lang="ja">${c.jaList.map(esc).join("·")}</span>
          </button>`).join("")}</div>
      </article>`).join("");
  }
  $("#sound-groups").addEventListener("click", (ev) => {
    const chip = ev.target.closest("[data-char]");
    if (!chip) return;
    setView("map");
    select({ type: "char", id: chip.dataset.char });
  });

  // ── Views, hash, refresh ──────────────────────────────────────────
  function setView(view) {
    state.view = view;
    document.querySelectorAll(".tab").forEach((t) => t.setAttribute("aria-selected", t.dataset.view === view));
    document.querySelectorAll(".view").forEach((v) => v.classList.toggle("active", v.id === "view-" + view));
    if (view === "list") renderList();
    if (view === "sounds") renderSounds();
    if (view === "map" && pendingFit) requestAnimationFrame(() => fit(false));
  }
  document.querySelectorAll(".tab").forEach((t) => t.addEventListener("click", () => setView(t.dataset.view)));

  function updateHash() {
    const ref = state.selected;
    const url = ref
      ? `#${ref.type === "word" ? "w" : "c"}=${encodeURIComponent(ref.id)}`
      : location.pathname + location.search;
    history.replaceState(null, "", url);
  }
  function readHash() {
    const m = location.hash.match(/^#([wc])=(.+)$/);
    if (!m) return null;
    const id = decodeURIComponent(m[2]);
    if (m[1] === "w" && wordById.has(id)) return { type: "word", id };
    if (m[1] === "c" && charByKey.has(id)) return { type: "char", id };
    return null;
  }

  function renderStats() {
    const words = visibleWords();
    const chars = new Set(words.flatMap((e) => e.chars));
    const ff = words.filter((e) => e.falseFriend).length;
    $("#stats").innerHTML = `Showing <strong>${words.length}</strong> of ${WORDS.length} word pairs,
      <strong>${chars.size}</strong> characters, and <strong>${ff}</strong> false friends.`;
  }

  function refresh({ refit = false, keepDetail = false } = {}) {
    renderChips();
    renderStats();
    updateGraph({ refit });
    renderList();
    if (state.view === "sounds") renderSounds();
    if (!keepDetail) renderDetail();
  }

  $("#about-btn").addEventListener("click", () => $("#about").showModal());
  $("#about").addEventListener("click", (ev) => { if (ev.target === ev.currentTarget) ev.currentTarget.close(); });

  let resizeTimer;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => fit(false), 150);
  });

  // ── Boot ──────────────────────────────────────────────────────────
  renderChips();
  renderStats();
  updateGraph({ initial: true });
  const fromHash = readHash();
  if (fromHash) select(fromHash);
  window.addEventListener("hashchange", () => { const r = readHash(); if (r) select(r); });
})();
