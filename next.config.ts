import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable React strict mode for development warnings
  reactStrictMode: true,

  // Security headers
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-DNS-Prefetch-Control", value: "off" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },

  // Image optimization
  images: {
    remotePatterns: [
      // Cloudflare R2 (production media)
      {
        protocol: "https",
        hostname: "*.r2.cloudflarestorage.com",
      },
      // Pexels stock images
      {
        protocol: "https",
        hostname: "images.pexels.com",
      },
    ],
  },

  // External server packages (native modules)
  serverExternalPackages: ["better-sqlite3", "sharp"],

  // Experimental features
  experimental: {
    // Server Actions are stable in Next.js 14+
  },
};

export default nextConfig;
