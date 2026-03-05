import axios from 'axios';
import * as cheerio from 'cheerio';

async function testKobisPost() {
    const url = 'https://www.kobis.or.kr/kobis/business/mast/mvie/findOpenScheduleList.do';

    // Trying to get March 2026 data
    const data = new URLSearchParams({
        sPrevMonth: '',
        openDt: '', // This usually takes specific dates, let's try leaving it blank or passing a month
        sOpenYear: '2026',
        sOpenMonth: '03'
    });

    try {
        const response = await axios.post(url, data.toString(), {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'User-Agent': 'Mozilla/5.0'
            }
        });

        const $ = cheerio.load(response.data);
        const movies: any[] = [];

        // Let's print out what elements with class 'cal_date' or 'schedule' exist
        $('.cal td').each((i, el) => {
            const date = $(el).find('strong').text().trim();
            $(el).find('li a').each((_, a) => {
                const title = $(a).attr('title') || $(a).text().trim();
                if (title && date) {
                    movies.push({ date: `2026-03-${date.padStart(2, '0')}`, title });
                }
            });
        });

        console.log(`Found ${movies.length} movies in Mar 2026`);
        console.log(movies.slice(0, 10));

    } catch (e) {
        console.error(e);
    }
}

testKobisPost();
