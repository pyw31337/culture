/**
 * Enrich SSSD class items with address information
 * Scrapes address from each class detail page and updates sssd-class.json
 */
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import fs from 'fs';
import path from 'path';

puppeteer.use(StealthPlugin());

interface SssdClassItem {
    id: string;
    title: string;
    date: string;
    venue: string;
    price: string;
    originalPrice: string;
    discount: string;
    image: string;
    link: string;
    genre: string;
    source: string;
    tags: string[];
    status: string;
    address?: string;
    lastEnriched?: string;
}

const DATA_PATH = path.resolve(process.cwd(), 'src/data/sssd-class.json');
const CONCURRENCY = 3;
const DELAY_MS = 1000;

class ProgressBar {
    private total: number;
    private current: number = 0;
    private barLength: number;

    constructor(total: number, barLength: number = 40) {
        this.total = total;
        this.barLength = barLength;
    }

    update(current: number) {
        this.current = current;
        const percentage = Math.round((current / this.total) * 100);
        const filled = Math.round((current / this.total) * this.barLength);
        const bar = '█'.repeat(filled) + '░'.repeat(this.barLength - filled);
        process.stdout.write(`\r[${bar}] ${percentage}% (${current}/${this.total})`);
    }

    finish() {
        process.stdout.write('\n');
    }
}

async function extractAddress(page: any): Promise<string> {
    return await page.evaluate(() => {
        // Primary selector from user
        const primarySelector = '#class_info > div.address-info-box.info-area.p-t-30.p-l-15.p-r-15.m-b-30 > div > div.info-address-text-area > span';
        const primary = document.querySelector(primarySelector);
        if (primary?.textContent?.trim()) {
            return primary.textContent.trim();
        }

        // Fallback: look for address-info-box
        const addressBox = document.querySelector('.address-info-box .info-address-text-area span');
        if (addressBox?.textContent?.trim()) {
            return addressBox.textContent.trim();
        }

        // Fallback: look for any element with address-like content
        const allSpans = document.querySelectorAll('span');
        for (const span of allSpans) {
            const text = span.textContent?.trim() || '';
            // Korean address patterns
            if (/^(서울|경기|인천|부산|대전|대구|광주|울산|세종|강원|충북|충남|전북|전남|경북|경남|제주)/.test(text)) {
                if (text.length > 10 && text.length < 150 && (text.includes('로') || text.includes('길') || text.includes('동'))) {
                    return text;
                }
            }
        }

        return '';
    });
}

function cleanAddress(raw: string): string {
    let addr = raw.trim();
    // Remove '대한민국 ' prefix if present
    addr = addr.replace(/^대한민국\s*/, '');
    // Standardize city names
    addr = addr.replace('서울특별시', '서울');
    addr = addr.replace('경기도', '경기');
    addr = addr.replace('인천광역시', '인천');
    addr = addr.replace('부산광역시', '부산');
    addr = addr.replace('대구광역시', '대구');
    addr = addr.replace('대전광역시', '대전');
    addr = addr.replace('광주광역시', '광주');
    addr = addr.replace('울산광역시', '울산');
    addr = addr.replace('제주특별자치도', '제주');
    return addr.trim();
}

async function enrichSssdAddresses() {
    console.log('Starting SSSD Address Enrichment...\n');

    if (!fs.existsSync(DATA_PATH)) {
        console.error('sssd-class.json not found!');
        return;
    }

    const data: SssdClassItem[] = JSON.parse(fs.readFileSync(DATA_PATH, 'utf-8'));
    console.log(`Loaded ${data.length} items from sssd-class.json`);

    // Filter items that need address enrichment
    const needsEnrichment = data.filter(item => {
        // Force re-enrich all SSSD items to fix the English address issue
        return true;
    });

    console.log(`Items needing enrichment: ${needsEnrichment.length}`);

    if (needsEnrichment.length === 0) {
        console.log('All items already have addresses. Nothing to do.');
        return;
    }

    const browser = await puppeteer.launch({
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--lang=ko-KR,ko'
        ]
    });

    const progressBar = new ProgressBar(needsEnrichment.length);
    let processed = 0;
    let updated = 0;
    let failed = 0;

    // Create a lookup map
    const dataMap = new Map<string, SssdClassItem>();
    data.forEach(item => dataMap.set(item.link, item));

    // Process in chunks
    for (let i = 0; i < needsEnrichment.length; i += CONCURRENCY) {
        const chunk = needsEnrichment.slice(i, i + CONCURRENCY);

        const promises = chunk.map(async (item) => {
            const page = await browser.newPage();

            // Aggressive language forcing
            await page.evaluateOnNewDocument(() => {
                Object.defineProperty(navigator, 'language', { get: () => 'ko-KR' });
                Object.defineProperty(navigator, 'languages', { get: () => ['ko-KR', 'ko'] });
            });

            await page.setViewport({ width: 1280, height: 800 });
            await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
            await page.setExtraHTTPHeaders({
                'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7'
            });

            try {
                // Use a longer timeout and wait for networkidle2
                await page.goto(item.link, { waitUntil: 'networkidle2', timeout: 40000 });

                // Extra wait for any late-loading JS
                await new Promise(r => setTimeout(r, 5000));

                // Ensure #class_info is present
                await page.waitForSelector('#class_info', { timeout: 15000 }).catch(() => { });

                const rawAddress = await extractAddress(page);

                if (rawAddress) {
                    const cleanedAddress = cleanAddress(rawAddress);

                    // Update the item in the map
                    const existing = dataMap.get(item.link);
                    if (existing) {
                        existing.venue = cleanedAddress;
                        existing.address = cleanedAddress;
                        existing.lastEnriched = new Date().toISOString();
                        updated++;
                        console.log(`\n  ✓ ${item.id}: ${cleanedAddress.substring(0, 50)}...`);
                    }
                } else {
                    failed++;
                    console.log(`\n  ✗ ${item.id}: Address not found`);
                }
            } catch (e) {
                failed++;
                console.log(`\n  ✗ ${item.id}: Error - ${e}`);
            } finally {
                await page.close();
            }
        });

        await Promise.all(promises);
        processed += chunk.length;
        progressBar.update(processed);

        // Save periodically
        if (i % 15 === 0) {
            const updatedData = Array.from(dataMap.values());
            fs.writeFileSync(DATA_PATH, JSON.stringify(updatedData, null, 2), 'utf-8');
        }
    }

    progressBar.finish();
    await browser.close();

    // Final save
    const finalData = Array.from(dataMap.values());
    fs.writeFileSync(DATA_PATH, JSON.stringify(finalData, null, 2), 'utf-8');

    console.log(`\n=== Enrichment Complete ===`);
    console.log(`Total processed: ${processed}`);
    console.log(`Updated: ${updated}`);
    console.log(`Failed: ${failed}`);
}

enrichSssdAddresses().catch(console.error);
