
import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'src/data');
const SIDO_LIST = ['서울', '경기', '인천', '강원', '충북', '충남', '대전', '경북', '경남', '대구', '울산', '부산', '전북', '전남', '광주', '세종', '제주'];

async function auditAddresses() {
    console.log('Starting Full Address Audit (전수조사)...');
    
    const files = fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.json') && !f.includes('performances') && !f.includes('translation'));
    let totalIssues = 0;
    const issuesByFile: Record<string, string[]> = {};

    for (const file of files) {
        const filePath = path.join(DATA_DIR, file);
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        if (!Array.isArray(data)) continue;

        const problematic = data.filter((item: any) => {
            const addr = item.address || '';
            if (!addr || addr === '정보 없음') return true;
            const startsWithSido = SIDO_LIST.some(sido => addr.startsWith(sido));
            return !startsWithSido;
        });

        if (problematic.length > 0) {
            issuesByFile[file] = problematic.map((p: any) => `${p.title || p.name} -> ${p.address}`);
            totalIssues += problematic.length;
        }
    }

    console.log(`\nAudit Complete. Found ${totalIssues} problematic addresses across ${Object.keys(issuesByFile).length} files.`);
    
    if (totalIssues > 0) {
        console.log('\nSample Issues:');
        Object.entries(issuesByFile).slice(0, 5).forEach(([file, issues]) => {
            console.log(`[${file}] ${issues.length} issues. Example: ${issues[0]}`);
        });
    }
}

auditAddresses().catch(console.error);
