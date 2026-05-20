
import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === 'production';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const createWithPWA = require('next-pwa');

type RuntimeCachingEntry = {
  urlPattern: RegExp;
  handler: 'CacheFirst' | 'StaleWhileRevalidate' | 'NetworkFirst';
  options?: Record<string, unknown>;
};

const runtimeCaching: RuntimeCachingEntry[] = [
  {
    urlPattern: /\/version\.txt(?:\?.*)?$/i,
    handler: 'NetworkFirst',
    options: {
      cacheName: 'version-check',
      networkTimeoutSeconds: 2,
      cacheableResponse: {
        statuses: [0, 200],
      },
      expiration: {
        maxEntries: 4,
        maxAgeSeconds: 60,
      },
    },
  },
  {
    urlPattern: /\/data\/build-info\.json(?:\?.*)?$/i,
    handler: 'NetworkFirst',
    options: {
      cacheName: 'build-info',
      networkTimeoutSeconds: 2,
      cacheableResponse: {
        statuses: [0, 200],
      },
      expiration: {
        maxEntries: 4,
        maxAgeSeconds: 60,
      },
    },
  },
  {
    urlPattern: /\/data\/(?:performances|cinemas|venues|movies|ott)\.json(?:\?.*)?$/i,
    handler: 'NetworkFirst',
    options: {
      cacheName: 'runtime-data-payloads',
      networkTimeoutSeconds: 2,
      cacheableResponse: {
        statuses: [0, 200],
      },
      expiration: {
        maxEntries: 32,
        maxAgeSeconds: 24 * 60 * 60,
      },
    },
  },
  {
    urlPattern: /\/data\/categories\/[^/]+\.json(?:\?.*)?$/i,
    handler: 'NetworkFirst',
    options: {
      cacheName: 'runtime-data-payloads',
      networkTimeoutSeconds: 2,
      cacheableResponse: {
        statuses: [0, 200],
      },
      expiration: {
        maxEntries: 32,
        maxAgeSeconds: 24 * 60 * 60,
      },
    },
  },
  {
    urlPattern: /^https:\/\/fonts\.(?:googleapis|gstatic)\.com\/.*/i,
    handler: 'CacheFirst',
    options: {
      cacheName: 'google-fonts',
      expiration: {
        maxEntries: 4,
        maxAgeSeconds: 365 * 24 * 60 * 60,
      },
    },
  },
  {
    urlPattern: /^https:\/\/use\.fontawesome\.com\/releases\/.*/i,
    handler: 'CacheFirst',
    options: {
      cacheName: 'font-awesome',
      expiration: {
        maxEntries: 1,
        maxAgeSeconds: 365 * 24 * 60 * 60,
      },
    },
  },
  {
    urlPattern: /\.(?:eot|otf|ttc|ttf|woff|woff2|font.css)$/i,
    handler: 'StaleWhileRevalidate',
    options: {
      cacheName: 'static-font-assets',
      expiration: {
        maxEntries: 4,
        maxAgeSeconds: 7 * 24 * 60 * 60,
      },
    },
  },
  {
    urlPattern: /^https:\/\/wsrv\.nl\/.*/i,
    handler: 'CacheFirst',
    options: {
      cacheName: 'optimized-poster-images',
      cacheableResponse: {
        statuses: [0, 200],
      },
      expiration: {
        maxEntries: 1200,
        maxAgeSeconds: 45 * 24 * 60 * 60,
      },
    },
  },
  {
    urlPattern: /^https?:\/\/(?:www\.)?(?:kopis\.or\.kr|culture\.go\.kr)\/.*/i,
    handler: 'CacheFirst',
    options: {
      cacheName: 'remote-poster-images',
      cacheableResponse: {
        statuses: [0, 200],
      },
      expiration: {
        maxEntries: 1200,
        maxAgeSeconds: 30 * 24 * 60 * 60,
      },
    },
  },
  {
    urlPattern: /^https?:\/\/(?:ticketimage\.interpark\.com|image\.yes24\.com|tkfile\.yes24\.com|cdnticket\.melon\.co\.kr|file\.kinolights\.com|image\.toast\.com|ticketlink\.co\.kr)\/.*/i,
    handler: 'CacheFirst',
    options: {
      cacheName: 'remote-ticket-images',
      cacheableResponse: {
        statuses: [0, 200],
      },
      expiration: {
        maxEntries: 900,
        maxAgeSeconds: 30 * 24 * 60 * 60,
      },
    },
  },
  {
    urlPattern: /^https?:\/\/(?:cdn\.visitkorea\.or\.kr|kfescdn\.visitkorea\.or\.kr|tong\.visitkorea\.or\.kr|api\.visitkorea\.or\.kr)\/.*/i,
    handler: 'CacheFirst',
    options: {
      cacheName: 'remote-tourism-images',
      cacheableResponse: {
        statuses: [0, 200],
      },
      expiration: {
        maxEntries: 900,
        maxAgeSeconds: 30 * 24 * 60 * 60,
      },
    },
  },
  {
    urlPattern: /^https?:\/\/(?:[^/]+\.)?(?:mom-mom\.net|mom-mom\.co\.kr|nhncommerce\.com|firebasestorage\.googleapis\.com)\/.*/i,
    handler: 'CacheFirst',
    options: {
      cacheName: 'remote-family-images',
      cacheableResponse: {
        statuses: [0, 200],
      },
      expiration: {
        maxEntries: 900,
        maxAgeSeconds: 30 * 24 * 60 * 60,
      },
    },
  },
  {
    urlPattern: /\.(?:jpg|jpeg|gif|png|svg|ico|webp)$/i,
    handler: 'StaleWhileRevalidate',
    options: {
      cacheName: 'static-image-assets',
      expiration: {
        maxEntries: 500,
        maxAgeSeconds: 30 * 24 * 60 * 60,
      },
    },
  },
  {
    urlPattern: /\.(?:js)$/i,
    handler: 'StaleWhileRevalidate',
    options: {
      cacheName: 'static-js-assets',
      expiration: {
        maxEntries: 16,
        maxAgeSeconds: 24 * 60 * 60,
      },
    },
  },
  {
    urlPattern: /\.(?:css|less)$/i,
    handler: 'StaleWhileRevalidate',
    options: {
      cacheName: 'static-style-assets',
      expiration: {
        maxEntries: 16,
        maxAgeSeconds: 24 * 60 * 60,
      },
    },
  },
  {
    urlPattern: /.*/i,
    handler: 'NetworkFirst',
    options: {
      cacheName: 'others',
      networkTimeoutSeconds: 3,
      expiration: {
        maxEntries: 16,
        maxAgeSeconds: 60 * 60,
      },
    },
  },
];

const pwaOptions = {
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: !isProd,
  runtimeCaching,
  globIgnores: [
    'public/data/**/*.json',
    'public/version.txt',
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
    qualities: [60, 62, 70, 75],
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
const workboxGlobWarningPattern = /You're using the following Workbox configuration options?: \[(?:globDirectory|globFollow|globIgnores|globPatterns|globStrict)(?:,\s*(?:globDirectory|globFollow|globIgnores|globPatterns|globStrict))*\]/;

function getWebpackWarningMessage(warning: unknown) {
  if (warning instanceof Error) return warning.message;
  if (warning && typeof warning === 'object' && 'message' in warning) {
    return String((warning as { message?: unknown }).message || '');
  }
  return String(warning || '');
}

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

    const updatedConfig = nextPwaWebpack(config, nextPwaContext);
    updatedConfig.ignoreWarnings = [
      ...(updatedConfig.ignoreWarnings || []),
      workboxGlobWarningPattern,
    ];
    updatedConfig.plugins = [
      ...(updatedConfig.plugins || []),
      {
        apply(compiler: {
          hooks: {
            done: {
              tap: (
                pluginName: string,
                callback: (stats: { compilation: { warnings: unknown[] } }) => void
              ) => void;
            };
          };
        }) {
          compiler.hooks.done.tap('SuppressWorkboxGlobWarningPlugin', (stats) => {
            stats.compilation.warnings = stats.compilation.warnings.filter((warning) => (
              !workboxGlobWarningPattern.test(getWebpackWarningMessage(warning))
            ));
          });
        },
      },
    ];

    return updatedConfig;
  },
};

export default finalConfig;
