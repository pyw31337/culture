import fs from 'fs';
import path from 'path';
import * as cheerio from 'cheerio';

const DEFAULT_CATEGORY_NO = '1102241';
const BASE_URL = 'https://mom-mom.net';
const API_URL = 'https://shop-api.mom-mom.net/api/products/search';

type ExistingItem = Record<string, any>;

type ShopProduct = {
    productNo: number;
    productName?: string;
    brandNameKo?: string;
    partnerName?: string;
    salePrice?: number;
    immediateDiscountAmt?: number;
    additionDiscountAmt?: number;
    couponDiscountAmt?: number;
    maxCouponAmt?: number;
    saleStartYmdt?: string;
    saleEndYmdt?: string;
    expirationDate?: string;
    imageUrls?: string[];
    listImageUrls?: string[];
    stickerInfos?: Array<{ label?: string; text?: string; name?: string }>;
    stickerLabels?: string[];
    promotionText?: string | null;
    contentsIfPausing?: string;
    mainStockCnt?: number;
    stockCnt?: number;
    totalReviewCount?: number;
    reviewRating?: number;
    likeCount?: number;
    productType?: string;
    shippingArea?: string | null;
    shippingType?: string | null;
    shippingFee?: number;
    deliveryFee?: number;
    partnerNo?: number;
    categoryNos?: number[];
    displayCategories?: unknown[];
    reservationData?: unknown;
};

type ShopProductDetail = {
    baseInfo?: {
        productNo?: number;
        registerYmdt?: string;
        promotionText?: string | null;
        productName?: string;
        contentHeader?: string;
        content?: string;
        contentFooter?: string;
        dutyInfo?: string;
        placeOriginLabel?: string;
    };
    deliveryFee?: {
        defaultDeliveryConditionLabel?: string;
        returnWarehouse?: {
            warehouseName?: string;
            address?: string;
            detailAddress?: string;
            addressStr?: string;
        };
        deliveryTemplateName?: string;
    };
    limitations?: {
        refundable?: boolean;
        memberOnly?: boolean;
        canAddToCart?: boolean;
    };
    counter?: {
        likeCnt?: number;
        reviewCnt?: number;
        inquiryCnt?: number;
    };
    categories?: Array<{
        fullCategoryLabel?: string;
    }>;
    brand?: {
        nameKo?: string;
        name?: string;
    };
    partner?: {
        partnerName?: string;
        companyName?: string;
        officeAddressLabel?: string;
        phoneNo?: string;
        email?: string;
    };
    partnerNotice?: string | null;
    reservationData?: unknown;
    deliveryGuide?: string | null;
    afterServiceGuide?: string | null;
    refundGuide?: string | null;
    exchangeGuide?: string | null;
    detailImages?: string[];
};

type ShopApiResponse = {
    totalCount?: number;
    pageCount?: number;
    items?: ShopProduct[];
};

type ScrapeOptions = {
    outputFile: string;
    source: 'mommom-product' | 'mommom-activity';
    defaultGenre?: string;
    categoryNo?: string;
};

function toPlainText(value: unknown, depth = 0): string {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') return String(value);
    if (Array.isArray(value)) {
        return value.map((entry) => toPlainText(entry, depth + 1)).filter(Boolean).join(' ');
    }
    if (typeof value === 'object' && depth < 2) {
        const record = value as Record<string, unknown>;
        const preferredKeys = ['label', 'text', 'name', 'title', 'value', 'content', 'contents', 'description', 'message', 'html'];
        const preferred = preferredKeys
            .map((key) => toPlainText(record[key], depth + 1))
            .filter(Boolean);
        if (preferred.length > 0) return preferred.join(' ');

        return Object.values(record)
            .slice(0, 20)
            .map((entry) => toPlainText(entry, depth + 1))
            .filter(Boolean)
            .join(' ');
    }
    return '';
}

function compact(value?: unknown) {
    return toPlainText(value).replace(/\s+/g, ' ').trim();
}

function slugify(text: string) {
    return compact(text)
        .replace(/[^a-zA-Z0-9가-힣]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '')
        .slice(0, 80);
}

function normalizeKey(value?: string) {
    return compact(value)
        .replace(/[^\da-zA-Z가-힣]/g, '')
        .toLowerCase();
}

function toImageUrl(value?: string) {
    if (!value) return '';
    if (value.startsWith('//')) return `https:${value}`;
    if (value.startsWith('/')) return `${BASE_URL}${value}`;
    return value;
}

type MomMomImagePayload = {
    bucket?: string;
    key?: string;
    edits?: {
        resize?: {
            width?: number;
            withoutEnlargement?: boolean;
            [key: string]: unknown;
        };
        [key: string]: unknown;
    };
    [key: string]: unknown;
};

const MOMMOM_IMAGE_PREFIX = 'https://image.mom-mom.net/';

function cleanMomMomImageUrl(value?: string | null) {
    return compact(value || '')
        .replace(/\\u002F/g, '/')
        .replace(/\\\//g, '/')
        .replace(/&amp;/g, '&')
        .replace(/[),.;]+$/u, '');
}

function parseMomMomImagePayload(value?: string | null): MomMomImagePayload | null {
    const url = cleanMomMomImageUrl(value);
    if (!url.startsWith(MOMMOM_IMAGE_PREFIX)) return null;

    const encoded = url.slice(MOMMOM_IMAGE_PREFIX.length).split(/[?#]/)[0];
    if (!encoded) return null;

    try {
        return JSON.parse(Buffer.from(decodeURIComponent(encoded), 'base64').toString('utf8')) as MomMomImagePayload;
    } catch {
        return null;
    }
}

function normalizeMomMomImageUrl(value?: string | null, width = 1080) {
    const url = cleanMomMomImageUrl(value);
    if (!url) return '';

    const payload = parseMomMomImagePayload(url);
    if (!payload?.key) return toImageUrl(url);

    const normalizedPayload: MomMomImagePayload = {
        ...payload,
        edits: {
            ...(payload.edits || {}),
            resize: {
                ...(payload.edits?.resize || {}),
                width,
                withoutEnlargement: true,
            },
        },
    };

    return `${MOMMOM_IMAGE_PREFIX}${Buffer.from(JSON.stringify(normalizedPayload)).toString('base64')}`;
}

function getImageDedupeKey(value?: string | null) {
    const payload = parseMomMomImagePayload(value);
    return payload?.key || normalizeKey(cleanMomMomImageUrl(value || ''));
}

/**
 * 후보 URL 파일명에 들어있는 사이즈 힌트(예: 1000x1000, 720x320, _w800 등)를 점수화하여
 * 가장 큰 원본으로 보이는 URL을 고른다. 힌트가 없으면 입력 순서를 유지한다.
 * NHN커머스 CDN(mom-mom.cdn-nhncommerce.com)은 리사이즈 파라미터를 지원하지 않으므로
 * 파일명 자체가 사이즈 단서가 된다.
 */
function pickLargestImage(urls: string[]): string {
    if (!urls.length) return '';
    const scored = urls
        .map((url, index) => {
            const filename = (url.split('?')[0].split('#')[0].split('/').pop() || '').toLowerCase();
            let score = 0;
            // 1000x1000 형태
            const dim = filename.match(/(\d{3,5})\s*x\s*(\d{3,5})/);
            if (dim) {
                const area = Number(dim[1]) * Number(dim[2]);
                score += area;
            }
            // _w800, w1080 패턴
            const w = filename.match(/[_-]?w(\d{3,5})/);
            if (w) score += Number(w[1]) * 600;
            // 썸네일/thumb 키워드는 페널티
            if (/(썸네일|thumb|small|list|tiny|480|520)/i.test(filename)) score -= 500_000;
            // 대표/main/big 키워드는 가산
            if (/(대표|main|big|large|hero|origin|original|full)/i.test(filename)) score += 800_000;
            return { url, score, index };
        })
        .sort((a, b) => b.score - a.score || a.index - b.index);
    return scored[0].url;
}

// mom-mom의 image.mom-mom.net 도메인에서 events/* 키는 사이트 공통 광고/이벤트 배너이고,
// showcases/* 키는 큐레이션 쇼케이스 카드 이미지이므로 상품 상세 이미지로 취급하지 않는다.
const MOMMOM_AD_KEY_PREFIXES = ['events/', 'showcases/', 'banners/', 'promotions/', 'curations/'];

function isMomMomAdAssetKey(key?: string | null) {
    if (!key) return false;
    return MOMMOM_AD_KEY_PREFIXES.some((prefix) => key.startsWith(prefix));
}

function isLikelyProductDetailImageUrl(url: string) {
    if (!url) return false;
    const trimmed = url.trim();
    if (!trimmed) return false;
    if (trimmed.startsWith('data:')) return false;

    if (trimmed.includes('image.mom-mom.net/')) {
        const payload = parseMomMomImagePayload(trimmed);
        if (!payload?.key) return true;
        return !isMomMomAdAssetKey(payload.key);
    }

    // 판매자가 직접 업로드한 NHN커머스 CDN 이미지(예: mom-mom.cdn-nhncommerce.com/Mall-No-Chsg/...)
    // 또는 그 외 외부 이미지(상품 상세 페이지에 삽입된 HTML 안)는 그대로 허용한다.
    return true;
}

function normalizeDetailImageUrl(rawUrl: string) {
    let url = (rawUrl || '').trim();
    if (!url) return '';
    if (url.startsWith('//')) url = `https:${url}`;
    if (url.startsWith('http://')) url = `https://${url.slice('http://'.length)}`;

    if (url.startsWith(MOMMOM_IMAGE_PREFIX)) {
        const payload = parseMomMomImagePayload(url);
        const width = Number(payload?.edits?.resize?.width || 0);
        return normalizeMomMomImageUrl(url, Math.max(width || 1080, 1080));
    }
    return url;
}

/**
 * 상품 상세 페이지 HTML(detail.baseInfo.contentHeader/content/contentFooter 등)에서
 * <img src="..."> 태그만 파싱하여 실제 상품 상세 이미지만 반환한다.
 *
 * 사용자가 알려준 셀렉터 path:
 *   body > div.full-width.space-between-align-start > div > div > main > div > article > div > article > p > img
 * 이는 판매자가 NHN커머스로 업로드한 상품 상세 이미지가 노출되는 영역이며,
 * 이 영역은 detail.baseInfo.contentHeader / content / contentFooter HTML 필드에 그대로 들어있다.
 * 따라서 이 필드들의 HTML 안의 <img>만 추출하면 페이지 전체에 깔린
 * events/* 광고 배너나 showcases/* 큐레이션 카드를 깔끔하게 배제할 수 있다.
 */
function extractImagesFromDetailContentHtml(html?: string | null) {
    const raw = (html || '').trim();
    if (!raw) return [];
    const normalizedHtml = raw
        .replace(/\\u002F/g, '/')
        .replace(/\\\//g, '/');

    const seen = new Set<string>();
    const images: string[] = [];

    try {
        const $ = cheerio.load(normalizedHtml);
        $('img').each((_, el) => {
            const attribs = el.attribs || {};
            const candidate =
                attribs['src'] ||
                attribs['data-src'] ||
                attribs['data-original'] ||
                attribs['data-lazy'] ||
                '';
            const url = candidate?.trim();
            if (!url) return;
            if (!isLikelyProductDetailImageUrl(url)) return;

            const normalized = normalizeDetailImageUrl(url);
            if (!normalized) return;
            if (!/^https?:\/\//i.test(normalized)) return;

            const dedupeKey = getImageDedupeKey(normalized) || normalized;
            if (seen.has(dedupeKey)) return;
            seen.add(dedupeKey);
            images.push(normalized);
        });
    } catch {
        // 만약 cheerio 파싱이 실패하면 안전하게 빈 배열 반환.
    }

    return images.slice(0, 20);
}

/**
 * @deprecated 페이지 전체 HTML에서 image.mom-mom.net URL을 regex로 긁어 모으는 방식은
 * events/* 광고 배너까지 통째로 포함하는 문제가 있어 더 이상 사용하지 않는다.
 * 본 함수는 호환을 위해 남겨두지만 내부적으로는 빈 배열을 반환한다.
 * 새로운 추출은 extractImagesFromDetailContentHtml()을 통해 이루어진다.
 */
function extractMomMomDetailImagesFromHtml(_html: string) {
    return [] as string[];
}
void extractMomMomDetailImagesFromHtml;

function toCurrency(value?: number) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return '';
    return `${value.toLocaleString('ko-KR')}원`;
}

function formatDate(value?: string) {
    const raw = compact(value);
    if (!raw) return '';
    const datePart = raw.split(' ')[0];
    if (!/^\d{4}[-.]\d{2}[-.]\d{2}$/.test(datePart)) return '';
    return datePart.replace(/-/g, '.');
}

function formatDateTime(value?: string) {
    const raw = compact(value);
    const match = raw.match(/^(\d{4})[-.](\d{2})[-.](\d{2})(?:[ T](\d{2}):(\d{2}))?/);
    if (!match) return formatDate(raw);
    const date = `${match[1]}.${match[2]}.${match[3]}`;
    return match[4] && match[5] ? `${date} ${match[4]}:${match[5]}` : date;
}

function isOpenEndedDate(value?: string) {
    return !value || value.startsWith('2999') || value.startsWith('9999');
}

function buildDate(product: ShopProduct) {
    const start = formatDate(product.saleStartYmdt);
    const end = formatDate(product.expirationDate || product.saleEndYmdt);
    if (start && end && !isOpenEndedDate(product.expirationDate || product.saleEndYmdt)) return `${start} ~ ${end}`;
    if (end && !isOpenEndedDate(product.expirationDate || product.saleEndYmdt)) return `~ ${end}`;
    return '상시운영';
}

function classifyGenre(title: string, brand: string, defaultGenre = 'activity') {
    const text = `${title} ${brand}`.toLowerCase();
    if (/호텔|리조트|펜션|숙박|스테이|글램핑|캠핑|풀빌라|객실/.test(text)) return 'tourism';
    if (/박물관|과학관|미술관|전시|아쿠아리움|수족관|동물원|식물원|기념관/.test(text)) return 'museum';
    if (/클래스|체험|만들기|공방|쿠킹|베이킹|키즈카페|테마파크|놀이터/.test(text)) return 'activity';
    if (/워터파크|수영|스파|온천|찜질|사우나|썰매|루지|레일바이크|랜드|월드/.test(text)) return 'activity';
    return defaultGenre;
}

function extractRegion(text: string) {
    if (/서울|강남|송파|영등포|은평|코엑스/.test(text)) return 'seoul';
    if (/경기|과천|부천|용인|수원|평택|동탄|하남|고양|일산|안산|시흥|의정부|양평|포천/.test(text)) return 'gyeonggi';
    if (/인천|영종|청라/.test(text)) return 'incheon';
    if (/부산/.test(text)) return 'busan';
    if (/대구|경주|경북|포항/.test(text)) return 'gyeongbuk';
    if (/경남|통영|김해|창원|울산/.test(text)) return 'gyeongnam';
    if (/대전|세종|충청|충남|충북|아산|천안|청주/.test(text)) return 'chungnam';
    if (/광주|전라|전북|전남|여수|전주|광양/.test(text)) return 'jeonnam';
    if (/강원|춘천|강릉|정선|속초|평창|홍천|인제/.test(text)) return 'gangwon';
    if (/제주/.test(text)) return 'jeju';
    return 'etc';
}

type KnownVenue = {
    venue: string;
    address: string;
    lat?: number;
    lng?: number;
    region: string;
    website?: string;
    contact?: string;
};

const SELLER_ADDRESS_PATTERNS = [
    /제주특별자치도\s*제주시\s*청사로\s*11/,
    /서울특별시\s*동작구\s*사당로29가길\s*26/,
    /서울특별시\s*강남구\s*언주로\s*415/,
    /서울특별시\s*강남구\s*논현로149길\s*64/,
    /서울특별시\s*강남구\s*남부순환로\s*2732/,
    /서울특별시\s*강남구\s*영동대로96길\s*34/,
    /서울특별시\s*마포구\s*큰우물로\s*76/,
];

const KNOWN_VENUES: Array<{ patterns: RegExp[]; value: KnownVenue }> = [
    {
        patterns: [/모나\s*용평|모나용평|용평리조트/],
        value: {
            venue: '모나용평',
            address: '강원특별자치도 평창군 대관령면 올림픽로 715',
            lat: 37.645263,
            lng: 128.681598,
            region: 'gangwon',
            website: 'https://www.yongpyong.co.kr/',
            contact: '033-335-5757',
        },
    },
    {
        patterns: [/디오션리조트|디오션\s*워터파크|여수.*디오션/],
        value: {
            venue: '디오션리조트',
            address: '전라남도 여수시 소호로 295',
            lat: 34.7324505,
            lng: 127.6439655,
            region: 'jeonnam',
            website: 'https://www.theoceanresort.co.kr/',
        },
    },
    {
        patterns: [/N\s*서울타워/i, /남산.*타워/],
        value: {
            venue: 'N서울타워',
            address: '서울특별시 용산구 남산공원길 105',
            lat: 37.5512168,
            lng: 126.9882475,
            region: 'seoul',
            website: 'https://www.nseoultower.co.kr/',
            contact: '02-3455-9277',
        },
    },
    {
        patterns: [/볼베어파크.*부천|부천.*볼베어파크|웅진플레이도시.*볼베어파크/],
        value: {
            venue: '볼베어파크 부천점',
            address: '경기도 부천시 원미구 조마루로 2 웅진플레이도시 2층 볼베어파크',
            lat: 37.4999701,
            lng: 126.7442353,
            region: 'gyeonggi',
            website: 'http://www.ballbearpark.com',
            contact: '032-322-7760',
        },
    },
    {
        patterns: [/볼베어파크.*은평|은평.*볼베어파크/],
        value: {
            venue: '볼베어파크 은평점',
            address: '서울특별시 은평구 통일로 1050 롯데몰은평점 3층',
            lat: 37.6383707,
            lng: 126.9179678,
            region: 'seoul',
            website: 'https://www.instagram.com/ballbearpark_eunpyeong',
            contact: '02-6975-5363',
        },
    },
    {
        patterns: [/볼베어파크.*천안|천안.*볼베어파크/],
        value: {
            venue: '볼베어파크 천안점',
            address: '충청남도 천안시 동남구 옛시청길 29 힐스테이트 천안 1층',
            lat: 36.807527,
            lng: 127.1505392,
            region: 'chungnam',
            website: 'https://www.instagram.com/ballbearpark_cheonan/',
        },
    },
    {
        patterns: [/세라젬\s*웰파크.*위례|위례.*세라젬\s*웰파크|세라젬웰파크.*위례/],
        value: {
            venue: '세라젬 웰파크 위례점',
            address: '경기도 하남시 위례대로 350 2층 201호~217호, 219호, 220호',
            lat: 37.4891815,
            lng: 127.1583172,
            region: 'gyeonggi',
        },
    },
    {
        patterns: [/세라젬\s*웰파크.*청량리|청량리.*세라젬\s*웰파크|세라젬웰파크.*청량리/],
        value: {
            venue: '세라젬 웰파크 청량리점',
            address: '서울특별시 동대문구 고산자로32길 78 청량리역 한양수자인 그라시엘 B1',
            lat: 37.5773994,
            lng: 127.0428172,
            region: 'seoul',
            website: 'https://www.instagram.com/ceragem_wellpark_3',
        },
    },
    {
        patterns: [/세라젬\s*웰파크.*부산|부산.*세라젬\s*웰파크|세라젬웰파크.*부산|기장.*세라젬/],
        value: {
            venue: '세라젬 웰파크 부산기장점',
            address: '부산광역시 기장군 기장읍 동부산관광1로 60 라우어 오시리아근린생활시설 1동 4층',
            lat: 35.192283,
            lng: 129.2092776,
            region: 'busan',
        },
    },
    {
        patterns: [/항공우주박물관.*종합패키지|사천.*항공우주박물관/],
        value: {
            venue: '항공우주박물관',
            address: '경상남도 사천시 사남면 공단1로 78 항공우주박물관',
            lat: 35.0715185,
            lng: 128.0624397,
            region: 'gyeongnam',
            website: 'http://kaimuseum.co.kr/',
            contact: '055-851-6565',
        },
    },
];

function isKnownSellerAddress(value?: string) {
    const address = compact(value);
    return Boolean(address && SELLER_ADDRESS_PATTERNS.some((pattern) => pattern.test(address)));
}

function getKnownVenue(title: string, brand: string, detailText: string) {
    const haystack = `${title} ${brand} ${detailText}`;
    return KNOWN_VENUES.find((entry) => entry.patterns.some((pattern) => pattern.test(haystack)))?.value;
}

function deriveBranchVenue(title: string, brand: string, detailText: string) {
    const haystack = `${title} ${brand} ${detailText}`;
    const titleBrand = `${title} ${brand}`;
    if (/서울크루즈|크루즈/u.test(titleBrand)) {
        if (/아라김포여객터미널|한강갑문|아라뱃길/u.test(title)) return '현대유람선 아라김포여객터미널';
        if (/여의도\s*터미널|여의도유람선터미널|서울크루즈/u.test(haystack)) return '서울크루즈 여의도유람선터미널';
    }
    const directRules: Array<[RegExp, string]> = [
        [/(?:아쿠아플라넷.*광교|광교.*아쿠아플라넷)/, '아쿠아플라넷 광교'],
        [/(?:아쿠아플라넷.*여수|여수.*아쿠아플라넷)/, '아쿠아플라넷 여수'],
        [/(?:아쿠아플라넷.*제주|제주.*아쿠아플라넷)/, '아쿠아플라넷 제주'],
        [/(?:아쿠아플라넷.*일산|일산.*아쿠아플라넷)/, '아쿠아플라넷 일산'],
        [/(?:키자니아.*서울|서울점\s*:\s*서울시 송파구)/, '키자니아 서울'],
        [/(?:키자니아.*부산|부산점\s*\*?\s*주소\s*:\s*부산)/, '키자니아 부산'],
    ];
    for (const [pattern, venue] of directRules) {
        if (pattern.test(haystack)) return venue;
    }

    const branchRules: Array<[RegExp, string]> = [
        [/옐레드\s*([가-힣A-Za-z0-9]+점)/, '옐레드'],
        [/플레이월드\s*([가-힣A-Za-z0-9]+점)/, '플레이월드'],
        [/잭슨나인스\s*([가-힣A-Za-z0-9]+점)/, '잭슨나인스'],
    ];
    for (const [pattern, prefix] of branchRules) {
        const match = haystack.match(pattern);
        if (match?.[1]) return `${prefix} ${match[1]}`;
    }

    return '';
}

function cleanVenueName(value?: string) {
    const text = compact(value)
        .replace(/^[◆※*\-\s]+/, '')
        .replace(/\s*\(.*?필수.*?\)\s*/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    if (!text || text.length > 45) return '';
    if (/(구매|환불|유효|운영|안내|필독|사용|발송|권종|방문|홈페이지|티켓)/.test(text)) return '';
    return text;
}

function extractUseVenue(detailText: string) {
    const matches = [
        detailText.match(/(?:이용\s*업체|이용\s*장소|사용\s*처|방문\s*장소)\s*[:：]\s*([^◆\n\r]+)/),
        detailText.match(/(?:업체명|장소명)\s*[:：]\s*([^◆\n\r]+)/),
    ];
    return cleanVenueName(matches.find(Boolean)?.[1]);
}

const ADDRESS_REGION_PATTERN = '(?:서울특별시|서울시|서울|부산광역시|부산|대구광역시|대구|인천광역시|인천|광주광역시|광주|대전광역시|대전|울산광역시|울산|세종특별자치시|세종|경기도|경기|강원특별자치도|강원도|강원|충청북도|충북|충청남도|충남|전북특별자치도|전라북도|전북|전라남도|전남|경상북도|경북|경상남도|경남|제주특별자치도|제주|김포시|고양시|파주시|남양주시|하남시|용인시|평택시|부천시|달성군|달서구|사천시|양산시|창원시)';
const ADDRESS_STOP_PATTERN = /(?:\*|\[|문의전화|문의\s*:|업체번호|홈페이지|연락처|운영시간|이용시간|휴무|휴일|주차|전화\s*:|매표마감|판매자|취소|환불|상담시간)/;

function cleanAddressCandidate(value?: string) {
    let address = compact(value)
        .replace(/&amp;/g, '&')
        .replace(/^[\s:：*\-\]]+/, '')
        .replace(/^(?:서울점|부산점|대구점|세종점|제주점)\s*[:：-]?\s*/u, '')
        .replace(/^(?:업체주소|주소|시설주소)\s*[:：-]?\s*/u, '');
    const labelIndex = address.search(/(?:업체주소|주소|시설주소)\s*[:：-]?\s*/u);
    if (labelIndex >= 0) {
        address = address.slice(labelIndex).replace(/^(?:업체주소|주소|시설주소)\s*[:：-]?\s*/u, '');
    }

    const regionIndex = address.search(new RegExp(ADDRESS_REGION_PATTERN));
    if (regionIndex > 0) address = address.slice(regionIndex);
    const stopIndex = address.search(ADDRESS_STOP_PATTERN);
    if (stopIndex > 0) address = address.slice(0, stopIndex);
    address = compact(address)
        .replace(/^[\s:：*\-\]]+/, '')
        .replace(/\s*[.,;]+$/u, '')
        .replace(/\s*\)\s*$/u, ')');

    if (!address || address.length > 120) return '';
    if (!/(?:로|길|대로|번길|읍|동|리)\s*\d|[가-힣]+시\s+[가-힣]+/u.test(address)) return '';
    return isKnownSellerAddress(address) ? '' : address;
}

function scoreAddressCandidate(candidate: { value: string; context: string }, preferredVenue: string, title: string) {
    const value = candidate.value;
    const context = candidate.context;
    let score = 0;
    if (preferredVenue && context.includes(preferredVenue)) score += 8;
    const branchWords = Array.from(new Set([
        ...preferredVenue.split(/\s+/),
        ...Array.from(title.matchAll(/([가-힣A-Za-z0-9]+점|광교|여수|제주|일산|아라김포|여의도|평택|용인|부천|대구|마곡|노원|서초|수지|하남|미사|세종|창원|양산)/g)).map((match) => match[1]),
    ].map(compact).filter((word) => word.length >= 2)));
    for (const word of branchWords) {
        if (context.includes(word)) score += 2;
        if (value.includes(word)) score += 1;
    }
    if (/특별시|광역시|특별자치시|특별자치도|경기도|전라남도|경상남도|충청남도|강원특별자치도/u.test(value)) score += 1;
    return score;
}

function extractAddressFromDetailText(detailText: string, preferredVenue = '', title = '') {
    const candidates: Array<{ value: string; context: string }> = [];
    const labelRe = /(?:업체주소|시설주소|주소)\s*[:：-]?\s*([^*\[]+)/g;
    let labelMatch: RegExpExecArray | null;
    while ((labelMatch = labelRe.exec(detailText))) {
        const value = cleanAddressCandidate(labelMatch[1]);
        if (!value) continue;
        const contextStart = Math.max(0, labelMatch.index - 90);
        candidates.push({ value, context: detailText.slice(contextStart, labelRe.lastIndex + 60) });
    }

    if (candidates.length === 0) {
        const road = new RegExp(`${ADDRESS_REGION_PATTERN}[^*\\[\\n]{0,100}(?:로|길|대로|번길)\\s*\\d+(?:[^*\\[\\n]{0,45})?`, 'g');
        let match: RegExpExecArray | null;
        while ((match = road.exec(detailText))) {
            const value = cleanAddressCandidate(match[0]);
            if (!value) continue;
            candidates.push({ value, context: detailText.slice(Math.max(0, match.index - 80), road.lastIndex + 50) });
        }
    }

    const uniqueCandidates = Array.from(
        new Map(candidates.map((candidate) => [normalizeKey(candidate.value), candidate])).values()
    );
    uniqueCandidates.sort((a, b) => scoreAddressCandidate(b, preferredVenue, title) - scoreAddressCandidate(a, preferredVenue, title));
    return uniqueCandidates[0]?.value || '';
}

function extractHomepage(detailText: string) {
    const match = detailText.match(/(?:https?:\/\/|www\.)[^\s"'<>*\[]+/i);
    const url = compact(match?.[0] || '').replace(/[.)\]*]+$/, '');
    return url && url.startsWith('www.') ? `https://${url}` : url;
}

function extractLabelValue(detailText: string, labels: string[], limit = 240) {
    const escaped = labels.map((label) => label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
    const re = new RegExp(`(?:^|\\*|\\[|\\s)(?:${escaped})\\s*(?:[:：\\-\\]]|$)\\s*([^*\\[]+)`, 'gi');
    const candidates: Array<{ value: string; score: number }> = [];
    let match: RegExpExecArray | null;
    while ((match = re.exec(detailText))) {
        const value = compact(match[1])
            .replace(/\s*[.\]]$/u, '')
            .slice(0, limit)
            .trim();
        if (!value) continue;
        let score = 0;
        const context = detailText.slice(Math.max(0, match.index - 80), re.lastIndex + 40);
        if (/업체정보|시설명|업체명/u.test(context)) score += 4;
        if (/\d{1,2}\s*[:시]/u.test(value)) score += 3;
        if (/무료|가능|불가|연중무휴|정기\s*휴무/u.test(value)) score += 1;
        if (/문의|확인|고객센터|홈페이지/u.test(value)) score -= 2;
        candidates.push({ value, score });
    }
    candidates.sort((a, b) => b.score - a.score);
    return candidates[0]?.value || '';
}

function extractOperatingHours(detailText: string) {
    const value = extractLabelValue(detailText, ['운영시간', '이용시간', '승선일시', '등원시간'], 360);
    if (!value) return '';
    if (/상품상세|참조|확인/i.test(value) && value.length < 20) return '';
    return value;
}

function extractParking(detailText: string) {
    return extractLabelValue(detailText, ['주차정보', '주차안내', '주차'], 260);
}

function extractClosedDays(detailText: string) {
    return extractLabelValue(detailText, ['휴무일', '휴무', '휴일', '쉬는날'], 160);
}

function extractDetailContact(detailText: string) {
    const value = extractLabelValue(detailText, ['문의전화', '업체번호', '연락처', '전화'], 80);
    return formatPhone(value.match(/(\d[\d\s-]{6,}\d)/)?.[1] || value);
}

function extractDetailFacility(detailText: string) {
    return extractLabelValue(detailText, ['편의시설', '주요시설', '어트랙션 운영시간', '시설'], 260);
}

function extractDetailPrice(detailText: string) {
    const value = extractLabelValue(detailText, ['이용요금', '입장료', '관람료', '요금', '가격'], 260);
    return /원|무료|할인|대인|소인|어린이|성인/u.test(value) ? value : '';
}

function formatDetailTextForDisplay(value: string) {
    const text = compact(value)
        .replace(/\s*\[([^\]]+)\]\s*/g, '\n[$1]\n')
        .replace(/\s*\*\s*/g, '\n- ')
        .replace(/\n{3,}/g, '\n\n')
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .join('\n');
    return text.replace(/(?:\n-\s*){2,}/g, '\n- ');
}

function computeDiscount(product: ShopProduct) {
    const base = product.salePrice || 0;
    const discountAmt =
        (product.immediateDiscountAmt || 0) +
        (product.additionDiscountAmt || 0) +
        (product.couponDiscountAmt || 0);
    const finalPrice = Math.max(0, base - discountAmt);
    const rate = base > 0 && finalPrice > 0 && finalPrice < base
        ? Math.round((1 - finalPrice / base) * 100)
        : 0;
    return { base, finalPrice: finalPrice || base, discountAmt, rate };
}

function buildPriceDetail(product: ShopProduct, finalPriceText: string, originalPriceText: string) {
    const lines = [
        originalPriceText ? `정상가: ${originalPriceText}` : '',
        product.immediateDiscountAmt ? `상품 할인: -${toCurrency(product.immediateDiscountAmt)}` : '',
        product.additionDiscountAmt ? `추가 할인: -${toCurrency(product.additionDiscountAmt)}` : '',
        product.couponDiscountAmt ? `쿠폰 할인: -${toCurrency(product.couponDiscountAmt)}` : '',
        product.maxCouponAmt ? `최대 쿠폰 혜택: ${toCurrency(product.maxCouponAmt)}` : '',
        finalPriceText ? `판매가: ${finalPriceText}` : '',
    ].filter(Boolean);
    return lines.join('\n');
}

function getStickerTexts(product: ShopProduct) {
    const objectLabels = (product.stickerInfos || [])
        .map((item) => item.label || item.text || item.name || '')
        .filter(Boolean);
    const labels = (product.stickerLabels || []).filter(Boolean);
    return Array.from(new Set([...objectLabels, ...labels]));
}

function buildProgramInfo(product: ShopProduct) {
    const period = buildDate(product);
    const stock = typeof product.stockCnt === 'number' && product.stockCnt > 0 ? `잔여 재고: ${product.stockCnt.toLocaleString('ko-KR')}개` : '';
    const mainStock = typeof product.mainStockCnt === 'number' && product.mainStockCnt > 0 ? `대표 재고: ${product.mainStockCnt.toLocaleString('ko-KR')}개` : '';
    const review = product.totalReviewCount ? `리뷰: ${product.totalReviewCount.toLocaleString('ko-KR')}건` : '';
    const rating = product.reviewRating ? `평점: ${product.reviewRating}` : '';
    const like = product.likeCount ? `관심: ${product.likeCount.toLocaleString('ko-KR')}명` : '';
    const stickers = getStickerTexts(product);
    const lines = [
        period && period !== '상시운영' ? `판매/이용 기간: ${period}` : '',
        product.productType ? `상품 유형: ${product.productType}` : '',
        stickers.length ? `혜택/라벨: ${stickers.join(', ')}` : '',
        product.shippingArea || product.shippingType || product.shippingFee === 0 ? `배송: ${product.shippingArea || product.shippingType || '무료/상품별 확인'}` : '',
        stock || mainStock,
        review,
        rating,
        like,
    ].filter(Boolean);
    return lines.join('\n');
}

function buildBookingNotice(product: ShopProduct) {
    const notices = [
        compact(product.promotionText || ''),
        compact(product.contentsIfPausing || ''),
    ];
    if (product.reservationData) notices.push('예약형 상품입니다. 구매 전 예약 가능일과 이용 조건을 확인하세요.');
    if (buildDate(product) !== '상시운영') notices.push(`판매/이용 기간: ${buildDate(product)}`);
    return Array.from(new Set(notices.filter(Boolean))).join('\n');
}

function stripHtml(value?: unknown) {
    const html = compact(value || '');
    if (!html) return '';
    const $ = cheerio.load(html.replace(/<br\s*\/?>/gi, '\n'));
    return compact($.root().text().replace(/\u00a0/g, ' '));
}

function truncateText(value: unknown, limit = 1200) {
    const text = compact(value);
    if (text.length <= limit) return text;
    return `${text.slice(0, limit).trim()}...`;
}

function formatPhone(value?: unknown) {
    const digits = compact(value).replace(/\D/g, '');
    if (!digits) return '';
    if (digits.length === 8) return `${digits.slice(0, 4)}-${digits.slice(4)}`;
    if (digits.length === 9) return `${digits.slice(0, 2)}-${digits.slice(2, 5)}-${digits.slice(5)}`;
    if (digits.length === 10) {
        if (digits.startsWith('02')) return `${digits.slice(0, 2)}-${digits.slice(2, 6)}-${digits.slice(6)}`;
        return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
    }
    if (digits.length === 11) return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
    return compact(value);
}

function parseDutyInfo(value?: string) {
    const lines: string[] = [];
    if (!value) return { lines, contact: '' };
    try {
        const parsed = JSON.parse(value) as { categoryName?: string; contents?: Array<Record<string, string>> };
        if (parsed.categoryName) lines.push(`상품 고시 분류: ${parsed.categoryName}`);
        for (const entry of parsed.contents || []) {
            for (const [key, rawValue] of Object.entries(entry)) {
                const text = compact(rawValue);
                if (!text || text === '상품상세 참조') continue;
                lines.push(`${compact(key)}: ${text}`);
            }
        }
    } catch {
        const text = stripHtml(value);
        if (text) lines.push(text);
    }

    const contactLine = lines.find((line) => /연락처|문의|전화/.test(line)) || '';
    const contact = formatPhone(contactLine.match(/(\d[\d\s-]{6,}\d)/)?.[1] || '');
    return { lines, contact };
}

function extractFlightText(html: string) {
    const re = /<script>(?:self\.__next_f\.push\((\[[\s\S]*?\])\))<\/script>/g;
    let match: RegExpExecArray | null;
    let text = '';
    while ((match = re.exec(html))) {
        try {
            const chunk = JSON.parse(match[1]);
            if (typeof chunk[1] === 'string') text += chunk[1];
        } catch {
            // Ignore malformed chunks; the product object is duplicated across valid chunks.
        }
    }
    return text;
}

function extractBalancedObject(text: string, start: number) {
    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let index = start; index < text.length; index += 1) {
        const char = text[index];
        if (inString) {
            if (escaped) escaped = false;
            else if (char === '\\') escaped = true;
            else if (char === '"') inString = false;
            continue;
        }

        if (char === '"') {
            inString = true;
            continue;
        }
        if (char === '{') depth += 1;
        else if (char === '}') {
            depth -= 1;
            if (depth === 0) return text.slice(start, index + 1);
        }
    }

    return '';
}

function resolveFlightReference(text: string, reference?: string) {
    if (!reference?.startsWith('$')) return reference || '';
    const ref = reference.slice(1);
    const marker = `${ref}:`;
    const start = text.indexOf(marker);
    if (start < 0) return '';
    const afterMarker = text.slice(start + marker.length);
    const textRecord = afterMarker.match(/^T([0-9a-fA-F]+),/);
    if (textRecord) {
        const byteLength = Number.parseInt(textRecord[1], 16);
        const contentStart = textRecord[0].length;
        let cursor = contentStart;
        let consumed = 0;
        while (cursor < afterMarker.length && consumed < byteLength) {
            const codePoint = afterMarker.codePointAt(cursor);
            if (codePoint === undefined) break;
            const char = String.fromCodePoint(codePoint);
            consumed += Buffer.byteLength(char, 'utf8');
            cursor += char.length;
        }
        return afterMarker.slice(contentStart, cursor);
    }
    const next = afterMarker.search(/\n\d+:/);
    return next >= 0 ? afterMarker.slice(0, next) : afterMarker;
}

function extractProductDetailFromFlight(text: string): ShopProductDetail | null {
    const productIndex = text.indexOf('"product":');
    if (productIndex < 0) return null;
    const start = text.indexOf('{', productIndex + '"product":'.length);
    if (start < 0) return null;
    const raw = extractBalancedObject(text, start);
    if (!raw) return null;
    try {
        const product = JSON.parse(raw) as ShopProductDetail;
        if (product.baseInfo?.content?.startsWith('$')) {
            product.baseInfo.content = resolveFlightReference(text, product.baseInfo.content);
        }
        return product;
    } catch {
        return null;
    }
}

async function fetchProductDetail(productNo: number) {
    const response = await fetch(`${BASE_URL}/shop/products/${productNo}`, {
        headers: {
            accept: 'text/html,application/xhtml+xml',
            'accept-language': 'ko-KR,ko;q=0.9',
            'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) CultureFlowBot/1.0',
        },
    });
    if (!response.ok) throw new Error(`MomMom detail failed: ${response.status} ${response.statusText}`);
    const html = await response.text();
    const detail = extractProductDetailFromFlight(extractFlightText(html));
    if (!detail) return null;

    // 진짜 상품 상세 이미지는 판매자가 등록한 detail.baseInfo.contentHeader / content / contentFooter
    // HTML 안의 <img>만 사용한다. 페이지 전체에는 events/* 광고 배너가 섞여 있어 신뢰할 수 없다.
    const detailContentHtml = [
        detail.baseInfo?.contentHeader,
        detail.baseInfo?.content,
        detail.baseInfo?.contentFooter,
    ]
        .filter((part): part is string => Boolean(part && part.trim()))
        .join('\n');
    const detailImages = extractImagesFromDetailContentHtml(detailContentHtml);

    return { ...detail, detailImages };
}

async function enrichProductDetails(products: ShopProduct[]) {
    const details = new Map<number, ShopProductDetail>();
    const concurrency = 5;

    for (let index = 0; index < products.length; index += concurrency) {
        const chunk = products.slice(index, index + concurrency);
        const settled = await Promise.all(chunk.map(async (product) => {
            if (!product.productNo) return null;
            try {
                const detail = await fetchProductDetail(product.productNo);
                return detail ? { productNo: product.productNo, detail } : null;
            } catch (error) {
                console.warn(`[mommom-detail] failed ${product.productNo}: ${error instanceof Error ? error.message : error}`);
                return null;
            }
        }));

        for (const item of settled) {
            if (item) details.set(item.productNo, item.detail);
        }
        await new Promise((resolve) => setTimeout(resolve, 150));
    }

    return details;
}

function getSellerAddress(detail?: ShopProductDetail | null) {
    const officeAddressText = (detail?.partner?.officeAddressLabel || '')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<[^>]*>/g, '')
        .replace(/\u00a0/g, ' ');
    const officeAddress = officeAddressText
        .replace(/^\(\d{5}\)\s*/, '')
        .split(/\n/)
        .map(compact)
        .find((line) => /[가-힣]+(시|도|군|구).*(로|길|동|리)\s*\d?/.test(line));
    if (officeAddress) return officeAddress;

    const warehouseAddress = compact(detail?.deliveryFee?.returnWarehouse?.addressStr);
    if (warehouseAddress) return warehouseAddress;

    const warehouseParts = [
        detail?.deliveryFee?.returnWarehouse?.address,
        detail?.deliveryFee?.returnWarehouse?.detailAddress,
    ].map(compact).filter(Boolean);
    return warehouseParts.join(' ');
}

function buildDetailDescription(product: ShopProduct, detail?: ShopProductDetail | null) {
    const rawContent = stripHtml([
        detail?.baseInfo?.contentHeader,
        detail?.baseInfo?.content,
        detail?.baseInfo?.contentFooter,
    ].filter(Boolean).join('\n'));
    const contentText = truncateText(formatDetailTextForDisplay(rawContent), 1400);
    return contentText || compact(product.promotionText) || `${compact(product.brandNameKo || product.partnerName)}에서 제공하는 맘맘 핫딜 상품입니다.`;
}

function buildDetailInfoLines(product: ShopProduct, detail?: ShopProductDetail | null) {
    const duty = parseDutyInfo(detail?.baseInfo?.dutyInfo);
    const categories = (detail?.categories || [])
        .map((category) => compact(category.fullCategoryLabel))
        .filter(Boolean);
    const lines = [
        categories.length ? `카테고리: ${Array.from(new Set(categories)).join(', ')}` : '',
        detail?.baseInfo?.placeOriginLabel ? `지역/원산지: ${detail.baseInfo.placeOriginLabel}` : '',
        ...duty.lines,
        detail?.deliveryFee?.defaultDeliveryConditionLabel ? `배송/전달: ${detail.deliveryFee.defaultDeliveryConditionLabel}` : '',
        detail?.deliveryFee?.deliveryTemplateName ? `전달 템플릿: ${detail.deliveryFee.deliveryTemplateName}` : '',
        detail?.limitations?.refundable === false ? '환불: 제한 있음' : '',
        product.reservationData || detail?.reservationData ? '예약형 상품입니다. 구매 전 예약 가능일과 이용 조건을 확인하세요.' : '',
    ].filter(Boolean);
    return Array.from(new Set(lines)).join('\n');
}

function buildSynopsisImages(product: ShopProduct, detail: ShopProductDetail | undefined, representativeImage: string, cache: ExistingItem) {
    const cachedImages = Array.isArray(cache.synopsisImages)
        ? cache.synopsisImages.filter((image: unknown): image is string => typeof image === 'string')
        : [];
    const productImages = [
        ...(product.imageUrls || []),
        ...(product.listImageUrls || []),
    ].map((image) => toImageUrl(image));
    const representativeKey = getImageDedupeKey(representativeImage);
    const seen = new Set<string>();
    const images: string[] = [];

    // 우선순위:
    //   1) detail.baseInfo.content* HTML에서 추출한 실제 판매자 상세 이미지(detail.detailImages)
    //   2) 상품 카드 갤러리(product.imageUrls / listImageUrls)
    //   3) 캐시된 이전 결과(레거시 데이터; 광고일 가능성 있어 강력 필터링)
    for (const candidate of [
        ...(detail?.detailImages || []),
        ...productImages,
        ...cachedImages,
    ]) {
        if (!candidate || typeof candidate !== 'string') continue;

        const image = candidate.startsWith(MOMMOM_IMAGE_PREFIX)
            ? normalizeMomMomImageUrl(candidate, 1080)
            : toImageUrl(candidate);
        if (!image) continue;

        // 광고/이벤트/큐레이션 자산은 상세 이미지로 취급하지 않는다.
        // (기존 캐시(mommom-products.json)에 events/* 키가 다수 누적되어 있으므로 반드시 필터링)
        const payload = parseMomMomImagePayload(image);
        if (payload?.key && isMomMomAdAssetKey(payload.key)) continue;

        const key = getImageDedupeKey(image);
        if (!key || key === representativeKey || seen.has(key)) continue;

        seen.add(key);
        images.push(image);
    }

    return images.slice(0, 12);
}

function buildDetailBookingNotice(product: ShopProduct, detail?: ShopProductDetail | null) {
    const baseNotice = buildBookingNotice(product);
    const notices = [
        baseNotice,
        stripHtml(detail?.partnerNotice),
        stripHtml(detail?.deliveryGuide),
        stripHtml(detail?.afterServiceGuide),
        stripHtml(detail?.refundGuide),
        stripHtml(detail?.exchangeGuide),
    ].map((notice) => truncateText(notice, 500)).filter(Boolean);
    return Array.from(new Set(notices)).join('\n');
}

function loadExisting(outputFile: string) {
    const byProductNo = new Map<string, ExistingItem>();
    const byTitle = new Map<string, ExistingItem>();
    const byVenue = new Map<string, ExistingItem>();
    if (!fs.existsSync(outputFile)) return { byProductNo, byTitle, byVenue };
    try {
        const items = JSON.parse(fs.readFileSync(outputFile, 'utf8'));
        if (!Array.isArray(items)) return { byProductNo, byTitle, byVenue };
        for (const item of items) {
            const productNo = String(item.productNo || item.link?.match(/products\/(\d+)/)?.[1] || '');
            if (productNo) byProductNo.set(productNo, item);
            if (item.title) byTitle.set(normalizeKey(item.title), item);
            if (item.venue) byVenue.set(normalizeKey(item.venue), item);
        }
    } catch {
        // Ignore malformed cache and continue with a clean scrape.
    }
    return { byProductNo, byTitle, byVenue };
}

async function fetchProducts(categoryNo: string) {
    const firstUrl = new URL(API_URL);
    firstUrl.searchParams.set('categoryNos', categoryNo);
    firstUrl.searchParams.set('filter.keywords', '');
    firstUrl.searchParams.set('filter.soldout', 'false');
    firstUrl.searchParams.set('order.by', 'POPULAR');
    firstUrl.searchParams.set('order.direction', 'DESC');
    firstUrl.searchParams.set('pageNumber', '1');
    firstUrl.searchParams.set('pageSize', '30');

    const first = await fetchJson(firstUrl);
    const pageCount = Math.max(1, first.pageCount || 1);
    const products = [...(first.items || [])];

    for (let pageNumber = 2; pageNumber <= pageCount; pageNumber += 1) {
        const url = new URL(firstUrl);
        url.searchParams.set('pageNumber', String(pageNumber));
        const page = await fetchJson(url);
        products.push(...(page.items || []));
        await new Promise((resolve) => setTimeout(resolve, 120));
    }

    return products;
}

async function fetchJson(url: URL): Promise<ShopApiResponse> {
    const response = await fetch(url, {
        headers: {
            accept: 'application/json',
            'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) CultureFlowBot/1.0',
            referer: `${BASE_URL}/shop/categories/${DEFAULT_CATEGORY_NO}`,
        },
    });
    if (!response.ok) {
        throw new Error(`MomMom shop API failed: ${response.status} ${response.statusText}`);
    }
    return response.json() as Promise<ShopApiResponse>;
}

export async function scrapeMomMomShopProducts(options: ScrapeOptions) {
    const categoryNo = options.categoryNo || DEFAULT_CATEGORY_NO;
    const outputFile = path.resolve(process.cwd(), options.outputFile);
    const existing = loadExisting(outputFile);
    const products = await fetchProducts(categoryNo);
    console.log(`Fetching MomMom detail pages for ${products.length.toLocaleString('ko-KR')} products...`);
    const detailByProductNo = await enrichProductDetails(products);
    const seen = new Set<number>();

    const items = products
        .filter((product) => {
            if (!product.productNo || seen.has(product.productNo)) return false;
            seen.add(product.productNo);
            return true;
        })
        .map((product) => {
            const detail = detailByProductNo.get(product.productNo);
            const title = compact(product.productName) || `맘맘 상품 ${product.productNo}`;
            const brand = compact(detail?.brand?.nameKo || detail?.brand?.name || product.brandNameKo || product.partnerName) || title;
            const link = `${BASE_URL}/shop/products/${product.productNo}`;
            const cache =
                existing.byProductNo.get(String(product.productNo)) ||
                existing.byTitle.get(normalizeKey(title)) ||
                existing.byVenue.get(normalizeKey(brand)) ||
                {};
            const { base, finalPrice, discountAmt, rate } = computeDiscount(product);
            const price = toCurrency(finalPrice) || (typeof cache.price === 'string' ? cache.price : '');
            const originalPrice = toCurrency(base) || (typeof cache.originalPrice === 'string' ? cache.originalPrice : '');
            // 좌측 메인 이미지(modal hero)는 가능한 한 큰 원본을 쓴다.
            // listImageUrls는 카테고리 리스트용 작은 썸네일(720x320 등)이라 모달에서 확대되면 깨져 보이므로
            // imageUrls(상품 갤러리 메인, 보통 1000x1000)를 우선적으로 사용한다.
            const heroCandidates = [
                ...(product.imageUrls || []),
                ...(product.listImageUrls || []),
            ]
                .map((url) => compact(url))
                .filter(Boolean);
            const preferredHero = pickLargestImage(heroCandidates);
            const image = toImageUrl(preferredHero) || cache.image || '';
            const synopsisImages = buildSynopsisImages(product, detail, image, cache);
            const date = buildDate(product);
            const priceDetail = buildPriceDetail(product, price, originalPrice);
            const detailInfo = buildDetailInfoLines(product, detail);
            const feesAndPrograms = [detailInfo, buildProgramInfo(product)].filter(Boolean).join('\n');
            const bookingNotice = buildDetailBookingNotice(product, detail);
            const description = buildDetailDescription(product, detail);
            const detailText = stripHtml([
                detail?.baseInfo?.contentHeader,
                detail?.baseInfo?.content,
                detail?.baseInfo?.contentFooter,
                detail?.baseInfo?.dutyInfo,
            ].filter(Boolean).join('\n'));
            const knownVenue = getKnownVenue(title, brand, detailText);
            const branchVenue = deriveBranchVenue(title, brand, detailText);
            const useVenue = extractUseVenue(detailText);
            const sellerAddress = getSellerAddress(detail);
            const displayVenue = knownVenue?.venue || branchVenue || useVenue || brand;
            const detailAddress = knownVenue?.address || extractAddressFromDetailText(detailText, displayVenue, title);
            const cachedAddress = typeof cache.address === 'string' ? compact(cache.address) : '';
            const safeCachedAddress = isKnownSellerAddress(cachedAddress) ? '' : cachedAddress;
            const address = detailAddress || safeCachedAddress;
            const venue = displayVenue;
            const regionSeed = `${title} ${venue} ${brand} ${address}`;
            const normalizedCacheAddress = normalizeKey(cachedAddress);
            const normalizedAddress = normalizeKey(address);
            const canReuseCacheCoordinate = normalizedCacheAddress && normalizedAddress && (
                normalizedCacheAddress.includes(normalizedAddress) ||
                normalizedAddress.includes(normalizedCacheAddress)
            );
            const lat = knownVenue?.lat ?? (canReuseCacheCoordinate
                ? (typeof cache.lat === 'number' ? cache.lat : (typeof cache.latitude === 'number' ? cache.latitude : undefined))
                : undefined);
            const lng = knownVenue?.lng ?? (canReuseCacheCoordinate
                ? (typeof cache.lng === 'number' ? cache.lng : (typeof cache.longitude === 'number' ? cache.longitude : undefined))
                : undefined);
            const duty = parseDutyInfo(detail?.baseInfo?.dutyInfo);
            const operatingHours = extractOperatingHours(detailText);
            const parking = extractParking(detailText);
            const closedDays = extractClosedDays(detailText);
            const facilities = extractDetailFacility(detailText);
            const extractedPriceDetail = extractDetailPrice(detailText);
            const contact = knownVenue?.contact || extractDetailContact(detailText) || duty.contact || formatPhone(detail?.partner?.phoneNo);
            const officialWebsite = knownVenue?.website || extractHomepage(detailText);
            const enrichedDetailLines = [
                operatingHours ? `운영시간: ${operatingHours}` : '',
                closedDays ? `휴무: ${closedDays}` : '',
                parking ? `주차: ${parking}` : '',
                facilities ? `시설/프로그램: ${facilities}` : '',
                contact ? `문의: ${contact}` : '',
                officialWebsite ? `공식/상세: ${officialWebsite}` : '',
            ].filter(Boolean);
            const enrichedFeesAndPrograms = Array.from(new Set([
                ...feesAndPrograms.split('\n').filter(Boolean),
                ...enrichedDetailLines,
            ])).join('\n');
            const enrichedPriceDetail = [priceDetail, extractedPriceDetail ? `상세 요금: ${extractedPriceDetail}` : '']
                .filter(Boolean)
                .join('\n');

            return {
                id: `${options.source}_${product.productNo}_${slugify(title)}`,
                productNo: product.productNo,
                title,
                image,
                synopsisImages,
                link,
                date,
                genre: classifyGenre(title, venue, options.defaultGenre),
                region: knownVenue?.region || (address ? extractRegion(address) : extractRegion(regionSeed)),
                venue,
                address,
                lat,
                lng,
                latitude: lat,
                longitude: lng,
                originalPrice,
                price,
                discount: rate ? `${rate}%` : '',
                rate,
                platform: 'mommom',
                source: options.source,
                description,
                priceDetail: enrichedPriceDetail,
                feesAndPrograms: enrichedFeesAndPrograms,
                bookingNotice,
                reservationInfo: product.reservationData || detail?.reservationData ? '예약형 상품' : '',
                sourceUpdatedAt: formatDateTime(detail?.baseInfo?.registerYmdt) || formatDate(product.saleStartYmdt) || '',
                contact,
                website: officialWebsite || link,
                operatingHours,
                parking,
                closedDays,
                facilities,
                sourceUrl: link,
                sellerAddress,
                rawVenue: brand,
                tags: getStickerTexts(product),
                stockInfo: typeof product.stockCnt === 'number' ? `${product.stockCnt.toLocaleString('ko-KR')}개` : '',
                reviewCount: product.totalReviewCount || 0,
                likeCount: product.likeCount || 0,
                discountAmount: discountAmt || undefined,
            };
        });

    fs.mkdirSync(path.dirname(outputFile), { recursive: true });
    fs.writeFileSync(outputFile, JSON.stringify(items, null, 2));
    console.log(`Saved ${items.length} MomMom shop items to ${outputFile}`);
    return items;
}
