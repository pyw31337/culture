
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

                // Iterative Geocoding: Strip last word until success
                let currentSearchAddr = cleanAddr;
                let foundCoords = false;

                // Loop while we have at least 2 words (to avoid searching just "Seoul" or "Gyeonggi")
                while (currentSearchAddr.trim().split(/\s+/).length >= 2) {
                    const query = encodeURIComponent(currentSearchAddr);
                    const geoUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${query}&limit=1`;
                    console.log(`   -> Geocoding attempt: ${currentSearchAddr}`);

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
                        foundCoords = true;
                        break; // Success!
                    }

                    // Failed, strip last word
                    const lastSpaceIndex = currentSearchAddr.lastIndexOf(' ');
                    if (lastSpaceIndex === -1) break; // Should be handled by while condition but safety check

                    const nextAddr = currentSearchAddr.substring(0, lastSpaceIndex).trim();
                    if (nextAddr === currentSearchAddr) break; // Infinite loop protection
                    currentSearchAddr = nextAddr;

                    // Rate limit for Nominatim (1s) between tries
                    await delay(1000);
                }

                if (!foundCoords) {
                    console.log(`   ❌ Geocode Failed for all attempts starting from: ${cleanAddr}`);
                    // Fallback: Try searching by Name (as last resort)
                    // ... existing name search logic ...
                } else {
                    // Success case already handled break
                }

                if (!foundCoords) {
                    // Fallback: Try searching by Name
                    let nameQueryStr = venue.name;
                    // Strategy 1: Remove parentheses and content inside
                    nameQueryStr = nameQueryStr.replace(/\(.*\)/g, '').trim();

                    // Strategy 2: Remove common noise words if they are at the end (Hall, Art Hall, Theater, Center, etc.)

                    const tryGeocodeName = async (n: string) => {
                        console.log(`   -> Geocoding by Name: ${n}`);
                        const q = encodeURIComponent(n);
                        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${q}&limit=1`;
                        const res: any = await page.evaluate(async (u) => {
                            try {
                                const r = await fetch(u, { headers: { 'User-Agent': 'CultureFlow/1.0' } });
                                return await r.json();
                            } catch (e) { return []; }
                        }, url);
                        return res;
                    };

                    let nameResult = await tryGeocodeName(venue.name); // Original name

                    if (!nameResult || nameResult.length === 0) {
                        // Try without parentheses
                        const cleanName = venue.name.replace(/\([^)]+\)/g, '').trim();
                        if (cleanName !== venue.name) {
                            nameResult = await tryGeocodeName(cleanName);
                        }
                    }

                    if (!nameResult || nameResult.length === 0) {
                        // Try removing specific details like "Hall", "theater", "1F", "Lobby", "Square"
                        // Regex to match "Hall X", "X Hall", "Theater", "Center", etc at the end or specific words
                        // Targeted removal for known patterns in failure list
                        let cleanName = venue.name.replace(/\([^)]+\)/g, '').trim(); // start clean

                        // Remove "1F", "2F", "B1", "Lobby", "roby"
                        cleanName = cleanName.replace(/\s?\d+[F층]\s?/gi, '').replace(/\s?B\d+\s?/gi, '').replace(/\s?로비\s?/g, '').trim();

                        // Remove "Hall", "Art Hall", "Theater", "Center" ONLY if it looks like a suffix to a main name
                        // e.g. "Kintex Hall 6" -> "Kintex"
                        // Heuristic: If name is long, and ends with "Hall", "Theater", etc., stripping it might help finding the building.
                        // Common Korean suffixes: "홀", "극장", "센터", "전시장", "공연장", "아트홀"
                        // We will try stripping the last word if it matches these patterns

                        const suffixRegex = /(\s+\S*(홀|극장|센터|전시장|공연장|아트홀|체육관|경기장|박물관|미술관|기념관))$/;
                        const match = cleanName.match(suffixRegex);
                        if (match) {
                            const strippedName = cleanName.replace(suffixRegex, '').trim();
                            if (strippedName.length > 2) { // Ensure we don't reduce to empty or too short
                                nameResult = await tryGeocodeName(strippedName);
                            }
                        }
                    }

                    if (nameResult && nameResult.length === 0) {
                        // Specific manual mapping for known stubborn venues
                        const stubbornMap: Record<string, string> = {
                            "킨텍스 6홀": "킨텍스",
                            "국립중앙박물관 1층(내부)-검색대 통과하자마자 오른쪽에 보이는 에스컬레이터 앞": "국립중앙박물관",
                            "경복궁 광화문 앞 오른쪽 해태상 앞(광화문을 바라본 상태에서 오른쪽)": "경복궁 광화문",
                            "국립중앙과학관 한국과학기술사관": "국립중앙과학관",
                            "상암 월드컵경기장 평화의광장": "서울월드컵경기장",
                            "임진각 평화의 공원": "임진각평화누리공원",
                            "화성행궁 신풍루 매표소 앞": "화성행궁"
                        };

                        // Check partial match in stubborn map keys or values
                        for (const key in stubbornMap) {
                            if (venue.name.includes(key) || key.includes(venue.name)) {
                                nameResult = await tryGeocodeName(stubbornMap[key]);
                                if (nameResult && nameResult.length > 0) break;
                            }
                        }
                    }

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
