// Throwaway latency spike for the kevala spec (jwu02/jwoo#53).
//
// Loads onnx-community/laya-ONNX fp16 (~0.85 GB) through transformers.js on
// WebGPU inside a module worker — the shape kevala's judge would run in — and
// times batched forwards of 40 candidate sequences against the artifact's
// 512-token context. Nothing in the app imports this; it never ships.
//
// The sequence layout and the batch collation mirror laya's own
// `build_sequence` (reconstructed here, not vendored): one sequence per
// candidate, [CLS] head [SEP] [MASK] option… [SEP] state [SEP], padded to the
// batch's longest row and cut at the artifact's 512-token context. Only the
// shapes matter for a latency measurement — the token values cost nothing.

import {
  AutoModel,
  AutoTokenizer,
  Tensor,
  env,
} from "./node_modules/@huggingface/transformers/dist/transformers.min.js"

const REPO = "onnx-community/laya-ONNX"
const REVISION = "42e2a6e3b3708c8ff5f61f4aa75c314b1449199b" // the 0.85 GB fp16 files
const MAX_LEN = 512 // config.json laya.max_len
const HEAD_MAX = 192 // config.json laya.head_max_len
const OPTION_MAX = 48 // laya's per-option token cap
const CANDIDATES = 40 // the candidate batch the decision rule names
const RUNS = 5 // timed runs per shape; the median is what the rule reads
const TOKENS_ONLY = new URL(self.location.href).searchParams.has("tokens")

env.allowLocalModels = false
env.useBrowserCache = true
env.backends.onnx.wasm.wasmPaths = new URL(
  "./node_modules/@huggingface/transformers/dist/",
  self.location.href
).href
env.backends.onnx.wasm.numThreads = 1 // nothing here is cross-origin isolated

const post = (message) => self.postMessage(message)

/** A plausible mid-game cabinet, dumped as text the way a judge would read it. */
const BOARD = [
  "level 9  lines 47  pieces 212",
  "active: T rotation 1 column 4 row 6",
  "next: J L O S Z I T",
  "hold: empty",
  "board:",
  "row 00 |..........",
  "row 01 |..........",
  "row 02 |..........",
  "row 03 |..........",
  "row 04 |..........",
  "row 05 |..........",
  "row 06 |..........",
  "row 07 |..........",
  "row 08 |..........",
  "row 09 |..........",
  "row 10 |..........",
  "row 11 |.......XX.",
  "row 12 |........X.",
  "row 13 |.......XX.",
  "row 14 |....XX.XX.",
  "row 15 |...XXXXXX.",
  "row 16 |..XXXXXXX.",
  "row 17 |.XXXXXXXX.",
  "row 18 |XXXXXXXXX.",
  "row 19 |XXXXXXXXXX",
].join("\n")

/** The same board repeated, to fill the artifact's 512-token context. */
const FILLED = [BOARD, BOARD, BOARD, BOARD].join("\n")

const LEVELS = ["very bad", "bad", "good", "very good"]

function helpers(tokenizer) {
  const config = tokenizer.config ?? {}
  const named = {
    cls: config.cls_token ?? "[CLS]",
    sep: config.sep_token ?? "[SEP]",
    mask: config.mask_token ?? "[MASK]",
    pad: config.pad_token ?? "[PAD]",
  }
  // A token string encoded without specials is that token alone; with them it
  // comes back wrapped in [CLS]/[SEP], so [0] is the wrong id. `wrapped` keeps
  // what that naive read gives — the bug this harness shipped its first run.
  const wrapped = Object.fromEntries(
    Object.entries(named).map(([name, token]) => [
      name,
      tokenizer.encode(token)[0],
    ])
  )
  const ids = Object.fromEntries(
    Object.entries(named).map(([name, token]) => [
      name,
      tokenizer.encode(token, { add_special_tokens: false })[0],
    ])
  )
  const { cls, sep, mask, pad } = ids
  // A collapsed special would silently fill the batch with [CLS] instead of
  // [MASK] markers and padding — the shapes would still time, the semantics
  // would be a lie. Cheap to keep honest.
  if (new Set([cls, sep, mask, pad]).size !== 4) {
    throw new Error(
      `special tokens collapsed to ${JSON.stringify(ids)} (naive: ${JSON.stringify(wrapped)})`
    )
  }
  /** Text without the specials the sequence builder places itself. */
  const encode = (text) => {
    const ids = tokenizer.encode(text, { add_special_tokens: false })
    if (ids[0] === cls) ids.shift()
    if (ids[ids.length - 1] === sep) ids.pop()
    return ids
  }
  return { cls, sep, mask, pad, encode, wrapped }
}

/**
 * One candidate sequence. Head and options are capped the way laya caps them;
 * the state takes whatever room is left and is cut from the top when it spills.
 */
function sequence(tokens, head, options, state) {
  const rendered = options.map((option) => [
    tokens.mask,
    ...tokens.encode(` ${option}`).slice(0, OPTION_MAX),
  ])
  let ids = [tokens.cls, ...tokens.encode(head).slice(0, HEAD_MAX), tokens.sep]
  const markers = []
  for (const option of rendered) {
    markers.push(ids.length)
    ids.push(...option)
  }
  ids.push(tokens.sep)
  const room = Math.max(0, MAX_LEN - ids.length - 1)
  ids = [...ids, ...state.slice(0, room), tokens.sep]
  return {
    ids: ids.slice(0, MAX_LEN),
    markers: markers.filter((marker) => marker < MAX_LEN),
  }
}

/** The 40 candidates, each a score question about its own landing board. */
function candidates(tokens, state) {
  return Array.from({ length: CANDIDATES }, (_, index) => {
    const piece = "TJLOSZI"[index % 7]
    const head =
      `score question: Rate the board after dropping ${piece} ` +
      `rotated ${index % 4} into column ${index % 10}.`
    return sequence(
      tokens,
      head,
      LEVELS.map((level, i) => `level ${i}: ${level}`),
      state
    )
  })
}

/** The candidate sequences collated into the int64/bool tensors the graph takes. */
function batch(items, tokens) {
  const rows = items.length
  const length = Math.max(...items.map((item) => item.ids.length))
  const optionSlots = Math.max(...items.map((item) => item.markers.length))
  const ids = new BigInt64Array(rows * length).fill(BigInt(tokens.pad))
  const attention = new BigInt64Array(rows * length)
  const positions = new BigInt64Array(rows * optionSlots)
  const markerMask = new Uint8Array(rows * optionSlots)
  const qtype = new BigInt64Array(rows).fill(1n) // 1 = score question
  items.forEach((item, row) => {
    item.ids.forEach((id, column) => {
      ids[row * length + column] = BigInt(id)
      attention[row * length + column] = 1n
    })
    item.markers.forEach((position, column) => {
      positions[row * optionSlots + column] = BigInt(position)
      markerMask[row * optionSlots + column] = 1
    })
  })
  return {
    length,
    optionSlots,
    tensors: {
      input_ids: new Tensor("int64", ids, [rows, length]),
      attention_mask: new Tensor("int64", attention, [rows, length]),
      marker_pos: new Tensor("int64", positions, [rows, optionSlots]),
      marker_mask: new Tensor("bool", markerMask, [rows, optionSlots]),
      qtype: new Tensor("int64", qtype, [rows]),
    },
  }
}

/** Output data on the CPU whatever location the runtime left it in. */
async function cpuData(tensor) {
  const data =
    typeof tensor.getData === "function" ? await tensor.getData() : tensor.data
  return { dims: tensor.dims, values: Array.from(data) }
}

function median(samples) {
  const sorted = [...samples].sort((a, b) => a - b)
  const middle = sorted.length >> 1
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2
}

async function main() {
  const fetched = new Map()
  const progress = (event) => {
    if (event.file && event.loaded) fetched.set(event.file, event.loaded)
  }
  const files = () => [...fetched].map(([file, bytes]) => ({ file, bytes }))

  const started = performance.now()
  const tokenizer = await AutoTokenizer.from_pretrained(REPO, {
    revision: REVISION,
    progress_callback: progress,
  })
  const tokenized = performance.now()

  const tokens = helpers(tokenizer)
  const specials = {
    cls: tokens.cls,
    sep: tokens.sep,
    mask: tokens.mask,
    pad: tokens.pad,
  }
  post({ type: "progress", line: `specials ${JSON.stringify(specials)}` })

  if (TOKENS_ONLY) {
    post({
      type: "done",
      report: {
        model: `${REPO} (tokenizer only)`,
        specials,
        wrapped: tokens.wrapped,
        load: {
          tokenizerMs: Math.round(tokenized - started),
          modelMs: 0,
          totalMs: Math.round(tokenized - started),
          fetched: files(),
        },
        results: [],
      },
    })
    return
  }

  const model = await AutoModel.from_pretrained(REPO, {
    dtype: "fp16",
    device: "webgpu",
    revision: REVISION,
    progress_callback: progress,
  })
  const loaded = performance.now()

  const natural = candidates(tokens, tokens.encode(BOARD))
  const filled = candidates(tokens, tokens.encode(FILLED))

  const forward = async (shape) => {
    const start = performance.now()
    const output = await model(shape.tensors)
    const logits = await cpuData(output.logits)
    return {
      ms: performance.now() - start,
      logits,
      finite: logits.values.every(Number.isFinite),
    }
  }

  const shapes = [
    { name: "warmup-b40", items: filled, runs: 0 },
    { name: "b40x512", items: filled, runs: RUNS },
    { name: "b5x512", items: filled.slice(0, 5), runs: RUNS },
    { name: "b40xnatural", items: natural, runs: RUNS },
  ]

  const results = []
  for (const shape of shapes) {
    const collated = batch(shape.items, tokens)
    const samples = []
    let first = null
    let last = null
    let finite = true
    let lowest = Infinity
    let highest = -Infinity
    for (let run = 0; run <= shape.runs; run++) {
      const result = await forward({ tensors: collated.tensors })
      if (run === 0) first = result
      last = result
      finite = finite && result.finite
      lowest = Math.min(lowest, ...result.logits.values)
      highest = Math.max(highest, ...result.logits.values)
      if (run > 0) samples.push(result.ms)
      post({
        type: "progress",
        line: `forward ${shape.name} ${run + 1}/${shape.runs + 1} ${Math.round(result.ms)} ms`,
      })
    }
    results.push({
      name: shape.name,
      batch: shape.items.length,
      tokens: collated.length,
      optionSlots: collated.optionSlots,
      firstMs: Math.round(first.ms),
      runs: samples.map((ms) => Math.round(ms)),
      medianMs: samples.length ? Math.round(median(samples)) : null,
      minMs: samples.length ? Math.round(Math.min(...samples)) : null,
      finite,
      logitsDims: last.logits.dims,
      logitsMin: lowest,
      logitsMax: highest,
      argmax: last.logits.values
        .map((_, index) => index)
        .filter((index) => index % last.logits.dims[1] === 0)
        .map((row) => {
          const rowValues = last.logits.values.slice(
            row,
            row + last.logits.dims[1]
          )
          return rowValues.indexOf(Math.max(...rowValues))
        }),
    })
  }

  post({
    type: "done",
    report: {
      model: `${REPO}@${REVISION.slice(0, 7)} fp16`,
      specials,
      load: {
        tokenizerMs: Math.round(tokenized - started),
        modelMs: Math.round(loaded - tokenized),
        totalMs: Math.round(loaded - started),
        fetched: files(),
      },
      results,
    },
  })
}

main().catch((error) => {
  post({ type: "error", error: String(error?.stack ?? error) })
})
