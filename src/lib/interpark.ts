import axios from 'axios';
import * as cheerio from 'cheerio';
import iconv from 'iconv-lite';

export interface Performance {
  id: string;
  title: string;
  image: string;
  date: string;
  venue: string;
  link: string;
  region: string;
  genre: string;
}

const REGIONS: Record<string, string> = {
  seoul: '42001',
  gyeonggi: '42010',
  incheon: '42011',
};

export async function fetchPerformances(regionName: string = 'seoul'): Promise<Performance[]> {
  const regionCode = REGIONS[regionName.toLowerCase()] || REGIONS.seoul;
  // Using a specific user agent to avoid being blocked
  const url = `https://ticket.interpark.com/TiKi/Special/TPRegionReserve.asp?Region=${regionCode}`;

  try {
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });

    const decoded = iconv.decode(response.data, 'euc-kr');
    const $ = cheerio.load(decoded);

    const performances: Performance[] = [];

    // The selector needs to be adjusted based on the actual page structure.
    // Based on typical Interpark structures, items are often in tables or lists.
    // Let's assume a table structure based on the "Reserve" page analysis.
    // We look for elements that look like rows.

    // Inspecting the DOM dump or screenshot would be ideal.
    // Assuming standard structure for now:
    // .fw_bold is often used for titles in tables.

    // Let's try to find the main table container.
    // Usually table.bg_white or similar.

    // Correct selectors based on HTML analysis:
    // Items are in <div class="content">
    // DOM hierarchy:
    // div.content
    //   dl
    //     dd.name
    //       a (image link) -> img
    //       p.txt -> a (title link)
    //     dd.place -> a
    //     dd.date

    // We need to iterate over .obj elements.
    // Structure seems to be:
    // .obj
    //   .obj_tit -> anchor name="btn_genre_musical" etc.
    //   .Gp
    //     .content
    //     .content

    // Let's iterate over .obj divs
    $('.obj').each((_, obj) => {
      const $obj = $(obj);

      // Find genre from the title anchor
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
        // Interpark often groups Family/Child as 'theme' or 'kid'. Mapping to 'leisure' as requested if appropriate or 'etc'
      }

      // Iterate performances within this obj
      $obj.find('.content').each((i, el) => {
        const $el = $(el);
        const $nameDd = $el.find('dd.name');

        // Title
        const $titleLink = $nameDd.find('p.txt a');
        const title = $titleLink.text().trim();
        const href = $titleLink.attr('href') || '';
        // Fix: Check if href is absolute or relative
        const link = href.startsWith('http') ? href : `https://ticket.interpark.com${href}`;

        // Image
        const $img = $nameDd.find('img');
        let image = $img.attr('src') || '';

        // Upgrade Image URL to High Res if matching pattern
        // From: https://ticketimage.interpark.com/rz/image/play/goods/poster/25/25017371_p_s.jpg
        // To:   https://ticketimage.interpark.com/Play/image/large/25/25017371_p.gif
        if (image.includes('/rz/image/play/goods/poster/')) {
          image = image.replace('/rz/image/play/goods/poster/', '/Play/image/large/')
            .replace('_p_s.jpg', '_p.gif');
        }

        // ID
        const idMatch = link.match(/GoodsCode=(\d+)/);
        const id = idMatch ? idMatch[1] : `unknown-${Math.random().toString(36).substr(2, 9)}`;

        // Venue
        const venue = $el.find('dd.place').text().trim();

        // Date
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
