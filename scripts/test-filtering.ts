
const fs = require('fs');
const path = require('path');

const timeticketData = require('../src/data/timeticket.json');

const selectedGenre = 'hotdeal';

const filtered = timeticketData.filter(p => {
    // 2. Genre Filter
    if (selectedGenre === 'hotdeal') {
        // Logic from PerformanceList.tsx
        if (!p.discount && !p.price) return false;
        return true;
    } else if (selectedGenre !== 'all' && p.genre !== selectedGenre) return false;

    return true;
});

console.log(`Total TimeTicket items: ${timeticketData.length}`);
console.log(`Filtered 'hotdeal' items: ${filtered.length}`);

if (filtered.length === 0) {
    console.log("FAIL: No items found in Hot Deal.");
    console.log("Sample item discount:", timeticketData[0].discount);
    console.log("Sample item price:", timeticketData[0].price);
} else {
    console.log("PASS: Items found.");
    console.log("Sample filtered item:", filtered[0].title);
}
