const rawAddr = "울산광역시 중구 새즈믄해거리 37";
const validAddr = rawAddr.match(/(([가-힣]+[시도])\s+([가-힣]+[시구군]).+)/)?.[1] || rawAddr;
const venue = validAddr || "title";
console.log({rawAddr, validAddr, venue});
