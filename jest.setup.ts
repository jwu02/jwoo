import "@testing-library/jest-dom";

// jsdom implements no PointerEvent, and base-ui's Switch dispatches a
// constructed click with it — without the shim the click throws instead of
// toggling. MouseEvent carries the fields it reads (modifiers, detail, bubbles),
// so the alias is enough.
// Node-environment suites (the API routes) have no window at all.
if (typeof window !== "undefined" && !window.PointerEvent) {
  window.PointerEvent = MouseEvent as unknown as typeof PointerEvent;
}
