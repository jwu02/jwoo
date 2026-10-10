"use client"

import { Switch } from "@/components/ui/switch"

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
      <Switch
        checked={showOverlay}
        onCheckedChange={() => onToggle()}
        aria-label="Show keyboard heatmap"
        className="cursor-pointer"
      />
      <span className="text-sm text-muted-foreground">Heatmap</span>
    </div>
  )
}
