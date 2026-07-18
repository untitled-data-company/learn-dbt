/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config, { isServer }) => {
    // DuckDB-WASM and Arrow need these exclusions
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false,
    };
    // Enable async WebAssembly for DuckDB-WASM
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
    };
    // Handle .wasm files as async webassembly modules
    config.module.rules.push({
      test: /\.wasm$/,
      type: "webassembly/async",
    });
    return config;
  },
};

export default nextConfig;
