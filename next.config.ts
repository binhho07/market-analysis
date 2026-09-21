import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["bullmq", "ioredis"],
  eslint: {
    // Allow production builds to successfully complete even if there are ESLint errors
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Allow production builds to successfully complete even if there are type errors
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
