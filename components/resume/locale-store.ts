// Which language the resume is read in, and where the visitor's choice is
// remembered between visits.
//
// The view asks this for the locale it renders and hands back the one a toggle
// press chose; this is the one place that knows about `localStorage`, so the
// view can stay a view of a locale rather than a keeper of one. Storage can be
// absent or throw — a private-mode browser, a disabled store — and in that case
// the choice simply lives in memory for this visit.

import type { Locale } from "@/lib/resume/types"

const KEY = "resume:locale"
const DEFAULT_LOCALE: Locale = "en"

/** The key the choice is stored under. */
export const RESUME_LOCALE_KEY = KEY

/** The last choice written here, for when storage cannot be used. Module scope
 * is the whole of the fallback's lifetime: one visit. */
let inMemory: string | null = null

/** Set when a write was refused — a full quota, a store that only reads. From
 * then on storage is not authoritative, since it holds less than this visit
 * does, and reads answer from memory. */
let refusedWrite = false

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

/** The locale a stored value means. Anything but the one other language it
 * could name reads as English, because a fresh visit is the safe way to be
 * wrong. */
function localeFrom(raw: string | null): Locale {
  return raw === "zh" ? "zh" : DEFAULT_LOCALE
}

/** The locale the resume is read in. A plain string, so React needs no memo. */
export function localeSnapshot(): Locale {
  return localeFrom(readRaw())
}

/** What the server renders: it has no storage, so English stands and hydration
 * settles any difference. */
export function localeServerSnapshot(): Locale {
  return DEFAULT_LOCALE
}

/** Remember the language the visitor chose. */
export function saveLocale(locale: Locale): void {
  inMemory = locale
  try {
    window.localStorage.setItem(KEY, locale)
    refusedWrite = false
  } catch {
    // Memory already holds it — that is the fallback.
    refusedWrite = true
  }
  for (const listener of listeners) listener()
}

/** Forget the visitor's choice, leaving them where a first visit finds them. */
export function clearLocale(): void {
  inMemory = null
  refusedWrite = false
  try {
    window.localStorage.removeItem(KEY)
  } catch {
    // Nothing was stored, or nothing can be written: memory is already clear.
  }
  for (const listener of listeners) listener()
}

/** Be told when the locale changes: this tab's own writes, and another tab's. */
export function subscribeLocale(onChange: () => void): () => void {
  listeners.add(onChange)
  window.addEventListener("storage", onChange)
  return () => {
    listeners.delete(onChange)
    window.removeEventListener("storage", onChange)
  }
}
