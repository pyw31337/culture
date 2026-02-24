
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
  // @ts-ignore - Silence Turbopack warning when custom webpack is used
  turbopack: {},
};

export default withPWA(nextConfig);
