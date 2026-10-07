// kevala's scorer: a module Web Worker owning the transformers.js session and
// the Checkpoint's weights (ADR-0009).
//
// It is a stateless scorer and nothing else. The main thread posts an
// Observation and its Placements; this answers with one probability per
// candidate, in the order they arrived. Generation, board validation, the plan
// and the drive all stay in the Autopilot on the other side of the async
// `judge()` seam — nothing here can know a game is being played.
//
// The model is the pivot the latency spike fired (#53), scored through the
// stock zero-shot pipeline: one premise (the board), one hypothesis per
// candidate Placement, and a softmax across the candidates' entailment logits
// that is the distribution the Margin is the gap in. Laya proper would have
// vendored its encoding and batched all forty candidates into one forward: at
// 48.6 s that forward missed the rule's budget by 12× on the dev machine, so
// the vendoring and the batch collation never ship.
//
// WebGPU is the only provider and there is no WASM fallback (ADR-0009): a
// browser that cannot run this is a browser the ready screen dims, not one fed
// a slow path.

import {
  env,
  pipeline,
  type ZeroShotClassificationOutput,
} from "@huggingface/transformers"
import { CHECKPOINT } from "./kevala"
import {
  HYPOTHESIS_TEMPLATE,
  candidateOrder,
  scoreQuestion,
} from "./kevala-encoding"
import type { KevalaRequest, KevalaResponse } from "./kevala-judge"

// The pin is the only source: never a local copy (a stale one would be scored
// as if it were the consented Checkpoint), and the browser cache is what makes
// a returning visitor's session warm instead of a re-download.
env.allowLocalModels = false
env.useBrowserCache = true

/**
 * Build the one session the worker keeps. The call has to be made here rather
 * than at the assignment below: transformers.js types `pipeline()` as a
 * per-task union that TypeScript refuses to materialize into an annotated
 * variable, so the variable's type is taken from this function's return.
 */
function open() {
  return pipeline("zero-shot-classification", CHECKPOINT.repo, {
    dtype: "q4f16", // resolves CHECKPOINT.path — onnx/model_q4f16.onnx
    device: "webgpu",
    revision: CHECKPOINT.revision,
  })
}

type Session = Awaited<ReturnType<typeof open>>

/** The one session, built on first ask and kept for the life of the worker. */
let session: Promise<Session> | null = null

function load(): Promise<Session> {
  session ??= open()
  return session
}

const post = (message: KevalaResponse) =>
  (
    self as unknown as { postMessage(message: KevalaResponse): void }
  ).postMessage(message)

self.addEventListener("message", (event: MessageEvent<KevalaRequest>) => {
  const message = event.data
  void (async () => {
    try {
      if (message.type === "load") {
        await load()
        post({ type: "ready" })
        return
      }
      const { premise, labels } = scoreQuestion(
        message.observation,
        message.placements
      )
      const classifier = await load()
      // One premise is one output; the pipeline's own type also admits the
      // batched array call it never makes for a string.
      const ranked = (await classifier(premise, labels, {
        hypothesis_template: HYPOTHESIS_TEMPLATE,
      })) as ZeroShotClassificationOutput
      post({
        type: "scored",
        id: message.id,
        scores: candidateOrder(labels, ranked),
      })
    } catch (error) {
      // A judgment that cannot be scored rejects on the main thread and is
      // discarded there; a load that fails kills the session. Either way the
      // Autopilot is told, rather than left waiting on a Tick that never comes.
      post({
        type: "failed",
        id: message.type === "judge" ? message.id : undefined,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  })()
})
