import type { MetadataRoute } from "next";
import { ownerArticles, customerArticles } from "@/content/help";

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
  ];

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

  return [...staticRoutes, ...helpHubs, ...ownerGuideRoutes, ...customerGuideRoutes];
}
