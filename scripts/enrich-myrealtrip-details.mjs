import fs from 'fs';
import path from 'path';

const DATA_PATH = path.resolve(process.cwd(), 'src/data/myrealtrip-kids.json');
const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';
const CONCURRENCY = Number(process.env.MYREALTRIP_ENRICH_CONCURRENCY || 4);

function compact(value = '') {
    return String(value)
        .replace(/\r/g, '\n')
        .replace(/\u00a0/g, ' ')
        .replace(/[ \t]+/g, ' ')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

function unique(values) {
    const seen = new Set();
    return values.filter((value) => {
        const key = compact(value);
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

function stripHtml(html = '') {
    return compact(String(html)
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/(p|div|li|figure|h[1-6]|section|article)>/gi, '\n')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&#39;/g, "'")
        .replace(/&quot;/g, '"'));
}

function extractImageUrlsFromHtml(html = '') {
    const urls = [];
    const normalized = String(html).replace(/\\u002F/g, '/').replace(/\\\//g, '/');
    const imgRe = /<img[^>]+(?:src|data-src)=["']([^"']+)["']/gi;
    let match;
    while ((match = imgRe.exec(normalized))) {
        const url = normalizeUrl(match[1]);
        if (url) urls.push(url);
    }
    return unique(urls);
}

function normalizeUrl(value = '') {
    const url = compact(value)
        .replace(/&amp;/g, '&')
        .replace(/[),.;]+$/u, '');
    if (!url) return '';
    if (url.startsWith('//')) return `https:${url}`;
    if (url.startsWith('/')) return `https://experiences.myrealtrip.com${url}`;
    return url;
}

function getNextData(html) {
    const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
    if (!match) return null;
    try {
        return JSON.parse(match[1]);
    } catch {
        return null;
    }
}

function findQueryData(nextData, predicate) {
    const queries = nextData?.props?.pageProps?.dehydratedState?.queries || [];
    return queries.find((query) => {
        const rawKey = query.queryKey || [];
        const keyParts = Array.isArray(rawKey) ? rawKey.map(String) : [String(rawKey)];
        return predicate(keyParts);
    })?.state?.data?.data || null;
}

function section(title, body, maxLength = 1800) {
    const text = compact(body);
    if (!text) return '';
    return `[${title}]\n${text.slice(0, maxLength)}`;
}

function parseDetail(nextData) {
    const queries = nextData?.props?.pageProps?.dehydratedState?.queries || [];
    const structuralHeader = queries
        .map((query) => query?.state?.data?.data)
        .find((data) => Array.isArray(data?.images));
    const structuralItem = queries
        .map((query) => query?.state?.data?.data)
        .find((data) => Array.isArray(data?.partitions));

    const header = findQueryData(nextData, (key) => key.includes('header')) || structuralHeader || {};
    const itemData = findQueryData(nextData, (key) => key.includes('item')) || structuralItem || {};
    const partitions = itemData.partitions || [];

    const headerImages = unique((header.images || [])
        .filter((image) => image?.type !== 'REVIEW')
        .map((image) => normalizeUrl(image?.url))
        .filter(Boolean));

    const introductionHtml = partitions
        .map((partition) => partition?.partitionData?.introduction || partition?.partitionData?.html || '')
        .filter(Boolean)
        .join('\n');

    const introImages = extractImageUrlsFromHtml(introductionHtml);
    const officialImages = unique([...headerImages, ...introImages]).slice(0, 12);

    const notifications = partitions
        .flatMap((partition) => partition?.partitionData?.notifications || [])
        .map((notice) => compact([notice.title, notice.description].filter(Boolean).join('\n')))
        .filter(Boolean);

    const itemSections = partitions
        .flatMap((partition) => partition?.partitionData?.items || [])
        .map((item) => {
            const title = compact(item.title || item.key || '');
            const descriptions = (item.descriptions || [])
                .map((desc) => compact(desc.description || desc.text || ''))
                .filter(Boolean)
                .join('\n');
            return title || descriptions ? `${title ? `[${title}]\n` : ''}${descriptions}` : '';
        })
        .filter(Boolean);

    const faqs = partitions
        .flatMap((partition) => partition?.partitionData?.faqs || [])
        .slice(0, 5)
        .map((faq) => compact(`Q. ${faq.title || ''}\nA. ${faq.description || ''}`))
        .filter(Boolean);

    const partnerDescription = compact(partitions[0]?.partitionData?.partner?.description || '');
    const introductionText = stripHtml(introductionHtml);

    return {
        image: officialImages[0] || '',
        synopsisImages: officialImages.slice(1),
        description: compact([
            section('상품 소개', introductionText, 2200),
            section('이용 안내', itemSections.slice(0, 3).join('\n\n'), 2200),
            partnerDescription ? section('운영사 소개', partnerDescription, 900) : '',
        ].filter(Boolean).join('\n\n')),
        bookingNotice: compact([
            section('공지', notifications.join('\n\n'), 1800),
            section('예약/취소 안내', itemSections.filter((text) => /예약|취소|환불|필수|주의/u.test(text)).slice(0, 2).join('\n\n'), 2200),
        ].filter(Boolean).join('\n\n')),
        feesAndPrograms: compact(itemSections.filter((text) => /포함|불포함|요금|프로그램|준비/u.test(text)).slice(0, 4).join('\n\n')),
        faq: faqs.join('\n\n'),
        dataCollectedAt: new Date().toISOString(),
    };
}

async function fetchDetail(link) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    try {
        const response = await fetch(link, {
            signal: controller.signal,
            headers: {
                'user-agent': USER_AGENT,
            },
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const html = await response.text();
        const nextData = getNextData(html);
        if (!nextData) throw new Error('missing __NEXT_DATA__');
        return parseDetail(nextData);
    } finally {
        clearTimeout(timeout);
    }
}

async function worker(items, indexRef, stats) {
    while (indexRef.value < items.length) {
        const index = indexRef.value++;
        const item = items[index];
        if (!item?.link) continue;
        try {
            const detail = await fetchDetail(item.link);
            const existingImages = Array.isArray(item.synopsisImages) ? item.synopsisImages : [];
            const mergedImages = unique([...(detail.synopsisImages || []), ...existingImages]).slice(0, 12);
            Object.assign(item, {
                image: detail.image || item.image,
                backupPoster: item.backupPoster || item.image,
                synopsisImages: mergedImages,
                description: detail.description || item.description,
                bookingNotice: detail.bookingNotice || item.bookingNotice,
                feesAndPrograms: detail.feesAndPrograms || item.feesAndPrograms,
                faq: detail.faq || item.faq,
                dataCollectedAt: detail.dataCollectedAt,
            });
            stats.updated += 1;
        } catch (error) {
            stats.failed += 1;
            if (stats.failed <= 8) {
                console.warn(`[myrealtrip] failed ${item.title}: ${error?.message || error}`);
            }
        }
        if ((index + 1) % 20 === 0) {
            console.log(`[myrealtrip] ${index + 1}/${items.length} processed`);
        }
    }
}

async function main() {
    if (!fs.existsSync(DATA_PATH)) {
        throw new Error(`Cannot find ${DATA_PATH}`);
    }
    const items = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
    if (!Array.isArray(items)) throw new Error('myrealtrip-kids.json must be an array');

    const stats = { updated: 0, failed: 0 };
    const indexRef = { value: 0 };
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, items.length) }, () => worker(items, indexRef, stats)));

    fs.writeFileSync(DATA_PATH, JSON.stringify(items, null, 2) + '\n');
    console.log(`[myrealtrip] updated=${stats.updated} failed=${stats.failed} total=${items.length}`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
