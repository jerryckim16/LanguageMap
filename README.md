# 한→日 Word Map

An interactive map of how Korean words map onto Japanese words. It covers words in general:
native words (대머리 → はげ), loanwords (빵 → パン), and Sino words written with the same characters (학교 ↔ 学校).

Each Korean word is a node, each Japanese word is a node, and **arrows** point from a word to its
translation. That makes it easy to see where the two vocabularies line up one-to-one and where they don't:

| Mapping | Example |
|---|---|
| **One-to-one (↔)**: a bijection | 달 ↔ 月 (both mean "moon" and "month") |
| **Split (1 → 2)** | 머리 → 頭 *head*, 髪 *hair* · 동생 → 弟, 妹 |
| **Merge (2 → 1)** | 다리 *leg*, 발 *foot* → 足 · 물고기, 생선 → 魚 |
| **Many-to-many** | 먹다, 마시다 → 食べる, 飲む (Korean "eats" medicine, Japanese "drinks" it) |

Connections are colored by kind: **same characters**, **same character with a different reading**
(산 / 山 *yama*), **different words**, **loanwords**, and **false friends** (look alike, mean something else).

## Views

- **Mapping**: each category drawn as a function diagram, with the set of Korean words on the left,
  the set of Japanese words on the right, and arrows between them. Every category says whether it is a
  **bijection** and highlights the splits and merges. Flip the direction (한국어 → 日本語 or 日本語 → 한국어)
  to see a split turn into a merge.
- **Network**: a force-directed graph of every word, the translation arrows, and the characters that
  Sino words share (学 connects 학교, 学校, 대학, 大学…).
- **List**: every connection as a card, grouped by category.
- **Sounds**: Sino characters grouped by the final consonant of their Korean reading, showing regular
  sound correspondences such as Korean ㄹ (-l) ↔ Japanese つ/ち (結 결 ↔ けつ).

Also included: search in Hangul, kana, kanji, romanization (macrons optional), or English (press `/`);
filters by category and connection type; "only non-one-to-one" mode; 🔊 pronunciation through the
browser's speech voices; shareable links (`#ko=머리`, `#ja=足`, `#char=学`); light/dark mode; and a mobile layout.

## Running it

The site is static: no build step, nothing to install.

```sh
python3 -m http.server 8000   # then visit http://localhost:8000
```

You can also open `index.html` directly. D3 is vendored in `vendor/`, so the site works offline.
To publish it, go to the repository's **Settings → Pages**, choose *Deploy from a branch*, then pick the branch and the `/ (root)` folder.

## Adding words

**Any Korean → Japanese pair** goes in [`data/translations.js`](data/translations.js), one arrow per line:

```js
t("머리", "meori", "頭", "あたま", "atama", "head", "health"),
t("머리", "meori", "髪", "かみ", "kami", "hair (on the head)", "health"),   // a second arrow = a split
t("대머리", "daemeori", "はげ", "はげ", "hage", "bald (person)", "health"),
t("눈", "nun", "雪", "ゆき", "yuki", "snow", "nature", { sense: 2 }),   // homonym of 눈¹ "eye"
t("빵", "ppang", "パン", "パン", "pan", "bread", "food", { kind: "loan", koOrigin: "loan" }),
```

Options: `sense` (Korean homonym number), `hanja` (characters behind a Sino-Korean word),
`koOrigin` / `jaOrigin` (`native`, `sino`, `loan`), `kind` (`translation`, `loan`, `char`), and `note`.

**Pairs written with the same characters** go in [`data/words.js`](data/words.js). These also record the
character-by-character readings:

```js
w("學校", "学校", "학교", "hakgyo", "がっ こう", "gakkō", "school", "education"),
```

Then check the data (Node 18+):

```sh
node scripts/validate-data.mjs
```

The validator checks scripts and alignment, duplicate arrows, homonym numbering, and consistent readings,
and it prints how many mappings are one-to-one, splits, merges, or many-to-many.

## Project layout

```
index.html                  page structure
css/styles.css              styles (light/dark, responsive)
data/words.js               same-character (Sino) word pairs
data/translations.js        all other Korean → Japanese arrows
js/model.js                 builds the word graph and classifies mappings (also runs in Node)
js/app.js                   mapping diagrams, network, list, sounds, search, detail panel
scripts/validate-data.mjs   data consistency checks
vendor/d3.min.js            D3 v7.9.0 (ISC license, see vendor/d3-LICENSE.txt)
```
