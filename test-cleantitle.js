function cleanTitle(title) {
    if (!title) return '';
    return title.replace(/^(\[[^\]]+\]\s*)+/, '').trim();
}

console.log("1:", cleanTitle("[단독] 위키드")); 
console.log("2:", cleanTitle("[얼리버드] [할인] 뮤지컬 영웅")); 
console.log("3:", cleanTitle("[특가]")); 
console.log("4:", cleanTitle("[2026 K리그1] 10R 서울 vs 수원")); 
