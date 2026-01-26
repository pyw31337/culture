
import { processAndMergePerformances } from '../src/lib/performance-merger';
import seoulData from '../src/data/seoul-culture.json';
import { getAllPerformances } from '../src/lib/performance-data';

// We can't import getAllPerformances directly easily because of path aliases in simple tsx script without proper tsconfig handling sometimes,
// BUT we can try importing it if tsx handles it.
// If tsx fails with alias verify, we might need to copy logic. 
// "debug-runtime-titles.ts" used partial copy.

// Let's try to simulate the logic exactly as I modified it in performance-data.ts
// logic copy:

function inferSeoulGenre(title: string, venue: string, originalSubject: string): string {
    const text = (title + ' ' + venue + ' ' + originalSubject).toLowerCase();

    if (text.includes('콘서트') || text.includes('음악회') || text.includes('연주회') || text.includes('교향악단') || text.includes('리사이틀') || text.includes('앙상블') || text.includes('오케스트라') || text.includes('독창회') || text.includes('클래식')) return 'classic';
    if (text.includes('전시') || text.includes('특별전') || text.includes('초대전') || text.includes('갤러리') || text.includes('미술관') || text.includes('박물관') || text.includes('비엔날레') || text.includes('도슨트')) return 'exhibition';
    if (text.includes('국악') || text.includes('판소리') || text.includes('마당놀이') || text.includes('전통') || text.includes('무형문화재') || text.includes('풍물')) return 'korean_music';
    if (text.includes('강좌') || text.includes('교육') || text.includes('체험') || text.includes('아카데미') || text.includes('워크숍') || text.includes('교실') || text.includes('특강') || text.includes('도서관')) return 'class';
    if (text.includes('축제') || text.includes('페스티벌') || text.includes('행사')) return 'festival';
    if (text.includes('뮤지컬')) return 'musical';
    if (text.includes('연극')) return 'play';
    if (text.includes('무용') || text.includes('발레')) return 'dance';

    return 'etc';
}

// Check Seoul Data
const items = Array.isArray(seoulData) ? seoulData : [];
let unknownCount = 0;
let classifiedCount = 0;

console.log(`Checking ${items.length} Seoul Culture items...`);

items.forEach((p: any) => {
    const genre = inferSeoulGenre(p.title || '', p.place || '', p.codename || '');
    if (genre === 'etc' || genre === 'unknown') {
        // Log only if it truly failed to match any keyword
        // console.log(`[Unknown] ${p.title} (${p.place})`);
        unknownCount++;
    } else {
        classifiedCount++;
    }
});

console.log(`Classified: ${classifiedCount}`);
console.log(`Remaining Unknown/Etc: ${unknownCount}`);

// Also list the remaining unknowns to see if we missed patterns
if (unknownCount > 0) {
    console.log('\n--- Remaining Unknown Items ---');
    items.forEach((p: any) => {
        const genre = inferSeoulGenre(p.title || '', p.place || '', p.codename || '');
        if (genre === 'etc' || genre === 'unknown') {
            console.log(`[${genre}] ${p.title} | ${p.place}`);
        }
    });
}
