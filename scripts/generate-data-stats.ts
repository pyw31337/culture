import fs from 'fs';
import path from 'path';

const SRC_DATA_DIR = path.resolve(process.cwd(), 'src/data');
const PUBLIC_DATA_FILE = path.resolve(process.cwd(), 'public/data/performances.json');

interface DataSourceStat {
    filename: string;
    type: string;
    scrapedCount: number;
    displayedCount: number;
    lastScrapedDate: Date;
}

function getDataSourceType(file: string): string {
    if (file.includes('kopis')) return 'KOPIS';
    if (file.includes('movies')) return '영화 (KOBIS/Naver)';
    if (file.includes('museum')) return '박물관 (전국공공포털)';
    if (file.includes('culture-portal')) return '문화포털';
    if (file.includes('mochaclass')) return '모카클래스';
    if (file.includes('mommom')) return '맘맘';
    if (file.includes('interpark')) return '인터파크';
    if (file.includes('seoul-culture')) return '서울문화포털';
    if (['football.json', 'baseball.json', 'basketball.json', 'volleyball.json', 'v-womens.json', 'kbo.json', 'kleague.json', 'kovo.json', 'kbl.json', 'handball.json'].includes(file)) return '스포츠';
    if (file.includes('festivals')) return '한국관광공사 (축제)';
    if (file.includes('myrealtrip-kids')) return '마이리얼트립(키즈)';
    if (file.includes('sssd-class')) return '솜씨당';
    if (file.includes('timeticket')) return '타임티켓';
    if (file.includes('umclass')) return '움클래스';
    if (file.includes('cinemas')) return '영화관 목록';
    return '기타';
}

function getScraperModule(file: string): string {
    if (file === 'kopis-performances.json') return 'scrape-kopis.ts';
    if (file === 'culture-portal.json') return 'scrape-culture-portal.ts';
    if (file === 'interpark.json') return 'scrape-interpark.ts';
    if (file === 'mochaclass.json') return 'scrape-mochaclass.ts';
    if (file === 'museum.json') return 'scrape-museum.ts';
    if (file === 'movies.json') return 'scrape-movies.ts';
    if (file.includes('mommom')) return 'scrape-mommom.ts';
    if (file === 'seoul-culture.json') return 'scrape-seoul.ts';
    if (file === 'myrealtrip-kids.json') return 'scrape-myrealtrip.ts';
    if (file === 'sssd-class.json') return 'scrape-sssd.ts';
    if (file === 'timeticket.json') return 'scrape-timeticket.ts';
    if (file === 'umclass.json') return 'scrape-umclass.ts';
    if (file === 'festivals.json') return 'scrape-festivals.ts';
    if (['football.json', 'baseball.json', 'basketball.json', 'volleyball.json', 'v-womens.json', 'kbo.json', 'kleague.json', 'kovo.json', 'kbl.json', 'handball.json'].includes(file)) return 'scrape-sports.ts';
    if (file === 'cinemas.json') return 'scrape-cinemas.ts';
    return 'N/A';
}

function getSourceIdFromFile(file: string): string {
    if (file === 'kopis-performances.json') return 'kopis';
    if (file === 'culture-portal.json') return 'culture-portal';
    if (file === 'interpark.json') return 'interpark';
    if (file === 'mochaclass.json') return 'mochaclass';
    if (file === 'museum.json') return 'museum';
    if (file === 'movies.json') return 'movie'; // Note: mapping might be complex
    if (file === 'mommom.json') return 'mommom';
    if (file === 'mommom-products.json') return 'mommom-product';
    if (file === 'mommom-activities.json') return 'mommom-activity';
    if (file === 'mommom-exb.json') return 'mommom-exb';
    if (file === 'seoul-culture.json') return 'seoul';
    if (file === 'myrealtrip-kids.json') return 'myrealtrip-kids';
    if (file === 'sssd-class.json') return 'sssd-class';
    if (file === 'timeticket.json') return 'timeticket';
    if (file === 'umclass.json') return 'umclass';
    if (file === 'festivals.json') return 'festival';
    if (file === 'kleague.json' || file === 'football.json') return 'football';
    if (file === 'kbo.json' || file === 'baseball.json') return 'baseball';
    if (file === 'kbl.json' || file === 'basketball.json') return 'basketball';
    if (file === 'kovo.json' || file === 'volleyball.json' || file === 'v-womens.json') return 'volleyball';
    if (file === 'handball.json') return 'handball';
    return file.replace('.json', '');
}

async function main() {
    // 1. Get Displayed Counts
    const displayedCounts: Record<string, number> = {};
    if (fs.existsSync(PUBLIC_DATA_FILE)) {
        const publicData = JSON.parse(fs.readFileSync(PUBLIC_DATA_FILE, 'utf-8'));
        for (const item of publicData) {
            const src = item.source || 'unknown';
            displayedCounts[src] = (displayedCounts[src] || 0) + 1;
        }
    }

    // 2. Scan SRC dir
    const files = fs.readdirSync(SRC_DATA_DIR).filter(f => f.endsWith('.json'));
    const stats: DataSourceStat[] = [];
    
    // For movies, we might need a specific check since they don't combine the same way into performances.json
    // But movies ARE in performances.json usually, or managed separately? Wait, they are added in `generate-performance-json.ts`
    
    for (const file of files) {
        if (file === 'venues.json' || file === 'venue-dictionary.json' || file === 'korean_address_hierarchy.json') continue;
        
        const filePath = path.join(SRC_DATA_DIR, file);
        try {
            const stat = fs.statSync(filePath);
            const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
            const count = Array.isArray(data) ? data.length : Object.keys(data).length;
            
            if (count === 0) continue;
            
            let sourceId = getSourceIdFromFile(file);
            let displayed = 0;
            
            // Map the displayed counts back correctly. 
            // In performances.json, things like 'sports', 'classic_tradition', etc. might override raw source
            // Actually, data-transformer sets source via the `source` argument passed to it.
            // But we can also just count by looking for matches or simply relying on our `displayedCounts[source]` which strictly keys by `item.source`.
            // Let's refine getSourceIdFromFile if needed.
            
            // For KOPIS, the source is always 'kopis'.
            // For mocaclass, 'mochaclass'.
            // For sports, it maps to their respective genres.
            if (['football.json', 'kleague.json'].includes(file)) displayed = displayedCounts['football'] || 0;
            else if (['baseball.json', 'kbo.json'].includes(file)) displayed = displayedCounts['baseball'] || 0;
            else if (['basketball.json', 'kbl.json'].includes(file)) displayed = displayedCounts['basketball'] || 0;
            else if (['volleyball.json', 'v-womens.json', 'kovo.json'].includes(file)) displayed = displayedCounts['volleyball'] || 0;
            else if (file === 'handball.json') displayed = displayedCounts['handball'] || 0;
            else if (file === 'movies.json') displayed = displayedCounts['movie'] || 0;
            else if (file === 'museum.json') displayed = displayedCounts['museum'] || 0;
            else if (file === 'festivals.json') displayed = displayedCounts['festival'] || 0;
            else if (file === 'culture-portal.json') displayed = displayedCounts['culture-portal'] || 0;
            else displayed = displayedCounts[sourceId] || 0;
            
            if (file === 'cinemas.json') displayed = count; // Cinemas aren't in performances.json but are fully displayed on map

            stats.push({
                filename: file,
                type: getDataSourceType(file),
                scrapedCount: count,
                displayedCount: displayed,
                lastScrapedDate: stat.mtime
            });
            
        } catch (e) {
            // ignore
        }
    }

    // Sort by scraped count desc
    stats.sort((a, b) => b.scrapedCount - a.scrapedCount);

    // Format Markdown Table
    console.log("## 표준 데이터 수집 현황\n");
    console.log("| 데이터 소스 | 유형 | 수집 모듈 | 수집 건수 | 노출 건수 | 마지막 수집일자 | 비고 |");
    console.log("|---|---|---|--:|--:|---|---|");
    
    let totalScraped = 0;
    let totalDisplayed = 0;

    for (const s of stats) {
        totalScraped += s.scrapedCount;
        totalDisplayed += s.displayedCount;
        
        const dateStr = s.lastScrapedDate.toLocaleString('ko-KR', { 
            timeZone: 'Asia/Seoul', 
            year: 'numeric', month: '2-digit', day: '2-digit', 
            hour: '2-digit', minute: '2-digit' 
        });
        
        let ratio = s.scrapedCount > 0 ? ((s.displayedCount / s.scrapedCount) * 100).toFixed(1) : '0.0';
        let note = `${ratio}% 노출`;
        if (s.filename === 'cinemas.json') note = '지도 마커용';
        
        console.log(`| ${s.filename} | ${s.type} | \`${getScraperModule(s.filename)}\` | **${s.scrapedCount.toLocaleString()}** | **${s.displayedCount.toLocaleString()}** | ${dateStr} | ${note} |`);
    }
    
    console.log(`| **총합** | | **${totalScraped.toLocaleString()}** | **${totalDisplayed.toLocaleString()}** | | |`);
    
    console.log(`\n\n*업데이트: ${new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}*`);
}

main();
