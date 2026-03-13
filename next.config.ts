import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["crypto-js"],
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
