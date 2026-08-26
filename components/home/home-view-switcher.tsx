"use client"

import { cn } from "@/lib/utils"

import { Button } from "@/components/ui/button"
import { HOME_VIEW_SWITCHER } from "./scene-config"

export type HomeViewSwitcherProps = {
  /** Id of the currently framed view, or null when none of the presets is active. */
  activeView: string | null
  onSelectView: (id: string) => void
}

// Bottom-center pill letting visitors jump between the GLB-authored camera views
// (Desk / Xiaomi SU7) without hunting for the object in the scene. The outer
// wrapper is pointer-transparent so the pill never blocks clicks on the canvas.
export function HomeViewSwitcher({ activeView, onSelectView }: HomeViewSwitcherProps) {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-4 z-20 flex justify-center">
      <div
        role="group"
        aria-label="Camera views"
        className="pointer-events-auto flex items-center gap-1 rounded-full border bg-background/80 p-1 shadow-sm backdrop-blur-sm"
      >
        {HOME_VIEW_SWITCHER.map((view) => {
          const isActive = view.id === activeView
          return (
            <Button
              key={view.id}
              type="button"
              variant="ghost"
              size="sm"
              aria-pressed={isActive}
              onClick={() => onSelectView(view.id)}
              className={cn(
                "rounded-full",
                isActive &&
                  // Solid foreground pill with background-colored text. On hover
                  // it flips to a light muted background with foreground text —
                  // a translucent foreground tint can never lighten near-black
                  // enough to read as a hover state. Tunable in dev.
                  "bg-foreground text-background hover:bg-muted hover:text-foreground",
              )}
            >
              {view.label}
            </Button>
          )
        })}
      </div>
    </div>
  )
}
