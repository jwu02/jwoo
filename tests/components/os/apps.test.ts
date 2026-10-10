import { APPS, appTitle } from "@/components/os/apps"

describe("applications", () => {
  // Both views of the list — the Dock and the Titlebar — look an application up
  // by its href, so a route listed twice would leave that lookup ambiguous.
  it("lists each route exactly once", () => {
    const hrefs = APPS.map((app) => app.href)
    expect(new Set(hrefs).size).toBe(hrefs.length)
  })

  // An application's place in the rail is its place on the desktop: the
  // visitor's own ordering, and not a thing to drift as routes are added.
  it("keeps the applications in their settled order", () => {
    expect(APPS.map((app) => app.href)).toEqual([
      "/",
      "/terminal",
      "/activity-telemetry",
      "/ai-usage",
      "/knowledge-graph",
      "/resume",
      // "/tetris",
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

describe("window titles", () => {
  // A window is named by the same list the Dock reads, so a route can never be
  // navigable and unnamed — which is what makes the titlebar a second view of
  // the one registry rather than a second registry.
  it("names a registered route with its Dock label", () => {
    expect(appTitle("/resume")).toBe("Resume")
    expect(appTitle("/activity-telemetry")).toBe("Activity Telemetry")
  })

  // Tetris is kept off the Dock until its autopilot ships, so it has no entry
  // to read — its window is still named, from the route itself.
  it("titles a route the Dock does not list, from its slug", () => {
    expect(appTitle("/tetris")).toBe("Tetris")
  })

  // A route can be more than one word, and the fallback reads the slug the way
  // a reader would rather than as one word.
  it("titles a multi-word slug", () => {
    expect(appTitle("/some-new-app")).toBe("Some New App")
  })
})
