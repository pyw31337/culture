
const axios = require('axios');
const cheerio = require('cheerio');
const iconv = require('iconv-lite');
const fs = require('fs');
const path = require('path');

const REGIONS = {
    seoul: '42001',
    gyeonggi: '42010',
    incheon: '42011',
};


async function fetchPerformances(regionCode, regionName) {
    const url = `https://ticket.interpark.com/TiKi/Special/TPRegionReserve.asp?Region=${regionCode}`;

    try {
        const response = await axios.get(url, {
            responseType: 'arraybuffer',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            },
            timeout: 10000, // 10s timeout
        });

        const decoded = iconv.decode(response.data, 'euc-kr');
        const $ = cheerio.load(decoded);
        const performances = [];

        $('.obj').each((_, obj) => {
            const $obj = $(obj);
            const $genreAnchor = $obj.find('.obj_tit a');
            let genre = 'etc';
            if ($genreAnchor.length) {
                const name = $genreAnchor.attr('name') || '';
                const lowerName = name.toLowerCase();
                if (lowerName.includes('musical')) genre = 'musical';
                else if (lowerName.includes('concert')) genre = 'concert';
                else if (lowerName.includes('play')) genre = 'play';
                else if (lowerName.includes('classic')) genre = 'classic';
                else if (lowerName.includes('exhibit')) genre = 'exhibition';
                else if (lowerName.includes('theme') || lowerName.includes('kid')) genre = 'leisure';
            }

            $obj.find('.content').each((i, el) => {
                const $el = $(el);
                const $nameDd = $el.find('dd.name');
                const $titleLink = $nameDd.find('p.txt a');
                const title = $titleLink.text().trim();
                const href = $titleLink.attr('href') || '';
                const link = href.startsWith('http') ? href : `https://ticket.interpark.com${href}`;
                const $img = $nameDd.find('img');
                let image = $img.attr('src') || '';

                if (image.includes('/rz/image/play/goods/poster/')) {
                    image = image.replace('/rz/image/play/goods/poster/', '/Play/image/large/')
                        .replace('_p_s.jpg', '_p.gif');
                }
                if (image && image.startsWith('http://')) {
                    image = image.replace('http://', 'https://');
                }

                const idMatch = link.match(/GoodsCode=([A-Za-z0-9]+)/);
                let id = idMatch ? idMatch[1] : null;
                const venue = $el.find('dd.place').text().trim();
                const date = $el.find('dd.date').text().trim();

                if (!id && title) {
                    // Fallback: Deterministic Hash
                    const uniqueString = `${title}-${date}-${venue}`;
                    id = `unknown-${require('crypto').createHash('md5').update(uniqueString).digest('hex').substring(0, 8)}`;
                }

                if (title && id) {
                    performances.push({
                        id,
                        title,
                        image,
                        date,
                        venue,
                        link,
                        region: regionName, // Store dynamic region name
                        genre
                    });
                }
            });
        });

        return performances;
    } catch (error) {
        console.error(`Error fetching data for ${regionName} (${regionCode}):`, error.message);
        return [];
    }
}


async function getRegions() {
    console.log('Fetching region list...');
    // Fetch Seoul page to get the tab list
    const url = 'https://ticket.interpark.com/TiKi/Special/TPRegionReserve.asp?Region=42001';

    try {
        const response = await axios.get(url, {
            responseType: 'arraybuffer',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            },
            timeout: 10000,
        });

        const decoded = iconv.decode(response.data, 'euc-kr');
        console.log(`Response length: ${decoded.length}`);
        const $ = cheerio.load(decoded);
        const regions = [];


        // Helper to decode EUC-KR %-encoded string
        const decodeEucKrParam = (encoded) => {
            try {
                // Convert %XX to byte buffer
                const hex = encoded.replace(/%/g, '');
                const buffer = Buffer.from(hex, 'hex');
                return iconv.decode(buffer, 'euc-kr');
            } catch (e) {
                return null;
            }
        };

        // Selector provided by user: #wrapBody > div.sR_w726 > div.Rg_list > div.Rg_list_tab
        // We look for 'a' tags inside this
        $('.Rg_list_tab a').each((_, el) => {
            const $el = $(el);
            const href = $el.attr('href') || '';
            const regionMatch = href.match(/Region=(\d+)/);
            const nameMatch = href.match(/RegionName=([^&]+)/);

            if (regionMatch && nameMatch) {
                const code = regionMatch[1];
                let name = decodeEucKrParam(nameMatch[1]);

                if (name && name !== '전체') {
                    // Check duplicate
                    if (!regions.find(r => r.code === code)) {
                        regions.push({ name: name.trim(), code });
                    }
                }
            }
        });

        // Fallback: Broad search if specific selector failed
        if (regions.length === 0) {
            console.log('Strict selector failed, trying broader search with RegionName param...');
            $('a[href*="Region="]').each((_, el) => {
                const $el = $(el);
                const href = $el.attr('href') || '';
                const regionMatch = href.match(/Region=(\d+)/);
                const nameMatch = href.match(/RegionName=([^&]+)/);

                if (regionMatch && nameMatch) {
                    const code = regionMatch[1];
                    let name = decodeEucKrParam(nameMatch[1]);

                    // Ensure it looks like a navigation tab
                    if (name && name.length < 10 && !name.includes('booking') && name !== '전체') {
                        if (!regions.find(r => r.code === code)) {
                            regions.push({ name: name.trim(), code });
                        }
                    }
                }
            });
        }

        console.log(`Found ${regions.length} regions:`, regions.map(r => r.name).join(', '));
        return regions;

    } catch (error) {
        console.error('Error fetching region list:', error);
        return [
            { name: '서울', code: '42001' },
            { name: '경기', code: '42010' },
            { name: '인천', code: '42011' }
        ];
    }
}


async function run() {
    console.log('Starting dynamic Interpark scraper...');

    // 1. Get all regions from the main page tabs
    const regions = await getRegions();
    let allData = [];

    // 2. Iterate and scrape each region
    for (const region of regions) {
        console.log(`Fetching ${region.name} (${region.code})...`);
        const data = await fetchPerformances(region.code, region.name);
        console.log(`- Fetched ${data.length} items`);

        // Add to main collection
        allData = [...allData, ...data];

        // Polite delay
        await new Promise(resolve => setTimeout(resolve, 300));
    }

    // 3. Deduplicate (some items might appear in multiple regions if they are "All Regions" or major events)
    const pMap = new Map();
    allData.forEach(p => {
        // If duplicate, maybe keep the one with a more specific region if relevant? 
        // For now, first come first served usually works, but effectively we just want unique IDs.
        if (!pMap.has(p.id)) {
            pMap.set(p.id, p);
        }
    });
    const unique = Array.from(pMap.values());

    // 4. Save
    const outputPath = path.join(__dirname, '../src/data/interpark.json');
    fs.writeFileSync(outputPath, JSON.stringify(unique, null, 2));
    console.log(`Saved ${unique.length} unique items to ${outputPath}`);
}



run();
