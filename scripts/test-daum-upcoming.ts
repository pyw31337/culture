import axios from 'axios';

async function testDaumUpcoming() {
    // Daum movies often use an API like https://movie.daum.net/api/premovie
    try {
        const url = 'https://movie.daum.net/api/premovie?page=1&size=100';
        console.log(`Fetching from ${url}`);
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0'
            }
        });

        const data = response.data;
        if (data && data.contents) {
            console.log(`Found ${data.contents.length} upcoming movies from Daum`);
            console.log("Sample:", data.contents.slice(0, 3).map((m: any) => ({
                title: m.titleKorean,
                releaseDate: m.admissionDate,
                poster: m.mainPhoto?.imageUrl,
                country: m.countries?.join(','),
                genres: m.genres?.join(',')
            })));
        } else {
            console.log("Response did not contain contents:", data);
        }
    } catch (e) {
        console.error(e);
    }
}

testDaumUpcoming();
