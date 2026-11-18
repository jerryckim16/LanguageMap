/*
 * Korean → Japanese translation links for words in general: native words,
 * loanwords, and Sino words that use different characters in each language.
 * (Pairs written with the same characters live in data/words.js.)
 *
 *   t(korean, koreanRomanization, japanese, japaneseKana, japaneseRomanization,
 *     englishGloss, category, options?)
 *
 * One line is one arrow. The same word may appear in several lines: that is
 * how one-to-many mappings are recorded. For example, 머리 has two lines,
 * one to 頭 (head) and one to 髪 (hair).
 *
 * options:
 *   sense:    number for Korean homonyms (눈¹ "eye" vs 눈² "snow"). Lines with
 *             the same Korean text and sense are treated as the same word.
 *   hanja:    the characters behind a Sino-Korean word (e.g. 친구 → "親舊").
 *   koOrigin: "native" | "sino" | "loan"  (default: "sino" if hanja is given,
 *             otherwise "native")
 *   jaOrigin: "native" | "sino" | "loan"  (default: "loan" if written only in
 *             katakana, otherwise "native")
 *   kind:     "translation" (default), "loan" (a borrowed word), or "char"
 *             (same character, but Japanese uses a native reading: 산 / 山 yama)
 *   note:     free-text explanation
 */
(function () {
  const t = (ko, koRom, ja, jaKana, jaRom, en, category, opts = {}) => ({
    ko, koRom, ja, jaKana, jaRom, en, category, ...opts,
  });

  const TRANSLATIONS = [
    // ── Body ────────────────────────────────────────────────────
    t("머리", "meori", "頭", "あたま", "atama", "head", "health",
      { note: "Korean 머리 means both the head and the hair on it. Japanese uses two different words." }),
    t("머리", "meori", "髪", "かみ", "kami", "hair (on the head)", "health"),
    t("머리카락", "meorikarak", "髪", "かみ", "kami", "a hair, strands of hair", "health"),
    t("대머리", "daemeori", "はげ", "はげ", "hage", "bald (person)", "health",
      { note: "대 ('big') + 머리 ('head'). Japanese はげ (禿げ) can also mean a bald patch." }),
    t("털", "teol", "毛", "け", "ke", "body hair, fur", "health"),
    t("얼굴", "eolgul", "顔", "かお", "kao", "face", "health"),
    t("눈", "nun", "目", "め", "me", "eye", "health", { sense: 1 }),
    t("코", "ko", "鼻", "はな", "hana", "nose", "health",
      { note: "Japanese はな is also 花, 'flower', written with a different character." }),
    t("입", "ip", "口", "くち", "kuchi", "mouth", "health"),
    t("귀", "gwi", "耳", "みみ", "mimi", "ear", "health"),
    t("이", "i", "歯", "は", "ha", "tooth", "health", { note: "Colloquial Korean also says 이빨." }),
    t("목", "mok", "首", "くび", "kubi", "neck", "health"),
    t("목", "mok", "喉", "のど", "nodo", "throat", "health",
      { note: "Korean 목 covers both the neck and the throat." }),
    t("어깨", "eokkae", "肩", "かた", "kata", "shoulder", "health"),
    t("가슴", "gaseum", "胸", "むね", "mune", "chest", "health"),
    t("배", "bae", "お腹", "おなか", "onaka", "belly, stomach", "health", { sense: 1 }),
    t("팔", "pal", "腕", "うで", "ude", "arm", "health"),
    t("손", "son", "手", "て", "te", "hand", "health"),
    t("손가락", "songarak", "指", "ゆび", "yubi", "finger", "health"),
    t("발가락", "balgarak", "指", "ゆび", "yubi", "toe", "health",
      { note: "Japanese 指 covers fingers and toes. Toes can be specified as 足の指 (ashi no yubi)." }),
    t("다리", "dari", "足", "あし", "ashi", "leg", "health", { sense: 1,
      note: "Japanese あし covers both the leg and the foot. It is sometimes written 脚 when the leg is meant." }),
    t("발", "bal", "足", "あし", "ashi", "foot", "health"),
    t("피", "pi", "血", "ち", "chi", "blood", "health"),

    // ── Nature ──────────────────────────────────────────────────
    t("하늘", "haneul", "空", "そら", "sora", "sky", "nature"),
    t("바다", "bada", "海", "うみ", "umi", "sea", "nature"),
    t("산", "san", "山", "やま", "yama", "mountain", "nature", { hanja: "山", kind: "char",
      note: "Same character. Korean uses its Sino reading 산 (also in 화산), while Japanese reads it alone with the native word やま. In compounds Japanese uses さん/ざん too (火山 kazan)." }),
    t("강", "gang", "川", "かわ", "kawa", "river", "nature", { hanja: "江" }),
    t("물", "mul", "水", "みず", "mizu", "water", "nature"),
    t("불", "bul", "火", "ひ", "hi", "fire", "nature"),
    t("나무", "namu", "木", "き", "ki", "tree, wood", "nature"),
    t("꽃", "kkot", "花", "はな", "hana", "flower", "nature"),
    t("비", "bi", "雨", "あめ", "ame", "rain", "nature",
      { note: "Japanese あめ is also 飴, 'candy', written with a different character." }),
    t("눈", "nun", "雪", "ゆき", "yuki", "snow", "nature", { sense: 2,
      note: "A different word from 눈 'eye'. They sound alike, though the 'snow' word is traditionally pronounced with a long vowel." }),
    t("바람", "baram", "風", "かぜ", "kaze", "wind", "nature",
      { note: "Japanese かぜ also means 'a cold' (風邪). Korean uses the Sino word 감기 (感氣) for that." }),
    t("달", "dal", "月", "つき", "tsuki", "moon; month", "nature",
      { note: "A neat one-to-one match: both words mean the moon and also a month." }),
    t("별", "byeol", "星", "ほし", "hoshi", "star", "nature"),
    t("돌", "dol", "石", "いし", "ishi", "stone", "nature"),

    // ── Animals ─────────────────────────────────────────────────
    t("개", "gae", "犬", "いぬ", "inu", "dog", "animals"),
    t("고양이", "goyangi", "猫", "ねこ", "neko", "cat", "animals"),
    t("새", "sae", "鳥", "とり", "tori", "bird", "animals"),
    t("닭", "dak", "鶏", "にわとり", "niwatori", "chicken", "animals",
      { note: "Japanese にわとり literally means 'garden bird'." }),
    t("물고기", "mulgogi", "魚", "さかな", "sakana", "fish (alive)", "animals",
      { note: "Literally 'water meat'. Korean has a separate word, 생선, for fish as food. Japanese uses 魚 for both." }),
    t("생선", "saengseon", "魚", "さかな", "sakana", "fish (as food)", "animals", { hanja: "生鮮" }),
    t("소", "so", "牛", "うし", "ushi", "cow, cattle", "animals"),
    t("말", "mal", "馬", "うま", "uma", "horse", "animals", { sense: 1 }),
    t("돼지", "dwaeji", "豚", "ぶた", "buta", "pig", "animals"),
    t("쥐", "jwi", "鼠", "ねずみ", "nezumi", "mouse, rat", "animals",
      { note: "Neither language separates mice from rats in everyday speech." }),
    t("곰", "gom", "熊", "くま", "kuma", "bear", "animals",
      { note: "The similar sound has led some to suggest a very old shared word, but this is not established." }),
    t("벌레", "beolle", "虫", "むし", "mushi", "bug, insect", "animals"),

    // ── Food ────────────────────────────────────────────────────
    t("밥", "bap", "ご飯", "ごはん", "gohan", "cooked rice; a meal", "food", { jaOrigin: "sino",
      note: "In both languages the word for cooked rice also means 'a meal'." }),
    t("쌀", "ssal", "米", "こめ", "kome", "uncooked rice", "food"),
    t("고기", "gogi", "肉", "にく", "niku", "meat", "food", { jaOrigin: "sino" }),
    t("달걀", "dalgyal", "卵", "たまご", "tamago", "egg", "food"),
    t("계란", "gyeran", "卵", "たまご", "tamago", "egg", "food", { hanja: "鷄卵",
      note: "Korean has a native word (달걀) and a Sino word (계란) for 'egg'. Both are common." }),
    t("소금", "sogeum", "塩", "しお", "shio", "salt", "food"),
    t("사탕", "satang", "飴", "あめ", "ame", "candy", "food", { hanja: "砂糖",
      note: "Korean 사탕 is written 砂糖, the same characters Japanese uses for 'sugar' (satō). Korean 'sugar' is 설탕." }),
    t("술", "sul", "酒", "さけ", "sake", "alcoholic drink", "food",
      { note: "In Japanese, さけ / お酒 means alcohol in general. Rice wine specifically is 日本酒 (nihonshu)." }),
    t("맛", "mat", "味", "あじ", "aji", "taste, flavor", "food"),
    t("사과", "sagwa", "りんご", "りんご", "ringo", "apple", "food", { sense: 1, hanja: "沙果", jaOrigin: "sino",
      note: "Japanese りんご comes from the Chinese-derived 林檎 and is usually written in kana." }),
    t("커피", "keopi", "コーヒー", "コーヒー", "kōhī", "coffee", "food", { kind: "loan", koOrigin: "loan" }),
    t("빵", "ppang", "パン", "パン", "pan", "bread", "food", { kind: "loan", koOrigin: "loan",
      note: "Japanese borrowed パン from Portuguese pão, and Korean borrowed 빵 from Japanese." }),
    t("라면", "ramyeon", "ラーメン", "ラーメン", "rāmen", "ramen noodles", "food", { kind: "loan", koOrigin: "loan",
      note: "In Korea, 라면 usually means instant noodles. Japanese ラーメン usually means fresh noodle soup, and the instant kind is インスタントラーメン." }),
    t("김치", "gimchi", "キムチ", "キムチ", "kimuchi", "kimchi", "food", { kind: "loan",
      note: "Borrowed in the other direction: Japanese took this word from Korean." }),

    // ── People & family ─────────────────────────────────────────
    t("사람", "saram", "人", "ひと", "hito", "person", "people"),
    t("아이", "ai", "子供", "こども", "kodomo", "child", "people"),
    t("친구", "chingu", "友達", "ともだち", "tomodachi", "friend", "people", { hanja: "親舊" }),
    t("애인", "aein", "恋人", "こいびと", "koibito", "sweetheart, partner", "people",
      { note: "The correct Japanese for 애인. Its look-alike 愛人 (aijin) means a lover in an affair." }),
    t("어머니", "eomeoni", "お母さん", "おかあさん", "okāsan", "mother", "people"),
    t("아버지", "abeoji", "お父さん", "おとうさん", "otōsan", "father", "people"),
    t("형", "hyeong", "兄", "あに", "ani", "older brother (said by a male)", "people", { hanja: "兄", kind: "char",
      note: "Korean picks the word for an older sibling by the speaker's gender: 형/누나 when a male speaks, 오빠/언니 when a female speaks. Japanese does not." }),
    t("오빠", "oppa", "兄", "あに", "ani", "older brother (said by a female)", "people"),
    t("누나", "nuna", "姉", "あね", "ane", "older sister (said by a male)", "people"),
    t("언니", "eonni", "姉", "あね", "ane", "older sister (said by a female)", "people"),
    t("동생", "dongsaeng", "弟", "おとうと", "otōto", "younger brother", "people", { hanja: "同生",
      note: "Korean 동생 is gender-neutral, while Japanese must choose between 弟 and 妹. Korean can add gender when needed: 남동생 / 여동생." }),
    t("동생", "dongsaeng", "妹", "いもうと", "imōto", "younger sister", "people", { hanja: "同生" }),
    t("남편", "nampyeon", "夫", "おっと", "otto", "husband", "people", { hanja: "男便" }),
    t("아내", "anae", "妻", "つま", "tsuma", "wife", "people"),
    t("할머니", "halmeoni", "おばあさん", "おばあさん", "obāsan", "grandmother", "people"),
    t("할아버지", "harabeoji", "おじいさん", "おじいさん", "ojīsan", "grandfather", "people"),
    t("괜찮아", "gwaenchana", "大丈夫", "だいじょうぶ", "daijōbu", "it's OK, I'm fine", "people", { jaOrigin: "sino",
      note: "The real Korean equivalent of Japanese 大丈夫. Korean 대장부 (大丈夫) means 'a manly man'." }),

    // ── Daily life ──────────────────────────────────────────────
    t("집", "jip", "家", "いえ", "ie", "house, home", "daily", { note: "Japanese also says うち for 'home'." }),
    t("문", "mun", "ドア", "ドア", "doa", "door", "daily", { hanja: "門",
      note: "Korean 문 means both door and gate. Japanese uses ドア for a door and 門 (mon) for a gate." }),
    t("창문", "changmun", "窓", "まど", "mado", "window", "daily", { hanja: "窓門" }),
    t("책", "chaek", "本", "ほん", "hon", "book", "daily", { hanja: "冊", jaOrigin: "sino",
      note: "Two different characters for 'book'. Korean 본 (本) means origin, and Japanese 冊 (satsu) is the counter word for books." }),
    t("옷", "ot", "服", "ふく", "fuku", "clothes", "daily", { jaOrigin: "sino" }),
    t("신발", "sinbal", "靴", "くつ", "kutsu", "shoes", "daily"),
    t("구두", "gudu", "靴", "くつ", "kutsu", "(dress) shoes", "daily", { kind: "loan", koOrigin: "loan",
      note: "Korean 구두 (leather dress shoes) was borrowed from Japanese くつ." }),
    t("가방", "gabang", "鞄", "かばん", "kaban", "bag", "daily", { kind: "loan", koOrigin: "loan",
      note: "Korean 가방 was borrowed from Japanese かばん." }),
    t("우산", "usan", "傘", "かさ", "kasa", "umbrella", "daily", { hanja: "雨傘",
      note: "Japanese also has 雨傘 (amagasa), but plain 傘 is the everyday word." }),
    t("돈", "don", "お金", "おかね", "okane", "money", "daily"),
    t("길", "gil", "道", "みち", "michi", "road, way", "daily"),
    t("이름", "ireum", "名前", "なまえ", "namae", "name", "daily"),
    t("젓가락", "jeotgarak", "箸", "はし", "hashi", "chopsticks", "daily",
      { note: "Japanese はし is also 橋, 'bridge', written with a different character." }),
    t("사과", "sagwa", "謝罪", "しゃざい", "shazai", "apology", "daily", { sense: 2, hanja: "謝過", jaOrigin: "sino",
      note: "A different word from 사과 'apple'. In everyday Japanese, people apologize with ごめんなさい or the verb 謝る (ayamaru)." }),
    t("폐", "pye", "迷惑", "めいわく", "meiwaku", "trouble (caused to others)", "daily", { hanja: "弊", jaOrigin: "sino",
      note: "As in 폐를 끼치다 = 迷惑をかける, 'to cause trouble'. Korean 미혹 (迷惑) is a false friend." }),
    t("컴퓨터", "keompyuteo", "コンピューター", "コンピューター", "konpyūtā", "computer", "daily", { kind: "loan", koOrigin: "loan" }),
    t("텔레비전", "tellebijeon", "テレビ", "テレビ", "terebi", "television", "daily", { kind: "loan", koOrigin: "loan",
      note: "Japanese shortens it to テレビ. Korean also says 티브이 (TV)." }),
    t("아르바이트", "areubaiteu", "アルバイト", "アルバイト", "arubaito", "part-time job", "daily", { kind: "loan", koOrigin: "loan",
      note: "Both come from German Arbeit ('work'). Korean shortens it to 알바, Japanese to バイト." }),

    // ── Transport ───────────────────────────────────────────────
    t("다리", "dari", "橋", "はし", "hashi", "bridge", "transport", { sense: 2,
      note: "A different word from 다리 'leg'. Japanese はし 'bridge' sounds like はし 'chopsticks' (箸)." }),
    t("배", "bae", "船", "ふね", "fune", "ship, boat", "transport", { sense: 2 }),
    t("전철", "jeoncheol", "電車", "でんしゃ", "densha", "(commuter) train", "transport", { hanja: "電鐵", jaOrigin: "sino" }),
    t("전차", "jeoncha", "路面電車", "ろめんでんしゃ", "romen densha", "streetcar, tram", "transport", { hanja: "電車", jaOrigin: "sino" }),

    // ── Education ───────────────────────────────────────────────
    t("공부", "gongbu", "勉強", "べんきょう", "benkyō", "study, studying", "education", { hanja: "工夫", jaOrigin: "sino",
      note: "Both are Sino words, but with different characters. Korean writes 'study' as 工夫, which in Japanese (kufū) means ingenuity." }),

    // ── Feelings & ideas ────────────────────────────────────────
    t("마음", "maeum", "心", "こころ", "kokoro", "heart, mind", "feelings"),
    t("사랑", "sarang", "愛", "あい", "ai", "love (deep, general)", "feelings", { jaOrigin: "sino",
      note: "Korean 사랑 covers all kinds of love. Japanese often separates 愛 (ai, deep love) from 恋 (koi, romantic love)." }),
    t("사랑", "sarang", "恋", "こい", "koi", "love (romantic)", "feelings"),
    t("꿈", "kkum", "夢", "ゆめ", "yume", "dream", "feelings"),
    t("노래", "norae", "歌", "うた", "uta", "song", "culture"),
    t("말", "mal", "言葉", "ことば", "kotoba", "words, speech, language", "language", { sense: 2,
      note: "A different word from 말 'horse'." }),

    // ── Actions & descriptions ──────────────────────────────────
    t("먹다", "meokda", "食べる", "たべる", "taberu", "to eat", "actions"),
    t("먹다", "meokda", "飲む", "のむ", "nomu", "to take (medicine)", "actions",
      { note: "Korean 'eats' medicine (약을 먹다), while Japanese 'drinks' it (薬を飲む)." }),
    t("마시다", "masida", "飲む", "のむ", "nomu", "to drink", "actions"),
    t("가다", "gada", "行く", "いく", "iku", "to go", "actions"),
    t("오다", "oda", "来る", "くる", "kuru", "to come", "actions"),
    t("보다", "boda", "見る", "みる", "miru", "to see, to look", "actions"),
    t("알다", "alda", "知る", "しる", "shiru", "to know", "actions"),
    t("알다", "alda", "分かる", "わかる", "wakaru", "to understand", "actions",
      { note: "Korean 알다 covers 'know' and often 'understand' (알겠어요 = 分かりました)." }),
    t("입다", "ipda", "着る", "きる", "kiru", "to wear (shirts, coats)", "actions",
      { note: "The verbs for 'wear' split differently: Japanese picks by body part, so trousers take 履く (like shoes), while Korean 입다 covers all garments." }),
    t("입다", "ipda", "履く", "はく", "haku", "to wear (trousers, skirts)", "actions"),
    t("신다", "sinda", "履く", "はく", "haku", "to wear (shoes, socks)", "actions"),
    t("쓰다", "sseuda", "被る", "かぶる", "kaburu", "to wear (a hat)", "actions", { sense: 2,
      note: "Korean 쓰다 is used for hats and glasses. Japanese uses かぶる for hats and かける for glasses." }),
    t("쓰다", "sseuda", "掛ける", "かける", "kakeru", "to wear (glasses)", "actions", { sense: 2 }),
    t("끼다", "kkida", "はめる", "はめる", "hameru", "to wear (gloves, a ring)", "actions"),
    t("쓰다", "sseuda", "書く", "かく", "kaku", "to write", "actions", { sense: 1 }),
    t("쓰다", "sseuda", "使う", "つかう", "tsukau", "to use", "actions", { sense: 3 }),
    t("쓰다", "sseuda", "苦い", "にがい", "nigai", "bitter", "actions", { sense: 4 }),
    t("예쁘다", "yeppeuda", "きれい", "きれい", "kirei", "pretty", "actions", { jaOrigin: "sino",
      note: "Japanese きれい (綺麗) means both 'pretty' and 'clean'. Korean uses two words." }),
    t("깨끗하다", "kkaekkeutada", "きれい", "きれい", "kirei", "clean", "actions", { jaOrigin: "sino" }),
    t("덥다", "deopda", "暑い", "あつい", "atsui", "hot (weather)", "actions",
      { note: "Both languages separate hot weather from hot objects. Japanese uses one sound, あつい, with two characters." }),
    t("뜨겁다", "tteugeopda", "熱い", "あつい", "atsui", "hot (to the touch)", "actions"),
    t("춥다", "chupda", "寒い", "さむい", "samui", "cold (weather)", "actions"),
    t("차갑다", "chagapda", "冷たい", "つめたい", "tsumetai", "cold (to the touch)", "actions"),
    t("맛있다", "masitda", "美味しい", "おいしい", "oishii", "delicious", "actions"),
    t("좋다", "jota", "いい", "いい", "ii", "good", "actions"),
    t("싫다", "silta", "嫌", "いや", "iya", "disliked, unpleasant", "actions"),
    t("크다", "keuda", "大きい", "おおきい", "ōkii", "big", "actions"),
    t("작다", "jakda", "小さい", "ちいさい", "chiisai", "small", "actions"),
  ];

  const root = typeof window !== "undefined" ? window : globalThis;
  root.LANGUAGE_MAP_DATA = root.LANGUAGE_MAP_DATA || {};
  root.LANGUAGE_MAP_DATA.TRANSLATIONS = TRANSLATIONS;
})();
