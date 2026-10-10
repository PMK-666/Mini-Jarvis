"use client";
/**
 * Small, failure-tolerant localStorage helpers. Per-browser conveniences only:
 * the plan you're editing, saved trips, your demo bookings and the demo scenario.
 * Real accounts (User & Creator Service) replace this in Phase 3.
 */
import { useCallback, useEffect, useState } from "react";

export function read<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function write<T>(key: string, value: T) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    window.dispatchEvent(new CustomEvent("itinera-storage", { detail: key }));
  } catch {
    /* storage unavailable — state lives for this page only */
  }
}

/** useState backed by localStorage. `ready` is false until the stored value has loaded. */
export function useStored<T>(key: string, fallback: T) {
  const [value, setValue] = useState<T>(fallback);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setValue(read(key, fallback));
    setReady(true);
    const onChange = (e: Event) => {
      if ((e as CustomEvent).detail === key) setValue(read(key, fallback));
    };
    window.addEventListener("itinera-storage", onChange);
    return () => window.removeEventListener("itinera-storage", onChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const set = useCallback(
    (next: T | ((prev: T) => T)) => {
      setValue((prev) => {
        const v = typeof next === "function" ? (next as (p: T) => T)(prev) : next;
        write(key, v);
        return v;
      });
    },
    [key],
  );
  return [value, set, ready] as const;
}
