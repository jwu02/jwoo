"use client";

import { useCallback, useEffect, useRef } from "react";

import { toast } from "@/components/ui/toast";

// How long the snapshot has left, largest unit down to minutes: "2h 42m", or
// "21 min" inside the last hour. It receives a value recomputed from wall-clock
// elapsed time, so it arrives fractional and drifting — rounding up keeps the
// displayed minute on screen until it has really elapsed, and keeps a snapshot
// with seconds left from reading as expired.
//
// The last minute is the one place rounding up would lie outright: 40 seconds
// left is a real minute by `ceil`, and the countdown would sit on "1 min" and
// then jump straight to expired. It gets a label of its own instead, and only a
// snapshot that has genuinely run out reads as zero.
export function formatRemaining(totalSeconds: number): string {
  const seconds = Math.max(0, totalSeconds);
  if (seconds === 0) return "0 min";
  if (seconds < 60) return "<1 min";

  const minutes = Math.ceil(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  return `${minutes} min`;
}

// One notice for the whole page, identified so that a later `add` updates the
// toast already on screen instead of stacking a second one underneath it.
const TOAST_ID = "kg-cache-status";

export interface CacheToastProps {
  // When the snapshot was written, ISO. Rendered in the viewer's timezone.
  cachedAt: string;
  // Seconds until the cache is due to refresh, recomputed on every tick.
  remainingSeconds: number;
}

// Renders nothing: the notice itself is portalled by the `Toaster` in the root
// layout, and this only drives it.
export function CacheToast({ cachedAt, remainingSeconds }: CacheToastProps) {
  const cachedTime = new Date(cachedAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  // Dismissal is the viewer's call and it is final. The countdown carries on
  // underneath, but neither the next tick nor the fresh snapshot that
  // eventually replaces this one reopens a notice that has been closed.
  const dismissedRef = useRef(false);
  // Two very different things arrive through the same `onClose`: the viewer
  // pressing the button, and this component closing the notice on its way out.
  // Only the first is a dismissal. Without the distinction, React's dev-only
  // mount/unmount/remount would tear the notice down and then, mistaking its
  // own teardown for a dismissal, refuse to put it back.
  const unmountingRef = useRef(false);
  const handleClose = useCallback(() => {
    if (unmountingRef.current) return;
    dismissedRef.current = true;
  }, []);

  // Leaving the page retires the notice, rather than letting a snapshot's
  // expiry follow the viewer onto some other page.
  useEffect(
    () => () => {
      unmountingRef.current = true;
      toast.close(TOAST_ID);
    },
    []
  );

  useEffect(() => {
    unmountingRef.current = false;
    if (dismissedRef.current) return;

    toast.add({
      id: TOAST_ID,
      title: "Server-side Cache",
      description: (
        <span className="flex flex-col">
          <span>Last updated {cachedTime}</span>
          {/* Always the same shape: a snapshot that has run out reads
              "0 min", which is what the countdown was counting to all along. */}
          <span>Expires in {formatRemaining(remainingSeconds)}</span>
        </span>
      ),
      // `0` is Base UI's "never auto-dismiss" — the notice stays put until the
      // close button is pressed, however long the snapshot has left. Updating
      // it in place cannot re-arm a timer either, since the timeout travels
      // with the toast rather than falling back to the provider's default.
      timeout: 0,
      onClose: handleClose,
    });
    // Re-runs when the displayed minute changes, which updates the toast in
    // place; the page below only re-renders on that same edge.
  }, [cachedTime, remainingSeconds, handleClose]);

  return null;
}
