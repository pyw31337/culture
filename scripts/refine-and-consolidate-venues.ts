
import fs from 'fs';
import path from 'path';

const venueDictPath = path.join(process.cwd(), 'src', 'data', 'venue-dictionary.json');
const venueDict = JSON.parse(fs.readFileSync(venueDictPath, 'utf8')) as Record<string, any>;

function getDistanceFromLatLonInKm(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 6371; // Radius of the earth in km
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2)
        ;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const d = R * c; // Distance in km
    return d;
}

function deg2rad(deg: number) {
    return deg * (Math.PI / 180);
}

function cleanName(name: string): string {
    let clean = name;
    
    // 1. Remove leading (주), (주 ), ㈜, ㈜ 
    clean = clean.replace(/^[\(（]주[\)）]\s*/, '');
    clean = clean.replace(/\s*[\(（]주[\)）]$/, '');
    clean = clean.replace(/^㈜\s*/, '');
    clean = clean.replace(/\s*㈜$/, '');

    // 2. Remove bracketed prefixes like [경복궁], [연남], (홍대)
    clean = clean.replace(/^\[[^\]]+\]\s*/, '');
    clean = clean.replace(/^\([^)]+\)\s*/, '');
    
    // Extra specific clean for known patterns
    clean = clean.replace(/^[가-힣]+점\s+/, ''); // Remove leading "Branch Name " if at start? No, usually branch name is at the end.
    // e.g., '볼베어파크 은평점' -> keep as is.

    // 3. Remove common suffixes like 대극장, 소극장, etc.
    const suffixes = [
        '대극장', '소극장', '중극장', '대공연장', '소공연장', '야외무대', '야외공연장',
        '민속극장', '연지홀', '모악당', '사랑당', '대강당', '소강당', '전관', '본관', '별관'
    ];
    const suffixRegex = new RegExp(`\\s+(${suffixes.join('|')})$`);
    clean = clean.replace(suffixRegex, '');

    // 4. Remove numbered halls: 1관, 2관
    clean = clean.replace(/\s+제?\d+(관|전시장|홀|호)?$/, '');

    return clean.trim();
}

function isValidRepresentative(name: string): boolean {
    const blackList = ['내 위치', '정보 없음', 'Unknown', '테스트', '임시'];
    return !blackList.some(b => name.includes(b));
}

console.log('Starting Venue Refinement and Consolidation...');

// Phase 1: Clean all names
const allVenueEntries = Object.entries(venueDict).map(([id, data]) => ({
    id,
    ...data,
    cleanedName: cleanName(data.name || id)
}));

// Phase 2: Group by coordinate proximity (and address)
const RADIUS_KM = 0.1; // 100 meters
const visited = new Set<string>();
let consolidatedCount = 0;
let nameCleanedCount = 0;

const DEFAULT_LATS = new Set([37.5665, 37.573, 37.5172, 37.5637, 37.5145, 37.5509, 37.5264, 37.4837]);

for (let i = 0; i < allVenueEntries.length; i++) {
    if (visited.has(allVenueEntries[i].id)) continue;
    
    const group = [allVenueEntries[i]];
    visited.add(allVenueEntries[i].id);
    
    if (allVenueEntries[i].lat && allVenueEntries[i].lng) {
        const isDefaultCoordI = DEFAULT_LATS.has(Number(allVenueEntries[i].lat.toFixed(4)));

        for (let j = i + 1; j < allVenueEntries.length; j++) {
            if (visited.has(allVenueEntries[j].id)) continue;
            
            let shouldMerge = false;
            
            // Check exact address match (Strongest signal)
            if (allVenueEntries[i].address && allVenueEntries[i].address === allVenueEntries[j].address) {
                if (!allVenueEntries[i].address.includes('정보 없음')) {
                    shouldMerge = true;
                }
            }
            
            // Check coordinate distance (Only if NOT default coordinates)
            if (!shouldMerge && allVenueEntries[j].lat && allVenueEntries[j].lng) {
                const isDefaultCoordJ = DEFAULT_LATS.has(Number(allVenueEntries[j].lat.toFixed(4)));
                
                if (!isDefaultCoordI && !isDefaultCoordJ) {
                    const dist = getDistanceFromLatLonInKm(
                        allVenueEntries[i].lat, 
                        allVenueEntries[i].lng, 
                        allVenueEntries[j].lat, 
                        allVenueEntries[j].lng
                    );
                    if (dist <= RADIUS_KM) shouldMerge = true;
                }
            }
            
            if (shouldMerge) {
                group.push(allVenueEntries[j]);
                visited.add(allVenueEntries[j].id);
            }
        }
    }
    
    // Pick the shortest cleaned name as the representative (avoiding blacklisted names)
    const validNames = group.filter(v => isValidRepresentative(v.cleanedName));
    const representativeName = validNames.length > 0 
        ? validNames.reduce((prev, curr) => 
            prev.cleanedName.length <= curr.cleanedName.length ? prev : curr
          ).cleanedName
        : group.reduce((prev, curr) => 
            prev.cleanedName.length <= curr.cleanedName.length ? prev : curr
          ).cleanedName;
    
    if (group.length > 1) {
        consolidatedCount += (group.length - 1);
        // console.log(`[MERGE] Group: ${group.map(v => v.id).join(', ')} -> ${representativeName}`);
    }

    // Apply representative name to all in group
    group.forEach(v => {
        if (venueDict[v.id].refined_name !== representativeName) {
            venueDict[v.id].refined_name = representativeName;
            nameCleanedCount++;
        }
    });
}

// Phase 3: Final District Check (ensure no blanks)
const SIGUNGU_SUFFIXES = ['시', '군', '구'];
let districtFixedCount = 0;

for (const [id, venue] of Object.entries(venueDict as Record<string, any>)) {
    if (!venue.district || venue.district === '') {
        const address = venue.address || '';
        const match = address.match(/([가-힣]+[구군시])\s/) || address.match(/([가-힣]+[구군시])$/);
        if (match) {
            venue.district = match[1];
            districtFixedCount++;
        }
    }
}

// Save result
fs.writeFileSync(venueDictPath, JSON.stringify(venueDict, null, 2));

console.log('\n=========================================');
console.log('  Venue Refinement Results');
console.log('=========================================');
console.log(`📊 Total venues processed: ${allVenueEntries.length}`);
console.log(`✨ Names cleaned/updated: ${nameCleanedCount}`);
console.log(`🔗 Venues consolidated: ${consolidatedCount} duplicates handled`);
console.log(`📍 Districts repaired: ${districtFixedCount}`);
console.log('=========================================\n');
