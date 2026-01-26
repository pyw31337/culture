
import fs from 'fs';
import path from 'path';
import { glob } from 'glob';

const DATA_DIR = path.resolve(process.cwd(), 'src/data');

// Order matters for priority
const RULES = [
    { genre: 'class', keywords: ['클래스', '원데이', '수업', '레슨', '공방'] },
    { genre: 'musical', keywords: ['뮤지컬'] },
    { genre: 'play', keywords: ['연극'] },
    { genre: 'concert', keywords: ['콘서트', '라이브', '내한공연', '팬미팅', '리사이틀'] },
    // 'classic' might be default if '오케스트라' but '오케스트라 콘서트' should be concert? 
    // User said "Ghibli Concert" -> Concert. So Concert > Classic keywords.
];

async function run() {
    console.log('Starting Genre Reclassification...');
    const files = glob.sync(path.join(DATA_DIR, '*.json'));

    let totalFixed = 0;

    for (const file of files) {
        if (file.endsWith('venues.json')) continue;

        try {
            const content = JSON.parse(fs.readFileSync(file, 'utf-8'));
            if (!Array.isArray(content)) continue;

            let changed = false;
            let fileFixed = 0;

            const updated = content.map((item: any) => {
                const title = item.title;
                if (!title) return item;

                let newGenre = item.genre;

                // Check Rules
                for (const rule of RULES) {
                    // If any keyword matches
                    if (rule.keywords.some(k => title.includes(k))) {
                        // If current genre is different, update
                        if (newGenre !== rule.genre) {
                            // Special Check: Don't downgrade 'musical' to 'concert' if it's a "Musical Concert"? 
                            // Actually "Musical Concert" is usually a Concert genre wise (singing songs).
                            // But "Musical X" might be the show.
                            // However, user specifically asked about "Ghibli ... Concert" which was "Classic/Dance".

                            // Let's trust the Keywords.
                            // Exception: "키즈 뮤지컬" -> 'kids' might be better?
                            // But usually 'musical' is fine too since we have kids filter.
                            // Currently we have 'kids' genre. 
                            // If it's "Kids Musical", do we want 'kids' or 'musical'?
                            // If we switch to 'musical', they lose 'kids' category unless we support multi-genre (which we don't seem to yet, single string).

                            // SafeGuard: If current genre is 'kids', maybe keep it 'kids'?
                            if (newGenre === 'kids') {
                                // Keep kids as primary if we want to segregate kids content.
                                // But if user wants correct classification...
                                // Let's respect "Concert" over "Classic".
                                // If it's 'classic' and has 'concert', change it.

                                // Let's apply change if the NEW genre is strictly more specific or corrected.
                            }

                            newGenre = rule.genre;
                        }
                        break; // Stop after first match (Highest Priority)
                    }
                }

                if (newGenre !== item.genre) {
                    // console.log(`[${item.genre} -> ${newGenre}] ${title}`);
                    fileFixed++;
                    changed = true;
                    return { ...item, genre: newGenre };
                }

                return item;
            });

            if (changed) {
                console.log(`Updated ${path.basename(file)}: Reclassified ${fileFixed} items.`);
                fs.writeFileSync(file, JSON.stringify(updated, null, 2));
                totalFixed += fileFixed;
            }

        } catch (e) {
            console.error(`Error processing ${file}:`, e);
        }
    }
    console.log(`Genre Reclassification Complete. Total fixed: ${totalFixed}`);
}

run();
