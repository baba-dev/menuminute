import { verifySuperAdmin } from "@/lib/admin-guard";
import { LogExplorer } from "./log-explorer";

export const dynamic = "force-dynamic";
export default async function AdminLogsPage() {
  await verifySuperAdmin();
  return <LogExplorer />;
}
