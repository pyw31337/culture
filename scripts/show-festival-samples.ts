
import * as fs from 'fs';
import * as path from 'path';

const OUTPUT_FILE = path.join(process.cwd(), 'src/data/festivals.json');

function isPerformanceActive(dateStr: string, today: Date): { active: boolean, reason: string } {
    if (!dateStr) return { active: true, reason: 'No Date (Default Active)' };

    try {
        let cleanDate = dateStr.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();

        let targetDate: Date | null = null;

        if (cleanDate.includes('~')) {
            const parts = cleanDate.split('~');
            const endStr = parts[1].trim();
            const [y, m, d] = endStr.split('.').map(Number);
            targetDate = new Date(y, m - 1, d);
            targetDate.setHours(23, 59, 59, 999);
        } else if (cleanDate.match(/^\d{4}\.\d{2}\.\d{2}$/)) {
            const [y, m, d] = cleanDate.split('.').map(Number);
            targetDate = new Date(y, m - 1, d);
            targetDate.setHours(23, 59, 59, 999);
        }

        if (!targetDate || isNaN(targetDate.getTime())) return { active: true, reason: 'Parse Fail (Default Active)' };

        const isActive = targetDate.getTime() >= today.getTime();
        return {
            active: isActive,
            reason: `End Date: ${targetDate.getFullYear()}-${targetDate.getMonth() + 1}-${targetDate.getDate()} vs Today: ${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`
        };

    } catch (e) {
        return { active: true, reason: 'Error (Default Active)' };
    }
}

async function main() {
    if (!fs.existsSync(OUTPUT_FILE)) {
        console.log('No festivals.json found');
        return;
    }
    const data = JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf-8'));
    console.log(`Total Items: ${data.length}`);
    const today = new Date('2026-01-09T00:00:00'); // Today per system time

    console.log('--- Sample 100 Items ---');
    const samples = data.slice(0, 100);

    samples.forEach((item: any, index: number) => {
        const check = isPerformanceActive(item.date, today);
        const status = check.active ? 'ACTIVE ' : 'EXPIRED';
        // Clean date for display
        const displayDate = item.date.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
        console.log(`${String(index + 1).padStart(3, ' ')}. [${status}] ${item.title.substring(0, 20).padEnd(20)} | Date: ${displayDate} | Reason: ${check.reason}`);
    });
}

main();
