import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import fs from 'fs';
import path from 'path';

puppeteer.use(StealthPlugin());

const outputPath = path.resolve(process.cwd(), 'src/data/umclass.json');

async function fixVenues() {
    const raw = fs.readFileSync(outputPath, 'utf-8');
    const data = JSON.parse(raw);

    const targets = data.filter((p: any) => p.venue.includes('솜씨당'));
    console.log(`Found ${targets.length} items needing venue fix.`);
    if (targets.length === 0) return;

    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    let fixedCount = 0;
    const CONCURRENCY = 10;

    for (let i = 0; i < targets.length; i += CONCURRENCY) {
        const chunk = targets.slice(i, i + CONCURRENCY);

        const promises = chunk.map(async (p: any) => {
            const page = await browser.newPage();
            try {
                await page.setViewport({ width: 1440, height: 900 });
                await page.goto(p.link, { waitUntil: 'domcontentloaded', timeout: 30000 });

                const addr = await page.evaluate(function () {
                    const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6, p, span, div'));
                    let address = '';

                    for (let i = 0; i < headings.length; i++) {
                        if (headings[i].textContent?.trim() === '클래스 장소') {
                            const container = headings[i].closest('div')?.parentElement;
                            if (container) {
                                const text = container.textContent || '';
                                if (text.includes('복사')) {
                                    const parts = text.split('복사');
                                    if (parts[0]) {
                                        address = parts[0].replace('클래스 장소', '').trim();
                                    }
                                } else {
                                    address = text.replace('클래스 장소', '').trim();
                                }
                            }
                            break;
                        }
                        if (headings[i].textContent?.trim() === '장소') {
                            const nextSibling = headings[i].nextElementSibling;
                            if (nextSibling) {
                                address = nextSibling.textContent?.trim() || '';
                            }
                            break;
                        }
                    }

                    if (!address) {
                        for (const el of headings) {
                            const text = el.textContent?.trim() || '';
                            if ((text.includes('대한민국') || text.includes('동구') || text.includes('중구') || text.includes('서구') || text.includes('남구') || text.includes('북구') || text.includes('시 ') || text.includes('도 ') || text.includes('로 ') || text.includes('길 ')) && text.length > 10 && text.length < 100 && !text.includes('솜씨당')) {
                                if (text.match(/([가-힣]+(도|시|구|군|동|로|길)\s*)+/)) {
                                    address = text;
                                    if (text.includes('대한민국')) break;
                                }
                            }
                        }
                    }

                    address = address.replace(/지도보기주소복사/g, '').replace(/주소복사/g, '').replace(/지도보기/g, '').trim();
                    return address;
                });

                if (addr && addr.length > 5) {
                    let cleanAddr = addr.replace(/^대한민국\s*/, '').trim();
                    p.address = cleanAddr;
                    p.venue = cleanAddr;
                    return p.id;
                }
                return null;
            } catch (e: any) {
                return null;
            } finally {
                await page.close();
            }
        });

        const results = await Promise.all(promises);
        const chunkSuccess = results.filter(r => r !== null).length;
        fixedCount += chunkSuccess;
        console.log(`Processed batch ${i / CONCURRENCY + 1}/${Math.ceil(targets.length / CONCURRENCY)}. Fixed ${chunkSuccess} items.`);

        fs.writeFileSync(outputPath, JSON.stringify(data, null, 2));
    }

    await browser.close();
    console.log(`Fixed ${fixedCount} out of ${targets.length} missing venues.`);
}

fixVenues();
