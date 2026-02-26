const fs = require('fs');

const class1 = JSON.parse(fs.readFileSync('src/data/sssd-class.json'));
const class2 = JSON.parse(fs.readFileSync('src/data/umclass.json'));
const class3 = JSON.parse(fs.readFileSync('src/data/mochaclass.json'));

const allRawClasses = [...class1, ...class2, ...class3].filter(p => p.genre === 'class');
const venues = JSON.parse(fs.readFileSync('src/data/venues.json'));

let missingSamples = [];

for (const p of allRawClasses) {
    const v = venues[p.venue];
    // 매핑이 안되어 있거나, 좌표가 없거나, 주소가 '정보 없음'인 경우 
    if (!v || !v.address || v.address === '정보 없음' || !v.lat || !v.lng) {
        missingSamples.push({
            title: p.title,
            venue_keyword: (p.address && p.address !== p.venue) ? `${p.venue} (추가주소: ${p.address})` : p.venue,
            source: p.source || 'unknown'
        });
        if (missingSamples.length >= 10) break; // 10개만 추출
    }
}

console.log(JSON.stringify(missingSamples, null, 2));

