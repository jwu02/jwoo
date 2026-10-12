"use client"

import { useSyncExternalStore } from "react"
import { RotateCcw } from "lucide-react"

import {
  appearanceServerSnapshot,
  appearanceSnapshot,
  saveAppearance,
  subscribeAppearance,
  type Appearance,
} from "@/components/os/appearance"
import {
  dockOrderServerSnapshot,
  dockOrderSnapshot,
  resetDockOrder,
  subscribeDockOrder,
} from "@/components/os/dock-order"
import {
  RangeSelector,
  type RangeOption,
} from "@/components/polled/range-selector"
import { Button } from "@/components/ui/button"

/** The two appearances, in display order, for the shared pill group. */
const APPEARANCE_OPTIONS: RangeOption<Appearance>[] = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
]

/**
 * The Settings application: one scrolling column of sections, each a window
 * onto what another part of the OS owns. It keeps no state of its own —
 * resetting the Dock's arrangement is the Dock store's act, performed here on
 * the visitor's behalf.
 */
export function Settings() {
  const order = useSyncExternalStore(
    subscribeDockOrder,
    dockOrderSnapshot,
    dockOrderServerSnapshot,
  )
  // The control shows the appearance in effect, which is the visitor's own
  // system until they choose — so what it says and what they see agree even
  // when they never chose.
  const appearance = useSyncExternalStore(
    subscribeAppearance,
    appearanceSnapshot,
    appearanceServerSnapshot,
  )

  return (
    <div className="mx-auto w-full max-w-2xl space-y-8 px-4 py-6 md:px-6 md:py-8">
      <section
        aria-labelledby="appearance-heading"
        className="space-y-4"
      >
        <h2
          id="appearance-heading"
          className="font-os text-lg font-medium"
        >
          Appearance
        </h2>

        <p className="text-sm text-muted-foreground">
          The look of the whole OS. What an application shows keeps its own.
        </p>

        <RangeSelector
          value={appearance}
          onChange={saveAppearance}
          options={APPEARANCE_OPTIONS}
        />
      </section>

      <section
        aria-labelledby="desktop-dock-heading"
        className="space-y-4"
      >
        <h2
          id="desktop-dock-heading"
          className="font-os text-lg font-medium"
        >
          Desktop & Dock
        </h2>

        <p className="text-sm text-muted-foreground">
          The applications in the Dock, in the order they appear now.
        </p>

        <ol
          aria-label="Current Dock arrangement"
          className="divide-y rounded-xl border"
        >
          {order.map((app) => (
            <li
              key={app.href}
              className="flex items-center gap-3 px-4 py-3"
            >
              {/* The Desktop's portrait fills its box rather than taking the
                  size it is handed, so the box is what gives every glyph one. */}
              <span className="flex size-6 shrink-0 items-center justify-center text-muted-foreground">
                <app.icon className="size-full" aria-hidden />
              </span>
              <span className="text-sm">{app.label}</span>
            </li>
          ))}
        </ol>

        <Button
          type="button"
          variant="secondary"
          onClick={resetDockOrder}
          className="w-full sm:w-auto"
        >
          <RotateCcw className="size-4" aria-hidden />
          Reset Dock arrangement
        </Button>
      </section>
    </div>
  )
}
