import fs from 'fs';
import path from 'path';
import axios from 'axios';
import pLimit from 'p-limit';

const KAKAO_API_KEY = 'e18ee199818819d830c3fe479aa1ca71';
const DATA_DIR = path.join(process.cwd(), 'src/data');
const VENUES_PATH = path.join(DATA_DIR, 'venues.json');
const REPORT_PATH = path.join(process.cwd(), 'unmatched_sports_venues.json');

const SPORTS_FILES = [
    { file: 'kbo.json', sport: 'baseball' },
    { file: 'kovo.json', sport: 'volleyball' },
    { file: 'kbl.json', sport: 'basketball' },
    { file: 'wkbl.json', sport: 'basketball' },
    { file: 'kleague.json', sport: 'soccer' },
    { file: 'handball.json', sport: 'handball' }
];

async function searchKakao(query: string, sport: string) {
    // Some basic keyword enhancements if needed
    let searchQuery = query;
    if (sport === 'basketball' && !query.includes('체육관') && !query.includes('아레나') && !query.includes('학생')) {
        searchQuery += '체육관';
    } else if (sport === 'volleyball' && !query.includes('체육관') && !query.includes('스타디움') && !query.includes('기념관')) {
        searchQuery += '체육관';
    } else if (sport === 'baseball' && !query.includes('야구장') && !query.includes('파크') && !query.includes('필드') && !query.includes('돔')) {
        searchQuery += '야구장';
    } else if (sport === 'soccer' && !query.includes('경기장') && !query.includes('운동장') && !query.includes('스타디움') && !query.includes('파크')) {
        searchQuery += '축구경기장';
    }

    try {
        let res = await axios.get('https://dapi.kakao.com/v2/local/search/keyword.json', {
            headers: { Authorization: `KakaoAK ${KAKAO_API_KEY}` },
            params: { query: searchQuery, size: 1 }
        });

        if (res.data.documents && res.data.documents.length > 0) {
            const doc = res.data.documents[0];
            return {
                official_name: doc.place_name,
                address: doc.road_address_name || doc.address_name,
                lat: parseFloat(doc.y),
                lng: parseFloat(doc.x)
            };
        }

        // Try original query if enhanced failed
        if (searchQuery !== query) {
            res = await axios.get('https://dapi.kakao.com/v2/local/search/keyword.json', {
                headers: { Authorization: `KakaoAK ${KAKAO_API_KEY}` },
                params: { query: query, size: 1 }
            });
            if (res.data.documents && res.data.documents.length > 0) {
                const doc = res.data.documents[0];
                return {
                    official_name: doc.place_name,
                    address: doc.road_address_name || doc.address_name,
                    lat: parseFloat(doc.y),
                    lng: parseFloat(doc.x)
                };
            }
        }
        return null;
    } catch (e: any) {
        return null;
    }
}

async function run() {
    console.log('🚀 Checking Sports Venues...');

    let existingVenues: Record<string, any> = {};
    if (fs.existsSync(VENUES_PATH)) {
        existingVenues = JSON.parse(fs.readFileSync(VENUES_PATH, 'utf-8'));
    }

    const uniqueVenues = new Map<string, string>(); // venue -> sport

    // 1. Collect all venues
    for (const { file, sport } of SPORTS_FILES) {
        const filePath = path.join(DATA_DIR, file);
        if (fs.existsSync(filePath)) {
            const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
            data.forEach((item: any) => {
                if (item.venue) {
                    uniqueVenues.set(item.venue.trim(), sport);
                }
            });
        }
    }

    console.log(`Found ${uniqueVenues.size} unique sports venues.`);

    const limit = pLimit(5);
    const unmatched: any[] = [];
    let successCount = 0;

    const tasks = Array.from(uniqueVenues.entries()).map(([venue, sport]) => limit(async () => {
        // If it already has good lat/lng, we still might want to ensure it has an official name?
        // User asked to "collect official names and match them". So let's run API for all if they don't have official_name or lat/lng.
        // Wait, existing venues.json doesn't typically store 'official_name', it stores 'name'.

        let needSearch = false;
        if (!existingVenues[venue] || !existingVenues[venue].lat || !existingVenues[venue].lng) {
            needSearch = true;
        }

        if (needSearch) {
            await new Promise(r => setTimeout(r, 200)); // rate limit
            const result = await searchKakao(venue, sport);
            if (result) {
                // Determine district from address
                const addrParts = result.address.split(' ');
                let district = '';
                if (addrParts.length > 1) {
                    // usually "Seoul Gangnam-gu ..."
                    if (addrParts[1].endsWith('구') || addrParts[1].endsWith('시') || addrParts[1].endsWith('군')) {
                        district = addrParts[1];
                    }
                }

                existingVenues[venue] = {
                    ...(existingVenues[venue] || {}),
                    name: venue,
                    official_name: result.official_name,
                    address: result.address,
                    district: district,
                    lat: result.lat,
                    lng: result.lng
                };
                successCount++;
                console.log(`✅ ${venue} -> ${result.official_name}`);
            } else {
                unmatched.push({ sport, venue });
                console.log(`❌ Failed: ${venue} (${sport})`);
            }
        } else {
            // Already has coordinates. Let's just retrieve official name if we can, 
            // but to save API calls, we might skip if we just want coordinates.
            // But user explicitly asked for official names. Let's do it if 'official_name' is missing.
            if (!existingVenues[venue].official_name) {
                await new Promise(r => setTimeout(r, 200));
                const result = await searchKakao(venue, sport);
                if (result) {
                    existingVenues[venue].official_name = result.official_name;
                    if (!existingVenues[venue].address) existingVenues[venue].address = result.address;
                    console.log(`🔄 Updated Official Name: ${venue} -> ${result.official_name}`);
                    successCount++;
                } else {
                    unmatched.push({ sport, venue });
                    console.log(`❌ Failed Official Name: ${venue} (${sport})`);
                }
            } else {
                console.log(`⏭️ Skipped (already has coords & official name): ${venue}`);
            }
        }
    }));

    await Promise.all(tasks);

    fs.writeFileSync(VENUES_PATH, JSON.stringify(existingVenues, null, 2));
    console.log(`\n💾 Saved updated venues to ${VENUES_PATH} (Updated ${successCount} entries)`);

    if (unmatched.length > 0) {
        fs.writeFileSync(REPORT_PATH, JSON.stringify(unmatched, null, 2));
        console.log(`\n⚠️ Found ${unmatched.length} unmatched venues. Saved to ${REPORT_PATH}`);
        console.table(unmatched);
    } else {
        console.log('\n🎉 All sports venues successfully matched and coordinates found!');
    }
}

run();
