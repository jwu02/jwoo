import { act, fireEvent, render, screen, within } from "@testing-library/react"

import manifest from "@/package.json"
import SettingsPage from "@/app/settings/page"
import { APPS } from "@/components/os/apps"
import { APPEARANCE_KEY, saveAppearance } from "@/components/os/appearance"
import { saveDockOrder } from "@/components/os/dock-order"
import {
  RESUME_LOCALE_KEY,
  localeSnapshot,
  saveLocale,
} from "@/components/resume/locale-store"
import { loadHistory, saveHistory } from "@/components/terminal/history-store"
import { TooltipProvider } from "@/components/ui/tooltip"

/** The Terminal's own key, which its store keeps to itself. */
const HISTORY_KEY = "terminal.history"

/** An order built from hrefs, the way the Dock hands one to the store. */
function orderOf(...wanted: string[]) {
  return wanted.map((href) => APPS.find((app) => app.href === href)!)
}

/** The labels of the current-arrangement list, in order. */
function arrangementLabels(): string[] {
  const list = screen.getByRole("list", { name: "Current Dock arrangement" })
  return within(list)
    .getAllByRole("listitem")
    .map((item) => item.textContent ?? "")
}

/** The Data section's row for one entry, found by its plain-words label. */
function dataRow(label: string): HTMLElement {
  const list = screen.getByRole("list", { name: "Stored data" })
  const row = within(list).getByText(label).closest("li")
  if (!row) throw new Error(`no Data row for ${label}`)
  return row
}

/** The app mounts TooltipProvider in app/layout.tsx; the Data legend's sizes
 * are tooltips and need one, opened without the app's own hover delay. */
function renderSettings() {
  return render(
    <TooltipProvider>
      <SettingsPage />
    </TooltipProvider>,
  )
}

/** Press the Data section's one destructive control twice, the way a visitor
 * has to: the first press arms it, the second deletes. */
function deleteEverything() {
  fireEvent.click(screen.getByRole("button", { name: "Delete everything" }))
  fireEvent.click(
    screen.getByRole("button", { name: "Press again to delete everything" }),
  )
}

/** The value the System section shows for one fact, found by its label. */
function systemFact(label: string): string {
  const list = screen.getByRole("list", { name: "System facts" })
  const row = within(list).getByText(label).closest("li")
  if (!row) throw new Error(`no System row for ${label}`)
  return row.lastElementChild?.textContent ?? ""
}

/** Put one property on `window` or `navigator`, which jsdom will not otherwise
 * let a test change. */
function setProp(target: object, prop: string, value: unknown) {
  Object.defineProperty(target, prop, { configurable: true, value })
}

beforeEach(() => {
  window.localStorage.clear()
  document.documentElement.classList.remove("dark")
})

describe("Settings page", () => {
  it("renders one scrolling column with no category navigation", () => {
    renderSettings()

    expect(
      screen.getByRole("heading", { level: 2, name: "Desktop & Dock" }),
    ).toBeInTheDocument()

    // No inner navigation: the Dock is the site's only navigation.
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument()
  })

  // The Desktop's portrait fills whatever box it is given rather than taking a
  // size class, so the row's glyph must sit in a fixed-size box or the image
  // resolves to the width of the window.
  it("gives each application's glyph a fixed-size box", () => {
    renderSettings()

    const home = screen.getByText("Home").closest("li")!
    expect(home.querySelector("span.size-6")).toBeInTheDocument()
  })

  it("shows the Dock's current arrangement", () => {
    saveDockOrder(orderOf("/", "/resume", "/terminal", "/settings"))

    renderSettings()

    expect(arrangementLabels()).toEqual([
      "Home",
      "Resume",
      "Terminal",
      "Settings",
    ])
  })

  it("puts the declared order back when reset is clicked", () => {
    saveDockOrder(orderOf("/", "/resume", "/terminal", "/settings"))

    renderSettings()
    expect(arrangementLabels()).not.toEqual(APPS.map((app) => app.label))

    fireEvent.click(
      screen.getByRole("button", { name: "Reset Dock arrangement" }),
    )

    expect(arrangementLabels()).toEqual(APPS.map((app) => app.label))
    expect(window.localStorage.getItem("dock.order")).toBe(
      JSON.stringify(APPS.map((app) => app.href)),
    )
  })
})

describe("Appearance", () => {
  // The visitor's own system reports nothing under jsdom, so a fresh visit is
  // light and the control has to say so before they ever choose.
  it("shows the appearance in effect, then applies and remembers a choice", () => {
    renderSettings()

    const light = screen.getByRole("button", { name: "Light" })
    const dark = screen.getByRole("button", { name: "Dark" })
    expect(light).toHaveAttribute("aria-pressed", "true")
    expect(dark).toHaveAttribute("aria-pressed", "false")

    fireEvent.click(dark)

    expect(dark).toHaveAttribute("aria-pressed", "true")
    expect(light).toHaveAttribute("aria-pressed", "false")
    expect(window.localStorage.getItem(APPEARANCE_KEY)).toBe("dark")
    expect(document.documentElement.classList.contains("dark")).toBe(true)
  })

  it("starts from the appearance a previous visit chose", () => {
    window.localStorage.setItem(APPEARANCE_KEY, "dark")

    renderSettings()

    expect(screen.getByRole("button", { name: "Dark" })).toHaveAttribute(
      "aria-pressed",
      "true",
    )
  })
})

describe("Data", () => {
  it("lists every stored entry by its plain name, and not by its key", () => {
    window.localStorage.setItem(APPEARANCE_KEY, "dark") // 4 bytes
    saveDockOrder(orderOf("/")) // a real arrangement, so its key exists
    window.localStorage.setItem(RESUME_LOCALE_KEY, "zh") // 2 bytes
    window.localStorage.setItem(
      HISTORY_KEY,
      JSON.stringify(["/help", "/resume"]),
    ) // 19 bytes

    renderSettings()

    const list = screen.getByRole("list", { name: "Stored data" })
    expect(within(list).getAllByRole("listitem")).toHaveLength(4)

    for (const label of [
      "Appearance",
      "Dock arrangement",
      "Resume language",
      "Terminal history",
    ]) {
      expect(dataRow(label)).toBeInTheDocument()
    }

    // The key is not what a visitor is reading for: what each entry is, in
    // plain words, and what it weighs once asked, is the whole of the legend.
    expect(list).not.toHaveTextContent(
      /os\.appearance|dock\.order|resume:locale|terminal\.history/,
    )
  })

  it("states the total the bar is a whole of, and proportions each segment to it", () => {
    window.localStorage.setItem(APPEARANCE_KEY, "dark") // 4 bytes
    saveDockOrder(orderOf("/")) // 5 bytes
    window.localStorage.setItem(RESUME_LOCALE_KEY, "zh") // 2 bytes
    window.localStorage.setItem(
      HISTORY_KEY,
      JSON.stringify(["/help", "/resume"]),
    ) // 19 bytes

    const { container } = renderSettings()

    const widthOf = (key: string) =>
      Number.parseFloat(
        (
          container.querySelector(
            `[data-stored-segment="${key}"]`,
          ) as HTMLElement
        ).style.width,
      )

    // 4 + 5 + 2 + 19: the whole is the entries' own sum, not the browser's
    // quota, so no free region is drawn against it.
    expect(screen.getByText("30 B kept by this site.")).toBeInTheDocument()
    expect(widthOf(HISTORY_KEY)).toBeCloseTo((19 / 30) * 100)
    expect(widthOf(APPEARANCE_KEY)).toBeCloseTo((4 / 30) * 100)
    // Proportioned by what was measured, so the widest segment is the biggest.
    expect(widthOf(HISTORY_KEY)).toBeGreaterThan(widthOf(APPEARANCE_KEY))
  })

  // The size is written nowhere on the page, so both the legend's chip and the
  // bar's own segment have to be able to say it.
  it("says what an entry weighs on hovering its legend chip", async () => {
    window.localStorage.setItem(APPEARANCE_KEY, "dark") // 4 bytes

    renderSettings()

    fireEvent.mouseEnter(screen.getByRole("button", { name: "Appearance" }))

    expect(
      await screen.findByText("Appearance takes up 4 B"),
    ).toBeInTheDocument()
  })

  it("says what an entry weighs on hovering its segment", async () => {
    window.localStorage.setItem(APPEARANCE_KEY, "dark") // 4 bytes

    const { container } = renderSettings()

    fireEvent.mouseEnter(
      container.querySelector('[data-stored-segment="os.appearance"]')!,
    )

    expect(
      await screen.findByText("Appearance takes up 4 B"),
    ).toBeInTheDocument()
  })

  // Hover is unreachable by keyboard, so the chip is a real focusable control
  // and says the same thing when it is focused.
  it("says what an entry weighs on focusing its legend chip", async () => {
    window.localStorage.setItem(APPEARANCE_KEY, "dark") // 4 bytes

    renderSettings()

    fireEvent.focus(screen.getByRole("button", { name: "Appearance" }))

    expect(
      await screen.findByText("Appearance takes up 4 B"),
    ).toBeInTheDocument()
  })

  // The bar repeats what the legend already names, so a screen reader is not
  // made to read the same four entries twice.
  it("draws the bar as decoration, with every name in the legend", () => {
    window.localStorage.setItem(APPEARANCE_KEY, "dark")

    renderSettings()

    const list = screen.getByRole("list", { name: "Stored data" })
    expect(list).toBeInTheDocument()
    expect(dataRow("Appearance")).toBeInTheDocument()

    expect(
      document.querySelector("[data-stored-bar]"),
    ).toHaveAttribute("aria-hidden", "true")
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: /export/i }),
    ).not.toBeInTheDocument()
  })

  it("draws no segment for an entry weighing nothing, and keeps its row", async () => {
    window.localStorage.setItem(RESUME_LOCALE_KEY, "zh")

    renderSettings()

    expect(
      document.querySelector('[data-stored-segment="resume:locale"]'),
    ).toBeInTheDocument()
    // A sliver would be the bar claiming bytes that are not stored.
    expect(
      document.querySelector('[data-stored-segment="terminal.history"]'),
    ).not.toBeInTheDocument()
    // Its row stays, saying what it weighs — nothing.
    fireEvent.mouseEnter(
      screen.getByRole("button", { name: "Terminal history" }),
    )
    expect(
      await screen.findByText("Terminal history takes up 0 B"),
    ).toBeInTheDocument()
  })

  it("keeps the empty frame and every row when the site stores nothing", () => {
    renderSettings()

    expect(screen.getByText("0 B kept by this site.")).toBeInTheDocument()
    expect(document.querySelector("[data-stored-bar]")).toBeInTheDocument()
    expect(document.querySelectorAll("[data-stored-segment]")).toHaveLength(0)
    expect(
      within(screen.getByRole("list", { name: "Stored data" })).getAllByRole(
        "listitem",
      ),
    ).toHaveLength(4)
  })

  it("offers one delete for the section, and none per entry", () => {
    window.localStorage.setItem(APPEARANCE_KEY, "dark")

    renderSettings()

    const deletes = screen
      .getAllByRole("button")
      .filter((button) => /delete|clear/i.test(button.textContent ?? ""))
    expect(deletes).toHaveLength(1)
    expect(deletes[0]).toHaveTextContent("Delete everything")
  })

  it("puts the Dock back when the entries are deleted", () => {
    saveDockOrder(orderOf("/", "/resume", "/terminal"))

    renderSettings()
    deleteEverything()

    expect(window.localStorage.getItem("dock.order")).toBeNull()
    expect(arrangementLabels()).toEqual(APPS.map((app) => app.label))
  })

  // Deleting the appearance flips the page on the spot: the clearest proof
  // that what the Data section lists is real.
  it("changes the page's appearance the moment the entries are deleted", () => {
    saveAppearance("dark")

    renderSettings()
    expect(document.documentElement).toHaveClass("dark")

    deleteEverything()

    expect(document.documentElement).not.toHaveClass("dark")
  })

  // Only one application is mounted, so a delete here and a fresh read by the
  // application's own store are the whole of "honoured when it next opens".
  it("clears an unmounted application's entry for its next open", () => {
    saveLocale("zh")
    saveHistory(["/help"])

    renderSettings()
    deleteEverything()

    expect(localeSnapshot()).toBe("en")
    expect(loadHistory()).toEqual([])
  })

  // A private-mode browser holds History only in the store's memory, so the
  // delete has to empty that too or the next open would hand it back.
  it("empties an entry's in-memory fallback where storage refuses", () => {
    const failing = {
      getItem: jest.fn(),
      setItem: jest.fn(),
      removeItem: jest.fn(),
    }
    failing.getItem.mockImplementation(() => {
      throw new Error("storage disabled")
    })
    failing.setItem.mockImplementation(() => {
      throw new Error("storage disabled")
    })
    failing.removeItem.mockImplementation(() => {
      throw new Error("storage disabled")
    })
    const storage = jest
      .spyOn(window, "localStorage", "get")
      .mockReturnValue(failing as unknown as Storage)

    try {
      saveHistory(["/help"])
      expect(loadHistory()).toEqual(["/help"])

      renderSettings()
      deleteEverything()

      expect(loadHistory()).toEqual([])
    } finally {
      storage.mockRestore()
    }
  })

})

describe("Delete everything", () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it("deletes nothing on the first press, and everything on the second", () => {
    window.localStorage.setItem(APPEARANCE_KEY, "dark")
    window.localStorage.setItem(RESUME_LOCALE_KEY, "zh")

    renderSettings()
    const button = screen.getByRole("button", { name: "Delete everything" })

    fireEvent.click(button)
    expect(window.localStorage.getItem(APPEARANCE_KEY)).toBe("dark")
    expect(window.localStorage.getItem(RESUME_LOCALE_KEY)).toBe("zh")
    // The armed state is said aloud, not only shown.
    expect(screen.getByRole("status")).toHaveTextContent(
      "Press again within five seconds to delete everything.",
    )

    fireEvent.click(button)
    expect(window.localStorage.getItem(APPEARANCE_KEY)).toBeNull()
    expect(window.localStorage.getItem(RESUME_LOCALE_KEY)).toBeNull()
  })

  it("reverts if no second press follows", () => {
    window.localStorage.setItem(APPEARANCE_KEY, "dark")

    renderSettings()
    const button = screen.getByRole("button", { name: "Delete everything" })

    fireEvent.click(button)
    act(() => {
      jest.advanceTimersByTime(5000)
    })

    // Reverted, so this press only arms the button rather than deleting.
    fireEvent.click(button)
    expect(window.localStorage.getItem(APPEARANCE_KEY)).toBe("dark")
  })
})

describe("the browser's storage estimate", () => {
  afterEach(() => {
    Reflect.deleteProperty(window.navigator, "storage")
  })

  it("shows the origin estimate once, as mostly caches", async () => {
    Object.defineProperty(window.navigator, "storage", {
      configurable: true,
      value: {
        estimate: jest.fn().mockResolvedValue({
          usage: 2047,
          quota: 1024 * 1024 * 1024,
        }),
      },
    })

    renderSettings()

    const note = await screen.findByText(/Most of it is caches/)
    // Rounded down, so the number never claims more than is stored, and a
    // single number: the origin's allowance is not a second one.
    expect(note).toHaveTextContent("1.9 KB used for this site")
    expect(note).not.toHaveTextContent("1 GB")
    expect(screen.getAllByText(/Most of it is caches/)).toHaveLength(1)
  })
})

describe("System", () => {
  const originalLanguages = navigator.languages
  const originalLanguage = navigator.language

  afterEach(() => {
    setProp(window.navigator, "languages", originalLanguages)
    setProp(window.navigator, "language", originalLanguage)
  })

  it("reports what the browser answers, with the site's version", () => {
    setProp(window.navigator, "languages", ["en-GB", "fr"])

    renderSettings()

    expect(systemFact("Languages")).toBe("en-GB, fr")
    expect(systemFact("Time zone")).toBe(
      Intl.DateTimeFormat().resolvedOptions().timeZone,
    )
    expect(systemFact("Site version")).toBe(manifest.version)
  })

  // A browser that answers nothing is left out, never printed as a placeholder.
  it("leaves out a fact the browser does not report", () => {
    setProp(window.navigator, "languages", undefined)
    setProp(window.navigator, "language", "")

    renderSettings()

    expect(screen.queryByText("Languages")).not.toBeInTheDocument()
    expect(screen.queryByText(/unknown/i)).not.toBeInTheDocument()
    expect(systemFact("Site version")).toBe(manifest.version)
  })

  it("discloses the measurement the site loads in one line", () => {
    renderSettings()

    expect(
      screen.getByText(/cookieless page-view and performance collection/i),
    ).toBeInTheDocument()
  })
})
