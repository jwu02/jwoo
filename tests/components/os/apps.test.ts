import { APPS } from "@/components/os/apps"

describe("applications", () => {
  // The Dock is the only surface that reads APPS, so a route can never be
  // selectable without being named.
  it("lists each route exactly once", () => {
    const hrefs = APPS.map((app) => app.href)
    expect(new Set(hrefs).size).toBe(hrefs.length)
  })
})
