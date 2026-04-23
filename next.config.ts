import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: false },
  outputFileTracingRoot: __dirname,
  devIndicators: false,
  serverExternalPackages: ["jiti"],
  experimental: {
    serverActions: { bodySizeLimit: "25mb" },
  },
};

export default config;
