import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'src/data');

// Pruning Rules (Days to keep without update)
const RULES: Record<string, number> = {
    // 'movies.json': 3,       // Removed: User wants movies to accumulate
    'museum.json': 14,         // Museum: 14 days (Slow turnover)
};

// Generic Interface for items with lastCollected
interface CollectableItem {
    lastCollected?: string;
    title?: string;
    endDate?: string;
    [key: string]: any;
}

function pruneData() {
    console.log('🧹 Starting Data Pruning...');
    const now = new Date();

    for (const [filename, daysToKeep] of Object.entries(RULES)) {
        const filePath = path.join(DATA_DIR, filename);
        if (!fs.existsSync(filePath)) {
            console.log(`Skipping ${filename} (Not found)`);
            continue;
        }

        try {
            const raw = fs.readFileSync(filePath, 'utf-8');
            const data: CollectableItem[] = JSON.parse(raw);
            const initialCount = data.length;

            const validData = data.filter(item => {
                // 1. Check End Date (if exists) -> Removal ONLY if BOTH start and end exist and end is past
                if (item.startDate && item.endDate) {
                    const end = new Date(item.endDate);
                    // Add 1 day buffer
                    end.setDate(end.getDate() + 1);
                    if (end < now) {
                        return false;
                    }
                }

                // 2. Check Last Collected (Stale Data)
                if (item.lastCollected) {
                    const collected = new Date(item.lastCollected);
                    const diffTime = Math.abs(now.getTime() - collected.getTime());
                    const diffDays = diffTime / (1000 * 60 * 60 * 24);

                    if (diffDays > daysToKeep) {
                        console.log(`[Stale] ${item.title || 'Item'} in ${filename} (Age: ${diffDays.toFixed(1)} days)`);
                        return false;
                    }
                } else {
                    // If no lastCollected, we might want to keep it or assume it's legacy?
                    // Let's keep it for now, but maybe mark it? 
                    // For now, assume if it has no date, it's NOT stale (legacy data safe mode)
                    // Or we could enforce it. Let's start safe.
                }

                return true;
            });

            if (validData.length < initialCount) {
                console.log(`✂️ Pruned ${initialCount - validData.length} items from ${filename}. (Remaining: ${validData.length})`);
                fs.writeFileSync(filePath, JSON.stringify(validData, null, 2));
            } else {
                console.log(`✅ ${filename} is clean. (${initialCount} items)`);
            }

        } catch (e) {
            console.error(`Error pruning ${filename}:`, e);
        }
    }
    console.log('Thinking complete.');
}

pruneData();
