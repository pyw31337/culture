import { format, isValid, parse } from 'date-fns';
import { ko } from 'date-fns/locale';

export const getOptimizedUrl = (url: string, width: number = 400, quality: number = 70) => {
    if (!url) return '';
    // TimeTicket blocks wsrv.nl (403 Forbidden), skipping optimization as requested
    if (url.includes('timeticket.co.kr')) return url;
    // Seoul Culture might be unstable with proxy, skipping to be safe
    if (url.includes('culture.seoul.go.kr')) return url;
    // VisitKorea CDN already serves resized assets reliably; proxying it can delay or replace images.
    if (
        url.includes('cdn.visitkorea.or.kr') ||
        url.includes('kfescdn.visitkorea.or.kr') ||
        url.includes('tong.visitkorea.or.kr')
    ) return url;
    // Skip external optimization for local images (relative paths)
    if (url.startsWith('/')) {
        const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
        // If basePath is set and url doesn't start with it (and isn't just a slash if basePath is empty?), prepend it.
        // Also avoid double-slash if basePath ends with / (it shouldn't based on config)
        if (basePath && !url.startsWith(basePath)) {
            return `${basePath}${url}`;
        }
        return url;
    }

    try {
        // use wsrv.nl for image optimization
        const encodedUrl = encodeURIComponent(url);
        return `https://wsrv.nl/?url=${encodedUrl}&w=${width}&q=${quality}&output=webp`;
    } catch {
        return url;
    }
};

// Calculate distance between two points
export function getDistanceFromLatLonInKm(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 6371; // Radius of the earth in km
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const d = R * c; // Distance in km
    return d;
}

function deg2rad(deg: number) {
    return deg * (Math.PI / 180);
}

// Helper to extract first price from a price string like "VIP석 154,000원 R석 132,000원..."
// Returns { label: 'VIP석', price: '154,000' } or { label: null, price: '30,000' }
export function extractFirstPrice(priceStr: string): { label: string | null; price: string } | null {
    const normalized = priceStr?.trim();
    if (!normalized) return null;

    const compact = normalized.replace(/\s+/g, '');
    const hasWonPrice = /\d[\d,]*\s*원/.test(normalized);
    const hasKoreanUnitPrice = /\d+\s*만(?:\s*\d+\s*천)?\s*원|\d+\s*천\s*원/.test(normalized);
    const isExplicitlyFree = /^(무료|0|0원|입장무료|관람무료|무료입장)$/.test(compact);

    // Treat "무료" as a price only when it is the actual price, not an exemption note.
    if (isExplicitlyFree || (compact.includes('무료') && !hasWonPrice && !hasKoreanUnitPrice)) {
        return { label: null, price: '무료' };
    }

    const labeledKoreanUnitMatch = normalized.match(/([가-힣A-Z]+석?)\s*(?:(\d+)만)?\s*(?:(\d+)천)?\s*원/);
    if (labeledKoreanUnitMatch && (labeledKoreanUnitMatch[2] || labeledKoreanUnitMatch[3])) {
        const amount =
            (Number.parseInt(labeledKoreanUnitMatch[2] || '0', 10) * 10000) +
            (Number.parseInt(labeledKoreanUnitMatch[3] || '0', 10) * 1000);
        if (amount > 0) {
            return { label: labeledKoreanUnitMatch[1], price: amount.toLocaleString('ko-KR') };
        }
    }

    // Try to match pattern: "XX석 NUMBER원" or "전석 NUMBER원"
    const match = normalized.match(/([가-힣A-Z]+석?)\s*([\d,]+)\s*원/);
    if (match) {
        return { label: match[1], price: match[2] };
    }

    const wonMatch = normalized.match(/([\d,]+)\s*원/);
    if (wonMatch) {
        return { label: null, price: wonMatch[1] };
    }

    const koreanUnitMatch = compact.match(/(?:(\d+)만)?(?:(\d+)천)?원/);
    if (koreanUnitMatch && (koreanUnitMatch[1] || koreanUnitMatch[2])) {
        const amount =
            (Number.parseInt(koreanUnitMatch[1] || '0', 10) * 10000) +
            (Number.parseInt(koreanUnitMatch[2] || '0', 10) * 1000);
        if (amount > 0) {
            return { label: null, price: amount.toLocaleString('ko-KR') };
        }
    }

    // Fallback for normalized numeric strings such as "30000".
    const numMatch = compact.match(/^[\d,]+$/);
    if (numMatch) {
        return { label: null, price: numMatch[0] };
    }

    return null;
}

// Clean up title by removing leading bracketed text e.g. "[키즈][서대문] Title" -> "Title"
export function cleanTitle(title: string): string {
    if (!title) return '';

    let cleaned = title;

    // 1. Remove noise prefixes in brackets [] at the start
    // Matches patterns like [티켓오픈], [단독], [성남], [앵콜], [얼리버드]...
    cleaned = cleaned.replace(/^(\[[^\]]*\]\s*)+/, '');

    // 2. Remove noise patterns in parentheses () at the start
    cleaned = cleaned.replace(/^(\([^)]*\)\s*)+/, '');

    // 3. Remove known noise suffixes or internal tags
    // e.g. "Title [서울]" or "Title (공연)"
    cleaned = cleaned.replace(/\s*\[(?:서울|경기|인천|강원|충북|충남|전북|전남|경북|경남|제주|부산|대구|광주|대전|울산|세종|서울공연)\]$/g, '');

    // 4. Clean up any lingering multiple spaces
    cleaned = cleaned.trim().replace(/\s+/g, ' ');

    // If the entire title was just brackets (e.g. "[특가]"), return the original title instead of an empty string
    return cleaned === '' ? title : cleaned;
}

// Extract city and district (e.g., "대전 동구") from raw address
export function getDistrictFromAddress(address?: string): string | null {
    if (!address) return null;
    
    // Pattern to catch: [City/Province] [Gu/Gun/Si]
    // e.g., "대전광역시 동구 ...", "서울 중구 ...", "경기도 성남시 ..."
    const parts = address.split(' ').filter(p => p.length > 0);
    if (parts.length < 2) return null;
    
    const city = parts[0];
    const gu = parts[1];
    
    // Normalize city names
    let normalizedCity = city;
    if (city.startsWith('서울')) normalizedCity = '서울';
    else if (city.startsWith('인천')) normalizedCity = '인천';
    else if (city.startsWith('부산')) normalizedCity = '부산';
    else if (city.startsWith('대전')) normalizedCity = '대전';
    else if (city.startsWith('대구')) normalizedCity = '대구';
    else if (city.startsWith('광주')) normalizedCity = '광주';
    else if (city.startsWith('울산')) normalizedCity = '울산';
    else if (city.startsWith('경기')) normalizedCity = '경기';
    else if (city.startsWith('강원')) normalizedCity = '강원';
    else if (city.startsWith('충청북도') || city.startsWith('충북')) normalizedCity = '충북';
    else if (city.startsWith('충청남도') || city.startsWith('충남')) normalizedCity = '충남';
    else if (city.startsWith('전라북도') || city.startsWith('전북')) normalizedCity = '전북';
    else if (city.startsWith('전라남도') || city.startsWith('전남')) normalizedCity = '전남';
    else if (city.startsWith('경상북도') || city.startsWith('경북')) normalizedCity = '경북';
    else if (city.startsWith('경상남도') || city.startsWith('경남')) normalizedCity = '경남';
    else if (city.startsWith('제주')) normalizedCity = '제주';
    else if (city.startsWith('세종')) normalizedCity = '세종';

    // Return e.g., "대전 동구" or "경기 성남시"
    return `${normalizedCity} ${gu}`;
}

export function getLowResUrl(url: string): string | null {
    if (!url) return null;
    if (url.startsWith('/')) return null; // Local images handled by Next.js

    // Mom-Mom Specific
    if (url.includes('image.mom-mom.net')) {
        try {
            // Extract base64 part
            const matches = url.match(/image\.mom-mom\.net\/([^?#]+)/);
            if (matches && matches[1]) {
                // Determine if we need to decode first (some might be raw, but usually base64)
                // Mom-Mom uses straightforward base64 encoded JSON
                const decodedStr = typeof atob === 'function' ? atob(matches[1]) : Buffer.from(matches[1], 'base64').toString();
                const decoded = JSON.parse(decodedStr);

                if (decoded.edits && decoded.edits.resize) {
                    decoded.edits.resize.width = 40; // Tiny width
                    // Ensure withoutEnlargement is true if present
                } else {
                    decoded.edits = { resize: { width: 40, fit: 'cover' } };
                }

                const encodedStr = typeof btoa === 'function' ? btoa(JSON.stringify(decoded)) : Buffer.from(JSON.stringify(decoded)).toString('base64');
                return `https://image.mom-mom.net/${encodedStr}`;
            }
        } catch (e) { return null; }
    }

    // Skip blocked or specific domains for wsrv
    if (url.includes('timeticket.co.kr') || url.includes('culture.seoul.go.kr')) return null;

    // Use wsrv.nl for low-res blur
    const encodedUrl = encodeURIComponent(url);
    // w=20: Tiny width
    // blur=5: Apply blur on server side
    // q=20: Low quality
    return `https://wsrv.nl/?url=${encodedUrl}&w=20&blur=5&q=20&output=webp`;
}

// Unified Date Formatter: YYYY.MM.DD (E) HH:mm or YYYY.MM.DD (E) for ranges
export function formatUnifiedDate(dateStr: string): string {
    if (!dateStr) return '';
    try {
        let cleanStr = dateStr;
        // 1. Remove tags like [얼리버드], [유효기간:~xxxx.xx.xx]
        cleanStr = cleanStr.replace(/\[(?:얼리버드|유효기간[:\s～~]*[^\\]]*|[^\]]*)\]/g, '');
        // 2. Remove orphan brackets
        cleanStr = cleanStr.replace(/[\[\]]/g, '');
        // 3. Normalize dashes to dots (but keep time-like colons)
        cleanStr = cleanStr.replace(/-/g, '.').replace(/\.+$/, '').trim();

        // 4. Handle ranges
        if (cleanStr.includes('~')) {
            const parts = cleanStr.split('~').map(s => s.trim()).filter(Boolean);
            if (parts.length > 1) {
                const formattedParts = parts.map(p => formatSingleDateInternal(p));

                if (formattedParts[0] === formattedParts[1]) {
                    return formattedParts[0];
                }

                const dateMatch0 = formattedParts[0].match(/^(\d{4}\.\d{2}\.\d{2} \([가-힣]\))(?: (\d{2}:\d{2}))?$/);
                const dateMatch1 = formattedParts[1].match(/^(\d{4}\.\d{2}\.\d{2} \([가-힣]\))(?: (\d{2}:\d{2}))?$/);

                if (dateMatch0 && dateMatch1 && dateMatch0[1] === dateMatch1[1]) {
                    const baseDate = dateMatch0[1];
                    const time0 = dateMatch0[2];
                    const time1 = dateMatch1[2];

                    if (time0 && time1) {
                        return `${baseDate} ${time0} ~ ${time1}`;
                    } else if (time0) {
                        return `${baseDate} ${time0}`;
                    } else if (time1) {
                        return `${baseDate} ${time1}`;
                    } else {
                        return baseDate;
                    }
                }

                return formattedParts.join(' ~ ');
            } else if (parts.length === 1 && cleanStr.startsWith('~')) {
                return `~ ${formatSingleDateInternal(parts[0])}`;
            }
        }

        return formatSingleDateInternal(cleanStr);
    } catch {
        return dateStr;
    }
}

/**
 * Internal helper to format a single date string (used for ranges too)
 */
function formatSingleDateInternal(str: string): string {
    if (!str) return '';

    // Normalize dots to dashes for parsing
    let parseStr = str.replace(/\./g, '-').trim();

    // Handle "YYYYMMDD" (8 digits)
    if (/^\d{8}$/.test(parseStr)) {
        const y = parseStr.substring(0, 4);
        const m = parseStr.substring(4, 6);
        const d = parseStr.substring(6, 8);
        parseStr = `${y}-${m}-${d}`;
    }

    let parsedDate = new Date(parseStr);

    if (!isValid(parsedDate)) {
        // Try strict parsing
        try {
            parsedDate = parse(parseStr, 'yyyy-MM-dd HH:mm:ss', new Date());
            if (!isValid(parsedDate)) {
                parsedDate = parse(parseStr, 'yyyy-MM-dd HH:mm', new Date());
            }
            if (!isValid(parsedDate)) {
                parsedDate = parse(parseStr, 'yyyy-MM-dd', new Date());
            }
        } catch (e) {
            return str;
        }
    }

    if (isValid(parsedDate)) {
        const hasTime = str.includes(':');
        if (hasTime) {
            return format(parsedDate, 'yyyy.MM.dd (E) HH:mm', { locale: ko });
        } else {
            // No time in original string -> omit HH:mm
            return format(parsedDate, 'yyyy.MM.dd (E)', { locale: ko });
        }
    }

    return str;
}

/**
 * Convert desktop URLs to mobile-optimized versions for specific platforms
 * - Naver Search: search.naver.com -> m.search.naver.com
 * - Yes24 Ticket: ticket.yes24.com -> m.ticket.yes24.com
 */
export function toMobileUrl(url: string | undefined): string {
    if (!url) return '';
    
    try {
        // Only convert if it's an absolute URL
        if (!url.startsWith('http')) return url;

        const urlObj = new URL(url);
        
        // Naver Search
        if (urlObj.hostname === 'search.naver.com') {
            urlObj.hostname = 'm.search.naver.com';
            return urlObj.toString();
        }
        
        // Yes24 Ticket
        if (urlObj.hostname === 'ticket.yes24.com') {
            urlObj.hostname = 'm.ticket.yes24.com';
            return urlObj.toString();
        }

        // YouTube
        if (urlObj.hostname === 'www.youtube.com' || urlObj.hostname === 'youtube.com') {
            urlObj.hostname = 'm.youtube.com';
            return urlObj.toString();
        }

        // Interpark, KOPIS, and others are already responsive or handle redirects
        return url;
    } catch {
        return url || '';
    }
}
