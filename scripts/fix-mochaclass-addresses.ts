import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import fs from 'fs';
import path from 'path';

puppeteer.use(StealthPlugin());

const outputPath = path.resolve(process.cwd(), 'src/data/mochaclass.json');

async function fixVenues() {
    const raw = fs.readFileSync(outputPath, 'utf-8');
    const data = JSON.parse(raw);

    const targets = data.filter((p: any) => p.venue.includes('모카클래스'));
    console.log(`Found ${targets.length} items needing venue fix.`);
    if (targets.length === 0) return;

    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    let fixedCount = 0;
    const CONCURRENCY = 15;

    for (let i = 0; i < targets.length; i += CONCURRENCY) {
        const chunk = targets.slice(i, i + CONCURRENCY);

        const promises = chunk.map(async (p: any) => {
            const page = await browser.newPage();
            try {
                await page.setViewport({ width: 1440, height: 900 });
                await page.goto(p.link, { waitUntil: 'domcontentloaded', timeout: 30000 });
                try { await page.waitForSelector('.MuiTypography-root', { timeout: 3000 }); } catch (e) { }

                const dataExt = await page.evaluate(function () {
                    const allNodes = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6, p, span, div'));
                    let rawAddress = '';

                    for (let i = 0; i < allNodes.length; i++) {
                        if (allNodes[i].textContent?.trim() === '위치') {
                            const container = allNodes[i].closest('div')?.parentElement;
                            if (container) {
                                const text = container.textContent || '';
                                const match = text.match(/위치(.*?)찾아오는\s*길/);
                                if (match && match[1]) {
                                    rawAddress = match[1].trim();
                                    break;
                                } else {
                                    const match2 = text.match(/위치(대한민국.*?(구|동|시|군|로|길)\b.*?)/);
                                    if (match2) {
                                        rawAddress = match2[1].trim();
                                        break;
                                    }
                                }
                            }
                        }
                    }

                    if (!rawAddress) {
                        for (const node of allNodes) {
                            const text = node.textContent?.trim() || '';
                            if ((text.includes('대한민국') || text.includes('서울') || text.includes('경기') || text.includes('로 ') || text.includes('길 ')) && text.length > 10 && text.length < 100 && !text.includes('모카클래스')) {
                                if (text.match(/([가-힣]+(도|시|구|군|동|로|길)\s*)+/)) {
                                    rawAddress = text;
                                    if (text.includes('대한민국')) break;
                                }
                            }
                        }
                    }
                    return rawAddress;
                });

                if (dataExt && dataExt.length > 5) {
                    let address = dataExt.replace(/^대한민국\s*/, '').trim();
                    p.address = address;

                    let district = '';
                    const districtMatch = address.match(/(\w+[구])/);
                    if (districtMatch) {
                        district = districtMatch[1];
                    } else {
                        const parts = address.split(' ');
                        for (const part of parts) {
                            if (part.endsWith('구')) {
                                district = part;
                                break;
                            }
                        }
                    }

                    p.venue = address; // Use actual address for the venue field
                    p.region = address.includes('서울') ? 'seoul' : 'gyeonggi';
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
