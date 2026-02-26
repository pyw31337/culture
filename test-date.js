const testCases = [
  "2023.11.24. 오후 08:00",
  "2026.02.14.",
  "2026 02 14",
  "2026.02.14. ~ 방영중",
  "2026.02.14. ~ 2026.04.14.",
  "2026년 2월 14일"
];

for(const text of testCases) {
    let dateStr = '';
    const match = text.match(/20\d{2}[년\.\-\s]+[0-1]?\d[월\.\-\s]+[0-3]?\d[일\.\-\s]*/);
    if (match) {
        dateStr = match[0].replace(/[년월일\s]/g, '.').replace(/\.+/g, '.').replace(/\.$/, '');
        const parts = dateStr.split('.');
        if (parts.length === 3) {
            const y = parts[0];
            const m = parts[1].padStart(2, '0');
            const d = parts[2].padStart(2, '0');
            dateStr = `${y}.${m}.${d}`;
        }
    } else {
        const matchYM = text.match(/20\d{2}[년\.\-\s]+[0-1]?\d[월\.\-\s]*/);
        if (matchYM) {
             let temp = matchYM[0].replace(/[년월\s]/g, '.').replace(/\.+/g, '.').replace(/\.$/, '');
             const parts = temp.split('.');
             dateStr = `${parts[0]}.${parts[1].padStart(2, '0')}.01`;
        } else {
             dateStr = text.replace(/\(.*\)/, '').replace(/[가-힣\s]/g, '').replace(/\.$/, '').trim();
        }
    }
    console.log(text, "=>", dateStr);
}
