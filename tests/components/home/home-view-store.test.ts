import {
  getActiveView,
  setActiveView,
  subscribeActiveView,
} from "@/components/home/home-view-store"

describe("homeViewStore", () => {
  afterEach(() => setActiveView(null))

  it("starts with no active view — the load view is the MacBook framing, not a switcher button", () => {
    expect(getActiveView()).toBeNull()
  })

  it("tracks the last selected view and clears back to null", () => {
    setActiveView("desk")
    expect(getActiveView()).toBe("desk")
    setActiveView("car")
    expect(getActiveView()).toBe("car")
    setActiveView(null)
    expect(getActiveView()).toBeNull()
  })

  it("notifies subscribers on change and stops notifying after unsubscribe", () => {
    const listener = jest.fn()
    const unsubscribe = subscribeActiveView(listener)

    setActiveView("desk")
    expect(listener).toHaveBeenCalledTimes(1)

    unsubscribe()
    setActiveView("car")
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it("does not notify when set to the current view", () => {
    const listener = jest.fn()
    subscribeActiveView(listener)

    setActiveView("desk")
    expect(listener).toHaveBeenCalledTimes(1)
    setActiveView("desk")
    expect(listener).toHaveBeenCalledTimes(1)
  })
})
