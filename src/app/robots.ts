import { MetadataRoute } from 'next';

export const dynamic = 'force-static';

export default function robots(): MetadataRoute.Robots {
    return {
        rules: {
            userAgent: '*',
            allow: '/',
            disallow: ['/_next/', '/api/'],
        },
        sitemap: 'https://pyw31337.github.io/culture/sitemap.xml',
    };
}
