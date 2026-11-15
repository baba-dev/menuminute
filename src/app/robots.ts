import type { MetadataRoute } from "next";
import { PUBLIC_ORIGIN } from "@/lib/marketing/seo";

// Crawl policy: marketing, help and public menus are crawlable. Everything behind a session,
// transactional (order tracking, checkout, auth) or work-in-progress is excluded. robots.txt only
// controls crawling; pages that must never be indexed also carry `robots: { index: false }`.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/m/"],
        disallow: [
          "/api/",
          "/admin/",
          "/dashboard/",
          "/kitchen/",
          "/account/",
          "/billing/",
          "/app",
          "/start",
          "/login",
          "/register",
          "/signup",
          "/forgot-password",
          "/reset-password/",
          "/verify-email",
          "/two-factor",
          "/invite/",
          "/join-team/",
          "/onboarding",
          "/offline",
          "/home-v2",
          // Guest order tracking pages carry per-order tokens: never crawl or index them.
          "/m/*/orders/",
        ],
      },
    ],
    sitemap: PUBLIC_ORIGIN + "/sitemap.xml",
    host: PUBLIC_ORIGIN,
  };
}
