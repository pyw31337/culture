import fs from 'fs';
import path from 'path';
import axios from 'axios';

const MUSEUM_DATA_PATH = path.resolve(process.cwd(), 'src/data/museum.json');
const VENUES_PATH = path.resolve(process.cwd(), 'src/data/venues.json');

// Direct download URL discovered via browser subagent
const DATA_URL = 'https://www.data.go.kr/download/standard.json?publicDataPk=15017323&colNmList=FCLTY_NM&colNmList=FCLTY_TYPE&colNmList=RDNMADR&colNmList=LNMADR&colNmList=LATITUDE&colNmList=LONGITUDE&colNmList=OPER_PHONE_NUMBER&colNmList=OPER_INSTITUTION_NM&colNmList=HOMEPAGE_URL&colNmList=FCLTY_INFO&colNmList=WEEKDAY_OPER_OPEN_HHMM&colNmList=WEEKDAY_OPER_COLSE_HHMM&colNmList=HOLIDAY_OPER_OPEN_HHMM&colNmList=HOLIDAY_CLOSE_OPEN_HHMM&colNmList=RSTDE_INFO&colNmList=ADULT_CHRGE&colNmList=YNGBGS_CHRGE&colNmList=CHILD_CHRGE&colNmList=ETC_CHRGE_INFO&colNmList=FCLTY_INTRCN&colNmList=TRNSPORT_INFO&colNmList=PHONE_NUMBER&colNmList=INSTITUTION_NM&colNmList=REFERENCE_DATE&totalCount=2230&svcTableNm=tn_pubr_public_museum_artgr_info_svc&perPage=10000&page=1';

async function supplementMuseums() {
    console.log('Fetching museum data from direct JSON URL...');
    
    try {
        const response = await axios.get(DATA_URL, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'application/json'
            }
        });

        const apiItems = response.data || [];
        console.log(`Fetched ${apiItems.length} items from data source.`);

        if (!Array.isArray(apiItems)) {
            console.error('Data is not an array. Check URL or response structure.');
            return;
        }

        const localData = JSON.parse(fs.readFileSync(MUSEUM_DATA_PATH, 'utf-8'));
        const venues = JSON.parse(fs.readFileSync(VENUES_PATH, 'utf-8'));
        let updatedCount = 0;

        for (const localItem of localData) {
            // Find match in API results
            const match = apiItems.find((api: any) => {
                const apiName = (api.FCLTY_NM || '').replace(/\s/g, '');
                const localName = localItem.title.replace(/\s/g, '');
                return apiName.includes(localName) || localName.includes(apiName);
            });

            if (match) {
                const newAddress = match.RDNMADR || match.LNMADR;
                const lat = parseFloat(match.LATITUDE);
                const lng = parseFloat(match.LONGITUDE);
                
                if (newAddress && !isNaN(lat) && !isNaN(lng)) {
                    localItem.address = newAddress;
                    localItem.lat = lat;
                    localItem.lng = lng;
                    
                    // Sync with venues.json
                    venues[localItem.title] = {
                        name: localItem.title,
                        address: newAddress,
                        lat: lat,
                        lng: lng,
                        district: newAddress.split(' ')[1] || ''
                    };
                    updatedCount++;
                }
            }
        }

        // Final cleanup for messy addresses
        const cleanedData = localData.map((m: any) => {
            if (m.address && (m.address.includes('Keep') || m.address.includes('블로그') || m.address.length > 100)) {
                return { ...m, address: '' };
            }
            return m;
        });

        fs.writeFileSync(MUSEUM_DATA_PATH, JSON.stringify(cleanedData, null, 2));
        fs.writeFileSync(VENUES_PATH, JSON.stringify(venues, null, 2));
        
        console.log(`Updated ${updatedCount} museums and synced with venues.json.`);

    } catch (error: any) {
        console.error('Error fetching Museum data:', error.message);
    }
}

supplementMuseums();
