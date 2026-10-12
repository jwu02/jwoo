// Every entry the site keeps in the visitor's browser, and the one list the
// Data section renders.
//
// Each entry belongs to the module that owns its key: that module knows how to
// clear it and leaves its own state and subscribers where a first visit finds
// them, and Settings asks through the descriptor rather than reaching into
// storage. Sizes are read from the stored value itself, so a row's number is
// measured rather than declared.
//
// A read here is best-effort in the same way the stores' own reads are: storage
// that throws has nothing to measure, and reads as nothing stored.

import { appearanceEntry } from "@/components/os/appearance"
import { dockOrderEntry } from "@/components/os/dock-order"
import { resumeLocaleEntry } from "@/components/resume/locale-store"
import { terminalHistoryEntry } from "@/components/terminal/history-store"

/** One entry the site keeps: its stored key, its name in plain words, and how
 * its owner clears it. */
export interface StoredEntry {
  key: string
  label: string
  clear: () => void
}

/** The entries, in the order the Data section lists them. */
export const STORED_DATA: readonly StoredEntry[] = [
  appearanceEntry,
  dockOrderEntry,
  resumeLocaleEntry,
  terminalHistoryEntry,
]

/** No bytes stored, which is what the server can honestly answer. */
const NOTHING_STORED: Readonly<Record<string, number>> = Object.freeze(
  Object.fromEntries(STORED_DATA.map((entry) => [entry.key, 0]))
)

const listeners = new Set<() => void>()

/** The raw value under `key`, or null when there is none to read. */
function storedRaw(key: string): string | null {
  if (typeof window === "undefined") return null
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

/** The last sizes snapshot, memoised on a signature of the sizes so React sees
 * one reference until a size actually changes. */
let memoSignature: string | null = null
let memoSizes: Readonly<Record<string, number>> = NOTHING_STORED

/** What each entry weighs in bytes, measured from the value stored under it. */
export function storedSizesSnapshot(): Readonly<Record<string, number>> {
  const sizes: Record<string, number> = {}
  let signature = ""
  for (const entry of STORED_DATA) {
    const raw = storedRaw(entry.key)
    const bytes = raw === null ? 0 : new Blob([raw]).size
    sizes[entry.key] = bytes
    signature += `${bytes}\u0000`
  }
  if (signature !== memoSignature) {
    memoSignature = signature
    memoSizes = sizes
  }
  return memoSizes
}

/** What the server renders: it has no storage, so every entry weighs nothing. */
export function storedSizesServerSnapshot(): Readonly<Record<string, number>> {
  return NOTHING_STORED
}

/** Be told when the sizes may have moved: this tab's own deletes, and another
 * tab's writes. */
export function subscribeStoredSizes(onChange: () => void): () => void {
  listeners.add(onChange)
  window.addEventListener("storage", onChange)
  return () => {
    listeners.delete(onChange)
    window.removeEventListener("storage", onChange)
  }
}

/** Delete one entry, asking its owner to clear it, then tell the Data section
 * the sizes moved. */
export function clearStoredEntry(entry: StoredEntry): void {
  entry.clear()
  for (const listener of listeners) listener()
}

/** Delete every entry the same way, each through its owner. */
export function clearAllStoredData(): void {
  for (const entry of STORED_DATA) entry.clear()
  for (const listener of listeners) listener()
}

const UNITS = ["B", "KB", "MB", "GB", "TB"]

/** A byte count, rounded down so it never claims more than is stored. */
export function formatBytes(bytes: number): string {
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < UNITS.length - 1) {
    value /= 1024
    unit += 1
  }
  if (unit === 0) return `${value} B`
  const scaled = Math.floor(value * 10) / 10
  return `${Number.isInteger(scaled) ? scaled : scaled.toFixed(1)} ${UNITS[unit]}`
}
