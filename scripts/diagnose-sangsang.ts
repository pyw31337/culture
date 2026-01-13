
import mommomData from '../src/data/mommom.json';
import venueData from '../src/data/venues.json';

const venues = venueData as Record<string, { address: string }>;
const BLOCKLIST = ['블루마린 스쿠버 다이브', '광주 조선대학교 해오름관'];
const validRegions = ['seoul', 'gyeonggi', 'incheon', 'busan', 'daegu', 'gwangju', 'etc'];

// Mock isPerformanceActive
function isPerformanceActive(dateStr: string): boolean {
    if (!dateStr) return false;
    const today = new Date();
    try {
        let targetDate: Date | null = null;
        if (dateStr.includes('~')) {
            const parts = dateStr.split('~');
            const endStr = parts[1].trim();
            const [y, m, d] = endStr.split('.').map(Number);
            targetDate = new Date(y, m - 1, d);
            targetDate.setHours(23, 59, 59, 999);
        } else if (dateStr.includes('-') && dateStr.includes(':')) {
            const [datePart] = dateStr.split(' ');
            const [y, m, d] = datePart.split('-').map(Number);
            targetDate = new Date(y, m - 1, d);
            targetDate.setHours(23, 59, 59, 999);
        } else {
            targetDate = new Date(dateStr);
        }
        if (!targetDate || isNaN(targetDate.getTime())) return true;
        return targetDate.getTime() >= today.getTime();
    } catch (e) {
        return true;
    }
}

const targetTitle = '상상체험';
const items = mommomData.filter(p => p.title.includes(targetTitle));

console.log(`Found ${items.length} items matching '${targetTitle}' in raw data.`);

items.forEach(p => {
    console.log(`\nChecking Item: ${p.title}`);
    console.log(`  Date: ${p.date}`);
    console.log(`  Region: ${p.region}`);
    console.log(`  Venue: ${p.venue}`);
    console.log(`  Address: ${p.address}`);
    console.log(`  Genre: ${p.genre}`);

    // Filter Step 1: Active
    const active = isPerformanceActive(p.date);
    console.log(`  [Check] Active? ${active}`);

    // Filter Step 2: Valid Region
    // In page.tsx: if (p.genre === 'movie' || ... || p.genre === 'museum') return true;
    // mommom items are 'leisure' or 'hotdeal'. NOT in bypass list (except kids?).
    // Wait, 'kids' IS in bypass list.
    // Is '상상체험' genre 'kids'? No, JSON said 'leisure'.
    const bypass = ['movie', 'travel', 'kids', 'class', 'ott', 'museum'].includes(p.genre);
    console.log(`  [Check] Bypass Genre? ${bypass}`);

    if (bypass) {
        console.log(`  -> PASSED (Bypass)`);
        return;
    }

    if (!active) {
        console.log(`  -> DROPPED (Expired)`);
        return;
    }

    // Sports filter? No.

    // Valid Region Check
    const regionValid = validRegions.includes(p.region);
    console.log(`  [Check] Region '${p.region}' in validRegions? ${regionValid}`);
    if (!regionValid) {
        console.log(`  -> DROPPED (Invalid Region)`);
        return;
    }

    // Venue Parsing Error Check
    if (p.venue === '예매하기' || /^\d{1,2}\.\d{1,2}/.test(p.venue)) {
        console.log(`  -> DROPPED (Bad Venue Name)`);
        return;
    }

    // Address-based Filtering
    let addressPassed = true;
    if (venues[p.venue]) {
        const addr = venues[p.venue].address;
        if (addr && addr !== '정보 없음') {
            const isServiceArea = addr.startsWith('서울') || addr.startsWith('경기') || addr.startsWith('인천');
            console.log(`  [Check] Known Venue Address: ${addr} (ServiceArea? ${isServiceArea})`);
            if (!isServiceArea) addressPassed = false;
        }
    } else {
        console.log(`  [Check] Venue not in known venue dictionary. (Passes address check)`);
    }

    if (!addressPassed) {
        console.log(`  -> DROPPED (Address out of area)`);
        return;
    }

    // Blocklist
    if (BLOCKLIST.some(b => p.venue.includes(b))) {
        console.log(`  -> DROPPED (Blocklist)`);
        return;
    }

    console.log(`  -> PASSED INITIAL FILTERS`);
});
