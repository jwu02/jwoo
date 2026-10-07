// The offer's device-side state: whether this browser can run kevala at all, and
// whether the offered Checkpoint has been consented to yet.
//
// Both answers are read from the browser and only feed the drawn ready screen
// (ADR-0008): kevala runs on WebGPU or not at all (ADR-0009), so a missing
// `navigator.gpu` dims the line rather than promising a slower path; and a
// Checkpoint with no consent record is a new offer, which is what makes the
// line blink.

/**
 * The one model version kevala can offer, pinned: the repo and file the weights
 * come from, the revision they come from at, and exactly how many bytes that is.
 *
 * The worker fetches the artifact from Hugging Face at `revision` and nothing
 * else — no local copy, no other revision. The consent screen discloses `name`
 * and `bytes` before anything moves, and the consent record and the weights
 * cache are keyed to it, so a new Checkpoint is a new offer: the visitor said
 * yes to this model, not to kevala in general. Both of those are the consent
 * ticket's (#56); this ticket pins the constant they will read. Bumping any
 * field re-offers on the ready screen and evicts the old weights.
 *
 * The pivot the latency spike fired (#53): `batched-40` on Laya proper missed
 * the rule's ~4 s budget by 12×, so the judge scores through the stock
 * transformers.js zero-shot pipeline and the vendored laya encoding never
 * ships. `path` is what `dtype: "q4f16"` resolves to — the pin and the runtime
 * name the same file, and this constant is what makes that checkable.
 */
export const CHECKPOINT = {
  repo: "onnx-community/ModernBERT-base-nli-ONNX",
  path: "onnx/model_q4f16.onnx",
  /** The repo commit, not a branch: what is fetched is what was consented to. */
  revision: "257f45d1807508f060b054de8bd22ce03640ddd3",
  /** `onnx/model_q4f16.onnx` exactly, as the file tree reports it. */
  bytes: 140209867,
  /** What the consent screen calls it; inside the cabinet font's glyph set. */
  name: "ModernBERT-base-nli",
} as const

/**
 * What the ready screen offers beside 1 PLAYER: whether this browser can run
 * kevala (WebGPU is its only provider), and whether the Checkpoint it would
 * offer is still new — no consent record, so the line blinks (ADR-0008).
 */
export interface KevalaOffer {
  available: boolean
  pending: boolean
}

/**
 * Whether this browser can run kevala. WebGPU is its only execution provider, so
 * this is the whole capability gate — no device-class check beyond it.
 */
export function webgpuAvailable(): boolean {
  return typeof navigator !== "undefined" && "gpu" in navigator
}

/**
 * Where the consent record lives. The ready screen only reads it; the consent
 * screen records under it. Keying the record to the Checkpoint (ADR-0009) is
 * the consent ticket's (#56), which has the pinned constant to key on; one
 * fixed key stands in until it lands.
 */
export const CONSENT_KEY = "kevala:consent"

/**
 * Whether the offered Checkpoint has no consent record yet — the blink. A
 * browser that refuses storage (private mode, blocked cookies) reads as
 * unconsented, which is the honest answer: nothing here can be trusted to
 * remember the visitor said yes.
 */
export function consentPending(): boolean {
  try {
    return window.localStorage.getItem(CONSENT_KEY) === null
  } catch {
    return true
  }
}
