// Where History is remembered between visits.
//
// The Input bar's machine keeps History in its state and asks nothing of the
// browser; this is the one place that knows about `localStorage`, so the
// machine can stay pure. Storage can be absent or throw — a private-mode
// browser, a disabled store, a corrupted value — and in every one of those
// cases History simply lives in memory for this visit instead.

const KEY = "terminal.history"

/** The last History written here, for when storage cannot be used. Module
 * scope is the whole of the fallback's lifetime: one visit. */
let inMemory: string[] = []

/** The invocations a previous visit left, oldest first. Anything unreadable —
 * the store itself refusing, a value that is not JSON, a value that is not a
 * list of strings — reads as no History at all, because a fresh visit is the
 * safe way to be wrong. */
export function loadHistory(): string[] {
  let raw: string | null
  try {
    raw = window.localStorage.getItem(KEY)
  } catch {
    // No storage at all: this visit's own writing is all there is.
    return inMemory
  }
  if (!raw) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed)
      ? parsed.filter((entry): entry is string => typeof entry === "string")
      : []
  } catch {
    return []
  }
}

/** Remember `history` for the next visit, or for this one if storage refuses. */
export function saveHistory(history: readonly string[]): void {
  inMemory = history.slice()
  try {
    window.localStorage.setItem(KEY, JSON.stringify(history))
  } catch {
    // Memory already holds it — that is the fallback.
  }
}
