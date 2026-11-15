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

export function faqJsonLd(faqs: ReadonlyArray<{ question: string; answer: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: { "@type": "Answer", text: faq.answer },
    })),
  };
}

/** Site-level structured data for the home page. Facts only: no ratings, no unverified profiles. */
export function siteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": PUBLIC_ORIGIN + "/#organization",
        name: "MenuMinute",
        url: PUBLIC_ORIGIN,
        logo: PUBLIC_ORIGIN + "/brand/icons/pwa/icon-512.png",
      },
      {
        "@type": "WebSite",
        "@id": PUBLIC_ORIGIN + "/#website",
        url: PUBLIC_ORIGIN,
        name: "MenuMinute",
        inLanguage: "en",
        publisher: { "@id": PUBLIC_ORIGIN + "/#organization" },
      },
    ],
  };
}
