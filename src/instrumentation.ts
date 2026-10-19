/** Next.js invokes this once per server runtime; never open connections during static compilation. */
export async function register() {
  if (
    process.env["NEXT_RUNTIME"] === "nodejs" &&
    process.env["NEXT_PHASE"] !== "phase-production-build"
  ) {
    const { verifyRuntimeRole } = await import("@/db");
    await verifyRuntimeRole();
  }
}
