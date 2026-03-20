import fs from 'fs';
import path from 'path';
import { chromium } from 'playwright';
import pLimit from 'p-limit';

const ROOT = '/Users/pyw31337/Developer/CultureFlow-New';
const MOCHA_FILE = path.join(ROOT, 'src/data/mochaclass.json');

async function repairDetails() {
    console.log('Targeted repair for MochaClass (Playwright Parallel Edition)...');
    
    if (!fs.existsSync(MOCHA_FILE)) {
        console.error('File not found:', MOCHA_FILE);
        return;
    }

    const data = JSON.parse(fs.readFileSync(MOCHA_FILE, 'utf8'));
    const todo = data.filter((item: any) => 
        item.venue === '모카클래스' || 
        item.venue.includes('모카클래스 (') || 
        item.address === '서울특별시' || 
        item.address === '서울'
    );

    console.log(`Found ${todo.length} items to re-scrape.`);
    if (todo.length === 0) return;

    const browser = await chromium.launch({ headless: true });
    
    const limit = pLimit(8); // Process 8 items in parallel
    let processedCount = 0;
    let successCount = 0;

    const tasks = todo.map((item: any) => limit(async () => {
        const context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        });
        const page = await context.newPage();
        const shortTitle = item.title.substring(0, 30);
        
        try {
            await page.goto(item.link, { waitUntil: 'domcontentloaded', timeout: 60000 });
            await page.waitForTimeout(1500);

            // Click location tab
            const tab = page.locator('button, div, span, a, p').filter({ hasText: '위치' }).first();
            if (await tab.count() > 0) {
                await tab.click();
                await page.waitForTimeout(2500);
            }

            const extraction = await page.evaluate(() => {
                const results: any = { rawAddress: '', headerSummary: '' };
                
                // Header summary fallback
                const summaryElements = Array.from(document.querySelectorAll('p.MuiTypography-body2, span, p'));
                const summary = summaryElements.find(el => (el.textContent || '').split('·').length >= 2);
                if (summary) results.headerSummary = summary.textContent?.trim();

                const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
                let node;
                while(node = walker.nextNode()) {
                    const text = node.textContent?.trim();
                    if (text && (text.includes('대한민국') || /^[가-힣]+[시|도]/.test(text) || text.startsWith('서울') || text.startsWith('경기'))) {
                        if (text.length > 10 && text.length < 150) {
                            if (text.startsWith('[') && text.includes(']')) continue;
                            results.rawAddress = text;
                            if (text.includes('로') || text.includes('길') || text.includes('번길')) break;
                        }
                    }
                }
                
                if (!results.rawAddress && results.headerSummary) {
                    results.rawAddress = results.headerSummary.split('·').map((s: string) => s.trim()).join(' ');
                }
                return results;
            });

            if (extraction.rawAddress && extraction.rawAddress.length > 5) {
                let address = extraction.rawAddress.replace(/^대한민국\s*/, '').trim();
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
                else if (address.includes('제주')) item.region = 'jeju';
                else if (address.includes('광주')) item.region = 'gwangju';
                else if (address.includes('대전')) item.region = 'daejeon';
                else if (address.includes('대구')) item.region = 'daegu';
                else if (address.includes('울산')) item.region = 'ulsan';
                
                item.lastEnriched = new Date().toISOString();
                successCount++;
            }

        } catch (e: any) {
            // Silently handle errors per item
        } finally {
            await context.close();
            processedCount++;
            if (processedCount % 10 === 0) {
                console.log(`Progress: ${processedCount}/${todo.length} (Success: ${successCount})`);
                fs.writeFileSync(MOCHA_FILE, JSON.stringify(data, null, 2));
            }
        }
    }));

    await Promise.all(tasks);
    await browser.close();
    fs.writeFileSync(MOCHA_FILE, JSON.stringify(data, null, 2));
    console.log(`Finished. Saved ${successCount} items.`);
}

repairDetails().catch(console.error);
