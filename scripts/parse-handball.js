const fs = require('fs');
const cheerio = require('cheerio');
const html = fs.readFileSync('handball-debug.html', 'utf8');
const $ = cheerio.load(html);
$('table tbody tr').slice(0, 3).each((i, el) => {
    const tds = $(el).find('td');
    console.log(`Row ${i} length: ${tds.length}`);
    tds.each((j, td) => console.log(`  td[${j}]: ${$(td).text().replace(/\\s+/g, ' ').trim()}`));
});
