
const cases = [
    "강원특별자치도 강릉시 구정면 정등로 130 디자인씽킹뮤지엄",
    "강원특별자치도 강릉시 난설헌로 131 강릉녹색도시 체험센터",
    "강원특별자치도 강릉시 수리골길 102 강릉아레나 1층",
    "강원특별자치도 강릉시 율곡로3139번길 24 오죽헌 오죽헌"
];

const REGIONS = ['서울', '경기', '인천', '강원', '대전', '세종', '충남', '충북', '광주', '전남', '전북', '대구', '경북', '부산', '울산', '경남', '제주'];
const REGION_PREFIX_REGEX = new RegExp(`^(${REGIONS.join('|')}|강원도|경기도|경상남도|경상북도|광주광역시|대구광역시|대전광역시|부산광역시|서울특별시|울산광역시|인천광역시|전라남도|전라북도|제주특별자치도|충청남도|충청북도|전북특별자치도)\\s+`);

console.log("Regex Source:", REGION_PREFIX_REGEX.source);

cases.forEach(name => {
    console.log(`\nInput: "${name}"`);
    let cleanName = name;
    if (REGION_PREFIX_REGEX.test(cleanName)) {
        console.log("Region Match: Yes");
        // Regex looking for Road Name + Number
        const addrEndMatch = cleanName.match(/(로|길)\s*(\d+)([-\s]\d+)?/);
        // Note: added capturing group for numbers to be sure.

        if (addrEndMatch) {
            console.log("Address End Match:", addrEndMatch[0]);
            const cutoffIndex = addrEndMatch.index! + addrEndMatch[0].length;
            let pot = cleanName.substring(cutoffIndex).trim();
            console.log("Potential Name:", pot);

            // Further cleaning on pot
            pot = pot.replace(/^(지하\s*)?(B?\d+층|B\d+)\s*/, '').replace(/^\d+호\s*/, '');
            pot = pot.trim();
            console.log("Cleaned Potential:", pot);

            if (pot.length > 1 && !/^\d+$/.test(pot)) cleanName = pot;
        } else {
            console.log("No Address End Match");
        }
    } else {
        console.log("Region Match: No");
    }
    console.log(`Result: "${cleanName}"`);
});
