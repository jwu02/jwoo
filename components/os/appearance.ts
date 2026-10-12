// What appearance the OS is drawn in, and where the visitor's choice is
// remembered between visits.
//
// The whole OS keys off one class on `<html>`: `:root` holds the light tokens
// and `.dark` overrides them, so an application needs to know nothing about the
// appearance to follow it. This is the one place that reads and writes the
// stored choice and the one place that puts the class on the document — the
// Shell only re-applies it, so the class is never a second source of truth.
//
// Storage can be absent or throw — a private-mode browser, a disabled store —
// and in that case the choice simply lives in memory for this visit. A visitor
// who has never chosen follows the appearance their own system reports.

import type { Appearance } from "@/lib/appearance"

/** The two appearances the OS is drawn in. */
export type { Appearance }

const KEY = "os.appearance"
const DARK = "dark"

/** The key the choice is stored under. */
export const APPEARANCE_KEY = KEY

/** The last choice written here, for when storage cannot be used. Module scope
 * is the whole of the fallback's lifetime: one visit. */
let inMemory: Appearance | null = null

/** Set when a write was refused — a full quota, a store that only reads. From
 * then on storage is not authoritative, since it holds less than this visit
 * does, and reads answer from memory. */
let refusedWrite = false

const listeners = new Set<() => void>()

/** What the visitor's own system reports. jsdom and the server report nothing,
 * which reads as light. */
function systemAppearance(): Appearance {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function")
    return "light"
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light"
}

function readRaw(): string | null {
  if (refusedWrite) return inMemory
  try {
    return window.localStorage.getItem(KEY)
  } catch {
    // No storage at all: this visit's own writing is all there is.
    return inMemory
  }
}

/** The appearance a stored value means. A chosen appearance is what the visitor
 * gets; anything else — nothing stored, an unrecognised value — is the system's
 * answer, asked again on every read so an unchosen appearance keeps following
 * it. */
function appearanceFrom(raw: string | null): Appearance {
  if (raw === "light" || raw === "dark") return raw
  return systemAppearance()
}

/** The appearance in effect. A plain string, so React needs no memo for it. */
export function appearanceSnapshot(): Appearance {
  return appearanceFrom(readRaw())
}

/** What the server renders: the OS's own dark look, which the pre-paint script
 * corrects before anything is painted. The class is React's too (`app/layout`),
 * so this answers the appearance the server-rendered document is already in. */
export function appearanceServerSnapshot(): Appearance {
  return DARK
}

/** Draw the OS in the appearance the visitor has in effect. */
export function applyAppearance(): void {
  document.documentElement.classList.toggle(DARK, appearanceSnapshot() === DARK)
}

/** Remember the visitor's choice and draw the OS in it. */
export function saveAppearance(appearance: Appearance): void {
  inMemory = appearance
  try {
    window.localStorage.setItem(KEY, appearance)
    refusedWrite = false
  } catch {
    // Memory already holds it — that is the fallback.
    refusedWrite = true
  }
  applyAppearance()
  for (const listener of listeners) listener()
}

/** The Data section's descriptor for this entry. */
export const appearanceEntry = {
  key: KEY,
  label: "Appearance",
  clear: clearAppearance,
}

/** Forget the visitor's choice, leaving them where a first visit finds them. */
export function clearAppearance(): void {
  inMemory = null
  refusedWrite = false
  try {
    window.localStorage.removeItem(KEY)
  } catch {
    // Nothing was stored, or nothing can be written: memory is already clear.
  }
  applyAppearance()
  for (const listener of listeners) listener()
}

/** Be told when the appearance changes: this tab's own writes, and another
 * tab's. Another tab wrote storage, not the document, so the class is put on
 * here before the listeners re-render. */
export function subscribeAppearance(onChange: () => void): () => void {
  listeners.add(onChange)
  const onStorage = () => {
    applyAppearance()
    onChange()
  }
  window.addEventListener("storage", onStorage)
  return () => {
    listeners.delete(onChange)
    window.removeEventListener("storage", onStorage)
  }
}

/** The choice put on `<html>` before the browser's first paint, so a visitor
 * never sees the wrong appearance flash over the page. The store's own
 * resolution, restated as the string the document can run before React does. */
export const appearanceScript = `(function(){var v=null;try{v=window.localStorage.getItem(${JSON.stringify(
  KEY,
)})}catch(e){}
if(v!=="light"&&v!=="dark"){v=(window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches)?"dark":"light"}
document.documentElement.classList.toggle("dark",v==="dark")})()`
