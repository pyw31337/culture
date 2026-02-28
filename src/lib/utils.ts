import { format, isValid, parse } from 'date-fns';
import { ko } from 'date-fns/locale';

export const getOptimizedUrl = (url: string, width: number = 400) => {
    if (!url) return '';
    // TimeTicket blocks wsrv.nl (403 Forbidden), skipping optimization as requested
    if (url.includes('timeticket.co.kr')) return url;
    // Seoul Culture might be unstable with proxy, skipping to be safe
    if (url.includes('culture.seoul.go.kr')) return url;
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
        return `https://wsrv.nl/?url=${encodedUrl}&w=${width}&q=92&output=webp`;
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
    if (!priceStr) return null;

    // Check for free
    if (priceStr.includes('무료') || priceStr === '0') {
        return { label: null, price: '무료' };
    }

    // Try to match pattern: "XX석 NUMBER원" or "전석 NUMBER원"
    const match = priceStr.match(/([가-힣A-Z]+석?)\s*([\d,]+)원?/);
    if (match) {
        return { label: match[1], price: match[2] };
    }

    // Fallback: just extract first number
    const numMatch = priceStr.match(/([\d,]+)/);
    if (numMatch) {
        return { label: null, price: numMatch[1] };
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

// Unified Date Formatter: YYYY.MM.DD (E) HH:mm
export function formatUnifiedDate(dateStr: string): string {
    if (!dateStr) return '';
    try {
        let cleanStr = dateStr;
        // 1. Remove tags like [얼리버드], [유효기간:~xxxx.xx.xx]
        cleanStr = cleanStr.replace(/\[(?:얼리버드|유효기간[:\s～~]*[^\\]]*|[^\]]*)\]/g, '');
        // 2. Remove orphan brackets
        cleanStr = cleanStr.replace(/[\[\]]/g, '');
        // 3. Normalize dashes to dots
        cleanStr = cleanStr.replace(/-/g, '.').replace(/\.+$/, '').trim();
        // 4. Handle ranges like "~2026.03.02" or multiple dates
        const parts = cleanStr.split('~').map(s => s.trim()).filter(Boolean);
        if (parts.length >= 1) {
            cleanStr = parts[parts.length - 1]; // take the last date mostly
        }

        // Replace back dots with dashes to parse safely with native Date or date-fns if standard
        let parseStr = cleanStr.replace(/\./g, '-');
        // Handle "YYYY-MM-DD HH:mm:ss" or "YYYY-MM-DD HH:mm"
        let parsedDate = new Date(parseStr);

        if (!isValid(parsedDate)) {
            // Try strict parsing
            parsedDate = parse(parseStr, 'yyyy-MM-dd HH:mm:ss', new Date());
            if (!isValid(parsedDate)) {
                parsedDate = parse(parseStr, 'yyyy-MM-dd HH:mm', new Date());
            }
        }

        if (isValid(parsedDate)) {
            // Check if original string had time
            if (parseStr.includes(':')) {
                return format(parsedDate, 'yyyy.MM.dd (E) HH:mm', { locale: ko });
            } else {
                // For now, prompt asks for system-wide format '2026.03.12 (목) 13:00'
                // However, if there's no time, we might just default to 00:00 or skip time. 
                // Let's assume if they want it globally, if time is 00:00 we omit it, unless specified.
                // The prompt: Date format should be united as `2026.03.12 (목) 13:00`.
                return format(parsedDate, 'yyyy.MM.dd (E) HH:mm', { locale: ko });
            }
        }
    } catch { }

    return dateStr;
}
