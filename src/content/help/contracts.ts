export type Audience = "owner" | "customer" | "both";

export interface HelpStep {
  stepNumber: number;
  title: string;
  description: string;
  highlightAction?: string;
  tip?: string;
}

export type HelpVisualType =
  | "qr-card"
  | "dish-card"
  | "kds-ticket"
  | "order-stepper"
  | "eight-six-board"
  | "cart-drawer"
  | "service-bell";

export interface HelpVisualMockup {
  type: HelpVisualType;
  caption: string;
  altText: string;
}

export interface HelpCallout {
  type: "hospitality" | "pitfall" | "delight";
  title: string;
  text: string;
}

export interface HelpArticleSection {
  id: string;
  title: string;
  content: string[];
  steps?: HelpStep[];
  proTip?: string;
  callout?: HelpCallout;
}

export interface HelpFaqItem {
  question: string;
  answer: string;
  category?: string;
}

export interface HelpHeroImage {
  src: string;
  alt: string;
  caption?: string;
}

export interface HelpArticle {
  id: string;
  slug: string;
  audience: Audience;
  category: string;
  title: string;
  subtitle: string;
  summary: string;
  readTimeMinutes: number;
  difficulty?: "Quick 2-min Guide" | "Beginner Friendly" | "Comprehensive";
  lastUpdated: string;
  keywords: string[];
  quickSteps: string[];
  heroImage?: HelpHeroImage;
  visualMockup?: HelpVisualMockup;
  sections: HelpArticleSection[];
  faqs: HelpFaqItem[];
  dashboardLink?: {
    label: string;
    href: string;
  };
  relatedArticleSlugs: string[];
}
