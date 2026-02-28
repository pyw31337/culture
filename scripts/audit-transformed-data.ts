import { getAllPerformances } from '../src/lib/performance-data';
import fs from 'fs';
import path from 'path';

async function audit() {
    console.log('--- CultureFlow Post-Transform Health Audit ---');

    // This will trigger the new transformation logic
    const performances = getAllPerformances();
    const totalItems = performances.length;
    let missingImages = 0;
    let placeholderCount = 0;
    let genreStats: Record<string, number> = {};

    performances.forEach((p: any) => {
        genreStats[p.genre] = (genreStats[p.genre] || 0) + 1;

        if (!p.image) {
            missingImages++;
        } else if (p.image.includes('placeholder.png') || p.image.includes('fallbacks')) {
            placeholderCount++;
            if (placeholderCount < 10) {
                console.log(`- Fallback used for: ${p.title} (${p.genre})`);
            }
        }
    });

    console.log(`Total Items: ${totalItems}`);
    console.log(`Missing Images (Null/Empty): ${missingImages}`);
    console.log(`Items using Fallbacks/Placeholder: ${placeholderCount}`);
    console.log('\nGenre Distribution:');
    Object.entries(genreStats).forEach(([genre, count]) => {
        console.log(`- ${genre}: ${count}`);
    });
    console.log('------------------------------------------------');
}

audit().catch(console.error);
