
export interface HeroMessage {
    line1: string;
    boldPrefix?: string;
    line2Pre: string;
    highlight: string;
    suffix: string;
}

export const getGenreMessages = (locale: string, params: { hour: number, isWeekend: boolean, isFriday: boolean, month: number }): Record<string, HeroMessage[]> => {
    const { hour, isWeekend, isFriday, month } = params;

    const messages: Record<string, Record<string, HeroMessage[]>> = {
        ko: {
            movie: [
                { line1: "퇴근하고", boldPrefix: "영화", line2Pre: " 한편에 ", highlight: "맥주 한잔", suffix: "만한게 없죠?" },
                { line1: "오늘 밤,", boldPrefix: "영화", line2Pre: "관에서 만나는 ", highlight: "감동", suffix: "은 어떠세요?" },
                { line1: "팝콘 향기 가득한", boldPrefix: "영화", line2Pre: "관, ", highlight: "스크린", suffix: "이 기다리고 있어요." },
                { line1: "어둠 속에서", boldPrefix: "영화", line2Pre: " 한 편과 함께 ", highlight: "힐링", suffix: "해보세요." },
                { line1: hour < 12 ? "조용한 아침," : (hour < 18 ? "나른한 오후," : "깊어가는 밤,"), boldPrefix: "영화", line2Pre: "관에서 ", highlight: "색다른 휴식", suffix: "을 즐겨보세요." },
                { line1: isWeekend ? "여유로운 주말엔" : "지루한 일상엔", boldPrefix: "영화", line2Pre: "! ", highlight: "최신 개봉작", suffix: "을 확인해보세요." },
                { line1: "스크린 속으로", boldPrefix: "영화", line2Pre: " 보러 ", highlight: "떠나볼까요", suffix: "?" },
                { line1: "두 시간의 행복,", boldPrefix: "영화", line2Pre: " 한 편 ", highlight: "어때요", suffix: "?" },
                { line1: "눈과 귀가 즐거운", boldPrefix: "영화", line2Pre: " ", highlight: "시간", suffix: "을 선물해드릴게요." },
                { line1: "오늘의 기분엔", boldPrefix: "영화", line2Pre: " 한 편이 ", highlight: "딱", suffix: "이에요." }
            ],
            musical: [
                { line1: "무대 위 감동,", boldPrefix: "뮤지컬", line2Pre: " 배우들의 ", highlight: "열창", suffix: "이 기다리고 있어요." },
                { line1: "라이브로 느끼는", boldPrefix: "뮤지컬", line2Pre: "의 ", highlight: "감동", suffix: "을 경험해보세요." },
                { line1: "화려한 무대,", boldPrefix: "뮤지컬", line2Pre: "의 ", highlight: "마법", suffix: "에 빠져보세요." },
                { line1: isFriday ? "불타는 금요일엔" : "특별한 날엔", boldPrefix: "뮤지컬", line2Pre: " ", highlight: "대작 무대", suffix: "가 정답이죠." },
                { line1: "배우의 열정이", boldPrefix: "뮤지컬", line2Pre: " 무대를 ", highlight: "빛나게", suffix: " 해요." },
                { line1: "멜로디와 함께하는", boldPrefix: "뮤지컬", line2Pre: " ", highlight: "스토리", suffix: "를 만나보세요." },
                { line1: "넘버 하나하나가", boldPrefix: "뮤지컬", line2Pre: "의 ", highlight: "명장면", suffix: "이에요." },
                { line1: "오늘 밤 주인공은", boldPrefix: "뮤지컬", line2Pre: " ", highlight: "당신", suffix: "이에요." },
                { line1: (month >= 3 && month <= 5) ? "봄바람과 어울리는" : (month >= 11 || month <= 2 ? "겨울밤 따뜻한" : "언제나 설레는"), boldPrefix: "뮤지컬", line2Pre: " ", highlight: "데이트", suffix: " 어때요?" }
            ],
            play: [
                { line1: "배우의 숨결이", boldPrefix: "연극", line2Pre: " 무대에서 ", highlight: "느껴져요", suffix: "." },
                { line1: "작은 무대,", boldPrefix: "연극", line2Pre: "만의 ", highlight: "큰 감동", suffix: "이 있어요." },
                { line1: "살아있는 연기,", boldPrefix: "연극", line2Pre: " ", highlight: "진짜 무대", suffix: "를 만나보세요." },
                { line1: "가까이서 느끼는", boldPrefix: "연극", line2Pre: " 배우의 ", highlight: "열정", suffix: "!" },
                { line1: "눈빛으로 전하는", boldPrefix: "연극", line2Pre: "의 ", highlight: "이야기", suffix: "를 들어보세요." },
                { line1: "무대와 객석이", boldPrefix: "연극", line2Pre: "에서 ", highlight: "하나", suffix: "가 되는 순간." },
                { line1: "오늘 밤,", boldPrefix: "연극", line2Pre: " 한 편 ", highlight: "어떠세요", suffix: "?" },
                { line1: isWeekend ? "주말 대학로 나들이," : "평일 저녁의 여유,", boldPrefix: "연극", line2Pre: "과 ", highlight: "함께", suffix: "하세요." },
                { line1: "배우와 눈을", boldPrefix: "연극", line2Pre: "에서 ", highlight: "마주쳐요", suffix: "." }
            ],
            concert: [
                { line1: "라이브의 전율,", boldPrefix: "콘서트", line2Pre: " ", highlight: "현장", suffix: "을 느껴보세요." },
                { line1: "함께 따라부르는", boldPrefix: "콘서트", line2Pre: " ", highlight: "떼창", suffix: "의 감동!" },
                { line1: "좋아하는 아티스트", boldPrefix: "콘서트", line2Pre: "를 ", highlight: "직접", suffix: " 만나보세요." },
                { line1: isFriday || isWeekend ? "스트레스 날리는" : "지친 하루 끝엔", boldPrefix: "콘서트", line2Pre: " ", highlight: "열광의 밤", suffix: "!" },
                { line1: "응원봉 흔들며", boldPrefix: "콘서트", line2Pre: " ", highlight: "열광", suffix: "하는 밤!" },
                { line1: "현장의 열기를", boldPrefix: "콘서트", line2Pre: "에서 ", highlight: "느껴봐요", suffix: "." },
                { line1: "음악과 하나 되는", boldPrefix: "콘서트", line2Pre: " ", highlight: "순간", suffix: "!" },
                { line1: "앵콜까지 함께하는", boldPrefix: "콘서트", line2Pre: " ", highlight: "밤", suffix: "!" }
            ],
            exhibition: [
                { line1: "작품 앞에서", boldPrefix: "전시", line2Pre: "회장에서 ", highlight: "멈춰서요", suffix: "." },
                { line1: "예술이 주는", boldPrefix: "전시", line2Pre: "의 ", highlight: "영감", suffix: "을 느껴보세요." },
                { line1: hour < 12 ? "조용한 오전의 미술관," : "오후의 따뜻한 전시,", boldPrefix: "전시", line2Pre: " ", highlight: "사색의 시간", suffix: "을 가져보세요." },
                { line1: "여유롭게 거닐며", boldPrefix: "전시", line2Pre: "를 ", highlight: "감상해요", suffix: "." },
                { line1: "사진 찍기 좋은", boldPrefix: "전시", line2Pre: " ", highlight: "인생샷 스팟", suffix: "을 찾아보세요." },
                { line1: "오늘은 문화인으로", boldPrefix: "전시", line2Pre: "회에서 ", highlight: "힐링", suffix: "해요." },
                { line1: "예술적 영감이", boldPrefix: "전시", line2Pre: "에서 ", highlight: "샘솟아요", suffix: "." },
                { line1: "작품과 대화하는", boldPrefix: "전시", line2Pre: " ", highlight: "시간", suffix: "!" }
            ],
            activity: [
                { line1: "몸을 움직이면", boldPrefix: "액티비티", line2Pre: "로 ", highlight: "스트레스 해소", suffix: "!" },
                { line1: "짜릿한 경험,", boldPrefix: "액티비티", line2Pre: " ", highlight: "도전", suffix: "은 어떠세요?" },
                { line1: isWeekend ? "주말엔 역시 밖으로!" : "답답한 일상 탈출,", boldPrefix: "액티비티", line2Pre: "로 ", highlight: "에너지 충전", suffix: "!" },
                { line1: "새로운 도전이", boldPrefix: "액티비티", line2Pre: "에서 ", highlight: "기다려요", suffix: "." },
                { line1: "땀 흘리며 즐기는", boldPrefix: "액티비티", line2Pre: " ", highlight: "재미", suffix: "!" },
                { line1: "아드레날린 폭발!", boldPrefix: "액티비티", line2Pre: " ", highlight: "체험", suffix: "해볼까요?" }
            ]
        },
        en: {
            movie: [
                { line1: "After work,", boldPrefix: "Movie", line2Pre: " and a cold ", highlight: "beer", suffix: " — nothing beats it!" },
                { line1: "Tonight,", boldPrefix: "Movie", line2Pre: " theater brings ", highlight: "emotions", suffix: " to life." },
                { line1: "Popcorn-scented", boldPrefix: "Movie", line2Pre: " theater, the ", highlight: "screen", suffix: " awaits." },
                { line1: "In the dark,", boldPrefix: "Movie", line2Pre: " time for some ", highlight: "healing", suffix: "." },
                { line1: hour < 12 ? "Quiet morning," : (hour < 18 ? "Lazy afternoon," : "Late at night,"), boldPrefix: "Movie", line2Pre: " — enjoy a ", highlight: "unique break", suffix: " at the cinema." },
                { line1: isWeekend ? "Relaxing weekend —" : "Boring routine —", boldPrefix: "Movie", line2Pre: "! Check out the ", highlight: "latest releases", suffix: "." },
                { line1: "Into the screen,", boldPrefix: "Movie", line2Pre: " — shall we ", highlight: "escape", suffix: "?" },
                { line1: "Two hours of joy,", boldPrefix: "Movie", line2Pre: " — ", highlight: "how about it", suffix: "?" },
                { line1: "A treat for your senses,", boldPrefix: "Movie", line2Pre: " ", highlight: "time", suffix: " just for you." },
                { line1: "For today's mood,", boldPrefix: "Movie", line2Pre: " is ", highlight: "perfect", suffix: "." }
            ],
            musical: [
                { line1: "Onstage emotion,", boldPrefix: "Musical", line2Pre: " actors' ", highlight: "powerful vocals", suffix: " await." },
                { line1: "Feel it live,", boldPrefix: "Musical", line2Pre: " ", highlight: "magic", suffix: " like never before." },
                { line1: "Dazzling stage,", boldPrefix: "Musical", line2Pre: " ", highlight: "enchantment", suffix: " awaits." },
                { line1: isFriday ? "On fiery Friday," : "On a special day,", boldPrefix: "Musical", line2Pre: " — a ", highlight: "grand show", suffix: " is the answer." },
                { line1: "The actors' passion", boldPrefix: "Musical", line2Pre: " makes the stage ", highlight: "shine", suffix: "." },
                { line1: "With melodies,", boldPrefix: "Musical", line2Pre: " ", highlight: "story", suffix: " comes alive." },
                { line1: "Every number,", boldPrefix: "Musical", line2Pre: " is a ", highlight: "scene-stealer", suffix: "." },
                { line1: "Tonight's star is", boldPrefix: "Musical", line2Pre: " — ", highlight: "you", suffix: "." },
                { line1: (month >= 3 && month <= 5) ? "Spring breeze calls for" : (month >= 11 || month <= 2 ? "Warm winter night" : "Always exciting"), boldPrefix: "Musical", line2Pre: " ", highlight: "date", suffix: " — how about it?" }
            ],
            play: [
                { line1: "The actor's breath,", boldPrefix: "Theater", line2Pre: " — felt on ", highlight: "stage", suffix: "." },
                { line1: "Small stage,", boldPrefix: "Theater", line2Pre: " — uniquely ", highlight: "big emotions", suffix: "." },
                { line1: "Living performance,", boldPrefix: "Theater", line2Pre: " — the ", highlight: "real stage", suffix: " awaits." },
                { line1: "Up close,", boldPrefix: "Theater", line2Pre: " — feel the actors' ", highlight: "passion", suffix: "!" },
                { line1: "Through their eyes,", boldPrefix: "Theater", line2Pre: " tells its ", highlight: "story", suffix: "." },
                { line1: "Stage and audience", boldPrefix: "Theater", line2Pre: " become ", highlight: "one", suffix: "." },
                { line1: "Tonight,", boldPrefix: "Theater", line2Pre: " — ", highlight: "how about it", suffix: "?" },
                { line1: isWeekend ? "Weekend theater stroll," : "Weeknight leisure,", boldPrefix: "Theater", line2Pre: " — ", highlight: "join in", suffix: "." }
            ],
            concert: [
                { line1: "Live thrills,", boldPrefix: "Concert", line2Pre: " — feel the ", highlight: "venue", suffix: "." },
                { line1: "Sing along at a", boldPrefix: "Concert", line2Pre: " — the joy of ", highlight: "group singing", suffix: "!" },
                { line1: "Your favorite artist,", boldPrefix: "Concert", line2Pre: " — see them ", highlight: "live", suffix: "." },
                { line1: isFriday || isWeekend ? "Blow off steam at a" : "After a long day,", boldPrefix: "Concert", line2Pre: " — a ", highlight: "wild night", suffix: "!" },
                { line1: "Wave your lightstick,", boldPrefix: "Concert", line2Pre: " — a night of ", highlight: "excitement", suffix: "!" },
                { line1: "Feel the energy", boldPrefix: "Concert", line2Pre: " — ", highlight: "live vibes", suffix: "." },
                { line1: "One with the music,", boldPrefix: "Concert", line2Pre: " — a ", highlight: "moment", suffix: "!" },
                { line1: "Encore and beyond,", boldPrefix: "Concert", line2Pre: " — an unforgettable ", highlight: "night", suffix: "!" }
            ],
            exhibition: [
                { line1: "Pause before art,", boldPrefix: "Exhibition", line2Pre: " — ", highlight: "take it in", suffix: "." },
                { line1: "Art's gift,", boldPrefix: "Exhibition", line2Pre: " — feel the ", highlight: "inspiration", suffix: "." },
                { line1: hour < 12 ? "Quiet morning gallery," : "Warm afternoon show,", boldPrefix: "Exhibition", line2Pre: " — ", highlight: "time for reflection", suffix: "." },
                { line1: "Stroll and admire,", boldPrefix: "Exhibition", line2Pre: " — ", highlight: "enjoy the art", suffix: "." },
                { line1: "Photo-worthy,", boldPrefix: "Exhibition", line2Pre: " — find your ", highlight: "perfect spot", suffix: "." },
                { line1: "Be a culture lover,", boldPrefix: "Exhibition", line2Pre: " — ", highlight: "healing", suffix: " awaits." }
            ],
            activity: [
                { line1: "Get moving,", boldPrefix: "Activity", line2Pre: " — ", highlight: "stress relief", suffix: "!" },
                { line1: "Thrilling experience,", boldPrefix: "Activity", line2Pre: " — up for the ", highlight: "challenge", suffix: "?" },
                { line1: isWeekend ? "Weekends are for outdoors!" : "Escape the routine,", boldPrefix: "Activity", line2Pre: " — ", highlight: "recharge", suffix: "!" },
                { line1: "New challenges", boldPrefix: "Activity", line2Pre: " — ", highlight: "await you", suffix: "." },
                { line1: "Sweat and enjoy,", boldPrefix: "Activity", line2Pre: " — pure ", highlight: "fun", suffix: "!" },
                { line1: "Adrenaline rush!", boldPrefix: "Activity", line2Pre: " — ready to ", highlight: "try it", suffix: "?" }
            ]
        },
        zh: {
            movie: [
                { line1: "下班后,", boldPrefix: "电影", line2Pre: " 和冰镇 ", highlight: "啤酒", suffix: " — 无以言表的享受！" },
                { line1: "今晚,", boldPrefix: "电影", line2Pre: " 院里的 ", highlight: "感动", suffix: " 如何？" },
                { line1: "充满爆米花香的", boldPrefix: "电影", line2Pre: " 院, ", highlight: "大银幕", suffix: " 在等待着您。" },
                { line1: "在黑暗中,", boldPrefix: "电影", line2Pre: " 一场 ", highlight: "治愈", suffix: " 之旅。" }
            ],
            musical: [
                { line1: "舞台上的震撼,", boldPrefix: "音乐剧", line2Pre: " 演员们的 ", highlight: "热情演唱", suffix: " 正在等待。" },
                { line1: "现场感受", boldPrefix: "音乐剧", line2Pre: " 的 ", highlight: "魅力", suffix: " 吧。" }
            ],
            play: [
                { line1: "近距离感受", boldPrefix: "话剧", line2Pre: " 演员的 ", highlight: "呼吸", suffix: "。" },
                { line1: "小舞台,", boldPrefix: "话剧", line2Pre: " 也有 ", highlight: "大感动", suffix: "。" }
            ],
            concert: [
                { line1: "现场的颤栗,", boldPrefix: "演唱会", line2Pre: " ", highlight: "现场", suffix: " 魅力！" },
                { line1: "全场大合唱,", boldPrefix: "演唱会", line2Pre: " 的 ", highlight: "震撼", suffix: "！" }
            ],
            exhibition: [
                { line1: "在艺术前驻足,", boldPrefix: "展览", line2Pre: " ", highlight: "静心欣赏", suffix: "。" },
                { line1: "艺术带来的", boldPrefix: "展览", line2Pre: " ", highlight: "灵感", suffix: "。" }
            ],
            activity: [
                { line1: "动起来吧,", boldPrefix: "活动", line2Pre: " ", highlight: "释放压力", suffix: "！" },
                { line1: "惊险刺激的", boldPrefix: "活动", line2Pre: " ", highlight: "挑战", suffix: " 如何？" }
            ]
        },
        ja: {
            movie: [
                { line1: "仕事帰りに", boldPrefix: "映画", line2Pre: " と冷えた ", highlight: "ビール", suffix: "、最高ですよね？" },
                { line1: "今夜、", boldPrefix: "映画", line2Pre: " 館で出会う ", highlight: "感動", suffix: " はいかがですか？" },
                { line1: "ポップコーンの香る", boldPrefix: "映画", line2Pre: " 館、 ", highlight: "スクリーン", suffix: " が待っています。" }
            ],
            musical: [
                { line1: "舞台の感動、", boldPrefix: "ミュージカル", line2Pre: " 俳優の ", highlight: "熱唱", suffix: " が待っています。" },
                { line1: "ライブで感じる", boldPrefix: "ミュージカル", line2Pre: " の ", highlight: "感動", suffix: " を。" }
            ],
            play: [
                { line1: "役者の息遣いを", boldPrefix: "演劇", line2Pre: " の ", highlight: "舞台", suffix: " で感じて。" },
                { line1: "小さな舞台、", boldPrefix: "演劇", line2Pre: " ならではの ", highlight: "大きな感動", suffix: "。" }
            ],
            concert: [
                { line1: "ライブの鼓動、", boldPrefix: "コンサート", line2Pre: " の ", highlight: "熱気", suffix: " を感じて。" },
                { line1: "みんなで歌う", boldPrefix: "コンサート", line2Pre: " の ", highlight: "大合唱", suffix: "！" }
            ],
            exhibition: [
                { line1: "作品の前で", boldPrefix: "展示", line2Pre: " 会場で ", highlight: "足を止めて", suffix: "。" },
                { line1: "芸術がくれる", boldPrefix: "展示", line2Pre: " の ", highlight: "インスピレーション", suffix: "。" }
            ],
            activity: [
                { line1: "体を動かして", boldPrefix: "アクティビティ", line2Pre: " で ", highlight: "ストレス解消", suffix: "！" },
                { line1: "スリル満点、", boldPrefix: "アクティビティ", line2Pre: " に ", highlight: "挑戦", suffix: " しませんか？" }
            ]
        }
    };

    return messages[locale] || messages.en;
};

export const getSearchMessages = (locale: string, cleanSearch: string): HeroMessage[] => {
    const messages: Record<string, HeroMessage[]> = {
        ko: [
            { line1: "찾으시는 컨텐츠,", line2Pre: "입력하신 ", highlight: `"${cleanSearch}"`, suffix: " 결과입니다." },
            { line1: "궁금해하신 정보,", line2Pre: "", highlight: `"${cleanSearch}"`, suffix: " 키워드로 모아봤어요." },
            { line1: "원하시는 그곳,", line2Pre: "", highlight: `"${cleanSearch}"`, suffix: " 관련 소식을 전해드려요." }
        ],
        en: [
            { line1: "Looking for content?", line2Pre: "Results for ", highlight: `"${cleanSearch}"`, suffix: "." },
            { line1: "Curious about this?", line2Pre: "We gathered info for ", highlight: `"${cleanSearch}"`, suffix: "." },
            { line1: "Found what you need,", line2Pre: "News related to ", highlight: `"${cleanSearch}"`, suffix: "." }
        ],
        zh: [
            { line1: "搜索的内容,", line2Pre: "您输入的 ", highlight: `"${cleanSearch}"`, suffix: " 结果如下。" },
            { line1: "好奇的信息,", line2Pre: "为您整理了 ", highlight: `"${cleanSearch}"`, suffix: " 相关的关键词。" },
            { line1: "心仪的选择,", line2Pre: "为您带来 ", highlight: `"${cleanSearch}"`, suffix: " 的最新动态。" }
        ],
        ja: [
            { line1: "お探しのコンテンツ、", line2Pre: "入力された ", highlight: `"${cleanSearch}"`, suffix: " の結果です。" },
            { line1: "気になっていた情報、", line2Pre: "", highlight: `"${cleanSearch}"`, suffix: " キーワードで集めました。" },
            { line1: "お探しのあの場所、", line2Pre: "", highlight: `"${cleanSearch}"`, suffix: " 関連情報をお届けします。" }
        ]
    };

    return messages[locale] || messages.en;
};

export const getLocationMessages = (locale: string, locationString: string): HeroMessage[] => {
    const messages: Record<string, HeroMessage[]> = {
        ko: [
            { line1: "현재,", boldPrefix: locationString, line2Pre: "에서 진행중인 ", highlight: "문화 정보", suffix: "들이에요." },
            { line1: "지금,", boldPrefix: locationString, line2Pre: " 주변의 ", highlight: "핫한 무대", suffix: "를 확인해보세요." },
            { line1: "우리 동네,", boldPrefix: locationString, line2Pre: " 숨은 ", highlight: "문화 예술", suffix: "을 찾아줄게요." }
        ],
        en: [
            { line1: "Right now in", boldPrefix: locationString, line2Pre: " — ", highlight: "cultural events", suffix: " happening." },
            { line1: "Explore", boldPrefix: locationString, line2Pre: " — discover ", highlight: "hot stages", suffix: " nearby." },
            { line1: "In your area,", boldPrefix: locationString, line2Pre: " — find hidden ", highlight: "cultural gems", suffix: "." }
        ],
        zh: [
            { line1: "当前,", boldPrefix: locationString, line2Pre: " 正在进行的 ", highlight: "文化活动", suffix: "。" },
            { line1: "现在,", boldPrefix: locationString, line2Pre: " 周边的 ", highlight: "热门舞台", suffix: " 快来看看吧。" },
            { line1: "身边,", boldPrefix: locationString, line2Pre: " 的隐藏 ", highlight: "艺术之美", suffix: " 为您发掘。" }
        ],
        ja: [
            { line1: "現在、", boldPrefix: locationString, line2Pre: " で開催中の ", highlight: "文化情報", suffix: " です。" },
            { line1: "今、", boldPrefix: locationString, line2Pre: " 周辺の ", highlight: "ホットなステージ", suffix: " をチェック！" },
            { line1: "あなたの街、", boldPrefix: locationString, line2Pre: " の隠れた ", highlight: "芸術", suffix: " をお届けします。" }
        ]
    };

    return messages[locale] || messages.en;
};
export const getLikesPerfMessages = (locale: string): HeroMessage[] => {
    const messages: Record<string, HeroMessage[]> = {
        ko: [
            { line1: "평소에", line2Pre: "좋아요로 Pick 한 ", highlight: "컨텐츠들", suffix: "을 살펴볼까요?" },
            { line1: "당신의", line2Pre: "마음을 사로잡은 ", highlight: "컨텐츠", suffix: "들이에요." },
            { line1: "하트를 눌렀던", line2Pre: "그 순간을 ", highlight: "다시", suffix: " 만나보세요." },
            { line1: "찜해둔", line2Pre: "컨텐츠 중에 ", highlight: "오늘", suffix: " 볼만한 건 뭐가 있을까요?" },
            { line1: "좋아요 리스트,", line2Pre: "당신만의 ", highlight: "컬렉션", suffix: "이에요." },
            { line1: "설렘이 담긴", line2Pre: "컨텐츠 ", highlight: "리스트", suffix: "를 확인해볼게요." },
            { line1: "기억해둔", line2Pre: "그 컨텐츠들, ", highlight: "지금", suffix: " 확인해보세요." },
            { line1: "마음에 담아둔", line2Pre: "컨텐츠 ", highlight: "목록", suffix: "이에요." },
            { line1: "좋아요 버튼,", line2Pre: "진심을 담아 누른 ", highlight: "컨텐츠", suffix: "들이죠." },
            { line1: "당신의 취향이", line2Pre: "반영된 ", highlight: "컨텐츠들", suffix: "을 모아봤어요." }
        ],
        en: [
            { line1: "Shall we look at", line2Pre: "the ", highlight: "contents", suffix: " you picked with likes?" },
            { line1: "These are the", line2Pre: "", highlight: "contents", suffix: " that captured your heart." },
            { line1: "Meet those", highlight: "special moments", line2Pre: " when you pressed the heart ", suffix: " again." },
            { line1: "What is", line2Pre: "worth watching ", highlight: "today", suffix: " among your saved contents?" },
            { line1: "Likes list,", line2Pre: "it's your own ", highlight: "collection", suffix: "." },
            { line1: "Let's check the", line2Pre: "", highlight: "list", suffix: " of contents filled with excitement." },
            { line1: "Those contents you remembered,", highlight: "check them out", line2Pre: " ", suffix: " now." },
            { line1: "This is the", line2Pre: "", highlight: "list", suffix: " of contents you kept in mind." },
            { line1: "The like button,", line2Pre: "these are the ", highlight: "contents", suffix: " you pressed with sincerity." },
            { line1: "We've gathered", line2Pre: "the ", highlight: "contents", suffix: " that reflect your taste." }
        ],
        zh: [
            { line1: "来看看", line2Pre: "您用心点赞的 ", highlight: "内容", suffix: " 吧？" },
            { line1: "这些是", line2Pre: "俘获您 ", highlight: "芳心", suffix: " 的内容。" },
            { line1: "再次开启", highlight: "心动时刻", line2Pre: " 那些按下红心的 ", suffix: " 吧。" },
            { line1: "在收藏的内容中,", line2Pre: "", highlight: "今天", suffix: " 有什么值得看的吗？" },
            { line1: "点赞列表,", line2Pre: "是您专属的 ", highlight: "收藏集", suffix: "。" }
        ],
        ja: [
            { line1: "普段から", line2Pre: "「お気に入り」でピックアップした ", highlight: "コンテンツ", suffix: " を見てみましょうか？" },
            { line1: "あなたの", line2Pre: "心をつかんだ ", highlight: "コンテンツ", suffix: " たちです。" },
            { line1: "ハートを押した", highlight: "あの瞬間", line2Pre: " を ", suffix: " もう一度。" },
            { line1: "お気に入りの中から、", line2Pre: "", highlight: "今日", suffix: " 見る価値のあるものは何でしょうか？" },
            { line1: "いいねリスト、", line2Pre: "あなただけの ", highlight: "コレクション", suffix: " です。" }
        ]
    };
    return messages[locale] || messages.en;
};

export const getLikesVenueMessages = (locale: string): HeroMessage[] => {
    const messages: Record<string, HeroMessage[]> = {
        ko: [
            { line1: "찜한 공연장에서", line2Pre: "오늘 어떤 ", highlight: "컨텐츠", suffix: "가 열리고 있을까요?" },
            { line1: "자주 찾는", line2Pre: "공연장의 ", highlight: "일정", suffix: "을 확인해보세요." },
            { line1: "좋아하는 공연장,", line2Pre: "그곳의 ", highlight: "무대", suffix: "가 기다리고 있어요." },
            { line1: "마음에 든 공연장의", line2Pre: "오늘의 ", highlight: "라인업", suffix: "은 뭘까요?" },
            { line1: "찜한 공연장에서", line2Pre: "새로운 ", highlight: "컨텐츠", suffix: "를 발견해보세요." },
            { line1: "익숙한 그 공연장,", line2Pre: "특별한 ", highlight: "오늘", suffix: "이 될 수도 있어요." },
            { line1: "당신이 사랑하는", line2Pre: "공연장의 ", highlight: "소식", suffix: "을 전해드릴게요." },
            { line1: "공연장 Pick,", line2Pre: "거기서 뭐 ", highlight: "하고 있나", suffix: " 볼까요?" },
            { line1: "찜한 공연장 어때요?", line2Pre: "오늘의 ", highlight: "무대", suffix: "를 확인해보세요." },
            { line1: "자주 가는 그곳,", line2Pre: "새 ", highlight: "컨텐츠", suffix: "가 기다리고 있을지도요." }
        ],
        en: [
            { line1: "At your saved venue,", line2Pre: "What ", highlight: "events", suffix: " are happening today?" },
            { line1: "Your favorite spot,", line2Pre: "Check the ", highlight: "schedule", suffix: "." },
            { line1: "A venue you love,", line2Pre: "The ", highlight: "stage", suffix: " is waiting for you." },
            { line1: "At your fave venue,", line2Pre: "What's today's ", highlight: "lineup", suffix: "?" },
            { line1: "At your saved venue,", line2Pre: "Discover ", highlight: "new content", suffix: "." },
            { line1: "That familiar place,", line2Pre: "It could be a ", highlight: "special day", suffix: "." },
            { line1: "The venue you love,", line2Pre: "Here's the latest ", highlight: "news", suffix: "." },
            { line1: "Venue pick,", line2Pre: "Let's see what's ", highlight: "happening there", suffix: "." },
            { line1: "How about your saved venue?", line2Pre: "Check today's ", highlight: "shows", suffix: "." },
            { line1: "Your go-to spot,", line2Pre: "New ", highlight: "content", suffix: " might be waiting." }
        ],
        zh: [
            { line1: "在您收藏的场馆,", line2Pre: "今天有什么 ", highlight: "活动", suffix: " 吗？" },
            { line1: "常去的", line2Pre: "场馆 ", highlight: "日程", suffix: " 快来确认一下吧。" },
            { line1: "喜欢的演出场馆,", line2Pre: "那里的 ", highlight: "舞台", suffix: " 正在等待着您。" },
            { line1: "心仪场馆的", line2Pre: "今天的 ", highlight: "节目单", suffix: " 会是什么呢？" },
            { line1: "在收藏的场馆里,", line2Pre: "发现 ", highlight: "新内容", suffix: " 吧。" }
        ],
        ja: [
            { line1: "お気に入りの会場で", line2Pre: "今日どんな ", highlight: "コンテンツ", suffix: " が開かれているでしょうか？" },
            { line1: "よく行く", line2Pre: "会場の ", highlight: "スケジュール", suffix: " をチェックしてみてください。" },
            { line1: "好きな会場、", line2Pre: "そこの ", highlight: "ステージ", suffix: " が待っています。" },
            { line1: "お気に入りの会場の", line2Pre: "今日の ", highlight: "ラインナップ", suffix: " は何でしょうか？" },
            { line1: "登録した会場で", line2Pre: "新しい ", highlight: "コンテンツ", suffix: " を発見してみてください。" }
        ]
    };
    return messages[locale] || messages.en;
};
