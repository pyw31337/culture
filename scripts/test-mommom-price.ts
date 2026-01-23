// Test script for Mom-Mom price extraction fix
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

const TEST_URL = 'https://mom-mom.net/travel/places/687786f929c84adaf8a5aee2';

(async () => {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();

    console.log(`Testing price extraction on: ${TEST_URL}`);
    await page.goto(TEST_URL, { waitUntil: 'networkidle2', timeout: 30000 });

    // Wait for content
    await page.waitForSelector('section', { timeout: 5000 }).catch(() => { });

    const result = await page.evaluate(() => {
        // Helper: Extract the actual price number from text
        const extractPrice = (text: string): string | null => {
            // Remove parenthetical content first to avoid matching ages
            const cleaned = text.replace(/\([^)]*\)/g, '');

            // Pattern 1: Number followed by 원 at end or with space
            const priceMatch = cleaned.match(/([\d,]+)\s*원/);
            if (priceMatch) {
                const numStr = priceMatch[1].replace(/,/g, '');
                const num = parseInt(numStr, 10);
                // Validate: Prices below 500원 are suspicious (except for free)
                if (num >= 500 || text.includes('무료')) {
                    return priceMatch[1] + '원';
                }
            }
            return null;
        };

        let price = '';
        let allPrices: string[] = [];

        // Method 1: Find section with h2 containing "요금"
        const sections = Array.from(document.querySelectorAll('section'));
        for (const section of sections) {
            const h2 = section.querySelector('h2');
            if (h2 && h2.textContent?.includes('요금')) {
                const listItems = Array.from(section.querySelectorAll('li'));
                for (const li of listItems) {
                    const text = li.textContent?.trim() || '';
                    if (text === '[요금]') continue;

                    allPrices.push(`RAW: "${text}"`);

                    // Check for 무료 first
                    if (text.includes('무료') && !text.includes('이상')) {
                        allPrices.push(`  -> 무료 detected`);
                        if (!price) price = text;
                        continue;
                    }

                    // Extract price using helper
                    const extracted = extractPrice(text);
                    if (extracted) {
                        // Include context (adult/child label) if available
                        const labelMatch = text.match(/^([가-힣]+)\s*[\(\-:]/);
                        let finalPrice;
                        if (labelMatch) {
                            finalPrice = labelMatch[1] + ': ' + extracted;
                        } else {
                            finalPrice = extracted;
                        }
                        allPrices.push(`  -> Extracted: "${finalPrice}"`);
                        if (!price) price = finalPrice;
                    } else {
                        allPrices.push(`  -> No valid price found`);
                    }
                }
                break;
            }
        }

        return { price, allPrices };
    });

    console.log('\n=== Price Extraction Test Result ===');
    console.log('Final Price:', result.price);
    console.log('\nDetailed Extraction Log:');
    result.allPrices.forEach(p => console.log(p));

    await browser.close();
})();
