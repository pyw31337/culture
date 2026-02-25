const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '../src/data/venues.json');
const data = JSON.parse(fs.readFileSync(file, 'utf8'));

if (!data['한화생명이글스파크']) {
    data['한화생명이글스파크'] = {
        name: '한화생명이글스파크',
        address: '대전광역시 중구 대종로 373',
        district: '중구', // Daejeon Jung-gu
        lat: 36.3170,
        lng: 127.4292,
        mapped_region_id: 'daejeon'
    };
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
    console.log('Added 한화생명이글스파크');
} else {
    data['한화생명이글스파크'].lat = 36.3170;
    data['한화생명이글스파크'].lng = 127.4292;
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
    console.log('Updated 한화생명이글스파크');
}
