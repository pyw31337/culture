
import fs from 'fs';
import path from 'path';
import performances from '../public/data/performances.json';

// Define the type for performance items
interface Performance {
    id: string;
    title: string;
    posterUrl: string;
    // Add other properties if needed
}

// Cast the imported JSON to the correct type
const items = performances as Performance[];

async function validateImages() {
    console.log(`Starting validation of ${items.length} items...`);

    const brokenImages: Performance[] = [];
    const missingImages: Performance[] = [];

    // Concurrency limit
    const batchSize = 20;

    for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize);

        await Promise.all(batch.map(async (item) => {
            // @ts-ignore
            const imageUrl = item.image || item.posterUrl; // Fallback just in case

            if (!imageUrl) {
                missingImages.push(item);
                return;
            }

            // Skip if it's a relative path (local image) - assume valid for now or check file existence
            if (imageUrl.startsWith('/')) {
                const localPath = path.join(process.cwd(), 'public', imageUrl);
                if (!fs.existsSync(localPath)) {
                    console.log(`[LOCAL MISSING] ${item.title}: ${imageUrl}`);
                    brokenImages.push(item);
                }
                return;
            }

            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout

                const response = await fetch(imageUrl, {
                    method: 'HEAD',
                    signal: controller.signal
                });
                clearTimeout(timeoutId);

                if (!response.ok) {
                    console.log(`[${response.status}] ${item.title}: ${imageUrl}`);
                    brokenImages.push(item);
                }
            } catch (error: any) {
                console.log(`[ERROR] ${item.title}: ${imageUrl} - ${error.message}`);
                brokenImages.push(item);
            }
        }));

        if (i % 100 === 0) {
            console.log(`Processed ${i}/${items.length}...`);
        }
    }

    console.log('--- Report ---');
    console.log(`Total Items: ${items.length}`);
    console.log(`Missing Poster URL: ${missingImages.length}`);
    console.log(`Broken/404 Posters: ${brokenImages.length}`);

    fs.writeFileSync('broken-images-report.json', JSON.stringify(brokenImages, null, 2));
    console.log('Report saved to broken-images-report.json');
}

validateImages();
