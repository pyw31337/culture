
import { getOptimizedUrl } from '../src/lib/utils';

const testUrls = [
    'https://timeticket.co.kr/wys2/file_attach_thumb/2025/05/12/1747009908-74-0_wonbon_N_7_600x600_70_2.jpg',
    'https://other-domain.com/image.jpg'
];

testUrls.forEach(url => {
    console.log(`Input: ${url}`);
    console.log(`Output: ${getOptimizedUrl(url, 400)}`);
    console.log('---');
});
