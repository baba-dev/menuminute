/** Only inspect the demo kill switch, never parse or log runtime credentials. */
export function demoEnabledInEnvironmentFile(fileContent: string): boolean {
  let value: boolean | null = null;
  for (const raw of fileContent.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const match = /^DEMO_MODE_ENABLED\s*=\s*(.*?)\s*$/.exec(line);
    if (!match) continue;
    if (value !== null) throw new Error("Duplicate DEMO_MODE_ENABLED setting");
    const setting = match[1];
    if (setting === "true" || setting === '"true"' || setting === "'true'") {
      value = true;
    } else if (setting === "false" || setting === '"false"' || setting === "'false'") {
      value = false;
    } else {
      throw new Error("Invalid DEMO_MODE_ENABLED setting");
    }
  }
  return value ?? false;
}

/** A web demo with a disabled worker cannot refresh live kitchen work. Fail deployment closed. */
export function assertDemoModeParity(webEnv: string, workerEnv: string): boolean {
  const web = demoEnabledInEnvironmentFile(webEnv);
  const worker = demoEnabledInEnvironmentFile(workerEnv);
  if (web !== worker) {
    throw new Error("DEMO_MODE_ENABLED must agree in web.env and worker.env");
  }
  return web;
}
