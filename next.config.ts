
import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === 'production';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const createWithPWA = require('next-pwa');

const pwaOptions = {
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: !isProd,
  globIgnores: [
    'public/data/**/*.json',
    'public/images/posters/**/*',
    'public/sw *.js',
    'public/.DS_Store',
  ],
};

const nextConfig: NextConfig = {
  output: 'export',
  trailingSlash: true, // Required for GitHub Pages static hosting
  basePath: isProd ? '/culture' : '',
  outputFileTracingRoot: process.cwd(),
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'culture.seoul.go.kr',
      },
      {
        protocol: 'https',
        hostname: 'file.kinolights.com',
      },
      {
        protocol: 'https',
        hostname: 'ticketimage.interpark.com',
      },
      {
        protocol: 'http',
        hostname: 'ticketimage.interpark.com',
      },
      {
        protocol: 'https',
        hostname: 'image.toast.com',
      },
      {
        protocol: 'https',
        hostname: 'ticketlink.co.kr',
      },
      {
        protocol: 'https',
        hostname: 'image.yes24.com',
      },
      {
        protocol: 'http',
        hostname: 'tkfile.yes24.com',
      },
      {
        protocol: 'https',
        hostname: 'cdnticket.melon.co.kr',
      },
    ],
  },
  env: {
    NEXT_PUBLIC_BASE_PATH: isProd ? '/culture' : '',
  },
  turbopack: {},
};

type NextWebpack = NonNullable<NextConfig['webpack']>;
type WebpackConfiguration = Parameters<NextWebpack>[0];
type WebpackConfigContext = Parameters<NextWebpack>[1];

const nextPwaConfig = createWithPWA({
  ...nextConfig,
  pwa: pwaOptions,
});

const nextPwaConfigWithTypes = nextPwaConfig as NextConfig & {
  pwa?: typeof pwaOptions;
  webpack?: (config: WebpackConfiguration, context: WebpackConfigContext) => WebpackConfiguration;
};
const nextPwaWebpack = nextPwaConfigWithTypes.webpack;
delete nextPwaConfigWithTypes.pwa;
const validatedConfig = nextPwaConfigWithTypes;

const finalConfig: NextConfig = {
  ...validatedConfig,
  webpack(config, context) {
    if (!nextPwaWebpack) return config;

    const nextPwaContext = {
      ...context,
      config: {
        ...context.config,
        pwa: pwaOptions,
      },
    } as WebpackConfigContext;

    return nextPwaWebpack(config, nextPwaContext);
  },
};

export default finalConfig;
