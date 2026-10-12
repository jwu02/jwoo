"use client"

import { useEffect, useState, useSyncExternalStore } from "react"
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
import {
  STORED_DATA,
  clearAllStoredData,
  formatBytes,
  storedSizesServerSnapshot,
  storedSizesSnapshot,
  subscribeStoredSizes,
} from "@/components/settings/stored-data"
import {
  SITE_VERSION,
  subscribeSystem,
  systemServerSnapshot,
  systemSnapshot,
} from "@/components/settings/system"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

/**
 * One entry's colour: the positional `--chart-N` slot for its place in the
 * list, which never reorders. The bar's segment and the legend's dot both read
 * it from here, so the two can never disagree about which entry is which.
 */
function storedEntryColor(index: number): string {
  return `var(--chart-${(index % 5) + 1})`
}

/**
 * What one entry weighs, for the bar's segment and the legend's chip alike.
 * The size is written nowhere on the page, so this one string is where it is
 * said — and the segment has no label of its own, so it names the entry too.
 */
function storedEntryWeight(label: string, bytes: number): string {
  return `${label} takes up ${formatBytes(bytes)}`
}

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
  // Measured from what is actually stored, so a row's number can never claim
  // more than the key holds. The server has no storage and answers nothing.
  const sizes = useSyncExternalStore(
    subscribeStoredSizes,
    storedSizesSnapshot,
    storedSizesServerSnapshot,
  )
  // The bar's whole, and the number its heading states: the site's own bytes,
  // not the origin's. The browser's estimate below includes these, so the two
  // can never be added together.
  const total = STORED_DATA.reduce(
    (sum, entry) => sum + (sizes[entry.key] ?? 0),
    0,
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

      <section
        aria-labelledby="data-heading"
        className="space-y-4"
      >
        <h2
          id="data-heading"
          className="font-os text-lg font-medium"
        >
          Data
        </h2>

        <p className="text-sm text-muted-foreground">
          {formatBytes(total)} kept by this site.
        </p>

        {/* One bar, the entries against their own sum — the site holds no
            capacity it could draw free space against. Decoration: the sizes it
            draws are in a tooltip on the segment and in the legend's chip, so
            nothing here is load-bearing for a screen reader. An entry weighing
            nothing draws no segment rather than a sliver it does not own. */}
        <div
          data-stored-bar
          className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted"
          aria-hidden
        >
          {STORED_DATA.map((entry, index) => {
            const bytes = sizes[entry.key] ?? 0
            if (bytes === 0) return null
            return (
              <Tooltip key={entry.key}>
                {/* Not focusable, deliberately: a segment inside this
                    decorative bar would add a tab stop saying nothing the
                    legend below does not already say. */}
                <TooltipTrigger
                  render={
                    <div
                      data-stored-segment={entry.key}
                      style={{
                        width: `${(bytes / total) * 100}%`,
                        backgroundColor: storedEntryColor(index),
                      }}
                    />
                  }
                />
                <TooltipContent>
                  {storedEntryWeight(entry.label, bytes)}
                </TooltipContent>
              </Tooltip>
            )
          })}
        </div>

        <ul
          aria-label="Stored data"
          className="flex flex-wrap items-center gap-x-4 gap-y-2"
        >
          {STORED_DATA.map((entry, index) => {
            const bytes = sizes[entry.key] ?? 0
            return (
              <li key={entry.key}>
                <Tooltip>
                  {/* A pointer is not the only way in: the chip is a real
                      control, so focusing it says what hovering it does. */}
                  <TooltipTrigger
                    render={
                      <button
                        type="button"
                        className="flex cursor-default items-center gap-2 rounded-sm text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      />
                    }
                  >
                    <span
                      aria-hidden
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: storedEntryColor(index) }}
                    />
                    {entry.label}
                  </TooltipTrigger>
                  <TooltipContent>
                    {storedEntryWeight(entry.label, bytes)}
                  </TooltipContent>
                </Tooltip>
              </li>
            )
          })}
        </ul>

        <DeleteEverything />

        <StorageEstimate />
      </section>

      <System />
    </div>
  )
}

/**
 * The destructive control asks once, in place: a first press arms it, a second
 * within a few seconds deletes everything, and left alone it reverts. No dialog
 * is involved — the button is its own confirmation.
 */
function DeleteEverything() {
  const [armed, setArmed] = useState(false)

  useEffect(() => {
    if (!armed) return
    const timer = setTimeout(() => setArmed(false), 5000)
    return () => clearTimeout(timer)
  }, [armed])

  return (
    <>
      <Button
        type="button"
        variant="destructive"
        className="w-full sm:w-auto"
        onClick={() => {
          if (!armed) {
            setArmed(true)
            return
          }
          clearAllStoredData()
          setArmed(false)
        }}
      >
        {armed ? "Press again to delete everything" : "Delete everything"}
      </Button>
      {/* The button's own text is its name, so the armed state is also said
          aloud for a screen reader rather than only shown. */}
      <span role="status" className="sr-only">
        {armed ? "Press again within five seconds to delete everything." : ""}
      </span>
    </>
  )
}

/**
 * What the browser reports for this origin, shown once if it answers at all.
 * Most of that number is caches a page cannot clear, so the caption says so
 * rather than letting it read as something the site could hand back.
 */
function StorageEstimate() {
  const [usage, setUsage] = useState<number | null>(null)

  useEffect(() => {
    const storage = navigator.storage
    if (!storage || typeof storage.estimate !== "function") return
    let active = true
    storage
      .estimate()
      .then((value) => {
        if (active && typeof value.usage === "number") setUsage(value.usage)
      })
      .catch(() => {
        // A browser that cannot answer simply says nothing.
      })
    return () => {
      active = false
    }
  }, [])

  if (usage === null) return null

  return (
    <p className="text-xs text-muted-foreground">
      This browser reports {formatBytes(usage)} used for this site. Most of it
      is caches, which a page cannot clear; the entries above are the part the
      site itself keeps.
    </p>
  )
}

/**
 * What the browser answers about this machine, plus the site's own version and
 * what the site measures. A fact the browser does not report is left out rather
 * than printed as a placeholder.
 */
function System() {
  const facts = useSyncExternalStore(
    subscribeSystem,
    systemSnapshot,
    systemServerSnapshot,
  )

  const rows: { label: string; value: string }[] = []
  if (facts.languages) {
    rows.push({ label: "Languages", value: facts.languages })
  }
  if (facts.timeZone) {
    rows.push({ label: "Time zone", value: facts.timeZone })
  }
  rows.push({ label: "Site version", value: SITE_VERSION })

  return (
    <section
      aria-labelledby="system-heading"
      className="space-y-4"
    >
      <h2
        id="system-heading"
        className="font-os text-lg font-medium"
      >
        System
      </h2>

      <p className="text-sm text-muted-foreground">
        What this browser tells the site about itself and this machine.
      </p>

      <ul
        aria-label="System facts"
        className="divide-y rounded-xl border"
      >
        {rows.map((row) => (
          <li
            key={row.label}
            className="flex items-center justify-between gap-4 px-4 py-3"
          >
            <span className="text-sm">{row.label}</span>
            <span className="text-right text-sm text-muted-foreground">
              {row.value}
            </span>
          </li>
        ))}
      </ul>

      <p className="text-xs text-muted-foreground">
        The site loads cookieless page-view and performance collection to see
        how it is used.
      </p>
    </section>
  )
}
