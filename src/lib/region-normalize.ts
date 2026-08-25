/**
 * Single source of truth for region id / label normalization.
 * Use this everywhere instead of ad-hoc string compares.
 */

export const REGION_CANONICAL: ReadonlyArray<{ id: string; label: string; aliases: string[] }> = [
  { id: 'seoul', label: '서울', aliases: ['서울특별시', '서울시', '서울', 'seoul'] },
  { id: 'busan', label: '부산', aliases: ['부산광역시', '부산시', '부산', 'busan'] },
  { id: 'daegu', label: '대구', aliases: ['대구광역시', '대구시', '대구', 'daegu'] },
  { id: 'incheon', label: '인천', aliases: ['인천광역시', '인천시', '인천', 'incheon'] },
  { id: 'gwangju', label: '광주', aliases: ['광주광역시', '광주시', '광주', 'gwangju'] },
  { id: 'daejeon', label: '대전', aliases: ['대전광역시', '대전시', '대전', 'daejeon'] },
  { id: 'ulsan', label: '울산', aliases: ['울산광역시', '울산시', '울산', 'ulsan'] },
  { id: 'sejong', label: '세종', aliases: ['세종특별자치시', '세종시', '세종', 'sejong'] },
  { id: 'gyeonggi', label: '경기', aliases: ['경기도', '경기', 'gyeonggi', 'gg'] },
  { id: 'gangwon', label: '강원', aliases: ['강원특별자치도', '강원도', '강원', 'gangwon'] },
  { id: 'chungbuk', label: '충북', aliases: ['충청북도', '충북', 'chungbuk', 'cb'] },
  { id: 'chungnam', label: '충남', aliases: ['충청남도', '충남', 'chungnam', 'cn'] },
  { id: 'jeonbuk', label: '전북', aliases: ['전북특별자치도', '전라북도', '전북', 'jeonbuk', 'jb'] },
  { id: 'jeonnam', label: '전남', aliases: ['전라남도', '전남', 'jeonnam', 'jn'] },
  { id: 'gyeongbuk', label: '경북', aliases: ['경상북도', '경북', 'gyeongbuk', 'gb'] },
  { id: 'gyeongnam', label: '경남', aliases: ['경상남도', '경남', 'gyeongnam', 'gn'] },
  { id: 'jeju', label: '제주', aliases: ['제주특별자치도', '제주도', '제주', 'jeju'] },
];

const ALIAS_TO_ID = new Map<string, string>();
const ID_TO_LABEL = new Map<string, string>();

for (const entry of REGION_CANONICAL) {
  ID_TO_LABEL.set(entry.id, entry.label);
  ALIAS_TO_ID.set(entry.id.toLowerCase(), entry.id);
  ALIAS_TO_ID.set(entry.label.toLowerCase(), entry.id);
  for (const alias of entry.aliases) {
    ALIAS_TO_ID.set(alias.toLowerCase(), entry.id);
  }
}

function compact(value: string): string {
  return value.replace(/\s+/g, '').toLowerCase();
}

/**
 * Normalize any region string to canonical id (e.g. "서울특별시" → "seoul").
 * Returns empty string if unknown / empty / "all".
 */
export function normalizeRegionId(region?: string | null): string {
  if (!region) return '';
  const trimmed = region.trim();
  if (!trimmed || trimmed === 'all' || trimmed === '전국') return '';

  const lower = trimmed.toLowerCase();
  if (ALIAS_TO_ID.has(lower)) return ALIAS_TO_ID.get(lower)!;

  const compacted = compact(trimmed);
  for (const [alias, id] of ALIAS_TO_ID.entries()) {
    if (compact(alias) === compacted) return id;
  }

  // Prefix match: "서울 용산구 ..." → seoul
  for (const entry of REGION_CANONICAL) {
    for (const alias of [entry.label, ...entry.aliases]) {
      if (trimmed.startsWith(alias) || compacted.startsWith(compact(alias))) {
        return entry.id;
      }
    }
  }

  return trimmed; // keep unknown as-is for visibility in audits
}

/**
 * Human label for a region id or free-form string.
 */
export function normalizeRegionLabel(region?: string | null): string {
  const id = normalizeRegionId(region);
  if (!id) return '전국';
  return ID_TO_LABEL.get(id) || region?.trim() || id;
}

/**
 * Infer region id from a Korean address string.
 */
export function regionIdFromAddress(address?: string | null): string {
  if (!address) return '';
  const text = address.trim();
  if (!text) return '';

  for (const entry of REGION_CANONICAL) {
    for (const alias of [entry.label, ...entry.aliases]) {
      if (text.startsWith(alias) || text.includes(` ${alias} `) || text.includes(`${alias} `)) {
        // Prefer longest alias match at start
        if (text.startsWith(alias)) return entry.id;
      }
    }
  }

  // Fallback: first token
  const first = text.split(/\s+/)[0];
  return normalizeRegionId(first);
}

/**
 * True when declared region conflicts with address-derived region.
 */
export function isRegionAddressMismatch(
  region?: string | null,
  address?: string | null,
): boolean {
  const declared = normalizeRegionId(region);
  const fromAddr = regionIdFromAddress(address);
  if (!declared || !fromAddr) return false;
  return declared !== fromAddr;
}

/**
 * Prefer address-derived region when mismatch is detected.
 */
export function resolveRegion(region?: string | null, address?: string | null): string {
  const declared = normalizeRegionId(region);
  const fromAddr = regionIdFromAddress(address);
  if (fromAddr && declared && fromAddr !== declared) return fromAddr;
  return declared || fromAddr || '';
}
