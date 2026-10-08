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
      "/terminal",
    ])
  })

  // The Terminal is an application the Dock both links and names: its label
  // comes from the same one list as its route.
  it("names the Terminal application", () => {
    expect(APPS).toContainEqual(
      expect.objectContaining({ href: "/terminal", label: "Terminal" }),
    )
  })
})
