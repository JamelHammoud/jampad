const config = {
  reactStrictMode: true,
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: false },
  outputFileTracingRoot: import.meta.dirname,
  devIndicators: false,
  serverExternalPackages: ["jiti"],
  experimental: {
    serverActions: { bodySizeLimit: "25mb" },
  },
};

export default config;
