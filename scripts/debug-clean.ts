
const testCases = [
    "경기 수원시 영통구 매영로45번길 7 (매탄동) 지하 1층 이지드럼",
    "경기 수원시 영통구 청명남로28번길 2 (영통동, 아이텐텐빌딩) 6층 모두의요리아카데미",
    "(신풍동) SEHWA 지하 1층"
];

const manualFixes = {
    "SEHWA": "SEHWA"
};

cases.forEach(name => {
    console.log(`\nInput: "${name}"`);
    let cleanName = name;

    // Parens
    cleanName = cleanName.replace(/^\([^)]+\)\s*/, '');
    cleanName = cleanName.trim();

    // Address extraction
    const REGIONS = ['서울', '경기', '인천', '강원', '대전', '세종', '충남', '충북', '광주', '전남', '전북', '대구', '경북', '부산', '울산', '경남', '제주'];
    const REGION_PREFIX_REGEX = new RegExp(`^(${REGIONS.join('|')}|강원도|강원특별자치도|경기도|경상남도|경상북도|광주광역시|대구광역시|대전광역시|부산광역시|서울특별시|울산광역시|인천광역시|전라남도|전라북도|제주특별자치도|충청남도|충청북도|전북특별자치도)\\s+`);

    if (REGION_PREFIX_REGEX.test(cleanName) && cleanName.length > 15) {
        // Regex: Match Road/Gil + Number
        // "매영로45번길 7" -> "길 7" match?
        const addrEndMatch = cleanName.match(/(로|길)\s*(\d+)([-\s]\d+)?/);

        if (addrEndMatch) {
            console.log("Match Found:", addrEndMatch[0]);
            console.log("Index:", addrEndMatch.index);

            const cutoffIndex = addrEndMatch.index! + addrEndMatch[0].length;
            let pot = cleanName.substring(cutoffIndex).trim();
            console.log("Pot (Initial):", pot);

            // Clean pot
            let pPrev = '';
            while (pot !== pPrev) {
                pPrev = pot;
                pot = pot.replace(/^\([^)]+\)\s*/, '') // Remove (Dong)
                    .replace(/^(지하\s*)?(B?\d+층|B\d+)\s*/, '')
                    .replace(/^\d+호\s*/, '')
                    .replace(/^[,.\s]+/, '')
                    .replace(/\s*(지하\s*)?(B?\d+층|B\d+)\s*$/, '') // Suffix removal
                    .trim();
            }
            console.log("Pot (Cleaned):", pot);

            if (pot.length > 1 && !/^\d+$/.test(pot)) cleanName = pot;
        } else {
            console.log("No Address Match");
        }
    }

    // Suffix removal on main (for SEHWA case)
    cleanName = cleanName.replace(/\s*(지하\s*)?(B?\d+층|B\d+)\s*$/, '');

    console.log("Final:", cleanName);
});
