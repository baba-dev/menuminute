import type { Metadata } from "next";
export const PUBLIC_ORIGIN = "https://food.bababuilds.com";
export function marketingMetadata({
  title,
  description,
  pathname,
  image,
  imageAlt,
}: {
  title: string;
  description: string;
  pathname: string;
  image?: string;
  imageAlt?: string;
}): Metadata {
  return {
    title,
    description,
    alternates: { canonical: pathname },
    openGraph: {
      title: title + " | MenuMinute",
      description,
      type: "website",
      url: pathname,
      siteName: "MenuMinute",
      images: [
        {
          url: image || "/brand/social/og-light.webp",
          ...(image ? {} : { width: 1200, height: 630 }),
          alt: imageAlt || "MenuMinute by BabaBuilds",
        },
      ],
    },
    twitter: { card: "summary_large_image", title, description },
  };
}
export function safeJsonLd(data: object): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
