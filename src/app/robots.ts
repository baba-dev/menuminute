import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: [
          "/",
          "/help/",
          "/demo",
          "/pricing",
          "/privacy",
          "/terms",
          "/m/",
        ],
        disallow: [
          "/dashboard/",
          "/kitchen/",
          "/admin/",
          "/api/",
          "/account/",
          "/invite/",
          "/join-team/",
          "/reset-password/",
          "/login",
          "/signup",
          "/onboarding",
        ],
      },
    ],
    sitemap: "https://food.bababuilds.com/sitemap.xml",
  };
}
