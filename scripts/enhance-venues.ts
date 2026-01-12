
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
        headless: true,
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

                // 2. Search specific filtered areas if place section not found
                // Only look in main content areas, excluding footers/headers
                const mainContent = document.querySelector('#main_pack') || document.querySelector('#content') || document.body;

                // Helper to check if element is inside footer
                const isFooter = (el: Element | null) => {
                    while (el) {
                        if (el.tagName === 'FOOTER' || el.classList.contains('footer') || el.id.includes('footer')) return true;
                        el = el.parentElement;
                    }
                    return false;
                };

                // Try to find address in specific classes across valid main content
                const candidates = Array.from(document.querySelectorAll('.addr, .address, .txt_addr'));
                for (const cand of candidates) {
                    if (!isFooter(cand) && cand.textContent) {
                        const match = cand.textContent.match(addressRegex);
                        if (match) return { addr: match[0] };
                    }
                }

                // If still nothing, match text in main_pack only
                if (mainContent) {
                    const text = (mainContent as HTMLElement).innerText;
                    // Use a more strict regex that looks for "주소" label if possible, or just the pattern but check duplicates
                    // The footer often has "사업자 주소" etc.
                    // Let's assume the earlier selectors catch the best ones.
                    // If we rely on regex, we must ensure it's not the generic footer one.

                    // Find all matches
                    const matches = text.match(new RegExp(addressRegex, 'g'));
                    if (matches && matches.length > 0) {
                        // Return the first one that usually appears in the "place" card at top
                        // But this is risky if the ad is at top.
                        // Let's rely on the first loop mainly.
                        // If we fail, return null rather than wrong address.
                        return null;
                    }
                }

                return null;

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

                    // 0. Ignore List
                    const ignoreList = ['츠쿠바 역', '일본'];
                    if (ignoreList.some(k => venue.name.includes(k))) {
                        console.log(`   🚫 Creating Hidden/Ignored Venue: ${venue.name}`);
                        // Optionally mark as hidden in JSON if schema supports it, or just skip
                        // For now we skip geocoding attempts to save time
                        continue;
                    }

                    // Cleaning Function
                    const cleanVenueName = (raw: string) => {
                        let c = raw;
                        // Remove Prefixes
                        c = c.replace(/▶\s*만남의\s*장소\s*[:]?/g, '').replace(/^주소:\s*/, '');

                        // Remove Parentheses and their content (often details)
                        c = c.replace(/\([^)]+\)/g, ' ');

                        // Remove specific noise phrases provided by user or inferred
                        const noisePatterns = [
                            /로비/g, /역사관/g, /출구/g, /정문/g, /매표소/g, /동상/g,
                            /물품보관함/g, /안내데스크/g, /뮤지엄샵/g, /전시관/g, /상설전시[실관]/g,
                            /세계문화관/g, /교육관/g, /본관/g, /제\d+관/g,
                            /\d+층/g, /지하\s*\d+층/g, /\d+번/g,
                            /내(?!\S)/g, /內/g, /앞(?!\S)/g, // "내", "앞" as standalone words
                            /주차장/g, /스퀘어/g, /－경기/g
                        ];

                        noisePatterns.forEach(p => c = c.replace(p, ' '));

                        // Special replacements for complex cases (User specific requests)
                        if (c.includes('광화문') && c.includes('광장')) c = '광화문광장';
                        if (c.includes('세종대왕')) c = '광화문광장'; // Sejong statue is in Gwanghwamun Square

                        // Cleanup spaces
                        return c.trim().replace(/\s+/g, ' ');
                    };

                    // Strategy 1: Use the cleaned name
                    let cleanedName = cleanVenueName(venue.name);

                    // Manual Overrides (User Request + Stubborn)
                    const manualMaps: Record<string, string> = {
                        "킨텍스 6홀": "킨텍스",
                        "국립중앙박물관 1층(내부)-검색대 통과하자마자 오른쪽에 보이는 에스컬레이터 앞": "국립중앙박물관",
                        "경복궁 광화문 앞 오른쪽 해태상 앞(광화문을 바라본 상태에서 오른쪽)": "경복궁 광화문",
                        "국립중앙과학관 한국과학기술사관": "국립중앙과학관",
                        "상암 월드컵경기장 평화의광장": "서울월드컵경기장",
                        "이화여자대학교 생활환경관 소극장": "이화여자대학교 생활환경관",
                        "덕스(DUEX) 홍대 2관": "덕스 홍대",
                        "나루아트센터 소공연장": "나루아트센터",
                        "아트팩토리참기름 강화": "아트팩토리참기름",
                        "디아나아트홀 (디아나수풀 內)": "디아나아트홀",
                        "서울역사박물관 1층 로비": "서울역사박물관",
                        "해당공연 공연장－경기": "경기아트센터",
                        "서대문형무소 역사관 입구": "서대문형무소역사관",
                        "▶만남의 장소 : 서대문형무소역사관 입구 앞 (자세한 안내는 수업전 담당 강사님이 안내드립니다.)": "서대문형무소역사관",
                        "서대문형무소역사관 정문 앞": "서대문형무소역사관",
                        "각 궁궐의 정문 앞": "경복궁",
                        "법원전시관": "대법원",
                        "토즈 광화문점(스터디카페)인원에 따라 별도 추가 공지 드립니다.": "서울 종로구 새문안로3길 15",
                        "국립 대한민국임시정부 기념관": "국립대한민국임시정부기념관",
                        "임진각 평화의 공원": "임진각",
                        "전쟁기념관/국립중앙박물관/대한민국역사박물관": "전쟁기념관",
                        "주소: 대구 달성군 유가읍 테크노대로6길 20 국립대구과학관 본관 1층 상설전시 1관에서 집결": "국립대구과학관",
                        "국립경주박물관 내 물품보관함 앞": "국립경주박물관",
                        "베리컴퍼니": "경기도 고양시 일산동구 위시티3로 52"
                    };

                    // Check manual map first
                    for (const key in manualMaps) {
                        if (venue.name.includes(key)) {
                            cleanedName = manualMaps[key];
                            break;
                        }
                    }

                    // Specific fix for "불국사" hidden in long text (Item 57)
                    if (venue.name.includes('불국사') && venue.name.length > 20) cleanedName = '불국사';

                    console.log(`   -> Cleaning Name: "${venue.name}" => "${cleanedName}"`);

                    const tryGeocodeName = async (n: string) => {
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

                    let nameResult = await tryGeocodeName(cleanedName);

                    if ((!nameResult || nameResult.length === 0) && cleanedName.includes(' ')) {
                        // Fallback: Try even shorter (first word?)
                        // Only if reasonable length
                        const split = cleanedName.split(' ');
                        if (split.length > 1 && split[0].length > 2) {
                            console.log(`   -> Retrying with first word: ${split[0]}`);
                            nameResult = await tryGeocodeName(split[0]);
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
