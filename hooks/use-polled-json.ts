import { useCallback, useEffect, useRef, useState } from "react";

/** How often a polled page refreshes itself. */
const DEFAULT_POLL_INTERVAL_MS = 60_000;

let cachedTimeZone: string | null = null;

/**
 * The viewer's IANA timezone, which the polled pages send as `tz` so the
 * charts bucket by local days (e.g. "today"); the API falls back to UTC when
 * it is absent. Resolved once — the reading cannot change while the page is
 * open, and building a formatter on every render is not free.
 */
export function viewerTimeZone(): string {
  if (cachedTimeZone === null) {
    cachedTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  }
  return cachedTimeZone;
}

/**
 * A failed response's message: the API's own `error` field when it sent a
 * readable one, the status when it did not.
 */
async function errorMessage(response: Response): Promise<string> {
  const body = await response.json().catch(() => ({ error: "Unknown error" }));
  return body.error || `HTTP ${response.status}`;
}

async function fetchJson<T>(url: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(await errorMessage(response));
  return response.json();
}

export interface PolledJsonOptions {
  /** How often to poll, in milliseconds. */
  intervalMs?: number;
}

export interface PolledJson<T> {
  /** The most recent successful response, or null before the first one. */
  data: T | null;
  /** True only while a foreground load is in flight. A poll never sets it. */
  loading: boolean;
  /** The last failure's message, shown alongside whatever data is on screen. */
  error: string | null;
  /** When the data currently on screen arrived. */
  lastUpdated: Date | null;
  /** Reload now, in the foreground — what a retry button calls. */
  refresh: () => void;
}

/**
 * Owns the whole cycle a polled page runs: fetch the url, replace what is on
 * screen, poll on an interval, and abort whatever the request replaced.
 *
 * The url is the contract — change it and the hook abandons the in-flight
 * request, loads the new one in the foreground and restarts the cadence from
 * that moment. Nothing that must stay identical between renders (a callback,
 * say) crosses this interface.
 */
export function usePolledJson<T>(
  url: string,
  options: PolledJsonOptions = {}
): PolledJson<T> {
  const { intervalMs = DEFAULT_POLL_INTERVAL_MS } = options;
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const load = useCallback(
    async (isPoll = false) => {
      if (!isPoll) setLoading(true);
      setError(null);
      // The request this one replaces is now irrelevant, and letting it land
      // would put an older range's data on screen.
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const result = await fetchJson<T>(url, controller.signal);
        setData(result);
        setLastUpdated(new Date());
      } catch (err) {
        // An abort is this hook cancelling its own request, not a failure to
        // report — the request that replaced it owns the outcome now.
        if (err instanceof Error && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        if (!isPoll) setLoading(false);
      }
    },
    [url]
  );

  useEffect(() => {
    // Deferred so the first load lands after mount rather than during it.
    const timeout = setTimeout(() => load(), 0);
    const interval = setInterval(() => load(true), intervalMs);
    return () => {
      clearTimeout(timeout);
      clearInterval(interval);
      abortRef.current?.abort();
    };
  }, [load, intervalMs]);

  const refresh = useCallback(() => {
    void load();
  }, [load]);

  return { data, loading, error, lastUpdated, refresh };
}
