import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import * as fs from 'fs';
import * as path from 'path';
import cliProgress from 'cli-progress';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

puppeteer.use(StealthPlugin());

const TARGET_URL = 'https://mom-mom.net/shop/categories/1102241';
const OUTPUT_FILE = path.resolve(process.cwd(), 'src/data/mommom-products.json');

interface NaverSearchResult {
    address: string;
    lat: number;
    lng: number;
}

// Smart genre classification based on title keywords
function classifyGenre(title: string): string {
    const t = title.toLowerCase();

    if (t.includes('호텔') || t.includes('리조트') || t.includes('펜션') ||
        t.includes('숙박') || t.includes('스테이') || t.includes('글램핑') ||
        t.includes('캠핑') || t.includes('풀빌라')) return 'travel';
    if (t.includes('키즈') || t.includes('어린이') || t.includes('유아') ||
        t.includes('아이랑') || t.includes('베이비') || t.includes('놀이터')) return 'kids';
    if (t.includes('워터파크') || t.includes('수영') || t.includes('스파') ||
        t.includes('온천') || t.includes('찜질') || t.includes('사우나') ||
        t.includes('스키') || t.includes('스노우') || t.includes('썰매')) return 'leisure';
    if (t.includes('박물관') || t.includes('과학관') || t.includes('미술관') ||
        t.includes('전시') || t.includes('아쿠아리움') || t.includes('수족관') ||
        t.includes('동물원') || t.includes('식물원') || t.includes('테마파크')) return 'museum';
    if (t.includes('클래스') || t.includes('체험') || t.includes('만들기') ||
        t.includes('공방') || t.includes('쿠킹') || t.includes('베이킹')) return 'class';
    return 'activity';
}

// Extract region from address or title
function extractRegion(text: string): string {
    if (text.includes('서울')) return 'seoul';
    if (text.includes('경기') || text.includes('일산') || text.includes('킨텍스') ||
        text.includes('수원') || text.includes('용인') || text.includes('성남')) return 'gyeonggi';
    if (text.includes('인천')) return 'incheon';
    if (text.includes('부산')) return 'busan';
    if (text.includes('대구')) return 'daegu';
    if (text.includes('광주')) return 'gwangju';
    if (text.includes('대전')) return 'daejeon';
    if (text.includes('울산')) return 'ulsan';
    if (text.includes('세종')) return 'sejong';
    if (text.includes('강원') || text.includes('춘천') || text.includes('강릉')) return 'gangwon';
    if (text.includes('제주')) return 'jeju';
    if (text.includes('충북') || text.includes('청주')) return 'chungbuk';
    if (text.includes('충남') || text.includes('천안')) return 'chungnam';
    if (text.includes('전북') || text.includes('전주')) return 'jeonbuk';
    if (text.includes('전남') || text.includes('여수') || text.includes('광양')) return 'jeonnam';
    if (text.includes('경북') || text.includes('포항') || text.includes('경주')) return 'gyeongbuk';
    if (text.includes('경남') || text.includes('창원') || text.includes('김해')) return 'gyeongnam';
    return 'etc';
}

async function scrapeProducts() {
    console.log('Starting Mom-Mom Product Scraper (Enhanced)...');
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    try {
        await page.goto(TARGET_URL, { waitUntil: 'networkidle2', timeout: 60000 });
        console.log('Page loaded.');

        // Scroll to load all items
        await page.evaluate(async () => {
            const delay = (ms: number) => new Promise(res => setTimeout(res, ms));
            let lastHeight = 0;
            let noChange = 0;

            for (let i = 0; i < 100; i++) {
                window.scrollTo(0, document.body.scrollHeight);
                await delay(1000);

                const buttons = Array.from(document.querySelectorAll('button'));
                const moreBtn = buttons.find(b => b.textContent?.includes('더보기'));
                if (moreBtn) {
                    moreBtn.click();
                    await delay(1000);
                }

                const newHeight = document.body.scrollHeight;
                if (newHeight === lastHeight) noChange++;
                else noChange = 0;
                lastHeight = newHeight;

                if (noChange > 5) break;
            }
        });

        // Extract Items with full details from list page
        const listItems = await page.evaluate((): any[] => {
            const results: any[] = [];
            const seenLinks = new Set();

            // Use class selector for product cards (updated to match current site)
            const cards = document.querySelectorAll('div[class*="sc-3ec5fbe4-30"]');

            cards.forEach(card => {
                // Find anchor that points to a product
                const anchor = card.querySelector('a[href*="/shop/products/"]') as HTMLAnchorElement;
                if (!anchor) return;

                const link = anchor.href;
                if (!link || seenLinks.has(link)) return;
                seenLinks.add(link);

                // Get title from h4 (updated class)
                const h4 = card.querySelector('h4.product-name, h4');
                const title = h4?.textContent?.trim() || '';

                // Get image
                const imgEl = card.querySelector('img');
                const image = imgEl?.src || '';

                // Get brand name
                const brandEl = card.querySelector('.brand-name, div[class*="sc-"] p:first-child');
                const brand = brandEl?.textContent?.trim() || '';

                // Get prices
                let discount = '';
                let price = '';
                let originalPrice = '';

                // Find element containing price info
                const priceContainer = card.querySelector('p[class*="product-price"], div[class*="price"]');
                if (priceContainer) {
                    const priceText = priceContainer.textContent || '';
                    const rateMatch = priceText.match(/(\d+)%/);
                    if (rateMatch) discount = rateMatch[0];

                    const priceMatch = priceText.match(/([\d,]+원)/);
                    if (priceMatch) price = priceMatch[0];
                }

                // Also check for del element (original price struck through)
                const delEl = card.querySelector('del');
                if (delEl && delEl.textContent?.includes('원')) {
                    originalPrice = delEl.textContent.trim();
                }

                // Generate ID from link ID
                const idMatch = link.match(/products\/(\d+)/);
                const id = idMatch ? "mommom_product_" + idMatch[1] : "mommom_shop_" + Math.random().toString(36).substr(2, 9);

                results.push({
                    id,
                    title,
                    brand,
                    image,
                    link,
                    price,
                    originalPrice,
                    discount
                });
            });
            return results;
        });

        console.log(`Found ${listItems.length} products to process.`);

        // Create a separate page for address search
        const searchPage = await browser.newPage();
        await searchPage.setRequestInterception(true);
        searchPage.on('request', (req) => {
            if (['image', 'media', 'font', 'stylesheet'].includes(req.resourceType())) req.abort();
            else req.continue();
        });

        const finalItems: any[] = [];
        const bar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
        bar.start(listItems.length, 0);

        // Process each item
        for (const item of listItems) {
            const newItem: any = {
                id: item.id,
                title: item.title,
                image: item.image,
                link: item.link,
                date: '상시운영',
                genre: classifyGenre(item.title),
                region: extractRegion(item.title + ' ' + item.brand),
                venue: item.brand || item.title,
                address: '',
                latitude: 0,
                longitude: 0,
                price: item.price || '',
                originalPrice: item.originalPrice || '',
                rate: 0,
                discount: item.discount || '',
                platform: 'mommom',
                description: ''
            };

            // Parse discount rate
            if (item.discount) {
                const rateMatch = item.discount.match(/(\d+)/);
                if (rateMatch) {
                    newItem.rate = parseInt(rateMatch[1], 10);
                }
            }

            // Search for address using brand name (progressive word removal)
            const searchTerm = item.brand || item.title;
            if (searchTerm) {
                const words = searchTerm.split(/\s+/).filter((w: string) => w.length > 1);

                for (let i = words.length; i > 0; i--) {
                    const query = words.slice(0, i).join(' ');
                    if (query.length < 3) continue;

                    try {
                        const searchUrl = `https://search.naver.com/search.naver?where=nexearch&query=${encodeURIComponent(query + ' 주소')}`;
                        await searchPage.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 10000 });

                        // Try to extract address and coordinates from Naver
                        const result = await searchPage.evaluate((): NaverSearchResult | null => {
                            // Method 1: Look for __APOLLO_STATE__ JSON
                            const scripts = Array.from(document.querySelectorAll('script'));
                            for (const script of scripts) {
                                const text = script.textContent || '';
                                if (text.includes('__APOLLO_STATE__')) {
                                    const match = text.match(/"roadAddress"\s*:\s*"([^"]+)"/);
                                    const latMatch = text.match(/"y"\s*:\s*"?([\d.]+)"?/);
                                    const lngMatch = text.match(/"x"\s*:\s*"?([\d.]+)"?/);

                                    if (match && latMatch && lngMatch) {
                                        return {
                                            address: match[1],
                                            lat: parseFloat(latMatch[1]),
                                            lng: parseFloat(lngMatch[1])
                                        };
                                    }
                                }
                            }

                            // Method 2: Look for address in visible text
                            const addrPatterns = [
                                /([가-힣]+(?:시|도)\s+[가-힣]+(?:시|구|군)\s+[가-힣0-9\s\-]+)/
                            ];
                            const bodyText = document.body.innerText;
                            for (const pattern of addrPatterns) {
                                const match = bodyText.match(pattern);
                                if (match) {
                                    return { address: match[1].trim(), lat: 0, lng: 0 };
                                }
                            }

                            // Method 3: Look for map link with coordinates
                            const mapLinks = Array.from(document.querySelectorAll('a[href*="map.naver"]'));
                            for (const link of mapLinks) {
                                const href = (link as HTMLAnchorElement).href;
                                const latMatch = href.match(/lat=([\d.]+)/);
                                const lngMatch = href.match(/lng=([\d.]+)/);
                                if (latMatch && lngMatch) {
                                    return {
                                        address: '',
                                        lat: parseFloat(latMatch[1]),
                                        lng: parseFloat(lngMatch[1])
                                    };
                                }
                            }

                            return null;
                        });

                        if (result && (result.address || result.lat)) {
                            if (result.address) newItem.address = result.address;
                            if (result.lat) newItem.latitude = result.lat;
                            if (result.lng) newItem.longitude = result.lng;

                            // Update region based on address
                            if (result.address) {
                                newItem.region = extractRegion(result.address);
                            }

                            break; // Found address, stop searching
                        }
                    } catch (e) {
                        // Continue to next shorter query
                    }
                }
            }

            finalItems.push(newItem);
            bar.increment();
        }
        bar.stop();

        await searchPage.close();

        fs.writeFileSync(OUTPUT_FILE, JSON.stringify(finalItems, null, 2));
        console.log(`Saved ${finalItems.length} products to ${OUTPUT_FILE}`);

        // Print genre summary
        const genreSummary: Record<string, number> = {};
        finalItems.forEach(i => genreSummary[i.genre] = (genreSummary[i.genre] || 0) + 1);
        console.log('Genre distribution:', genreSummary);

        // Print address coverage
        const withAddress = finalItems.filter(i => i.address).length;
        console.log(`Address coverage: ${withAddress}/${finalItems.length} (${(withAddress / finalItems.length * 100).toFixed(1)}%)`);

    } catch (e) {
        console.error('Error:', e);
    } finally {
        await browser.close();
    }
}

scrapeProducts();
