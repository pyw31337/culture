import axios from 'axios';
import * as cheerio from 'cheerio';

async function getDaumHTML() {
    try {
        const url = 'https://movie.daum.net/premovie/released';
        console.log(`Fetching from ${url}`);
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0'
            }
        });

        const $ = cheerio.load(response.data);
        const movies: any[] = [];

        $('.item_poster').each((i, el) => {
            const title = $(el).find('.tit_item a').text().trim();
            const date = $(el).find('.txt_info .txt_num').text().trim();
            if (title) movies.push({ title, date });
        });

        console.log(`Found ${movies.length} movies on Daum HTML.`);
        console.log(movies.slice(0, 10));

    } catch (e) {
        console.error(e);
    }
}

getDaumHTML();
