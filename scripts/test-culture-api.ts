import axios from 'axios';
import { XMLParser } from 'fast-xml-parser';

async function testAPI() {
    const key = 'da895f03-f155-420f-a63d-ab4e21782334';
    // Let's try the standard culture portal performace API list
    const url = `http://www.culture.go.kr/openapi/rest/publicperformancedisplays/period`;
    
    try {
        const res = await axios.get(url, {
            params: {
                serviceKey: key,
                cPage: 1,
                rows: 10,
                from: '20260301',
                to: '20261231'
            }
        });
        
        console.log(res.data.substring(0, 500));
        
        const parser = new XMLParser();
        const obj = parser.parse(res.data);
        console.log("Parsed:", JSON.stringify(obj, null, 2).substring(0, 500));
    } catch (e: any) {
        console.error(e.message);
    }
}

testAPI();
