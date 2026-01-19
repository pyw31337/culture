
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
        return `https://wsrv.nl/?url=${encodedUrl}&w=${width}&q=85&output=webp`;
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
