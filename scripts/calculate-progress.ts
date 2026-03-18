import fs from 'fs';
import path from 'path';
import { getAllPerformances } from '../src/lib/performance-data';

const CACHE_FILE = path.join(process.cwd(), 'src/data/translation-cache.json');
const cache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));

async function calculateProgress() {
    const performances = await getAllPerformances('ko', true);
    const locales = ['en', 'ja', 'zh'];
    const fields = ['title', 'venue', 'address']; // Key visible fields
    
    const results: Record<string, { total: number, translated: number }> = {};
    locales.forEach(l => results[l] = { total: 0, translated: 0 });

    performances.forEach((p: any) => {
        fields.forEach(field => {
            const text = p[field];
            if (text && typeof text === 'string' && text.trim().length > 0) {
                const clean = text.trim();
                locales.forEach(locale => {
                    results[locale].total++;
                    if (cache[clean] && cache[clean][locale]) {
                        results[locale].translated++;
                    }
                });
            }
        });
    });

    console.log('--- Translation Progress ---');
    locales.forEach(l => {
        const pct = ((results[l].translated / results[l].total) * 100).toFixed(2);
        console.log(`${l.toUpperCase()}: ${pct}% (${results[l].translated}/${results[l].total})`);
    });
}

calculateProgress().catch(console.error);
