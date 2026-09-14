// How long the snapshot has left, largest unit down to seconds: "2h 42m 12s".
// It receives a value recomputed from wall-clock elapsed time, so it arrives
// fractional and drifting — rounding up keeps the last second on screen for a
// full second and lets the countdown land on zero only when it is really zero.
export function formatRemaining(totalSeconds: number): string {
  const seconds = Math.max(0, Math.ceil(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;

  if (hours > 0) return `${hours}h ${minutes}m ${remainder}s`;
  if (minutes > 0) return `${minutes}m ${remainder}s`;
  return `${remainder}s`;
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
      className="pointer-events-none absolute top-3 right-3 z-20 rounded-lg border bg-background/70 px-3 py-2 text-right text-xs leading-tight text-muted-foreground backdrop-blur-sm"
    >
      <div>Cached {cachedTime}</div>
      <div>
        {remainingSeconds > 0
          ? `refreshes in ${formatRemaining(remainingSeconds)}`
          : "refresh due"}
      </div>
    </div>
  );
}
