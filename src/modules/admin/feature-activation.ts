/** Read-only operator diagnostics. These checks never grant access or validate a live provider. */
export type ActivationState = "configured" | "limited" | "unavailable" | "review" | "entitled";

export type ActivationEntry = {
  id: string;
  title: string;
  state: ActivationState;
  scope: string;
  detail: string;
  nextStep: string;
};

export type ActivationInputs = {
  kitchenRelease: boolean;
  kitchenCatalog: boolean;
  razorpay: boolean;
  kitchenBilling: boolean;
  kitchenProviderPlan: boolean;
  importWebEnabled: boolean;
  importApproved: boolean;
  importModel: boolean;
  importKey: boolean;
  conciergeEnabled: boolean;
  conciergeAll: boolean;
  conciergeOutletCount: number;
  conciergeProvider: boolean;
  emberRead: boolean;
  emberActions: boolean;
  emberPublish: boolean;
  emberProviderVerified: boolean;
  pwaOperational: boolean;
  pwaAllOutlets: boolean;
  pwaOutletCount: number;
  pwaPush: boolean;
  pwaPushAllOutlets: boolean;
  pwaPushOutletCount: number;
  pwaVapidConfigured: boolean;
};

export function featureActivationRows(c: ActivationInputs): ActivationEntry[] {
  const kitchenConfigured =
    c.kitchenRelease && c.kitchenCatalog && c.razorpay && c.kitchenBilling && c.kitchenProviderPlan;
  const importReady = c.importWebEnabled && c.importApproved && c.importModel && c.importKey;
  const conciergeProvider = c.conciergeProvider && c.conciergeEnabled;
  const pwaOn = c.pwaOperational && (c.pwaAllOutlets || c.pwaOutletCount > 0);
  const pushOn =
    c.pwaPush && (c.pwaPushAllOutlets || c.pwaPushOutletCount > 0) && c.pwaVapidConfigured;
  const emberReady = c.emberRead && c.emberProviderVerified;
  return [
    {
      id: "normal-pos",
      title: "Standard POS and cashier shifts",
      state: "entitled",
      scope: "Eligible active outlets",
      detail:
        "Normal POS and cash drawers use server-side plan and outlet permissions, not the advanced finance gate.",
      nextStep: "Verify entitlement and outlet access in the restaurant workspace.",
    },
    {
      id: "kitchen",
      title: "Kitchen Pro commercial checkout",
      state: kitchenConfigured ? "configured" : "review",
      scope: "Platform and paid subscriptions",
      detail: kitchenConfigured
        ? "Global launch, catalog, and provider settings are configured. Actual checkout and webhook delivery have not been tested here."
        : !c.kitchenRelease
          ? "Global Kitchen Pro launch is not approved."
          : !c.kitchenCatalog
            ? "Kitchen Pro is archived in the subscription catalog."
            : "One or more Razorpay Kitchen billing settings are missing.",
      nextStep: kitchenConfigured
        ? "Test paid checkout, signed webhook, entitlement grant and station-ready outlet activation."
        : "Review Kitchen Control Desk, Payments & Grants and protected billing configuration.",
    },
    {
      id: "pos-finance",
      title: "Advanced POS finance and statutory documents",
      state: "review",
      scope: "Separately approved, per outlet",
      detail:
        "Standard POS is independent. Provider settlement and regulated invoices remain subject to distinct fiscal and finance approval.",
      nextStep:
        "Check the selected outlet and approved jurisdiction/provider before any fiscal activation.",
    },
    {
      id: "import",
      title: "AI menu photo extraction",
      state: importReady ? "review" : "unavailable",
      scope: "Worker-backed feature",
      detail: importReady
        ? "Web-side flags and provider inputs are configured; worker environment and a live model request have not been verified."
        : "The web process is missing the import release switch, commercial approval, model or NVIDIA key.",
      nextStep: importReady
        ? "Independently verify worker flags, healthy job delivery and a synthetic extraction."
        : "Configure the matching approved import flags/model/key for web and worker; restart and verify both processes.",
    },
    {
      id: "concierge",
      title: "AI dining concierge",
      state: !conciergeProvider
        ? "unavailable"
        : c.conciergeAll
          ? "configured"
          : c.conciergeOutletCount > 0
            ? "limited"
            : "unavailable",
      scope: c.conciergeAll ? "All published menus" : "Explicit outlet rollout",
      detail: !conciergeProvider
        ? "Guest AI requires approved NVIDIA provider configuration and its independent feature switch."
        : c.conciergeAll
          ? "All-outlet rollout is configured; model response quality and quotas need operational checks."
          : `Configured for ${c.conciergeOutletCount} outlet(s); other outlets remain excluded.`,
      nextStep: "Check the approved NVIDIA model, guest quota, and published-menu smoke test.",
    },
    {
      id: "ember",
      title: "Ember assistant and confirmed actions",
      state: !emberReady ? "unavailable" : c.emberActions ? "review" : "limited",
      scope: "Read, write and publish independently controlled",
      detail: !emberReady
        ? "Ember read-only inference or verified tool-capable provider is unavailable."
        : c.emberActions
          ? c.emberPublish
            ? "Read, confirmed actions, and publish are configured; authorization, usage costs and confirmation remain mandatory."
            : "Read and confirmed actions are configured. Publishing remains separately disabled."
          : "Read-only inference is configured. Confirmed actions and publishing remain disabled.",
      nextStep:
        "Verify approved models, per-model cost ceilings and safe tenant-scoped tool execution before expanding permissions.",
    },
    {
      id: "pwa",
      title: "Operational PWA and offline guest viewing",
      state: pwaOn ? (c.pwaAllOutlets ? "configured" : "limited") : "unavailable",
      scope: c.pwaAllOutlets ? "All outlets" : "Physical-device pilot",
      detail: !pwaOn
        ? "Operational offline features are not enabled for an approved outlet."
        : c.pwaAllOutlets
          ? "Enabled for all outlets; device behaviour still needs real-device verification."
          : `Enabled for ${c.pwaOutletCount} explicit outlet(s), not every paid merchant.`,
      nextStep:
        "Complete device, recovery and privacy acceptance in #249; keep the service worker rollback path ready.",
    },
    {
      id: "push",
      title: "Opt-in Web Push",
      state: pushOn ? (c.pwaPushAllOutlets ? "configured" : "limited") : "unavailable",
      scope: c.pwaPushAllOutlets
        ? "All outlets, per-device consent"
        : "Explicit outlet and device consent",
      detail: !pushOn
        ? "The push rollout, outlet pilot, or VAPID configuration is incomplete."
        : c.pwaPushAllOutlets
          ? "Available to all outlets; a device still must opt in and delivery is best effort."
          : `Configured for ${c.pwaPushOutletCount} outlet(s); a device still must opt in and delivery is best effort.`,
      nextStep:
        "Keep manual permission, current-session checks, and PWA real-device acceptance; never enroll devices automatically.",
    },
  ];
}
