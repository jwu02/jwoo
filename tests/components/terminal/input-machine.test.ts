import { readFileSync } from "node:fs"
import { resolve } from "node:path"

import { COMMANDS, type Command } from "@/components/terminal/commands"
import {
  consumes,
  initialState,
  isInputKey,
  lit,
  listOpens,
  matches,
  reduce,
  type InputConfig,
  type InputKey,
  type InputState,
} from "@/components/terminal/input-machine"

const CONFIG: InputConfig = { commands: COMMANDS }

const typ = (state: InputState, value: string) =>
  reduce(state, CONFIG, { type: "type", value })
const key = (state: InputState, pressed: InputKey) =>
  reduce(state, CONFIG, { type: "key", key: pressed })
const run = (state: InputState, value: string) =>
  reduce(state, CONFIG, { type: "run", value })

const names = (state: InputState) => matches(state, CONFIG).map((c) => c.name)

describe("the input machine's shape", () => {
  it("starts empty, closed, with no history and a seed it was handed", () => {
    const seed = [{ echo: "/whoami", rows: [{ label: "Name", value: "Tony" }] }]
    const state = initialState(seed)

    expect(state.query).toBe("")
    expect(state.popupOpen).toBe(false)
    expect(state.active).toBe(0)
    expect(state.history).toEqual([])
    expect(state.cursor).toBeNull()
    expect(state.draft).toBe("")
    expect(state.output).toEqual(seed)
  })

  it("keeps DOM, storage and application imports out of the machine", () => {
    // The machine is the Tetris Engine's kind of pure: no renderer, no store,
    // no side effects. A value import would smuggle one of those in; only type
    // imports from its sibling modules are allowed.
    const source = readFileSync(
      resolve(__dirname, "../../../components/terminal/input-machine.ts"),
      "utf8"
    )
    const valueImports = [
      ...source.matchAll(
        /^\s*import\s+(?!type\s)(?:[^"']*?from\s+)?["']([^"']+)["']/gm
      ),
    ].map((match) => match[1])

    expect(valueImports).toEqual([])
    expect(source).not.toMatch(
      /\b(localStorage|sessionStorage|document|window)\b/
    )
  })

  it("recognises only the keys the bar might take", () => {
    for (const recognised of ["ArrowUp", "ArrowDown", "Tab", "Escape", "Enter"])
      expect(isInputKey(recognised)).toBe(true)
    for (const ignored of ["a", " ", "Backspace", "Home"])
      expect(isInputKey(ignored)).toBe(false)
  })
})

describe("the Popup", () => {
  it("opens on the slash with every Command, the first one lit", () => {
    const state = typ(initialState(), "/")

    expect(state.popupOpen).toBe(true)
    expect(names(state)).toEqual(["/help", "/whoami", "/socials", "/clear"])
    expect(lit(state, CONFIG)?.name).toBe("/help")
  })

  it("narrows by prefix as the query grows", () => {
    expect(names(typ(initialState(), "/s"))).toEqual(["/socials"])
    expect(names(typ(initialState(), "/w"))).toEqual(["/whoami"])
    expect(names(typ(initialState(), "/c"))).toEqual(["/clear"])
  })

  it("matches nothing for the honest /a — prefix only, no fuzzy", () => {
    const state = typ(initialState(), "/a")
    expect(state.popupOpen).toBe(true)
    expect(names(state)).toEqual([])
  })

  it("stays up on a bare slash and closes on the first space", () => {
    expect(listOpens("/")).toBe(true)
    expect(listOpens("/whoami")).toBe(true)
    expect(listOpens("/whoami me")).toBe(false)
    expect(listOpens("hello")).toBe(false)
    expect(typ(initialState(), "/help me").popupOpen).toBe(false)
  })

  it("reads whatever registry it is fed, not one of its own", () => {
    const custom: readonly Command[] = [
      {
        name: "/ping",
        description: "Pong",
        print: () => ({ echo: "/ping", rows: [] }),
      },
      {
        name: "/pong",
        description: "Ping",
        print: () => ({ echo: "/pong", rows: [] }),
      },
    ]
    const config: InputConfig = { commands: custom }
    const opened = reduce(initialState(), config, { type: "type", value: "/p" })

    expect(matches(opened, config).map((c) => c.name)).toEqual([
      "/ping",
      "/pong",
    ])
    const narrowed = reduce(opened, config, { type: "type", value: "/po" })
    expect(matches(narrowed, config).map((c) => c.name)).toEqual(["/pong"])
  })

  it("cycles the highlight, wrapping at either end", () => {
    let state = typ(initialState(), "/")
    expect(state.active).toBe(0)

    state = key(state, "ArrowUp")
    expect(lit(state, CONFIG)?.name).toBe("/clear")
    state = key(state, "ArrowDown")
    expect(lit(state, CONFIG)?.name).toBe("/help")

    state = key(state, "ArrowDown")
    expect(lit(state, CONFIG)?.name).toBe("/whoami")
    state = key(state, "ArrowUp")
    expect(lit(state, CONFIG)?.name).toBe("/help")
  })

  it("keeps an empty match up rather than vanishing, and consumes the arrows", () => {
    const state = typ(initialState(), "/a")

    // The empty list still takes the key — it is up, it is just empty.
    expect(consumes(state, CONFIG, "ArrowDown")).toBe(true)
    expect(key(state, "ArrowDown")).toBe(state)
  })
})

describe("Tab", () => {
  it("accepts the highlight into the field and never runs it", () => {
    const state = key(typ(initialState(), "/who"), "Tab")

    expect(state.query).toBe("/whoami")
    expect(state.popupOpen).toBe(false)
    expect(state.history).toEqual([])
    expect(state.output).toEqual([])
  })

  it("is not trapped: unconsumed with nothing lit or no Popup", () => {
    const noMatch = typ(initialState(), "/a")
    expect(consumes(noMatch, CONFIG, "Tab")).toBe(false)
    expect(key(noMatch, "Tab")).toBe(noMatch)

    const closed = typ(initialState(), "/whoami ")
    expect(consumes(closed, CONFIG, "Tab")).toBe(false)
    expect(key(closed, "Tab")).toBe(closed)
  })

  it("takes the key only while it has something to accept", () => {
    expect(consumes(typ(initialState(), "/w"), CONFIG, "Tab")).toBe(true)
  })
})

describe("a Popup row's click", () => {
  it("accepts the picked Command into the field, and never runs it", () => {
    const state = reduce(typ(initialState(), "/"), CONFIG, {
      type: "accept",
      name: "/socials",
    })

    expect(state.query).toBe("/socials")
    expect(state.popupOpen).toBe(false)
    expect(state.active).toBe(0)
    expect(state.history).toEqual([])
    expect(state.output).toEqual([])
  })

  it("leaves the state alone for a name the registry does not hold", () => {
    const opened = typ(initialState(), "/")
    expect(reduce(opened, CONFIG, { type: "accept", name: "/nope" })).toBe(
      opened
    )
  })
})

describe("Esc", () => {
  it("closes the Popup first, keeping the field", () => {
    const closed = key(typ(initialState(), "/who"), "Escape")

    expect(closed.popupOpen).toBe(false)
    expect(closed.query).toBe("/who")
  })

  it("clears the field on a second press", () => {
    const closed = key(typ(initialState(), "/who"), "Escape")
    const cleared = key(closed, "Escape")

    expect(cleared.query).toBe("")
    expect(cleared.cursor).toBeNull()
    expect(cleared.draft).toBe("")
  })

  it("never takes the draft or the History", () => {
    let state = run(initialState(), "/whoami")
    state = typ(state, "half-typed")
    state = key(state, "ArrowUp")
    expect(state.draft).toBe("half-typed")

    state = key(state, "Escape")
    expect(state.draft).toBe("half-typed")
    expect(state.history).toEqual(["/whoami"])
  })

  it("is not consumed on an empty field, and does nothing", () => {
    const empty = initialState()
    expect(consumes(empty, CONFIG, "Escape")).toBe(false)
    expect(key(empty, "Escape")).toBe(empty)
  })

  it("only closes while the Popup is up, however full the field", () => {
    const closed = key(typ(initialState(), "/whoami"), "Escape")
    expect(consumes(closed, CONFIG, "Escape")).toBe(true)
    expect(key(closed, "Escape").query).toBe("")
  })
})

describe("Enter", () => {
  it("accepts a highlight into the field, and a second Enter runs it", () => {
    const accepted = key(typ(initialState(), "/who"), "Enter")
    expect(accepted.query).toBe("/whoami")
    expect(accepted.popupOpen).toBe(false)
    expect(accepted.history).toEqual([])

    const ran = key(accepted, "Enter")
    expect(ran.query).toBe("")
    expect(ran.history).toEqual(["/whoami"])
    expect(ran.output.map((p) => p.echo)).toEqual(["/whoami"])
  })

  it("runs an unprefixed query directly", () => {
    const ran = key(typ(initialState(), "/nope"), "Enter")
    expect(ran.query).toBe("")
    expect(ran.history).toEqual(["/nope"])
  })

  it("does nothing on an empty field", () => {
    const empty = initialState()
    expect(consumes(empty, CONFIG, "Enter")).toBe(true)
    expect(key(empty, "Enter")).toBe(empty)
  })
})

describe("History", () => {
  function withHistory(): InputState {
    let state = run(initialState(), "/whoami")
    state = run(state, "/socials")
    return typ(state, "half-typed")
  }

  it("steps back to the newest entry, setting the draft aside", () => {
    const up = key(withHistory(), "ArrowUp")

    expect(up.query).toBe("/socials")
    expect(up.draft).toBe("half-typed")
    expect(up.cursor).toBe(1)
  })

  it("steps to the oldest entry, and stops there", () => {
    const oldest = key(key(withHistory(), "ArrowUp"), "ArrowUp")
    expect(oldest.query).toBe("/whoami")
    expect(oldest.cursor).toBe(0)

    expect(key(oldest, "ArrowUp")).toEqual(oldest)
  })

  it("comes back down to the untouched draft", () => {
    let state = key(key(withHistory(), "ArrowUp"), "ArrowUp")
    state = key(state, "ArrowDown")
    state = key(state, "ArrowDown")

    expect(state.cursor).toBeNull()
    expect(state.query).toBe("half-typed")
  })

  it("abandons history mode as soon as the field is typed into", () => {
    const up = key(withHistory(), "ArrowUp")
    const typed = typ(up, "/socials now")

    expect(typed.cursor).toBeNull()
    expect(typed.draft).toBe("half-typed")
  })

  it("is not consumed on an empty bar, and changes nothing", () => {
    const empty = initialState()
    expect(consumes(empty, CONFIG, "ArrowUp")).toBe(false)
    expect(consumes(empty, CONFIG, "ArrowDown")).toBe(false)
    expect(key(empty, "ArrowUp")).toBe(empty)
    expect(key(empty, "ArrowDown")).toBe(empty)
  })

  it("is consumed once there is something to walk", () => {
    const walked = run(initialState(), "/whoami")
    expect(consumes(walked, CONFIG, "ArrowUp")).toBe(true)
    expect(consumes(walked, CONFIG, "ArrowDown")).toBe(false)
    expect(consumes(key(walked, "ArrowUp"), CONFIG, "ArrowDown")).toBe(true)
  })

  it("collapses consecutive duplicates, like a shell's ignoredups", () => {
    let state = run(initialState(), "/whoami")
    state = run(state, "/whoami")
    expect(state.history).toEqual(["/whoami"])

    state = run(state, "/socials")
    state = run(state, "/whoami")
    expect(state.history).toEqual(["/whoami", "/socials", "/whoami"])
  })

  it("hydrates from a store at boot", () => {
    const state = reduce(initialState(), CONFIG, {
      type: "hydrate",
      history: ["/help", "/socials"],
    })

    expect(state.history).toEqual(["/help", "/socials"])
    expect(state.cursor).toBeNull()
    expect(state.draft).toBe("")
  })
})

describe("running a query", () => {
  it("appends the Command's Print and clears the field and draft", () => {
    let state = run(initialState(), "/whoami")
    state = typ(state, "half-typed")
    state = key(state, "ArrowUp")

    const ran = run(state, "/socials")
    expect(ran.query).toBe("")
    expect(ran.cursor).toBeNull()
    expect(ran.draft).toBe("")
    expect(ran.output.map((p) => p.echo)).toEqual(["/whoami", "/socials"])
  })

  it("ignores whatever follows the Command's name", () => {
    const ran = run(initialState(), "/whoami now please")

    expect(ran.output.map((p) => p.echo)).toEqual(["/whoami"])
    expect(ran.history).toEqual(["/whoami now please"])
  })

  it("folds case the same way matching does, so a matched command always runs", () => {
    const ran = run(initialState(), "/WHOAMI")

    expect(ran.output.map((p) => p.echo)).toEqual(["/whoami"])
  })

  it("prints the echo and the not-found line for an unknown command", () => {
    let state = run(initialState(), "/whoami")
    state = run(state, "/nope")

    // The existing output is untouched; the error simply appends.
    expect(state.output).toHaveLength(2)
    expect(state.output[0].echo).toBe("/whoami")
    expect(state.output[1]).toEqual({
      echo: "/nope",
      rows: [],
      error: "command not found: /nope",
    })
  })

  it("uses the fed registry's print for a known command", () => {
    const custom: readonly Command[] = [
      {
        name: "/ping",
        description: "Pong",
        print: () => ({
          echo: "/ping",
          rows: [{ label: "Pong", value: "ping" }],
        }),
      },
    ]
    const config: InputConfig = { commands: custom }
    const ran = reduce(initialState(), config, { type: "run", value: "/ping" })

    expect(ran.output).toEqual([
      { echo: "/ping", rows: [{ label: "Pong", value: "ping" }] },
    ])
  })
})

describe("/clear", () => {
  it("wipes the output to empty and leaves no marker", () => {
    let state = run(initialState(), "/whoami")
    state = run(state, "/socials")
    const cleared = run(state, "/clear")

    expect(cleared.output).toEqual([])
    // The invocation is still remembered, even though its Print is not.
    expect(cleared.history).toEqual(["/whoami", "/socials", "/clear"])
  })

  it("wipes even when arguments follow it", () => {
    const state = run(run(initialState(), "/whoami"), "/clear everything")
    expect(state.output).toEqual([])
  })
})
