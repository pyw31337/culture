import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

type InterparkItem = {
    id: string;
    title: string;
    date?: string;
    image?: string;
    link?: string;
    synopsis?: string;
    description?: string;
    synopsisImages?: string[];
    stillImages?: string[];
    price?: string;
    priceDetail?: string;
    originalPrice?: string;
    discount?: string;
    runningTime?: string;
    performanceTime?: string;
    ageRating?: string;
    bookingNotice?: string;
    lastEnriched?: string;
    sourceUpdatedAt?: string;
    [key: string]: unknown;
};

const DATA_PATH = path.resolve(process.cwd(), 'src/data/interpark.json');
const LIMIT = Number(process.env.INTERPARK_DETAIL_IMAGE_LIMIT || 180);
const CONCURRENCY = Number(process.env.INTERPARK_DETAIL_IMAGE_CONCURRENCY || 3);
const CHUNK_DELAY_MS = Number(process.env.INTERPARK_DETAIL_IMAGE_DELAY_MS || 350);
const BROWSER_EVAL_BOOTSTRAP = 'window.__name = window.__name || function(fn){ return fn; };';

function compactText(value?: string) {
    return (value || '').replace(/\s+/g, ' ').trim();
}

function goodsIdFromLink(link?: string) {
    return compactText(link).match(/(?:goods\/|GoodsCode=)([A-Za-z0-9]+)/)?.[1] || '';
}

function isUsefulInterparkImage(url?: string) {
    return Boolean(url)
        && /^https?:\/\//i.test(url || '')
        && /(ticketimage\.interpark\.com|ticketimage\.interparkcdn\.co\.kr|tickets\.interpark\.com)/i.test(url || '')
        && !/blank|spacer|loading|logo|icon|btn_|button|banner|sns|facebook|twitter|kakao|naver|\.svg(?:\?|$)/i.test(url || '');
}

function uniqueImages(values: string[]) {
    const seen = new Set<string>();
    const result: string[] = [];
    values.forEach((value) => {
        const normalized = value
            .replace(/^http:\/\//i, 'https://')
            .replace(/&amp;/g, '&')
            .trim();
        if (!isUsefulInterparkImage(normalized)) return;
        const key = normalized.replace(/[?#].*$/, '');
        if (seen.has(key)) return;
        seen.add(key);
        result.push(normalized);
    });
    return result;
}

function hasUsefulDetail(item: InterparkItem) {
    const text = compactText(item.synopsis || item.description);
    const images = Array.isArray(item.synopsisImages) ? item.synopsisImages.filter(isUsefulInterparkImage) : [];
    return images.length > 0 && text.length >= 80;
}

async function extractDetail(page: any, item: InterparkItem) {
    const goodsId = goodsIdFromLink(item.link);
    if (!goodsId) return {};

    await page.goto(`https://tickets.interpark.com/goods/${goodsId}`, {
        waitUntil: 'domcontentloaded',
        timeout: 25000,
    });
    await page.evaluate(BROWSER_EVAL_BOOTSTRAP).catch(() => undefined);
    await page.waitForSelector('.prdContents, .infoList, img[src]', { timeout: 8000 }).catch(() => undefined);
    await new Promise((resolve) => setTimeout(resolve, 900));

    return page.evaluate(() => {
        const compact = (value?: string | null) => (value || '').replace(/\s+/g, ' ').trim();
        const normalizeImage = (value?: string | null) => {
            const raw = compact(value)
                .replace(/^url\(["']?/i, '')
                .replace(/["']?\)$/i, '')
                .replace(/&amp;/g, '&');
            if (!raw) return '';
            try {
                return new URL(raw, location.origin).href;
            } catch {
                return '';
            }
        };
        const cleanLines = (value?: string | null) => compact(value)
            .split(/(?<=다\.|요\.|원\.)\s+/)
            .map((line) => compact(line))
            .filter((line) => line.length >= 10 && line.length <= 260)
            .filter((line) => !/URL 복사|공유하기|예매하기|좌석우위|상품관련정보/i.test(line));

        const detailRoots = Array.from(document.querySelectorAll('.prdContents.detail .content, .contentDetail, .contentDetailText, .prdGuide'));
        const synopsisLines = Array.from(new Set(detailRoots.flatMap((root) => cleanLines(root.textContent))));
        const synopsis = synopsisLines.slice(0, 18).join('\n');

        const images = Array.from(new Set([
            ...Array.from(document.querySelectorAll('img')).flatMap((img) => [
                (img as HTMLImageElement).currentSrc,
                img.getAttribute('src'),
                img.getAttribute('data-src'),
                img.getAttribute('data-original'),
                img.getAttribute('lazy-src'),
            ].map(normalizeImage)),
            ...Array.from(document.querySelectorAll<HTMLElement>('*')).map((el) => {
                const background = window.getComputedStyle(el).backgroundImage;
                const match = background.match(/url\(["']?(.+?)["']?\)/i);
                return normalizeImage(match?.[1]);
            }),
        ])).filter(Boolean);

        const readInfo = (labels: string[]) => {
            const rows = Array.from(document.querySelectorAll('.infoItem, li.infoItem, dl > div, dl > .item'));
            for (const row of rows) {
                const label = compact(row.querySelector('.infoLabel, dt')?.textContent);
                if (!labels.some((candidate) => label.includes(candidate))) continue;
                const value = compact(row.querySelector('.infoText, .infoDesc, dd')?.textContent || row.textContent);
                if (value && value !== label) return value.replace(label, '').trim();
            }
            return '';
        };

        const priceLines = Array.from(document.querySelectorAll('.infoPriceItem, .priceItem, .prdPriceDetail li, .prdPriceDetail div'))
            .map((node) => compact(node.textContent))
            .filter((line) => /[0-9,]+\s*원/.test(line) && line.length <= 160);

        const price = priceLines.find((line) => !line.includes('전체가격보기'))?.match(/([0-9,]+\s*원)/)?.[1]?.replace(/\s+/g, '') || '';

        return {
            synopsis,
            images,
            price,
            priceDetail: Array.from(new Set(priceLines)).slice(0, 10).join('\n'),
            runningTime: readInfo(['공연시간', '관람시간']),
            ageRating: readInfo(['관람연령', '이용등급']),
            performanceTime: readInfo(['공연기간', '공연일시']),
        };
    });
}

function parseDateValue(dateText?: string) {
    const match = String(dateText || '').match(/(20\d{2})[.-](\d{1,2})[.-](\d{1,2})/);
    if (!match) return Number.POSITIVE_INFINITY;
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])).getTime();
}

async function main() {
    const items = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8')) as InterparkItem[];
    const targets = items
        .filter((item) => goodsIdFromLink(item.link))
        .filter((item) => {
            if (item.lastEnriched) {
                const ageDays = (Date.now() - new Date(item.lastEnriched).getTime()) / (24 * 3600 * 1000);
                if (ageDays < 2) return false; // Throttling: skip recently enriched
            }
            return !hasUsefulDetail(item);
        })
        .sort((a, b) => {
            const dateA = parseDateValue(a.date);
            const dateB = parseDateValue(b.date);
            if (dateA !== dateB) return dateA - dateB; // Upcoming first
            
            if (!a.lastEnriched && b.lastEnriched) return -1;
            if (a.lastEnriched && !b.lastEnriched) return 1;
            return 0;
        })
        .slice(0, LIMIT);

    console.log(`Interpark detail enrich targets: ${targets.length}/${items.length}`);
    if (targets.length === 0) return;

    const byId = new Map(items.map((item) => [item.id, item]));
    const browser = await puppeteer.launch({
        headless: true,
        protocolTimeout: 60000,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
    });

    try {
        let processed = 0;
        for (let index = 0; index < targets.length; index += CONCURRENCY) {
            const chunk = targets.slice(index, index + CONCURRENCY);
            const settled = await Promise.all(chunk.map(async (item) => {
                const page = await browser.newPage();
                try {
                    await page.evaluateOnNewDocument(BROWSER_EVAL_BOOTSTRAP);
                    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
                    await page.setViewport({ width: 1280, height: 900 });
                    const detail = await extractDetail(page, item) as {
                        synopsis?: string;
                        images?: string[];
                        price?: string;
                        priceDetail?: string;
                        runningTime?: string;
                        ageRating?: string;
                        performanceTime?: string;
                    };
                    const existingImages = Array.isArray(item.synopsisImages) ? item.synopsisImages : [];
                    const images = uniqueImages([...(detail.images || []), ...existingImages]).slice(0, 10);
                    const synopsis = compactText(detail.synopsis).length >= 80 ? detail.synopsis : item.synopsis;
                    byId.set(item.id, {
                        ...item,
                        synopsis: synopsis || item.synopsis,
                        description: synopsis || item.description,
                        synopsisImages: images,
                        stillImages: images.slice(1, 5),
                        price: item.price || detail.price || '',
                        priceDetail: item.priceDetail || detail.priceDetail || '',
                        runningTime: item.runningTime || detail.runningTime || '',
                        ageRating: item.ageRating || detail.ageRating || '',
                        performanceTime: item.performanceTime || detail.performanceTime || '',
                        lastEnriched: new Date().toISOString(),
                    });
                } catch (error) {
                    console.warn(`[interpark-detail] failed ${item.id}: ${error instanceof Error ? error.message : error}`);
                } finally {
                    await page.close().catch(() => undefined);
                }
            }));

            processed += settled.length;
            process.stdout.write(`\rProcessed ${processed}/${targets.length}`);
            fs.writeFileSync(DATA_PATH, JSON.stringify(items.map((item) => byId.get(item.id) || item), null, 2));
            await new Promise((resolve) => setTimeout(resolve, CHUNK_DELAY_MS));
        }
        process.stdout.write('\n');
    } finally {
        await browser.close();
    }

    fs.writeFileSync(DATA_PATH, JSON.stringify(items.map((item) => byId.get(item.id) || item), null, 2));
    console.log(`Saved enriched Interpark data to ${DATA_PATH}`);
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
