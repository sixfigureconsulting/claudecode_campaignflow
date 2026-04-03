import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["crypto-js"],
  turbopack: {
    root: __dirname,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
      },
    ],
  },
};

export default nextConfig;
