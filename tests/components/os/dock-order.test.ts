import { APPS, HOME } from "@/components/os/apps"
import {
  dockOrderServerSnapshot,
  dockOrderSnapshot,
  saveDockOrder,
} from "@/components/os/dock-order"

const KEY = "dock.order"

/** The order the Dock would render right now, as hrefs. */
function hrefs(): string[] {
  return dockOrderSnapshot().map((app) => app.href)
}

/** An order built from hrefs, the way the Dock hands one to the store. */
function orderOf(...wanted: string[]) {
  return wanted.map((href) => APPS.find((app) => app.href === href)!)
}

const DEFAULT = APPS.map((app) => app.href)

describe("the Dock's order", () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it("is the declared order before any visit saves one", () => {
    expect(hrefs()).toEqual(DEFAULT)
  })

  it("reads back the order a visit saved", () => {
    saveDockOrder(
      orderOf(
        HOME,
        "/resume",
        "/terminal",
        "/knowledge-graph",
        "/ai-usage",
        "/activity-telemetry",
      ),
    )

    expect(hrefs()).toEqual([
      HOME,
      "/resume",
      "/terminal",
      "/knowledge-graph",
      "/ai-usage",
      "/activity-telemetry",
    ])
  })

  // The Desktop is Pinned: whatever a stored order says, its place is first.
  it("keeps the Desktop first when a stored order puts it elsewhere", () => {
    window.localStorage.setItem(
      KEY,
      JSON.stringify(["/resume", HOME, "/terminal"]),
    )

    expect(hrefs()).toEqual([
      HOME,
      "/resume",
      "/terminal",
      // Never mentioned, so declared order — and one entry each.
      "/activity-telemetry",
      "/ai-usage",
      "/knowledge-graph",
    ])
  })

  // An order outlives the app list it was written against: an application can
  // be retired between visits, or ship after one. Neither may strand the Dock.
  it("drops a retired application and appends one the order never mentioned", () => {
    window.localStorage.setItem(
      KEY,
      JSON.stringify(["/terminal", "/tetris", "/terminal", 7, "/resume"]),
    )

    expect(hrefs()).toEqual([
      HOME,
      "/terminal",
      "/resume",
      "/activity-telemetry",
      "/ai-usage",
      "/knowledge-graph",
    ])
  })

  it("is the declared order when the stored value is unreadable", () => {
    for (const unreadable of ["not json at all", "{}", "null", '"resume"']) {
      window.localStorage.setItem(KEY, unreadable)
      expect(hrefs()).toEqual(DEFAULT)
    }
  })

  // A private-mode browser has storage that throws rather than stores; the
  // order still stands for the length of the visit.
  it("remembers the order for this visit when storage refuses", () => {
    const failing = { getItem: jest.fn(), setItem: jest.fn() }
    failing.getItem.mockImplementation(() => {
      throw new Error("storage disabled")
    })
    failing.setItem.mockImplementation(() => {
      throw new Error("storage disabled")
    })
    const storage = jest
      .spyOn(window, "localStorage", "get")
      .mockReturnValue(failing as unknown as Storage)

    try {
      saveDockOrder(orderOf(HOME, "/resume", "/terminal"))
      expect(hrefs()).toEqual([HOME, "/resume", "/terminal"])
    } finally {
      storage.mockRestore()
    }
  })

  // A store that reads but refuses to write — a full quota — would otherwise
  // hand the next snapshot the nothing it has stored, losing the visit's own
  // order behind the visitor's back.
  it("remembers the order when storage refuses to write", () => {
    const failing = {
      getItem: jest.fn(() => null),
      setItem: jest.fn(() => {
        throw new Error("quota exceeded")
      }),
    }
    const storage = jest
      .spyOn(window, "localStorage", "get")
      .mockReturnValue(failing as unknown as Storage)

    try {
      saveDockOrder(orderOf(HOME, "/resume", "/terminal"))
      expect(hrefs()).toEqual([HOME, "/resume", "/terminal"])
    } finally {
      storage.mockRestore()
    }
  })

  // The server has no storage to read, so it renders the declared order and
  // hydration settles any difference.
  it("serves the declared order to the server", () => {
    window.localStorage.setItem(KEY, JSON.stringify(["/resume", HOME]))

    expect(dockOrderServerSnapshot()).toEqual(APPS)
  })
})
