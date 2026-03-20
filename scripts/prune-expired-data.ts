import fs from 'fs';
import path from 'path';

const DATA_DIR = path.resolve(process.cwd(), 'src/data');
const PRUNE_GRACE_PERIOD_DAYS = 30; // Delete events older than 30 days

// Files that shouldn't be touched by the date pruner
const EXCLUDED_FILES = [
    'cinemas.json',
    'venues.json',
    'venue-dictionary.json',
    'korean_address_hierarchy.json',
    'movies.json', // Movies have complex ranking rules, kept separate for now
    'museum.json' // Permanent locations, no strict end date
];

function isDateTooOld(dateStr: string, cutoffDate: Date): boolean {
    if (!dateStr || typeof dateStr !== 'string') return false;

    // Strict requirement: Both start and end dates must be present (delimited by '~')
    if (!dateStr.includes('~')) {
        return false; 
    }

    try {
        const parts = dateStr.split('~');
        if (parts.length < 2) return false;

        const startStr = parts[0].trim();
        const endStr = parts[1].trim();

        // Validate both parts look like dates
        const datePattern = /(\d{2,4})[-\.](\d{1,2})[-\.](\d{1,2})/;
        if (!datePattern.test(startStr) || !datePattern.test(endStr)) {
            return false;
        }

        let targetDate: Date | null = null;
        const matches = endStr.match(datePattern);
        
        if (matches) {
            let [, yStr, mStr, dStrPart] = matches;
            let y = parseInt(yStr);
            if (y < 100) y += 2000;
            targetDate = new Date(y, parseInt(mStr) - 1, parseInt(dStrPart));
        }

        if (!targetDate || isNaN(targetDate.getTime())) return false;

        targetDate.setHours(23, 59, 59, 999);
        return targetDate.getTime() < cutoffDate.getTime();
    } catch (e) {
        return false;
    }
}

async function pruneData() {
    console.log(`🧹 Starting Data Pruning Process (Grace Period: ${PRUNE_GRACE_PERIOD_DAYS} days)`);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - PRUNE_GRACE_PERIOD_DAYS);
    console.log(`Dropping events that ended before: ${cutoffDate.toISOString().split('T')[0]}\n`);

    if (!fs.existsSync(DATA_DIR)) return;

    let totalPruned = 0;
    const files = fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.json') && !EXCLUDED_FILES.includes(f));

    for (const file of files) {
        const filePath = path.join(DATA_DIR, file);
        try {
            const fileContent = fs.readFileSync(filePath, 'utf-8');
            const data = JSON.parse(fileContent);

            if (Array.isArray(data)) {
                const initialLength = data.length;
                const prunedData = data.filter(item => {
                    // Try to find the date field (usually 'date', but some sources might use other keys loosely)
                    const dateVal = item.date || item.eventPeriod || item.period;
                    // If it's too old, we drop it (filter returns false)
                    return !isDateTooOld(dateVal, cutoffDate);
                });

                const prunedCount = initialLength - prunedData.length;
                if (prunedCount > 0) {
                    fs.writeFileSync(filePath, JSON.stringify(prunedData, null, 2));
                    console.log(`✅ [${file}] Pruned ${prunedCount} expired items. (Remaining: ${prunedData.length})`);
                    totalPruned += prunedCount;
                } else {
                    console.log(`➖ [${file}] No expired items to prune. (${initialLength} items)`);
                }
            } else {
                console.log(`⚠️ [${file}] Main struct isn't an array, skipping.`);
            }
        } catch (e: any) {
            console.error(`❌ [${file}] Error processing: ${e.message}`);
        }
    }

    console.log(`\n🎉 Pruning Complete! Total items removed: ${totalPruned}`);
}

pruneData();
