import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === 'production';

const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
});

const nextConfig: NextConfig = {
  output: 'export',
  trailingSlash: true, // Required for GitHub Pages static hosting
  basePath: isProd ? '/culture' : '',
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
    ],
  },
  env: {
    NEXT_PUBLIC_BASE_PATH: isProd ? '/culture' : '',
  },
};

export default withPWA(nextConfig);
