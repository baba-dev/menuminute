import Link from "next/link";
import { ArrowUpRight, HelpCircle, Mail, MapPin, MessageCircle } from "lucide-react";
import { MarketingPageShell } from "@/components/marketing/pages/marketing-page-shell";
import { marketingMetadata } from "@/lib/marketing/seo";
import { CONTACT_TOPICS, parseContactTopic } from "@/modules/plans/sale";
export const metadata = marketingMetadata({
  title: "Contact MenuMinute — Product and Restaurant Support",
  description:
    "Contact MenuMinute by BabaBuilds for restaurant onboarding, account support or product enquiries.",
  pathname: "/contact",
});
export default async function ContactPage({
  searchParams,
}: {
  searchParams: Promise<{ topic?: string | string[] }>;
}) {
  // Only known topics are honoured, so the query string can never inject text into the page or mail link.
  const topic = parseContactTopic((await searchParams).topic);
  const enquiry = topic ? CONTACT_TOPICS[topic] : null;
  const subject = encodeURIComponent(enquiry?.subject ?? "MenuMinute enquiry");
  return (
    <MarketingPageShell>
      <section className="border-border via-background border-b bg-gradient-to-br from-amber-500/10 to-orange-500/10 px-5 py-20">
        <div className="mx-auto max-w-5xl">
          <p className="text-xs font-bold tracking-[0.2em] text-orange-700 uppercase dark:text-orange-300">
            Get in touch
          </p>
          <h1 className="font-display mt-5 max-w-3xl text-4xl font-extrabold tracking-tight sm:text-6xl">
            Questions?{" "}
            <span className="text-orange-600 dark:text-orange-400">We’re here to help.</span>
          </h1>
          <p className="text-muted-foreground mt-6 max-w-2xl text-lg leading-8">
            Have a question about creating a free menu, your restaurant account, or the availability
            of ordering and kitchen tools? Reach the MenuMinute team.
          </p>
        </div>
      </section>
      <section className="mx-auto grid max-w-5xl gap-6 px-5 py-16 md:grid-cols-2">
        {enquiry && (
          <aside
            aria-labelledby="contact-topic-heading"
            data-testid="contact-topic"
            className="rounded-2xl border border-orange-500/40 bg-orange-500/10 p-6 md:col-span-2"
          >
            <h2 id="contact-topic-heading" className="font-display text-xl font-bold">
              {enquiry.heading}
            </h2>
            <p className="text-muted-foreground mt-2 leading-7">{enquiry.body}</p>
            <a
              href={`mailto:admin@bababuilds.com?subject=${subject}`}
              className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-orange-600 px-5 py-2 font-semibold text-white hover:bg-orange-700"
            >
              Email us about {enquiry.subject.toLowerCase()}
            </a>
          </aside>
        )}
        <article className="border-border bg-card rounded-3xl border p-7 shadow-sm sm:p-9">
          <Mail className="mb-5 h-8 w-8 text-orange-600" aria-hidden="true" />
          <h2 className="font-display text-2xl font-bold">Email our team</h2>
          <p className="text-muted-foreground mt-3 leading-7">
            For restaurant onboarding, accounts, product questions and general enquiries.
          </p>
          <a
            href={`mailto:admin@bababuilds.com?subject=${subject}`}
            className="mt-6 inline-flex min-h-11 items-center gap-2 font-semibold break-all text-orange-700 underline underline-offset-4 dark:text-orange-300"
          >
            admin@bababuilds.com <ArrowUpRight size={16} aria-hidden="true" />
          </a>
          <p className="text-muted-foreground mt-4 text-sm">
            Never email passwords, one-time codes, payment credentials or API keys.
          </p>
        </article>
        <article className="border-border bg-card rounded-3xl border p-7 shadow-sm sm:p-9">
          <HelpCircle className="mb-5 h-8 w-8 text-orange-600" aria-hidden="true" />
          <h2 className="font-display text-2xl font-bold">Prefer self-service?</h2>
          <p className="text-muted-foreground mt-3 leading-7">
            Step-by-step documentation and common questions are available without signing in.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/help"
              className="inline-flex min-h-11 items-center rounded-xl bg-orange-600 px-5 py-2 font-semibold text-white hover:bg-orange-700"
            >
              Visit Help Center
            </Link>
            <Link
              href="/demo"
              className="border-border hover:bg-muted inline-flex min-h-11 items-center rounded-xl border px-5 py-2 font-semibold"
            >
              Try the demo
            </Link>
          </div>
        </article>
        <div className="bg-muted/50 text-muted-foreground rounded-2xl p-6 md:col-span-2">
          <p className="flex items-center gap-2">
            <MapPin size={18} className="text-orange-600" aria-hidden="true" /> Operated by
            BabaBuilds · Pilani, Rajasthan, India
          </p>
          <p className="mt-2 flex items-center gap-2">
            <MessageCircle size={18} className="text-orange-600" aria-hidden="true" /> For premium
            capability enquiries, include your outlet name and the feature you are interested in.
          </p>
        </div>
      </section>
    </MarketingPageShell>
  );
}
