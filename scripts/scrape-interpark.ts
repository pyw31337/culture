
import fs from 'fs';
import path from 'path';
import { fetchPerformances } from '../src/lib/interpark';

async function scrapeInterpark() {
    console.log('Starting Interpark scraping...');

    const regions = ['seoul', 'gyeonggi', 'incheon'];
    let allData: any[] = [];

    for (const region of regions) {
        console.log(`Fetching ${region}...`);
        try {
            const data = await fetchPerformances(region);
            console.log(`Fetched ${data.length} items for ${region}`);
            allData = [...allData, ...data];
        } catch (error) {
            console.error(`Failed to fetch ${region}:`, error);
        }
    }

    // Deduplicate by ID just in case
    const uniqueData = Array.from(new Map(allData.map(item => [item.id, item])).values());

    const outputPath = path.join(process.cwd(), 'src', 'data', 'interpark.json');
    fs.writeFileSync(outputPath, JSON.stringify(uniqueData, null, 2), 'utf-8');

    console.log(`Successfully saved ${uniqueData.length} items to ${outputPath}`);
}

scrapeInterpark();
