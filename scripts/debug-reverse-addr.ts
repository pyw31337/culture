
const PREFECTURES = ['서울', '경기', '인천', '강원', '대전', '세종', '충남', '충북', '광주', '전남', '전북', '대구', '경북', '부산', '울산', '경남', '제주'];

function fixReverseAddress(str: string): string | null {
    console.log("Input:", str);
    if (str && str.includes('대한민국') && str.includes(',')) {
        const parts = str.split(',').map(s => s.trim()).reverse();
        console.log("Parts (Reversed):", parts);

        // [대한민국, 08284, 서울특별시, 구로구, 구로5동, 가마산로23길, 구로아트밸리 예술극장]
        const validParts = parts.filter(p => !p.match(/^\d{5}$/) && p !== '대한민국');
        console.log("Valid Parts:", validParts);

        const regionIdx = validParts.findIndex(p => PREFECTURES.some(r => p.includes(r.slice(0, 2))));
        console.log("Region Index:", regionIdx);

        if (regionIdx !== -1) {
            const result = validParts.slice(regionIdx).join(' ');
            console.log("Result:", result);
            return result;
        }
    }
    return null;
}

const inputs = [
    "구로아트밸리 예술극장, 가마산로23길, 구로5동, 구로구, 서울특별시, 08284, 대한민국",
    "경호초등학교, 321, 산남로, 서귀포시, 제주특별자치도, 63559, 대한민국",
    "경복궁, 청운효자동, 종로구, 서울특별시, 03045, 대한민국",
    "오두산통일전망대, 369, 필승로, 탄현면, 파주시, 경기도, 10860, 대한민국"
];

inputs.forEach(fixReverseAddress);
