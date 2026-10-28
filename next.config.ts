import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable React strict mode for development warnings
  reactStrictMode: true,
  output: "standalone",

  // Tailwind's CSS import needs compilation in both next dev and next build.
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        // Do not rename to "*.css": it strips CSS Module exports from "*.module.css".
      },
    },
  },

  // Security headers
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Content-Security-Policy",
            value:
              "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com https://checkout.razorpay.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; connect-src 'self' https://challenges.cloudflare.com https://api.razorpay.com https://checkout.razorpay.com; frame-src https://challenges.cloudflare.com https://api.razorpay.com https://checkout.razorpay.com; font-src 'self' data:; upgrade-insecure-requests",
          },
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
  serverExternalPackages: ["pg", "sharp"],

  // Experimental features
  experimental: {
    agentUpgrade: "security",
    // Server Actions are stable in Next.js 14+
  },
};

export default nextConfig;
