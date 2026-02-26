import fs from 'fs';
import path from 'path';

const teams = {
    "인천": "인천 유나이티드 FC",
    "서울": "FC 서울",
    "울산": "울산 HD FC",
    "강원": "강원 FC",
    "안산": "안산 그리너스 FC",
    "김천": "김천 상무 FC",
    "포항": "포항 스틸러스",
    "수원": "수원 삼성 블루윙즈",
    "서울E": "서울 이랜드 FC",
    "전북": "전북 현대 모터스",
    "부천": "부천 FC 1995",
    "용인": "용인 FC",
    "천안": "천안 시티 FC",
    "대구": "대구 FC",
    "화성": "화성 FC",
    "충북청주": "충북 청주 FC",
    "수원FC": "수원 FC",
    "제주": "제주 유나이티드 FC",
    "광주": "광주 FC",
    "경남": "경남 FC",
    "전남": "전남 드래곤즈",
    "대전": "대전 하나 시티즌",
    "안양": "FC 안양",
    "충남아산": "충남 아산 FC",
    "부산": "부산 아이파크",
    "성남": "성남 FC",
    "김포": "김포 FC"
};

const LOGO_DIR = path.join(process.cwd(), 'public', 'images', 'logos', 'kleague');
if (!fs.existsSync(LOGO_DIR)) {
    fs.mkdirSync(LOGO_DIR, { recursive: true });
}

async function fetchWikiEmblem(teamKey: string, wikiTitle: string) {
    try {
        // 1. Get page content to find emblem filename
        const url = `https://ko.wikipedia.org/w/api.php?action=query&prop=revisions&rvprop=content&titles=${encodeURIComponent(wikiTitle)}&format=json`;
        const res = await fetch(url);
        const data = await res.json();
        const pages = data.query?.pages;
        if (!pages) return null;

        const pageId = Object.keys(pages)[0];
        if (pageId === '-1') return null;

        const content = pages[pageId].revisions[0]['*'];

        // Parse infobox for emblem name
        let match = content.match(/\|\s*(?:엠블럼|emblem|로고|image|그림)\s*=\s*([^|\n]+)/i);
        let filename = '';
        if (match) {
            filename = match[1].trim();
        } else {
            match = content.match(/\[\[(?:File|파일|Image|그림):([^|\]\n]+)/i);
            if (match) filename = match[1].trim();
        }

        // Sometimes they put [[File:...]] or [[파일:...]] inside the infobox value
        if (filename.includes('[[')) {
            const fileMatch = filename.match(/\[\[(?:File|파일|Image|그림):([^|\]]+)/i);
            if (fileMatch) filename = fileMatch[1].trim();
        }

        if (!filename) return null;

        // 2. Query imageinfo for URL
        const imgUrl = `https://ko.wikipedia.org/w/api.php?action=query&prop=imageinfo&iiprop=url&titles=File:${encodeURIComponent(filename)}&format=json`;
        const imgRes = await fetch(imgUrl);
        const imgData = await imgRes.json();
        const imgPages = imgData.query?.pages;
        if (!imgPages) return null;

        const imgPageId = Object.keys(imgPages)[0];
        if (imgPageId === '-1') return null;

        const imageUrl = imgPages[imgPageId].imageinfo?.[0]?.url;
        if (!imageUrl) return null;

        // 3. Download the file
        let ext = path.extname(filename).toLowerCase();
        if (!['.png', '.svg', '.jpg', '.jpeg', '.webp'].includes(ext)) {
            ext = '.png';
        }
        const outputPath = path.join(LOGO_DIR, `${teamKey}${ext}`);

        const dlRes = await fetch(imageUrl, {
            headers: {
                'User-Agent': 'CultureFlow-Script/1.0 (https://github.com/pyw31337/culture)'
            }
        });

        if (!dlRes.ok) throw new Error(`Failed to download ${imageUrl}`);

        const arrayBuffer = await dlRes.arrayBuffer();
        fs.writeFileSync(outputPath, Buffer.from(arrayBuffer));
        console.log(`✅ Downloaded ${teamKey} logo -> ${outputPath} (from ${imageUrl})`);

        return `/culture/images/logos/kleague/${teamKey}${ext}`;

    } catch (error) {
        console.error(`❌ Error fetching logo for ${teamKey} (${wikiTitle}):`, error.message);
        return null;
    }
}

async function run() {
    const kleagueRaw = fs.readFileSync(path.join(process.cwd(), 'src/data/kleague.json'), 'utf-8');
    let kleagueData = JSON.parse(kleagueRaw);

    const logoMap: Record<string, string> = {};

    for (const [key, title] of Object.entries(teams)) {
        console.log(`Fetching ${key}...`);
        const logoUrl = await fetchWikiEmblem(key, title);
        if (logoUrl) {
            logoMap[key] = logoUrl;
        } else {
            console.log(`⚠️ Could not find logo for ${key}.`);
        }
        // polite delay
        await new Promise(r => setTimeout(r, 500));
    }

    // Update kleague.json with new logos
    let updatedCount = 0;
    for (const match of kleagueData) {
        if (logoMap[match.homeTeam] && match.homeTeamLogo.includes('kleague.com')) {
            match.homeTeamLogo = logoMap[match.homeTeam];
            updatedCount++;
        }
        if (logoMap[match.awayTeam] && match.awayTeamLogo.includes('kleague.com')) {
            match.awayTeamLogo = logoMap[match.awayTeam];
            updatedCount++;
        }
    }

    if (updatedCount > 0) {
        fs.writeFileSync(path.join(process.cwd(), 'src/data/kleague.json'), JSON.stringify(kleagueData, null, 2));
        console.log(`\n🎉 Updated kleague.json with ${updatedCount} new logo references!`);
    } else {
        console.log(`\nNo updates made to kleague.json.`);
    }
}

run();
