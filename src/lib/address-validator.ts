import hierarchy from '@/data/korean_address_hierarchy.json';

const regionMapping: Record<string, string> = {
    '서울': 'seoul',
    '경기': 'gyeonggi',
    '인천': 'incheon',
    '부산': 'busan',
    '대구': 'daegu',
    '광주': 'gwangju',
    '대전': 'daejeon',
    '울산': 'ulsan',
    '세종': 'sejong',
    '강원': 'gangwon',
    '충북': 'chungbuk',
    '충남': 'chungnam',
    '전북': 'jeonbuk',
    '전남': 'jeonnam',
    '경북': 'gyeongbuk',
    '경남': 'gyeongnam',
    '제주': 'jeju'
};

/**
 * Validates and maps an address and district to a standardized region ID.
 */
export function getStandardRegionId(address: string, district?: string): string | null {
    if (!address) return null;

    // 1. Identify primary region from address
    let foundRegion = '';
    for (const reg in hierarchy) {
        if (address.startsWith(reg) || address.includes(reg + ' ')) {
            foundRegion = reg;
            break;
        }
    }

    // 2. Cross-reference with district if provided or if logic necessitates
    if (district) {
        // Special case: Michuhol-gu always belongs to Incheon
        if (district === '미추홀구') {
            return 'incheon';
        }

        // Search for district in hierarchy
        for (const reg in hierarchy) {
            const possibleDistricts = (hierarchy as any)[reg];
            if (possibleDistricts.includes(district)) {
                // If it's a known restricted district (like Michuhol), trust it over the potentially messy address string
                if (foundRegion && foundRegion !== reg) {
                    // Mismatch found (e.g., Michuhol but address says Gyeonggi)
                    // We trust the hierarchy for unique districts
                    return regionMapping[reg] || null;
                }
                if (!foundRegion) foundRegion = reg;
                break;
            }
        }
    }

    return foundRegion ? regionMapping[foundRegion] : null;
}

/**
 * Normalizes district names.
 */
export function getStandardDistrict(address: string, regionId: string): string | null {
    const provinceKey = Object.entries(regionMapping).find(([k, v]) => v === regionId)?.[0];
    if (!provinceKey) return null;

    const possibleDistricts = (hierarchy as any)[provinceKey];
    if (!possibleDistricts) return null;

    for (const dist of possibleDistricts) {
        if (address.includes(dist)) {
            return dist;
        }
    }
    return null;
}
