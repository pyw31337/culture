import fs from 'fs';
import path from 'path';
import { getAllPerformances } from '../src/lib/performance-data';
import { progressLogger } from './utils/progress-logger';

const CACHE_FILE = path.join(process.cwd(), 'src/data/translation-cache.json');
const cache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));

async function analyzeFrequency() {
    const performances = await getAllPerformances('ko', true);
    const fields = ['venue', 'address', 'title']; // Top priorities
    const freq: Record<string, number> = {};

    const bar = progressLogger.createBar('analyze', performances.length, 'Analyzing performance data...');

    performances.forEach((p: any, idx: number) => {
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
        progressLogger.update('analyze', idx + 1, `Analyzed ${idx + 1}/${performances.length}: ${p.title?.slice(0, 20)}...`);
    });

    progressLogger.stop();

    const sorted = Object.entries(freq).sort((a, b) => b[1] - a[1]);
    const top200 = sorted.slice(0, 200).map(item => item[0]);
    console.log(JSON.stringify(top200, null, 2));
}

analyzeFrequency().catch(console.error);
