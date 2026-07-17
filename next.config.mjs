import { fileURLToPath } from "url";
import path from "path";
import { createRequire } from "module";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

/**
 * Resolve a package asset path in a way that works in ESM.
 * We construct the path from the package root instead of using
 * require.resolve (which is not available in ESM modules).
 */
function resolveAsset(pkg, asset) {
  const pkgRoot = path.resolve(__dirname, "node_modules", pkg);
  return path.resolve(pkgRoot, asset);
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      "@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm": resolveAsset(
        "@duckdb/duckdb-wasm",
        "dist/duckdb-mvp.wasm"
      ),
      "@duckdb/duckdb-wasm/dist/duckdb-eh.wasm": resolveAsset(
        "@duckdb/duckdb-wasm",
        "dist/duckdb-eh.wasm"
      ),
      "@duckdb/duckdb-wasm/dist/duckdb-browser-mvp.worker.js": resolveAsset(
        "@duckdb/duckdb-wasm",
        "dist/duckdb-browser-mvp.worker.js"
      ),
      "@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js": resolveAsset(
        "@duckdb/duckdb-wasm",
        "dist/duckdb-browser-eh.worker.js"
      ),
    };
    config.module.rules.push({
      test: /\.wasm$/,
      type: "asset/resource",
    });
    config.module.rules.push({
      test: /\.worker\.js$/,
      type: "asset/resource",
    });
    // Prevent @duckdb/duckdb-wasm from pulling in its Node backend
    // (duckdb-node.cjs), which triggers a "Critical dependency" warning
    // from webpack's dynamic-require scanner and is never used in the browser.
    const webpack = require("webpack");
    config.plugins = config.plugins || [];
    config.plugins.push(
      new webpack.IgnorePlugin({
        resourceRegExp: /duckdb-node\.cjs$/,
      })
    );
    // Suppress the harmless "Critical dependency" warning from duckdb-node.cjs.
    // The Node backend is tree-shaken out of the browser bundle; webpack's
    // static analyser just flags the dynamic require before that happens.
    config.ignoreWarnings = config.ignoreWarnings || [];
    config.ignoreWarnings.push({
      module: /duckdb-node\.cjs$/,
      message: /Critical dependency/,
    });
    return config;
  },
};

export default nextConfig;