import { fireEvent, render, screen, within } from "@testing-library/react"

import TerminalPage from "@/app/terminal/page"
import { COMMANDS } from "@/components/terminal/commands"
import { PORTRAIT } from "@/components/terminal/portrait"

// The integration seam: the real registry, the Print renderer and the Input bar
// together in jsdom, driven the way a visitor drives them — keys and clicks.
// The machine's own rules are chartered in tests/components/terminal; what is
// left here is what the visitor sees on the page.
const CONTACT_ENV_VARS = [
  "NEXT_PUBLIC_EMAIL",
  "NEXT_PUBLIC_PHONE",
  "NEXT_PUBLIC_GITHUB",
  "NEXT_PUBLIC_WECHAT",
] as const

const original: Record<string, string | undefined> = {}

function bar(): HTMLInputElement {
  return screen.getByRole("combobox", { name: "Terminal input" })
}

/** Type into the field the way a keystroke does: one value change. */
function type(value: string) {
  fireEvent.change(bar(), { target: { value } })
}

function press(key: string) {
  fireEvent.keyDown(bar(), { key })
}

/** The Popup row the bar says is lit — `aria-activedescendant` points at it. */
function litOption(): HTMLElement {
  return screen.getByRole("option", { selected: true })
}

/** Run a Command the way the bar does: type it, and Enter runs the lit match
 * outright. */
function run(value: string) {
  type(value)
  press("Enter")
}

/** Every Echo on the screen, in the order printed: the invocation lines, which
 * are the only slash-words outside a row's own label. */
function echoes(): string[] {
  return within(screen.getByRole("log"))
    .queryAllByText(/^\//)
    .filter((node) => node.tagName !== "DT")
    .map((node) => node.textContent ?? "")
}

/** The Portraits on the screen: each Print's picture of the owner, drawn in the
 * output beside the rows that belong to it. */
function portraits(): HTMLElement[] {
  return screen.queryAllByRole("img")
}

beforeEach(() => {
  window.localStorage.clear()
  for (const name of CONTACT_ENV_VARS) {
    original[name] = process.env[name]
    delete process.env[name]
  }
})

afterEach(() => {
  for (const name of CONTACT_ENV_VARS) {
    if (original[name] === undefined) delete process.env[name]
    else process.env[name] = original[name]
  }
  jest.restoreAllMocks()
  // A selection outlives a render, so it must not outlive a test.
  window.getSelection()?.removeAllRanges()
})

describe("the opening print", () => {
  it("is the registry's /neofetch, then the registry's /socials", () => {
    process.env.NEXT_PUBLIC_GITHUB = "github.com/jwu02"

    render(<TerminalPage />)

    const whoami = screen.getByText("/neofetch")
    const socials = screen.getByText("/socials")
    // A transcript, not a set: identity first, contacts under it.
    expect(whoami.compareDocumentPosition(socials)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    )

    // The Profile's own rows, not the skeleton's fixture copy of them.
    expect(screen.getByText("Tony Wu")).toBeInTheDocument()
    expect(screen.getByText("Professional Vibecoder")).toBeInTheDocument()
    expect(screen.getByText("Guangdong, China")).toBeInTheDocument()
    // The contacts the deployment configures, read through the registry.
    expect(screen.getByText("github.com/jwu02")).toBeInTheDocument()
  })

  // The picture is drawn beside the rows, not stacked above them: a portrait
  // and its caption are one Print, laid out side by side.
  it("draws /neofetch's Portrait as the grid the registry carries, beside its rows", () => {
    render(<TerminalPage />)

    const portrait = screen.getByRole("img")
    // A picture, and announced as one — the rows say everything it holds.
    expect(portrait).toHaveAccessibleName(/portrait/i)
    // Verbatim, not merely similar: the grid is drawn where the spaces are.
    expect(portrait.textContent).toBe(PORTRAIT)
    // One block: the rows share the Portrait's own box, and follow it in the
    // document, which is the order a flex row lays them out in.
    const rows = screen.getByText("Tony Wu")
    expect(portrait.parentElement).toContainElement(rows)
    expect(
      portrait.compareDocumentPosition(rows) & Node.DOCUMENT_POSITION_FOLLOWING
    ).not.toBe(0)
  })
})

describe("the Popup", () => {
  it("opens on the slash, listing each Command with its description", () => {
    render(<TerminalPage />)
    type("/")

    expect(
      screen.getByRole("listbox", { name: "Commands" })
    ).toBeInTheDocument()
    for (const command of COMMANDS) {
      expect(
        screen.getByRole("option", { name: new RegExp(command.name) })
      ).toBeInTheDocument()
      expect(screen.getByText(command.description)).toBeInTheDocument()
    }
    expect(bar()).toHaveAttribute("aria-expanded", "true")
    expect(bar()).toHaveAttribute("aria-activedescendant", litOption().id)
  })

  it("narrows by prefix as the query grows, keeping the highlight in the list", () => {
    render(<TerminalPage />)
    type("/so")

    expect(screen.getAllByRole("option")).toHaveLength(1)
    expect(
      screen.getByRole("option", { name: /\/socials/ })
    ).toBeInTheDocument()
    expect(bar()).toHaveAttribute("aria-activedescendant", litOption().id)
  })

  it("is a combobox of options: closed until the slash, and pointed at the lit row", () => {
    render(<TerminalPage />)
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument()
    expect(bar()).toHaveAttribute("aria-expanded", "false")
    expect(bar()).toHaveAttribute("aria-autocomplete", "list")
    expect(bar()).not.toHaveAttribute("aria-activedescendant")

    type("/")
    press("ArrowDown")
    expect(screen.getByRole("option", { name: /\/contacts/ })).toHaveAttribute(
      "aria-selected",
      "true"
    )
    // The combobox tracks the lit row, rather than merely naming some row.
    expect(bar()).toHaveAttribute("aria-activedescendant", litOption().id)
  })

  it("accepts the highlight with Tab, and never runs it", () => {
    render(<TerminalPage />)
    type("/neo")
    press("Tab")

    expect(bar()).toHaveValue("/neofetch")
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument()
    // Accepted, not run: the screen still holds only the opening print.
    expect(echoes()).toEqual(["/neofetch", "/socials"])
  })

  it("accepts a row that is clicked, and leaves it unrun", () => {
    render(<TerminalPage />)
    type("/")

    fireEvent.click(screen.getByRole("option", { name: /\/socials/ }))

    expect(bar()).toHaveValue("/socials")
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument()
    expect(echoes()).toEqual(["/neofetch", "/socials"])
  })

  it("closes on Esc, keeping the field, and clears it on a second Esc", () => {
    render(<TerminalPage />)
    type("/neo")
    press("Escape")

    expect(screen.queryByRole("listbox")).not.toBeInTheDocument()
    expect(bar()).toHaveValue("/neo")

    press("Escape")
    expect(bar()).toHaveValue("")
  })
})

describe("running a Command", () => {
  it("appends its Echo and its rows below what was already printed", () => {
    render(<TerminalPage />)
    run("/neofetch")

    expect(echoes()).toEqual(["/neofetch", "/socials", "/neofetch"])
    // The same Profile rows, printed a second time by the run.
    expect(screen.getAllByText("Tony Wu")).toHaveLength(2)
    expect(bar()).toHaveValue("")
  })

  it("prints an unknown command's Echo and its not-found row, leaving the rest alone", () => {
    render(<TerminalPage />)
    run("/nope")

    expect(screen.getByText("/nope")).toBeInTheDocument()
    expect(screen.getByText("command not found: /nope")).toBeInTheDocument()
    expect(echoes()).toEqual(["/neofetch", "/socials", "/nope"])
  })

  it("wipes the screen to empty on /clear, with no marker", () => {
    render(<TerminalPage />)
    run("/clear")

    expect(echoes()).toEqual([])
    expect(screen.queryByText("Tony Wu")).not.toBeInTheDocument()
    expect(screen.queryByText("/neofetch")).not.toBeInTheDocument()
  })

  it("draws a Portrait per run, and none is left behind by /clear", () => {
    render(<TerminalPage />)
    run("/neofetch")
    expect(portraits()).toHaveLength(2)

    run("/clear")
    expect(portraits()).toHaveLength(0)
  })

  it("keeps the output scrolled to the newest Print", () => {
    render(<TerminalPage />)
    const log = screen.getByRole("log")
    // jsdom lays nothing out, so the screen is only ever as tall as it is told.
    Object.defineProperty(log, "scrollHeight", {
      value: 400,
      configurable: true,
    })

    run("/contacts")

    expect(log.scrollTop).toBe(400)
  })

  it("keeps the bar's key legend out of the output, so /clear leaves it standing", () => {
    render(<TerminalPage />)
    expect(screen.getByText("Tab accept")).toBeInTheDocument()

    run("/clear")

    expect(echoes()).toEqual([])
    expect(screen.getByText("Tab accept")).toBeInTheDocument()
    expect(screen.getByText("↑ ↓ history")).toBeInTheDocument()
  })
})

describe("History", () => {
  it("walks back with ↑, sets the draft aside, and hands it back with ↓", () => {
    render(<TerminalPage />)
    run("/contacts")
    type("half-typed")

    press("ArrowUp")
    expect(bar()).toHaveValue("/contacts")

    press("ArrowDown")
    expect(bar()).toHaveValue("half-typed")
  })

  it("collapses consecutive duplicates", () => {
    render(<TerminalPage />)
    run("/contacts")
    run("/contacts")

    press("ArrowUp")
    expect(bar()).toHaveValue("/contacts")
    // One entry, so ↑ again stays where it is rather than stepping twice.
    press("ArrowUp")
    expect(bar()).toHaveValue("/contacts")
  })

  it("survives a reload", () => {
    const visit = render(<TerminalPage />)
    run("/socials")
    visit.unmount()

    render(<TerminalPage />)
    press("ArrowUp")
    expect(bar()).toHaveValue("/socials")
  })

  it("is kept in memory when storage refuses to hold it", () => {
    jest.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("storage is off")
    })
    jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("storage is off")
    })

    const visit = render(<TerminalPage />)
    run("/socials")
    visit.unmount()

    render(<TerminalPage />)
    press("ArrowUp")
    expect(bar()).toHaveValue("/socials")
  })
})

describe("focus", () => {
  // The window's titlebar belongs to the Shell — named in
  // tests/components/os/os-shell — so the whole of the Terminal is now the
  // pane below it.
  it("moves to the field from a click anywhere in the Terminal", () => {
    render(<TerminalPage />)

    fireEvent.mouseUp(screen.getByRole("log"))

    expect(bar()).toHaveFocus()
  })

  it("leaves a release that ends a text selection alone, so the selection keeps", () => {
    render(<TerminalPage />)
    const range = document.createRange()
    range.selectNodeContents(screen.getByRole("log"))
    const selection = window.getSelection()
    selection?.addRange(range)

    fireEvent.mouseUp(screen.getByRole("log"))

    expect(selection?.isCollapsed).toBe(false)
    expect(bar()).not.toHaveFocus()
  })
})
