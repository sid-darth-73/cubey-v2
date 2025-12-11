import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  output: 'export',
  images: {
    unoptimized: true
  },
  basePath: '/cubey-v2',
  assetPrefix: '/cubey-v2/'
};

export default nextConfig;
