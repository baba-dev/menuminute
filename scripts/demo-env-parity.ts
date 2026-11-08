import { lstatSync, readFileSync } from "node:fs";
import { assertDemoModeParity } from "../src/modules/demo/env-parity";

const [webPath, workerPath] = process.argv.slice(2);
try {
  if (!webPath || !workerPath) throw new Error("Both runtime environment paths are required");
  // Root-controlled deployment preflight; refuse symbolic links to alternate secret files.
  if (!lstatSync(webPath).isFile() || !lstatSync(workerPath).isFile()) {
    throw new Error("Runtime environment files must be regular files");
  }
  const enabled = assertDemoModeParity(readFileSync(webPath, "utf8"), readFileSync(workerPath, "utf8"));
  process.stdout.write(
    enabled
      ? "Demo reset worker is enabled and matches the web service.\n"
      : "Demo mode is disabled in both services.\n"
  );
} catch {
  // Intentionally log only the flag name, never file contents or raw parsing errors.
  process.stderr.write(
    "DEPLOYMENT_PREFLIGHT_FAILED: Check DEMO_MODE_ENABLED in both web.env and worker.env; they must be equal.\n"
  );
  process.exitCode = 1;
}
