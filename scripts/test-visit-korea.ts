import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { Browser, Page } from 'puppeteer';

puppeteer.use(StealthPlugin());

const DETAIL_BASE_URL = 'https://korean.visitkorea.or.kr/kfes/detail/fstvlDetail.do';
const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36';

async function testScrape(festivalId: string) {
    const browser: Browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined
    });

    try {
        const page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 1024 });
        await page.setUserAgent(USER_AGENT);

        const url = `${DETAIL_BASE_URL}?fstvlCntntsId=${festivalId}`;
        console.log(`Navigating to ${url}`);
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

        const detailImage = await page.evaluate(() => {
            const results: Record<string, string | null> = {};

            const posterImg = document.querySelector('#mainTab .detail_img_box img');
            results.primarySelector = posterImg ? (posterImg as HTMLImageElement).src : null;

            const bgEl = document.querySelector('#mainTab > div > section > div > div');
            if (bgEl) {
                const style = window.getComputedStyle(bgEl);
                const bgImage = style.backgroundImage;
                if (bgImage && bgImage !== 'none') {
                    const match = bgImage.match(/url\(["']?(.*?)["']?\)/);
                    if (match && match[1]) {
                        results.bgCover = match[1];
                    }
                }
            } else {
                results.bgCover = null;
            }

            // Look for any image matching the CDN
            const allImages = Array.from(document.querySelectorAll('img')).map(img => img.src);
            results.allCdnImages = allImages.filter(src => src.includes('kfescdn.visitkorea.or.kr')).join(', ') || null;

            return results;
        });

        console.log('Extraction Results:', detailImage);
    } catch (e) {
        console.error(e);
    } finally {
        await browser.close();
    }
}

testScrape('53ad5cbd-9241-4efa-8366-49c919001862');
