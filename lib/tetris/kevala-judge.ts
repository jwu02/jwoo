// The Judge's main-thread half: the Autopilot's seam with a module Web Worker
// behind it (ADR-0009).
//
// The Autopilot knows a Judge and nothing else — it hands over an Observation
// and the legal Placements and gets back an index and a Margin, synchronously
// or not. The model is a multi-second forward on a foreign thread, so this side
// owns the whole of that: the protocol, the pending answers, the readiness of
// the session, and the promise that a dead worker is a rejected judgment rather
// than a Tick that never resolves.
//
// The worker stays a scorer — it answers with one probability per candidate, in
// the order it was given them — and the winner is picked here by the same
// `argmax` the Autopilot is tested with, so the tie-break that keeps a replay
// deterministic lives in one place and not two.

import { argmax, type Judge, type Judgment } from "./autopilot"
import type { Observation, Placement } from "./engine"

/** What the worker is asked, and what it answers. */
export interface KevalaLoad {
  type: "load"
}

export interface KevalaJudgeRequest {
  type: "judge"
  id: number
  observation: Observation
  placements: readonly Placement[]
}

export type KevalaRequest = KevalaLoad | KevalaJudgeRequest

export type KevalaResponse =
  | { type: "ready" }
  | { type: "scored"; id: number; scores: number[] }
  /** A failure that killed the session when it carries no id; one judgment when it does. */
  | { type: "failed"; id?: number; error: string }

/**
 * A live kevala session: the Judge the Autopilot drives, and the lifecycle the
 * cabinet owns. Warm while kevala is enabled — the model stays in the worker
 * between games — and disposed on hand-off or app exit.
 */
export interface KevalaRuntime extends Judge {
  /** Always a promise: the model answers off this thread, never synchronously. */
  judge(
    observation: Observation,
    placements: readonly Placement[]
  ): Promise<Judgment>
  /** Bring the Checkpoint up in the worker; resolves once it can score. Idempotent. */
  warm(): Promise<void>
  /** Hand the session back: the worker dies and anything outstanding rejects. */
  dispose(): void
}

/**
 * The Judge over a worker. The worker is injected rather than constructed here
 * so the protocol is a seam a scripted worker can sit behind — which is how the
 * Autopilot is run against this client without WebGPU, weights or a browser.
 */
export function createKevalaJudge(worker: Worker): KevalaRuntime {
  const outstanding = new Map<
    number,
    { resolve: (judgment: Judgment) => void; reject: (error: Error) => void }
  >()
  let nextId = 0
  let ready: Promise<void> | null = null
  let loaded: (() => void) | null = null
  let broke: ((error: Error) => void) | null = null
  let failure: Error | null = null
  let disposed = false

  const closed = () => new Error("the kevala session is closed")

  /** The session is dead: every waiter hears it, and every later call does too. */
  function fail(error: Error) {
    if (failure !== null) return
    failure = error
    for (const waiting of outstanding.values()) waiting.reject(error)
    outstanding.clear()
    broke?.(error)
  }

  function onMessage(event: MessageEvent<KevalaResponse>) {
    const message = event.data
    if (message.type === "ready") {
      loaded?.()
      loaded = null
      broke = null
      return
    }
    if (message.type === "failed") {
      const error = new Error(message.error)
      if (message.id === undefined) {
        fail(error)
        return
      }
      const waiting = outstanding.get(message.id)
      if (waiting === undefined) return
      outstanding.delete(message.id)
      waiting.reject(error)
      return
    }
    const waiting = outstanding.get(message.id)
    if (waiting === undefined) return
    outstanding.delete(message.id)
    // The worker answered in candidate order; the winner is picked where the
    // order is a tested contract, not on the thread that cannot be tested.
    try {
      waiting.resolve(argmax(message.scores))
    } catch (error) {
      waiting.reject(error as Error)
    }
  }

  // A worker that dies takes its answers with it — an event, not a message, and
  // the only notification a terminated or crashed worker ever sends.
  const onFailure = () => fail(new Error("the kevala worker failed"))

  worker.addEventListener("message", onMessage)
  worker.addEventListener("error", onFailure)
  worker.addEventListener("messageerror", onFailure)

  /** Idempotent: the Checkpoint comes up once, however many times it is asked for. */
  function warm(): Promise<void> {
    if (disposed) return Promise.reject(closed())
    if (failure !== null) return Promise.reject(failure)
    if (ready === null) {
      ready = new Promise<void>((resolve, reject) => {
        loaded = resolve
        broke = reject
      })
      worker.postMessage({ type: "load" } satisfies KevalaLoad)
    }
    return ready
  }

  return {
    warm,

    async judge(observation, placements) {
      if (disposed) throw closed()
      await warm()
      if (disposed) throw closed()
      const id = nextId++
      return new Promise<Judgment>((resolve, reject) => {
        outstanding.set(id, { resolve, reject })
        const request: KevalaJudgeRequest = {
          type: "judge",
          id,
          observation,
          placements,
        }
        worker.postMessage(request)
      })
    },

    dispose() {
      if (disposed) return
      disposed = true
      // Anything still out there — a load in flight, a judgment being scored —
      // is answered now, so a hand-off never leaves a promise hanging.
      fail(closed())
      worker.removeEventListener("message", onMessage)
      worker.removeEventListener("error", onFailure)
      worker.removeEventListener("messageerror", onFailure)
      worker.terminate()
    },
  }
}
