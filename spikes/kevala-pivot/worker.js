// Throwaway spike for the kevala pivot's per-decision cost (jwu02/jwoo#55).
//
// It measures the shape the shipped scorer runs (lib/tetris/kevala-worker.ts):
// the stock transformers.js zero-shot pipeline, one premise — the board as
// text — and one hypothesis per candidate Placement, scored in a single
// classifier() call. The pipeline serves that call as one forward per
// hypothesis, which is the cost under test: nothing else measures the pivot
// against the owner's <5 s bar (spikes/kevala-latency/README.md, "Fired
// decision"). Nothing in the app imports this.
//
// It tries the shipped pin first (q4f16) and falls back to fp16, reporting each
// attempt, so a failure says which artifact the stack refused rather than only
// that something threw.

import {
  AutoModel,
  env,
  pipeline,
} from "./node_modules/@huggingface/transformers/dist/transformers.min.js"

const REPO = "onnx-community/ModernBERT-base-nli-ONNX"
const REVISION = "257f45d1807508f060b054de8bd22ce03640ddd3"

/**
 * `?model=distilbert` swaps in a different zero-shot artifact — a control. If
 * this one opens where the pin does not, the failure belongs to the pinned
 * artifact, not to the harness, the ORT build or the machine.
 */
const CONTROL = {
  repo: "Xenova/distilbert-base-uncased-mnli",
  revision: "main",
  dtype: "q8",
}
const requested = new URL(self.location.href).searchParams.get("model")
const MODEL =
  requested === "distilbert"
    ? CONTROL
    : { repo: REPO, revision: REVISION, dtype: requested === "modernbert-fp16" ? "fp16" : "q4f16" }
const CANDIDATES = 40 // the candidate batch kevala's enumeration reaches
const RUNS = 3 // timed decisions; the median is what the bar reads
const HYPOTHESIS = "The best move is {}."

// huggingface.co does not resolve on the machine this ran on — the router
// answers it with an unrelated address — so this harness reads the same pinned
// artifact through the HF-compatible mirror (see run.mjs's /hf proxy). The
// weights are the same bytes at the same revision; only the fetch path
// differs, and the forward this measures is unaffected. The shipped runtime
// reads huggingface.co.
env.allowLocalModels = false
env.useBrowserCache = true
env.remoteHost =
  new URL(self.location.href).searchParams.get("remote") ??
  "https://huggingface.co"
// `?local=1` reads the same files from ./models (fetched once, byte-checked
// against CHECKPOINT.bytes) so repeated runs skip the 140 MB fetch and the
// proxy. The shipped runtime reads huggingface.co direct.
if (new URL(self.location.href).searchParams.has("local")) {
  env.allowLocalModels = true
  env.localModelPath = "./models/"
}// The wasm the WebGPU EP needs, served from this directory: nothing here is
// cross-origin isolated, so onnxruntime's threads stay at one. The same two
// settings the latency spike proved.
env.backends.onnx.wasm.wasmPaths = new URL(
  "./node_modules/@huggingface/transformers/dist/",
  self.location.href
).href
env.backends.onnx.wasm.numThreads = 1

const post = (message) => self.postMessage(message)
const describe = (error) =>
  `${String(error)} | name=${error?.name} | message=${error?.message} | ` +
  `stack=${error?.stack} | keys=${(() => {
    try {
      return Object.keys(error).join(",")
    } catch {
      return "none"
    }
  })()}`

/** A plausible mid-game board, the way lib/tetris/kevala-encoding.ts renders one. */
const BOARD = [
  "level 9 lines 47 score 12940",
  "active T rotation 1 column 4 row 6",
  "next J L O S Z I T",
  "hold empty",
  "board:",
  "..........",
  "..........",
  "..........",
  "..........",
  "..........",
  "..........",
  "..........",
  "..........",
  "..........",
  "..........",
  "..........",
  ".......XX.",
  "........X.",
  ".......XX.",
  "....XX.XX.",
  "...XXXXXX.",
  "..XXXXXXX.",
  ".XXXXXXXX.",
  "XXXXXXXXX.",
].join("\n")

/** One candidate per Placement, in the order the enumeration gave them. */
const LABELS = Array.from(
  { length: CANDIDATES },
  (_, index) =>
    `dropping the ${"TJLOSZI"[index % 7]} piece rotated ${index % 4} into column ${index % 10}`
)

function median(samples) {
  const sorted = [...samples].sort((a, b) => a - b)
  const middle = sorted.length >> 1
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2
}

const fetched = new Map()
const progress = (event) => {
  if (event.file && event.loaded) fetched.set(event.file, event.loaded)
}

async function openPipeline() {
  const started = performance.now()
  try {
    const classifier = await pipeline("zero-shot-classification", MODEL.repo, {
      dtype: MODEL.dtype,
      device: "webgpu",
      revision: MODEL.revision,
      progress_callback: progress,
    })
    return {
      dtype: `pipeline ${MODEL.dtype}`,
      ok: true,
      classifier,
      ms: Math.round(performance.now() - started),
    }
  } catch (error) {
    return {
      dtype: `pipeline ${MODEL.dtype}`,
      ok: false,
      error: describe(error),
      ms: Math.round(performance.now() - started),
    }
  }
}

async function openModel() {
  const started = performance.now()
  try {
    await AutoModel.from_pretrained(MODEL.repo, {
      dtype: MODEL.dtype,
      device: "webgpu",
      revision: MODEL.revision,
      progress_callback: progress,
    })
    return {
      dtype: `AutoModel ${MODEL.dtype}`,
      ok: true,
      ms: Math.round(performance.now() - started),
    }
  } catch (error) {
    return {
      dtype: `AutoModel ${MODEL.dtype}`,
      ok: false,
      error: describe(error),
      ms: Math.round(performance.now() - started),
    }
  }
}

async function time(classifier) {
  const samples = []
  let first = null
  let last = null
  let finite = true
  for (let run = 0; run <= RUNS; run++) {
    const begin = performance.now()
    const output = await classifier(BOARD, LABELS, {
      hypothesis_template: HYPOTHESIS,
    })
    const result = {
      ms: performance.now() - begin,
      finite: output.scores.every(Number.isFinite),
      sum: output.scores.reduce((total, score) => total + score, 0),
      top: output.labels[0],
      topScore: output.scores[0],
    }
    if (run === 0) first = result
    last = result
    finite = finite && result.finite
    if (run > 0) samples.push(result.ms)
    post({
      type: "progress",
      line: `decision ${run + 1}/${RUNS + 1} ${Math.round(result.ms)} ms`,
    })
  }
  return {
    name: "decision",
    batch: 1,
    options: CANDIDATES,
    firstMs: Math.round(first.ms),
    runs: samples.map((ms) => Math.round(ms)),
    medianMs: Math.round(median(samples)),
    minMs: Math.round(Math.min(...samples)),
    finite,
    probabilitySum: last.sum,
    top: last.top,
    topScore: last.topScore,
  }
}

async function main() {
  const started = performance.now()
  post({
    type: "progress",
    line: `ort=${JSON.stringify(env.backends.onnx.versions)} local=${env.allowLocalModels}`,
  })

  // The control runs first, on a clean ORT state: a failure poisons
  // subsequent loads, so whoever goes second inherits the first one's error
  // instantly (that is what the 169 ms AutoModel failure was). The control is
  // the exact shape the latency spike proved on this stack.
  const order = new URL(self.location.href).searchParams.has("pipeline")
    ? [openPipeline, openModel]
    : [openModel, openPipeline]

  const attempts = []
  let chosen = null
  for (const attempt of order) {
    const result = await attempt()
    attempts.push(result)
    post({
      type: "progress",
      line: `${result.dtype} ${result.ok ? `opened in ${result.ms} ms` : `FAILED: ${result.error}`}`,
    })
    if (result.ok && result.classifier) chosen = result
  }

  const report = {
    model: `${MODEL.repo}@${MODEL.revision.slice(0, 7)} ${MODEL.dtype}`,
    ort: env.backends.onnx.versions,
    localModels: env.allowLocalModels,
    load: {
      modelMs: Math.round(performance.now() - started),
      fetched: [...fetched].map(([file, bytes]) => ({ file, bytes })),
    },
    attempts: attempts.map(({ dtype, ok, ms, error }) => ({
      dtype,
      ok,
      ms,
      error,
    })),
    results: [],
  }

  if (!chosen) {
    post({ type: "done", report })
    return
  }
  report.results.push(await time(chosen.classifier))
  post({ type: "done", report })
}

main().catch((error) => {
  post({ type: "error", error: describe(error) })
})
