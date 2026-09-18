import { useSyncExternalStore } from "react"

const MOBILE_BREAKPOINT = 768

// The media query is the single source of truth: subscribe listens to it and
// getSnapshot reads the same query back, so the listener and the value can
// never disagree (a fractional viewport width, e.g. 767.5px under page zoom,
// compares differently against `innerWidth` than against the query).
function mobileQuery() {
  return window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
}

function subscribe(onStoreChange: () => void) {
  const mql = mobileQuery()
  mql.addEventListener("change", onStoreChange)
  return () => mql.removeEventListener("change", onStoreChange)
}

function getSnapshot() {
  return mobileQuery().matches
}

export function useIsMobile() {
  return useSyncExternalStore(subscribe, getSnapshot, () => false)
}
