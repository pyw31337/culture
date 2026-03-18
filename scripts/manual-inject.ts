import { injectToCache, saveCache } from './utils/translator';

const translations: Record<string, { en: string, ja: string, zh: string }> = {
    "서울": { en: "Seoul", ja: "ソウル", zh: "首尔" },
    "경기": { en: "Gyeonggi", ja: "京畿", zh: "京畿" },
    "인천": { en: "Incheon", ja: "仁川", zh: "仁川" },
    "부산": { en: "Busan", ja: "釜山", zh: "釜山" },
    "대구": { en: "Daegu", ja: "大邱", zh: "大邱" },
    "광주": { en: "Gwangju", ja: "光州", zh: "光州" },
    "대전": { en: "Daejeon", ja: "大田", zh: "大田" },
    "울산": { en: "Ulsan", ja: "蔚山", zh: "蔚山" },
    "세종": { en: "Sejong", ja: "世宗", zh: "世宗" },
    "강원": { en: "Gangwon", ja: "江原", zh: "江原" },
    "충북": { en: "Chungbuk", ja: "忠北", zh: "忠北" },
    "충남": { en: "Chungnam", ja: "忠南", zh: "忠南" },
    "전북": { en: "Jeonbuk", ja: "全北", zh: "全北" },
    "전남": { en: "Jeonnam", ja: "全南", zh: "全南" },
    "경북": { en: "Gyeongbuk", ja: "慶北", zh: "庆北" },
    "경남": { en: "Gyeongnam", ja: "慶南", zh: "庆南" },
    "제주": { en: "Jeju", ja: "済州", zh: "济州" },
    "무료": { en: "Free", ja: "無料", zh: "免费" },
    "전석 10,000원": { en: "All seats 10,000 KRW", ja: "全席 10,000ウォン", zh: "全席 10,000韩元" },
    "전석 20,000원": { en: "All seats 20,000 KRW", ja: "全席 20,000ウォン", zh: "全席 20,000韩元" },
    "8세이상": { en: "8 years and older", ja: "8歳以上", zh: "8岁以上" },
    "전체관람가": { en: "All ages", ja: "全年齢対象", zh: "全年龄段" },
    "12세이상관람가": { en: "12 years and older", ja: "12歳以上観覧可", zh: "12岁以上可看" },
    "세종문화회관 대극장": { en: "Sejong Center Grand Theater", ja: "世宗文化会館 大劇場", zh: "世宗文化会馆大剧场" },
    "예술의전당 콘서트홀": { en: "Seoul Arts Center Concert Hall", ja: "芸術の殿堂 コンサートホール", zh: "艺术堂音乐厅" },
    "예술의전당 IBK챔버홀": { en: "Seoul Arts Center IBK Chamber Hall", ja: "芸術の殿堂 IBKチャンバーホール", zh: "艺术堂IBK室内乐厅" },
    "예술의전당 리사이틀홀": { en: "Seoul Arts Center Recital Hall", ja: "芸術の殿堂 リサイトルホール", zh: "艺术堂演奏厅" },
    "금호아트홀 연세": { en: "Kumho Art Hall Yonsei", ja: "クムホアートホール延世", zh: "锦湖艺术厅延世" },
    "영산아트홀": { en: "Youngsan Art Hall", ja: "ヨンサンアートホール", zh: "灵山艺术厅" },
    "롯데콘서트홀": { en: "Lotte Concert Hall", ja: "ロッテコンサートホール", zh: "乐天音乐厅" },
    "국립국악원 예악당": { en: "National Gugak Center Yeakdang", ja: "国立国楽院 礼楽堂", zh: "国立国乐院礼乐堂" },
    "국립국악원 우면당": { en: "National Gugak Center Umyeondang", ja: "国立国楽院 牛眠堂", zh: "国立国乐院牛眠堂" },
    "세종문화회관 체임버홀": { en: "Sejong Center Chamber Hall", ja: "世宗文化会館 チェンバーホール", zh: "世宗文化会馆室内乐厅" },
    "성남아트센터 콘서트홀": { en: "Seongnam Arts Center Concert Hall", ja: "城南アートセンター コンサート홀", zh: "城南艺术中心音乐厅" },
    "고양아람누리 아람음악당": { en: "Goyang Aram Nuri Aram Music Hall", ja: "高陽アラムヌリ アラム音楽堂", zh: "高阳阿람누리音乐厅" },
    "경기아트센터 대공연장": { en: "Gyeonggi Arts Center Grand Theater", ja: "京畿アートセンター 大劇場", zh: "京畿艺术中心大剧场" },
    "수원SK아트리움 대공연장": { en: "Suwon SK Atrium Grand Theater", ja: "水原SKアートリウム 大劇場", zh: "水原SK艺术场大剧场" },
    "LG vs 삼성": { en: "LG vs Samsung", ja: "LG vs サムスン", zh: "LG vs 三星" },
    "KT vs LG": { en: "KT vs LG", ja: "KT vs LG", zh: "KT vs LG" },
    "롯데 vs 삼성": { en: "Lotte vs Samsung", ja: "ロッテ vs サムスン", zh: "乐天 vs 三星" },
    "두산 vs NC": { en: "Doosan vs NC", ja: "斗山 vs NC", zh: "斗山 vs NC" },
    "키움 vs 한화": { en: "Kiwoom vs Hanwha", ja: "キウム vs ハンファ", zh: "Kiwoom vs 韩华" },
    "KIA vs LG": { en: "KIA vs LG", ja: "KIA vs LG", zh: "起亚 vs LG" },
    "한화 vs 후산": { en: "Hanwha vs Doosan", ja: "ハンファ vs 斗山", zh: "韩华 vs 斗山" },
    "SSG vs LG": { en: "SSG vs LG", ja: "SSG vs LG", zh: "SSG vs LG" },
    "고척스카이돔": { en: "Gocheok Sky Dome", ja: "高尺スカイドーム", zh: "高尺天空巨蛋" },
    "예술의전당 자유소극장": { en: "Seoul Arts Center Jayu Theater", ja: "芸術の殿堂 自由小劇場", zh: "艺术之殿自由小剧场" },
    "잠실실내체육관": { en: "Jamsil Interior Gymnasium", ja: "蚕室室内体育館", zh: "蚕室室内体育馆" },
    "장충체육관": { en: "Jangchung Gymnasium", ja: "奨忠体育館", zh: "奖忠体育馆" },
    "K-Art홀": { en: "K-Art Hall", ja: "K-Artホール", zh: "K-Art厅" },
    "올림픽공원 올림픽홀": { en: "Olympic Park Olympic Hall", ja: "オリンピック公園 オリンピックホール", zh: "奥林匹克公园奥林匹克厅" },
    "해운대문화회관 해운홀": { en: "Haeundae Cultural Center Haeun Hall", ja: "海雲台文化会館 海雲ホール", zh: "海云台文化会馆海云厅" },
    "목포시민문화체육센터 소공연장": { en: "Mokpo Citizens Cultural & Sports Center Small Hall", ja: "木浦市民文化体育センター 小劇場", zh: "木浦市民文化体育中心小剧场" },
    "KBS홀": { en: "KBS Hall", ja: "KBSホール", zh: "KBS大厅" },
    "재) 영화의전당 (하늘연극장)": { en: "Busan Cinema Center (Haneulyeon Theater)", ja: "映画の殿堂 (ハヌリョン劇場)", zh: "电影之殿堂 (Haneulyeon剧场)" },
    "양천문화회관 대극장": { en: "Yangcheon Cultural Center Grand Theater", ja: "陽川文化会館 大劇場", zh: "阳川文化会馆大剧场" },
    "종로아이들극장": { en: "Jongno Children's Theater", ja: "鍾路子供劇場", zh: "钟路儿童剧场" },
    "원주백운아트홀": { en: "Wonju Baekun Art Hall", ja: "原州白雲アートホール", zh: "原州白云艺术厅" },
    "덕진예술회관": { en: "Deokjin Arts Center", ja: "徳津芸術会館", zh: "德津艺术会馆" },
    "청라복합문화센터 블루노바홀 공연장": { en: "Cheongna Complex Cultural Center Blue Nova Hall", ja: "青羅複合文化センター ブルーノバホール", zh: "青罗复合文化中心Blue Nova厅" },
    "영등포아트홀": { en: "Yeongdeungpo Art Hall", ja: "永登浦アートホール", zh: "永登浦艺术厅" },
    "서울 · 종로구 · 종로1.2.3.4가동": { en: "Jongno-gu, Seoul", ja: "ソウル・鍾路区", zh: "首尔钟路区" },
    "서울 · 구로구 · 고척1동": { en: "Guro-gu, Seoul", ja: "ソウル・九老区", zh: "首尔九老区" },
    "서울 · 서초구 · 서초3동": { en: "Seocho-gu, Seoul", ja: "ソウル・瑞草区", zh: "首尔瑞草区" },
    "서울 · 송파구 · 방이동": { en: "Songpa-gu, Seoul", ja: "ソウル・松坡区", zh: "首尔松坡区" },
    "서울 · 중구 · 장충동2가": { en: "Jung-gu, Seoul", ja: "ソウル・中区", zh: "首尔中区" },
    "부산 · 해운대구 · 좌동": { en: "Haeundae-gu, Busan", ja: "釜山・海雲台区", zh: "釜山海云台区" },
    "충무아트센터 대극장": { en: "Chungmu Arts Center Grand Theater", ja: "忠武アートセンター 大劇場", zh: "忠武艺术中心大剧场" },
    "광림아트센터 BBCH홀": { en: "Kwanglim Arts Center BBCH Hall", ja: "クァンリムアートセンター BBCHホール", zh: "光林艺术中心BBCH厅" },
    "월": { en: "Mon", ja: "月", zh: "周一" },
    "화": { en: "Tue", ja: "火", zh: "周二" },
    "수": { en: "Wed", ja: "水", zh: "周三" },
    "목": { en: "Thu", ja: "木", zh: "周四" },
    "금": { en: "Fri", ja: "金", zh: "周五" },
    "토": { en: "Sat", ja: "土", zh: "周六" },
    "일": { en: "Sun", ja: "日", zh: "周日" },
    "휴관": { en: "Closed", ja: "休館", zh: "闭馆" },
    "공연 없음": { en: "No Performance", ja: "公演なし", zh: "无演出" },
    "예매가능시간": { en: "Booking Availability", ja: "予約可能時間", zh: "预订可用时间" },
    "인터파크 티켓": { en: "Interpark Ticket", ja: "インターパークチケット", zh: "Interpark票务" },
    "유료 (매표소/예매처 확인)": { en: "Paid (Check Ticket Office/Booking Site)", ja: "有料 (チケット売り场/予約サイト确认)", zh: "收费 (确认售票处/预订网站)" }
};

async function manualInject() {
    process.chdir('/Users/pyw31337/Developer/CultureFlow-New/scripts');
    console.log(`Injecting ${Object.keys(translations).length} manual translations...`);
    for (const [ko, vals] of Object.entries(translations)) {
        injectToCache(ko, vals.en, 'en');
        injectToCache(ko, vals.ja, 'ja');
        injectToCache(ko, vals.zh, 'zh');
    }
    saveCache();
    console.log('Injection complete.');
}

manualInject().catch(console.error);
