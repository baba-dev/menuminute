import type { MetadataRoute } from "next";
import { PUBLIC_ORIGIN } from "@/lib/marketing/seo";

// Crawl policy: marketing, help and public menus are crawlable. Everything behind a session,
// transactional (order tracking, checkout, auth) or work-in-progress is excluded. robots.txt only
// controls crawling; pages that must never be indexed also carry `robots: { index: false }`.
// Private, session-bound and tokenised routes. Repeated for every named crawler below because a
// crawler that matches its own group ignores the "*" group entirely.
const DISALLOW = [
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
];

// Search engines and AI/answer-engine crawlers are all welcome on public pages (owner decision:
// maximise visibility). Named so the intent is explicit and survives a future per-bot rule.
const AI_AND_SEARCH_BOTS = [
  "Googlebot",
  "Google-Extended",
  "Bingbot",
  "DuckDuckBot",
  "Applebot",
  "Applebot-Extended",
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "ClaudeBot",
  "Claude-SearchBot",
  "Claude-User",
  "anthropic-ai",
  "PerplexityBot",
  "Perplexity-User",
  "CCBot",
  "Meta-ExternalAgent",
  "Amazonbot",
  "Bytespider",
  "cohere-ai",
  "YouBot",
  "MistralAI-User",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: ["/", "/m/"], disallow: DISALLOW },
      ...AI_AND_SEARCH_BOTS.map((userAgent) => ({
        userAgent,
        allow: ["/", "/m/"],
        disallow: DISALLOW,
      })),
    ],
    sitemap: PUBLIC_ORIGIN + "/sitemap.xml",
    host: PUBLIC_ORIGIN,
  };
}
