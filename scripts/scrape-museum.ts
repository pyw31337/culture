
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import fs from 'fs';
import path from 'path';
import { atomicWriteJson } from './utils/scraper-utils';

puppeteer.use(StealthPlugin());

const TARGET_URL = 'https://mom-mom.net/search?q=%EB%B0%95%EB%AC%BC%EA%B4%80/%EC%B2%B4%ED%97%98%EA%B4%80&hl=places';
const DATA_PATH = path.join(process.cwd(), 'src/data/museum.json');
const CONCURRENCY_LIMIT = Number(process.env.MUSEUM_DETAIL_CONCURRENCY || 4);
const MAX_DETAIL_ITEMS = Number(process.env.MUSEUM_MAX_DETAIL_ITEMS || 220);
const DETAIL_STALE_DAYS = Number(process.env.MUSEUM_DETAIL_STALE_DAYS || 21);
const DETAIL_NAV_TIMEOUT_MS = Number(process.env.MUSEUM_DETAIL_TIMEOUT_MS || 25000);
const DETAIL_BUDGET_MS = Number(process.env.MUSEUM_DETAIL_BUDGET_MS || 35 * 60 * 1000);
const LIST_TARGET_COUNT = Number(process.env.MUSEUM_LIST_TARGET_COUNT || 880);
const LIST_MAX_SCROLLS = Number(process.env.MUSEUM_LIST_MAX_SCROLLS || 120);
const BROWSER_EVAL_BOOTSTRAP = 'window.__name = window.__name || function(fn){ return fn; };';

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
    lastCollected?: string;
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

type MuseumListItem = Pick<MuseumItem, 'title' | 'image' | 'link' | 'description' | 'usageStat'>;

function getMuseumId(item: Pick<MuseumItem, 'title'>) {
    return `museum_${slugify(item.title)}`;
}

function hasUsefulDetail(item?: MuseumItem) {
    return Boolean(item?.address || item?.operatingHours || item?.priceDetail || item?.feesAndPrograms || item?.longDescription);
}

function isFreshEnough(value?: string) {
    if (!value) return false;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return false;
    const ageDays = (Date.now() - parsed.getTime()) / (1000 * 60 * 60 * 24);
    return ageDays < DETAIL_STALE_DAYS;
}

function shouldRefreshDetail(item: MuseumListItem, existing?: MuseumItem) {
    if (!existing) return true;
    if (!hasUsefulDetail(existing)) return true;
    if (!isFreshEnough(existing.lastCollected || existing.sourceUpdatedAt)) return true;
    return false;
}

function mergeMuseumItem(item: MuseumListItem, existing: MuseumItem | undefined, detailData: Partial<MuseumItem>, collectedAt: string): MuseumItem {
    const richDescription = [detailData.longDescription, detailData.tips]
        .filter((value) => typeof value === 'string' && normalizeDetailText(value).length > 0)
        .join('\n\n');

    return {
        ...(existing || {}),
        ...item,
        ...detailData,
        id: getMuseumId(item),
        venue: item.title,
        description: richDescription || detailData.description || item.description || existing?.description || '',
        targetAudience: item.usageStat || detailData.targetAudience || existing?.targetAudience,
        genre: 'museum',
        lastCollected: collectedAt,
    };
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
        protocolTimeout: 120000,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
        const page = await browser.newPage();
        await page.evaluateOnNewDocument(BROWSER_EVAL_BOOTSTRAP);
        await page.setViewport({ width: 1280, height: 800 });
        await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.evaluate(BROWSER_EVAL_BOOTSTRAP).catch(() => undefined);
        await page.waitForSelector('div.contents > a', { timeout: 15000 }).catch(() => undefined);

        // 1. Infinite Scroll to load all items
        console.log('Scrolling to load all items (~800)...');
        // 1. Robust Infinite Scroll
        console.log('Scrolling to load all items...');
        let previousHeight = 0;
        let noChangeAttempts = 0;
        const MAX_NO_CHANGE = 10; // Stop after 10 attempts (~20 sec) of no new content

        let scrollAttempts = 0;
        while (noChangeAttempts < MAX_NO_CHANGE && scrollAttempts < LIST_MAX_SCROLLS) {
            let currentHeight = previousHeight;
            let count = 0;
            try {
                const snapshot = await page.evaluate(() => {
                    const height = document.body.scrollHeight;
                    window.scrollTo(0, height);
                    return {
                        height,
                        count: document.querySelectorAll('div.contents > a').length,
                    };
                });
                currentHeight = snapshot.height;
                count = snapshot.count;
            } catch (error) {
                console.warn(`\nList scroll evaluate failed after ${scrollAttempts} attempts. Continuing with loaded items.`);
                break;
            }

            if (currentHeight > previousHeight) {
                previousHeight = currentHeight;
                noChangeAttempts = 0;
            } else {
                noChangeAttempts++;
            }

            // Wait for load (variable delay)
            await new Promise(r => setTimeout(r, 2000));

            // Log progress
            process.stdout.write(`\rLoaded ${count} items...`);
            scrollAttempts++;

            if (count >= LIST_TARGET_COUNT) {
                console.log(`\nReached museum list target (${count}/${LIST_TARGET_COUNT}).`);
                break;
            }
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
            throw new Error('Museum scraper found 0 items.');
        } else {
            const errFile = path.join(process.cwd(), 'src/data/museum.error');
            if (fs.existsSync(errFile)) fs.unlinkSync(errFile);
        }

        console.log(`Found ${listItems.length} items. Preparing cache-aware detail scraping...`);

        const now = new Date().toISOString();
        let existingData: MuseumItem[] = [];
        if (fs.existsSync(DATA_PATH)) {
            try {
                existingData = JSON.parse(fs.readFileSync(DATA_PATH, 'utf-8'));
            } catch {
                existingData = [];
            }
        }

        const finalById = new Map<string, MuseumItem>();
        existingData.forEach(item => finalById.set(item.id, item));

        const listWithIds = (listItems as MuseumListItem[]).map(item => ({
            id: getMuseumId(item),
            item,
            existing: finalById.get(getMuseumId(item)),
        }));

        for (const { id, item, existing } of listWithIds) {
            finalById.set(id, mergeMuseumItem(item, existing, {}, now));
        }

        const refreshCandidates = listWithIds
            .filter(({ item, existing }) => shouldRefreshDetail(item, existing))
            .map(({ item }) => item);
        const detailTargets = refreshCandidates.slice(0, MAX_DETAIL_ITEMS);
        const deferredCount = refreshCandidates.length - detailTargets.length;

        console.log(`Detail refresh candidates: ${refreshCandidates.length}. This run: ${detailTargets.length}. Deferred/retained: ${Math.max(0, deferredCount)}.`);

        // 3. Detail Scraping (Batched)
        const chunkedItems = [];
        for (let i = 0; i < detailTargets.length; i += CONCURRENCY_LIMIT) {
            chunkedItems.push(detailTargets.slice(i, i + CONCURRENCY_LIMIT));
        }

        let processedCount = 0;
        const detailStartedAt = Date.now();

        for (const chunk of chunkedItems) {
            if (Date.now() - detailStartedAt > DETAIL_BUDGET_MS) {
                console.log(`\nDetail budget reached after ${processedCount}/${detailTargets.length}. Remaining items retained from cache/basic list.`);
                break;
            }

            await Promise.all(chunk.map(async (item) => {
                const detailPage = await browser.newPage();
                await detailPage.evaluateOnNewDocument(BROWSER_EVAL_BOOTSTRAP);
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
                    await detailPage.goto(item.link, { waitUntil: 'domcontentloaded', timeout: DETAIL_NAV_TIMEOUT_MS });
                    await detailPage.evaluate(BROWSER_EVAL_BOOTSTRAP).catch(() => undefined);

                    // Selector: body > div.container > main > div:nth-child(1) > article > div.main-container > section > ul > li:nth-child(1) > p.value
                    // Try generic "li > p.label" contains "주소"? Or just the specific path provided.
                    detailData = await detailPage.evaluate(runBrowserDetailExtractor, MUSEUM_DETAIL_EXTRACTOR, item.title);
                } catch (e) {
                    console.error(`Failed to scrape details for ${item.title}:`, e);
                } finally {
                    await detailPage.close().catch(() => undefined);
                }

                const id = getMuseumId(item);
                finalById.set(id, mergeMuseumItem(item, finalById.get(id), detailData, now));

                processedCount++;
            }));

            process.stdout.write(`\rProgress: ${processedCount}/${detailTargets.length}`);
            // Small delay between chunks to be nice
            await new Promise(r => setTimeout(r, 500));
        }

        console.log('\nScraping complete.');

        // 4. Persistence (Strict Retention)
        const allItems = Array.from(finalById.values());

        atomicWriteJson(DATA_PATH, allItems);
        console.log(`Saved ${allItems.length} items (merged). Detail updated: ${processedCount}. Retained/deferred: ${Math.max(0, listItems.length - processedCount)}.`);

    } catch (error) {
        console.error('Fatal Error:', error);
        process.exitCode = 1;
    } finally {
        await browser.close();
    }
}

scrapeMuseum();
