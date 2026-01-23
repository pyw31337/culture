// Script to analyze district coverage in venues.json
const fs = require('fs');
const data = JSON.parse(fs.readFileSync('src/data/venues.json', 'utf8'));

const byRegion = {};

function getRegion(addr) {
    if (!addr) return 'unknown';
    if (addr.includes('서울')) return 'seoul';
    if (addr.includes('경기')) return 'gyeonggi';
    if (addr.includes('인천')) return 'incheon';
    if (addr.includes('부산')) return 'busan';
    if (addr.includes('대구')) return 'daegu';
    if (addr.includes('광주')) return 'gwangju';
    if (addr.includes('대전')) return 'daejeon';
    if (addr.includes('울산')) return 'ulsan';
    if (addr.includes('세종')) return 'sejong';
    if (addr.includes('강원')) return 'gangwon';
    if (addr.includes('충북') || addr.includes('충청북도')) return 'chungbuk';
    if (addr.includes('충남') || addr.includes('충청남도')) return 'chungnam';
    if (addr.includes('전북') || addr.includes('전라북도') || addr.includes('전북특별자치도')) return 'jeonbuk';
    if (addr.includes('전남') || addr.includes('전라남도')) return 'jeonnam';
    if (addr.includes('경북') || addr.includes('경상북도')) return 'gyeongbuk';
    if (addr.includes('경남') || addr.includes('경상남도')) return 'gyeongnam';
    if (addr.includes('제주')) return 'jeju';
    return 'unknown';
}

Object.values(data).forEach(v => {
    const addr = v.address || '';
    const region = getRegion(addr);

    if (!byRegion[region]) {
        byRegion[region] = { total: 0, withDistrict: 0, districts: new Set() };
    }
    byRegion[region].total++;
    if (v.district) {
        byRegion[region].withDistrict++;
        byRegion[region].districts.add(v.district);
    }
});

console.log('=== District Coverage by Region ===\n');
Object.entries(byRegion).sort((a, b) => b[1].total - a[1].total).forEach(([r, d]) => {
    const pct = d.total > 0 ? ((d.withDistrict / d.total) * 100).toFixed(1) : '0';
    console.log(`${r.padEnd(12)}: ${d.withDistrict}/${d.total} (${pct}%) - ${d.districts.size} unique districts`);
});

// Show sample districts for each region
console.log('\n=== Sample Districts by Region ===\n');
Object.entries(byRegion).forEach(([r, d]) => {
    if (d.districts.size > 0) {
        const samples = Array.from(d.districts).slice(0, 5).join(', ');
        console.log(`${r}: ${samples}`);
    }
});
