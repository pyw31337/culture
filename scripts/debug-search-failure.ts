
import mommomData from '../src/data/mommom.json';

// Mock Data from other sources if needed, but we focus on mommom
const mommoms = mommomData as any[];

const now = new Date(); // Current time

function isPerformanceActive(dateStr: string, today: Date): boolean {
    if (!dateStr) return false;
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
            targetDate = new Date(dateStr); // "2026-01-13"
        }
        if (!targetDate || isNaN(targetDate.getTime())) return true;
        return targetDate.getTime() >= today.getTime();
    } catch (e) {
        return true;
    }
}

// Logic from page.tsx (BEFORE strict sports filter, but using the structure)
const filtered = mommoms.filter(p => {
    // 1. Whitelist Check
    if (p.genre === 'movie' || p.genre === 'travel' || p.genre === 'kids' || p.genre === 'class' || p.genre === 'ott' || p.genre === 'leisure' || p.genre === 'museum') {
        return true; // Should return true immediately
    }

    if (!isPerformanceActive(p.date, now)) return false;

    // Strict Region/Date for Sports
    if (['volleyball', 'basketball', 'baseball', 'handball', 'soccer', 'hockey'].includes(p.genre)) {
        return false; // mommom shouldn't be sports
    }

    // Default Filters
    if (p.venue === '예매하기') return false;
    if (/^\d{1,2}\.\d{1,2}/.test(p.venue)) return false;

    // Region Check
    const validRegions = ['seoul', 'gyeonggi', 'incheon', 'busan', 'daegu', 'gwangju', 'etc'];
    if (!validRegions.includes(p.region)) return false;

    return true;
});

const targetTitle = "상상체험";
const found = filtered.filter(p => p.title.includes(targetTitle));

console.log(`Total MomMom items: ${mommoms.length}`);
console.log(`Filtered items: ${filtered.length}`);
console.log(`Found "${targetTitle}": ${found.length}`);

if (found.length === 0) {
    console.log("CRITICAL: Target item lost in filtering.");
    // Check purely if it exists in raw data
    const rawFound = mommoms.filter(p => p.title.includes(targetTitle));
    console.log(`In Raw Data: ${rawFound.length}`);
    if (rawFound.length > 0) {
        const item = rawFound[0];
        console.log("Target Item:", JSON.stringify(item, null, 2));
        console.log("Analyzing rejection...");

        // Dry run logic
        if (item.genre === 'leisure') console.log("Passed Whitelist: YES");
        else console.log(`Passed Whitelist: NO (Genre: ${item.genre})`);
    }
} else {
    console.log("Item survived filtering. Issue likely in Client Side (PerformanceList) or Deduplication.");
    console.log("Checking string normalization...");
    const item = found[0];
    const nfc = item.title.normalize('NFC');
    const nfd = item.title.normalize('NFD');
    console.log(`Original: ${item.title}`);
    console.log(`NFC: ${nfc} (Includes '상상체험'? ${nfc.includes('상상체험')})`);
    console.log(`NFD: ${nfd} (Includes '상상체험'? ${nfd.includes('상상체험')})`);
}
