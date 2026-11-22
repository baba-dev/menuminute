import type { MetadataRoute } from "next";
import { ownerArticles, customerArticles } from "@/content/help";
import { GUIDES } from "@/content/docs/guides";
import { marketingFeatures } from "@/content/marketing/features";
import { industrySolutions } from "@/content/marketing/solutions";

import { PUBLIC_ORIGIN as BASE_URL } from "@/lib/marketing/seo";
import { demoModeEnabled } from "@/modules/demo/ids";
import { listPublishedFoodSitemap } from "@/modules/food-encyclopedia/editorial-service";
import { foodPath } from "@/modules/food-encyclopedia/contracts";

// Never prerendered at build time: the public menu list comes from PostgreSQL.
export const dynamic = "force-dynamic";

// sitemaps.org allows 50,000 URLs per file; keep headroom for the static pages.
const MAX_MENU_URLS = 45000;
const MENU_CACHE_TTL_MS = 10 * 60 * 1000;
let menuCache: { at: number; entries: MetadataRoute.Sitemap } | null = null;

/** Every outlet whose public menu is actually served (active QR, published outlet, active org). */
async function publicMenuEntries(): Promise<MetadataRoute.Sitemap> {
  if (menuCache && Date.now() - menuCache.at < MENU_CACHE_TTL_MS) return menuCache.entries;
  try {
    const { getPool } = await import("@/db");
    const r = await getPool().query<{ token: string; updated_at: Date; is_demo: boolean }>(
      "select token, updated_at, is_demo from app_private.public_menu_sitemap($1)",
      [MAX_MENU_URLS]
    );
    const demoOn = demoModeEnabled();
    const entries: MetadataRoute.Sitemap = r.rows
      // The demo outlet follows its kill switch: off means it is neither served nor advertised.
      .filter((row) => !row.is_demo || demoOn)
      .map((row) => ({
        url: `${BASE_URL}/m/${encodeURIComponent(row.token)}`,
        lastModified: row.updated_at,
        changeFrequency: "weekly",
        priority: 0.5,
      }));
    menuCache = { at: Date.now(), entries };
    return entries;
  } catch {
    // A database outage must not take the sitemap (and the marketing URLs) down with it.
    return menuCache?.entries ?? [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Static marketing & product routes
  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: `${BASE_URL}`,
      changeFrequency: "weekly",
      priority: 1.0,
    },
    {
      url: `${BASE_URL}/brochure`,
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${BASE_URL}/pricing`,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/demo`,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/privacy`,
      changeFrequency: "monthly",
      priority: 0.3,
    },
    {
      url: `${BASE_URL}/terms`,
      changeFrequency: "monthly",
      priority: 0.3,
    },
    {
      url: `${BASE_URL}/delete-account`,
      changeFrequency: "monthly",
      priority: 0.3,
    },
    {
      url: `${BASE_URL}/cookies`,
      changeFrequency: "monthly",
      priority: 0.3,
    },
    {
      url: `${BASE_URL}/refund-policy`,
      changeFrequency: "monthly",
      priority: 0.3,
    },
  ];

  for (const path of ["/about", "/contact", "/docs"]) {
    staticRoutes.push({ url: BASE_URL + path, changeFrequency: "monthly", priority: 0.6 });
  }

  staticRoutes.push({ url: BASE_URL + "/features", changeFrequency: "monthly", priority: 0.9 });
  for (const feature of marketingFeatures) {
    staticRoutes.push({ url: BASE_URL + feature.path, changeFrequency: "monthly", priority: 0.8 });
  }

  staticRoutes.push({ url: BASE_URL + "/solutions", changeFrequency: "monthly", priority: 0.85 });
  for (const solution of industrySolutions) {
    staticRoutes.push({
      url: BASE_URL + "/solutions/" + solution.slug,
      changeFrequency: "monthly",
      priority: 0.8,
    });
  }

  // Help center hubs
  const helpHubs: MetadataRoute.Sitemap = [
    {
      url: `${BASE_URL}/help`,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/help/owner`,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/help/customer`,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/help/faq`,
      changeFrequency: "weekly",
      priority: 0.7,
    },
  ];

  // Individual owner guides
  const ownerGuideRoutes: MetadataRoute.Sitemap = ownerArticles.map((article) => ({
    url: `${BASE_URL}/help/owner/${article.slug}`,
    lastModified: article.lastUpdated,
    changeFrequency: "monthly",
    priority: 0.7,
  }));

  // Individual customer guides
  const customerGuideRoutes: MetadataRoute.Sitemap = customerArticles.map((article) => ({
    url: `${BASE_URL}/help/customer/${article.slug}`,
    lastModified: article.lastUpdated,
    changeFrequency: "monthly",
    priority: 0.7,
  }));

  const docsRoutes: MetadataRoute.Sitemap = GUIDES.map((guide) => ({
    url: BASE_URL + "/docs/" + guide.slug,
    changeFrequency: "monthly",
    priority: 0.6,
  }));
  // Only independently reviewed, explicitly published editorial guides are indexable.
  // Preview/design profiles are NEVER promoted into the sitemap.
  const verifiedFood = await listPublishedFoodSitemap();
  const foodRoutes: MetadataRoute.Sitemap = verifiedFood.map((entry) => ({
    url: BASE_URL + foodPath(entry),
    lastModified: entry.reviewed_at,
    changeFrequency: "monthly",
    priority: 0.65,
  }));
  const foodHubs: MetadataRoute.Sitemap = foodRoutes.length
    ? [
        { url: BASE_URL + "/explore", changeFrequency: "weekly", priority: 0.8 },
        { url: BASE_URL + "/explore/browse", changeFrequency: "weekly", priority: 0.65 },
      ]
    : [];
  const menuRoutes = await publicMenuEntries();
  return [
    ...staticRoutes,
    ...helpHubs,
    ...ownerGuideRoutes,
    ...customerGuideRoutes,
    ...docsRoutes,
    ...foodHubs,
    ...foodRoutes,
    ...menuRoutes,
  ];
}
