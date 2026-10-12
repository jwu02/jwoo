import { act, fireEvent, render, screen, within } from "@testing-library/react"

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

beforeEach(() => {
  window.localStorage.clear()
  document.documentElement.classList.remove("dark")
})

describe("Settings page", () => {
  it("renders one scrolling column with no category navigation", () => {
    render(<SettingsPage />)

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
    render(<SettingsPage />)

    const home = screen.getByText("Home").closest("li")!
    expect(home.querySelector("span.size-6")).toBeInTheDocument()
  })

  it("shows the Dock's current arrangement", () => {
    saveDockOrder(orderOf("/", "/resume", "/terminal", "/settings"))

    render(<SettingsPage />)

    expect(arrangementLabels()).toEqual([
      "Home",
      "Resume",
      "Terminal",
      "Settings",
    ])
  })

  it("puts the declared order back when reset is clicked", () => {
    saveDockOrder(orderOf("/", "/resume", "/terminal", "/settings"))

    render(<SettingsPage />)
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
    render(<SettingsPage />)

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

    render(<SettingsPage />)

    expect(screen.getByRole("button", { name: "Dark" })).toHaveAttribute(
      "aria-pressed",
      "true",
    )
  })
})

describe("Data", () => {
  it("lists every stored entry by its plain name, its key and a measured size", () => {
    window.localStorage.setItem(APPEARANCE_KEY, "dark") // 4 bytes
    saveDockOrder(orderOf("/")) // a real arrangement, so its key exists
    window.localStorage.setItem(RESUME_LOCALE_KEY, "zh") // 2 bytes
    window.localStorage.setItem(
      HISTORY_KEY,
      JSON.stringify(["/help", "/resume"]),
    ) // 19 bytes

    render(<SettingsPage />)

    const list = screen.getByRole("list", { name: "Stored data" })
    expect(within(list).getAllByRole("listitem")).toHaveLength(4)

    expect(dataRow("Appearance")).toHaveTextContent("os.appearance")
    expect(dataRow("Appearance")).toHaveTextContent("4 B")
    expect(dataRow("Dock arrangement")).toHaveTextContent("dock.order")
    expect(dataRow("Resume language")).toHaveTextContent("resume:locale")
    expect(dataRow("Resume language")).toHaveTextContent("2 B")
    expect(dataRow("Terminal history")).toHaveTextContent("terminal.history")
    expect(dataRow("Terminal history")).toHaveTextContent("19 B")
  })

  it("deletes exactly the entry its button names", () => {
    window.localStorage.setItem(APPEARANCE_KEY, "dark")
    window.localStorage.setItem(RESUME_LOCALE_KEY, "zh")
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(["/help"]))
    saveDockOrder(orderOf("/", "/resume"))

    render(<SettingsPage />)
    fireEvent.click(
      screen.getByRole("button", { name: "Delete Resume language" }),
    )

    expect(window.localStorage.getItem(RESUME_LOCALE_KEY)).toBeNull()
    expect(window.localStorage.getItem(APPEARANCE_KEY)).toBe("dark")
    expect(window.localStorage.getItem(HISTORY_KEY)).toBe(
      JSON.stringify(["/help"]),
    )
    expect(window.localStorage.getItem("dock.order")).toBe(
      JSON.stringify(["/", "/resume"]),
    )
  })

  it("puts the Dock back when its entry is deleted", () => {
    saveDockOrder(orderOf("/", "/resume", "/terminal"))

    render(<SettingsPage />)
    fireEvent.click(
      screen.getByRole("button", { name: "Delete Dock arrangement" }),
    )

    expect(window.localStorage.getItem("dock.order")).toBeNull()
    expect(arrangementLabels()).toEqual(APPS.map((app) => app.label))
  })

  // Deleting the appearance flips the page on the spot: the clearest proof
  // that what the Data section lists is real.
  it("changes the page's appearance the moment the appearance entry is deleted", () => {
    saveAppearance("dark")

    render(<SettingsPage />)
    expect(document.documentElement).toHaveClass("dark")

    fireEvent.click(screen.getByRole("button", { name: "Delete Appearance" }))

    expect(document.documentElement).not.toHaveClass("dark")
  })

  // Only one application is mounted, so a delete here and a fresh read by the
  // application's own store are the whole of "honoured when it next opens".
  it("clears an unmounted application's entry for its next open", () => {
    saveLocale("zh")
    saveHistory(["/help"])

    render(<SettingsPage />)
    fireEvent.click(
      screen.getByRole("button", { name: "Delete Resume language" }),
    )
    fireEvent.click(
      screen.getByRole("button", { name: "Delete Terminal history" }),
    )

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

      render(<SettingsPage />)
      fireEvent.click(
        screen.getByRole("button", { name: "Delete Terminal history" }),
      )

      expect(loadHistory()).toEqual([])
    } finally {
      storage.mockRestore()
    }
  })

  it("offers no export control and no usage bar", () => {
    render(<SettingsPage />)

    expect(
      screen.queryByRole("button", { name: /export/i }),
    ).not.toBeInTheDocument()
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument()
  })
})

describe("Delete everything", () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it("does nothing on the first press and deletes on the second", () => {
    window.localStorage.setItem(APPEARANCE_KEY, "dark")
    window.localStorage.setItem(RESUME_LOCALE_KEY, "zh")

    render(<SettingsPage />)
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

    render(<SettingsPage />)
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

    render(<SettingsPage />)

    const note = await screen.findByText(/Most of it is caches/)
    // Rounded down, so the number never claims more than is stored, and a
    // single number: the origin's allowance is not a second one.
    expect(note).toHaveTextContent("1.9 KB used for this site")
    expect(note).not.toHaveTextContent("1 GB")
    expect(screen.getAllByText(/Most of it is caches/)).toHaveLength(1)
  })
})
