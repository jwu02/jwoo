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
  clearStoredEntry,
  formatBytes,
  storedSizesServerSnapshot,
  storedSizesSnapshot,
  subscribeStoredSizes,
} from "@/components/settings/stored-data"
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
  // Measured from what is actually stored, so a row's number can never claim
  // more than the key holds. The server has no storage and answers nothing.
  const sizes = useSyncExternalStore(
    subscribeStoredSizes,
    storedSizesSnapshot,
    storedSizesServerSnapshot,
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
          Everything the site keeps in this browser. Deleting an entry costs
          only that entry.
        </p>

        <ul
          aria-label="Stored data"
          className="divide-y rounded-xl border"
        >
          {STORED_DATA.map((entry) => (
            <li
              key={entry.key}
              className="flex items-center gap-3 px-4 py-3"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm">{entry.label}</p>
                <p className="truncate font-mono text-xs text-muted-foreground">
                  {entry.key}
                </p>
              </div>
              <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                {formatBytes(sizes[entry.key] ?? 0)}
              </span>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={() => clearStoredEntry(entry)}
                aria-label={`Delete ${entry.label}`}
              >
                Delete
              </Button>
            </li>
          ))}
        </ul>

        <DeleteEverything />

        <StorageEstimate />
      </section>
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
