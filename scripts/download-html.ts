import axios from 'axios';
import iconv from 'iconv-lite';
import fs from 'fs';

async function downloadHtml() {
    const url = 'https://ticket.interpark.com/TiKi/Special/TPRegionReserve.asp?Region=42001';
    console.log('Downloading HTML from', url);

    const response = await axios.get(url, {
        responseType: 'arraybuffer',
        headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
    });

    const decoded = iconv.decode(response.data, 'euc-kr');
    fs.writeFileSync('seoul_page.html', decoded);
    console.log('Saved to seoul_page.html');
}

downloadHtml();
