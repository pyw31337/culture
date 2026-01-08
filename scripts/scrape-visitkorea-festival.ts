/**
 * VisitKorea Festival Scraper
 * Scrapes nationwide festival data from korean.visitkorea.or.kr
 */

import { chromium, Browser, Page } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import cliProgress from 'cli-progress';

const OUTPUT_FILE = path.join(process.cwd(), 'src/data/festivals.json');
const BASE_URL = 'https://korean.visitkorea.or.kr';
const LIST_URL = `${BASE_URL}/list/travelinfo.do?service=show`;
const DETAIL_URL_TEMPLATE = `${BASE_URL}/kfes/detail/fstvlDetail.do?cmsCntntsId=`;

// Nationwide region mapping from address prefix
const REGION_MAP: Record<string, string> = {
    '서울': 'seoul',
    '경기': 'gyeonggi',
    '인천': 'incheon',
    '부산': 'busan',
    '대구': 'daegu',
    '광주': 'gwangju',
    '대전': 'daejeon',
    '울산': 'ulsan',
    '세종': 'sejong',
    '강원': 'gangwon',
    '충북': 'chungbuk',
    '충남': 'chungnam',
    '전북': 'jeonbuk',
    '전남': 'jeonnam',
    '경북': 'gyeongbuk',
    '경남': 'gyeongnam',
    '제주': 'jeju',
};

interface FestivalItem {
    id: string;
    title: string;
    image: string;
    date: string;
    venue: string;
    region: string;
    link: string;
    genre: string;
}

function parseRegion(address: string): string {
    if (!address) return 'etc';
    for (const [prefix, regionId] of Object.entries(REGION_MAP)) {
        if (address.startsWith(prefix)) return regionId;
    }
    return 'etc';
}

async function scrapeListPage(page: Page, pageNum: number): Promise<{ id: string; title: string; thumbnailImage: string }[]> {
    // Navigate to page
    if (pageNum > 1) {
        await page.evaluate((num) => {
            // @ts-ignore
            window.goPage(num);
        }, pageNum);
        await page.waitForTimeout(1500); // Wait for AJAX
    }

    // Extract items from list
    const items = await page.evaluate(() => {
        const results: { id: string; title: string; thumbnailImage: string }[] = [];
        const listItems = document.querySelectorAll('ul.list_thumType > li');

        listItems.forEach((li) => {
            const titleLink = li.querySelector('.area_txt .tit a') as HTMLAnchorElement;
            const img = li.querySelector('.area_img img') as HTMLImageElement;

            if (titleLink) {
                // Extract ID from onclick: goDetail('uuid', 'cmsCntntsId')
                const onclick = titleLink.getAttribute('onclick') || '';
                const match = onclick.match(/goDetail\([^,]+,\s*'?(\d+)'?\)/);
                const id = match ? match[1] : '';

                results.push({
                    id,
                    title: titleLink.innerText.trim(),
                    thumbnailImage: img?.src || '',
                });
            }
        });

        return results;
    });

    return items;
}

async function scrapeDetailPage(page: Page, id: string): Promise<Partial<FestivalItem>> {
    const url = DETAIL_URL_TEMPLATE + id;

    try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(1000);

        const details = await page.evaluate(() => {
            // Poster image (priority)
            const posterImg = document.querySelector('#mainTab > div > div > section.poster_detail > div > div.poster_detail_wrap > div > div.detail_img_box > a > img') as HTMLImageElement;
            let image = posterImg?.src || '';

            // Fallback: background image
            if (!image) {
                const bgDiv = document.querySelector('#mainTab > div > section > div > div') as HTMLElement;
                if (bgDiv) {
                    const style = window.getComputedStyle(bgDiv);
                    const bgImage = style.backgroundImage;
                    const urlMatch = bgImage.match(/url\(["']?([^"')]+)["']?\)/);
                    image = urlMatch ? urlMatch[1] : '';
                }
            }

            // Festival period
            const periodEl = document.querySelector('#mainTab > div > div > section.poster_detail > div > div.poster_detail_wrap > div > div.img_info_box > ul > li:nth-child(1) > p');
            const date = periodEl?.textContent?.trim() || '';

            // Venue address
            const venueEl = document.querySelector('#mainTab > div > div > section.poster_detail > div > div.poster_detail_wrap > div > div.img_info_box > ul > li:nth-child(2) > p');
            const venue = venueEl?.textContent?.trim() || '';

            // Title (from page)
            const titleEl = document.querySelector('h2.tit') || document.querySelector('.poster_detail_wrap h2');
            const title = titleEl?.textContent?.trim() || '';

            return { image, date, venue, title };
        });

        return {
            ...details,
            link: url,
            region: parseRegion(details.venue),
            genre: 'festival',
        };
    } catch (error) {
        console.error(`Failed to scrape detail for ID ${id}:`, error);
        return {};
    }
}

async function main() {
    console.log('Starting VisitKorea Festival Scraper...');

    // Load existing data
    let existingItems: FestivalItem[] = [];
    const existingIds = new Set<string>();

    if (fs.existsSync(OUTPUT_FILE)) {
        try {
            existingItems = JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf-8'));
            existingItems.forEach(item => existingIds.add(item.id));
            console.log(`Loaded ${existingItems.length} existing items.`);
        } catch (e) {
            console.error('Failed to load existing data:', e);
        }
    }

    const browser: Browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        locale: 'ko-KR',
    });
    const page: Page = await context.newPage();

    try {
        // 1. Go to list page
        console.log('Loading festival list...');
        await page.goto(LIST_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await page.waitForTimeout(2000);

        // 2. Get total pages
        const totalPages = await page.evaluate(() => {
            const lastPageBtn = document.querySelector('.page_box .btn_pageLast') as HTMLElement;
            if (lastPageBtn) {
                const onclick = lastPageBtn.getAttribute('onclick') || '';
                const match = onclick.match(/goPage\((\d+)\)/);
                return match ? parseInt(match[1], 10) : 1;
            }
            // Fallback: count page numbers
            const pageLinks = document.querySelectorAll('.page_box a');
            let max = 1;
            pageLinks.forEach(a => {
                const num = parseInt(a.textContent || '0', 10);
                if (!isNaN(num) && num > max) max = num;
            });
            return max;
        });

        console.log(`Total pages detected: ${totalPages}`);

        // 3. Scrape all list pages to get IDs
        const allListItems: { id: string; title: string; thumbnailImage: string }[] = [];

        const listProgress = new cliProgress.SingleBar({
            format: 'Scraping Lists |{bar}| {percentage}% | Page {value}/{total}',
        }, cliProgress.Presets.shades_classic);
        listProgress.start(totalPages, 0);

        for (let p = 1; p <= totalPages; p++) {
            const items = await scrapeListPage(page, p);
            allListItems.push(...items);
            listProgress.update(p);
        }
        listProgress.stop();

        console.log(`Found ${allListItems.length} festivals in list.`);

        // 4. Filter out already scraped items
        const newItems = allListItems.filter(item => item.id && !existingIds.has(item.id));
        console.log(`New items to scrape: ${newItems.length}`);

        if (newItems.length === 0) {
            console.log('No new festivals to scrape. Done.');
            await browser.close();
            return;
        }

        // 5. Scrape detail pages for new items
        const detailProgress = new cliProgress.SingleBar({
            format: 'Scraping Details |{bar}| {percentage}% | {value}/{total}',
        }, cliProgress.Presets.shades_classic);
        detailProgress.start(newItems.length, 0);

        const results: FestivalItem[] = [...existingItems];

        for (let i = 0; i < newItems.length; i++) {
            const listItem = newItems[i];
            const details = await scrapeDetailPage(page, listItem.id);

            if (details.link) {
                results.push({
                    id: listItem.id,
                    title: details.title || listItem.title,
                    image: details.image || listItem.thumbnailImage,
                    date: details.date || '',
                    venue: details.venue || '',
                    region: details.region || 'etc',
                    link: details.link,
                    genre: 'festival',
                });
            }

            detailProgress.update(i + 1);

            // Rate limiting
            if (i % 10 === 0 && i > 0) {
                await page.waitForTimeout(500);
            }
        }

        detailProgress.stop();

        // 6. Save results
        fs.writeFileSync(OUTPUT_FILE, JSON.stringify(results, null, 2));
        console.log(`Saved ${results.length} festivals to ${OUTPUT_FILE}`);

    } catch (error) {
        console.error('Scraper error:', error);
    } finally {
        await browser.close();
    }
}

main();
