
export interface HeroTemplate {
    line1: string;
    line2Pre: string;
    highlight: string;
    suffix: string;
    keywords: string[];
    boldPrefix?: string;
    requiredGenres?: string[]; // Only show if these genres exist
    excludeGenres?: string[];  // Do not show if these genres matches are primary
    minMatchCount?: number;    // Minimum number of matching items required to use this template
}

export const HERO_TEMPLATES = {
    general: [
        { line1: "특별한 오늘,", line2Pre: "당신을 위한 ", highlight: "Spotlight", suffix: "는 어디일까요?", keywords: [] },
        { line1: "반복되는 일상 속,", line2Pre: "당신을 위한 ", highlight: "새로운 영감", suffix: "은 어디일까요?", keywords: ["전시", "exhibition"], requiredGenres: ["exhibition"] },
        { line1: "감성이 메마른 날,", line2Pre: "당신을 위한 ", highlight: "설레는 경험", suffix: "은 어디일까요?", keywords: [] },
        { line1: "소중한 사람과 함께,", line2Pre: "당신을 위한 ", highlight: "잊지 못할 추억", suffix: "은 어디일까요?", keywords: ["가족", "연인", "친구"] },
        { line1: "혼자만의 시간이 필요할 때,", line2Pre: "당신을 위한 ", highlight: "특별한 순간", suffix: "은 어디일까요?", keywords: ["혼자", "1인"] },
        { line1: "문득 떠나고 싶은 지금,", line2Pre: "당신을 위한 ", highlight: "뜻밖의 발견", suffix: "이 기다립니다.", keywords: ["여행"] },
        { line1: "지루한 하루의 끝,", line2Pre: "나에게 주는 ", highlight: "작은 선물", suffix: "같은 컨텐츠 어때요?", keywords: ["힐링"] },
        { line1: "가슴 뛰는 설렘,", line2Pre: "놓치면 후회할 ", highlight: "화제의 컨텐츠", suffix: "를 확인하세요.", keywords: ["인기", "추천"] },
        { line1: "오늘 하루는,", line2Pre: "복잡한 생각 비우고 ", highlight: "몰입의 시간", suffix: "을 가져보세요.", keywords: ["몰입"] },
        { line1: "예술이 필요한 순간,", line2Pre: "당신의 마음을 채워줄 ", highlight: "아름다운 이야기", suffix: "가 있습니다.", keywords: ["예술", "스토리"] },
        { line1: "무대 위 벅찬 감동,", line2Pre: "생생하게 살아숨쉬는 ", highlight: "열정의 현장", suffix: "으로 초대합니다.", keywords: ["감동", "열정"] },
        { line1: "평범한 주말을,", line2Pre: "두고두고 기억될 ", highlight: "영화 같은 하루", suffix: "로 만들어보세요.", keywords: ["주말", "영화"] },
        { line1: "혹시, 마음이 답답하신가요?", line2Pre: "꽉 막힌 속을 뻥 뚫어줄 ", highlight: "시원한 무대", suffix: "를 준비했어요.", keywords: ["스트레스", "해소"] },
        { line1: "커피 한 잔보다,", line2Pre: "더 진한 여운을 남길 ", highlight: "예술 한 잔", suffix: " 어떠세요?", keywords: ["커피", "여운"] },
        { line1: "집에만 있기엔 아까워요,", line2Pre: "지금 바로 떠날 수 있는 ", highlight: "컨텐츠 바캉스", suffix: "가 여기 있습니다.", keywords: ["바캉스", "외출"] },
        { line1: "당신의 영혼을 채워줄,", line2Pre: "단 한 조각의 ", highlight: "마지막 퍼즐", suffix: " 같은 컨텐츠.", keywords: ["영혼", "예술"] },
        { line1: "매일 똑같은 하루,", line2Pre: "당신의 일상에 ", highlight: "특별한 BGM", suffix: "을 깔아드릴게요.", keywords: ["음악", "일상"] },
        { line1: "무료한 시간, 뭐 할까 고민된다면,", line2Pre: "저와 함께 ", highlight: "문화 탐험", suffix: " 떠나보실래요?", keywords: ["탐험", "고민"] },
        { line1: "설마 아직도 안 보셨나요?", line2Pre: "남들 다 본다는 ", highlight: "화제의 그 컨텐츠", suffix: "!", keywords: ["유행", "화제"] },
        { line1: "오늘 기분은 어떤가요?", line2Pre: "당신의 기분에 딱 맞는 ", highlight: "맞춤형 무대", suffix: "를 찾아드릴게요.", keywords: ["기분", "맞춤"] },
        { line1: "눈과 귀가 호강하는 날,", line2Pre: "오감을 깨우는 ", highlight: "짜릿한 경험", suffix: "을 선물합니다.", keywords: ["오감", "경험"] },
        { line1: "잠시 스마트폰은 내려놓고,", line2Pre: "눈앞에서 펼쳐지는 ", highlight: "생생한 감동", suffix: "을 느껴보세요.", keywords: ["디지털디톡스", "감동"] }
    ],
    keyword: [
        { line1: "드디어 오늘,", line2Pre: "기다리던 ", highlight: "{keyword}", suffix: " 컨텐츠가 오픈했어요!", keywords: ["{keyword}"] },
        { line1: "요즘 가장 핫한", line2Pre: "", highlight: "{keyword}", suffix: " 소식, 놓치지 않으셨나요?", keywords: ["{keyword}"] },
        { line1: "당신의 취향 저격,", line2Pre: "준비된 ", highlight: "{keyword}", suffix: " 컬렉션을 만나보세요.", keywords: ["{keyword}"] },
        { line1: "지금 딱 예매하기 좋은", line2Pre: "", highlight: "{keyword}", suffix: " 컨텐츠를 만나보세요.", keywords: ["{keyword}"] },
        { line1: "망설이면 늦어요!", line2Pre: "", highlight: "{keyword}", suffix: " 인기 컨텐츠 총집합.", keywords: ["{keyword}"] },
        { line1: "찾으시는 그 컨텐츠,", line2Pre: "", highlight: "{keyword}", suffix: " 관련 정보를 모두 모았습니다.", keywords: ["{keyword}"] },
        { line1: "팬심 저격!", line2Pre: "덕질의 완성은 역시 ", highlight: "{keyword}", suffix: " 직관이죠!", keywords: ["{keyword}"] },
        { line1: "혹시 좋아하세요?", line2Pre: "", highlight: "{keyword}", suffix: " 매니아를 위한 특별 추천.", keywords: ["{keyword}"] },
        { line1: "알림 신청 하셨나요?", line2Pre: "따끈따끈한 ", highlight: "{keyword}", suffix: " 티켓 오픈 소식!", keywords: ["{keyword}"] }
    ],
    weather: {
        rain: [
            { line1: "비 예보가 있는 오늘,", line2Pre: "감성 가득한 ", highlight: "촉촉한 전시/컨텐츠", suffix: " 어떠신가요?", keywords: ["비", "장마", "실내", "전시"] },
            { line1: "우산 챙기셨나요?", line2Pre: "비 오는 날 더 운치 있는 ", highlight: "실내 데이트", suffix: "를 즐겨보세요.", keywords: ["비", "실내", "데이트"] },
            { line1: "흐린 날씨엔 역시,", line2Pre: "기분 전환을 위한 ", highlight: "신나는 공연", suffix: "이 최고죠.", keywords: ["기분전환", "신나는"] },
            { line1: "빗소리와 함께,", line2Pre: "더 깊어지는 ", highlight: "감성 충전", suffix: "의 시간을 가져보세요.", keywords: ["감성", "비"] },
            { line1: "축 쳐지는 궂은 날씨,", line2Pre: "당신의 텐션을 올려줄 ", highlight: "에너지 넘치는 무대", suffix: "가 필요해요.", keywords: ["에너지", "콘서트"] },
            { line1: "비도 오고 그래서,", line2Pre: "당신의 마음을 적실 ", highlight: "음악이 있는 곳", suffix: "을 찾아봤어요.", keywords: ["비", "음악"] },
            { line1: "눅눅한 공기는 잊고,", line2Pre: "쾌적하고 시원한 ", highlight: "공연장 나들이", suffix: "는 어떨까요?", keywords: ["실내", "쾌적"] }
        ],
        snow: [
            { line1: "하얀 눈이 내리는 날,", line2Pre: "포근한 ", highlight: "공연장", suffix: "에서 몸을 녹이세요.", keywords: ["눈", "겨울", "따뜻한"] },
            { line1: "온 세상이 하얀 오늘,", line2Pre: "따뜻한 ", highlight: "감동", suffix: "을 만나보세요.", keywords: ["눈", "감동"] },
            { line1: "손발 시린 겨울,", line2Pre: "마음만은 훈훈하게 ", highlight: "로맨틱한 컨텐츠", suffix: " 어떠세요?", keywords: ["겨울", "로맨틱"] },
            { line1: "눈 오는 날의 낭만,", line2Pre: "영화 주인공처럼 ", highlight: "아름다운 추억", suffix: "을 남겨보세요.", keywords: ["눈", "낭만"] },
            { line1: "첫눈 같은 설렘,", line2Pre: "당신을 기다리는 ", highlight: "순백의 무대", suffix: "가 있습니다.", keywords: ["눈", "설렘"] },
            { line1: "눈길 조심하세요!", line2Pre: "하지만 이 컨텐츠는 ", highlight: "놓치면 후회", suffix: "할지도 몰라요.", keywords: ["눈", "추천"] }
        ],
        clear: [
            { line1: "날씨 좋은 오늘,", line2Pre: "산책하듯 ", highlight: "즐기기 좋은 컨텐츠", suffix: "들을 모았어요.", keywords: ["야외", "산책"] },
            { line1: "화창한 하늘 아래,", line2Pre: "설레는 마음으로 ", highlight: "공연장 나들이", suffix: " 어때요?", keywords: ["나들이"] },
            { line1: "오늘 같은 날씨엔,", line2Pre: "야외 활동 대신 시원한 ", highlight: "공연장 데이트!", suffix: "", keywords: ["데이트", "시원한"] },
            { line1: "햇살 가득한 날,", line2Pre: "어디론가 떠나고 싶다면 ", highlight: "문화 바캉스", suffix: "를 즐겨보세요.", keywords: ["바캉스", "여행"] },
            { line1: "기분 좋은 바람이 불 땐,", line2Pre: "사랑하는 사람과 ", highlight: "설레는 데이트", suffix: "를 계획해보세요.", keywords: ["데이트", "설레는"] },
            { line1: "하늘이 참 예쁘네요,", line2Pre: "이런 날엔 ", highlight: "예쁜 추억", suffix: "을 만들어야죠.", keywords: ["하늘", "추억"] },
            { line1: "햇살맛집 여기 있어요,", line2Pre: "광합성만큼 중요한 ", highlight: "문화 합성", suffix: "의 시간!", keywords: ["햇살", "문화"] }
        ]
    },
    time: {
        friday: [
            { line1: "설레는 금요일,", line2Pre: "한 주 동안 고생한 당신을 위한 ", highlight: "힐링 타임", suffix: "이 필요해요.", keywords: ["금요일", "불금", "힐링"] },
            { line1: "주말의 시작 금요일,", line2Pre: "사랑하는 사람과 함께할 ", highlight: "로맨틱한 데이트", suffix: " 계획하셨나요?", keywords: ["주말", "데이트"] },
            { line1: "불금엔 컨텐츠지!", line2Pre: "화끈하게 스트레스 날려버릴 ", highlight: "열정적인 무대", suffix: "를 즐겨보세요.", keywords: ["불금", "열정"] },
            { line1: "여유로운 주말을 앞두고,", line2Pre: "미리 준비하는 ", highlight: "취향 저격 문화생활", suffix: " 리스트.", keywords: ["주말"] },
            { line1: "칼퇴 준비 되셨나요?", line2Pre: "지금 바로 출발하면 ", highlight: "완벽한 불금", suffix: "을 보낼 수 있어요.", keywords: ["칼퇴", "불금"] }
        ],
        evening: [
            { line1: "오늘도 수고했어요,", line2Pre: "퇴근 후 지친 마음을 달래줄 ", highlight: "위로의 시간", suffix: "을 가져보세요.", keywords: ["퇴근", "위로"] },
            { line1: "칼퇴 부르는 주문,", line2Pre: "지금 바로 달려가고 싶은 ", highlight: "저녁 공연", suffix: "이 기다립니다.", keywords: ["칼퇴", "저녁"] },
            { line1: "하루를 마무리하며,", line2Pre: "나를 채워주는 ", highlight: "풍성한 문화 산책", suffix: " 어떠신가요?", keywords: ["저녁", "산책"] },
            { line1: "어둠이 내리면,", line2Pre: "도시의 밤보다 화려한 ", highlight: "무대의 빛", suffix: "을 만나보세요.", keywords: ["밤", "야경"] },
            { line1: "저녁이 있는 삶,", line2Pre: "당신의 저녁을 더욱 풍요롭게 만들 ", highlight: "특별한 선택", suffix: "입니다.", keywords: ["저녁", "워라밸"] }
        ]
    },
    season: {
        spring: [ // 3, 4, 5
            { line1: "봄바람 휘날리며,", line2Pre: "꽃향기보다 설레는 ", highlight: "봄 맞이 공연", suffix: "으로 나들이 가요.", keywords: ["봄", "꽃"] },
            { line1: "따뜻한 봄날,", line2Pre: "겨우내 얼었던 감성을 녹여줄 ", highlight: "말랑말랑한 전시", suffix: "를 추천해요.", keywords: ["봄", "전시"] },
            { line1: "벚꽃은 졌지만,", line2Pre: "우리들의 봄은 ", highlight: "이제 시작", suffix: "입니다.", keywords: ["봄", "시작"] },
            { line1: "나랑 봄 보러 가지 않을래?", line2Pre: "노래 가사처럼 ", highlight: "설렘 가득한", suffix: " 컨텐츠 어때요?", keywords: ["봄", "설렘"] },
            { line1: "싱그러운 봄기운,", line2Pre: "새로운 시작을 응원하는 ", highlight: "희망찬 무대", suffix: "를 만나보세요.", keywords: ["봄", "희망"] }
        ],
        summer: [ // 6, 7, 8
            { line1: "무더운 여름,", line2Pre: "더위를 시원하게 날려버릴 ", highlight: "짜릿한 페스티벌", suffix: "이 시작됩니다.", keywords: ["여름", "페스티벌", "시원한"] },
            { line1: "해가 길어진 여름밤,", line2Pre: "잠들기 아쉬운 당신을 위한 ", highlight: "심야 괴담? 아니, 심야 컨텐츠!", suffix: "", keywords: ["여름", "심야"] },
            { line1: "여름 휴가 계획 하셨나요?", line2Pre: "멀리 못 간다면 ", highlight: "도심 속 피서", suffix: "를 즐겨보세요.", keywords: ["여름", "휴가"] },
            { line1: "아이스 아메리카노처럼,", line2Pre: "머리끝까지 시원해지는 ", highlight: "쿨한 무대", suffix: "가 기다립니다.", keywords: ["여름", "시원한"] },
            { line1: "뜨거운 태양 아래,", line2Pre: "더 뜨겁게 타오르는 ", highlight: "열정의 현장", suffix: "으로 초대합니다.", keywords: ["여름", "열정"] }
        ],
        autumn: [ // 9, 10, 11
            { line1: "독서의 계절 가을,", line2Pre: "책보다 깊은 울림을 주는 ", highlight: "명작 공연", suffix: "을 만나보세요.", keywords: ["가을", "독서"] },
            { line1: "선선한 가을 바람,", line2Pre: "센치해진 마음을 달래줄 ", highlight: "감성 충만 뮤직", suffix: " 플레이리스트.", keywords: ["가을", "감성"] },
            { line1: "가을 타나 봐요,", line2Pre: "외로운 마음을 달래줄 ", highlight: "따스한 위로", suffix: "가 필요해요.", keywords: ["가을", "위로"] },
            { line1: "단풍보다 붉게 물든,", line2Pre: "예술가들의 ", highlight: "뜨거운 열정", suffix: "을 만나보세요.", keywords: ["가을", "열정"] },
            { line1: "가을밤의 낭만,", line2Pre: "낙엽 밟는 소리보다 좋은 ", highlight: "아름다운 선율", suffix: "에 취해보세요.", keywords: ["가을", "낭만"] }
        ],
        winter: [ // 12, 1, 2
            { line1: "추운 겨울이지만,", line2Pre: "마음의 온도를 높여줄 ", highlight: "따뜻한 공연", suffix: "이 여기 있어요.", keywords: ["겨울", "따뜻한"] },
            { line1: "한 해를 마무리하며,", line2Pre: "소중한 사람들과 나누고픈 ", highlight: "특별한 선물", suffix: " 같은 시간.", keywords: ["연말", "선물"] },
            { line1: "코끝이 찡한 겨울,", line2Pre: "얼어붙은 몸과 마음을 ", highlight: "사르르 녹여줄", suffix: " 감동의 무대.", keywords: ["겨울", "감동"] },
            { line1: "이불 밖은 위험해?", line2Pre: "아니, 이 컨텐츠를 놓치는 게 ", highlight: "더 위험해요!", suffix: "", keywords: ["겨울", "집순이"] },
            { line1: "겨울 밤하늘 별처럼,", line2Pre: "당신의 기억 속에 ", highlight: "오래 반짝일", suffix: " 추억 하나.", keywords: ["겨울", "추억"] },
            { line1: "붕어빵보다 따끈한,", line2Pre: "갓 구워낸 ", highlight: "신작 컨텐츠", suffix: " 소식입니다.", keywords: ["겨울", "신작"] }
        ]
    },
    holiday: {
        newYear: [ // 1.1
            { line1: "새로운 시작 1월,", line2Pre: "올해는 더 행복한 일만 가득하길 ", highlight: "문화생활", suffix: "로 응원합니다.", keywords: ["새해", "신년", "시작"] },
            { line1: "Happy New Year!", line2Pre: "작심삼일이 되지 않도록 ", highlight: "첫 컨텐츠 나들이", suffix: " 계획해볼까요?", keywords: ["새해", "첫"] },
            { line1: "복 많이 받으세요!", line2Pre: "당신의 일 년을 빛내줄 ", highlight: "행운 같은 공연", suffix: "을 추천해요.", keywords: ["새해", "행운"] },
            { line1: "해돋이는 보셨나요?", line2Pre: "떠오르는 태양처럼 ", highlight: "벅찬 감동", suffix: "을 느껴보세요.", keywords: ["새해", "감동"] },
            { line1: "올해의 버킷리스트,", line2Pre: "미뤄왔던 문화생활, ", highlight: "오늘부터 1일", suffix: " 실천해보세요.", keywords: ["버킷리스트", "시작"] }
        ],
        seollal: [ // Lunar New Year
            { line1: "새해 복 많이 받으세요!", line2Pre: "가족들과 함께 나누는 ", highlight: "풍성한 덕담", suffix: " 같은 컨텐츠.", keywords: ["설날", "가족", "전통"] },
            { line1: "즐거운 설 연휴,", line2Pre: "오랜만에 만난 친척들과 ", highlight: "특별한 추억", suffix: "을 만들어보세요.", keywords: ["설날", "가족"] },
            { line1: "명절엔 역시,", line2Pre: "온 가족이 함께 즐기는 ", highlight: "흥겨운 무대", suffix: "가 제격이죠.", keywords: ["설날", "흥겨운"] },
            { line1: "연휴 순삭 방지!", line2Pre: "맛있는 음식 먹고 ", highlight: "소화시킬 겸", suffix: " 공연장 나들이 어때요?", keywords: ["연휴", "나들이"] },
            { line1: "까치 까치 설날은,", line2Pre: "어제고요, 우리 우리 설날은 ", highlight: "문화 즐기는 날", suffix: "이래요.", keywords: ["설날", "동요"] }
        ],
        valentine: [ // 2.14
            { line1: "달콤한 발렌타인,", line2Pre: "사랑하는 연인에게 초콜릿보다 달달한 ", highlight: "컨텐츠 데이트", suffix: "를 선물하세요.", keywords: ["발렌타인", "사랑", "커플"] },
            { line1: "두근두근 설레는 오늘,", line2Pre: "썸타는 그 사람과 ", highlight: "로맨틱한 시간", suffix: "을 보내고 싶다면?", keywords: ["로맨틱", "썸", "데이트"] },
            { line1: "사랑 고백 D-Day,", line2Pre: "성공 확률 100% ", highlight: "분위기 깡패", suffix: " 공연장 추천.", keywords: ["고백", "사랑"] },
            { line1: "솔로라도 괜찮아!", line2Pre: "나 자신을 사랑하는 ", highlight: "셀프 선물", suffix: "같은 하루를 보내세요.", keywords: ["솔로", "선물"] },
            { line1: "초콜릿처럼 녹아드는,", line2Pre: "감미로운 선율의 ", highlight: "러브 송", suffix: "을 들어보세요.", keywords: ["발렌타인", "음악"] }
        ],
        samil: [ // 3.1
            { line1: "대한독립만세!", line2Pre: "3.1절의 의미를 되새기며 ", highlight: "역사가 깃든", suffix: " 전시를 찾아보는 건 어떨까요?", keywords: ["역사", "독립", "대한"] },
            { line1: "뜻깊은 휴일,", line2Pre: "감사한 마음으로 즐기는 ", highlight: "문화 휴식", suffix: "을 제안합니다.", keywords: ["휴일", "문화"] },
            { line1: "그날의 함성,", line2Pre: "잊지 않고 기억하겠습니다. ", highlight: "역사적인", suffix: " 이야기를 만나보세요.", keywords: ["삼일절", "역사"] },
            { line1: "나라 사랑하는 마음,", line2Pre: "태극기 게양하고 ", highlight: "의미 있는 하루", suffix: "를 보내세요.", keywords: ["삼일절", "태극기"] },
            { line1: "봄의 시작과 함께,", line2Pre: "자유와 평화의 가치를 담은 ", highlight: "예술 작품", suffix: "을 감상해보세요.", keywords: ["평화", "예술"] }
        ],
        children: [ // 5.5
            { line1: "오늘은 어린이날!", line2Pre: "우리 아이들의 세상, 꿈과 희망이 가득한 ", highlight: "키즈 컨텐츠", suffix: " 총출동!", keywords: ["어린이", "가족", "키즈"] },
            { line1: "엄마 아빠 사랑해요,", line2Pre: "온 가족이 함께 웃을 수 있는 ", highlight: "패밀리 쇼", suffix: "를 만나보세요.", keywords: ["가족", "사랑"] },
            { line1: "너의 꿈을 응원해,", line2Pre: "아이들의 상상력을 자극하는 ", highlight: "창의력 대장", suffix: " 전시회.", keywords: ["어린이", "꿈"] },
            { line1: "선물 샀니?", line2Pre: "장난감보다 더 오래 기억될 ", highlight: "소중한 추억", suffix: "을 선물해주세요.", keywords: ["어린이날", "선물"] },
            { line1: "세상 모든 어린이들,", line2Pre: "오늘 하루만큼은 주인공이 되어 ", highlight: "신나게 놀아보자", suffix: "!", keywords: ["어린이", "주인공"] }
        ],
        chuseok: [ // Chuseok
            { line1: "더도 말고 덜도 말고 한가위만 같아라,", line2Pre: "보름달처럼 꽉 찬 ", highlight: "감동의 무대", suffix: "가 기다립니다.", keywords: ["추석", "한가위", "가족"] },
            { line1: "풍성한 추석 연휴,", line2Pre: "가족 모두가 만족할 ", highlight: "대작 뮤지컬", suffix: " 어떠신가요?", keywords: ["추석", "뮤지컬", "가족"] },
            { line1: "고향 가는 길,", line2Pre: "지루한 귀성길을 달래줄 ", highlight: "재미있는 읽을거리", suffix: "를 챙겨가세요.", keywords: ["귀성길", "추석"] },
            { line1: "송편 빚고 컨텐츠 보고,", line2Pre: "전통과 현대가 어우러진 ", highlight: "퓨전 국악", suffix: " 컨텐츠는 어때요?", keywords: ["추석", "국악"] },
            { line1: "달님에게 소원을,", line2Pre: "당신의 바램이 이루어지는 ", highlight: "마법 같은 순간", suffix: "을 기원합니다.", keywords: ["소원", "보름달"] }
        ],
        halloween: [ // 10.31
            { line1: "Trick or Treat!", line2Pre: "할로윈의 밤, 등골이 오싹해지는 ", highlight: "이색 호러", suffix: " 체험을 즐겨보세요.", keywords: ["할로윈", "호러", "공포"] },
            { line1: "유령이 나올 것 같은 밤,", line2Pre: "평범한 일상을 깨울 ", highlight: "짜릿한 파티", suffix: " 같은 컨텐츠!", keywords: ["파티", "할로윈"] },
            { line1: "분장 준비 완료?", line2Pre: "누구보다 돋보이는 코스튬 입고 ", highlight: "할로윈 축제", suffix: " 현장으로!", keywords: ["할로윈", "코스튬"] },
            { line1: "오싹하지만 재밌어,", line2Pre: "아이들도 즐길 수 있는 ", highlight: "귀여운 유령", suffix: "들을 만나러 오세요.", keywords: ["할로윈", "가족"] },
            { line1: "오늘 밤 주인공은,", line2Pre: "마녀도 드라큘라도 아닌 ", highlight: "바로 당신", suffix: "입니다.", keywords: ["할로윈", "주인공"] }
        ],
        christmas: [ // 12.23-25
            { line1: "메리 크리스마스!", line2Pre: "산타가 선물처럼 준비한 ", highlight: "환상적인 쇼", suffix: "를 놓치지 마세요.", keywords: ["크리스마스", "성탄", "산타"] },
            { line1: "낭만 가득 성탄절,", line2Pre: "사랑하는 연인과 함께 ", highlight: "기적 같은 순간", suffix: "을 만들어보세요.", keywords: ["크리스마스", "낭만", "연인"] },
            { line1: "Happy Holidays,", line2Pre: "반짝이는 트리보다 빛나는 ", highlight: "당신의 미소", suffix: "를 보고 싶어요.", keywords: ["홀리데이", "트리"] },
            { line1: "화이트 크리스마스일까요?", line2Pre: "눈이 오지 않아도 괜찮아요, ", highlight: "눈꽃 같은 감동", suffix: "이 있으니까요.", keywords: ["크리스마스", "눈"] },
            { line1: "종소리 울려라,", line2Pre: "온 세상에 평화와 사랑을 전하는 ", highlight: "따뜻한 음악회", suffix: "에 초대합니다.", keywords: ["캐롤", "음악회"] }
        ],
        yearEnd: [ // 12.26-31
            { line1: "Good Bye 2025,", line2Pre: "한 해의 마지막 페이지를 ", highlight: "아름다운 선율", suffix: "로 장식해보세요.", keywords: ["연말", "콘서트", "음악회"] },
            { line1: "수고했어 올해도,", line2Pre: "나를 위한 연말 정산, ", highlight: "최고의 공연", suffix: "으로 보상받으세요.", keywords: ["연말", "보상"] },
            { line1: "카운트다운 준비!", line2Pre: "새해를 맞이하는 ", highlight: "벅찬 순간", suffix: "을 함께하고 싶어요.", keywords: ["카운트다운", "새해"] },
            { line1: "연말 모임 장소 고민?", line2Pre: "식상한 술자리 대신 ", highlight: "품격 있는 컨텐츠", suffix: " 회식 어때요?", keywords: ["연말", "모임"] },
            { line1: "아듀 2025,", line2Pre: "지나간 아쉬움은 털어버리고 ", highlight: "새로운 희망", suffix: "을 노래하세요.", keywords: ["송년회", "희망"] }
        ]
    },
    genre: {
        volleyball: [
            { line1: "오늘 배구 경기 어때요?", line2Pre: "스파이크 한 방에 스트레스 날려버릴 ", highlight: "배구 직관", suffix: " 가보자고!", keywords: ["배구", "volleyball", "V-리그"] },
            { line1: "심장이 쫄깃한 랠리,", line2Pre: "코트 위의 뜨거운 열기, ", highlight: "배구장", suffix: "으로 초대합니다.", keywords: ["배구", "volleyball"] },
            { line1: "거침없는 강스파이크!", line2Pre: "선수들의 투지가 빛나는 ", highlight: "승부의 세계", suffix: "를 만나보세요.", keywords: ["배구", "스파이크"] },
            { line1: "배구 여신 보러 갈래?", line2Pre: "TV보다 훨씬 더 생생한 ", highlight: "직관의 매력", suffix: "에 빠져보세요.", keywords: ["배구", "직관"] },
            { line1: "환상적인 블로킹!", line2Pre: "손에 땀을 쥐게 하는 ", highlight: "명승부", suffix: "가 펼쳐집니다.", keywords: ["배구", "블로킹"] }
        ],
        basketball: [
            { line1: "버저비터의 짜릿함!", line2Pre: "0.1초의 승부, ", highlight: "농구 직관", suffix: "의 묘미를 느껴보세요.", keywords: ["농구", "basketball", "KBL"] },
            { line1: "슬램덩크 좋아하세요?", line2Pre: "현실에서 펼쳐지는 ", highlight: "박진감 넘치는 경기", suffix: "가 기다립니다.", keywords: ["농구", "basketball"] },
            { line1: "코트 위를 지배하라,", line2Pre: "선수들의 뜨거운 열정, ", highlight: "농구장", suffix: "에서 확인하세요.", keywords: ["농구", "열정"] },
            { line1: "겨울 실내 스포츠의 꽃,", line2Pre: "추위도 잊게 만드는 ", highlight: "뜨거운 함성", suffix: " 속으로!", keywords: ["농구"] },
            { line1: "마이클 조던 빙의?", line2Pre: "화려한 개인기와 ", highlight: "멋진 덩크슛", suffix: "을 눈앞에서!", keywords: ["농구", "덩크"] }
        ],
        soccer: [
            { line1: "골~인! 함성 소리,", line2Pre: "푸른 잔디 위에서 펼쳐지는 ", highlight: "축구 경기", suffix: " 함께 응원해요.", keywords: ["축구", "soccer", "K리그"] },
            { line1: "오늘은 축구 보는 날,", line2Pre: "치킨 하나 사들고 ", highlight: "축구장 나들이", suffix: " 어떠세요?", keywords: ["축구", "soccer"] },
            { line1: "붉은 악마가 되어볼까?", line2Pre: "심장을 울리는 ", highlight: "뜨거운 응원전", suffix: "에 합류하세요.", keywords: ["축구", "응원"] },
            { line1: "국가대표급 플레이,", line2Pre: "그라운드를 누비는 ", highlight: "선수들의 열정", suffix: "을 응원합니다.", keywords: ["축구", "국가대표"] },
            { line1: "90분의 드라마,", line2Pre: "예측불허 승부의 세계, ", highlight: "축구 직관", suffix: "이 답입니다.", keywords: ["축구", "직관"] }
        ],
        baseball: [
            { line1: "야구장 갈 준비 됐나요?", line2Pre: "9회말 2아웃, ", highlight: "역전의 드라마", suffix: "를 눈앞에서!", keywords: ["야구", "baseball", "KBO"] },
            { line1: "치맥과 함께 야구장!", line2Pre: "다 같이 부르는 ", highlight: "응원가", suffix: "가 그리울 땐 야구장으로!", keywords: ["야구", "baseball", "치맥"] },
            { line1: "홈런볼 날아갑니다!", line2Pre: "스트레스 날려버릴 ", highlight: "시원한 홈런", suffix: " 한 방!", keywords: ["야구", "홈런"] },
            { line1: "가을 야구를 향하여,", line2Pre: "매 경기 명승부, ", highlight: "치열한 순위 싸움", suffix: "을 지켜보세요.", keywords: ["야구", "가을야구"] },
            { line1: "야구는 끝날 때까지,", line2Pre: "끝난 게 아니다! ", highlight: "기적 같은 승리", suffix: "를 믿어보세요.", keywords: ["야구", "명언"] }
        ],
        handball: [
            { line1: "우생순의 감동 그대로,", line2Pre: "작은 공 하나에 담긴 ", highlight: "투지와 열정", suffix: "을 만나보세요.", keywords: ["핸드볼", "handball"] },
            { line1: "스피드와 파워의 조화,", line2Pre: "실내에서 즐기는 ", highlight: "다이내믹한 승부", suffix: " 핸드볼!", keywords: ["핸드볼", "경기"] },
            { line1: "핸드볼 H리그 개막!", line2Pre: "선수들의 거친 숨소리까지 들리는 ", highlight: "생생한 현장", suffix: "으로.", keywords: ["핸드볼", "H리그"] },
            { line1: "던지고 막고 뛰고!", line2Pre: "한시도 눈을 뗄 수 없는 ", highlight: "박진감", suffix: " 넘치는 경기.", keywords: ["핸드볼", "스포츠"] },
            { line1: "비인기? 아니 꿀재미!", line2Pre: "한 번 보면 빠져드는 ", highlight: "핸드볼의 매력", suffix: "을 발견하세요.", keywords: ["핸드볼", "매력"] }
        ],
        hockey: [
            { line1: "빙판 위의 격투기,", line2Pre: "가장 빠르고 거친 스포츠, ", highlight: "아이스하키", suffix: "의 세계로!", keywords: ["하키", "hockey", "아이스하키"] },
            { line1: "퍽! 소리 나는 쾌감,", line2Pre: "시속 160km로 질주하는 ", highlight: "퍽의 움직임", suffix: "을 쫓아보세요.", keywords: ["하키", "퍽"] },
            { line1: "쿨한 링크장 데이트,", line2Pre: "무더위를 날려버릴 ", highlight: "시원한 경기", suffix: " 관람 어때요?", keywords: ["하키", "피서"] },
            { line1: "바디체크의 짜릿함,", line2Pre: "남자들의 뜨거운 승부, ", highlight: "빙판 위의 전쟁", suffix: "이 시작됩니다.", keywords: ["하키", "승부"] },
            { line1: "동계 스포츠의 꽃,", line2Pre: "순백의 링크 위 펼쳐지는 ", highlight: "화려한 플레이", suffix: "를 감상하세요.", keywords: ["하키", "동계"] }
        ],
        musical: [
            { line1: "오늘은 내가 주인공,", line2Pre: "화려한 조명 아래 펼쳐지는 ", highlight: "뮤지컬 한 편", suffix: " 어때요?", keywords: ["뮤지컬", "musical"] },
            { line1: "눈과 귀가 즐거운 시간,", line2Pre: "당신의 감성을 채워줄 ", highlight: "명작 뮤지컬", suffix: "을 만나보세요.", keywords: ["뮤지컬", "musical"] },
            { line1: "브로드웨이 안 부럽다!", line2Pre: "한국에서 만나는 ", highlight: "월드클래스 무대", suffix: "가 여기 있어요.", keywords: ["뮤지컬", "대작"] },
            { line1: "가슴 벅찬 넘버의 향연,", line2Pre: "배우들의 폭팔적인 가창력에 ", highlight: "압도당할 시간", suffix: "입니다.", keywords: ["뮤지컬", "넘버"] },
            { line1: "VIP석 부럽지 않은,", line2Pre: "생생한 감동을 전해줄 ", highlight: "화제의 신작", suffix: "을 소개합니다.", keywords: ["뮤지컬", "신작"] }
        ],
        play: [
            { line1: "대학로 감성 충전,", line2Pre: "배우들의 숨소리까지 느껴지는 ", highlight: "연극 무대", suffix: "로 초대합니다.", keywords: ["연극", "play", "대학로"] },
            { line1: "소소하지만 확실한 행복,", line2Pre: "웃음과 감동이 있는 ", highlight: "연극 한 편", suffix: " 관람하세요.", keywords: ["연극", "play"] },
            { line1: "스크린과는 다른 매력,", line2Pre: "눈앞에서 펼쳐지는 ", highlight: "리얼한 연기", suffix: "에 빠져보세요.", keywords: ["연극", "배우"] },
            { line1: "로맨스부터 스릴러까지,", line2Pre: "취향대로 골라 보는 ", highlight: "다채로운 연극", suffix: "의 세계.", keywords: ["연극", "취향"] },
            { line1: "오늘 뭐 하지? 연극!", line2Pre: "친구, 연인과 함께 ", highlight: "특별한 추억", suffix: " 만들기 딱 좋아요.", keywords: ["연극", "데이트"] }
        ],
        classical: [
            { line1: "우아한 하루의 완성,", line2Pre: "마음을 차분하게 해줄 ", highlight: "클래식 선율", suffix: "을 선물합니다.", keywords: ["클래식", "classical", "음악회"] },
            { line1: "복잡한 생각은 잠시 끄고,", line2Pre: "오케스트라의 ", highlight: "웅장한 울림", suffix: "에 빠져보세요.", keywords: ["클래식", "classical"] },
            { line1: "영혼을 울리는 선율,", line2Pre: "지친 당신을 위로해줄 ", highlight: "치유의 음악", suffix: "이 흐릅니다.", keywords: ["클래식", "힐링"] },
            { line1: "발레의 우아함,", line2Pre: "손끝 하나에도 감정이 실린 ", highlight: "아름다운 몸짓", suffix: "을 감상하세요.", keywords: ["무용", "발레"] },
            { line1: "브런치 콘서트 어때요?", line2Pre: "여유로운 오전, ", highlight: "향긋한 커피와 클래식", suffix: "의 만남.", keywords: ["클래식", "브런치"] }
        ],
        concert: [
            { line1: "떼창 준비되셨나요?", line2Pre: "스트레스 확 날려버릴 ", highlight: "광란의 콘서트", suffix: " 현장으로!", keywords: ["콘서트", "concert"] },
            { line1: "나의 최애를 만나는 날,", line2Pre: "꿈꿔왔던 바로 그 순간, ", highlight: "두근두근 설렘", suffix: " 가득!", keywords: ["콘서트", "팬미팅"] },
            { line1: "음악에 취하는 밤,", line2Pre: "라이브로 듣는 ", highlight: "전율의 무대", suffix: "가 당신을 기다립니다.", keywords: ["콘서트", "라이브"] },
            { line1: "목이 터져라 소리질러!", line2Pre: "모두가 하나 되는 ", highlight: "열정의 도가니", suffix: " 속으로 빠져보세요.", keywords: ["콘서트", "열정"] },
            { line1: "감성 보컬의 라이브,", line2Pre: "지친 마음을 어루만져 줄 ", highlight: "따뜻한 노래", suffix: "를 들려드릴게요.", keywords: ["콘서트", "감성"] }
        ],
        exhibition: [
            { line1: "조용한 사색이 필요한 날,", line2Pre: "나만의 속도로 즐기는 ", highlight: "미술관 데이트", suffix: " 어떠세요?", keywords: ["전시", "exhibition", "미술관"] },
            { line1: "새로운 영감이 필요하다면,", line2Pre: "감각을 깨우는 ", highlight: "특별한 전시", suffix: "를 찾아보세요.", keywords: ["전시", "exhibition"] },
            { line1: "인생샷 성지 여기!", line2Pre: "찍는 족족 화보가 되는 ", highlight: "포토존 가득", suffix: "한 전시회.", keywords: ["전시", "인생샷"] },
            { line1: "예술과 기술의 만남,", line2Pre: "눈을 뗄 수 없는 ", highlight: "몰입형 미디어아트", suffix: "의 세계로.", keywords: ["전시", "미디어아트"] },
            { line1: "도슨트와 함께하는,", line2Pre: "알고 보면 더 재미있는 ", highlight: "친절한 예술 여행", suffix: "을 떠나보세요.", keywords: ["전시", "도슨트"] }
        ],
        activity: [
            { line1: "지루한 건 딱 질색!", line2Pre: "온몸으로 즐기는 ", highlight: "짜릿한 액티비티", suffix: "가 필요해요.", keywords: ["액티비티", "activity"] },
            { line1: "아드레날린 폭발!", line2Pre: "일상의 스트레스를 날려버릴 ", highlight: "익사이팅 체험", suffix: " 도전!", keywords: ["액티비티", "익사이팅"] },
            { line1: "이번 주말 이색 데이트,", line2Pre: "함께 땀 흘리며 더 가까워지는 ", highlight: "커플 액티비티", suffix: " 강추!", keywords: ["액티비티", "데이트"] },
            { line1: "VR부터 실내 스포츠까지,", line2Pre: "날씨 걱정 없이 즐기는 ", highlight: "실내 놀이터", suffix: " 총집합.", keywords: ["액티비티", "실내"] },
            { line1: "방소는 내가 탈출한다!", line2Pre: "두뇌 풀가동, ", highlight: "방탈출 게임", suffix: "의 주인공이 되어보세요.", keywords: ["방탈출", "액티비티"] }
        ],
        class: [
            { line1: "똥손도 금손 되는 마법,", line2Pre: "오늘 하루, 나만의 ", highlight: "취미 찾기", suffix: "에 도전해보세요.", keywords: ["클래스", "class", "원데이"] },
            { line1: "퇴근 후 갓생 살기,", line2Pre: "지친 일상에 활력을 불어넣을 ", highlight: "원데이 클래스", suffix: " 어때요?", keywords: ["클래스", "직장인"] },
            { line1: "나만의 향기 만들기,", line2Pre: "세상에 하나뿐인 ", highlight: "특별한 선물", suffix: "을 직접 만들어보세요.", keywords: ["클래스", "공방"] },
            { line1: "요리부터 드로잉까지,", line2Pre: "배움의 즐거움이 가득한 ", highlight: "취미 부자", suffix: "의 길로 초대합니다.", keywords: ["클래스", "배움"] },
            { line1: "베이킹의 달인 도전!", line2Pre: "달콤한 디저트 냄새 가득한 ", highlight: "쿠킹 클래스", suffix: "에서 힐링하세요.", keywords: ["클래스", "베이킹"] }
        ],


        movie: [
            { line1: "영화 같은 하루,", line2Pre: "고소한 팝콘 냄새와 함께 ", highlight: "스크린 여행", suffix: " 떠나볼까요?", keywords: ["영화", "movie"] },
            { line1: "천만 관객의 선택,", line2Pre: "지금 가장 핫한 ", highlight: "블록버스터", suffix: "를 확인하세요.", keywords: ["영화", "movie"] },
            { line1: "감동의 대서사시,", line2Pre: "손수건 필수! 눈물 콧물 쏙 뺄 ", highlight: "인생 영화", suffix: " 한 편.", keywords: ["영화", "감동"] },
            { line1: "심장이 쫄깃한 스릴러,", line2Pre: "반전에 반전을 거듭하는 ", highlight: "미친 스토리", suffix: "에 빠져보세요.", keywords: ["영화", "스릴러"] },
            { line1: "달달한 로맨스,", line2Pre: "연애 세포 깨워줄 ", highlight: "사랑스러운 영화", suffix: " 추천해드려요.", keywords: ["영화", "로맨스"] }
        ],
        ott: [
            { line1: "이불 밖은 위험해,", line2Pre: "집에서 편안하게 즐기는 ", highlight: "방구석 1열", suffix: " 영화관.", keywords: ["OTT", "넷플릭스"] },
            { line1: "주말 순삭 주의보!", line2Pre: "한 번 시작하면 멈출 수 없는 ", highlight: "마성의 시리즈", suffix: " 정주행.", keywords: ["OTT", "드라마"] },
            { line1: "뭘 볼까 고민될 땐?", line2Pre: "당신의 취향을 저격할 ", highlight: "추천작 리스트", suffix: "를 확인하세요.", keywords: ["OTT", "추천"] },
            { line1: "내 손안의 극장,", line2Pre: "언제 어디서나 즐기는 ", highlight: "무제한 콘텐츠", suffix: "의 바다.", keywords: ["OTT", "콘텐츠"] },
            { line1: "독점 공개작 오픈!", line2Pre: "오직 여기서만 볼 수 있는 ", highlight: "오리지널 시리즈", suffix: "를 만나보세요.", keywords: ["OTT", "오리지널"] }
        ],


    },
    location: [
        { line1: "오늘 {location}에서,", line2Pre: "특별한 ", highlight: "{genre} 한 편", suffix: " 어때요?", keywords: ["{location}"] },
        { line1: "이번 주말, {location}에서", line2Pre: "당신을 기다리는 ", highlight: "{genre} 컨텐츠", suffix: "가 발견되었네요.", keywords: ["{location}"] },
        { line1: "{location} 나들이 가신다면,", line2Pre: "함께 즐기기 좋은 ", highlight: "{genre}", suffix: " 추천드려요.", keywords: ["{location}"] },
        { line1: "{location}의 밤을,", line2Pre: "아름답게 수놓을 ", highlight: "{genre}", suffix: " 어떠신가요?", keywords: ["{location}"] },
        { line1: "{location} 핫플레이스!", line2Pre: "요즘 뜨고 있는 ", highlight: "{genre}", suffix: " 소식을 전해드립니다.", keywords: ["{location}"] }
    ]
};
