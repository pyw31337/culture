
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import fs from 'fs';
import path from 'path';

puppeteer.use(StealthPlugin());

const TARGET_URL = 'https://mom-mom.net/search?q=%EB%B0%95%EB%AC%BC%EA%B4%80/%EC%B2%B4%ED%97%98%EA%B4%80&hl=places';
const DATA_PATH = path.join(process.cwd(), 'src/data/museum.json');
const CONCURRENCY_LIMIT = 5;

function slugify(text: string): string {
    return text
        .replace(/[^a-zA-Z0-9가-힣]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '');
}

interface MuseumItem {
    id: string;
    title: string;
    image: string;
    description: string;
    usageStat: string;
    link: string;
    address?: string;
    genre: string;
    hours?: string;
    website?: string;
    parking?: string;
    parkingFee?: string;
    fees?: string;
    price?: string;
    priceDetail?: string;
    operatingHours?: string;
    closedDays?: string;
    contact?: string;
    reservationInfo?: string;
    feesAndPrograms?: string;
    targetAudience?: string;
    sourceUpdatedAt?: string;
    tips?: string;
    longDescription?: string;
    facilities?: string;
    venue?: string;
    lat?: number;
    lng?: number;
}

function normalizeDetailText(text: string): string {
    return text.replace(/\s+/g, ' ').trim();
}

const MUSEUM_DETAIL_EXTRACTOR = String.raw`
const results = {};

function compact(value) {
    return (value || '').replace(/\s+/g, ' ').trim();
}

function valueText(element) {
    if (!element) return '';
    const clone = element.cloneNode(true);
    clone.querySelectorAll('button, script, style, img').forEach(function (node) {
        node.remove();
    });
    return compact(clone.textContent);
}

document.querySelectorAll('section > ul > li').forEach(function (row) {
    const key = compact(row.querySelector('p.key, p.label') && row.querySelector('p.key, p.label').textContent);
    if (!key) return;

    const valueEl = row.querySelector('p.value, div.value');
    let value = valueText(valueEl);

    if (key.indexOf('영업시간') >= 0) {
        const rows = Array.from(row.querySelectorAll('tr'))
            .map(function (tr) {
                const dayNode = tr.querySelector('th, .day');
                const timeNode = tr.querySelector('td');
                const day = compact(dayNode && dayNode.textContent);
                const time = compact(timeNode && timeNode.textContent);
                return [day, time].filter(Boolean).join(' ');
            })
            .filter(Boolean);
        value = rows.length > 0 ? rows.join('\n') : value;
    }

    if (key.indexOf('주소') >= 0) results.address = value;
    if (key.indexOf('전화') >= 0) results.contact = value;
    if (key.indexOf('영업시간') >= 0) results.operatingHours = value;
    if (key.indexOf('시설') >= 0) results.facilities = value;
    if (key.indexOf('예약') >= 0) results.reservationInfo = value;
});

const webBtn = document.querySelector('div.reservation-buttons > a[href^="http"]');
if (webBtn) results.website = webBtn.href;

const fullText = compact(document.body.textContent);
const updatedMatch = fullText.match(/(\d{4}\.\d{2}\.\d{2})\s*업데이트/);
if (updatedMatch) results.sourceUpdatedAt = updatedMatch[1];

const feesSection = Array.from(document.querySelectorAll('section')).find(function (section) {
    const text = compact(section.textContent);
    const headingNode = section.querySelector('h2');
    const heading = compact(headingNode && headingNode.textContent);
    return heading.indexOf('요금') >= 0 || (text.indexOf('[요금]') >= 0 && text.indexOf('[이용안내]') >= 0);
});

if (feesSection) {
    const lines = Array.from(feesSection.querySelectorAll('li'))
        .map(function (li) { return compact(li.textContent); })
        .filter(Boolean)
        .map(function (line) { return /^\[[^\]]+\]$/.test(line) ? line : '- ' + line; });
    results.feesAndPrograms = lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
    results.fees = results.feesAndPrograms;

    const feeLines = [];
    let inFeeBlock = false;
    lines.forEach(function (line) {
        if (line === '[요금]') {
            inFeeBlock = true;
            return;
        }
        if (/^\[[^\]]+\]$/.test(line)) {
            inFeeBlock = false;
            return;
        }
        if (inFeeBlock) feeLines.push(line.replace(/^-\s*/, ''));
    });

    if (feeLines.length > 0) {
        results.priceDetail = feeLines.join('\n');
        const admissionLine = feeLines.find(function (line) { return /관람료|입장료|입장/.test(line); }) || feeLines[0];
        const priceMatch = admissionLine.match(/([0-9][0-9,]*\s*원)/);
        if (/무료/.test(admissionLine)) results.price = '무료';
        else if (priceMatch) results.price = priceMatch[1].replace(/\s+/g, '');
    }
}

const tipsSection = Array.from(document.querySelectorAll('section')).find(function (section) {
    return compact(section.textContent).indexOf('세상 유용한 꿀팁') >= 0;
});
if (tipsSection) {
    const tips = Array.from(tipsSection.querySelectorAll('li'))
        .map(function (li) { return compact(li.textContent); })
        .filter(Boolean);
    if (tips.length > 0) {
        results.tips = tips.map(function (tip) { return '- ' + tip; }).join('\n');
    }
}

const articleSection = Array.from(document.querySelectorAll('section')).find(function (section) {
    const text = compact(section.textContent);
    return text.indexOf(itemTitle) >= 0 && section.querySelector('h3') && text.length > 160;
});
if (articleSection) {
    const parts = Array.from(articleSection.querySelectorAll('h3, p'))
        .map(function (node) {
            const text = compact(node.textContent);
            if (!text) return '';
            return node.tagName === 'H3' ? '\n' + text : text;
        })
        .filter(Boolean);
    if (parts.length > 0) {
        results.longDescription = parts.join('\n').replace(/\n{3,}/g, '\n\n').trim();
    }
}

const closedDayMatches = (results.operatingHours || '').match(/[가-힣]+요일\s*정기휴무/g);
if (closedDayMatches) results.closedDays = closedDayMatches.join(', ');

const localBusiness = Array.from(document.querySelectorAll('script[type="application/ld+json"]'))
    .map(function (script) { return script.textContent || ''; })
    .find(function (text) { return text.indexOf('LocalBusiness') >= 0 && text.indexOf('GeoCoordinates') >= 0; });
if (localBusiness) {
    try {
        const parsed = JSON.parse(localBusiness);
        if (parsed && parsed.geo && parsed.geo.latitude && parsed.geo.longitude) {
            results.lat = Number(parsed.geo.latitude);
            results.lng = Number(parsed.geo.longitude);
        }
    } catch (error) {
        // Ignore malformed JSON-LD. The visible page fields above are enough.
    }
}

return results;
`;

const runBrowserDetailExtractor = new Function(
    'script',
    'itemTitle',
    'return new Function("itemTitle", script)(itemTitle);'
) as (script: string, itemTitle: string) => Partial<MuseumItem>;

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
                    if (['image', 'font'].includes(req.resourceType())) {
                        req.abort();
                    } else {
                        req.continue();
                    }
                });

                let detailData: Partial<MuseumItem> = {};
                try {
                    await detailPage.goto(item.link, { waitUntil: 'networkidle2', timeout: 60000 });

                    // Selector: body > div.container > main > div:nth-child(1) > article > div.main-container > section > ul > li:nth-child(1) > p.value
                    // Try generic "li > p.label" contains "주소"? Or just the specific path provided.
                    detailData = await detailPage.evaluate(runBrowserDetailExtractor, MUSEUM_DETAIL_EXTRACTOR, item.title);
                } catch (e) {
                    console.error(`Failed to scrape details for ${item.title}:`, e);
                } finally {
                    await detailPage.close().catch(() => undefined);
                }

                const id = `museum_${slugify(item.title)}`;
                const richDescription = [detailData.longDescription, detailData.tips]
                    .filter((value) => typeof value === 'string' && normalizeDetailText(value).length > 0)
                    .join('\n\n');

                finalItems.push({
                    id,
                    ...item,
                    ...detailData,
                    venue: item.title,
                    description: richDescription || item.description,
                    targetAudience: item.usageStat || detailData.targetAudience,
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
