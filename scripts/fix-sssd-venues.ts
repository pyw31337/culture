
import * as fs from 'fs';
import * as path from 'path';
import puppeteer from 'puppeteer';

const DATA_DIR = path.resolve(process.cwd(), 'src/data');
const VENUE_PATH = path.join(DATA_DIR, 'venues.json');

async function main() {
    console.log('Loading data...');
    const venueData = JSON.parse(fs.readFileSync(VENUE_PATH, 'utf-8'));

    // Find targets
    const targets: string[] = [];
    for (const key of Object.keys(venueData)) {
        if (key.includes('sssd.co.kr')) {
            targets.push(key);
        }
    }

    console.log(`Found ${targets.length} SSSD URL keys to fix.`);
    if (targets.length === 0) return;

    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    await page.setViewport({ width: 375, height: 812 });

    const keyMap: Record<string, string> = {};

    // Strict Selector from User/Debug
    const TARGET_SELECTOR = '#class_info > div.address-info-box.info-area.p-t-30.p-l-15.p-r-15.m-b-30 > div > div.info-address-text-area > span';
    // Fallback if structure varies slightly
    const FALLBACK_SELECTOR = '.info-address-text-area > span';

    for (const urlKey of targets) {
        try {
            const url = urlKey.startsWith('http') ? urlKey : `https://${urlKey}`;
            console.log(`Visiting ${url}...`);
            await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

            // Wait for selector
            try {
                await page.waitForSelector('.info-address-text-area', { timeout: 5000 });
            } catch (e) {
                console.log('  Timeout waiting for selector container.');
            }

            const addressText = await page.evaluate((sel1, sel2) => {
                const el1 = document.querySelector(sel1);
                if (el1 && el1.textContent && el1.textContent.trim().length > 5) return el1.textContent.trim();
                const el2 = document.querySelector(sel2);
                return el2 ? el2.textContent?.trim() : null;
            }, TARGET_SELECTOR, FALLBACK_SELECTOR);

            if (addressText) {
                // Parsing Logic
                let newAddress = addressText;
                let newName = '';

                // Logic: Split by " (Dong) " or just use regex for "Address + Name"
                // "서울 성동구 성덕정길 103-39 (성수동2가) 1층 Deep atelier"
                // Regex to find the end of the address part (Ending in parenthesis or number)

                // Matches "Region ... (Dong)"
                const parenMatch = addressText.match(/^(.+\([^)]+\))\s+(.*)$/);

                if (parenMatch) {
                    newAddress = parenMatch[1]; // "서울 ... (성수동2가)"
                    newName = parenMatch[2]; // "1층 Deep atelier"
                } else {
                    // Try finding the last number that looks like a street number?
                    // Hard without complex regex.
                    // Fallback: entire string is address.
                    // Name = try to extract trailing non-address words?
                    // "Some Road 123 SomeCafe"

                    // Use simple heuristic: Last 2 words are name if string is long?
                    newAddress = addressText;
                    const words = addressText.split(' ');
                    if (words.length > 3) {
                        const potentialName = words.slice(-2).join(' ');
                        // Verify potentialName isn't just numbers
                        if (!/^\d+$/.test(potentialName.replace(/\s/g, ''))) {
                            newName = potentialName;
                        } else {
                            newName = addressText;
                        }
                    } else {
                        newName = addressText;
                    }
                }

                // Cleanup Name
                newName = newName.replace(/^(1층|2층|3층|4층|5층|B\d+|지하\s*\d+층)\s*/, '');
                newName = newName.replace(/^\d+호\s*/, '');
                newName = newName.trim();

                if (!newName || newName.length < 2) newName = addressText;

                // Fix specific cases
                if (addressText.includes('피노키오 상가')) {
                    newAddress = "경기 부천시 원미구 부천로3번길 48 (심곡동, 심곡동 피노키오 상가)";
                    newName = "피노키오 상가";
                }

                console.log(`  -> Resolved:\n     Raw: "${addressText}"\n     Addr: "${newAddress}"\n     Name: "${newName}"`);

                if (newName.length > 50) newName = newName.substring(0, 50);

                const uniqueKey = newName;
                venueData[uniqueKey] = {
                    ...venueData[urlKey],
                    name: newName,
                    address: newAddress,
                    cleanAddress: newAddress
                };

                if (uniqueKey !== urlKey) {
                    keyMap[urlKey] = uniqueKey;
                    delete venueData[urlKey];
                }

            } else {
                console.log(`  [WARN] No address found for ${urlKey}`);
            }

        } catch (e) {
            console.error(`  [ERROR] Failed to process ${urlKey}:`, e);
        }
        await new Promise(r => setTimeout(r, 1000));
    }

    await browser.close();

    fs.writeFileSync(VENUE_PATH, JSON.stringify(venueData, null, 2));

    console.log('Updating performance files...');
    const files = fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.json'));
    for (const file of files) {
        if (file === 'venues.json') continue;
        const p = path.join(DATA_DIR, file);
        const data = JSON.parse(fs.readFileSync(p, 'utf-8'));
        let modified = false;

        const updateItem = (item: any) => {
            if (keyMap[item.venue]) {
                item.venue = keyMap[item.venue];
                modified = true;
            }
        };

        if (Array.isArray(data)) {
            data.forEach(updateItem);
        } else {
            Object.values(data).forEach(updateItem);
        }

        if (modified) {
            fs.writeFileSync(p, JSON.stringify(data, null, 2));
            console.log(`Updated ${file}`);
        }
    }

    console.log('Done.');
}

main().catch(console.error);
