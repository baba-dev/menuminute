import type { Metadata } from "next";
import Link from "next/link";
import { ShieldCheck, CircleHelp, SlidersHorizontal } from "lucide-react";
import { verifySuperAdmin } from "@/lib/admin-guard";
import { env } from "@/lib/config/env";
import { listSubscriptionPlans } from "@/modules/admin/payments.service";
import { kitchenCommercialStatus } from "@/modules/kitchen/activation";
import {
  featureActivationRows,
  type ActivationState,
  type ActivationInputs,
} from "@/modules/admin/feature-activation";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Feature activation | MenuMinute Admin",
  robots: { index: false, follow: false },
};

const stateText: Record<ActivationState, string> = {
  configured: "Configured · verify live operation",
  limited: "Limited rollout",
  unavailable: "Unavailable",
  review: "Approval or verification needed",
  entitled: "Plan and permission controlled",
};

const stateColor: Record<ActivationState, string> = {
  configured: "text-emerald-700 dark:text-emerald-300",
  limited: "text-amber-700 dark:text-amber-300",
  unavailable: "text-rose-700 dark:text-rose-300",
  review: "text-amber-700 dark:text-amber-300",
  entitled: "text-sky-700 dark:text-sky-300",
};

export default async function AdminFeatureActivationPage() {
  const actor = await verifySuperAdmin();
  const [releaseApproved, plans] = await Promise.all([
    kitchenCommercialStatus(actor),
    listSubscriptionPlans(),
  ]);
  const config: ActivationInputs = {
    kitchenRelease: releaseApproved,
    kitchenCatalog: plans.find((p) => p.name === "kitchen_pro")?.isActive === true,
    razorpay: env.RAZORPAY_ENABLED,
    kitchenBilling: env.RAZORPAY_KITCHEN_ENABLED,
    kitchenProviderPlan: Boolean(env.RAZORPAY_PLAN_KITCHEN_ID),
    // Server-side import flags are not a worker heartbeat. Never claim worker readiness.
    importWebEnabled: process.env["MENU_IMPORT_NVIDIA_ENABLED"] === "true",
    importApproved: process.env["NVIDIA_IMPORT_COMMERCIAL_APPROVED"] === "true",
    importModel: /^[A-Za-z0-9._/-]{1,100}$/.test(process.env["NVIDIA_IMPORT_MODEL"] ?? ""),
    importKey: Boolean(process.env["NVIDIA_API_KEY"]),
    conciergeEnabled: env.AI_DINING_CONCIERGE_ENABLED,
    conciergeAll: env.AI_DINING_CONCIERGE_ALL_OUTLETS,
    conciergeOutletCount: env.AI_DINING_CONCIERGE_OUTLET_IDS.length,
    conciergeProvider: Boolean(
      env.AI_FEATURES_ENABLED &&
      env.AI_NVIDIA_ENABLED &&
      env.AI_NVIDIA_COMMERCIAL_APPROVED &&
      env.NVIDIA_API_KEY &&
      env.AI_NVIDIA_MODEL
    ),
    emberRead: env.AI_ASSISTANT_READ_ONLY_ENABLED,
    emberActions: env.AI_ASSISTANT_ACTIONS_ENABLED,
    emberPublish: env.AI_ASSISTANT_PUBLISH_ENABLED,
    emberProviderVerified:
      (env.AI_NVIDIA_ENABLED && env.AI_NVIDIA_TOOLS_VERIFIED) ||
      (env.AI_CLOUDFLARE_ENABLED && env.AI_CLOUDFLARE_TOOLS_VERIFIED),
    pwaOperational: env.PWA_OPERATIONAL_ENABLED,
    pwaOutletCount: env.PWA_OPERATIONAL_OUTLET_IDS.length,
    pwaPush: env.PWA_PUSH_ENABLED,
    pwaPushOutletCount: env.PWA_PUSH_OUTLET_IDS.length,
    pwaVapidConfigured: Boolean(
      env.PWA_PUSH_VAPID_PUBLIC_KEY &&
      env.PWA_PUSH_VAPID_PRIVATE_KEY &&
      env.PWA_PUSH_VAPID_SUBJECT
    ),
  };
  const rows = featureActivationRows(config);
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="flex items-center gap-2 text-xs font-semibold tracking-widest text-orange-700 uppercase dark:text-orange-300">
          <SlidersHorizontal className="size-4" aria-hidden="true" />
          Operator visibility
        </p>
        <h1 className="font-display text-2xl font-bold tracking-tight text-stone-900 dark:text-stone-100">
          Feature Activation
        </h1>
        <p className="max-w-3xl text-sm text-stone-600 dark:text-stone-400">
          A read-only overview of platform and environment prerequisites. Configured
          does not mean a payment, AI request, worker job, or physical device has been
          verified. Live outlet permissions and entitlements remain authoritative.
        </p>
      </header>
      <div className="flex items-start gap-3 rounded-xl border border-stone-200 bg-stone-50 p-4 text-sm text-stone-700 dark:border-stone-800 dark:bg-stone-900 dark:text-stone-300">
        <ShieldCheck className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
        <span>
          This page cannot activate paid plans or relax security gates. Review merchant
          permissions in <Link href="/admin/payments" className="font-semibold underline">Payments &amp; Grants</Link>.
          Keep independent device and billing acceptance documented.
        </span>
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {rows.map((row) => (
          <section
            key={row.id}
            aria-labelledby={`feature-${row.id}`}
            className="flex flex-col justify-between gap-4 rounded-2xl border border-stone-200 bg-white p-5 dark:border-stone-800 dark:bg-stone-900"
          >
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 id={`feature-${row.id}`} className="text-base font-semibold text-stone-900 dark:text-white">
                  {row.title}
                </h2>
                <span className={`text-xs font-semibold ${stateColor[row.state]}`}>
                  {stateText[row.state]}
                </span>
              </div>
              <p className="text-xs font-medium text-stone-500 dark:text-stone-400">
                {row.scope}
              </p>
              <p className="text-sm leading-relaxed text-stone-700 dark:text-stone-300">
                {row.detail}
              </p>
            </div>
            <div className="flex items-start gap-2 border-t border-stone-200 pt-3 text-xs text-stone-600 dark:border-stone-800 dark:text-stone-400">
              <CircleHelp className="size-4 shrink-0" aria-hidden="true" />
              <p>{row.nextStep}</p>
            </div>
          </section>
        ))}
      </div>
      <p className="text-xs text-stone-500 dark:text-stone-400">
        Sensitive API keys, credentials, exact outlet identifiers and payment tokens
        are never included in the diagnostic output. See{" "}
        <Link className="underline" href="/admin/system">System &amp; Queues</Link>
        {" "}for operational health.
      </p>
    </div>
  );
}
