"use client"

interface HeatmapToggleProps {
  showOverlay: boolean
  onToggle: () => void
}

// The keyboard heatmap overlay switch. Lives outside the keyboard scene card (as
// a shared row above it) so it never adds to the card's height — the keyboard and
// mouse cards stay equal-height and aligned.
export function HeatmapToggle({ showOverlay, onToggle }: HeatmapToggleProps) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        role="switch"
        aria-checked={showOverlay}
        aria-label="Show keyboard heatmap"
        onClick={onToggle}
        className={`relative flex h-5 w-9 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
          showOverlay ? "bg-primary" : "bg-muted"
        }`}
      >
        <span
          className={`inline-block h-4 w-4 rounded-full bg-background shadow transition-transform ${
            showOverlay ? "translate-x-[18px]" : "translate-x-0.5"
          }`}
        />
      </button>
      <span className="text-sm text-muted-foreground">Heatmap</span>
    </div>
  )
}
