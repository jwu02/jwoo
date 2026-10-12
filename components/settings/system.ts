// What the site can learn about the visitor's browser and connection.
//
// This is an observation, not stored state: every fact is read from the browser
// when it is asked for. A fact a browser does not report is absent from the
// snapshot rather than present as a placeholder, so the System section can
// leave the row out instead of printing "unknown" as information.
//
// The server reports nothing — it has no window — so its snapshot is empty and
// the facts appear once the page has hydrated.

import manifest from "@/package.json"

/** The site's version, read from the package manifest at build time. There is
 * no build identifier: nothing produces one. */
export const SITE_VERSION: string = manifest.version

/** The facts the System section reports. A key is absent when the browser does
 * not report it. */
export interface SystemFacts {
  languages?: string
  timeZone?: string
}

/** Nothing known, which is what the server can honestly answer. */
const NOTHING: SystemFacts = Object.freeze({})

function readTimeZone(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null
  } catch {
    // A browser that cannot answer simply says nothing.
    return null
  }
}

function readFacts(): SystemFacts {
  const facts: SystemFacts = {}

  const languages = navigator.languages?.length
    ? navigator.languages.join(", ")
    : navigator.language
  if (languages) facts.languages = languages

  const timeZone = readTimeZone()
  if (timeZone) facts.timeZone = timeZone

  return facts
}

/** The last snapshot, memoised on the facts themselves so React sees one
 * reference until a fact actually changes. */
let memoKey: string | null = null
let memoFacts: SystemFacts = NOTHING

/** What the browser reports right now. */
export function systemSnapshot(): SystemFacts {
  if (typeof window === "undefined") return NOTHING
  const facts = readFacts()
  const key = JSON.stringify(facts)
  if (key !== memoKey) {
    memoKey = key
    memoFacts = facts
  }
  return memoFacts
}

/** What the server renders: it has no browser to ask. */
export function systemServerSnapshot(): SystemFacts {
  return NOTHING
}

/** Nothing to subscribe to: the facts still shown do not move while the page is
 * open. */
export function subscribeSystem(): () => void {
  return () => {}
}
