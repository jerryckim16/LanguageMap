# 한↔日 Language Map

Interactive maps of how Korean and Japanese vocabulary line up. The site has three pages:

| Page | What it shows |
|---|---|
| **Home** (`index.html`) | Overview and links to the two maps. |
| **Kanji overlap** (`kanji.html`) | Words written with the same Chinese characters in both languages (학교 / 学校), linked through the characters they share, plus false friends and sound correspondences (학 ↔ がく). |
| **Dictionary map** (`dictionary.html`) | A full Korean ↔ Japanese dictionary in which every word links to its meanings, synonyms and equivalents, plus curated mapping diagrams. |

Japanese words show **furigana** (hiragana above the kanji) everywhere.

## Dictionary map

**Dictionary tab.** Search 95,597 Korean and 171,091 Japanese entries in Hangul, kana, kanji/hanja, romanization
(`atama`, `gakkou`), or English (`love`). Each entry shows:

- definitions, readings, romanization and hanja;
- **equivalents grouped by meaning**: each sense lists its Japanese (or Korean) words and the synonyms
  in the same language, e.g. 머리 → *head* (頭, 頭部), *mental aptitude* (頭, 頭脳 / synonym 두뇌), *hair* (髪, 髪の毛, 頭髪 / 머리카락, 머리털…);
- **direct translations** from the Korean and Japanese editions of Wiktionary;
- **same-character words**: Korean hanja that match a Japanese spelling (國 is matched to 国);
- **∅ when no equivalent is found**.

The **meaning map** beside the entry draws Korean words, shared meanings and Japanese words as three columns.
Click any word or meaning to add its connections, so you can follow chains such as
머리 → *hair* → 髪 → … or かける → 걸다, 달리다, 모자라다, 곱하기….

**Mappings / Network / List tabs.** A hand-curated set of about 280 connections, drawn as function diagrams per category:

- one-to-one (↔), **splits** (머리 → 頭 *head*, 髪 *hair*), **merges** (다리, 발 → 足), many-to-many (먹다, 마시다 → 食べる, 飲む);
- **no equivalent**: words that map to ∅ (눈치, 정, 한, 화병, 木漏れ日, 積ん読, 侘び寂び, もったいない…),
  with a dotted line to the closest match where one exists (눈치 ≈ 空気を読む);
- **expressions English lacks but Korean and Japanese share** (잘 먹겠습니다 ↔ いただきます);
- false friends, loanwords, and same character with a different reading (산 / 山 *yama*);
- a direction switch (한국어 → 日本語 or 日本語 → 한국어) that turns splits into merges.

## Running it

The site is static, with no build step needed to view it. The dictionary loads JSON files, so serve the folder over HTTP:

```sh
python3 -m http.server 8000   # then visit http://localhost:8000
```

To publish it, go to the repository's **Settings → Pages**, choose *Deploy from a branch*, then pick the branch and the `/ (root)` folder.

## Data

### Full dictionary (`data/dict/`)

Built by [`scripts/build_dictionary.py`](scripts/build_dictionary.py) from Wiktionary, via the machine-readable
exports at [kaikki.org](https://kaikki.org/):

- **English Wiktionary**: every Korean and Japanese entry (glosses, readings, hanja), plus the per-sense
  translation tables of English entries. Those senses become the shared **meanings** that connect synonyms
  and words with many meanings.
- **Korean Wiktionary**: Korean definitions, and Japanese words defined in Korean.
- **Japanese Wiktionary**: Japanese definitions, and Korean words defined in Japanese.

To rebuild (downloads about 3.2 GB, streamed, and keeps about 600 MB on disk; takes a few minutes):

```sh
python3 scripts/build_dictionary.py --raw /tmp/wikt --download --out data/dict
```

Coverage follows Wiktionary: common words are well covered, but "no equivalent found" can also mean that
Wiktionary simply hasn't listed one. Links parsed from definitions are noisier than the translation tables.
**License:** the generated data is CC BY-SA 4.0 (see [`data/dict/README.md`](data/dict/README.md)).

### Curated data

| File | Contents |
|---|---|
| [`data/words.js`](data/words.js) | Same-character word pairs with per-character readings (drives the kanji page). |
| [`data/translations.js`](data/translations.js) | Korean → Japanese arrows (`t(...)`) and words with no equivalent (`n(...)`). |

```js
t("머리", "meori", "頭", "あたま", "atama", "head", "health"),
t("머리", "meori", "髪", "かみ", "kami", "hair (on the head)", "health"),   // a second arrow = a split
n("ko", "눈치", "nunchi", "", "the knack of reading the room", {
  closest: [{ word: "空気を読む", kana: "くうきをよむ", rom: "kūki o yomu", en: "to 'read the air'" }] }),
```

Check the curated data with `node scripts/validate-data.mjs`.

## Project layout

```
index.html                    home page
kanji.html  js/kanji.js       kanji overlap map  (css/kanji.css)
dictionary.html               dictionary map
  js/dictionary.js            full-dictionary search, entries, meaning map
  js/app.js                   curated mappings, network, list
  js/model.js                 builds the curated word graph (also runs in Node)
js/furigana.js                furigana alignment (HTML <ruby> and SVG) and kana → romaji
css/styles.css  css/site.css  styles
data/                         curated data and the generated dictionary
scripts/build_dictionary.py   builds data/dict from Wiktionary
scripts/validate-data.mjs     checks the curated data
vendor/d3.min.js              D3 v7.9.0 (ISC license)
```
