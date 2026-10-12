"use client"

import { useState, useSyncExternalStore } from "react"
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
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
 * Whether an entry steps back because another one is lit. The pointer being on
 * a legend chip and on a bar segment are the same state, so the two always
 * agree about which entry is being read.
 */
function isDimmed(litKey: string | null, key: string): boolean {
  return litKey !== null && litKey !== key
}

/** The two appearances, in display order, for the shared pill group. */
const APPEARANCE_OPTIONS: RangeOption<Appearance>[] = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
]

/**
 * The Settings application: one scrolling column of sections, each a window
 * onto what another part of the OS owns. It keeps no state of its own beyond
 * which Data entry the pointer is on — resetting the Dock's arrangement is the
 * Dock store's act, performed here on the visitor's behalf.
 */
export function Settings() {
  // Which entry the pointer or the caret is on. The Data section is the only
  // reader; the four sections below neither know nor care.
  const [litKey, setLitKey] = useState<string | null>(null)
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
        <div className="flex items-center justify-between gap-4">
          <h2
            id="appearance-heading"
            className="font-os text-lg font-medium"
          >
            Appearance
          </h2>

          <RangeSelector
            value={appearance}
            onChange={saveAppearance}
            options={APPEARANCE_OPTIONS}
          />
        </div>
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

        <div className="flex justify-end">
          <Button
            type="button"
            variant="secondary"
            onClick={resetDockOrder}
            className="w-full sm:w-auto"
          >
            <RotateCcw className="size-4" aria-hidden />
            Reset dock
          </Button>
        </div>
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
            capacity it could draw free space against. Decoration: the sizes
            are said by a tooltip hanging off a segment, lit from the legend's
            chip below, so nothing here is load-bearing for a screen reader. An
            entry weighing nothing keeps a segment at no width, which draws
            nothing rather than a sliver it does not own. */}
        <div
          data-stored-bar
          className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted"
          aria-hidden
        >
          {STORED_DATA.map((entry, index) => {
            const bytes = sizes[entry.key] ?? 0
            return (
              <Tooltip
                key={entry.key}
                open={litKey === entry.key}
              >
                {/* Open, never written back: the pointer rests on a legend chip,
                    not on this trigger, so base-ui answers a hover it does not
                    have with a close — and that close can land on the entry the
                    pointer has already reached, wiping the light. litKey is the
                    page's and only the page's; the tooltip follows it. */}
                {/* Not focusable, deliberately: a segment inside this
                    decorative bar would add a tab stop saying nothing the
                    legend below does not already say. The tooltip hangs here
                    rather than on the chip so it always rises over the bar the
                    number is about — and an entry weighing nothing keeps a
                    zero-width segment for it to rise over. */}
                <TooltipTrigger
                  render={
                    <div
                      data-stored-segment={entry.key}
                      className={`cursor-pointer transition-opacity ${
                        isDimmed(litKey, entry.key) ? "opacity-50" : ""
                      }`}
                      style={{
                        width: `${
                          total === 0 ? 0 : (bytes / total) * 100
                        }%`,
                        backgroundColor: storedEntryColor(index),
                      }}
                      onMouseEnter={() => setLitKey(entry.key)}
                      onMouseLeave={() => setLitKey(null)}
                    />
                  }
                />
                <TooltipContent sideOffset={10}>
                  {formatBytes(bytes)}
                </TooltipContent>
              </Tooltip>
            )
          })}
        </div>

        <ul
          aria-label="Stored data"
          className="flex flex-wrap items-center gap-x-4 gap-y-2"
        >
          {STORED_DATA.map((entry, index) => (
            <li key={entry.key}>
              {/* The chip lights the entry rather than saying anything itself:
                  it is a real control because hover is unreachable by
                  keyboard, and where the tooltip goes is the bar's business. */}
              <button
                type="button"
                className={`flex cursor-pointer items-center gap-2 rounded-sm text-sm transition-opacity outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  isDimmed(litKey, entry.key)
                    ? "text-muted-foreground opacity-50"
                    : ""
                }`}
                onMouseEnter={() => setLitKey(entry.key)}
                onMouseLeave={() => setLitKey(null)}
                onFocus={() => setLitKey(entry.key)}
                onBlur={() => setLitKey(null)}
              >
                <span
                  aria-hidden
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: storedEntryColor(index) }}
                />
                {entry.label}
              </button>
            </li>
          ))}
        </ul>

        <div className="flex justify-end">
          <AlertDialog>
            <AlertDialogTrigger
              render={
                <Button
                  type="button"
                  variant="destructive"
                  className="w-full sm:w-auto"
                />
              }
            >
              Delete everything
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete everything?</AlertDialogTitle>
                <AlertDialogDescription>
                  Clears the Dock order, the appearance, the resume language and
                  the Terminal history. This cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  variant="destructive"
                  onClick={clearAllStoredData}
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </section>

      <System />
    </div>
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
    </section>
  )
}
