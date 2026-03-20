
import fs from 'fs';
import path from 'path';
import { glob } from 'glob';

const DATA_DIR = path.resolve(process.cwd(), 'src/data');

function parsePrice(priceStr: string): number {
    return parseInt(priceStr.replace(/[^0-9]/g, ''), 10);
}

async function run() {
    console.log('Starting Price/Discount Fix...');
    const files = glob.sync(path.join(DATA_DIR, '*.json'));

    // Regex for "50%40,000원" -> Group 1: 50%, Group 2: 40,000원
    const mergedPriceRegex = /^(\d+%)([\d,]+원)$/;

    for (const file of files) {
        // Skip venues.json
        if (file.endsWith('venues.json')) continue;

        try {
            const content = JSON.parse(fs.readFileSync(file, 'utf-8'));
            if (!Array.isArray(content)) continue;

            let changed = false;
            let fixedCount = 0;

            const updated = content.map((item: any) => {
                let originalPrice = item.originalPrice;
                let discount = item.discount;
                let price = item.price; // "38,400원"

                // 1. Check for Merged String in originalPrice
                if (typeof originalPrice === 'string') {
                    const match = originalPrice.match(mergedPriceRegex);
                    if (match) {
                        // Found "50%40,000원"
                        discount = match[1];      // "50%"
                        originalPrice = match[2]; // "40,000원"
                        fixedCount++;
                        changed = true;
                    }
                }

                // 2. If discount is missing but we have originalPrice > price, calculate it
                // Only if price is valid
                if (!discount && originalPrice && price && typeof originalPrice === 'string' && typeof price === 'string') {
                    const op = parsePrice(originalPrice);
                    const p = parsePrice(price);

                    if (op > p && op > 0) {
                        const rate = Math.round(((op - p) / op) * 100);
                        if (rate > 0) {
                            discount = `${rate}%`;
                            // changed = true; // Optional: separate cleanup vs enrichment? User asked for separation.
                            // Let's verify if user wants auto-calculation. 
                            // "할인율은 분리해서... 기재되던" implies separation is key. 
                            // I will stick to separation primarily.
                        }
                    }
                }

                return {
                    ...item,
                    originalPrice,
                    discount
                };
            });

            if (changed) {
                console.log(`Updated ${path.basename(file)}: Fixed ${fixedCount} items.`);
                fs.writeFileSync(file, JSON.stringify(updated, null, 2));
            } else {
                console.log(`No changes needed for ${path.basename(file)}.`);
            }

        } catch (e) {
            console.error(`Error processing ${file}:`, e);
        }
    }
    console.log('Price Fix Complete.');
}

run();
