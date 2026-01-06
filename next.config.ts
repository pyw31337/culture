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
  basePath: isProd ? '/culture' : '',
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'culture.seoul.go.kr',
      },
    ],
  },
};

export default withPWA(nextConfig);
