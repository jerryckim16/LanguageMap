# 한↔日 Word Map

An interactive map of Korean and Japanese words that are built from the same Chinese characters
(**hanja** 한자 in Korean, **kanji** 漢字 in Japanese).

Most Korean and Japanese "Sino" vocabulary shares its roots: 학교 and 学校 (*gakkō*) are the same word,
"school", written with the same two characters. This site draws those connections as a network:

- **Word pairs** (rounded boxes) show the Korean word above the Japanese word.
- **Characters** (circles) link every word that uses them. Bigger circles appear in more words.
- **False friends** (dashed red boxes) look the same but mean different things, e.g. 애인 / 愛人.

## Features

- **Map view**: a force-directed graph you can pan, zoom, and drag. Hover or click to highlight connections.
- **Detail panel**: readings, romanization, a character-by-character breakdown
  (Korean syllable ↔ hanja ↔ kanji ↔ Japanese kana), notes, and related words.
- **Pronunciation**: 🔊 buttons use the browser's built-in Korean and Japanese voices.
- **Search**: by Hangul, kanji/hanja, kana, romanization (macrons optional: `gakko` finds *gakkō*), or English.
  Press `/` to jump to the search box.
- **Filters**: by category, false friends only, or shared characters only.
- **List view**: every word as cards, grouped by category.
- **Sound patterns**: characters grouped by the final consonant of their Korean reading, showing regular
  correspondences such as Korean ㄹ (-l) ↔ Japanese つ/ち (結 결 ↔ けつ).
- **Shareable links**: `#w=学校` opens a word and `#c=学` opens a character.
- Light and dark mode, plus a mobile layout.

## Running it

The site is static HTML, CSS, and JavaScript. There is no build step and nothing to install.

```sh
# Option 1: open index.html directly in a browser
# Option 2: serve the folder locally
python3 -m http.server 8000   # then visit http://localhost:8000
```

D3 is vendored in `vendor/`, so the site works offline (fonts fall back to system fonts).

### Publishing on GitHub Pages

In the repository settings, go to **Pages**, set **Source** to *Deploy from a branch*,
pick the branch, and choose the `/ (root)` folder.

## Adding words

All vocabulary lives in [`data/words.js`](data/words.js). Each entry is one line:

```js
w("學校", "学校", "학교", "hakgyo", "がっ こう", "gakkō", "school", "education"),
//  hanja   kanji   Korean  Korean     Japanese kana,    Japanese  English   category
//  (KO)    (JA)            romaniz.   split per char    romaniz.  meaning
```

For a false friend, leave the English meaning empty and add the meaning in each language:

```js
w("愛人", "愛人", "애인", "aein", "あい じん", "aijin", "", "people",
  { falseFriend: { ko: "sweetheart", ja: "mistress" }, note: "Optional extra explanation." }),
```

Then run the consistency checker (Node 18+):

```sh
node scripts/validate-data.mjs
```

It checks that the hanja, kanji, Hangul, and kana parts line up character by character, that categories exist,
and that each kanji always maps to the same hanja form.

## Project layout

```
index.html               page structure
css/styles.css           styles (light/dark, responsive)
js/app.js                graph, search, views, detail panel
data/words.js            the vocabulary data
scripts/validate-data.mjs  data consistency checks
vendor/d3.min.js         D3 v7.9.0 (ISC license, see vendor/d3-LICENSE.txt)
```
