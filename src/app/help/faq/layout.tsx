import type { Metadata } from "next";

// page.tsx is a client component and cannot export metadata, so the FAQ's title, description and
// canonical live in this layout.
export const metadata: Metadata = {
  title: "Frequently Asked Questions — MenuMinute Help Center",
  description:
    "Answers to common questions about MenuMinute QR menus, ordering, Kitchen Pro, billing and guest ordering.",
  alternates: { canonical: "/help/faq" },
  openGraph: {
    title: "MenuMinute Frequently Asked Questions",
    description: "Quick answers for restaurant owners and diners using MenuMinute.",
  },
};

export default function FaqLayout({ children }: { children: React.ReactNode }) {
  return children;
}
