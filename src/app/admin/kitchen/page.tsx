import type { Metadata } from "next";
import { verifySuperAdmin } from "@/lib/admin-guard";
import {
  findKitchenPilotTargets,
  kitchenPilotCommand,
  kitchenPilotFailureMessage,
  kitchenPilotStatus,
  kitchenRunningReleaseSha,
  kitchenCommercialStatus,
  kitchenCommercialLaunch,
  type PilotCommand,
} from "@/modules/kitchen/activation";
import { KitchenControlDesk } from "./kitchen-control-desk";
import { KitchenCommercialLaunch } from "./kitchen-commercial-launch";

export const metadata: Metadata = {
  title: "Kitchen Pro | Platform Control Desk",
  robots: { index: false, follow: false },
};

export default async function KitchenControlDeskPage() {
  const admin = await verifySuperAdmin();
  const [runningSha, commercialEnabled] = await Promise.all([
    kitchenRunningReleaseSha(), kitchenCommercialStatus(admin)
  ]);
  async function searchOutlets(term: string) {
    "use server";
    const actor = await verifySuperAdmin();
    try {
      return { ok: true as const, outlets: await findKitchenPilotTargets(actor, term) };
    } catch {
      return { ok: false as const, message: "Outlet search unavailable." };
    }
  }
  async function readStatus(outletId: string) {
    "use server";
    const actor = await verifySuperAdmin();
    try {
      return { ok: true as const, status: await kitchenPilotStatus(actor, outletId) };
    } catch {
      return { ok: false as const, message: "Pilot status unavailable for this outlet." };
    }
  }
  async function changePilot(input: PilotCommand) {
    "use server";
    const actor = await verifySuperAdmin();
    try {
      return { ok: true as const, status: await kitchenPilotCommand(actor, input) };
    } catch (error) {
      return { ok: false as const, message: kitchenPilotFailureMessage(error) };
    }
  }
  async function approveCommercialLaunch(input: {
    releaseSha: string;
    evidenceUrl: string;
    reason: string;
    key: string;
  }) {
    "use server";
    const actor = await verifySuperAdmin();
    try {
      await kitchenCommercialLaunch(actor, input);
      return { ok: true as const };
    } catch {
      return { ok: false as const,
        message: "Release approval could not be confirmed. Verify deployed SHA, evidence, MFA, and existing launch state." };
    }
  }

  return (
    <div className="space-y-6">
      <KitchenCommercialLaunch
        initialEnabled={commercialEnabled}
        runningSha={runningSha}
        onApprove={approveCommercialLaunch}
      />
      <KitchenControlDesk
        operatorId={admin.id}
        runningSha={runningSha}
        onSearch={searchOutlets}
        onStatus={readStatus}
        onCommand={changePilot}
      />
    </div>
  );
}
