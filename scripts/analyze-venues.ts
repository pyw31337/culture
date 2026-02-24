
import fs from 'fs';
import path from 'path';

const VENUE_FILE = path.join(process.cwd(), 'src/data/venues.json');

interface Venue {
    name: string;
    address: string;
    lat?: number;
    lng?: number;
    district?: string;
}

function analyze() {
    const venues: Record<string, Venue> = JSON.parse(fs.readFileSync(VENUE_FILE, 'utf-8'));
    const foreignKeywords = ['싱가포르', '오키나와', '베트남', '다낭', '나트랑', '푸꾸옥', '일본', '도쿄', '오사카', '후쿠오카', '미국', '괌', '사이판', '유럽', '태국', '방콕', '치앙마이', '필리핀', '세부', '보라카이'];
    const total = Object.keys(venues).length;
    let geocoded = 0;
    let missingInfo = 0;
    const missingList: Venue[] = [];
    let foreignCount = 0;
    const foreignList: Venue[] = [];

    const items = Object.values(venues);
    for (const v of items) {
        if (v.lat && v.lng) {
            geocoded++;
        } else {
            missingList.push(v);
        }

        if (v.address === '정보 없음') missingInfo++;

        // Check for foreign
        if (foreignKeywords.some(k => v.address.includes(k) || v.name.includes(k))) {
            foreignCount++;
            foreignList.push(v);
        }
    }

    const percentage = ((geocoded / total) * 100).toFixed(1);

    console.log(`### 📊 Final Data Quality Report`);
    console.log(`| Metric | Count | Percentage |`);
    console.log(`| :--- | :--- | :--- |`);
    console.log(`| **Total Venues** | **${total}** | 100% |`);
    console.log(`| ✅ **Complete (Coords + Addr)** | **${geocoded}** | **${percentage}%** |`);
    console.log(`| ❌ **Missing Coords** | ${total - geocoded} | ${(100 - parseFloat(percentage)).toFixed(1)}% |`);
    console.log(`| ⚠️ **No Address Info** | ${missingInfo} | - |`);
    console.log(`| 🌏 **Foreign Venues (Detected)** | ${foreignCount} | - |`);

    if (foreignCount > 0) {
        console.log(`\n### 🌏 Foreign Venue Sample`);
        foreignList.slice(0, 10).forEach(v => console.log(`- ${v.name} (${v.address})`));
    }

    console.log(`\n### 📝 Remaining Missing Data Sample (Top 10)`);
    missingList.slice(0, 10).forEach(v => {
        console.log(`- ${v.name} (Addr: ${v.address})`);
    });
}

analyze();
