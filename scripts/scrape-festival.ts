/**
 * VisitKorea Festival Scraper (Nationwide) - Fixed Version
 * Scrapes festival data from korean.visitkorea.or.kr for all Korean provinces.
 */

import puppeteer, { Browser, Page } from 'puppeteer';
import * as fs from 'fs';
import * as path from 'path';

const OUTPUT_FILE = path.join(process.cwd(), 'src/data/festivals.json');
const BASE_URL = 'https://korean.visitkorea.or.kr';
const LIST_URL = `${BASE_URL}/list/travelinfo.do?service=show`;
// Detail URL template - will be constructed dynamically
const DETAIL_BASE_URL = `${BASE_URL}/detail/fes_detail.do`;

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

async function scrapeListPage(page: Page, pageNum: number): Promise<{ id: string; title: string; thumbnailImage: string; urlParams?: { cat1: string, cat2: string, areacode: string } }[]> {
    // Navigate to page via clicking the page link
    if (pageNum > 1) {
        // Click the page number or use goPage
        const clicked = await page.evaluate((num) => {
            // Try to find and click the page link
            const pageLinks = document.querySelectorAll('.page_box a');
            for (const link of pageLinks) {
                if (link.textContent?.trim() === String(num)) {
                    (link as HTMLElement).click();
                    return true;
                }
            }
            // Fallback: call goPage directly  
            // @ts-ignore
            if (typeof window.goPage === 'function') {
                // @ts-ignore
                window.goPage(num);
                return true;
            }
            return false;
        }, pageNum);

        if (!clicked) {
            console.log(`  Warning: Could not navigate to page ${pageNum}`);
        }

        // Wait for AJAX with content change detection
        await page.waitForFunction(() => {
            // Check if loading indicator is hidden or items have changed
            return document.querySelector('ul.list_thumType > li') !== null;
        }, { timeout: 10000 }).catch(() => { });

        await new Promise(r => setTimeout(r, 2000)); // Additional wait for stability
    }

    // Extract items from list
    const items = await page.evaluate(() => {
        const results: { id: string; title: string; thumbnailImage: string; urlParams?: { cat1: string, cat2: string, areacode: string } }[] = [];
        const listItems = document.querySelectorAll('ul.list_thumType > li');

        listItems.forEach((li) => {
            const titleLink = li.querySelector('.area_txt .tit a') as HTMLAnchorElement;
            const img = li.querySelector('.area_img img') as HTMLImageElement;

            if (titleLink) {
                // Extract params from onclick: goDetail('uuid','A02','A0207','32');
                const onclick = titleLink.getAttribute('onclick') || '';
                // Match parameters inside goDetail(...)
                const match = onclick.match(/goDetail\(([^)]+)\)/);

                if (match) {
                    const args = match[1].split(',').map(s => s.trim().replace(/['"]/g, ''));
                    if (args.length >= 4) {
                        const [id, cat1, cat2, areacode] = args;
                        results.push({
                            id,
                            title: titleLink.innerText.trim(),
                            thumbnailImage: img?.src || '',
                            urlParams: { cat1, cat2, areacode }
                        });
                    } else if (args.length >= 1) {
                        // Fallback if only ID is present (unlikely but possible)
                        results.push({
                            id: args[0],
                            title: titleLink.innerText.trim(),
                            thumbnailImage: img?.src || '',
                        });
                    }
                }
            }
        });

        return results;
    });

    return items;
}

async function scrapeDetailPage(page: Page, id: string, listTitle: string, listImage: string, urlParams?: { cat1: string, cat2: string, areacode: string }): Promise<FestivalItem | null> {
    // Construct URL with all params if available, otherwise fallback to simple ID (which might fail)
    let url = '';
    if (urlParams) {
        url = `${DETAIL_BASE_URL}?cotid=${id}&big_category=${urlParams.cat1}&mid_category=${urlParams.cat2}&big_area=${urlParams.areacode}`;
    } else {
        url = `${DETAIL_BASE_URL}?cotid=${id}`;
    }

    try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await new Promise(r => setTimeout(r, 1500));

        const details = await page.evaluate(() => {
            // Poster image - try multiple selectors based on page structure
            let image = '';

            // Try detail_img_box img first
            const posterImg = document.querySelector('.detail_img_box img') as HTMLImageElement;
            if (posterImg?.src) {
                image = posterImg.src;
            }

            // Try swiper slide images
            if (!image) {
                const swiperImg = document.querySelector('.swiper-slide img') as HTMLImageElement;
                if (swiperImg?.src) {
                    image = swiperImg.src;
                }
            }

            // Fallback: background image from visual_bg
            if (!image) {
                const bgDiv = document.querySelector('.visula_bg, .visual_bg') as HTMLElement;
                if (bgDiv) {
                    const style = window.getComputedStyle(bgDiv);
                    const bgImage = style.backgroundImage;
                    const urlMatch = bgImage.match(/url\(["']?([^"')]+)["']?\)/);
                    if (urlMatch) image = urlMatch[1];
                }
            }

            // Another fallback: any img in poster_detail or detail sections
            if (!image) {
                const anyImg = document.querySelector('.poster_detail img, .detail_info img, section img') as HTMLImageElement;
                if (anyImg?.src) image = anyImg.src;
            }

            // Festival period - use nextElementSibling to get the .info_content after .info_ico.data
            let date = '';
            const dataIcon = document.querySelector('.info_ico.data');
            if (dataIcon && dataIcon.nextElementSibling) {
                date = dataIcon.nextElementSibling.textContent?.trim() || '';
            }
            // Fallback: look for any element with .info_content that contains a date pattern
            if (!date) {
                const allInfoContents = document.querySelectorAll('.info_content');
                for (const el of allInfoContents) {
                    const text = el.textContent?.trim() || '';
                    if (text.includes('~') || text.match(/\d{4}\.\d{2}/)) {
                        date = text;
                        break;
                    }
                }
            }

            // Venue address - use nextElementSibling to get the .info_content after .info_ico.location
            let venue = '';
            const locIcon = document.querySelector('.info_ico.location');
            if (locIcon && locIcon.nextElementSibling) {
                venue = locIcon.nextElementSibling.textContent?.trim() || '';
            }
            // Fallback: look for any element that contains Korean address patterns
            if (!venue) {
                const allInfoContents = document.querySelectorAll('.info_content');
                for (const el of allInfoContents) {
                    const text = el.textContent?.trim() || '';
                    if (text.includes('도 ') || text.includes('시 ') || text.includes('군 ') || text.includes('구 ')) {
                        venue = text;
                        break;
                    }
                }
            }

            // Title - multiple fallbacks
            const titleEl = document.querySelector('h2#festival_head') ||
                document.querySelector('.fstvl_tit') ||
                document.querySelector('h2.tit') ||
                document.querySelector('.poster_detail_wrap h2');
            const title = titleEl?.textContent?.trim() || '';

            return { image, date, venue, title };
        });

        return {
            id,
            title: details.title || listTitle,
            image: details.image || listImage,
            date: details.date || '',
            venue: details.venue || '',
            region: parseRegion(details.venue),
            link: url,
            genre: 'festival',
        };
    } catch (error) {
        console.error(`Failed to scrape detail for ID ${id}:`, error);
        return null;
    }
}

async function main() {
    console.log('Starting VisitKorea Festival Scraper (Nationwide) - Fixed Version...');
    console.log(`Using executablePath: ${process.env.PUPPETEER_EXECUTABLE_PATH || 'Bundled'}`);

    // Load existing data with valid entries only
    let existingItems: FestivalItem[] = [];
    const existingIds = new Set<string>();

    if (fs.existsSync(OUTPUT_FILE)) {
        try {
            const loaded = JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf-8'));
            // Only keep items that have valid data (date and venue populated)
            existingItems = loaded.filter((item: FestivalItem) => item.date && item.venue);
            existingItems.forEach(item => existingIds.add(item.id));
            console.log(`Loaded ${existingItems.length} valid existing items (filtered from ${loaded.length} total).`);
        } catch (e) {
            console.error('Failed to load existing data:', e);
        }
    }

    const browser: Browser = await puppeteer.launch({
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu'
        ],
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined
    });

    const page: Page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 1024 });
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    try {
        // 1. Go to list page
        console.log('Loading festival list...');
        await page.goto(LIST_URL, { waitUntil: 'networkidle0', timeout: 60000 });
        await new Promise(r => setTimeout(r, 3000));

        // 2. Get total pages by extracting total count
        const totalPages = await page.evaluate(() => {
            // Look for "총 X건" text
            const totalText = document.body.innerText.match(/총\s*([\d,]+)\s*건/);
            if (totalText) {
                const totalCount = parseInt(totalText[1].replace(/,/g, ''), 10);
                const itemsPerPage = 10;
                return Math.ceil(totalCount / itemsPerPage);
            }

            // Fallback: last page button
            const lastPageBtn = document.querySelector('.page_box .btn_pageLast') as HTMLElement;
            if (lastPageBtn) {
                const onclick = lastPageBtn.getAttribute('onclick') || '';
                const match = onclick.match(/goPage\((\d+)\)/);
                return match ? parseInt(match[1], 10) : 1;
            }

            return 10; // Default fallback
        });

        console.log(`Total pages detected: ${totalPages}`);

        // 3. Scrape all list pages to get unique IDs
        const uniqueListItems = new Map<string, { id: string; title: string; thumbnailImage: string; urlParams?: { cat1: string, cat2: string, areacode: string } }>();

        // Limit pages for now to avoid issues (can increase later)
        const maxPages = Math.min(totalPages, 150);

        for (let p = 1; p <= maxPages; p++) {
            console.log(`Scraping list page ${p}/${maxPages}...`);

            if (p > 1) {
                // Navigate to page using goPage directly and wait
                await page.evaluate((num) => {
                    // @ts-ignore
                    window.goPage(num);
                }, p);

                // Wait for page change
                await new Promise(r => setTimeout(r, 2500));
            }

            const items = await scrapeListPage(page, p);

            // Check for duplicate detection (same IDs as previous page)
            let newInPage = 0;
            for (const item of items) {
                if (item.id && !uniqueListItems.has(item.id)) {
                    uniqueListItems.set(item.id, item);
                    newInPage++;
                }
            }

            console.log(`  Page ${p}: Found ${items.length} items, ${newInPage} new unique`);

            // If no new items in this page, AJAX might not be working
            if (p > 1 && newInPage === 0) {
                console.log(`  Warning: No new items on page ${p}, AJAX might not be working properly.`);
                // Try clicking "Next" button instead
                const hasNextPage = await page.evaluate(() => {
                    const nextBtn = document.querySelector('.page_box .btn_pageNext') as HTMLElement;
                    if (nextBtn) {
                        nextBtn.click();
                        return true;
                    }
                    return false;
                });

                if (hasNextPage) {
                    await new Promise(r => setTimeout(r, 2500));
                } else {
                    console.log('  No more pages available, stopping.');
                    break;
                }
            }
        }

        console.log(`Found ${uniqueListItems.size} unique festivals in list.`);

        // 4. Filter out already scraped items
        const newItems = Array.from(uniqueListItems.values()).filter(item => !existingIds.has(item.id));
        console.log(`New items to scrape: ${newItems.length}`);

        if (newItems.length === 0) {
            console.log('No new festivals to scrape. Done.');
            await browser.close();
            return;
        }

        // 5. Scrape detail pages for new items
        const results: FestivalItem[] = [...existingItems];

        for (let i = 0; i < newItems.length; i++) {
            const listItem = newItems[i];
            console.log(`[${i + 1}/${newItems.length}] Scraping: ${listItem.title}`);

            const details = await scrapeDetailPage(page, listItem.id, listItem.title, listItem.thumbnailImage, listItem.urlParams);

            if (details) {
                results.push(details);
            }

            // Rate limiting
            if (i % 20 === 0 && i > 0) {
                console.log(`  Progress: ${i}/${newItems.length}`);
                await new Promise(r => setTimeout(r, 1000));
            }
        }

        // 6. Save results
        fs.writeFileSync(OUTPUT_FILE, JSON.stringify(results, null, 2));
        console.log(`Saved ${results.length} festivals to ${OUTPUT_FILE}`);

    } catch (error) {
        console.error('Scraper error:', error);
    } finally {
        await browser.close();
    }
}

main().catch(console.error);
