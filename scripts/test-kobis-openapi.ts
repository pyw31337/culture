import axios from 'axios';

async function testKobisOpenApi() {
    const key = 'f5eef3421c60206eb5ce7fd92cf3ce49'; // Standard public key
    const url = `http://www.kobis.or.kr/kobisopenapi/webservice/rest/movie/searchMovieList.json?key=${key}&itemPerPage=50&openStartDt=20260301&openEndDt=20261231`;

    try {
        console.log(`Fetching ${url}`);
        const response = await axios.get(url);
        const data = response.data;

        if (data.movieListResult && data.movieListResult.movieList) {
            console.log(`Found ${data.movieListResult.totCnt} movies.`);
            console.log(data.movieListResult.movieList.slice(0, 10));
        } else {
            console.log(data);
        }
    } catch (e) {
        console.error(e);
    }
}

testKobisOpenApi();
