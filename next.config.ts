import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin(
  './src/i18n/request.ts'
);

const nextConfig: NextConfig = {
  output: 'export',
  trailingSlash: true,
  basePath: process.env.NODE_ENV === 'production' ? '/culture' : '',
  outputFileTracingRoot: process.cwd(),
  images: {
    unoptimized: true,
    remotePatterns: [
      { protocol: 'https', hostname: 'culture.seoul.go.kr' },
      { protocol: 'https', hostname: 'file.kinolights.com' },
      { protocol: 'https', hostname: 'ticketimage.interpark.com' },
      { protocol: 'http', hostname: 'ticketimage.interpark.com' },
      { protocol: 'https', hostname: 'image.toast.com' },
      { protocol: 'https', hostname: 'ticketlink.co.kr' },
      { protocol: 'https', hostname: 'image.yes24.com' },
      { protocol: 'http', hostname: 'tkfile.yes24.com' },
      { protocol: 'https', hostname: 'cdnticket.melon.co.kr' },
    ],
  },
  env: {
    NEXT_PUBLIC_BASE_PATH: process.env.NODE_ENV === 'production' ? '/culture' : '',
  },
};

export default withNextIntl(nextConfig);
