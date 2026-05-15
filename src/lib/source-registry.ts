export interface SourceRegistryEntry {
    key: string;
    file: string;
    label: string;
    homepage?: string;
    seasonal?: boolean;
    freshDays?: number;
    staleDays?: number;
}

export const SOURCE_REGISTRY: SourceRegistryEntry[] = [
    { key: 'interpark', file: 'interpark.json', label: '인터파크 티켓', homepage: 'https://tickets.interpark.com/' },
    { key: 'yes24-exclusive', file: 'yes24-exclusive.json', label: '예스24 티켓', homepage: 'https://ticket.yes24.com/', freshDays: 7, staleDays: 45 },
    { key: 'timeticket', file: 'timeticket.json', label: '타임티켓', homepage: 'https://www.timeticket.co.kr/' },
    { key: 'festival', file: 'festivals.json', label: '대한민국 구석구석', homepage: 'https://korean.visitkorea.or.kr/' },
    { key: 'volleyball', file: 'kovo.json', label: 'KOVO', homepage: 'https://www.kovo.co.kr/', seasonal: true },
    { key: 'basketball', file: 'kbl.json', label: 'KBL', homepage: 'https://www.kbl.or.kr/', seasonal: true },
    { key: 'baseball', file: 'kbo.json', label: 'KBO', homepage: 'https://www.koreabaseball.com/' },
    { key: 'handball', file: 'handball.json', label: '핸드볼코리아', homepage: 'https://www.handballkorea.com/', seasonal: true },
    { key: 'football', file: 'kleague.json', label: 'K리그', homepage: 'https://www.kleague.com/' },
    { key: 'movie', file: 'movies.json', label: '영화' },
    { key: 'myrealtrip-kids', file: 'myrealtrip-kids.json', label: '마이리얼트립 키즈', homepage: 'https://www.myrealtrip.com/', freshDays: 7, staleDays: 60 },
    { key: 'sssd-class', file: 'sssd-class.json', label: '솜씨당', homepage: 'https://www.sssd.co.kr/', freshDays: 7, staleDays: 60 },
    { key: 'umclass', file: 'umclass.json', label: '움클래스', homepage: 'https://www.umclass.com/', freshDays: 7, staleDays: 60 },
    { key: 'mochaclass', file: 'mochaclass.json', label: '모카클래스', homepage: 'https://www.mochaclass.com/', freshDays: 7, staleDays: 60 },
    { key: 'seoul', file: 'seoul-culture.json', label: '서울문화포털', homepage: 'https://culture.seoul.go.kr/', freshDays: 7, staleDays: 45 },
    { key: 'culture-portal', file: 'culture-portal.json', label: '문화포털', homepage: 'https://www.culture.go.kr/' },
    { key: 'mommom', file: 'mommom.json', label: '맘맘', homepage: 'https://mom-mom.net/', freshDays: 7, staleDays: 60 },
    { key: 'mommom-activity', file: 'mommom-activities.json', label: '맘맘 액티비티', homepage: 'https://mom-mom.net/', freshDays: 7, staleDays: 60 },
    { key: 'mommom-exhibition', file: 'mommom-exb.json', label: '맘맘 전시/체험', homepage: 'https://mom-mom.net/', freshDays: 7, staleDays: 60 },
    { key: 'mommom-product', file: 'mommom-products.json', label: '맘맘 상품', homepage: 'https://mom-mom.net/', freshDays: 7, staleDays: 60 },
    { key: 'museum', file: 'museum.json', label: '맘맘 플레이스', homepage: 'https://mom-mom.net/', freshDays: 14, staleDays: 90 },
    { key: 'kopis', file: 'kopis-performances.json', label: 'KOPIS', homepage: 'https://www.kopis.or.kr/' },
    { key: 'tourism', file: 'tourism.json', label: '대한민국 구석구석', homepage: 'https://korean.visitkorea.or.kr/', freshDays: 14, staleDays: 90 },
];

export const SOURCE_REGISTRY_BY_KEY = SOURCE_REGISTRY.reduce<Record<string, SourceRegistryEntry>>((acc, entry) => {
    acc[entry.key] = entry;
    return acc;
}, {});

export function getSourceLabel(sourceKey: string) {
    return SOURCE_REGISTRY_BY_KEY[sourceKey]?.label || sourceKey;
}

function normalizeExternalUrl(url?: string | null) {
    const trimmed = (url || '').trim();
    return /^https?:\/\//i.test(trimmed) ? trimmed : null;
}

export function getSourceOfficialUrl(sourceKey?: string | null, itemUrl?: string | null) {
    return normalizeExternalUrl(itemUrl) || normalizeExternalUrl(SOURCE_REGISTRY_BY_KEY[sourceKey || '']?.homepage);
}
