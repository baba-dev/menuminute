import type { TelemetrySnapshot } from "./telemetry";
export interface OperationalAlert {
  id: string;
  severity: "warning" | "critical";
  title: string;
  explanation: string;
}
export function evaluateOperationalAlerts(s: TelemetrySnapshot): OperationalAlert[] {
  const alerts: OperationalAlert[] = [];
  const n = s.windowRequests;
  if (n >= 20 && s.windowServerErrors / n >= 0.05) {
    alerts.push({
      id: "http.5xx",
      severity: "critical",
      title: "Elevated server error rate",
      explanation:
        "At least 5% of the sampled completed requests failed with 5xx in the recent 5-minute window.",
    });
  }
  if (n >= 20 && s.windowSlowRequests / n >= 0.25) {
    alerts.push({
      id: "http.latency",
      severity: "warning",
      title: "High API latency",
      explanation:
        "At least 25% of the sampled requests exceeded 250ms in the recent 5-minute window.",
    });
  }
  if (s.invalidSamples > 0) {
    alerts.push({
      id: "telemetry.invalid",
      severity: "warning",
      title: "Invalid instrumentation measurements",
      explanation:
        "At least one malformed status or duration was rejected. Inspect request instrumentation.",
    });
  }
  return alerts;
}
