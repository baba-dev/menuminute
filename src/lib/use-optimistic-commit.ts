"use client";

import { useCallback, useRef, useState } from "react";
import { runOptimisticCommit, type OptimisticCommit } from "./optimistic-commit";

/** React wrapper that also exposes which keys are currently pending. */
export function useOptimisticCommit() {
  const inFlight = useRef(new Set<string>());
  const [pending, setPending] = useState<readonly string[]>([]);

  const run = useCallback(<T>(key: string, options: OptimisticCommit<T>) => {
    const sync = () => setPending([...inFlight.current]);
    return runOptimisticCommit(inFlight.current, key, {
      ...options,
      apply: () => {
        options.apply();
        sync();
      },
      rollback: () => {
        options.rollback();
        sync();
      },
      onSuccess: (value) => {
        sync();
        options.onSuccess?.(value);
      },
    }).finally(sync);
  }, []);

  return { run, pending, isPending: (key: string) => pending.includes(key) };
}
