"use client";

import { useCallback, useEffect, useRef } from "react";

/**
 * Debounced saver. Call `queue()` to schedule a save; it fires once after
 * `delay` ms of quiet. Any in-flight save is awaited before the next one
 * starts, so saves never overlap. The timer is cleared on unmount.
 */
export function useDebouncedSave(
  save: () => Promise<void>,
  delay: number,
): { queue: () => void; flush: () => Promise<void> } {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlight = useRef<Promise<void> | null>(null);
  const saveRef = useRef(save);
  saveRef.current = save;

  const flush = useCallback(async () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    if (inFlight.current) await inFlight.current;
    const task = saveRef.current();
    inFlight.current = task;
    try {
      await task;
    } finally {
      if (inFlight.current === task) inFlight.current = null;
    }
  }, []);

  const queue = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      void flush();
    }, delay);
  }, [flush, delay]);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  return { queue, flush };
}
