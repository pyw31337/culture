
export const getOptimizedUrl = (url: string, width: number = 400) => {
    if (!url) return '';
    try {
        // use wsrv.nl for image optimization
        const encodedUrl = encodeURIComponent(url);
        return `https://wsrv.nl/?url=${encodedUrl}&w=${width}&q=80&output=webp`;
    } catch {
        return url;
    }
};
