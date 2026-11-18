/* Curated Korean → Japanese mappings (dictionary page: Mappings, Network and List tabs). */
(() => {
  "use strict";

  const M = window.LANGUAGE_MAP_MODEL;
  const { CATEGORIES, KINDS, ORIGINS, NOT_TRANSLATION, koWords, jaWords, links, bands, chars } = M;
  const F = window.Furigana;
  // Japanese word with hiragana over its kanji.
  const jr = (w) => (w.lang === "ja" && !w.pseudo ? F.html(w.text, w.kana) : esc(w.label));

  const $ = (sel) => document.querySelector(sel);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fold = (s) => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const truncate = (s, n) => (s.length > n ? s.slice(0, Math.max(1, n - 1)) + "…" : s);
  const uniq = (arr) => [...new Set(arr)];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const cjkLen = (s) => [...s].length;

  // ── State ─────────────────────────────────────────────────────────
  const state = {
    view: document.body.dataset.view || "mapping",
    dir: "ko2ja",
    cats: new Set(Object.keys(CATEGORIES)),
    kinds: new Set(Object.keys(KINDS)),
    onlyBroken: false,
    showChars: true,
    selected: null, // { type: "ko" | "ja" | "char", id }
    hover: null,
    query: "",
  };

  const wordOf = (ref) => ref && (ref.type === "ko" ? koWords.get(ref.id) : ref.type === "ja" ? jaWords.get(ref.id) : null);
  const nodeId = (ref) => ref && ({ ko: "k:", ja: "j:", char: "c:" }[ref.type] + ref.id);
  const refOfWord = (w) => ({ type: w.lang, id: w.key });

  const isTranslation = (l) => !NOT_TRANSLATION.has(l.kind);
  const isBroken = (l) => isTranslation(l) && l.tr.type !== "1:1";
  const linkVisible = (l) =>
    state.cats.has(l.band.category) && state.kinds.has(l.kind) && (!state.onlyBroken || isBroken(l));
  const visibleLinks = () => links.filter(linkVisible);

  // Direction-aware description of a translation component.
  function mapping(comp) {
    const a = comp.ko.size, b = comp.ja.size;
    const [from, to] = state.dir === "ko2ja" ? [a, b] : [b, a];
    if (from === 1 && to === 1) return { short: "1 ↔ 1", long: "one-to-one", cls: "ok" };
    if (from === 1) return { short: `1 → ${to}`, long: "split", cls: "split" };
    if (to === 1) return { short: `${from} → 1`, long: "merge", cls: "merge" };
    return { short: `${from} → ${to}`, long: "many-to-many", cls: "many" };
  }

  // Arrowheads: both ends for one-to-one, otherwise only in the chosen direction.
  // Paths always run from the Korean word to the Japanese word.
  function markers(l) {
    if (l.kind === "none") {
      const m = "url(#m-none)";
      return l.ja.pseudo ? `marker-end="${m}"` : `marker-start="${m}"`;
    }
    if (!isTranslation(l)) return "";
    const m = `url(#m-${l.kind})`;
    if (l.tr.type === "1:1") return `marker-start="${m}" marker-end="${m}"`;
    return state.dir === "ko2ja" ? `marker-end="${m}"` : `marker-start="${m}"`;
  }

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
  const sayText = (w) => w.lang === "ko" ? w.text : w.kana;
  const sayLang = (w) => w.lang === "ko" ? "ko-KR" : "ja-JP";

  // ── Markers & static legends ──────────────────────────────────────
  $("#marker-defs").innerHTML = Object.entries(KINDS).map(([k, v]) =>
    `<marker id="m-${k}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7"
       markerUnits="userSpaceOnUse" orient="auto-start-reverse">
       <path d="M0,0 L10,5 L0,10 z" fill="${v.color}"/></marker>`).join("");

  const dash = (k) => ({ false: "4 3", approx: "2 3", none: "6 3" }[k] || "");
  const kindSwatch = (k) => `<svg class="swatch" viewBox="0 0 26 10" aria-hidden="true">
      <line x1="1" y1="5" x2="25" y2="5" stroke="${KINDS[k].color}" stroke-width="2.5" ${dash(k) ? `stroke-dasharray="${dash(k)}"` : ""}/></svg>`;
  $("#kind-legend").innerHTML = Object.keys(KINDS).map((k) =>
    `<span class="kl" title="${esc(KINDS[k].desc)}">${kindSwatch(k)}${esc(KINDS[k].label)}</span>`).join("");
  $("#about-kinds").innerHTML = Object.keys(KINDS).map((k) =>
    `<li>${kindSwatch(k)} <strong>${esc(KINDS[k].label)}:</strong> ${esc(KINDS[k].desc)}</li>`).join("");

  // ── Filters UI ────────────────────────────────────────────────────
  function renderChips() {
    const catCount = {}, kindCount = {};
    for (const l of links) {
      catCount[l.band.category] = (catCount[l.band.category] || 0) + 1;
      kindCount[l.kind] = (kindCount[l.kind] || 0) + 1;
    }
    const allOn = state.cats.size === Object.keys(CATEGORIES).length;
    $("#category-chips").innerHTML =
      `<button class="chip chip-all" data-cat="*" aria-pressed="${allOn}">All</button>` +
      Object.entries(CATEGORIES).map(([key, c]) =>
        `<button class="chip" data-cat="${key}" aria-pressed="${state.cats.has(key)}" title="Click to toggle. Double-click to show only this category.">
           <span class="dot" style="background:${c.color}"></span>${esc(c.label)}<span class="count">${catCount[key] || 0}</span>
         </button>`).join("");
    $("#kind-chips").innerHTML = Object.entries(KINDS).map(([key, k]) =>
      `<button class="chip kind-chip" data-kind="${key}" aria-pressed="${state.kinds.has(key)}" title="${esc(k.desc)}">
         ${kindSwatch(key)}${esc(k.label)}<span class="count">${kindCount[key] || 0}</span></button>`).join("");
    document.querySelectorAll("[data-dir]").forEach((b) => b.setAttribute("aria-pressed", b.dataset.dir === state.dir));
  }

  let chipTimer = null;
  $("#category-chips").addEventListener("click", (ev) => {
    const btn = ev.target.closest(".chip");
    if (!btn) return;
    clearTimeout(chipTimer);
    if (ev.detail > 1) return; // second click of a double-click, handled below
    const cat = btn.dataset.cat;
    chipTimer = setTimeout(() => {
      if (cat === "*") state.cats = new Set(Object.keys(CATEGORIES));
      else if (state.cats.has(cat)) state.cats.delete(cat);
      else state.cats.add(cat);
      refresh({ refit: true });
    }, cat === "*" ? 0 : 200);
  });
  $("#category-chips").addEventListener("dblclick", (ev) => {
    const btn = ev.target.closest(".chip");
    if (!btn || btn.dataset.cat === "*") return;
    clearTimeout(chipTimer);
    state.cats = new Set([btn.dataset.cat]);
    refresh({ refit: true });
  });
  $("#kind-chips").addEventListener("click", (ev) => {
    const btn = ev.target.closest("[data-kind]");
    if (!btn) return;
    const k = btn.dataset.kind;
    if (state.kinds.has(k)) state.kinds.delete(k); else state.kinds.add(k);
    refresh({ refit: true });
  });
  document.querySelectorAll("[data-dir]").forEach((b) => b.addEventListener("click", () => {
    state.dir = b.dataset.dir;
    refresh();
  }));
  $("#opt-broken").addEventListener("change", (e) => { state.onlyBroken = e.target.checked; refresh({ refit: true }); });
  $("#opt-chars").addEventListener("change", (e) => { state.showChars = e.target.checked; refresh({ refit: true }); });

  // ── Mapping view (function diagrams per category) ─────────────────
  const mappingHost = $("#mapping-sections");

  function bandLayout(bandLinks) {
    const koList = uniq(bandLinks.map((l) => l.ko));
    const jaFirst = uniq(bandLinks.map((l) => l.ja));
    // Order Japanese words by the average position of their Korean sources to reduce crossings.
    const koIdx = new Map(koList.map((w, i) => [w, i]));
    const bary = (j) => {
      const ls = bandLinks.filter((l) => l.ja === j);
      return ls.reduce((s, l) => s + koIdx.get(l.ko), 0) / ls.length;
    };
    const jaList = jaFirst.map((j, i) => ({ j, i, b: bary(j) }))
      .sort((p, q) => p.b - q.b || p.i - q.i).map((x) => x.j);
    return { koList, jaList, rows: Math.max(koList.length, jaList.length) };
  }

  function renderMapping() {
    if (state.view !== "mapping") return;
    const W = Math.round(clamp(mappingHost.clientWidth, 300, 900));
    const colW = Math.round(clamp((W - 150) / 2, 104, 190));
    const pillW = colW - 20;
    const xKo = 10, xJa = W - colW + 10;              // pill left edges
    const aKo = xKo + pillW, aJa = xJa;               // arrow anchor x
    const ROW = 56, PH = 46, TOP = 44, BOT = 12;
    const gapChars = Math.floor((aJa - aKo - 16) / 6.2);

    const sections = [];
    for (const [key, cat] of Object.entries(CATEGORIES)) {
      if (!state.cats.has(key)) continue;
      const groups = bands.filter((b) => b.category === key)
        .map((b) => ({ b, links: b.links.filter(linkVisible) }))
        .filter((g) => g.links.length);
      if (!groups.length) continue;

      let y = TOP;
      const pos = new Map();
      let svgBands = "", svgLinks = "", svgNodes = "";
      const kos = new Set(), jas = new Set(), comps = new Set();

      groups.forEach((g, gi) => {
        const { koList, jaList, rows } = bandLayout(g.links);
        const h = rows * ROW;
        koList.forEach((w, i) => pos.set("k:" + w.key, y + ((rows - koList.length) / 2 + i + 0.5) * ROW));
        jaList.forEach((w, i) => pos.set("j:" + w.key, y + ((rows - jaList.length) / 2 + i + 0.5) * ROW));
        koList.forEach((w) => kos.add(w));
        jaList.forEach((w) => jas.add(w));

        const broken = uniq(g.links.filter(isBroken).map((l) => l.tr));
        g.links.forEach((l) => { if (isTranslation(l)) comps.add(l.tr); });
        if (broken.length) {
          const labels = uniq(broken.map((c) => mapping(c).short)).join(" · ");
          svgBands += `<rect class="band-bg ${mapping(broken[0]).cls}" x="2" y="${y + 2}" width="${W - 4}" height="${h - 4}" rx="10"/>
            <text class="band-badge" x="${aKo + 10}" y="${y + 14}">${esc(labels)}</text>`;
        } else if (gi > 0) {
          svgBands += `<line class="band-sep" x1="${xKo + 8}" x2="${W - 18}" y1="${y}" y2="${y}"/>`;
        }

        for (const l of g.links) {
          const y1 = pos.get("k:" + l.ko.key), y2 = pos.get("j:" + l.ja.key);
          const dx = (aJa - aKo) * 0.45;
          const color = KINDS[l.kind].color;
          const gloss = l.kind === "false" ? "≠ looks the same" : l.kind === "approx" ? "≈ " + l.en : l.kind === "none" ? "no equivalent" : l.en;
          svgLinks += `<g class="m-link kind-${l.kind}" data-k="${esc(l.ko.key)}" data-j="${esc(l.ja.key)}">
            <path d="M${aKo + 2},${y1} C${aKo + dx},${y1} ${aJa - dx},${y2} ${aJa - 2},${y2}"
              stroke="${color}" ${dash(l.kind) ? `stroke-dasharray="${dash(l.kind)}"` : ""} ${markers(l)}/>
            <text class="gloss" x="${(aKo + aJa) / 2}" y="${(y1 + y2) / 2 - 4}">${esc(truncate(gloss, gapChars))}</text>
          </g>`;
        }
        y += h;
      });

      const pill = (w, x, yc) => {
        const main = w.label;
        const fs = Math.min(15, (pillW - 14) / Math.max(1, cjkLen(main) * 1.02));
        const id = `${w.lang === "ko" ? "k" : "j"}:${w.key}`;
        const sel = state.selected && nodeId(state.selected) === id;
        const cls = `m-node ${w.lang}${sel ? " selected" : ""}${w.pseudo ? " pseudo" : ""}`;
        const sub = truncate(w.pseudo ? "no equivalent" : w.rom, Math.floor(pillW / 6.3));
        // Japanese: hiragana above the kanji, romanization below. Korean: word and romanization.
        const mainSvg = w.lang === "ja" && !w.pseudo
          ? F.svg(main, w.kana, { x: pillW / 2, y: 27, fs: +fs.toFixed(1), rtSize: 8.5, cls: "main", rtCls: "rt" })
          : `<text class="main" x="${pillW / 2}" y="${w.pseudo ? 29 : 22}" font-size="${w.pseudo ? 18 : fs.toFixed(1)}" lang="${w.lang}">${esc(main)}</text>`;
        return `<g class="${cls}" data-node="${esc(id)}" ${w.pseudo ? 'data-pseudo="1"' : 'tabindex="0" role="button"'}
                   aria-label="${esc(w.pseudo ? "no equivalent" : w.label)}" transform="translate(${x},${yc - PH / 2})">
          <rect width="${pillW}" height="${PH}" rx="9"/>
          ${mainSvg}
          ${w.pseudo ? "" : `<text class="sub" x="${pillW / 2}" y="${w.lang === "ja" ? 41 : 38}" lang="${w.lang}">${esc(sub)}</text>`}
        </g>`;
      };
      for (const w of kos) svgNodes += pill(w, xKo, pos.get("k:" + w.key));
      for (const w of jas) svgNodes += pill(w, xJa, pos.get("j:" + w.key));

      const H = y + BOT;
      const sets = `
        <rect class="set set-ko" x="1" y="4" width="${colW - 2}" height="${H - 6}" rx="16"/>
        <rect class="set set-ja" x="${W - colW + 1}" y="4" width="${colW - 2}" height="${H - 6}" rx="16"/>
        <text class="set-label" x="${colW / 2}" y="26" lang="ko">한국어</text>
        <text class="set-label" x="${W - colW / 2}" y="26" lang="ja">日本語</text>`;

      // Summary and bijection verdict.
      const noneCount = groups.reduce((s, g) => s + g.links.filter((l) => l.kind === "none").length, 0);
      const tally = { ok: 0, split: 0, merge: 0, many: 0 };
      for (const c of comps) tally[mapping(c).cls]++;
      const ffCount = groups.reduce((s, g) => s + g.links.filter((l) => l.kind === "false").length, 0);
      const bij = comps.size > 0 && tally.ok === comps.size && !noneCount;
      const parts = [];
      if (tally.ok) parts.push(`${tally.ok} one-to-one`);
      if (tally.split) parts.push(`${tally.split} split${tally.split > 1 ? "s" : ""}`);
      if (tally.merge) parts.push(`${tally.merge} merge${tally.merge > 1 ? "s" : ""}`);
      if (tally.many) parts.push(`${tally.many} many-to-many`);
      if (ffCount) parts.push(`${ffCount} false friend${ffCount > 1 ? "s" : ""}`);
      if (noneCount) parts.push(`${noneCount} with no equivalent`);

      sections.push(`
        <section class="map-section" id="sec-${key}">
          <header>
            <h3><span class="dot" style="background:${cat.color}"></span>${esc(cat.label)}</h3>
            ${comps.size || noneCount ? `<span class="verdict ${bij ? "yes" : "no"}">${bij ? "✓ Bijection" : noneCount ? "✗ Not a bijection: some words map to ∅" : "✗ Not a bijection"}</span>` : ""}
          </header>
          <p class="summary">${[...kos].filter((w) => !w.pseudo).length} Korean → ${[...jas].filter((w) => !w.pseudo).length} Japanese words · ${parts.join(" · ")}</p>
          <svg class="mapsvg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
            ${sets}${svgBands}<g class="links">${svgLinks}</g>${svgNodes}
          </svg>
        </section>`);
    }
    mappingHost.innerHTML = sections.join("") || `<p class="empty-state">No words match these filters.</p>`;
    applyMappingHighlight();
  }

  function mapFocus(svgEl, id) {
    svgEl.classList.toggle("focus", !!id);
    svgEl.querySelectorAll(".on").forEach((e) => e.classList.remove("on"));
    if (!id) return;
    const key = id.slice(2);
    const attr = id[0] === "k" ? "data-k" : "data-j";
    svgEl.querySelector(`.m-node[data-node="${CSS.escape(id)}"]`)?.classList.add("on");
    svgEl.querySelectorAll(`.m-link[${attr}="${CSS.escape(key)}"]`).forEach((l) => {
      l.classList.add("on");
      svgEl.querySelector(`.m-node[data-node="${CSS.escape("k:" + l.dataset.k)}"]`)?.classList.add("on");
      svgEl.querySelector(`.m-node[data-node="${CSS.escape("j:" + l.dataset.j)}"]`)?.classList.add("on");
    });
  }

  function applyMappingHighlight() {
    const id = state.selected && state.selected.type !== "char" ? nodeId(state.selected) : null;
    mappingHost.querySelectorAll(".mapsvg").forEach((svgEl) => {
      const has = id && svgEl.querySelector(`.m-node[data-node="${CSS.escape(id)}"]`);
      mapFocus(svgEl, has ? id : null);
      svgEl.querySelectorAll(".m-node").forEach((n) => n.classList.toggle("selected", n.dataset.node === id));
    });
  }

  mappingHost.addEventListener("mouseover", (ev) => {
    const n = ev.target.closest(".m-node");
    if (n) mapFocus(n.closest("svg"), n.dataset.node);
  });
  mappingHost.addEventListener("mouseout", (ev) => {
    const n = ev.target.closest(".m-node");
    if (n && !n.contains(ev.relatedTarget)) applyMappingHighlight();
  });
  const activateMapNode = (n) => {
    if (n.dataset.pseudo) return;
    const id = n.dataset.node;
    select({ type: id[0] === "k" ? "ko" : "ja", id: id.slice(2) }, { focus: false });
  };
  mappingHost.addEventListener("click", (ev) => {
    const n = ev.target.closest(".m-node");
    if (n) activateMapNode(n);
  });
  mappingHost.addEventListener("keydown", (ev) => {
    const n = ev.target.closest(".m-node");
    if (n && (ev.key === "Enter" || ev.key === " ")) { ev.preventDefault(); activateMapNode(n); }
  });

  function scrollMappingTo(ref) {
    const el = mappingHost.querySelector(`.m-node[data-node="${CSS.escape(nodeId(ref))}"]`);
    // On phones the detail sheet covers the lower half, so bring the word to the top instead.
    const mobile = window.matchMedia("(max-width: 760px)").matches;
    if (el) el.scrollIntoView({ block: mobile ? "start" : "center", behavior: "smooth" });
  }

  // ── Network view (force-directed graph) ───────────────────────────
  const svg = d3.select("#graph");
  const stageEl = $("#view-network");
  const zoomLayer = svg.append("g");
  const charLinkLayer = zoomLayer.append("g");
  const arrowLayer = zoomLayer.append("g");
  const nodeLayer = zoomLayer.append("g");
  const emptyMsg = svg.append("text").attr("text-anchor", "middle").attr("fill", "currentColor")
    .attr("opacity", 0.6).text("No words match these filters.").style("display", "none");

  const NODE_H = 44;
  const nodeCache = new Map();
  let nodes = [], arrows = [], charEdges = [], adjacency = new Map();
  let refitPending = false, needsFit = true;

  const zoom = d3.zoom().scaleExtent([0.1, 4]).on("zoom", (ev) => zoomLayer.attr("transform", ev.transform));
  svg.call(zoom).on("dblclick.zoom", null);
  svg.on("click", (ev) => { if (ev.target === svg.node()) select(null); });

  const simulation = d3.forceSimulation()
    .force("link", d3.forceLink().id((d) => d.id)
      .distance((l) => l.char ? 40 + l.source.r : 30 + (l.source.w + l.target.w) / 2).strength((l) => l.char ? 0.5 : 0.9))
    .force("charge", d3.forceManyBody().strength((d) => d.type === "char" ? -70 - 20 * d.deg : -90).distanceMax(320))
    .force("collide", d3.forceCollide().radius((d) => d.type === "char" ? d.r + 5 : d.w / 2 + 6).iterations(2))
    .force("x", d3.forceX((d) => d.type === "ko" ? -60 : d.type === "ja" ? 60 : 0).strength(0.07))
    .force("y", d3.forceY().strength(0.09))
    .on("tick", () => {
      ticked();
      if (refitPending && simulation.alpha() < 0.3) { refitPending = false; fit(true); }
    })
    .stop();

  function wordNodeWidth(w) {
    const kanaW = w.lang === "ja" ? cjkLen(w.kana || "") * 8 : 0;
    return Math.max(cjkLen(w.label) * 15, (w.rom || "").length * 6.2, kanaW) + 20;
  }

  function buildGraph() {
    const vis = visibleLinks();
    const next = [];
    const seen = new Set();
    const nextArrows = [];
    const nextChar = [];
    const get = (id, make) => {
      if (!nodeCache.has(id)) nodeCache.set(id, make());
      const n = nodeCache.get(id);
      if (!seen.has(id)) { seen.add(id); next.push(n); }
      return n;
    };
    for (const l of vis) {
      const k = get("k:" + l.ko.key, () => ({ id: "k:" + l.ko.key, type: "ko", word: l.ko, w: wordNodeWidth(l.ko), h: NODE_H }));
      const j = get("j:" + l.ja.key, () => ({ id: "j:" + l.ja.key, type: "ja", word: l.ja, w: wordNodeWidth(l.ja), h: NODE_H }));
      nextArrows.push({ id: "a" + l.id, source: k.id, target: j.id, link: l });
    }
    if (state.showChars) {
      const use = new Map(); // character → visible links using it
      for (const l of vis) {
        const cs = l.entry ? uniq(l.entry.chars) : l.sharedChar ? [l.sharedChar] : [];
        for (const c of cs) use.set(c, [...(use.get(c) || []), l]);
      }
      for (const [c, ls] of use) {
        if (ls.length < 2) continue; // only characters shared by two or more pairs
        const n = get("c:" + c, () => ({ id: "c:" + c, type: "char", char: chars.get(c) }));
        n.deg = ls.length;
        n.r = 12 + 4.5 * Math.sqrt(ls.length - 1);
        const ends = new Set();
        for (const l of ls) { ends.add("k:" + l.ko.key); ends.add("j:" + l.ja.key); }
        for (const e of ends) nextChar.push({ id: `${n.id}-${e}`, source: n.id, target: e, char: true });
      }
    }
    adjacency = new Map(next.map((n) => [n.id, new Set()]));
    for (const e of [...nextArrows, ...nextChar]) {
      adjacency.get(e.source).add(e.target);
      adjacency.get(e.target).add(e.source);
    }
    return { next, nextArrows, nextChar };
  }

  function updateGraph({ refit = false, initial = false } = {}) {
    const { next, nextArrows, nextChar } = buildGraph();
    nodes = next; arrows = nextArrows; charEdges = nextChar;

    charLinkLayer.selectAll("line").data(charEdges, (d) => d.id).join("line").attr("class", "clink");
    arrowLayer.selectAll("path").data(arrows, (d) => d.id).join("path")
      .attr("class", (d) => `arrow kind-${d.link.kind}`)
      .attr("stroke", (d) => KINDS[d.link.kind].color)
      .attr("stroke-dasharray", (d) => dash(d.link.kind) || null)
      .each(function (d) {
        this.removeAttribute("marker-start");
        this.removeAttribute("marker-end");
        for (const [, attr, val] of markers(d.link).matchAll(/(marker-\w+)="([^"]+)"/g)) this.setAttribute(attr, val);
      });

    const sel = nodeLayer.selectAll("g.node").data(nodes, (d) => d.id).join((enter) => {
      const g = enter.append("g")
        .attr("class", (d) => `node ${d.type}-node`)
        .attr("tabindex", 0).attr("role", "button")
        .attr("aria-label", (d) => d.type === "char" ? `Character ${d.char.key}` : d.word.label);
      g.filter((d) => d.type !== "char").each(function (d) { drawWord(d3.select(this), d); });
      g.filter((d) => d.type === "char").each(function (d) { drawChar(d3.select(this), d.char); });
      g.call(drag)
        .on("click", (ev, d) => { ev.stopPropagation(); if (!d.word?.pseudo) select(toRef(d)); })
        .on("keydown", (ev, d) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); select(toRef(d)); } })
        .on("mouseenter", (ev, d) => { if (d.word?.pseudo) return; state.hover = toRef(d); applyGraphHighlight(); showTooltip(ev, d); })
        .on("mousemove", (ev, d) => showTooltip(ev, d))
        .on("mouseleave", () => { state.hover = null; applyGraphHighlight(); hideTooltip(); });
      return g;
    });
    sel.filter((d) => d.type === "char").each(function (d) {
      const g = d3.select(this);
      g.select("circle").attr("r", d.r);
      g.select(".glyph").attr("font-size", d.r * 1.1);
      g.select(".variant").attr("x", d.r * 0.8).attr("y", -d.r * 0.72);
    });

    emptyMsg.style("display", nodes.length ? "none" : null);
    simulation.nodes(nodes);
    simulation.force("link").links([...arrows, ...charEdges]);

    if (initial) {
      simulation.alpha(1);
      for (let i = 0; i < 300; i++) simulation.tick();
      ticked();
      simulation.alpha(0);
      needsFit = true;
      if (state.view === "network") fit(false);
    } else {
      for (const n of nodes) {
        if (n.x === undefined) {
          const nb = [...adjacency.get(n.id)].map((id) => nodeCache.get(id)).find((m) => m.x !== undefined);
          n.x = (nb?.x ?? 0) + (Math.random() - 0.5) * 50;
          n.y = (nb?.y ?? 0) + (Math.random() - 0.5) * 50;
        }
      }
      if (state.view === "network") {
        refitPending = refit;
        simulation.alpha(0.7).restart();
      } else {
        simulation.alpha(0.7);
        for (let i = 0; i < 200; i++) simulation.tick();
        simulation.alpha(0);
        ticked();
        needsFit = true;
      }
    }
    applyGraphHighlight();
  }

  function drawWord(g, d) {
    const w = d.word;
    g.classed("pseudo", !!w.pseudo);
    g.append("rect").attr("class", "box")
      .attr("x", -d.w / 2).attr("y", -d.h / 2).attr("width", d.w).attr("height", d.h).attr("rx", 9);
    if (w.lang === "ja" && !w.pseudo) {
      g.append("g").html(F.svg(w.text, w.kana, { y: 5, fs: 14, rtSize: 8, cls: "main", rtCls: "rt" }));
      g.append("text").attr("class", "sub").attr("y", 17).text(w.rom);
    } else {
      g.append("text").attr("class", "main").attr("lang", w.lang).attr("y", w.pseudo ? 6 : -1).text(w.label);
      if (!w.pseudo) g.append("text").attr("class", "sub").attr("lang", w.lang).attr("y", 14).text(w.rom);
    }
  }

  function drawChar(g, c) {
    g.append("circle");
    g.append("text").attr("class", "glyph").attr("lang", "ja").text(c.key);
    if (c.hanja !== c.key) g.append("text").attr("class", "variant").attr("lang", "ko").text(c.hanja);
  }

  const toRef = (d) => d.type === "char" ? { type: "char", id: d.char.key } : refOfWord(d.word);

  // Point where the segment from `from` toward `to` meets the edge of `to`.
  function edgePoint(from, to) {
    const dx = from.x - to.x, dy = from.y - to.y;
    if (to.type === "char") {
      const len = Math.hypot(dx, dy) || 1;
      return [to.x + (dx / len) * (to.r + 3), to.y + (dy / len) * (to.r + 3)];
    }
    const hw = to.w / 2 + 3, hh = to.h / 2 + 3;
    const t = Math.min(hw / Math.abs(dx || 1e-6), hh / Math.abs(dy || 1e-6));
    return t >= 1 ? [to.x, to.y] : [to.x + dx * t, to.y + dy * t];
  }

  function ticked() {
    charLinkLayer.selectAll("line")
      .attr("x1", (d) => d.source.x).attr("y1", (d) => d.source.y)
      .attr("x2", (d) => d.target.x).attr("y2", (d) => d.target.y);
    arrowLayer.selectAll("path").attr("d", (d) => {
      const [x1, y1] = edgePoint(d.target, d.source);
      const [x2, y2] = edgePoint(d.source, d.target);
      return `M${x1},${y1}L${x2},${y2}`;
    });
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

  function fit(animate = true) {
    if (!nodes.length) return;
    const { width, height } = svg.node().getBoundingClientRect();
    if (!width || !height) { needsFit = true; return; }
    needsFit = false;
    emptyMsg.attr("x", width / 2).attr("y", height / 2);
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const n of nodes) {
      const rx = n.type === "char" ? n.r : n.w / 2, ry = n.type === "char" ? n.r : n.h / 2;
      x0 = Math.min(x0, n.x - rx); x1 = Math.max(x1, n.x + rx);
      y0 = Math.min(y0, n.y - ry); y1 = Math.max(y1, n.y + ry);
    }
    const pad = 30;
    const k = Math.min(2, (width - pad * 2) / (x1 - x0), (height - pad * 2) / (y1 - y0));
    const t = d3.zoomIdentity.translate(width / 2, height / 2).scale(k).translate(-(x0 + x1) / 2, -(y0 + y1) / 2);
    (animate ? svg.transition().duration(600) : svg).call(zoom.transform, t);
  }

  function focusNode(id) {
    const n = nodeCache.get(id);
    if (!n || !nodes.includes(n) || state.view !== "network") return;
    const { width, height } = svg.node().getBoundingClientRect();
    const mobile = window.matchMedia("(max-width: 760px)").matches;
    const k = Math.max(d3.zoomTransform(svg.node()).k, 1.1);
    svg.transition().duration(550).call(zoom.transform,
      d3.zoomIdentity.translate(width / 2, mobile ? height * 0.22 : height / 2).scale(k).translate(-n.x, -n.y));
  }

  $("#zoom-in").addEventListener("click", () => svg.transition().duration(250).call(zoom.scaleBy, 1.35));
  $("#zoom-out").addEventListener("click", () => svg.transition().duration(250).call(zoom.scaleBy, 1 / 1.35));
  $("#zoom-reset").addEventListener("click", () => fit(true));

  function graphMatches(n) {
    const q = fold(state.query);
    if (!q) return false;
    if (n.type === "char") return q === n.char.key || q === n.char.hanja;
    return searchText(n.word).includes(q);
  }

  // Hover beats selection, selection beats search matches.
  function applyGraphHighlight() {
    const focus = state.hover || state.selected;
    const fid = nodeId(focus);
    const strong = new Set(), context = new Set();
    if (focus && adjacency.has(fid)) {
      strong.add(fid);
      for (const nb of adjacency.get(fid)) strong.add(nb);
      for (const id of strong) { context.add(id); for (const nb of adjacency.get(id)) context.add(nb); }
    } else if (state.query) {
      for (const n of nodes) if (graphMatches(n)) {
        strong.add(n.id); context.add(n.id);
        for (const nb of adjacency.get(n.id)) context.add(nb);
      }
    }
    const active = context.size > 0;
    const touches = (d) => !!fid && (d.source.id === fid || d.target.id === fid);
    const inStrong = (d) => strong.has(d.source.id) && strong.has(d.target.id);
    nodeLayer.selectAll("g.node")
      .classed("dim", (d) => active && !context.has(d.id))
      .classed("selected", (d) => d.id === nodeId(state.selected))
      .classed("match", (d) => !focus && !!state.query && strong.has(d.id));
    arrowLayer.selectAll("path")
      .classed("hi", touches)
      .classed("dim", (d) => active && !touches(d) && !inStrong(d));
    charLinkLayer.selectAll("line")
      .classed("hi", touches)
      .classed("dim", (d) => active && !touches(d) && !inStrong(d));
  }

  // ── Tooltip ───────────────────────────────────────────────────────
  const tooltip = $("#tooltip");
  function showTooltip(ev, d) {
    if (ev.buttons) return;
    let html;
    if (d.type === "char") {
      const c = d.char;
      html = `<div class="tt-title"><span lang="ja">${esc(c.key)}</span>${c.hanja !== c.key ? ` <span lang="ko">(${esc(c.hanja)})</span>` : ""}</div>
        ${c.koList.length ? `<div><span lang="ko">${c.koList.map(esc).join(", ")}</span> · <span lang="ja">${c.jaList.map(esc).join(", ")}</span></div>` : ""}
        <div class="tt-sub">shared by ${d.deg} word pairs shown</div>`;
    } else {
      const w = d.word;
      html = `<div class="tt-title"><span lang="${w.lang}">${jr(w)}</span> <span class="tt-sub">${esc(w.rom)}</span></div>
        <div class="tt-sub">${esc(ORIGINS[w.lang][w.origin] || "")}</div>
        ${w.links.map((l) => {
          const o = w.lang === "ko" ? l.ja : l.ko;
          const sym = { false: "≠", approx: "≈", none: "→" }[l.kind] || (w.lang === "ko" ? "→" : "←");
          return `<div>${sym} <span lang="${o.lang}">${jr(o)}</span> <span class="tt-sub">${esc(l.kind === "false" ? "false friend" : l.en)}</span></div>`;
        }).join("")}`;
    }
    tooltip.innerHTML = html;
    tooltip.hidden = false;
    const [x, y] = d3.pointer(ev, stageEl);
    const { width } = stageEl.getBoundingClientRect();
    tooltip.style.left = Math.min(x + 14, width - tooltip.offsetWidth - 8) + "px";
    tooltip.style.top = y + 14 + "px";
  }
  const hideTooltip = () => { tooltip.hidden = true; };

  // ── Selection & detail panel ──────────────────────────────────────
  function select(ref, { focus = true } = {}) {
    state.selected = ref;
    if (ref) ensureVisible(ref);
    applyGraphHighlight();
    applyMappingHighlight();
    renderDetail();
    renderList();
    updateHash();
    if (ref && focus) {
      setTimeout(() => {
        if (state.view === "network") focusNode(nodeId(ref));
        if (state.view === "mapping") scrollMappingTo(ref);
      }, 40);
    }
  }

  // Relax the filters if the selected word is currently hidden.
  function ensureVisible(ref) {
    const w = wordOf(ref);
    if (!w || w.links.some(linkVisible)) return;
    for (const l of w.links) { state.cats.add(l.band.category); state.kinds.add(l.kind); }
    if (state.onlyBroken && !w.links.some(isBroken)) {
      state.onlyBroken = false;
      $("#opt-broken").checked = false;
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
    detailBody.innerHTML = ref.type === "char" ? charDetail(chars.get(ref.id)) : wordDetail(wordOf(ref));
    detail.scrollTop = 0;
  }

  const wordChip = (w) =>
    `<button class="wchip ${w.lang}" data-ref="${w.lang}:${esc(w.key)}"><span lang="${w.lang}">${jr(w)}</span></button>`;

  function wordDetail(w) {
    const isKo = w.lang === "ko";
    const otherSide = (l) => isKo ? l.ja : l.ko;
    const trLinks = w.links.filter(isTranslation);
    const ffLinks = w.links.filter((l) => l.kind === "false");
    const approxLinks = w.links.filter((l) => l.kind === "approx");
    const comp = w.tr;
    const m = comp ? mapping(comp) : null;

    const tags = [`<span class="tag lang-${w.lang}">${isKo ? "Korean" : "Japanese"}</span>`,
      `<span class="tag">${esc(ORIGINS[w.lang][w.origin] || "")}</span>`];
    if (m) tags.push(`<span class="tag map-${m.cls}">${esc(m.short)} ${esc(m.long)}</span>`);
    if (ffLinks.length) tags.push(`<span class="tag ff">⚠ Has a false friend</span>`);
    if (w.noEquiv) tags.push(`<span class="tag none">∅ No exact equivalent</span>`);

    const hero = `<div class="d-lang hero ${w.lang}">
        <div class="big" lang="${w.lang}">${jr(w)}</div>
        <div class="rom">${esc(w.rom)}</div>
        ${isKo && w.hanja ? `<div class="hanja-line">Hanja: <span lang="ko">${esc(w.hanja)}</span></div>` : ""}
        ${speakBtn(sayText(w), sayLang(w))}
      </div>`;

    const arrowFor = (l) => l.tr.type === "1:1" ? "↔" : (isKo === (state.dir === "ko2ja") ? "→" : "←");
    const rows = trLinks.map((l) => {
      const o = otherSide(l);
      return `<div class="tr-row" style="--kc:${KINDS[l.kind].color}">
          <button class="tr-word" data-ref="${o.lang}:${esc(o.key)}">
            <span class="tr-arrow">${arrowFor(l)}</span>
            <span class="tr-main" lang="${o.lang}">${jr(o)}</span>
            <span class="tr-read">${esc(o.rom)}</span>
          </button>
          ${speakBtn(sayText(o), sayLang(o))}
          <div class="tr-meta"><span class="tr-gloss">${esc(l.en)}</span><span class="tr-kind">${esc(KINDS[l.kind].label)}</span></div>
        </div>`;
    }).join("");

    // Explain splits and merges in words.
    let explain = "";
    if (comp && comp.type !== "1:1") {
      const mine = trLinks.map(otherSide);
      const bits = [];
      const lw = (x) => `<span lang="${x.lang}">${esc(x.label)}</span>`;
      if (mine.length > 1) {
        bits.push(`${isKo ? "Japanese" : "Korean"} uses ${mine.length} words where ${isKo ? "Korean" : "Japanese"} uses just ${lw(w)}: ` +
          trLinks.map((l) => `${lw(otherSide(l))} (${esc(l.en)})`).join(", ") + ".");
      }
      for (const o of mine) {
        const sharers = o.links.filter((l) => isTranslation(l) && (isKo ? l.ko : l.ja) !== w);
        if (sharers.length) {
          bits.push(`${lw(o)} also translates ` +
            sharers.map((l) => `${lw(isKo ? l.ko : l.ja)} (${esc(l.en)})`).join(", ") + ".");
        }
      }
      explain = `<div class="d-explain map-${m.cls}"><strong>${esc(m.short)}</strong> ${bits.join(" ")}</div>`;
    }

    const ff = ffLinks.map((l) => `<div class="ff-box">
        <div class="ff-head">Looks like ${wordChip(otherSide(l))}, but means something else</div>
        <div><span class="who">In Korean</span><span>${esc(l.falseFriend.ko)}</span></div>
        <div><span class="who">In Japanese</span><span>${esc(l.falseFriend.ja)}</span></div>
      </div>`).join("");

    const noEq = w.noEquiv
      ? `<div class="none-box"><div class="none-head">∅ No ${isKo ? "Japanese" : "Korean"} word for “${esc(w.noEquiv.en)}”</div>
          ${approxLinks.length ? `<div class="none-closest">Closest: ${approxLinks.map((l) => `${wordChip(otherSide(l))} <span class="muted">${esc(l.en)}</span>`).join(" · ")}</div>` : ""}</div>`
      : approxLinks.length
        ? `<div class="none-box"><div class="none-head">≈ Closest ${isKo ? "Korean" : "Japanese"} match for an untranslatable word:</div>${approxLinks.map((l) => wordChip(otherSide(l))).join(" ")}</div>`
        : "";
    const aligns = w.links.filter((l) => l.entry).map((l) => alignment(l.entry)).join("");
    const notes = uniq(w.links.map((l) => l.note).filter(Boolean)).map((n) => `<div class="d-note">${esc(n)}</div>`).join("");

    // Other words in the same language sharing a character.
    const myChars = new Set(w.links.flatMap((l) => l.entry ? l.entry.chars : l.sharedChar ? [l.sharedChar] : []));
    const related = uniq([...myChars].flatMap((c) => chars.get(c)?.links || []).map((l) => isKo ? l.ko : l.ja))
      .filter((o) => o !== w).slice(0, 30);

    return `
      <div class="d-tags">${tags.join("")}</div>
      ${hero}
      ${trLinks.length ? `<div class="d-section">${isKo ? "In Japanese" : "In Korean"}</div><div class="tr-list">${rows}</div>` : ""}
      ${explain}
      ${noEq}
      ${ff}
      ${aligns ? `<div class="d-section">Character by character</div>${aligns}` : ""}
      ${notes}
      ${related.length ? `<div class="d-section">${isKo ? "Korean" : "Japanese"} words sharing a character</div><div class="related">${related.map(wordChip).join("")}</div>` : ""}
      <p class="d-dict"><a href="#d=${isKo ? "k" : "j"}:${encodeURIComponent(w.text)}" data-open-dict="1">Look up ${esc(w.text)} in the full dictionary →</a></p>`;
  }

  function alignment(e) {
    const anyDiff = e.hanja !== e.kanji;
    const cols = e.chars.map((k, i) => `
      <button class="align-col" data-ref="char:${esc(k)}" title="Every word with ${esc(k)}">
        <span class="a-ko" lang="ko">${esc(e.koChars[i])}</span>
        ${anyDiff ? `<span class="a-h ${e.hanjaChars[i] !== k ? "diff" : ""}" lang="ko">${esc(e.hanjaChars[i])}</span>` : ""}
        <span class="a-k" lang="ja">${esc(k)}</span>
        <span class="a-ja" lang="ja">${esc(e.jaParts[i])}</span>
      </button>`).join("");
    const legend = `<div class="align-legend" aria-hidden="true">
        <span class="h17">Korean</span>
        ${anyDiff ? `<span class="h24">Hanja</span><span class="h24">Kanji</span>` : `<span class="h24">Character</span>`}
        <span class="h14">Japanese</span></div>`;
    return `<div class="align">${legend}${cols}</div>`;
  }

  // Highlight the parts of a word that come from character c.
  function mark(w, c) {
    const l = c.links.find((x) => x.ko === w || x.ja === w);
    const e = l?.entry;
    if (!e) return esc(w.label);
    if (w.lang === "ko") return e.koChars.map((s, i) => e.chars[i] === c.key ? `<mark>${esc(s)}</mark>` : esc(s)).join("");
    return e.chars.map((k) => k === c.key ? `<mark>${esc(k)}</mark>` : esc(k)).join("");
  }

  function charDetail(c) {
    const diff = c.hanja !== c.key;
    const pairChip = (l) => `<button class="pchip" data-ref="ko:${esc(l.ko.key)}">
        <span lang="ko">${mark(l.ko, c)}</span><span class="pa">${l.kind === "false" ? "≠" : "→"}</span><span lang="ja">${mark(l.ja, c)}</span></button>`;
    return `
      <div class="d-tags"><span class="tag">Character</span></div>
      <div class="char-hero">
        <div class="glyph" lang="ja">${esc(c.key)}</div>
        <div class="variant-note">${diff
          ? `Korean uses the traditional form <span class="h" lang="ko">${esc(c.hanja)}</span>; Japanese uses the simplified ${esc(c.key)}.`
          : "Written the same way in Korean and Japanese."}</div>
      </div>
      ${c.koList.length ? `<div class="d-section">Sino readings</div>
      <div class="readings">
        <div class="d-lang"><div class="lbl">Korean</div><div class="big" lang="ko">${c.koList.map(esc).join(" · ")}</div>${speakBtn(c.koList[0], "ko-KR")}</div>
        <div class="d-lang"><div class="lbl">Japanese</div><div class="big" lang="ja">${c.jaList.map(esc).join(" · ")}</div>${speakBtn(c.jaList[0], "ja-JP")}</div>
      </div>` : ""}
      ${c.entries.length ? `<div class="d-section">Word pairs with ${esc(c.key)}</div><div class="related">${c.entries.map((e) => pairChip(e.link)).join("")}</div>` : ""}
      ${c.alone.length ? `<div class="d-section">Same character, different reading</div><div class="related">${c.alone.map(pairChip).join("")}</div>
        <div class="d-note">Here Japanese reads ${esc(c.key)} with a native word (${c.alone.map((l) => esc(l.ja.kana)).join(", ")}) while Korean keeps the Sino reading (${c.alone.map((l) => esc(l.ko.text)).join(", ")}).</div>` : ""}`;
  }

  detailBody.addEventListener("click", (ev) => {
    const dict = ev.target.closest("[data-open-dict]");
    if (dict) {
      ev.preventDefault();
      history.replaceState(null, "", dict.getAttribute("href"));
      setView("dictionary");
      window.DictionaryPage?.fromHash();
      return;
    }
    const say = ev.target.closest("[data-say]");
    if (say) return speak(say.dataset.say, say.dataset.lang);
    const r = ev.target.closest("[data-ref]");
    if (r) {
      const i = r.dataset.ref.indexOf(":");
      select({ type: r.dataset.ref.slice(0, i), id: r.dataset.ref.slice(i + 1) });
    }
  });

  // ── Search ────────────────────────────────────────────────────────
  const searchCache = new Map();
  function searchText(w) {
    if (!searchCache.has(w)) {
      searchCache.set(w, fold([w.text, w.rom, w.kana, w.hanja,
        ...w.links.map((l) => l.en), ...w.links.map((l) => l.falseFriend?.ko), ...w.links.map((l) => l.falseFriend?.ja)]
        .filter(Boolean).join(" | ")));
    }
    return searchCache.get(w);
  }

  const searchInput = $("#search");
  const resultsEl = $("#search-results");
  let results = [];
  let activeResult = 0;

  function computeResults(q) {
    const f = fold(q);
    if (!f) return [];
    const out = [];
    for (const w of [...koWords.values(), ...jaWords.values()]) {
      const st = searchText(w);
      if (!st.includes(f)) continue;
      const exact = [w.text, w.rom, w.kana, w.hanja].filter(Boolean).map(fold).includes(f) ? 0 : 1;
      const starts = st.split(/[\s|,;()]+/).some((t) => t.startsWith(f)) ? 0 : 1;
      out.push({ type: w.lang, id: w.key, score: exact * 2 + starts });
    }
    for (const ch of uniq([...q])) {
      const c = chars.get(ch) || [...chars.values()].find((x) => x.hanja === ch);
      if (c) out.push({ type: "char", id: c.key, score: 1.5 });
    }
    return out.sort((a, b) => a.score - b.score).slice(0, 14);
  }

  function renderResults() {
    if (!state.query) { resultsEl.hidden = true; return; }
    resultsEl.hidden = false;
    if (!results.length) { resultsEl.innerHTML = `<li class="empty">No matches</li>`; return; }
    resultsEl.innerHTML = results.map((r, i) => {
      if (r.type === "char") {
        const c = chars.get(r.id);
        return `<li role="option" data-i="${i}" aria-selected="${i === activeResult}">
          <span class="sr-lang char">字</span><span class="sr-main" lang="ja">${esc(c.key)}</span><span class="sr-sub">character · ${c.links.length} pairs</span></li>`;
      }
      const w = wordOf(r);
      const targets = uniq(w.links.map((l) => (w.lang === "ko" ? l.ja : l.ko).label));
      return `<li role="option" data-i="${i}" aria-selected="${i === activeResult}">
        <span class="sr-lang ${w.lang}">${w.lang === "ko" ? "KO" : "JA"}</span>
        <span class="sr-main" lang="${w.lang}">${jr(w)}</span>
        <span class="sr-sub">${w.lang === "ko" ? "→" : "←"} <span lang="${w.lang === "ko" ? "ja" : "ko"}">${esc(targets.join(", "))}</span> · ${esc(truncate(w.links[0].en || "false friend", 26))}</span></li>`;
    }).join("");
  }

  function pickResult(i) {
    const r = results[i];
    if (!r) return;
    resultsEl.hidden = true;
    searchInput.blur();
    if (r.type === "char" && state.view !== "network") setView("network");
    else if (state.view === "dictionary") setView("mapping");
    select({ type: r.type, id: r.id });
  }

  searchInput.addEventListener("input", () => {
    state.query = searchInput.value.trim();
    results = computeResults(state.query);
    activeResult = 0;
    renderResults();
    applyGraphHighlight();
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
    const typing = ["INPUT", "TEXTAREA"].includes(document.activeElement?.tagName);
    if (ev.key === "/" && !typing && !$("#about").open) {
      ev.preventDefault();
      searchInput.focus();
    } else if (ev.key === "Escape" && !typing && state.selected && !$("#about").open) {
      select(null);
    }
  });

  // ── List view ─────────────────────────────────────────────────────
  function renderList() {
    if (state.view !== "list") return;
    const q = fold(state.query);
    const vis = visibleLinks().filter((l) => !q || searchText(l.ko).includes(q) || searchText(l.ja).includes(q));
    if (!vis.length) { $("#word-list").innerHTML = `<p class="empty-state">No words match.</p>`; return; }
    const selId = nodeId(state.selected);
    $("#word-list").innerHTML = Object.entries(CATEGORIES).map(([key, cat]) => {
      const group = vis.filter((l) => l.band.category === key);
      if (!group.length) return "";
      return `<section class="list-group">
        <h3><span class="dot" style="background:${cat.color}"></span>${esc(cat.label)}</h3>
        <div class="cards">${group.map((l) => {
          const m = isTranslation(l) ? mapping(l.tr) : null;
          const sel = selId === "k:" + l.ko.key || selId === "j:" + l.ja.key;
          const arrow = { false: "≠", approx: "≈", none: "→" }[l.kind] || (m.cls === "ok" ? "↔" : state.dir === "ko2ja" ? "→" : "←");
          const ref = l.ko.pseudo ? `ja:${esc(l.ja.key)}` : `ko:${esc(l.ko.key)}`;
          return `<button class="card${sel ? " selected" : ""}" data-ref="${ref}" style="--kc:${KINDS[l.kind].color}">
            <span class="c-pair"><span class="c-ko" lang="ko">${esc(l.ko.label)}</span>
              <span class="c-arrow">${arrow}</span>
              <span class="c-ja" lang="ja">${jr(l.ja)}</span></span>
            <span class="c-read">${esc(l.ko.pseudo ? "" : l.ko.rom)} · ${esc(l.ja.pseudo ? "" : l.ja.rom)}</span>
            <span class="c-en">${esc(l.kind === "false" ? `KO: ${l.falseFriend.ko} · JA: ${l.falseFriend.ja}` : l.kind === "approx" ? `closest match: ${l.en}` : l.en)}</span>
            <span class="c-tags"><span class="c-kind">${esc(KINDS[l.kind].label)}</span>${m && m.cls !== "ok" ? `<span class="c-map map-${m.cls}">${esc(m.short)}</span>` : ""}</span>
          </button>`;
        }).join("")}</div></section>`;
    }).join("");
  }
  $("#word-list").addEventListener("click", (ev) => {
    const card = ev.target.closest("[data-ref]");
    if (card) select({ type: card.dataset.ref.slice(0, 2), id: card.dataset.ref.slice(3) }, { focus: false });
  });

  // ── Sound patterns view ───────────────────────────────────────────
  const FINALS = [
    { idx: 0, jamo: "∅", title: "No final consonant",
      rule: "Open syllables usually match one Japanese syllable or a long vowel: 家 가 → か, 午 오 → ご, 数 수 → すう." },
    { idx: 1, jamo: "ㄱ", title: "Final -k",
      rule: "→ く (ku) or き (ki), and often っ before another consonant: 学 학 → がく / がっ, 食 식 → しょく." },
    { idx: 4, jamo: "ㄴ", title: "Final -n", rule: "→ ん (n): 文 문 → ぶん, 電 전 → でん." },
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
    if (!$("#sound-groups")) return;
    const vis = new Set(visibleLinks());
    const list = [...chars.values()].filter((c) => c.koList.length && c.entries.some((e) => vis.has(e.link)));
    const groups = FINALS.map((f) => ({ ...f, chars: [] }));
    const other = { jamo: "…", title: "Other", rule: "", chars: [] };
    for (const c of list) (groups.find((g) => g.idx === finalIndex(c.koList[0])) || other).chars.push(c);
    if (other.chars.length) groups.push(other);
    for (const g of groups) g.chars.sort((a, b) => b.entries.length - a.entries.length);
    $("#sound-groups").innerHTML = groups.filter((g) => g.chars.length).map((g) => `
      <article class="sound-card">
        <h3><span class="jamo" lang="ko">${g.jamo}</span>${esc(g.title)} <small class="count">(${g.chars.length})</small></h3>
        <p class="rule">${esc(g.rule)}</p>
        <div class="sound-chips">${g.chars.map((c) => `
          <button class="sound-chip" data-char="${esc(c.key)}" title="${c.entries.length} word pair(s)">
            <span class="k" lang="ja">${esc(c.key)}</span>
            <span class="r-ko" lang="ko">${c.koList.map(esc).join("·")}</span>
            <span class="r-ja" lang="ja">${c.jaList.map(esc).join("·")}</span>
          </button>`).join("")}</div>
      </article>`).join("");
  }
  $("#sound-groups")?.addEventListener("click", (ev) => {
    const chip = ev.target.closest("[data-char]");
    if (!chip) return;
    setView("network");
    select({ type: "char", id: chip.dataset.char });
  });

  // ── Views, hash, refresh ──────────────────────────────────────────
  function setView(view) {
    state.view = view;
    document.body.dataset.active = view;
    if (view === "dictionary") window.DictionaryPage?.start();
    document.querySelectorAll(".tab").forEach((t) => t.setAttribute("aria-selected", t.dataset.view === view));
    document.querySelectorAll(".view").forEach((v) => v.classList.toggle("active", v.id === "view-" + view));
    if (view === "mapping") renderMapping();
    if (view === "list") renderList();
    if (view === "sounds") renderSounds();
    if (view === "network") requestAnimationFrame(() => {
      if (needsFit) fit(false);
      if (state.selected) focusNode(nodeId(state.selected));
    });
    if (view === "mapping" && state.selected) requestAnimationFrame(() => scrollMappingTo(state.selected));
    if (view === "dictionary") requestAnimationFrame(() => window.DictionaryPage?.fit());
  }
  document.querySelectorAll(".tab").forEach((t) => t.addEventListener("click", () => setView(t.dataset.view)));

  function updateHash() {
    const r = state.selected;
    history.replaceState(null, "", r ? `#${r.type}=${encodeURIComponent(r.id)}` : location.pathname + location.search);
  }
  function readHash() {
    if (location.hash.startsWith("#d=")) { setView("dictionary"); return null; }
    const m = location.hash.match(/^#(ko|ja|char)=(.+)$/);
    if (!m) return null;
    const ref = { type: m[1], id: decodeURIComponent(m[2]) };
    return (ref.type === "char" ? chars.has(ref.id) : wordOf(ref)) ? ref : null;
  }

  function renderStats() {
    const vis = visibleLinks();
    const ko = new Set(vis.map((l) => l.ko).filter((w) => !w.pseudo)), ja = new Set(vis.map((l) => l.ja).filter((w) => !w.pseudo));
    const comps = new Set(vis.filter(isTranslation).map((l) => l.tr));
    const broken = [...comps].filter((c) => c.type !== "1:1").length;
    $("#stats").innerHTML = `Showing <strong>${ko.size}</strong> Korean and <strong>${ja.size}</strong> Japanese words
      with <strong>${vis.length}</strong> connections. <strong>${broken}</strong> of ${comps.size} mappings are not one-to-one.`;
  }

  function refresh({ refit = false, keepDetail = false } = {}) {
    renderChips();
    renderStats();
    updateGraph({ refit });
    renderMapping();
    renderList();
    if (state.view === "sounds") renderSounds();
    if (!keepDetail) renderDetail();
  }

  $("#about-btn").addEventListener("click", () => $("#about").showModal());
  $("#about").addEventListener("click", (ev) => { if (ev.target === ev.currentTarget) ev.currentTarget.close(); });

  let resizeTimer, lastWidth = 0;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { if (state.view === "network") fit(false); else needsFit = true; }, 150);
  });
  new ResizeObserver(() => {
    const w = mappingHost.clientWidth;
    if (state.view === "mapping" && Math.abs(w - lastWidth) > 20) { lastWidth = w; renderMapping(); }
  }).observe(mappingHost);

  // ── Boot ──────────────────────────────────────────────────────────
  renderChips();
  renderStats();
  updateGraph({ initial: true });
  lastWidth = mappingHost.clientWidth;
  renderMapping();
  setView(state.view);
  const fromHash = readHash();
  if (fromHash) { if (state.view === "dictionary") setView("mapping"); select(fromHash); }
  window.addEventListener("hashchange", () => { const r = readHash(); if (r) select(r); });
})();
