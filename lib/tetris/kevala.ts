// The offer's device-side state: whether this browser can run kevala at all, and
// whether the offered Checkpoint has been consented to yet.
//
// Both answers are read from the browser and only feed the drawn ready screen
// (ADR-0008): kevala runs on WebGPU or not at all (ADR-0009), so a missing
// `navigator.gpu` dims the line rather than promising a slower path; and a
// Checkpoint with no consent record is a new offer, which is what makes the
// line blink.

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
 * screen records under it. Keying the record to the Checkpoint (ADR-0009) lands
 * with the pinned constant, so one fixed key stands in until then.
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
