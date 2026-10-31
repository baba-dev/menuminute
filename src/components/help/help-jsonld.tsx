import React from "react";
import type { HelpArticle, HelpFaqItem } from "@/content/help/contracts";

interface ArticleJsonLdProps {
  article: HelpArticle;
  url: string;
}

export function HelpArticleJsonLd({ article, url }: ArticleJsonLdProps) {
  const schema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: article.title,
    description: article.summary,
    totalTime: `PT${article.readTimeMinutes}M`,
    estimatedCost: {
      "@type": "MonetaryAmount",
      currency: "USD",
      value: "0",
    },
    step: article.quickSteps.map((step, idx) => ({
      "@type": "HowToStep",
      position: idx + 1,
      name: `Step ${idx + 1}`,
      text: step,
      url: `${url}#step-${idx + 1}`,
    })),
    publisher: {
      "@type": "Organization",
      name: "MenuMinute",
      url: "https://food.bababuilds.com",
      logo: {
        "@type": "ImageObject",
        url: "https://food.bababuilds.com/brand/icons/icon-512.png",
      },
    },
  };

  const breadcrumbs = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Help Center",
        item: "https://food.bababuilds.com/help",
      },
      {
        "@type": "ListItem",
        position: 2,
        name: article.audience === "owner" ? "Restaurant Owner Guides" : "Diner Guides",
        item: `https://food.bababuilds.com/help/${article.audience}`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: article.title,
        item: url,
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbs) }}
      />
    </>
  );
}

interface FaqJsonLdProps {
  faqs: HelpFaqItem[];
}

export function FaqJsonLd({ faqs }: FaqJsonLdProps) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: f.answer,
      },
    })),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
