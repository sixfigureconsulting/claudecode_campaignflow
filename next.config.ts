import type { NextConfig } from "next";

const securityHeaders = [
  // Prevent clickjacking — no one can embed this site in an iframe
  { key: "X-Frame-Options", value: "DENY" },
  // Prevent MIME-type sniffing
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Only send referrer on same-origin requests
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Disable browser features we don't use
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
  // Force HTTPS for 1 year (only active in production via HTTPS)
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains; preload" },
  // Basic XSS filter for older browsers
  { key: "X-XSS-Protection", value: "1; mode=block" },
  // Prevent DNS prefetch leaking visited URLs
  { key: "X-DNS-Prefetch-Control", value: "on" },
];

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
  async headers() {
    return [
      {
        // Apply security headers to all routes
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
