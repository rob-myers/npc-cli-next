import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  pageExtensions: ["js", "jsx", "mdx", "ts", "tsx"],
  output: process.env.NODE_ENV === 'production' ? "export" : "standalone",
  // distDir: `.next/${process.env.NODE_ENV}`,
  reactStrictMode: false,
  compiler: {
    emotion: true,
  },
  // httpAgentOptions: {
  //   keepAlive: true,
  // },
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

export default nextConfig;
