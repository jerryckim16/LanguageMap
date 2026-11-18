/*
 * Korean ↔ Japanese word data.
 *
 * Each entry is a word that exists in both languages, written with the same
 * Chinese characters (Sino-Korean 한자어 / Sino-Japanese 漢語). Translations
 * between different words (native words, loanwords...) live in
 * data/translations.js.
 *
 *   w(hanja, kanji, korean, koreanRomanization,
 *     japaneseKanaPerCharacter, japaneseRomanization,
 *     englishMeaning, category, extra?)
 *
 * - hanja: the traditional characters as used in Korean.
 * - kanji: the (often simplified, shinjitai) characters as used in Japanese.
 *   Must have the same number of characters as `hanja`.
 * - korean: Hangul, one syllable per character.
 * - japaneseKanaPerCharacter: the kana reading split by character with spaces,
 *   exactly as pronounced in this word (e.g. 学校 → "がっ こう").
 * - Romanization: Revised Romanization for Korean, Hepburn for Japanese.
 * - extra (optional):
 *     note:  free-text explanation
 *     falseFriend: { ko: "meaning in Korean", ja: "meaning in Japanese" }
 *       when the shared word means different things in each language.
 *
 * Run `node scripts/validate-data.mjs` after editing to check consistency.
 */
(function () {
  const w = (hanja, kanji, ko, koRom, jaParts, jaRom, en, category, extra = {}) => ({
    hanja, kanji, ko, koRom, jaParts: jaParts.split(" "), ja: jaParts.replace(/ /g, ""),
    jaRom, en, category, ...extra,
  });

  const CATEGORIES = {
    education: { label: "Education", color: "#4e79a7" },
    people:    { label: "People & family", color: "#f28e2b" },
    time:      { label: "Time", color: "#76b7b2" },
    nature:    { label: "Nature & science", color: "#59a14f" },
    health:    { label: "Body & health", color: "#e15759" },
    food:      { label: "Food", color: "#edc948" },
    society:   { label: "Society & nations", color: "#b07aa1" },
    transport: { label: "Transport", color: "#ff9da7" },
    daily:     { label: "Daily life", color: "#9c755f" },
    feelings:  { label: "Feelings & ideas", color: "#d37295" },
    culture:   { label: "Culture & arts", color: "#86bcb6" },
    language:  { label: "Language", color: "#8cd17d" },
    animals:   { label: "Animals", color: "#499894" },
    actions:   { label: "Actions & descriptions", color: "#79706e" },
    expressions: { label: "Expressions", color: "#e17c05" },
    untranslatable: { label: "No exact equivalent", color: "#8a8f98" },
  };

  const WORDS = [
    // ── Education ────────────────────────────────────────────────
    w("學校", "学校", "학교", "hakgyo", "がっ こう", "gakkō", "school", "education"),
    w("學生", "学生", "학생", "haksaeng", "がく せい", "gakusei", "student", "education"),
    w("先生", "先生", "선생", "seonsaeng", "せん せい", "sensei", "teacher", "education",
      { note: "In both languages also a respectful title. Korean uses 선생님 with the honorific suffix; Japanese also calls doctors and lawyers 先生." }),
    w("大學", "大学", "대학", "daehak", "だい がく", "daigaku", "university", "education"),
    w("入學", "入学", "입학", "iphak", "にゅう がく", "nyūgaku", "school admission", "education",
      { note: "A clear sound pattern: Korean final ㅂ (-p) in 입 corresponds to Japanese -u in にゅう (from older -fu)." }),
    w("文學", "文学", "문학", "munhak", "ぶん がく", "bungaku", "literature", "education"),
    w("科學", "科学", "과학", "gwahak", "か がく", "kagaku", "science", "education"),
    w("數學", "数学", "수학", "suhak", "すう がく", "sūgaku", "mathematics", "education"),
    w("學問", "学問", "학문", "hangmun", "がく もん", "gakumon", "learning, scholarship", "education"),
    w("圖書館", "図書館", "도서관", "doseogwan", "と しょ かん", "toshokan", "library", "education"),
    w("宿題", "宿題", "숙제", "sukje", "しゅく だい", "shukudai", "homework", "education"),
    w("試驗", "試験", "시험", "siheom", "し けん", "shiken", "exam, test", "education"),
    w("歷史", "歴史", "역사", "yeoksa", "れき し", "rekishi", "history", "education",
      { note: "歷 is normally 력 in Korean; it becomes 역 at the start of a word (the initial-sound rule, 두음법칙)." }),
    w("工夫", "工夫", "공부", "gongbu", "く ふう", "kufū", "", "education",
      { falseFriend: { ko: "study, studying", ja: "devising, ingenuity, a clever idea" },
        note: "A classic false friend. The Japanese word for 'study' is 勉強 (benkyō), which in Japanese shops can also mean giving a discount." }),

    // ── People & family ─────────────────────────────────────────
    w("人間", "人間", "인간", "ingan", "にん げん", "ningen", "human being", "people"),
    w("家族", "家族", "가족", "gajok", "か ぞく", "kazoku", "family", "people"),
    w("男子", "男子", "남자", "namja", "だん し", "danshi", "man, male", "people",
      { note: "Everyday Korean for 'man'. In Japanese 男子 usually means 'boy' or appears in formal or sports contexts; the everyday words are 男 or 男性." }),
    w("女子", "女子", "여자", "yeoja", "じょ し", "joshi", "woman, female", "people",
      { note: "Everyday Korean for 'woman'. In Japanese 女子 often means 'girl' (女子高生, high-school girl); the everyday words are 女 or 女性. 女 is normally 녀 in Korean but 여 at the start of a word." }),
    w("醫師", "医師", "의사", "uisa", "い し", "ishi", "doctor, physician", "people",
      { note: "In everyday Japanese, 医者 (isha) is more common." }),
    w("人生", "人生", "인생", "insaeng", "じん せい", "jinsei", "(one's) life", "people"),
    w("結婚", "結婚", "결혼", "gyeolhon", "けっ こん", "kekkon", "marriage", "people",
      { note: "Korean final ㄹ (-l) in 결 corresponds to Japanese -tsu in けつ, which becomes っ before こ." }),
    w("父母", "父母", "부모", "bumo", "ふ ぼ", "fubo", "parents", "people",
      { note: "Everyday Korean. In Japanese ふぼ is formal; 両親 (ryōshin) is more common." }),
    w("兄弟", "兄弟", "형제", "hyeongje", "きょう だい", "kyōdai", "siblings, brothers", "people"),
    w("愛人", "愛人", "애인", "aein", "あい じん", "aijin", "", "people",
      { falseFriend: { ko: "sweetheart, boyfriend or girlfriend", ja: "a lover in an affair, mistress" },
        note: "Easy to misuse. Calling your partner 愛人 in Japanese implies an affair." }),
    w("大丈夫", "大丈夫", "대장부", "daejangbu", "だい じょう ぶ", "daijōbu", "", "people",
      { falseFriend: { ko: "a manly, brave man", ja: "all right, OK, no problem" } }),

    // ── Time ────────────────────────────────────────────────────
    w("時間", "時間", "시간", "sigan", "じ かん", "jikan", "time, hour", "time"),
    w("每日", "毎日", "매일", "maeil", "まい にち", "mainichi", "every day", "time"),
    w("週末", "週末", "주말", "jumal", "しゅう まつ", "shūmatsu", "weekend", "time"),
    w("午前", "午前", "오전", "ojeon", "ご ぜん", "gozen", "morning, a.m.", "time"),
    w("午後", "午後", "오후", "ohu", "ご ご", "gogo", "afternoon, p.m.", "time"),
    w("來年", "来年", "내년", "naenyeon", "らい ねん", "rainen", "next year", "time",
      { note: "來 is normally 래 in Korean; it becomes 내 at the start of a word (두음법칙)." }),
    w("昨年", "昨年", "작년", "jangnyeon", "さく ねん", "sakunen", "last year", "time",
      { note: "Everyday Korean. In Japanese 昨年 is formal; 去年 (kyonen) is more common." }),
    w("未來", "未来", "미래", "mirae", "み らい", "mirai", "future", "time"),

    // ── Nature & science ────────────────────────────────────────
    w("自然", "自然", "자연", "jayeon", "し ぜん", "shizen", "nature", "nature"),
    w("世界", "世界", "세계", "segye", "せ かい", "sekai", "world", "nature"),
    w("動物", "動物", "동물", "dongmul", "どう ぶつ", "dōbutsu", "animal", "nature"),
    w("植物", "植物", "식물", "singmul", "しょく ぶつ", "shokubutsu", "plant", "nature"),
    w("天國", "天国", "천국", "cheonguk", "てん ごく", "tengoku", "heaven, paradise", "nature"),
    w("地球", "地球", "지구", "jigu", "ち きゅう", "chikyū", "the Earth", "nature"),
    w("火山", "火山", "화산", "hwasan", "か ざん", "kazan", "volcano", "nature"),
    w("太陽", "太陽", "태양", "taeyang", "たい よう", "taiyō", "the sun", "nature"),
    w("空氣", "空気", "공기", "gonggi", "くう き", "kūki", "air", "nature",
      { note: "Japanese also uses 空気 for the mood of a room, as in 空気を読む ('read the air')." }),
    w("電氣", "電気", "전기", "jeongi", "でん き", "denki", "electricity", "nature",
      { note: "In Japanese, 電気 also means 'the lights'." }),
    w("東西", "東西", "동서", "dongseo", "とう ざい", "tōzai", "east and west", "nature"),
    w("南北", "南北", "남북", "nambuk", "なん ぼく", "nanboku", "north and south", "nature",
      { note: "In Korean, 남북 very often refers to South and North Korea." }),

    // ── Body & health ───────────────────────────────────────────
    w("健康", "健康", "건강", "geongang", "けん こう", "kenkō", "health", "health"),
    w("病院", "病院", "병원", "byeongwon", "びょう いん", "byōin", "hospital", "health"),
    w("心臟", "心臓", "심장", "simjang", "しん ぞう", "shinzō", "heart (the organ)", "health"),
    w("藥局", "薬局", "약국", "yakguk", "やっ きょく", "yakkyoku", "pharmacy", "health"),
    w("運動", "運動", "운동", "undong", "うん どう", "undō", "exercise, sports, a movement", "health"),
    w("生命", "生命", "생명", "saengmyeong", "せい めい", "seimei", "life (being alive)", "health"),

    // ── Food ────────────────────────────────────────────────────
    w("料理", "料理", "요리", "yori", "りょう り", "ryōri", "cooking, cuisine", "food",
      { note: "料 is normally 료 in Korean; it becomes 요 at the start of a word (두음법칙)." }),
    w("野菜", "野菜", "야채", "yachae", "や さい", "yasai", "vegetables", "food",
      { note: "Common in Korean, but the standard Korean word is 채소 (菜蔬)." }),
    w("牛乳", "牛乳", "우유", "uyu", "ぎゅう にゅう", "gyūnyū", "milk", "food"),
    w("食事", "食事", "식사", "siksa", "しょく じ", "shokuji", "meal", "food"),
    w("飮食", "飲食", "음식", "eumsik", "いん しょく", "inshoku", "food; eating and drinking", "food",
      { note: "In Korean 음식 is the everyday word for 'food'. In Japanese 飲食 means 'eating and drinking', as in 飲食店 (restaurant)." }),
    w("砂糖", "砂糖", "설탕", "seoltang", "さ とう", "satō", "sugar", "food",
      { note: "An irregular reading in Korean. 砂 is normally 사 and 糖 usually 당." }),

    // ── Society & nations ───────────────────────────────────────
    w("會社", "会社", "회사", "hoesa", "かい しゃ", "kaisha", "company", "society",
      { note: "The same two characters reversed give 社会 / 사회, 'society'." }),
    w("社會", "社会", "사회", "sahoe", "しゃ かい", "shakai", "society", "society",
      { note: "The same two characters reversed give 会社 / 회사, 'company'." }),
    w("經濟", "経済", "경제", "gyeongje", "けい ざい", "keizai", "economy", "society"),
    w("政治", "政治", "정치", "jeongchi", "せい じ", "seiji", "politics", "society"),
    w("國家", "国家", "국가", "gukga", "こっ か", "kokka", "nation, state", "society"),
    w("韓國", "韓国", "한국", "hanguk", "かん こく", "kankoku", "(South) Korea", "society"),
    w("日本", "日本", "일본", "ilbon", "に ほん", "nihon", "Japan", "society",
      { note: "Also read にっぽん (nippon) in Japanese." }),
    w("中國", "中国", "중국", "jungguk", "ちゅう ごく", "chūgoku", "China", "society"),
    w("外國", "外国", "외국", "oeguk", "がい こく", "gaikoku", "foreign country", "society"),
    w("銀行", "銀行", "은행", "eunhaeng", "ぎん こう", "ginkō", "bank", "society"),
    w("市場", "市場", "시장", "sijang", "し じょう", "shijō", "market", "society",
      { note: "Japanese reads it いちば (ichiba) for a physical marketplace and しじょう (shijō) for a market in the economic sense." }),
    w("法律", "法律", "법률", "beomnyul", "ほう りつ", "hōritsu", "law", "society",
      { note: "A textbook sound pattern: final ㅂ (-p) ↔ ほう (-u), and final ㄹ (-l) ↔ りつ (-tsu)." }),
    w("協力", "協力", "협력", "hyeomnyeok", "きょう りょく", "kyōryoku", "cooperation", "society"),
    w("放送", "放送", "방송", "bangsong", "ほう そう", "hōsō", "broadcast", "society"),
    w("新聞", "新聞", "신문", "sinmun", "しん ぶん", "shinbun", "newspaper", "society"),

    // ── Transport ───────────────────────────────────────────────
    w("自動車", "自動車", "자동차", "jadongcha", "じ どう しゃ", "jidōsha", "automobile, car", "transport"),
    w("自轉車", "自転車", "자전거", "jajeongeo", "じ てん しゃ", "jitensha", "bicycle", "transport",
      { note: "車 is read 거 here, not the usual 차 (compare 자동차)." }),
    w("電車", "電車", "전차", "jeoncha", "でん しゃ", "densha", "", "transport",
      { falseFriend: { ko: "streetcar, tram", ja: "(electric) train" },
        note: "A partial false friend. Korean 전차 is also a homophone of 戰車, 'tank'." }),
    w("空港", "空港", "공항", "gonghang", "くう こう", "kūkō", "airport", "transport"),
    w("道路", "道路", "도로", "doro", "どう ろ", "dōro", "road", "transport"),
    w("地下鐵", "地下鉄", "지하철", "jihacheol", "ち か てつ", "chikatetsu", "subway, metro", "transport"),

    // ── Daily life ──────────────────────────────────────────────
    w("門", "門", "문", "mun", "もん", "mon", "gate", "daily",
      { note: "Korean 문 also means 'door'. Japanese uses ドア for a door and keeps 門 for gates." }),
    w("電話", "電話", "전화", "jeonhwa", "でん わ", "denwa", "telephone", "daily"),
    w("約束", "約束", "약속", "yaksok", "やく そく", "yakusoku", "promise, appointment", "daily"),
    w("準備", "準備", "준비", "junbi", "じゅん び", "junbi", "preparation", "daily",
      { note: "Romanized exactly the same in both languages." }),
    w("無理", "無理", "무리", "muri", "む り", "muri", "unreasonable, impossible, overdoing it", "daily",
      { note: "Romanized exactly the same in both languages." }),
    w("家具", "家具", "가구", "gagu", "か ぐ", "kagu", "furniture", "daily"),
    w("計算", "計算", "계산", "gyesan", "けい さん", "keisan", "calculation", "daily",
      { note: "In Korean, 계산 also means paying the bill: 계산해 주세요 ('the check, please')." }),
    w("注意", "注意", "주의", "juui", "ちゅう い", "chūi", "caution, attention", "daily"),
    w("生活", "生活", "생활", "saenghwal", "せい かつ", "seikatsu", "daily life, living", "daily"),
    w("階段", "階段", "계단", "gyedan", "かい だん", "kaidan", "stairs", "daily"),
    w("便利", "便利", "편리", "pyeolli", "べん り", "benri", "convenient", "daily"),
    w("簡單", "簡単", "간단", "gandan", "かん たん", "kantan", "simple, easy", "daily"),
    w("料金", "料金", "요금", "yogeum", "りょう きん", "ryōkin", "fee, charge", "daily"),
    w("地圖", "地図", "지도", "jido", "ち ず", "chizu", "map", "daily"),
    w("雜誌", "雑誌", "잡지", "japji", "ざっ し", "zasshi", "magazine", "daily"),

    // ── Feelings & ideas ────────────────────────────────────────
    w("感謝", "感謝", "감사", "gamsa", "かん しゃ", "kansha", "gratitude, thanks", "feelings",
      { note: "Behind 감사합니다 ('thank you')." }),
    w("運命", "運命", "운명", "unmyeong", "うん めい", "unmei", "fate, destiny", "feelings"),
    w("幸福", "幸福", "행복", "haengbok", "こう ふく", "kōfuku", "happiness", "feelings"),
    w("自由", "自由", "자유", "jayu", "じ ゆう", "jiyū", "freedom", "feelings"),
    w("平和", "平和", "평화", "pyeonghwa", "へい わ", "heiwa", "peace", "feelings"),
    w("愛情", "愛情", "애정", "aejeong", "あい じょう", "aijō", "affection, love", "feelings"),
    w("安心", "安心", "안심", "ansim", "あん しん", "anshin", "relief, peace of mind", "feelings"),
    w("心理", "心理", "심리", "simni", "しん り", "shinri", "psychology, state of mind", "feelings"),
    w("人氣", "人気", "인기", "ingi", "にん き", "ninki", "popularity", "feelings"),
    w("氣分", "気分", "기분", "gibun", "き ぶん", "kibun", "mood, feeling", "feelings"),
    w("有名", "有名", "유명", "yumyeong", "ゆう めい", "yūmei", "famous", "feelings"),
    w("迷惑", "迷惑", "미혹", "mihok", "めい わく", "meiwaku", "", "feelings",
      { falseFriend: { ko: "bewilderment, being led astray", ja: "trouble, nuisance, bother" } }),

    // ── Culture & arts ──────────────────────────────────────────
    w("文化", "文化", "문화", "munhwa", "ぶん か", "bunka", "culture", "culture"),
    w("音樂", "音楽", "음악", "eumak", "おん がく", "ongaku", "music", "culture"),
    w("映畫", "映画", "영화", "yeonghwa", "えい が", "eiga", "movie, film", "culture"),
    w("寫眞", "写真", "사진", "sajin", "しゃ しん", "shashin", "photograph", "culture"),
    w("野球", "野球", "야구", "yagu", "や きゅう", "yakyū", "baseball", "culture"),

    // ── Language ────────────────────────────────────────────────
    w("言語", "言語", "언어", "eoneo", "げん ご", "gengo", "language", "language"),
    w("韓國語", "韓国語", "한국어", "hangugeo", "かん こく ご", "kankokugo", "the Korean language", "language"),
    w("日本語", "日本語", "일본어", "ilboneo", "に ほん ご", "nihongo", "the Japanese language", "language"),
    w("漢字", "漢字", "한자", "hanja", "かん じ", "kanji", "Chinese characters", "language",
      { note: "The very word for the characters on this map: hanja in Korean, kanji in Japanese." }),
    w("文字", "文字", "문자", "munja", "も じ", "moji", "letter, script, character", "language",
      { note: "In Korean, 문자 also means a text message (SMS)." }),
    w("單語", "単語", "단어", "daneo", "たん ご", "tango", "word, vocabulary", "language"),
    w("意味", "意味", "의미", "uimi", "い み", "imi", "meaning", "language"),
    w("會話", "会話", "회화", "hoehwa", "かい わ", "kaiwa", "conversation", "language"),
  ];

  const root = typeof window !== "undefined" ? window : globalThis;
  root.LANGUAGE_MAP_DATA = Object.assign(root.LANGUAGE_MAP_DATA || {}, { WORDS, CATEGORIES });
})();
