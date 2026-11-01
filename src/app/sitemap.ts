import type { MetadataRoute } from "next";
import { ownerArticles, customerArticles } from "@/content/help";
import { GUIDES } from "@/content/docs/guides";
import { marketingFeatures } from "@/content/marketing/features";
import { industrySolutions } from "@/content/marketing/solutions";

const BASE_URL = "https://food.bababuilds.com";

export default function sitemap(): MetadataRoute.Sitemap {
  // Static marketing & product routes
  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: `${BASE_URL}`,
      changeFrequency: "weekly",
      priority: 1.0,
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
  return [...staticRoutes, ...helpHubs, ...ownerGuideRoutes, ...customerGuideRoutes, ...docsRoutes];
}
