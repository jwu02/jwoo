import { APPS, activeApp } from "@/components/os/apps"

describe("applications", () => {
  // The Dock and the Top Bar are two views of APPS, so a route can never be
  // selectable without also being nameable.
  it("lists each route exactly once", () => {
    const hrefs = APPS.map((app) => app.href)
    expect(new Set(hrefs).size).toBe(hrefs.length)
  })

  it("names the person, not the place, at Home", () => {
    expect(activeApp("/").title).toBe("Tony Wu")
  })

  it("names the active application by its route", () => {
    expect(activeApp("/knowledge-graph").title).toBe("Knowledge Graph")
    expect(activeApp("/resume").title).toBe("Resume")
  })

  it("names an unknown route rather than throwing on it", () => {
    expect(activeApp("/no-such-page").title).toBe("Not Found")
  })
})
