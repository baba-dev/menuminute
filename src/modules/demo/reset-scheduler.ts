import { nextDemoResetAt } from "./ids";

/** Resilient, wall-clock-aligned demo reset. Never runs when the demo kill switch is off. */
export function startDemoResetScheduler<T>({
  enabled,
  run,
  onSuccess,
  onFailure,
  now = Date.now,
}: {
  enabled: boolean;
  run: () => Promise<T>;
  onSuccess: (result: T) => void;
  onFailure: (error: unknown, attempts: number, retryMs: number) => void;
  now?: () => number;
}) {
  let stopping = false;
  let pending: Promise<void> | null = null;
  let boundaryTimer: ReturnType<typeof setTimeout> | null = null;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let failures = 0;

  const tick = () => {
    if (!enabled || stopping || pending) return;
    pending = Promise.resolve()
      .then(run)
      .then((value) => {
        failures = 0;
        if (retryTimer) clearTimeout(retryTimer);
        retryTimer = null;
        onSuccess(value);
      })
      .catch((error: unknown) => {
        failures++;
        const retryMs = Math.min(5 * 60_000, 60_000 * 2 ** Math.min(failures - 1, 3));
        onFailure(error, failures, retryMs);
        if (!stopping && retryTimer === null) {
          retryTimer = setTimeout(() => {
            retryTimer = null;
            tick();
          }, retryMs);
        }
      })
      .finally(() => {
        pending = null;
      });
  };

  const align = () => {
    if (!enabled || stopping) return;
    boundaryTimer = setTimeout(
      () => {
        boundaryTimer = null;
        // An aligned reset supersedes any delayed retry from a prior failure.
        if (retryTimer) clearTimeout(retryTimer);
        retryTimer = null;
        tick();
        align();
      },
      Math.max(1, nextDemoResetAt(now()) - now())
    );
  };

  if (enabled) {
    tick(); // Repair an old demo as soon as the worker starts.
    align();
  }

  return {
    async close() {
      stopping = true;
      if (boundaryTimer) clearTimeout(boundaryTimer);
      if (retryTimer) clearTimeout(retryTimer);
      await pending;
    },
  };
}
