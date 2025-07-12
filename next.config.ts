import type { NextConfig } from "next";
import createMDX from "@next/mdx";

const nextConfig: NextConfig = {
  pageExtensions: ["js", "jsx", "mdx", "ts", "tsx"],
  output: process.env.NODE_ENV === 'production' ? "export" : "standalone",
  // distDir: `.next/${process.env.NODE_ENV}`,
  reactStrictMode: false,
  compiler: {
    emotion: true,
  },
  // 🔔 fixes https://github.com/vercel/next.js/issues/76395 after upgrade to next@^15.2.1
  transpilePackages: ['next-mdx-remote'],
  // 🔔 dev only, where turbo runs via `next dev --turbopack`
  experimental: {
    turbo: {
      rules: {
        "**/sh/src/*.sh": {
          loaders: ["raw-loader"],
          as: "*.js",
        },
      },
      // resolveAlias // 🚧 tsconfig paths here?
      // unstablePersistentCaching: true,
    },
  },
  // 🔔 build only, because turbopack does not run during build
  webpack(config: import("webpack").Configuration) {
    config.module?.rules?.push({
      test: /\/sh\/src\/.*\.sh$/,
      use: "raw-loader",
    });
    // if (typeof config.devServer?.client === 'object') {
    //   console.log('🔔', config.devServer.client);
    //   // config.devServer.client.reconnect = true;
    // }
    // config.optimization!.minimizer = [];
    return config;
  },
};

const withMDX = createMDX({
  options: {
    remarkPlugins: [],
    rehypePlugins: [
      // https://shiki.style/themes#themes
      ['rehype-pretty-code' as any, { theme: 'dark-plus' }]
      // ['rehype-pretty-code' as any, { theme: 'github-light-default' }]
    ],
  },
});

export default withMDX(nextConfig);
