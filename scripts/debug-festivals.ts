
import * as fs from 'fs';
import * as path from 'path';

const OUTPUT_FILE = path.join(process.cwd(), 'src/data/festivals.json');

function isPerformanceActive(dateStr: string, today: Date): boolean {
    if (!dateStr) return false;

    try {
        let cleanDate = dateStr;

        if (cleanDate.includes('~')) {
            const parts = cleanDate.split('~');
            const endStr = parts[1].trim();
            const [y, m, d] = endStr.split('.').map(Number);
            const targetDate = new Date(y, m - 1, d);
            targetDate.setHours(23, 59, 59, 999);

            if (!targetDate || isNaN(targetDate.getTime())) return true;
            return targetDate.getTime() >= today.getTime();
        }

        // Handle single date or other format if necessary
        return false;

    } catch (e) {
        return true;
    }
}

async function main() {
    if (!fs.existsSync(OUTPUT_FILE)) {
        console.log('No festivals.json found');
        return;
    }
    const data = JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf-8'));
    console.log(`Total Items: ${data.length}`);

    const today = new Date('2026-01-09T00:00:00');
    console.log(`Reference Date: ${today.toISOString()}`);

    let activeCount = 0;

    console.log('\n--- List of Active Items ---');
    data.forEach((item: any) => {
        if (isPerformanceActive(item.date, today)) {
            activeCount++;
            console.log(`[${item.region}] ${item.title} : ${item.date.replace(/\n/g, ' ')}`);
        }
    });

    console.log(`\nActive Items (Date >= Jan 9, 2026): ${activeCount}`);

    console.log(`\nItems with 2026 in date string but marked EXPIRED:`);
    let falseNegativeCount = 0;
    data.forEach((item: any) => {
        if (item.date.includes('2026') && !isPerformanceActive(item.date, today)) {
            console.log(`[FAILED? ${item.region}] ${item.title} : ${item.date.replace(/\n/g, ' ')}`);
            falseNegativeCount++;
        }
    });
    console.log(`Potential False Negatives count: ${falseNegativeCount}`);
}

main();
