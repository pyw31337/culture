/**
 * Enrich MochaClass items with address information
 * Scrapes address from each class detail page and updates mochaclass.json
 */
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import fs from 'fs';
import path from 'path';

puppeteer.use(StealthPlugin());

interface MochaClassItem {
    id: string;
    title: string;
    image: string;
    date: string;
    venue: string;
    link: string;
    region: string;
    genre: string;
    price: string;
    originalPrice: string;
    discount: string;
    runningTime: string;
    ageLimit: string;
    casting: string;
    address: string;
    lastEnriched?: string;
}

const DATA_PATH = path.resolve(process.cwd(), 'src/data/mochaclass.json');
const CONCURRENCY = 5;
const DELAY_MS = 500;

// Progress bar
class ProgressBar {
    private total: number;
    private current: number = 0;
    private barLength: number;

    constructor(total: number, barLength: number = 40) {
        this.total = total;
        this.barLength = barLength;
    }

    update(current: number) {
        this.current = current;
        const percentage = Math.round((current / this.total) * 100);
        const filled = Math.round((current / this.total) * this.barLength);
        const bar = '█'.repeat(filled) + '░'.repeat(this.barLength - filled);
        process.stdout.write(`\r[${bar}] ${percentage}% (${current}/${this.total})`);
    }

    finish() {
        process.stdout.write('\n');
    }
}

async function extractAddress(page: any): Promise<string> {
    return await page.evaluate(() => {
        // Strategy 1: Original selector (most reliable based on tests)
        const origSelector = '#topleft > div:nth-child(10) > div > p.MuiTypography-root';
        const orig = document.querySelector(origSelector);
        if (orig?.textContent?.trim()) {
            const text = orig.textContent.trim();
            if (text.includes('대한민국') || text.includes('서울') || text.includes('경기')) {
                return text;
            }
        }

        // Strategy 2: Look in #topleft for any text with Korean address pattern
        const topleft = document.querySelector('#topleft');
        if (topleft) {
            const allTexts = topleft.querySelectorAll('p');
            for (const el of allTexts) {
                const text = el.textContent?.trim() || '';
                if (/^(대한민국\s+)?(서울|경기도?|인천|부산|대전|대구|광주|울산|세종|강원)/.test(text)) {
                    if (text.length > 15 && text.length < 100) {
                        return text;
                    }
                }
            }
        }

        // Strategy 3: Look for MuiTypography with address-like content
        const muiTexts = document.querySelectorAll('.MuiTypography-root');
        for (const el of muiTexts) {
            const text = el.textContent?.trim() || '';
            const addressMatch = text.match(/(대한민국\s+)?(서울|경기|인천|부산|대전|대구|광주|울산|세종|강원)[^\n]+?(로|길|동)\s+[\d-]+/);
            if (addressMatch) {
                return text;
            }
        }

        return '';
    });
}

function cleanAddress(raw: string): string {
    // Remove '대한민국 ' prefix
    let addr = raw.replace(/^대한민국\s+/, '');
    // Convert 경기도 -> 경기, 서울특별시 -> 서울
    addr = addr.replace('서울특별시', '서울');
    addr = addr.replace('경기도', '경기');
    addr = addr.replace('인천광역시', '인천');
    addr = addr.replace('부산광역시', '부산');
    return addr.trim();
}

function extractDistrict(address: string): string {
    const districts = ['강남구', '강동구', '강북구', '강서구', '관악구', '광진구', '구로구', '금천구',
        '노원구', '도봉구', '동대문구', '동작구', '마포구', '서대문구', '서초구', '성동구',
        '성북구', '송파구', '양천구', '영등포구', '용산구', '은평구', '종로구', '중구', '중랑구',
        '수정구', '중원구', '분당구', '팔달구', '영통구', '장안구', '권선구', '기흥구', '수지구', '처인구',
        '일산동구', '일산서구', '덕양구', '원미구', '소사구', '오정구', '부평구', '계양구', '남동구', '연수구',
        '송파구', '강동구', '광진구', '동대문구', '성동구', '중구', '종로구', '서대문구', '마포구', '용산구'];

    for (const district of districts) {
        if (address.includes(district)) {
            return district;
        }
    }

    // Fallback: extract ending with 구
    const match = address.match(/(\S+구)/);
    return match ? match[1] : '';
}

function determineRegion(address: string): string {
    if (address.includes('서울')) return 'seoul';
    if (address.includes('경기')) return 'gyeonggi';
    if (address.includes('인천')) return 'incheon';
    if (address.includes('부산')) return 'busan';
    if (address.includes('대구')) return 'daegu';
    if (address.includes('대전')) return 'daejeon';
    if (address.includes('광주')) return 'gwangju';
    if (address.includes('울산')) return 'ulsan';
    if (address.includes('세종')) return 'sejong';
    if (address.includes('강원')) return 'gangwon';
    if (address.includes('충북') || address.includes('충청북')) return 'chungbuk';
    if (address.includes('충남') || address.includes('충청남')) return 'chungnam';
    if (address.includes('전북') || address.includes('전라북')) return 'jeonbuk';
    if (address.includes('전남') || address.includes('전라남')) return 'jeonnam';
    if (address.includes('경북') || address.includes('경상북')) return 'gyeongbuk';
    if (address.includes('경남') || address.includes('경상남')) return 'gyeongnam';
    if (address.includes('제주')) return 'jeju';
    return 'seoul'; // default
}

async function enrichMochaClassAddresses() {
    console.log('Starting MochaClass Address Enrichment...\n');

    // Load existing data
    if (!fs.existsSync(DATA_PATH)) {
        console.error('mochaclass.json not found!');
        return;
    }

    const data: MochaClassItem[] = JSON.parse(fs.readFileSync(DATA_PATH, 'utf-8'));
    console.log(`Loaded ${data.length} items from mochaclass.json`);

    // Filter items that need address enrichment
    // Only process items where address is missing or is just a district placeholder
    const needsEnrichment = data.filter(item => {
        const addr = item.address || '';
        // Need enrichment if: empty, only "서울", or only contains district name format like "(강남구)"
        return !addr || addr === '서울' || addr.length < 10 || /^모카클래스/.test(addr);
    });

    console.log(`Items needing enrichment: ${needsEnrichment.length}`);

    if (needsEnrichment.length === 0) {
        console.log('All items already have addresses. Nothing to do.');
        return;
    }

    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });

    const progressBar = new ProgressBar(needsEnrichment.length);
    let processed = 0;
    let updated = 0;
    let failed = 0;

    // Create a lookup map for quick updates
    const dataMap = new Map<string, MochaClassItem>();
    data.forEach(item => dataMap.set(item.link, item));

    // Process in chunks
    for (let i = 0; i < needsEnrichment.length; i += CONCURRENCY) {
        const chunk = needsEnrichment.slice(i, i + CONCURRENCY);

        const promises = chunk.map(async (item) => {
            const page = await browser.newPage();
            await page.setViewport({ width: 1280, height: 800 });

            try {
                await page.goto(item.link, { waitUntil: 'domcontentloaded', timeout: 20000 });
                await new Promise(r => setTimeout(r, DELAY_MS));

                const rawAddress = await extractAddress(page);

                if (rawAddress) {
                    const cleanedAddress = cleanAddress(rawAddress);
                    const district = extractDistrict(cleanedAddress);
                    const region = determineRegion(cleanedAddress);
                    const venue = district ? `모카클래스 (${district})` : '모카클래스';

                    // Update the item in the map
                    const existing = dataMap.get(item.link);
                    if (existing) {
                        existing.address = cleanedAddress;
                        existing.venue = venue;
                        existing.region = region;
                        existing.lastEnriched = new Date().toISOString();
                        updated++;
                    }
                } else {
                    failed++;
                }
            } catch (e) {
                failed++;
            } finally {
                await page.close();
            }
        });

        await Promise.all(promises);
        processed += chunk.length;
        progressBar.update(processed);

        // Save periodically
        if (i % 50 === 0) {
            const updatedData = Array.from(dataMap.values());
            fs.writeFileSync(DATA_PATH, JSON.stringify(updatedData, null, 2), 'utf-8');
        }
    }

    progressBar.finish();
    await browser.close();

    // Final save
    const finalData = Array.from(dataMap.values());
    fs.writeFileSync(DATA_PATH, JSON.stringify(finalData, null, 2), 'utf-8');

    console.log(`\n=== Enrichment Complete ===`);
    console.log(`Total processed: ${processed}`);
    console.log(`Updated: ${updated}`);
    console.log(`Failed: ${failed}`);
}

enrichMochaClassAddresses().catch(console.error);
