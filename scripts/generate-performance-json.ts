
import fs from 'fs';
import path from 'path';
import { getAllPerformances } from '../src/lib/performance-data';
import { sortPerformances } from '../src/lib/performance-filter';

// Helper to ensure directory exists
const ensureDirectoryExistence = (filePath: string) => {
    const dirname = path.dirname(filePath);
    if (fs.existsSync(dirname)) {
        return true;
    }
    ensureDirectoryExistence(dirname);
    fs.mkdirSync(dirname);
};

async function generate() {
    console.log('Generating static performance data...');
    try {
        const performances = await getAllPerformances();
        // Sort by default (Date Ascending) to match previous API behavior
        const sorted = sortPerformances(performances, 'all');

        const outputPath = path.join(process.cwd(), 'public', 'data', 'performances.json');

        // Ensure directory exists
        const dir = path.dirname(outputPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        fs.writeFileSync(outputPath, JSON.stringify(sorted));
        console.log(`Successfully generated ${sorted.length} items to ${outputPath}`);
    } catch (error) {
        console.error('Error generating performance data:', error);
        process.exit(1);
    }
}

generate();
