import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

// Type definition matching the project's Performance interface
export interface Performance {
    id: string;
    title: string;
    image: string;
    date: string;
    venue: string;
    link: string;
    region: string;
    genre: string;
}

const BASE_URL = 'https://korean.visitkorea.or.kr';
const OUTPUT_PATH = path.resolve(process.cwd(), 'src/data/festivals.json');

function classifyRegion(location: string): string | null {
    if (location.includes('서울')) return 'seoul';
    if (location.includes('경기') || location.includes('수원') || location.includes('성남') ||
        location.includes('용인') || location.includes('고양') || location.includes('안산') ||
        location.includes('부천') || location.includes('안양') || location.includes('의정부') ||
        location.includes('파주') || location.includes('광명') || location.includes('시흥') ||
        location.includes('군포') || location.includes('이천') || location.includes('오산') ||
        location.includes('하남') || location.includes('김포') || location.includes('양주') ||
        location.includes('구리') || location.includes('광주시') || location.includes('양평') ||
        location.includes('여주') || location.includes('동두천') || location.includes('과천')) return 'gyeonggi';
    if (location.includes('인천')) return 'incheon';
    return null; // Not Seoul/Gyeonggi/Incheon
}

function parseKoreanDate(dateStr: string): Date | null {
    // Format: "2024.12.01 ~ 2025.01.15" or "2024.12.01" or "2025.12.12~2025.12.31"
    const match = dateStr.match(/(\d{4})\.(\d{2})\.(\d{2})/);
    if (match) {
        return new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]));
    }
    return null;
}

function getEndDate(dateStr: string): Date | null {
    // Get end date from "2024.12.01 ~ 2025.01.15" or "2024.12.01~2025.01.15"
    const parts = dateStr.split(/[~～]/);
    if (parts.length === 2) {
        return parseKoreanDate(parts[1].trim());
    }
    // Single date - return that date
    return parseKoreanDate(dateStr);
}

function isNotPast(dateStr: string): boolean {
    const endDate = getEndDate(dateStr);
    if (!endDate) return true; // If can't parse, include it
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return endDate >= today;
}

function cleanDateString(dateStr: string): string {
    // Remove location text that might be mixed in, keeping only date pattern
    // Match date patterns like "2024.12.01 ~ 2025.01.15" or "2024.12.01~2025.01.15"
    const dateMatch = dateStr.match(/\d{4}\.\d{2}\.\d{2}\s*[~～]\s*\d{4}\.\d{2}\.\d{2}/);
    if (dateMatch) return dateMatch[0];

    const singleMatch = dateStr.match(/\d{4}\.\d{2}\.\d{2}/);
    if (singleMatch) return singleMatch[0];

    return dateStr.split('\n')[0].trim(); // Just take first line
}

async function scrapeFestivals() {
    console.log(`Using executablePath: ${process.env.PUPPETEER_EXECUTABLE_PATH || 'Bundled'}`);
    const browser = await puppeteer.launch({
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu'
        ],
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 1024 });

    // Set user agent to avoid blocks
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    const allFestivals: Performance[] = [];

    // Scrape the main page (no region filter - we'll filter by actual location)
    const url = `${BASE_URL}/kfes/list/wntyFstvlList.do`;

    console.log(`Scraping festivals from ${url}...`);

    try {
        await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });

        // Wait for content to load
        await page.waitForSelector('a[href^="/kfes/detail/fstvlDetail.do"]', { timeout: 10000 }).catch(() => {
            console.log('No festivals found or page structure changed.');
        });

        // Extract festival data with more careful parsing
        const festivals = await page.evaluate((baseUrl: string) => {
            const items: any[] = [];
            const links = document.querySelectorAll('a[href^="/kfes/detail/fstvlDetail.do"]');

            links.forEach((link) => {
                const anchor = link as HTMLAnchorElement;
                const href = anchor.getAttribute('href') || '';

                // Get image
                const img = anchor.querySelector('img');
                let imageSrc = img?.getAttribute('src') || '';
                if (imageSrc && !imageSrc.startsWith('http')) {
                    imageSrc = baseUrl + imageSrc;
                }

                // Get all text content from the card
                const fullText = anchor.textContent?.trim() || '';

                // Get title from strong tag
                const titleEl = anchor.querySelector('strong');
                const title = titleEl?.textContent?.trim() || '';

                // Try to find date and location more reliably
                // Look at all divs for date pattern
                let dateText = '';
                let locationText = '';

                const allDivs = anchor.querySelectorAll('div');
                allDivs.forEach(div => {
                    const text = div.textContent?.trim() || '';
                    const directText = div.childNodes[0]?.textContent?.trim() || '';

                    // Date pattern: YYYY.MM.DD
                    if (text.match(/\d{4}\.\d{2}\.\d{2}/) && !dateText) {
                        // Extract just the date part
                        const dateMatch = text.match(/\d{4}\.\d{2}\.\d{2}(?:\s*[~～]\s*\d{4}\.\d{2}\.\d{2})?/);
                        if (dateMatch) dateText = dateMatch[0];
                    }

                    // Location pattern: Korean location (시/군/구)
                    if ((text.includes('서울') || text.includes('경기') || text.includes('인천') ||
                        text.includes('부산') || text.includes('대구') || text.includes('광주') ||
                        text.includes('대전') || text.includes('울산') || text.includes('세종') ||
                        text.includes('강원') || text.includes('충청') || text.includes('전라') ||
                        text.includes('경상') || text.includes('제주')) &&
                        !text.match(/\d{4}/) && text.length < 20) {
                        locationText = text;
                    }
                });

                if (title && href) {
                    items.push({
                        title,
                        image: imageSrc,
                        date: dateText,
                        location: locationText,
                        link: baseUrl + href
                    });
                }
            });

            return items;
        }, BASE_URL);

        console.log(`Found ${festivals.length} total festivals`);

        // Convert to Performance format and filter by region
        let filteredCount = 0;
        for (const fest of festivals) {
            // Clean up date string
            const cleanDate = cleanDateString(fest.date);

            // Skip past events
            if (!isNotPast(cleanDate)) {
                continue;
            }

            // Classify region based on location
            const region = classifyRegion(fest.location);
            if (!region) {
                // Not Seoul/Gyeonggi/Incheon - skip
                continue;
            }

            filteredCount++;

            allFestivals.push({
                id: `festival_${allFestivals.length + 1}`,
                title: fest.title,
                image: fest.image,
                date: cleanDate,
                venue: fest.location,
                link: fest.link,
                region: region,
                genre: 'festival'
            });
        }

        console.log(`Filtered to ${filteredCount} festivals in Seoul/Gyeonggi/Incheon area`);

    } catch (error) {
        console.error('Error scraping festivals:', error);
    }

    await browser.close();

    // Remove duplicates by title
    const uniqueFestivals = allFestivals.filter((fest, index, self) =>
        index === self.findIndex(f => f.title === fest.title)
    );

    console.log(`Total unique festivals: ${uniqueFestivals.length}`);

    // Save to file
    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(uniqueFestivals, null, 2));
    console.log(`Saved to ${OUTPUT_PATH}`);
}

scrapeFestivals().catch(console.error);
