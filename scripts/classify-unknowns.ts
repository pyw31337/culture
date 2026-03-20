
import * as fs from 'fs';
import * as path from 'path';

// Configuration
const DATA_DIR = path.resolve(process.cwd(), 'src/data');
const TARGET_FILES = ['seoul-culture.json', 'ott.json', 'festivals.json']; // Add others if needed

// Keyword Mappings (Order matters for priority)
const RULES: { genre: string; keywords: string[] }[] = [
    { genre: 'kids', keywords: ['어린이', '가족', '동화', '키즈', '아동', '유아', '인형극'] },
    { genre: 'musical', keywords: ['뮤지컬', 'musical'] },
    { genre: 'performance', keywords: ['퍼포먼스', '서커스', '마술'] }, // General 'performance' -> maybe map to 'play' or 'musical' in UI? 
    // Wait, UI uses: musical, play, classical, concert, exhibition, activity, class, festival, kids, movie, ott...
    // Let's stick to UI genres.

    { genre: 'play', keywords: ['연극', '극단', '낭독', '공연'] },
    { genre: 'classical', keywords: ['음악회', '클래식', '독주회', '리사이틀', '연주회', '교향악', '오케스트라', '아리아'] },
    { genre: 'concert', keywords: ['콘서트', '라이브', '가요', '밴드', '재즈', '무용', '발레'] }, // Ballet -> classical? Or concert? User UI has 'classical' which includes ballet in templates? No, templates had '무용' in classical.
    { genre: 'exhibition', keywords: ['전시', '미술', '갤러리', '박물관', '사진전', '비엔날레', '관람'] },
    { genre: 'festival', keywords: ['축제', '페스티벌', '한마당', '문화재야행'] },
    { genre: 'class', keywords: ['수업', '강좌', '클래스', '체험', '교육', '특강', '워크숍'] },
    { genre: 'movie', keywords: ['영화', '상영', '시네마'] },
];

function classify(title: string, currentGenre: string): string {
    // Only classify if unknown or etc
    if (currentGenre && currentGenre !== 'etc' && currentGenre !== 'unknown' && currentGenre !== '') {
        return currentGenre;
    }

    const t = title.toLowerCase();
    for (const rule of RULES) {
        for (const kw of rule.keywords) {
            if (t.includes(kw)) {
                return rule.genre;
            }
        }
    }
    return 'etc';
}

async function main() {
    console.log('Starting Unknown Content Classification...');

    for (const filename of TARGET_FILES) {
        const filePath = path.join(DATA_DIR, filename);
        if (!fs.existsSync(filePath)) {
            console.log(`Skipping ${filename} (not found)`);
            continue;
        }

        try {
            const content = fs.readFileSync(filePath, 'utf-8');
            const items = JSON.parse(content);
            let updatedCount = 0;

            const updatedItems = items.map((item: any) => {
                const oldGenre = item.genre || 'unknown';
                const newGenre = classify(item.title, oldGenre);

                if (newGenre !== oldGenre) {
                    updatedCount++;
                    // console.log(`[${filename}] "${item.title}": ${oldGenre} -> ${newGenre}`);
                    return { ...item, genre: newGenre };
                }
                return item;
            });

            if (updatedCount > 0) {
                fs.writeFileSync(filePath, JSON.stringify(updatedItems, null, 2));
                console.log(`✅ ${filename}: Updated ${updatedCount} items.`);
            } else {
                console.log(`- ${filename}: No changes.`);
            }

        } catch (e) {
            console.error(`Error processing ${filename}:`, e);
        }
    }
    console.log('Done.');
}

main();
