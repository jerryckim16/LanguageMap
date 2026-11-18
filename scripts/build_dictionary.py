#!/usr/bin/env python3
"""
Build the Korean ↔ Japanese dictionary dataset in data/dict/ from Wiktionary.

Sources (all from https://kaikki.org, machine-readable Wiktionary by Wiktextract;
Wiktionary text is licensed CC BY-SA 4.0):
  * English Wiktionary: every Korean and Japanese entry (English glosses,
    readings, hanja), plus the translation tables of English entries, which list
    Korean and Japanese words per word sense. Those senses become "meanings"
    that link synonyms and polysemous words across the two languages.
  * Korean Wiktionary: Korean entries (Korean definitions) and Japanese words
    defined in Korean (direct Japanese → Korean links).
  * Japanese Wiktionary: Japanese entries (Japanese definitions) and Korean
    words defined in Japanese (direct Korean → Japanese links).

Usage:
  python3 scripts/build_dictionary.py --raw DIR [--download] [--out data/dict]

With --download, the inputs are fetched into DIR first (about 3.2 GB transferred,
roughly 600 MB kept on disk). DIR must then hold:
  en-ko.jsonl en-ja.jsonl en-tr.jsonl   (filtered from the English export)
  ko-extract.jsonl.gz ja-extract.jsonl.gz
"""
import argparse, collections, gzip, json, os, re, shutil, subprocess, sys

HANGUL_WORD = re.compile(r"^[가-힣]+(?: [가-힣]+)*$")
JA_WORD = re.compile(r"^[぀-ヿ㐀-鿿豈-﫿々〆ヶー〜]+$")
KANA = re.compile(r"^[぀-ヿー]+$")
KANJI = re.compile(r"[㐀-鿿豈-﫿々]")
SKIP_POS = {"romanization", "soft-redirect", "character", "syllable", "symbol", "punct", "root"}
NO_POS = {"unknown", "proverb", "phrase"}  # kept as entries, but not shown as a part of speech
SPLIT = re.compile(r"[、，,;；/／・。．.]")
PAREN = re.compile(r"[（(][^）)]*[）)]|〈[^〉]*〉|《[^》]*》|「|」|『|』")

ENTRY_SHARDS = 256
MEANING_BLOCK = 512


def djb2(s):
    """Same hash as js/dictionary.js: shard = djb2(word) % ENTRY_SHARDS."""
    h = 5381
    for ch in s:
        h = (h * 33 + ord(ch)) & 0xFFFFFFFF
    return h


def jsonl(path):
    opener = gzip.open if path.endswith(".gz") else open
    with opener(path, "rt", encoding="utf-8") as f:
        for line in f:
            try:
                yield json.loads(line)
            except ValueError:
                continue


def short(s, n=90):
    s = re.sub(r"\s+", " ", str(s)).strip()
    return s if len(s) <= n else s[: n - 1] + "…"


def to_hira(s):
    return "".join(chr(ord(c) - 0x60) if "ァ" <= c <= "ヶ" else c for c in s)


# ── Kana → Hepburn (mirrors js/furigana.js) ─────────────────────────────
ROMA = {}
for line in """きゃ kya きゅ kyu きょ kyo しゃ sha しゅ shu しょ sho ちゃ cha ちゅ chu ちょ cho にゃ nya にゅ nyu にょ nyo
ひゃ hya ひゅ hyu ひょ hyo みゃ mya みゅ myu みょ myo りゃ rya りゅ ryu りょ ryo ぎゃ gya ぎゅ gyu ぎょ gyo じゃ ja じゅ ju じょ jo
びゃ bya びゅ byu びょ byo ぴゃ pya ぴゅ pyu ぴょ pyo ぢゃ ja ぢゅ ju ぢょ jo てぃ ti でぃ di ふぁ fa ふぃ fi ふぇ fe ふぉ fo
うぃ wi うぇ we うぉ wo しぇ she ちぇ che じぇ je
あ a い i う u え e お o か ka き ki く ku け ke こ ko さ sa し shi す su せ se そ so た ta ち chi つ tsu て te と to
な na に ni ぬ nu ね ne の no は ha ひ hi ふ fu へ he ほ ho ま ma み mi む mu め me も mo や ya ゆ yu よ yo
ら ra り ri る ru れ re ろ ro わ wa ゐ i ゑ e を o ん n が ga ぎ gi ぐ gu げ ge ご go ざ za じ ji ず zu ぜ ze ぞ zo
だ da ぢ ji づ zu で de ど do ば ba び bi ぶ bu べ be ぼ bo ぱ pa ぴ pi ぷ pu ぺ pe ぽ po ゔ vu
ぁ a ぃ i ぅ u ぇ e ぉ o ゃ ya ゅ yu ょ yo ゎ wa""".split("\n"):
    toks = line.split()
    for i in range(0, len(toks), 2):
        ROMA[toks[i]] = toks[i + 1]
LONG = {"a": "ā", "i": "ī", "u": "ū", "e": "ē", "o": "ō"}


def romaji(kana):
    s = to_hira(kana)
    out = ""
    i = 0
    while i < len(s):
        two = s[i : i + 2]
        if two in ROMA:
            out += ROMA[two]; i += 2; continue
        c = s[i]
        if c == "っ":
            nx = ROMA.get(s[i + 1 : i + 3]) or ROMA.get(s[i + 1 : i + 2], "")
            out += "t" if nx.startswith("ch") else nx[:1]
        elif c == "ー":
            if out and out[-1] in LONG:
                out = out[:-1] + LONG[out[-1]]
        elif c == "ん":
            nx = ROMA.get(s[i + 1 : i + 3]) or ROMA.get(s[i + 1 : i + 2], "")
            out += "n'" if nx[:1] in ("a", "i", "u", "e", "o", "y") else "n"
        else:
            out += ROMA.get(c, c)
        i += 1
    return out.replace("ou", "ō").replace("oo", "ō").replace("uu", "ū")


# ── Hangul → Revised Romanization (letter by letter; used for search only) ──
RR_I = ["g", "kk", "n", "d", "tt", "r", "m", "b", "pp", "s", "ss", "", "j", "jj", "ch", "k", "t", "p", "h"]
RR_V = ["a", "ae", "ya", "yae", "eo", "e", "yeo", "ye", "o", "wa", "wae", "oe", "yo", "u", "wo", "we", "wi", "yu", "eu", "ui", "i"]
RR_F = ["", "k", "k", "k", "n", "n", "n", "t", "l", "k", "m", "l", "l", "l", "p", "l", "m", "p", "p", "t", "t", "ng", "t", "t", "k", "t", "p", "t"]


def rr(word):
    out = []
    for ch in word:
        c = ord(ch) - 0xAC00
        if 0 <= c < 11172:
            out.append(RR_I[c // 588] + RR_V[(c % 588) // 28] + RR_F[c % 28])
        else:
            out.append(ch)
    return "".join(out)


def norm_latin(s):
    s = s.lower()
    for a, b in (("ā", "a"), ("ī", "i"), ("ū", "u"), ("ē", "e"), ("ō", "o"), ("ô", "o"), ("â", "a")):
        s = s.replace(a, b)
    return re.sub(r"[^a-z]", "", s)


# ── Data model ─────────────────────────────────────────────────────────
class Entry(dict):
    pass


ko = {}  # word -> entry
ja = {}


def ko_entry(w):
    e = ko.get(w)
    if e is None:
        e = ko[w] = {"r": "", "h": [], "p": [], "e": [], "d": [], "m": set(), "j": set(), "c": set()}
    return e


def ja_entry(w):
    e = ja.get(w)
    if e is None:
        e = ja[w] = {"k": [], "r": "", "p": [], "e": [], "d": [], "m": set(), "o": set(), "c": set()}
    return e


def add(lst, v, limit=None):
    if v and v not in lst and (limit is None or len(lst) < limit):
        lst.append(v)


def best_glosses(rec, limit=4):
    out = []
    for s in rec.get("senses", []):
        tags = set(s.get("tags", []))
        if "form-of" in tags or "alt-of" in tags or "no-gloss" in tags:
            continue
        g = s.get("glosses") or []
        if g:
            add(out, short(g[-1]), limit)
    return out


def ja_readings(rec):
    """Kana readings of an English-Wiktionary Japanese entry."""
    word = rec["word"]
    out = []
    if KANA.match(word):
        out.append(word)
    for f in rec.get("forms", []) or []:
        tags = f.get("tags") or []
        form = f.get("form", "")
        if f.get("ruby") and "canonical" in tags:
            reading, rest = "", form
            for base, rt in f["ruby"]:
                idx = rest.find(base)
                if idx < 0:
                    reading = ""; break
                reading += rest[:idx] + rt
                rest = rest[idx + len(base):]
            reading += rest
            if reading and KANA.match(reading.replace(" ", "")):
                add(out, reading.replace(" ", ""))
        elif "hiragana" in tags and KANA.match(form):
            add(out, form)
    for t in rec.get("head_templates", []) or []:
        for v in (t.get("args") or {}).values():
            v = str(v).replace(" ", "").replace("^", "").replace("-", "").replace(".", "").replace("%", "")
            if v and KANA.match(v) and KANJI.search(word):
                add(out, to_hira(v) if not KANA.match(word) else v)
    return out


def ja_romanization(rec):
    for f in rec.get("forms", []) or []:
        if "romanization" in (f.get("tags") or []):
            r = f.get("form", "").strip("-")
            if r and re.match(r"^[A-Za-zāīūēōĀĪŪĒŌ' -]+$", r):
                return r
    return ""


def ko_romanization(rec):
    for f in rec.get("forms", []) or []:
        if "romanization" in (f.get("tags") or []):
            return f.get("form", "")
    for s in rec.get("sounds", []) or []:
        tags = s.get("tags") or []
        if "revised" in tags and s.get("roman"):
            return s["roman"]
    return ""


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--raw", required=True)
    ap.add_argument("--out", default="data/dict")
    ap.add_argument("--download", action="store_true")
    a = ap.parse_args()
    raw = a.raw
    if a.download:
        download(raw)

    variants = {}  # kyūjitai → shinjitai
    log = lambda *x: print(*x, file=sys.stderr, flush=True)

    # 1. English Wiktionary: Japanese entries.
    log("Japanese entries (enwiktionary)…")
    for rec in jsonl(os.path.join(raw, "en-ja.jsonl")):
        w, pos = rec.get("word", ""), rec.get("pos")
        if pos == "character":
            for f in rec.get("forms", []) or []:
                if "kyūjitai" in (f.get("tags") or []) and len(f.get("form", "")) == 1 and len(w) == 1:
                    variants[f["form"]] = w
            continue
        if pos in SKIP_POS or not JA_WORD.match(w):
            continue
        e = ja_entry(w)
        for k in ja_readings(rec):
            add(e["k"], k)
        e["r"] = e["r"] or ja_romanization(rec)
        add(e["p"], pos)
        for g in best_glosses(rec):
            add(e["e"], g, 5)

    # 2. English Wiktionary: Korean entries.
    log("Korean entries (enwiktionary)…")
    for rec in jsonl(os.path.join(raw, "en-ko.jsonl")):
        w, pos = rec.get("word", ""), rec.get("pos")
        if pos in SKIP_POS or not HANGUL_WORD.match(w):
            continue
        e = ko_entry(w)
        e["r"] = e["r"] or ko_romanization(rec)
        for f in rec.get("forms", []) or []:
            if "hanja" in (f.get("tags") or []) and KANJI.search(f.get("form", "")):
                add(e["h"], f["form"])
        add(e["p"], pos)
        for g in best_glosses(rec):
            add(e["e"], g, 5)

    # 3. Korean Wiktionary.
    log("Korean Wiktionary…")
    ja_from_ko = []  # (ja word, gloss in Korean)
    ko_tr_ja = []
    for rec in jsonl(os.path.join(raw, "ko-extract.jsonl.gz")):
        lc, w, pos = rec.get("lang_code"), rec.get("word", ""), rec.get("pos")
        if lc == "ko" and HANGUL_WORD.match(w) and pos not in SKIP_POS:
            e = ko_entry(w)
            e["r"] = e["r"] or ko_romanization(rec)
            add(e["p"], pos)
            for g in best_glosses(rec, 2):
                add(e["d"], short(g, 70), 2)
            for t in rec.get("translations", []) or []:
                if t.get("lang_code") == "ja" and JA_WORD.match(t.get("word", "")):
                    ko_tr_ja.append((w, t["word"]))
        elif lc == "ja" and JA_WORD.match(w) and pos not in SKIP_POS:
            for s in rec.get("senses", []):
                for g in s.get("glosses", [])[:1]:
                    ja_from_ko.append((w, g))

    # 4. Japanese Wiktionary.
    log("Japanese Wiktionary…")
    ko_from_ja = []  # (ko word, gloss in Japanese)
    ja_tr_ko = []
    for rec in jsonl(os.path.join(raw, "ja-extract.jsonl.gz")):
        lc, w, pos = rec.get("lang_code"), rec.get("word", ""), rec.get("pos")
        if lc == "ja" and JA_WORD.match(w) and pos not in SKIP_POS:
            e = ja_entry(w)
            for f in rec.get("forms", []) or []:
                form = f.get("form", "")
                if "transliteration" in (f.get("tags") or []) and KANA.match(form) and KANJI.search(w) and len(f.get("tags")) == 1:
                    add(e["k"], to_hira(form))
            add(e["p"], pos)
            for g in best_glosses(rec, 2):
                add(e["d"], short(g, 70), 2)
            for t in rec.get("translations", []) or []:
                if t.get("lang_code") == "ko" and HANGUL_WORD.match(t.get("word", "")):
                    ja_tr_ko.append((w, t["word"]))
        elif lc == "ko" and HANGUL_WORD.match(w) and pos not in SKIP_POS:
            ko_entry(w)
            add(ko[w]["p"], pos)
            for s in rec.get("senses", []):
                for g in s.get("glosses", [])[:1]:
                    ko_from_ja.append((w, g))

    # 5. Meanings from English translation tables.
    log("Meanings from translation tables…")
    meanings = []
    en_index = collections.defaultdict(list)
    for rec in jsonl(os.path.join(raw, "en-tr.jsonl")):
        groups = collections.OrderedDict()
        for t in rec.get("translations", []):
            sense = short(t.get("sense") or "", 80)
            g = groups.setdefault(sense, {"ko": [], "ja": [], "jr": {}})
            word = (t.get("word") or "").strip()
            tags = set(t.get("tags") or [])
            if tags & {"archaic", "obsolete", "dated"}:
                continue
            if t.get("lang_code") == "ko" and HANGUL_WORD.match(word):
                add(g["ko"], word)
                e = ko_entry(word)
                e["r"] = e["r"] or (t.get("roman") or "")
                alt = t.get("alt") or ""
                if KANJI.search(alt):
                    add(e["h"], alt)
            elif t.get("lang_code") == "ja" and JA_WORD.match(word):
                add(g["ja"], word)
                e = ja_entry(word)
                alt = (t.get("alt") or "").replace(" ", "")
                if KANA.match(alt):
                    add(e["k"], to_hira(alt) if not KANA.match(word) else alt)
                    g["jr"].setdefault(word, to_hira(alt))
                if not e["r"] and t.get("roman"):
                    e["r"] = t["roman"]
        for sense, g in groups.items():
            if not g["ko"] and not g["ja"]:
                continue
            mid = len(meanings)
            meanings.append([rec["word"], rec.get("pos") or "", sense, g["ko"], g["ja"], g["jr"]])
            en_index[rec["word"].lower()].append(mid)
            for w in g["ko"]:
                ko[w]["m"].add(mid)
            for w in g["ja"]:
                ja[w]["m"].add(mid)

    # 6. Direct links parsed from definitions written in the other language.
    log("Direct links…")
    def tokens(gloss):
        g = PAREN.sub("", gloss)
        g = re.sub(r"[~〜]", "", g)
        for tok in SPLIT.split(g):
            tok = tok.strip()
            if tok:
                yield tok
    n_direct = 0
    for kw, gloss in ko_from_ja:
        for tok in tokens(gloss):
            if tok in ja and tok != kw:
                ko[kw]["j"].add(tok); ja[tok]["o"].add(kw); n_direct += 1
    for jw, gloss in ja_from_ko:
        for tok in tokens(gloss):
            if tok in ko:
                ja_entry(jw)["o"].add(tok); ko[tok]["j"].add(jw); n_direct += 1
    for kw, jw in ko_tr_ja:
        ko[kw]["j"].add(jw); ja_entry(jw)["o"].add(kw); n_direct += 1
    for jw, kw in ja_tr_ko:
        ko_entry(kw)["j"].add(jw); ja_entry(jw)["o"].add(kw); n_direct += 1

    # 7. Same-character words: Korean hanja == Japanese spelling (after 國 → 国 etc.).
    log("Same-character words…")
    n_cog = 0
    for kw, e in ko.items():
        for h in e["h"]:
            if len(h) != len(kw):
                continue
            shin = "".join(variants.get(c, c) for c in h)
            for cand in {h, shin}:
                if cand in ja:
                    e["c"].add(cand); ja[cand]["c"].add(kw); n_cog += 1

    # Japanese romanization fallback from the first reading.
    for w, e in ja.items():
        if not e["k"] and KANA.match(w):
            e["k"].append(w)
        if not e["r"] and e["k"]:
            e["r"] = romaji(e["k"][0])

    write(a.out, meanings, en_index, variants)
    log(f"Korean entries {len(ko)}, Japanese entries {len(ja)}, meanings {len(meanings)}, "
        f"direct links {n_direct}, same-character links {n_cog}")


def compact(e, keys_sets=None):
    # A native-language definition is kept only when there is no English gloss, or as one short extra.
    if e.get("e") and e.get("d"):
        e = dict(e, d=e["d"][:1])
    e = dict(e, p=[p for p in e.get("p", []) if p not in NO_POS])
    out = {}
    for k, v in e.items():
        if isinstance(v, set):
            v = sorted(v)
        if v:
            out[k] = v
    return out


def write(out, meanings, en_index, variants):
    if os.path.isdir(out):
        shutil.rmtree(out)
    for sub in ("ko", "ja", "en", "m", "s"):
        os.makedirs(os.path.join(out, sub))

    def dump(path, obj):
        with open(path, "w", encoding="utf-8") as f:
            json.dump(obj, f, ensure_ascii=False, separators=(",", ":"))

    def with_reading(w, sense_reading=None):
        r = sense_reading or (ja[w]["k"][0] if w in ja and ja[w]["k"] else "")
        return f"{w}|{r}" if r and r != w else w

    # Japanese words inside links carry their reading ("頭|あたま") so furigana needs no extra lookup.
    for e in ko.values():
        e["j"] = sorted(with_reading(w) for w in e["j"])
        e["c"] = sorted(with_reading(w) for w in e["c"])

    for name, table in (("ko", ko), ("ja", ja)):
        shards = collections.defaultdict(dict)
        for w, e in table.items():
            shards[djb2(w) % ENTRY_SHARDS][w] = compact(e, None)
        for i, d in shards.items():
            dump(os.path.join(out, name, f"{i}.json"), d)

    blocks = collections.defaultdict(dict)
    for mid, m in enumerate(meanings):
        en, pos, sense, kos, jas, jr = m
        blocks[mid // MEANING_BLOCK][mid] = [en, pos, sense, kos, [with_reading(w, jr.get(w)) for w in jas]]
    for i, d in blocks.items():
        dump(os.path.join(out, "m", f"{i}.json"), d)

    en_shards = collections.defaultdict(dict)
    for w, mids in en_index.items():
        en_shards[djb2(w) % 64][w] = mids
    for i, d in en_shards.items():
        dump(os.path.join(out, "en", f"{i}.json"), d)

    # Search shards: one line per searchable key, "type\tword\tkey\thint".
    search = collections.defaultdict(list)

    def shard_for(key):
        c = key[0]
        o = ord(c)
        if 0xAC00 <= o <= 0xD7A3:
            return "h%d" % ((o - 0xAC00) // 28)  # first syllable, ignoring its final consonant
        if 0x3040 <= o <= 0x30FF:
            return "k%x" % ord(to_hira(c))
        if KANJI.match(c):
            return "c%d" % (o % 64)
        if "a" <= c <= "z":
            return "l" + key[:2] if len(key) > 1 else None
        return None

    def hint(e):
        g = (e.get("e") or e.get("d") or [""])[0]
        return short(g, 26).replace("\t", " ")

    def put(t, word, key, h):
        if not key:
            return
        s = shard_for(key)
        if s:
            search[s].append(f"{t}\t{word}\t{key}\t{h}")

    for w, e in ko.items():
        h = hint(e)
        put("k", w, w, h)
        put("k", w, norm_latin(e["r"]) or norm_latin(rr(w)), h)
        for hj in e["h"]:
            put("k", w, hj, h)
            shin = "".join(variants.get(c, c) for c in hj)
            if shin != hj:
                put("k", w, shin, h)
    for w, e in ja.items():
        h = hint(e)
        put("j", w, w, h)
        for k in e["k"]:
            if k != w:
                put("j", w, k, h)
        put("j", w, norm_latin(e["r"]), h)
    for w, mids in en_index.items():
        key = norm_latin(w)
        if key:
            put("e", w, key, f"{len(mids)} meaning{'s' if len(mids) > 1 else ''}")
    for s, lines in search.items():
        lines.sort(key=lambda l: (len(l.split("\t")[2]), l))
        with open(os.path.join(out, "s", s + ".txt"), "w", encoding="utf-8") as f:
            f.write("\n".join(lines))

    dump(os.path.join(out, "meta.json"), {
        "koEntries": len(ko), "jaEntries": len(ja), "meanings": len(meanings),
        "entryShards": ENTRY_SHARDS, "meaningBlock": MEANING_BLOCK, "enShards": 64,
        "variants": variants,
        "license": "Wiktionary content, CC BY-SA 4.0. Extracted with Wiktextract (kaikki.org).",
    })


def download(raw):
    os.makedirs(raw, exist_ok=True)
    base = "https://kaikki.org/dictionary/"
    for name in ("ko/ko-extract.jsonl.gz", "ja/ja-extract.jsonl.gz"):
        subprocess.run(["curl", "-sSfo", os.path.join(raw, os.path.basename(name)), base + "downloads/" + name], check=True)
    # Stream the full English export (≈3 GB compressed) and keep only what we need.
    cmd = f"curl -sSf {base}raw-wiktextract-data.jsonl.gz | gzip -dc"
    p = subprocess.Popen(cmd, shell=True, stdout=subprocess.PIPE, text=True, encoding="utf-8")
    fko = open(os.path.join(raw, "en-ko.jsonl"), "w"); fja = open(os.path.join(raw, "en-ja.jsonl"), "w")
    ftr = open(os.path.join(raw, "en-tr.jsonl"), "w")
    for line in p.stdout:
        if '"ko"' not in line and '"ja"' not in line:
            continue
        try:
            e = json.loads(line)
        except ValueError:
            continue
        lc = e.get("lang_code")
        if lc == "ko":
            fko.write(line)
        elif lc == "ja":
            fja.write(line)
        elif lc == "en":
            trs = [t for t in e.get("translations", []) if t.get("lang_code") in ("ko", "ja")]
            if trs:
                ftr.write(json.dumps({"word": e.get("word"), "pos": e.get("pos"), "translations": trs}, ensure_ascii=False) + "\n")
    p.wait()


if __name__ == "__main__":
    main()
