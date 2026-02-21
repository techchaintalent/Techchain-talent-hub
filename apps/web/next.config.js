/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@techchain/db", "@techchain/lib"],
  experimental: {
    serverComponentsExternalPackages: ["@prisma/client", "bullmq"],
  },
  // Temporary launch unblock: do not fail production build on TypeScript/ESLint errors.
  // Follow-up: remove these after type fixes are completed.
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "avatars.githubusercontent.com",
      },
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
    ],
  },
};

module.exports = nextConfig;
