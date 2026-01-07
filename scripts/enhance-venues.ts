
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
        (!v.address || v.address === '정보 없음' || v.address.trim() === '') ||
        (!v.lat || !v.lng)
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
        // Skip only if fully complete
        if (venues[venue.name].address && venues[venue.name].address !== '정보 없음' && venues[venue.name].lat) continue;

        // Heuristic: If name looks like an address, use it.
        const addressRegex = /(서울|경기|인천|부산|대구|광주|대전|울산|세종|강원|충북|충남|전북|전남|경북|경남|제주)[가-힣]*[\s]+([가-힣]+[시구군])[\s]+([가-힣0-9\s]*[동읍면로길가])(?:\s+\d+(?:-\d+)?)?/;
        const nameMatch = venue.name.match(addressRegex);
        if (nameMatch) {
            console.log(`✅ Name is Address: ${venue.name}`);
            venues[venue.name].address = venue.name;
            const guMatch = venue.name.match(/(\S+구)/);
            if (guMatch) venues[venue.name].district = guMatch[1];

            // Continue to geocode if lat is missing
            if (!venues[venue.name].lat) {
                // fall through to geocoding part
            } else {
                // Auto-save and continue
                if (processed % 20 === 0) fs.writeFileSync(VENUE_FILE, JSON.stringify(venues, null, 2));
                continue;
            }
        } else {
            // Only skip if address exists AND we are not here for geocoding
            if (venues[venue.name].address && venues[venue.name].address !== '정보 없음' && venues[venue.name].lat) continue;
        }

        const query = encodeURIComponent(venue.name);
        const url = `https://search.naver.com/search.naver?query=${query}`;

        console.log(`Searching: ${venue.name} (${url})`);

        try {
            if (!venues[venue.name].address || venues[venue.name].address === '정보 없음') {
                await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 10000 });

                // Wait for body
                try {
                    await page.waitForSelector('body', { timeout: 3000 });
                } catch (e) { }
            }

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
                console.log(`❌ Not Found Address: ${venue.name}`);
            }

        } catch (e: any) {
            console.error(`Error filtering ${venue.name}: ${e.message}`);
        }

        // 3. Geocode if address exists but coords missing
        if (venues[venue.name].address && venues[venue.name].address !== '정보 없음' && (!venues[venue.name].lat || !venues[venue.name].lng)) {
            try {
                // Cleaner Address Extraction: target "City District Road Number"
                // e.g. "경기 광주시 회안대로 891"
                const addr = venues[venue.name].address;
                const match = addr.match(/([가-힣]+[시도]\s+[가-힣]+[시구군]\s+[가-힣0-9]+\S*[로길]\s*\d+(?:-\d+)?)/);

                let cleanAddr = match ? match[0] : addr.split('(')[0].trim();

                const query = encodeURIComponent(cleanAddr);
                const geoUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${query}&limit=1`;
                console.log(`   -> Geocoding: ${cleanAddr}`);

                // Fetch with native fetch if available or use axios (need to import axios if not present, but this file uses puppeteer primarily. 
                // Let's use page.evaluate for fetch inside browser context to avoid adding axios dependency if not needed, 
                // OR just use fetch since node 18+ has it. Assuming node environment.
                // But wait, the file doesn't import axios. Let's use page.evaluate to fetch from browser context to be safe and use browser headers.

                const geoResult: any = await page.evaluate(async (url) => {
                    try {
                        const res = await fetch(url, { headers: { 'User-Agent': 'CultureFlow/1.0' } });
                        return await res.json();
                    } catch (e) { return []; }
                }, geoUrl);

                if (geoResult && geoResult.length > 0) {
                    venues[venue.name].lat = parseFloat(geoResult[0].lat);
                    venues[venue.name].lng = parseFloat(geoResult[0].lon);
                    console.log(`   ✅ Geocoded: ${venues[venue.name].lat}, ${venues[venue.name].lng}`);
                } else {
                    console.log(`   ❌ Geocode Failed for: ${cleanAddr}`);
                    // Fallback: Try searching by Name
                    const nameQuery = encodeURIComponent(venue.name);
                    const nameGeoUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${nameQuery}&limit=1`;
                    const nameResult: any = await page.evaluate(async (url) => {
                        try {
                            const res = await fetch(url, { headers: { 'User-Agent': 'CultureFlow/1.0' } });
                            return await res.json();
                        } catch (e) { return []; }
                    }, nameGeoUrl);

                    if (nameResult && nameResult.length > 0) {
                        venues[venue.name].lat = parseFloat(nameResult[0].lat);
                        venues[venue.name].lng = parseFloat(nameResult[0].lon);
                        console.log(`   ✅ Geocoded by Name: ${venues[venue.name].lat}, ${venues[venue.name].lng}`);
                    }
                }

                // Rate limit for Nominatim (1s)
                await delay(1000);

            } catch (e) {
                console.error(`Error geocoding ${venue.name}`, e);
            }
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
    const stillMissing = Object.values(venues).filter(v => !v.address || v.address === '정보 없음' || !v.lat);
    console.log(`Still missing info: ${stillMissing.length}`);
}

enhanceVenues();
