
const key = "고양시 덕양구 화중로 26 고양어린이박물관";

const REGIONS = ['서울', '경기', '인천', '강원', '대전', '세종', '충남', '충북', '광주', '전남', '전북', '대구', '경북', '부산', '울산', '경남', '제주'];
const REGION_PREFIX_REGEX = new RegExp(`^(${REGIONS.join('|')}|강원도|강원특별자치도|경기도|경상남도|경상북도|광주광역시|대구광역시|대전광역시|부산광역시|서울특별시|울산광역시|인천광역시|전라남도|전라북도|제주특별자치도|충청남도|충청북도|전북특별자치도)\\s+`);

console.log("Input:", key);
console.log("Region Match:", REGION_PREFIX_REGEX.test(key));
// "고양시" is NOT in the list! The list has "서울", "경기"... but city names like "고양시" without "경기" prefix?
// "고양시" is NOT a top-level region. 
// Ah, the user data input is `고양시 덕양구...`. It does NOT start with `경기도`.
// My regex expects `경기도` or `경기`.
// I need to add major cities to the regex if the data lacks province prefix.

if (REGION_PREFIX_REGEX.test(key) && key.length > 15) {
    const addrEndMatch = key.match(/(로|길|대로)\s+(\d+)(?:[-\s]\d+)?/);
    if (addrEndMatch) {
        console.log("Address Match:", addrEndMatch[0]);
        const cutoffIndex = addrEndMatch.index! + addrEndMatch[0].length;
        let pot = key.substring(cutoffIndex).trim();
        console.log("Pot:", pot);
    }
} else {
    console.log("SKIPPED due to Regex or Length");
}

export { };
