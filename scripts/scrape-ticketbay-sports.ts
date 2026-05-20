import fs from 'fs';
import path from 'path';

type TicketBayCategory = {
    id: number;
    name: string;
    count?: number | null;
    children?: TicketBayCategory[] | null;
};

type TicketBayProduct = {
    price?: number;
    list_price?: number;
    floor?: string;
    grade?: string;
    perform_date?: string;
    start_perform_date?: string;
    depth2_name?: string;
    info_type?: string;
};

const CATEGORY_URL = 'https://www.ticketbay.co.kr/ticketbayApi/content/v1/public/categories';
const PRODUCT_URL = 'https://www.ticketbay.co.kr/ticketbayApi/product/v1/public/products';
const USER_AGENT = 'CultureFlow/1.0 sports ticket reference collector';

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
    const response = await fetch(url, {
        ...init,
        headers: {
            'User-Agent': USER_AGENT,
            ...(init?.headers || {}),
        },
    });

    if (!response.ok) {
        throw new Error(`${response.status} ${response.statusText}: ${url}`);
    }

    return response.json() as Promise<T>;
}

function* walkLeafCategories(category: TicketBayCategory): Generator<TicketBayCategory> {
    const children = category.children || [];
    if (children.length === 0) {
        yield category;
        return;
    }

    for (const child of children) {
        yield* walkLeafCategories(child);
    }
}

const toNumber = (value: unknown) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) && numeric > 0 ? Math.round(numeric) : null;
};

async function collectProducts(categoryId: number) {
    const payload = {
        category_id: categoryId,
        size: 30,
        offset: 0,
        depth1_id: 5,
    };

    const response = await fetchJson<{
        data?: {
            content?: TicketBayProduct[];
            totalElements?: number;
        };
    }>(PRODUCT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });

    return {
        content: response.data?.content || [],
        totalElements: response.data?.totalElements || 0,
    };
}

async function main() {
    const categoryResponse = await fetchJson<{ data: TicketBayCategory[] }>(CATEGORY_URL);
    const sportsRoot = categoryResponse.data.find((category) => category.id === 5 || category.name === '스포츠');

    if (!sportsRoot) {
        throw new Error('TicketBay sports category was not found.');
    }

    const leaves = [...walkLeafCategories(sportsRoot)].filter((category) => (category.count || 0) > 0);
    const references = [];

    for (const category of leaves) {
        try {
            const { content, totalElements } = await collectProducts(category.id);
            const prices = content.map((item) => toNumber(item.price)).filter((value): value is number => value !== null);
            const listPrices = content.map((item) => toNumber(item.list_price)).filter((value): value is number => value !== null);
            const events = new Map<string, {
                date: string;
                opponent: string;
                saleCount: number;
                minPrice: number | null;
                maxPrice: number | null;
                minListPrice: number | null;
                grades: Set<string>;
            }>();

            for (const item of content) {
                const date = (item.perform_date || item.start_perform_date || '').slice(0, 10);
                const price = toNumber(item.price);
                if (!date || price === null) continue;

                const opponent = String(item.floor || '').trim();
                const eventKey = `${date}::${opponent}`;
                const event = events.get(eventKey) || {
                    date,
                    opponent,
                    saleCount: 0,
                    minPrice: null,
                    maxPrice: null,
                    minListPrice: null,
                    grades: new Set<string>(),
                };

                event.saleCount += 1;
                event.minPrice = event.minPrice === null ? price : Math.min(event.minPrice, price);
                event.maxPrice = event.maxPrice === null ? price : Math.max(event.maxPrice, price);

                const listPrice = toNumber(item.list_price);
                if (listPrice !== null) {
                    event.minListPrice = event.minListPrice === null ? listPrice : Math.min(event.minListPrice, listPrice);
                }

                if (item.grade) event.grades.add(String(item.grade).trim());
                events.set(eventKey, event);
            }

            references.push({
                categoryId: category.id,
                categoryName: category.name,
                depth2Name: content[0]?.depth2_name || null,
                infoType: content[0]?.info_type || null,
                url: `https://www.ticketbay.co.kr/product/${category.id}/list/0`,
                saleCount: totalElements || category.count || 0,
                sampleCount: content.length,
                minPrice: prices.length ? Math.min(...prices) : null,
                maxPrice: prices.length ? Math.max(...prices) : null,
                minListPrice: listPrices.length ? Math.min(...listPrices) : null,
                opponents: [...new Set(content.map((item) => String(item.floor || '').trim()).filter(Boolean))].slice(0, 20),
                grades: [...new Set(content.map((item) => String(item.grade || '').trim()).filter(Boolean))].slice(0, 20),
                events: [...events.values()]
                    .sort((a, b) => `${a.date}${a.opponent}`.localeCompare(`${b.date}${b.opponent}`))
                    .slice(0, 50)
                    .map((event) => ({
                        ...event,
                        grades: [...event.grades].slice(0, 8),
                    })),
            });

            console.log(`[TicketBay] ${category.id} ${category.name}: ${content.length} samples`);
        } catch (error) {
            console.warn(`[TicketBay] failed ${category.id} ${category.name}:`, error);
        }
    }

    const outPath = path.join(process.cwd(), 'src/data/sports-ticket-reference.json');
    fs.writeFileSync(outPath, `${JSON.stringify({
        generatedAt: new Date().toISOString(),
        source: 'TicketBay public product list',
        sourceUrl: PRODUCT_URL,
        references,
    }, null, 2)}\n`, 'utf-8');
    console.log(`[TicketBay] wrote ${references.length} references to ${outPath}`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
