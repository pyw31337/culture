import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

const TARGET_URL = 'https://mom-mom.net/travel/places/655ac8ff7befcfe324f22e26';

async function debugScrape() {
    console.log(`Debugging URL: ${TARGET_URL}`);
    const browser = await puppeteer.launch({
        headless: true, // Set to false to see the browser
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    try {
        await page.goto(TARGET_URL, { waitUntil: 'networkidle2', timeout: 30000 });

        // Wait for content
        await page.waitForSelector('article');

        const data = await page.evaluate(() => {
            const results: any = {};

            // User provided selectors:
            // Feature: body > div.container > main > div:nth-child(1) > article > div.sc-d303a32e-0.ftBodQ > p
            // Target: body > div.container > main > div:nth-child(1) > article > div.sc-d303a32e-0.ftBodQ > div > div > p

            // Try explicit selectors (ignoring dynamic class hashes if possible, or testing them)
            const article = document.querySelector('article');
            if (!article) return { error: 'No article found' };

            // Dump basic structure
            const articleText = article.innerText;
            results.articleTextStart = articleText.substring(0, 200);

            // Test User's Feature Logic
            // "양주 장흥에서 떠나는 과거 여행" is likely the first P in the article or inside a specific div
            const ps = Array.from(document.querySelectorAll('article p'));
            results.paragraphs = ps.map(p => p.textContent?.trim()).slice(0, 5);

            // Test User's Target Logic
            // "48개월 이상 아들에게 인기"
            const divs = Array.from(document.querySelectorAll('article div'));

            // Look for specific text to find where it lives
            const targetText = '48개월 이상';
            const targetEl = Array.from(document.querySelectorAll('*')).find(el => el.children.length === 0 && el.textContent?.includes(targetText));

            if (targetEl) {
                results.targetFound = true;
                results.targetTag = targetEl.tagName;
                results.targetClass = targetEl.className;
                results.targetText = targetEl.textContent;
                // Get path
                let path = [];
                let curr: any = targetEl;
                while (curr && curr.tagName !== 'BODY') {
                    path.unshift(`${curr.tagName}.${Array.from(curr.classList).join('.')}`);
                    curr = curr.parentElement;
                }
                results.targetPath = path.join(' > ');
            } else {
                results.targetFound = false;
            }

            // Feature Text Search
            const featureText = '과거 여행';
            const featureEl = Array.from(document.querySelectorAll('*')).find(el => el.children.length === 0 && el.textContent?.includes(featureText));
            if (featureEl) {
                results.featureFound = true;
                results.featureTag = featureEl.tagName;
                results.featureClass = featureEl.className;
                results.featureText = featureEl.textContent;
                // Get path
                let path = [];
                let curr: any = featureEl;
                while (curr && curr.tagName !== 'BODY') {
                    path.unshift(`${curr.tagName}.${Array.from(curr.classList).join('.')}`);
                    curr = curr.parentElement;
                }
                results.featurePath = path.join(' > ');
            } else {
                results.featureFound = false;
            }

            return results;
        });

        console.log('Debug Results:', JSON.stringify(data, null, 2));

    } catch (e) {
        console.error('Error:', e);
    } finally {
        await browser.close();
    }
}

debugScrape();
