export interface SourceRegistryEntry {
    key: string;
    file: string;
    label: string;
    seasonal?: boolean;
}

export const SOURCE_REGISTRY: SourceRegistryEntry[] = [
    { key: 'interpark', file: 'interpark.json', label: '인터파크' },
    { key: 'timeticket', file: 'timeticket.json', label: '타임티켓' },
    { key: 'festival', file: 'festivals.json', label: '관광공사 축제' },
    { key: 'volleyball', file: 'kovo.json', label: 'KOVO', seasonal: true },
    { key: 'basketball', file: 'kbl.json', label: 'KBL', seasonal: true },
    { key: 'baseball', file: 'kbo.json', label: 'KBO' },
    { key: 'handball', file: 'handball.json', label: '핸드볼', seasonal: true },
    { key: 'football', file: 'kleague.json', label: 'K리그' },
    { key: 'movie', file: 'movies.json', label: '영화' },
    { key: 'myrealtrip-kids', file: 'myrealtrip-kids.json', label: '마이리얼트립 키즈' },
    { key: 'sssd-class', file: 'sssd-class.json', label: '솜씨당' },
    { key: 'umclass', file: 'umclass.json', label: '움클래스' },
    { key: 'mochaclass', file: 'mochaclass.json', label: '모카클래스' },
    { key: 'seoul', file: 'seoul-culture.json', label: '서울문화포털' },
    { key: 'culture-portal', file: 'culture-portal.json', label: '문화포털' },
    { key: 'mommom', file: 'mommom.json', label: '맘맘' },
    { key: 'mommom-activity', file: 'mommom-activities.json', label: '맘맘 액티비티' },
    { key: 'mommom-product', file: 'mommom-products.json', label: '맘맘 상품' },
    { key: 'museum', file: 'museum.json', label: '박물관 공공데이터' },
    { key: 'kopis', file: 'kopis-performances.json', label: 'KOPIS' },
    { key: 'tourism', file: 'tourism.json', label: '관광 데이터' },
];

export const SOURCE_REGISTRY_BY_KEY = SOURCE_REGISTRY.reduce<Record<string, SourceRegistryEntry>>((acc, entry) => {
    acc[entry.key] = entry;
    return acc;
}, {});

export function getSourceLabel(sourceKey: string) {
    return SOURCE_REGISTRY_BY_KEY[sourceKey]?.label || sourceKey;
}
