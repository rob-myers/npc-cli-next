import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  pageExtensions: ["js", "jsx", "mdx", "ts", "tsx"],
  output: "export",
  reactStrictMode: false,
  compiler: {
    emotion: true,
  },
  // 🔔 dev only, where turbo runs via `next dev --turbopack`
  experimental: {
    turbo: {
      rules: {
        "**/sh/src/*.sh": {
          loaders: ["raw-loader"],
          as: "*.js",
        },
      },
    },
  },
  // 🔔 build only, because turbopack does not run during build
  webpack(config: import("webpack").Configuration) {
    config.module?.rules?.push({
      test: /\/sh\/src\/.*\.sh$/,
      use: "raw-loader",
    });
    return config;
  },
};

export default nextConfig;
