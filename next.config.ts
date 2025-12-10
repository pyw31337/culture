import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export',
  basePath: '/culture',
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
