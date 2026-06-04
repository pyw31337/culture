let kakaoMapSdkPromise: Promise<void> | null = null;

export function loadKakaoMapSdk() {
    if (typeof window === 'undefined') return Promise.resolve();
    if (window.kakao?.maps?.load) return Promise.resolve();
    if (kakaoMapSdkPromise) return kakaoMapSdkPromise;

    const appKey = process.env.NEXT_PUBLIC_KAKAO_JS_KEY;
    if (!appKey) return Promise.reject(new Error('Kakao map SDK key is not configured.'));

    kakaoMapSdkPromise = new Promise<void>((resolve, reject) => {
        const existing = document.querySelector<HTMLScriptElement>('script[data-cultureflow-kakao-map]');
        const script = existing || document.createElement('script');

        const handleLoad = () => resolve();
        const handleError = () => {
            kakaoMapSdkPromise = null;
            reject(new Error('Failed to load Kakao map SDK.'));
        };

        script.addEventListener('load', handleLoad, { once: true });
        script.addEventListener('error', handleError, { once: true });

        if (!existing) {
            script.dataset.cultureflowKakaoMap = 'true';
            script.async = true;
            script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${appKey}&autoload=false&libraries=services,clusterer`;
            document.head.appendChild(script);
        }
    });

    return kakaoMapSdkPromise;
}
