import {
  CONSENT_KEY,
  consentPending,
  webgpuAvailable,
} from "@/lib/tetris/kevala"

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
