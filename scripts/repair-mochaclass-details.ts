import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer';
import pLimit from 'p-limit';

const ROOT = '/Users/pyw31337/Developer/CultureFlow-New';
const MOCHA_FILE = path.join(ROOT, 'src/data/mochaclass.json');

async function repairDetails() {
    console.log('Targeted repair for MochaClass clustered items (Optimized)...');
    
    if (!fs.existsSync(MOCHA_FILE)) {
        console.error('File not found:', MOCHA_FILE);
        return;
    }

    const data = JSON.parse(fs.readFileSync(MOCHA_FILE, 'utf8'));
    // Clustered items or items with generic addresses
    const todo = data.filter((item: any) => 
        item.venue === '모카클래스' || 
        item.venue.includes('모카클래스 (') || 
        item.address === '서울특별시' || 
        item.address === '서울'
    );

    console.log(`Found ${todo.length} items to re-scrape.`);
    if (todo.length === 0) return;

    const browser = await puppeteer.launch({ 
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    async function runSequential() {
        for (let i = 0; i < todo.length; i++) {
            const item = todo[i];
            const shortTitle = item.title.substring(0, 30);
            const page = await browser.newPage();
            await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
            await page.setViewport({ width: 1280, height: 800 });
            
            try {
                await page.goto(item.link, { 
                    waitUntil: 'domcontentloaded', 
                    timeout: 60000 
                });
                
                await new Promise(r => setTimeout(r, 2000));

                const tabFound = await page.evaluate(async () => {
                    const tabs = Array.from(document.querySelectorAll('button, div, span, a, p'));
                    const locationTab = tabs.find(t => t.textContent?.trim() === '위치');
                    if (locationTab) {
                        (locationTab as HTMLElement).click();
                        return true;
                    }
                    return false;
                });

                if (tabFound) {
                    await new Promise(r => setTimeout(r, 4000));
                }

                const detailData = await page.evaluate(async () => {
                    const results: any = { rawAddress: '', headerSummary: '' };
                    const summaryElements = document.querySelectorAll('p.MuiTypography-body2, span, p');
                    for (const el of Array.from(summaryElements)) {
                        const text = el.textContent?.trim() || '';
                        if (text.split('·').length >= 2) {
                            results.headerSummary = text;
                            break;
                        }
                    }

                    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
                    let node;
                    while(node = walker.nextNode()) {
                        const text = node.textContent?.trim();
                        if (text && (text.includes('대한민국') || /^[가-힣]+[시|도]/.test(text) || text.startsWith('서울') || text.startsWith('경기'))) {
                            if (text.length > 5 && text.length < 150) {
                                if (text.startsWith('[') && text.includes(']')) continue;
                                results.rawAddress = text.replace(/^.*?위치\s*/, '').trim();
                                if (text.includes('로') || text.includes('길') || text.includes('번길')) break;
                            }
                        }
                    }

                    if (!results.rawAddress && results.headerSummary) {
                        results.rawAddress = results.headerSummary.split('·').map(s => s.trim()).join(' ');
                    }
                    return results;
                });

                console.log(`[${i+1}/${todo.length}] ${shortTitle}: ${detailData.rawAddress || 'FAILED'}`);

                if (detailData.rawAddress && detailData.rawAddress.length > 3) {
                    let address = detailData.rawAddress.replace(/^대한민국\s*/, '').trim();
                    item.address = address;
                    const tagMatch = item.title.match(/\[([^\]]+)\]/);
                    const titleTag = tagMatch ? tagMatch[1] : '';
                    let district = '';
                    const districtMatch = address.match(/([가-힣]+[구|시|군])/);
                    if (districtMatch) district = districtMatch[1];
                    let facilityName = '';
                    const facilityMatch = address.match(/(?:로|길|번길)\s+\d+(?:-\d+)?\s+(?:.*?,?\s*)?([가-힣\w\s&]+)$/);
                    if (facilityMatch) {
                        facilityName = facilityMatch[1].trim();
                        if (/^\d+층$/.test(facilityName) || /^[A-Z]\d+층$/.test(facilityName) || /^\d+호$/.test(facilityName) || facilityName.length < 2) {
                            facilityName = '';
                        }
                    }
                    item.venue = (facilityName && facilityName.length > 1 && !facilityName.includes('대한민국')) ? facilityName : 
                                ((address && address.length > 10) ? address : 
                                (titleTag || (district ? `모카클래스 (${district})` : '모카클래스')));

                    if (address.includes('서울')) item.region = 'seoul';
                    else if (address.includes('경기') || address.includes('인천')) item.region = 'gyeonggi';
                    else if (address.includes('부산')) item.region = 'busan';
                    item.lastEnriched = new Date().toISOString();
                    successCount++;
                }
            } catch (e: any) {
                console.error(`Error on ${item.link}:`, e.message);
            } finally {
                await page.close();
                if ((i + 1) % 10 === 0) {
                    console.log(`Progress: ${i + 1}/${todo.length} (Success: ${successCount})`);
                    fs.writeFileSync(MOCHA_FILE, JSON.stringify(data, null, 2));
                }
            }
        }
    }

    await runSequential();
    await browser.close();
    
    fs.writeFileSync(MOCHA_FILE, JSON.stringify(data, null, 2));
    console.log(`Repair complete. Successfully enriched ${successCount}/${todo.length} items.`);
}

repairDetails().catch(console.error);
