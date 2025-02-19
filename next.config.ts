import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  pageExtensions: ['js', 'jsx', 'mdx', 'ts', 'tsx'],
  output: 'export',
  compiler: {
    emotion: true,
  },
};

export default nextConfig;
