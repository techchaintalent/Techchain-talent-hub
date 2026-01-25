/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@techchain/db", "@techchain/lib"],
  experimental: {
    serverComponentsExternalPackages: ["@prisma/client", "bullmq"],
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
