
import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer';

const VENUE_FILE = path.join(process.cwd(), 'src/data/venues.json');

interface VenueData {
    name: string;
    address: string;
    lat?: number;
    lng?: number;
    district?: string;
}

async function delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function enhanceVenues() {
    console.log('🚀 Starting Venue Enhancement...');

    if (!fs.existsSync(VENUE_FILE)) {
        console.error('Venue file not found.');
        return;
    }

    const venues: Record<string, VenueData> = JSON.parse(fs.readFileSync(VENUE_FILE, 'utf-8'));
    const missingVenues = Object.values(venues).filter(v =>
        !v.address || v.address === '정보 없음' || v.address.trim() === ''
    );

    console.log(`Found ${missingVenues.length} venues with missing addresses.`);

    const browser = await puppeteer.launch({
        headless: "new" as any,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    // Use Desktop User Agent
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    // Filter for debug target - REMOVED
    // const debugVenues = missingVenues.filter(v => v.name === target);
    const listToProcess = missingVenues;

    let processed = 0;

    for (const venue of listToProcess) {
        if (venues[venue.name].address && venues[venue.name].address !== '정보 없음') continue;

        // Heuristic: If name looks like an address, use it.
        const addressRegex = /(서울|경기|인천|부산|대구|광주|대전|울산|세종|강원|충북|충남|전북|전남|경북|경남|제주)[가-힣]*[\s]+([가-힣]+[시구군])[\s]+([가-힣0-9\s]*[동읍면로길가])(?:\s+\d+(?:-\d+)?)?/;
        const nameMatch = venue.name.match(addressRegex);
        if (nameMatch) {
            console.log(`✅ Name is Address: ${venue.name}`);
            venues[venue.name].address = venue.name;
            const guMatch = venue.name.match(/(\S+구)/);
            if (guMatch) venues[venue.name].district = guMatch[1];

            // Auto-save and continue
            if (processed % 20 === 0) fs.writeFileSync(VENUE_FILE, JSON.stringify(venues, null, 2));
            continue;
        }

        const query = encodeURIComponent(venue.name);
        const url = `https://search.naver.com/search.naver?query=${query}`;

        console.log(`Searching: ${venue.name} (${url})`);

        try {
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 10000 });

            // Wait for body
            try {
                await page.waitForSelector('body', { timeout: 3000 });
            } catch (e) { }

            const result = await page.evaluate(() => {
                // Regex for standard Korean address pattern
                // Matches: "서울(특별시) 용산구" followed by "xx로", "xx길", "xx동"
                // Enforce suffix to avoid "인구 10" matches
                const addressRegex = /(서울|경기|인천|부산|대구|광주|대전|울산|세종|강원|충북|충남|전북|전남|경북|경남|제주)[가-힣]*[\s]+([가-힣]+[시구군])[\s]+([가-힣0-9\s]*[동읍면로길가])(?:\s+\d+(?:-\d+)?)?/;

                // 1. Prioritize Place Section (.place_section_content, .api_subject_bx)
                const placeSection = document.querySelector('.place_section') || document.querySelector('.api_subject_bx');
                if (placeSection) {
                    const text = (placeSection as HTMLElement).innerText.replace(/\n/g, ' ');
                    const match = text.match(addressRegex);
                    if (match) return { addr: match[0] + ' ...' }; // Just return the match part or heuristics

                    // Look for specific classes in place section
                    const addrEl = placeSection.querySelector('.addr');
                    if (addrEl && addrEl.textContent) return { addr: addrEl.textContent };
                }

                // 2. Search entire body text
                const bodyText = document.body.innerText.replace(/\n/g, ' ');
                // Look for "주소" followed by address
                // const specificMatch = bodyText.match(/주\s*소\s*[:]?\s*([가-힣0-9\s]+(?:시|도)\s+\S+(?:구|시|군))/);

                // General match
                const match = bodyText.match(addressRegex);
                if (match) {
                    // Try to capture a bit more context if possible, but the regex captures City District Street/Dong
                    return { addr: match[0] };
                }

                return null;
            });

            if (result && result.addr) {
                console.log(`✅ Found: ${venue.name} -> ${result.addr}`);
                venues[venue.name].address = result.addr;
                const guMatch = result.addr.match(/(\S+구)/);
                if (guMatch) venues[venue.name].district = guMatch[1];
            } else {
                console.log(`❌ Not Found: ${venue.name}`);
            }

        } catch (e: any) {
            console.error(`Error filtering ${venue.name}: ${e.message}`);
        }

        processed++;
        if (processed % 20 === 0) {
            fs.writeFileSync(VENUE_FILE, JSON.stringify(venues, null, 2));
            console.log(`[Autosave] Processed ${processed}/${missingVenues.length}`);
        }

        await delay(500 + Math.random() * 1000);
    }

    fs.writeFileSync(VENUE_FILE, JSON.stringify(venues, null, 2));
    console.log('🎉 Venue enhancement complete.');
    await browser.close();

    // Final report of still missing
    const stillMissing = Object.values(venues).filter(v => !v.address || v.address === '정보 없음');
    console.log(`Still missing: ${stillMissing.length}`);
}

enhanceVenues();
