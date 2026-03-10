import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer';

const ROOT = '/Users/pyw31337/Developer/CultureFlow-New';
const MOCHA_FILE = path.join(ROOT, 'src/data/mochaclass.json');
const PERF_FILE = path.join(ROOT, 'public/data/performances.json');

async function repairDetails() {
    console.log('Targeted repair for MochaClass clustered items...');
    
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

    const browser = await puppeteer.launch({ headless: true });
    
    for (let i = 0; i < todo.length; i++) {
        const item = todo[i];
        console.log(`[${i+1}/${todo.length}] Processing: ${item.title}`);
        
        const page = await browser.newPage();
        try {
            await page.goto(item.link, { waitUntil: 'domcontentloaded', timeout: 30000 });
            
            // Wait bit for potential dynamic header
            await new Promise(r => setTimeout(r, 1000));

            const detailData = await page.evaluate(async () => {
                // Summary from header
                let headerSummary = '';
                const summaryElements = document.querySelectorAll('p.MuiTypography-body2');
                for (const el of Array.from(summaryElements)) {
                    const text = el.textContent?.trim() || '';
                    if (text.includes('·')) {
                        headerSummary = text;
                        break;
                    }
                }

                // Click '위치' tab
                const tabs = Array.from(document.querySelectorAll('button, div, span'));
                const locationTab = tabs.find(t => t.textContent?.trim() === '위치');
                if (locationTab) {
                    (locationTab as HTMLElement).click();
                    await new Promise(r => setTimeout(r, 1000));
                }

                let rawAddress = '';
                const addrElements = document.querySelectorAll('p.MuiTypography-body1, .MuiBox-root p, .css-1vscdpm p, .css-1u8m1s p');
                for (const el of Array.from(addrElements)) {
                    const text = el.textContent?.trim() || '';
                    if (text.includes('대한민국') || /^[가-힣]+[시|도]/.test(text)) {
                        rawAddress = text.replace(/^.*?위치\s*/, '').trim();
                        break;
                    }
                }

                if (!rawAddress && headerSummary) {
                    rawAddress = headerSummary.split('·').map(s => s.trim()).join(' ');
                }

                return { rawAddress };
            });

            if (detailData.rawAddress && detailData.rawAddress.length > 3) {
                let address = detailData.rawAddress.replace(/^대한민국\s*/, '').trim();
                item.address = address;

                // Priority Logic for Venue
                const tagMatch = item.title.match(/\[([^\]]+)\]/);
                const titleTag = tagMatch ? tagMatch[1] : '';

                let district = '';
                const districtMatch = address.match(/([가-힣]+[구|시|군])/);
                if (districtMatch) district = districtMatch[1];

                let facilityName = '';
                const facilityMatch = address.match(/(?:로|길)\s+\d+(?:-\d+)?\s+(?:.*?,?\s*)?([가-힣\w\s&]+)$/);
                if (facilityMatch) {
                    facilityName = facilityMatch[1].trim();
                    if (/^\d+층$/.test(facilityName) || /^[A-Z]\d+층$/.test(facilityName)) facilityName = '';
                }

                item.venue = (facilityName && facilityName.length > 1 && !facilityName.includes('대한민국')) ? facilityName : 
                            ((address && address.length > 10) ? address : 
                            (titleTag || (district ? `모카클래스 (${district})` : '모카클래스')));

                // Update Region
                if (address.includes('서울')) item.region = 'seoul';
                else if (address.includes('경기') || address.includes('인천')) item.region = 'gyeonggi';
                else if (address.includes('부산')) item.region = 'busan';
                else if (address.includes('제주')) item.region = 'jeju';
                else if (address.includes('광주')) item.region = 'gwangju';
                
                item.lastEnriched = new Date().toISOString();
            }

        } catch (e: any) {
            console.error(`Error on ${item.link}:`, e.message);
        } finally {
            await page.close();
        }
        
        // Save incremental
        if (i % 20 === 0) fs.writeFileSync(MOCHA_FILE, JSON.stringify(data, null, 2));
    }

    await browser.close();
    fs.writeFileSync(MOCHA_FILE, JSON.stringify(data, null, 2));
    console.log('Repair complete.');
}

repairDetails().catch(console.error);
