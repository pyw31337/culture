
import * as fs from 'fs';
import * as path from 'path';

const DATA_DIR = path.resolve('src/data');

const ADDRESS_Standardizer = (addr: string): string => {
    if (!addr) return '';
    
    // 1. Strip redundant prefixes
    let cleaned = addr.replace(/^(대한민국|위치|주소)\s*/, '').trim();
    
    // 2. Remove common trailing noise
    cleaned = cleaned.replace(/\s*(지도보기|홈페이지|전화번호).*$/, '').trim();
    
    // 3. Standardize common typos/shortened names
    cleaned = cleaned.replace(/^서울\s/, '서울특별시 ');
    cleaned = cleaned.replace(/^경기\s/, '경기도 ');
    cleaned = cleaned.replace(/^인천\s/, '인천광역시 ');
    cleaned = cleaned.replace(/^부산\s/, '부산광역시 ');
    cleaned = cleaned.replace(/^대구\s/, '대구광역시 ');
    cleaned = cleaned.replace(/^대전\s/, '대전광역시 ');
    cleaned = cleaned.replace(/^광주\s/, '광주광역시 ');
    cleaned = cleaned.replace(/^울산\s/, '울산광역시 ');
    cleaned = cleaned.replace(/^세종\s/, '세종특별자치시 ');
    cleaned = cleaned.replace(/^강원\s/, '강원특별자치도 ');
    cleaned = cleaned.replace(/^제주\s/, '제주특별자치도 ');
    cleaned = cleaned.replace(/^충북\s/, '충청북도 ');
    cleaned = cleaned.replace(/^충남\s/, '충청남도 ');
    cleaned = cleaned.replace(/^전북\s/, '전북특별자치도 ');
    cleaned = cleaned.replace(/^전남\s/, '전라남도 ');
    cleaned = cleaned.replace(/^경북\s/, '경상북도 ');
    cleaned = cleaned.replace(/^경남\s/, '경상남도 ');

    // 4. Ensure space after city/province if missing (e.g. "서울특별시강남구" -> "서울특별시 강남구")
    // City names ending in 시, 도, 광역시, 특별시, 특별자치시, 특별자치도
    const cityPattern = /^(서울특별시|부산광역시|대구광역시|인천광역시|광주광역시|대전광역시|울산광역시|세종특별자치시|경기도|강원특별자치도|충청북도|충청남도|전라북도|전북특별자치도|전라남도|경상북도|경상남도|제주특별자치도)([가-힣0-9])/;
    cleaned = cleaned.replace(cityPattern, '$1 $2');

    return cleaned.trim();
};

async function standardize() {
    const files = fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.json'));
    
    let totalUpdated = 0;
    
    for (const file of files) {
        const filePath = path.join(DATA_DIR, file);
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        
        let changed = false;
        
        const items = Array.isArray(data) ? data : (data.performances || []);
        
        items.forEach((item: any) => {
            if (item.address) {
                const standardized = ADDRESS_Standardizer(item.address);
                if (standardized !== item.address) {
                    item.address = standardized;
                    changed = true;
                    totalUpdated++;
                }
            }
        });
        
        if (changed) {
            fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
            console.log(`Updated: ${file}`);
        }
    }
    
    console.log(`Finished. Total addresses standardized: ${totalUpdated}`);
}

standardize();
