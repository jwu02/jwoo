// Where the Dock's order is remembered between visits.
//
// The Dock asks this for the order it renders and hands back the order a drag
// left behind; this is the one place that knows about `localStorage`, so the
// Dock can stay a view of an order rather than a keeper of one. Storage can be
// absent or throw — a private-mode browser, a disabled store — and in that case
// the order simply lives in memory for this visit.
//
// An order outlives the app list it was written against, so it is read as a
// request rather than a fact: hrefs that are no longer applications are dropped,
// applications it never mentioned are appended in their declared order, and the
// Desktop is put back first however the order was stored, because it is Pinned.

import { APPS, HOME, type App } from "./apps"

const KEY = "dock.order"

/** Whether `href` names the one Pinned app: fixed first, never rearranged. */
export function isPinned(href: string): boolean {
  return href === HOME
}

/** The last order written here, for when storage cannot be used. Module scope
 * is the whole of the fallback's lifetime: one visit. */
let inMemory: string | null = null

/** Set when a write was refused — a full quota, a store that only reads. From
 * then on storage is not authoritative, since it holds less than this visit
 * does, and reads answer from memory. */
let refusedWrite = false

/** The raw value the last snapshot came from, and the order it parsed to. React
 * compares snapshots by identity, so the parse has to be memoised on the value
 * rather than repeated per call. `undefined` means nothing read yet. */
let memoRaw: string | null | undefined
let memoOrder: readonly App[] = APPS

const listeners = new Set<() => void>()

function readRaw(): string | null {
  if (refusedWrite) return inMemory
  try {
    return window.localStorage.getItem(KEY)
  } catch {
    // No storage at all: this visit's own writing is all there is.
    return inMemory
  }
}

/** The stored order as applications, with everything the current app list
 * cannot honour discarded. */
function orderFrom(raw: string | null): readonly App[] {
  if (!raw) return APPS
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return APPS
  }
  if (!Array.isArray(parsed)) return APPS

  const byHref = new Map(APPS.map((app) => [app.href, app]))
  const ordered: App[] = []
  const seen = new Set<string>()

  const home = byHref.get(HOME)
  if (home) {
    ordered.push(home)
    seen.add(HOME)
  }
  for (const entry of parsed) {
    if (typeof entry !== "string" || seen.has(entry)) continue
    const app = byHref.get(entry)
    if (!app) continue
    seen.add(entry)
    ordered.push(app)
  }
  // Applications shipped since this order was written keep their declared
  // place among themselves, after the ones the visit actually arranged.
  for (const app of APPS) {
    if (seen.has(app.href)) continue
    seen.add(app.href)
    ordered.push(app)
  }
  return ordered
}

/** The order the Dock renders. A stable reference until the stored value
 * changes, which is what `useSyncExternalStore` requires. */
export function dockOrderSnapshot(): readonly App[] {
  const raw = readRaw()
  if (raw !== memoRaw) {
    memoRaw = raw
    memoOrder = orderFrom(raw)
  }
  return memoOrder
}

/** What the server renders: it has no storage, so the declared order stands and
 * hydration settles any difference. */
export function dockOrderServerSnapshot(): readonly App[] {
  return APPS
}

/** Remember where a drag left the applications. */
export function saveDockOrder(order: readonly App[]): void {
  const raw = JSON.stringify(order.map((app) => app.href))
  inMemory = raw
  try {
    window.localStorage.setItem(KEY, raw)
    refusedWrite = false
  } catch {
    // Memory already holds it — that is the fallback.
    refusedWrite = true
  }
  memoRaw = raw
  memoOrder = order
  for (const listener of listeners) listener()
}

/** Be told when the order changes: this tab's own writes, and another tab's. */
export function subscribeDockOrder(onChange: () => void): () => void {
  listeners.add(onChange)
  window.addEventListener("storage", onChange)
  return () => {
    listeners.delete(onChange)
    window.removeEventListener("storage", onChange)
  }
}
