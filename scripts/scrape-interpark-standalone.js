
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

async function fetchPerformances(regionName) {
    const regionCode = REGIONS[regionName.toLowerCase()] || REGIONS.seoul;
    const url = `https://ticket.interpark.com/TiKi/Special/TPRegionReserve.asp?Region=${regionCode}`;

    try {
        const response = await axios.get(url, {
            responseType: 'arraybuffer',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            },
            timeout: 10000,
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

                const idMatch = link.match(/GoodsCode=(\d+)/);
                const id = idMatch ? idMatch[1] : `unknown-${Math.random().toString(36).substr(2, 9)}`;
                const venue = $el.find('dd.place').text().trim();
                const date = $el.find('dd.date').text().trim();

                if (title) {
                    performances.push({
                        id,
                        title,
                        image,
                        date,
                        venue,
                        link,
                        region: regionName,
                        genre
                    });
                }
            });
        });

        return performances;
    } catch (error) {
        console.error(`Error fetching data for ${regionName}:`, error);
        return [];
    }
}

async function run() {
    console.log('Starting standalone scraper...');
    let allData = [];
    for (const region of ['seoul', 'gyeonggi', 'incheon']) {
        console.log(`Fetching ${region}...`);
        const data = await fetchPerformances(region);
        console.log(`Fetched ${data.length} items`);
        allData = [...allData, ...data];
    }

    // Deduplicate
    const pMap = new Map();
    allData.forEach(p => pMap.set(p.id, p));
    const unique = Array.from(pMap.values());

    fs.writeFileSync('src/data/interpark.json', JSON.stringify(unique, null, 2));
    console.log(`Saved ${unique.length} items to src/data/interpark.json`);
}

run();
