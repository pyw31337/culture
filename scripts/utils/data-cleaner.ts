/**
 * Data cleaning and filtering utilities for performance data
 */

export const CLEAN_PATTERNS = [
  '지도보기전화',
  '지도보기영업시간',
  '지도보기시설',
  '지도보기',
  '전화',
  '시설',
  '영업시간',
  '주소 복사',
  '길 찾기',
  '주소 복사완료',
  '복사하기',
  '복사됨',
];

/**
 * Removes redundant UI text and artifacts from addresses
 */
export function cleanAddress(address: string | undefined): string {
  if (!address) return '';
  let cleaned = address;
  
  // Remove common UI artifacts
  for (const pattern of CLEAN_PATTERNS) {
    cleaned = cleaned.replace(new RegExp(pattern, 'g'), '');
  }
  
  // Remove phone numbers if leaked into address (common in some scrapers)
  cleaned = cleaned.replace(/전화\d{2,3}-?\d{3,4}-?\d{4}/g, '');
  
  return cleaned.trim();
}

/**
 * Prepends missing province/city to partial addresses
 */
export function normalizeAddress(item: any): string {
  let address = cleanAddress(item.address);
  if (!address) return '';

  // Check if it already starts with a major administrative division
  const startsWithAdmin = /^(서울|경기|인천|강원|충북|충남|대전|경북|경남|대구|울산|부산|전북|전남|광주|세종|제주)/.test(address);
  
  if (!startsWithAdmin) {
    // Heuristic: Check venue/title for clues
    const context = (item.venue + ' ' + item.title).toLowerCase();
    
    if (context.includes('부천')) {
      address = '경기도 부천시 ' + address;
    } else if (context.includes('판교')) {
      address = '경기도 성남시 ' + address;
    } else if (context.includes('강남')) {
      address = '서울특별시 강남구 ' + address;
    } else if (context.includes('홍대')) {
      address = '서울특별시 마포구 ' + address;
    } else if (item.region === 'seoul') {
      address = '서울특별시 ' + address;
    } else if (item.region === 'gyeonggi') {
      address = '경기도 ' + address;
    } else if (item.region === 'incheon') {
      address = '인천광역시 ' + address;
    }
  }

  return address;
}

/**
 * Checks if a performance item should be filtered out based on date or status
 */
export function isExpired(item: any, referenceDate: Date = new Date()): boolean {
  // 1. Check for explicit "Sold Out" or "Sales Ended" phrases
  const statusContext = (item.title + ' ' + (item.priceDetail || '') + ' ' + (item.feesAndPrograms || '')).toLowerCase();
  if (statusContext.includes('판매 종료') || statusContext.includes('판매종료')) {
    return true;
  }

  // 2. Check date strings
  const dateStr = item.date;
  if (!dateStr || dateStr === '연중무휴' || dateStr === '상시운영' || dateStr === 'OPEN RUN') {
    return false;
  }

  try {
    // Handle formats like "~ 2026.03.02" or "2026.03.02 까지"
    let datePart = dateStr;
    if (datePart.includes('~')) {
      const parts = datePart.split('~');
      datePart = parts[parts.length - 1].trim(); // Take the end date
    }
    
    // Remove (요일) and other trailing text
    datePart = datePart.split('(')[0].split('까지')[0].trim();
    
    // Normalize dots to hyphens for parsing
    let normalizedDate = datePart.replace(/\./g, '-');
    
    // Handle YY-MM-DD -> 20YY-MM-DD
    if (normalizedDate.match(/^\d{2}-\d{2}-\d{2}$/)) {
      normalizedDate = '20' + normalizedDate;
    }
    
    // Handle YYYYMMDD
    if (normalizedDate.match(/^\d{8}$/)) {
      const y = normalizedDate.substring(0, 4);
      const m = normalizedDate.substring(4, 6);
      const d = normalizedDate.substring(6, 8);
      normalizedDate = `${y}-${m}-${d}`;
    }

    const endDate = new Date(normalizedDate);
    if (!isNaN(endDate.getTime())) {
      endDate.setHours(23, 59, 59, 999);
      return endDate < referenceDate;
    }
  } catch (e) {
    // If parsing fails, don't expire it by default
  }

  return false;
}

export const REGION_MAP: Record<string, Record<string, string>> = {
  '경기도 부천시 ': {
    en: 'Bucheon-si, Gyeonggi-do, ',
    zh: '京畿道富川市',
    ja: '京畿道富川市'
  },
  '경기도 성남시 ': {
    en: 'Seongnam-si, Gyeonggi-do, ',
    zh: '京畿道城南市',
    ja: '京畿道城南市'
  },
  '서울특별시 강남구 ': {
    en: 'Gangnam-gu, Seoul, ',
    zh: '首尔特别市江南区',
    ja: 'ソウル特別市江南区'
  },
  '서울특별시 마포구 ': {
    en: 'Mapo-gu, Seoul, ',
    zh: '首尔特别市麻浦区',
    ja: 'ソウル特別市麻浦区'
  },
  '서울특별시 ': {
    en: 'Seoul, ',
    zh: '首尔特别市',
    ja: 'ソウル特別市'
  },
  '경기도 ': {
    en: 'Gyeonggi-do, ',
    zh: '京畿道',
    ja: '京畿道'
  },
  '인천광역시 ': {
    en: 'Incheon, ',
    zh: '仁川广域市',
    ja: '仁川広域市'
  }
};

/**
 * Normalizes address and returns the added prefix if any
 */
export function normalizeAddressWithMeta(item: any): { normalized: string, prefixAdded: string | null } {
  let original = cleanAddress(item.address);
  let address = original;
  let prefix = null;

  if (!address) return { normalized: '', prefixAdded: null };

  const startsWithAdmin = /^(서울|경기|인천|강원|충북|충남|대전|경북|경남|대구|울산|부산|전북|전남|광주|세종|제주)/.test(address);
  
  if (!startsWithAdmin) {
    const context = (item.venue + ' ' + item.title).toLowerCase();
    
    if (context.includes('부천')) {
      prefix = '경기도 부천시 ';
    } else if (context.includes('판교')) {
      prefix = '경기도 성남시 ';
    } else if (context.includes('강남')) {
      prefix = '서울특별시 강남구 ';
    } else if (context.includes('홍대')) {
      prefix = '서울특별시 마포구 ';
    } else if (item.region === 'seoul') {
      prefix = '서울특별시 ';
    } else if (item.region === 'gyeonggi') {
      prefix = '경기도 ';
    } else if (item.region === 'incheon') {
      prefix = '인천광역시 ';
    }
    
    if (prefix) {
      address = prefix + address;
    }
  }

  return { normalized: address, prefixAdded: prefix };
}
