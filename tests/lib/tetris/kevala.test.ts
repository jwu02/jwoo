import {
  CONSENT_KEY,
  CHECKPOINT,
  consentPending,
  webgpuAvailable,
} from "@/lib/tetris/kevala"
import { glyphSafe } from "@/components/tetris/pixel-font"

describe("the kevala offer", () => {
  afterEach(() => {
    localStorage.clear()
    Reflect.deleteProperty(navigator, "gpu")
  })

  it("needs WebGPU, and nothing else", () => {
    expect(webgpuAvailable()).toBe(false)
    Object.defineProperty(navigator, "gpu", { value: {}, configurable: true })
    expect(webgpuAvailable()).toBe(true)
  })

  it("reads a Checkpoint as new until a consent record exists", () => {
    expect(consentPending()).toBe(true)
    // What the consent screen will write; the ready screen only reads it.
    localStorage.setItem(CONSENT_KEY, "1")
    expect(consentPending()).toBe(false)
  })

  it("reads a browser that refuses storage as unconsented", () => {
    const getItem = jest
      .spyOn(Storage.prototype, "getItem")
      .mockImplementation(() => {
        throw new Error("blocked")
      })
    expect(consentPending()).toBe(true)
    getItem.mockRestore()
  })
})

describe("the Checkpoint", () => {
  it("pins one artifact at one revision, and its true size", () => {
    expect(CHECKPOINT.repo).toBe("onnx-community/ModernBERT-base-nli-ONNX")
    // What `dtype: "q4f16"` resolves to — the pin and the runtime name the same
    // file, which is what makes the disclosure checkable against the fetch.
    expect(CHECKPOINT.path).toBe("onnx/model_q4f16.onnx")
    // A commit, not a branch: what was consented to is what downloads.
    expect(CHECKPOINT.revision).toMatch(/^[0-9a-f]{40}$/)
    // The pivot the latency spike fired (#53), not Laya proper's ~850 MB.
    expect(CHECKPOINT.bytes).toBe(140_209_867)
  })

  it("names the model in copy the cabinet's font can draw", () => {
    expect(glyphSafe(CHECKPOINT.name)).toBe(true)
  })
})
