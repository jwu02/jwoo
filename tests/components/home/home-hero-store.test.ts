import {
  getHeroMode,
  setHeroMode,
  subscribeHeroMode,
} from "@/components/home/home-hero-store"

describe("homeHeroStore", () => {
  afterEach(() => setHeroMode("intro"))

  it("starts in intro mode", () => {
    expect(getHeroMode()).toBe("intro")
  })

  it("transitions intro -> macbook -> intro", () => {
    setHeroMode("macbook")
    expect(getHeroMode()).toBe("macbook")
    setHeroMode("intro")
    expect(getHeroMode()).toBe("intro")
  })

  it("notifies subscribers on change and stops notifying after unsubscribe", () => {
    const listener = jest.fn()
    const unsubscribe = subscribeHeroMode(listener)

    setHeroMode("macbook")
    expect(listener).toHaveBeenCalledTimes(1)

    unsubscribe()
    setHeroMode("intro")
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it("does not notify when set to the current mode", () => {
    const listener = jest.fn()
    subscribeHeroMode(listener)

    setHeroMode("intro")
    expect(listener).not.toHaveBeenCalled()
  })
})
