
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import fs from 'fs';
import path from 'path';

puppeteer.use(StealthPlugin());

const TARGET_URL = 'https://mom-mom.net/search?q=%EB%B0%95%EB%AC%BC%EA%B4%80/%EC%B2%B4%ED%97%98%EA%B4%80&hl=places';
const DATA_PATH = path.join(process.cwd(), 'src/data/museum.json');
const CONCURRENCY_LIMIT = 5;

interface MuseumItem {
    id: string;
    title: string;
    image: string;
    description: string;
    usageStat: string;
    link: string;
    address: string;
    genre: string;
}

async function scrapeMuseum() {
    console.log('Starting Museum/Experience Scraper...');
    const browser = await puppeteer.launch({
        headless: process.env.HEADLESS !== 'false',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
        const page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 800 });
        await page.goto(TARGET_URL, { waitUntil: 'networkidle2', timeout: 60000 });

        // 1. Infinite Scroll to load all items
        console.log('Scrolling to load all items (~800)...');
        // 1. Robust Infinite Scroll
        console.log('Scrolling to load all items...');
        let previousHeight = 0;
        let noChangeAttempts = 0;
        const MAX_NO_CHANGE = 10; // Stop after 10 attempts (~20 sec) of no new content

        while (noChangeAttempts < MAX_NO_CHANGE) {
            const currentHeight = await page.evaluate(() => document.body.scrollHeight);

            if (currentHeight > previousHeight) {
                previousHeight = currentHeight;
                noChangeAttempts = 0;
            } else {
                noChangeAttempts++;
            }

            // Scroll to bottom
            await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

            // Wait for load (variable delay)
            await new Promise(r => setTimeout(r, 2000));

            // Log progress
            const count = await page.evaluate(() => document.querySelectorAll('div.contents > a').length);
            process.stdout.write(`\rLoaded ${count} items...`);
        }
        console.log('\nFinished scrolling.');

        await new Promise(r => setTimeout(r, 3000)); // Final wait

        // 2. Extract List Items
        console.log('Extracting list items...');
        const listItems = await page.evaluate(() => {
            const results: { title: string, image: string, link: string, description: string, usageStat: string }[] = [];
            // Selector derived from user request:
            // body > div.container > main > div > div > div.sc-d0f9237-0.ecEicF > div > div.contents > a
            // We use a more generic query to be safe against 'sc-' hash changes if possible, but let's stick to the structure.
            // .contents > a seems reliable.

            const anchors = document.querySelectorAll('div.contents > a');

            anchors.forEach((a) => {
                const link = (a as HTMLAnchorElement).href;

                // Title: .title > h3
                const titleEl = a.querySelector('.title > h3');
                const title = titleEl?.textContent?.trim() || '';

                // Image: .image-container > div:nth-child(1) > div (bg image)
                const imgContainer = a.querySelector('.image-container');
                let image = '';
                if (imgContainer) {
                    const bgDiv = imgContainer.querySelector('div > div[style*="background-image"]');
                    if (bgDiv) {
                        const style = window.getComputedStyle(bgDiv);
                        const urlMatch = style.backgroundImage.match(/url\("?(.+?)"?\)/);
                        if (urlMatch) image = urlMatch[1];
                    }
                    if (!image) {
                        // Fallback to img tag
                        const imgTag = imgContainer.querySelector('img');
                        if (imgTag) image = imgTag.src;
                    }
                }

                // Description
                const descEl = a.querySelector('p.description');
                const description = descEl?.textContent?.trim() || '';

                // Usage Stat
                const usageEl = a.querySelector('div.usage-stat');
                const usageStat = usageEl?.textContent?.trim() || '';

                if (title && link) {
                    results.push({ title, image, link, description, usageStat });
                }
            });
            return results;
        });

        if (listItems.length === 0) {
            console.error('Museum scraper found 0 items. Creating error marker.');
            fs.writeFileSync(path.join(process.cwd(), 'src/data/museum.error'), 'Museum scraper found 0 items. Check selector: div.contents > a');
            await browser.close();
            return;
        } else {
            const errFile = path.join(process.cwd(), 'src/data/museum.error');
            if (fs.existsSync(errFile)) fs.unlinkSync(errFile);
        }

        console.log(`Found ${listItems.length} items. Starting detail scraping...`);

        // 3. Detail Scraping (Batched)
        const finalItems: MuseumItem[] = [];
        const chunkedItems = [];
        for (let i = 0; i < listItems.length; i += CONCURRENCY_LIMIT) {
            chunkedItems.push(listItems.slice(i, i + CONCURRENCY_LIMIT));
        }

        let processedCount = 0;

        for (const chunk of chunkedItems) {
            await Promise.all(chunk.map(async (item) => {
                const detailPage = await browser.newPage();
                // Block images/fonts/css to speed up
                await detailPage.setRequestInterception(true);
                detailPage.on('request', (req) => {
                    if (['image', 'stylesheet', 'font'].includes(req.resourceType())) {
                        req.abort();
                    } else {
                        req.continue();
                    }
                });

                let address = '';
                try {
                    await detailPage.goto(item.link, { waitUntil: 'domcontentloaded', timeout: 30000 });

                    // Selector: body > div.container > main > div:nth-child(1) > article > div.main-container > section > ul > li:nth-child(1) > p.value
                    // Try generic "li > p.label" contains "주소"? Or just the specific path provided.
                    address = await detailPage.evaluate(() => {
                        // User said: section > ul > li:nth-child(1) > p.value
                        // Let's try finding the element directly first
                        const addrEl = document.querySelector('section > ul > li:nth-child(1) > p.value');
                        if (addrEl) return addrEl.textContent?.trim() || '';

                        // Fallback: search by label
                        const labels = document.querySelectorAll('section > ul > li > p.label');
                        for (const label of labels) {
                            if (label.textContent?.includes('주소')) {
                                const value = label.parentElement?.querySelector('p.value');
                                return value?.textContent?.trim() || '';
                            }
                        }
                        return '';
                    });
                } catch (e) {
                    console.error(`Failed to scrape details for ${item.title}:`, e);
                } finally {
                    await detailPage.close();
                }

                const id = `museum_${item.title.replace(/\s+/g, '')}`;

                finalItems.push({
                    id,
                    ...item,
                    address,
                    genre: 'museum'
                });

                processedCount++;
            }));

            process.stdout.write(`\rProgress: ${processedCount}/${listItems.length}`);
            // Small delay between chunks to be nice
            await new Promise(r => setTimeout(r, 500));
        }

        console.log('\nScraping complete.');

        // 4. Persistence (Strict Retention)
        const now = new Date().toISOString();
        let existingData: MuseumItem[] = [];

        // Load ALL existing data
        if (fs.existsSync(DATA_PATH)) {
            existingData = JSON.parse(fs.readFileSync(DATA_PATH, 'utf-8'));
        }

        const dataMap = new Map<string, MuseumItem>();
        existingData.forEach(item => dataMap.set(item.id, item));

        // Update with collected items
        for (const item of finalItems) {
            const existing = dataMap.get(item.id);
            const merged = {
                ...existing,
                ...item,
                lastCollected: now
            };
            dataMap.set(item.id, merged);
        }

        const allItems = Array.from(dataMap.values());

        fs.writeFileSync(DATA_PATH, JSON.stringify(allItems, null, 2));
        console.log(`Saved ${allItems.length} items (merged). Updated: ${finalItems.length}.`);

    } catch (error) {
        console.error('Fatal Error:', error);
    } finally {
        await browser.close();
    }
}

scrapeMuseum();
