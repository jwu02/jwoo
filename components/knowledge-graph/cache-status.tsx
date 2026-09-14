// How long the snapshot has left, largest unit down to minutes: "2h 42m", or
// "21 min" inside the last hour. It receives a value recomputed from wall-clock
// elapsed time, so it arrives fractional and drifting — rounding up keeps the
// displayed minute on screen until it has really elapsed, and keeps a snapshot
// with seconds left from reading as expired.
//
// The last minute is the one place rounding up would lie outright: 40 seconds
// left is a real minute by `ceil`, and the badge would sit on "1 min" and then
// jump straight to expired. It gets a label of its own instead, and only a
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

export interface CacheStatusProps {
  // When the snapshot was written, ISO. Rendered in the viewer's timezone.
  cachedAt: string;
  // Seconds until the cache is due to refresh, recomputed on every tick.
  remainingSeconds: number;
}

export function CacheStatus({ cachedAt, remainingSeconds }: CacheStatusProps) {
  const cachedTime = new Date(cachedAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  return (
    // Sits over the graph, so it must never swallow a pan or a hover: the
    // badge is read-only and the canvas underneath keeps every pointer event.
    <div
      data-testid="kg-cache-status"
      className="pointer-events-none absolute top-3 right-3 z-20 rounded-lg border bg-background/70 px-3 py-2 text-left text-xs leading-tight text-muted-foreground backdrop-blur-sm"
    >
      <div>Server-side Cache</div>
      <div>Last updated {cachedTime}</div>
      {/* Always the same shape: a snapshot that has run out reads "0 min",
          which is what the countdown was counting to all along. */}
      <div>Expires in {formatRemaining(remainingSeconds)}</div>
    </div>
  );
}
