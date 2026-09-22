"use client";

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

export interface CacheNoticeProps {
  // When the snapshot was written, ISO. Rendered in the viewer's timezone.
  cachedAt: string;
  // Seconds until the cache is due to refresh, recomputed on every tick.
  remainingSeconds: number;
}

// What the snapshot is and how long it is good for, read out in the graph's
// bottom-left corner. It is text and nothing else: no card, no border, no close
// button. The graph is the page, and a panel of chrome sitting in the corner of
// it reads as something to dismiss or to interact with rather than as a note
// about the graph beside it — muted, it is legible when looked for and out of
// the way when not.
//
// `pointer-events-none` keeps it from taking drags and zooms away from the
// nodes underneath it, and the text carries the same halo the graph's own node
// labels do, so it stays readable where it overlaps the dots.
export function CacheNotice({ cachedAt, remainingSeconds }: CacheNoticeProps) {
  const cachedTime = new Date(cachedAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  return (
    <div
      data-testid="kg-cache-notice"
      className="pointer-events-none absolute bottom-4 left-4 z-10 flex flex-col text-xs leading-relaxed text-muted-foreground [text-shadow:0_0_3px_var(--background),0_0_3px_var(--background)]"
    >
      <span>Server-side Cache</span>
      <span>Last updated {cachedTime}</span>
      {/* Always the same shape: a snapshot that has run out reads "0 min",
          which is what the countdown was counting to all along. */}
      <span>Expires in {formatRemaining(remainingSeconds)}</span>
    </div>
  );
}
