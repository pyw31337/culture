import { injectToCache, saveCache } from './utils/translator';

const translations: Record<string, { en: string, ja: string, zh: string }> = {
    "뮤지컬 〈스윙 데이즈_암호명 A〉": { en: "Musical <Swing Days: Code Name A>", ja: "ミュージカル「スイング・デイズ：暗号名A」", zh: "音乐剧《摇摆节：代号A》" },
    "뮤지컬 〈어서 오세요, 휴남동 서점입니다〉 - 서울(4월)": { en: "Musical <Welcome to the Hyunam-dong Bookshop> - Seoul (April)", ja: "ミュージカル「ようこそ、ヒュナムドン書店へ」 - ソウル(4月)", zh: "音乐剧《欢迎光临，休南洞书店》 - 首尔(4月)" },
    "연극 〈라이어 1탄〉": { en: "Play <Liar vol.1>", ja: "演劇「ライアー 1弾」", zh: "话剧《说谎者 1》" },
    "연극 〈늘근도둑이야기〉": { en: "Play <The Story of Old Thieves>", ja: "演劇「老いた泥棒の物語」", zh: "话剧《老小偷的故事》" },
    "뮤지컬 〈빨래〉": { en: "Musical <Laundry>", ja: "ミュージカル「パルレ(洗濯)」", zh: "音乐剧《洗衣服》" },
    "뮤지컬 〈광화문연가〉": { en: "Musical <Gwanghwamun Sonata>", ja: "ミュージカル「光化門恋歌」", zh: "音乐剧《光化门恋歌》" },
    "연극 〈쉬어매드니스〉": { en: "Play <Shear Madness>", ja: "演劇「シアマドネス」", zh: "话剧《剪刀手爱德华》" },
    "서커스 〈쿠자〉": { en: "Circus <Kooza>", ja: "サーカス「クザ」", zh: "杂技《Kooza》" },
    "어린이 공연 〈옥토넛〉": { en: "Kids Show <Octonauts>", ja: "子供向け公演「オクトノーツ」", zh: "儿童剧《海底小纵队》" },
    "예술의전당 11시 콘서트": { en: "Seoul Arts Center 11am Concert", ja: "芸術の殿堂 11時コンサート", zh: "艺术之殿11点音乐会" },
    "발레 〈호두까기 인형〉": { en: "Ballet <The Nutcracker>", ja: "バレエ「くるみ割り人形」", zh: "芭蕾舞剧《胡桃夹子》" },
    "2024 서울 세계 불꽃 축제": { en: "2024 Seoul International Fireworks Festival", ja: "2024 ソウル世界花火フェスティバル", zh: "2024 首尔世界烟花节" },
    "롯데월드 어드벤처": { en: "Lotte World Adventure", ja: "ロッテワールド・アドベンチャー", zh: "乐天世界冒险乐园" },
    "에버랜드": { en: "Everland", ja: "エバーランド", zh: "爱宝乐园" },
    "남산서울타워": { en: "Namsan Seoul Tower", ja: "南山ソウルタワー", zh: "南山首尔塔" },
    "경복궁": { en: "Gyeongbokgung Palace", ja: "景福宮", zh: "景福宫" },
    "창덕궁": { en: "Changdeokgung Palace", ja: "昌徳宮", zh: "昌德宫" },
    "덕수궁": { en: "Deoksugung Palace", ja: "徳寿宮", zh: "德寿宫" },
    "국립중앙박물관": { en: "National Museum of Korea", ja: "国立中央博物館", zh: "国立中央博物馆" },
    "기획전시": { en: "Special Exhibition", ja: "企画展示", zh: "策划展览" },
    "상설전시": { en: "Permanent Exhibition", ja: "常設展示", zh: "常设展览" },
    "어린이 박물관": { en: "Children's Museum", ja: "子供博物館", zh: "儿童博物馆" }
};

async function manualInjectTitles() {
    process.chdir('/Users/pyw31337/Developer/CultureFlow-New/scripts');
    console.log(`Injecting ${Object.keys(translations).length} title translations...`);
    for (const [ko, vals] of Object.entries(translations)) {
        injectToCache(ko, vals.en, 'en');
        injectToCache(ko, vals.ja, 'ja');
        injectToCache(ko, vals.zh, 'zh');
    }
    saveCache();
    console.log('Title Injection complete.');
}

manualInjectTitles().catch(console.error);
