import { toast } from "sonner";

/** Marks a failure that retrying the same request cannot fix (for example a stale revision). */
export class NonRetryableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NonRetryableError";
  }
}

export type OptimisticCommit<T> = {
  /** Show the intended state immediately, as pending, never as success. */
  apply: () => void;
  /** Restore the exact previous state. */
  rollback: () => void;
  /** The authoritative request. Resolve only after the server has acknowledged it. */
  commit: () => Promise<T>;
  /** Called once, and only after the server acknowledged the change. */
  onSuccess?: (value: T) => void;
  failureTitle: string;
  /** Called after rollback with the user-facing explanation and an optional retry. */
  onFailure?: (failure: { message: string; retry: (() => void) | null }) => void;
};

export type FailureNotifier = (title: string, message: string, retry: (() => void) | null) => void;

export const toastFailure: FailureNotifier = (title, message, retry) => {
  toast.error(title, {
    description: message,
    ...(retry ? { action: { label: "Retry", onClick: retry } } : {}),
  });
};

/**
 * Optimistic update with a guaranteed rollback. Returns whether the server confirmed.
 * Duplicate activation for the same key is ignored while one is in flight.
 */
export async function runOptimisticCommit<T>(
  inFlight: Set<string>,
  key: string,
  options: OptimisticCommit<T>,
  notify: FailureNotifier = toastFailure
): Promise<boolean> {
  if (inFlight.has(key)) return false;
  inFlight.add(key);
  options.apply();
  try {
    const value = await options.commit();
    inFlight.delete(key);
    options.onSuccess?.(value);
    return true;
  } catch (cause) {
    inFlight.delete(key);
    options.rollback();
    const message = cause instanceof Error ? cause.message : "The change could not be saved.";
    const retry =
      cause instanceof NonRetryableError
        ? null
        : () => void runOptimisticCommit(inFlight, key, options, notify);
    notify(options.failureTitle, message, retry);
    options.onFailure?.({ message, retry });
    return false;
  }
}
