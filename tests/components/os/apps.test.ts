import { APPS } from "@/components/os/apps"

describe("applications", () => {
  // The Dock is the only surface that reads APPS, so a route can never be
  // selectable without being named.
  it("lists each route exactly once", () => {
    const hrefs = APPS.map((app) => app.href)
    expect(new Set(hrefs).size).toBe(hrefs.length)
  })

  // An application's place in the rail is its place on the desktop: the
  // visitor's own ordering, and not a thing to drift as routes are added.
  it("keeps the applications in their settled order", () => {
    expect(APPS.map((app) => app.href)).toEqual([
      "/",
      "/activity-telemetry",
      "/ai-usage",
      "/knowledge-graph",
      "/resume",
      "/tetris",
    ])
  })
})
