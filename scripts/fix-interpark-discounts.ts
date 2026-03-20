import fs from 'fs';
import path from 'path';

const interparkPath = path.resolve(__dirname, '../src/data/interpark.json');

function parsePrice(priceStr: string): number {
    if (!priceStr) return 0;
    const numStr = priceStr.replace(/[^0-9]/g, '');
    return numStr ? parseInt(numStr, 10) : 0;
}

function fixDiscounts() {
    console.log("Loading interpark.json...");
    const data = JSON.parse(fs.readFileSync(interparkPath, 'utf-8'));
    let fixedCount = 0;

    data.forEach((item: any) => {
        if (item.price && item.originalPrice && item.discount === '100%') {
            const price = parsePrice(item.price);
            const original = parsePrice(item.originalPrice);

            // If the price is NOT 0, it can't be a 100% discount.
            if (price > 0 && original > price) {
                const actualDiscount = Math.round(((original - price) / original) * 100);
                console.log(`Fixing [${item.title}]: Price=${price}, Original=${original}, OldDiscount=${item.discount} -> ${actualDiscount}%`);
                item.discount = `${actualDiscount}%`;
                fixedCount++;
            }
        }
    });

    if (fixedCount > 0) {
        fs.writeFileSync(interparkPath, JSON.stringify(data, null, 2), 'utf-8');
        console.log(`\nFixed ${fixedCount} items with incorrect 100% discounts.`);
    } else {
        console.log("No incorrect 100% discounts found.");
    }
}

fixDiscounts();
