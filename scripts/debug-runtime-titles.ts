
import { processAndMergePerformances } from '../src/lib/performance-merger';
import venueData from '../src/data/venues.json';

// Import all data sources same as performance-data.ts
import interparkData from '../src/data/interpark.json';
import kovoData from '../src/data/kovo.json';
import kblData from '../src/data/kbl.json';
import kboData from '../src/data/kbo.json';
import festivalsData from '../src/data/festivals.json';
import yes24Data from '../src/data/yes24.json';
import timeticketData from '../src/data/timeticket.json';
import moviesData from '../src/data/movies.json';
import kidsData from '../src/data/myrealtrip-kids.json';
import classData from '../src/data/sssd-class.json';

import handballData from '../src/data/handball.json';
import umclassData from '../src/data/umclass.json';
import seoulData from '../src/data/seoul-culture.json';
import mochaclassData from '../src/data/mochaclass.json';
import mommomData from '../src/data/mommom.json';
import mommomProductData from '../src/data/mommom-products.json';
import museumData from '../src/data/museum.json';

// Mock safeArray since we can't import it easily without module setup issues in scripts usually,
// but we'll try to use raw data arrays directly to see if raw data has issues that check-missing-titles missed?
// Actually, check-missing-titles checked raw JSON.
// So let's reproduce the mapping logic.

function safeArray(arr: any) {
    return Array.isArray(arr) ? arr : [];
}

const REGION_MAP: Record<string, string> = {
    '서울': 'seoul', '경기': 'gyeonggi', '인천': 'incheon',
    '부산': 'busan', '대구': 'daegu', '광주': 'gwangju',
    '대전': 'etc', '울산': 'etc', '세종': 'etc',
    '강원': 'etc', '충북': 'etc', '충남': 'etc',
    '전북': 'etc', '전남': 'etc', '경북': 'etc',
    '경남': 'etc', '제주': 'etc'
};

const interpark = safeArray(interparkData).map((p: any) => ({
    ...p,
    region: REGION_MAP[p.region] || (p.region ? 'etc' : 'unknown')
}));

const seoulCulture = safeArray(seoulData).map((p: any) => ({
    ...p,
    venue: p.place,
    region: 'seoul',
    image: p.poster,
    price: p.cost,
    date: p.time ? `${p.date} (${p.time})` : p.date
}));

const allPerformances = [
    ...interpark,
    ...safeArray(yes24Data),
    ...safeArray(timeticketData),
    ...safeArray(festivalsData),
    ...safeArray(kovoData),
    ...safeArray(kblData),
    ...safeArray(kboData),
    ...safeArray(handballData),

    ...safeArray(moviesData),
    ...safeArray(kidsData),
    ...safeArray(classData),
    ...safeArray(umclassData),
    ...safeArray(mochaclassData),
    ...seoulCulture,
    ...safeArray(mommomData),
    ...safeArray(mommomProductData),
    ...safeArray(museumData)
].map((p: any) => ({
    ...p,
    id: String(p.id)
}));

console.log(`Total valid items before merge: ${allPerformances.length}`);

// Check for missing titles BEFORE merge
let missingBefore = 0;
allPerformances.forEach((p: any) => {
    if (!p.title || p.title.trim() === '') {
        console.log(`[Before Merge] Missing Title: ID=${p.id}, Genre=${p.genre}, Source=${p.source || 'Unknown'}`);
        missingBefore++;
    }
});
console.log(`Missing titles before merge: ${missingBefore}`);


// Simulate Merge
const merged = processAndMergePerformances(allPerformances);

console.log(`Total items after merge: ${merged.length}`);

// Clean Title Simulation
function cleanTitle(title: string): string {
    if (!title) return '';
    return title.replace(/^(\[[^\]]+\]\s*)+/, '').trim();
}

let missingAfter = 0;
let emptyAfterClean = 0;

merged.forEach((p: any) => {
    if (!p.title || p.title.trim() === '') {
        console.log(`[After Merge] Missing Title: ID=${p.id}, Genre=${p.genre}, Venue=${p.venue}`);
        missingAfter++;
    } else {
        const cleaned = cleanTitle(p.title);
        if (!cleaned || cleaned === '') {
            console.log(`[CleanTitle Empty] Original: "${p.title}" => Cleaned: "${cleaned}" (ID=${p.id})`);
            emptyAfterClean++;
        }
    }
});
console.log(`Missing titles after merge: ${missingAfter}`);
console.log(`Empty titles after clean: ${emptyAfterClean}`);

