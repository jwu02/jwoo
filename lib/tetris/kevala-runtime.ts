// kevala's lazy boundary: the module the consent screen's Enter imports
// (ADR-0009), and the only place the Worker is built. Nothing imports it yet —
// the consent ticket (#56) fires that import, and firing it is the whole of the
// trigger.
//
// Keeping it that way is what puts the worker, the runtime and the ML packages
// below the boundary: a visitor who never touches kevala never pays for them,
// and the eager-graph test refuses those packages if a route's static graph (or
// this module's own) ever reaches one (ADR-0001, ADR-0009).
//
// The Worker is a module worker because the scorer is one: transformers.js and
// onnxruntime load as ES modules, and a multi-second forward must not share a
// thread with the Ticker that drives the cabinet.

import { createKevalaJudge, type KevalaRuntime } from "./kevala-judge"

/**
 * Open a kevala session: the worker starts empty, and `warm()` brings the
 * Checkpoint up inside it. One call per consent — the session is what the
 * cabinet keeps while kevala drives and hands back on exit.
 */
export function openKevala(): KevalaRuntime {
  const worker = new Worker(new URL("./kevala-worker.ts", import.meta.url), {
    type: "module",
    name: "kevala",
  })
  return createKevalaJudge(worker)
}
