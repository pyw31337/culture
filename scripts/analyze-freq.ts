import fs from 'fs';
import path from 'path';
import { getAllPerformances } from '../src/lib/performance-data';

const CACHE_FILE = path.join(process.cwd(), 'src/data/translation-cache.json');
const cache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));

async function analyzeFrequency() {
    const performances = await getAllPerformances('ko', true);
    const fields = ['venue', 'address', 'title']; // Top priorities
    const freq: Record<string, number> = {};

    performances.forEach((p: any) => {
        fields.forEach(field => {
            const text = p[field];
            if (text && typeof text === 'string') {
                const clean = text.trim();
                // Only count if NOT fully translated in all 3 languages
                const entry = cache[clean];
                if (!entry || !entry.en || !entry.ja || !entry.zh) {
                    freq[clean] = (freq[clean] || 0) + 1;
                }
            }
        });
    });

    const sorted = Object.entries(freq).sort((a, b) => b[1] - a[1]);
    const top200 = sorted.slice(0, 200).map(item => item[0]);
    console.log(JSON.stringify(top200, null, 2));
}

analyzeFrequency().catch(console.error);
