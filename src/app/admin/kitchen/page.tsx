import type { Metadata } from "next";
import { verifySuperAdmin } from "@/lib/admin-guard";
import {
  findKitchenPilotTargets,
  kitchenPilotCommand,
  kitchenPilotFailureMessage,
  kitchenPilotStatus,
  type PilotCommand,
} from "@/modules/kitchen/activation";
import { KitchenControlDesk } from "./kitchen-control-desk";

export const metadata: Metadata = {
  title: "Kitchen Pro | Platform Control Desk",
  robots: { index: false, follow: false },
};

export default async function KitchenControlDeskPage() {
  const admin = await verifySuperAdmin();
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
  return (
    <KitchenControlDesk
      operatorId={admin.id}
      runningSha={process.env.NEXT_PUBLIC_RELEASE_SHA ?? ""}
      onSearch={searchOutlets}
      onStatus={readStatus}
      onCommand={changePilot}
    />
  );
}
