// The Input bar's behaviour as a pure state machine.
//
// Lifted wholesale from the #61 prototype's EXTRACT block: `(state, config,
// action) => state` with no DOM, no storage and no side effects, so it can be
// driven by a key handler one day and by a test the next. The Command registry
// is fed in through `config` — the machine reads only each Command's `name`
// (matching) and calls its `print` (running); it never imports a list of its
// own.
//
// The toggles the prototype left open are resolved here at its defaults: prefix
// matching (fuzzy is rejected), Esc clears after closing, Tab accepts, and
// History is kept in `state` so the wiring can remember it across visits with a
// `hydrate` of whatever the store holds.

import type { Command } from "./commands"
import type { Print } from "./print"

/** What the machine is allowed to know: the registry, nothing else. */
export interface InputConfig {
  /** The Command registry, in the order the Popup lists it. */
  commands: readonly Command[]
}

/** The Input bar's whole state: the field, the Popup, History, and the screen. */
export interface InputState {
  /** What is typed in the field. */
  query: string
  /** Whether the Popup is up. Only the first token opens it. */
  popupOpen: boolean
  /** The index into the matched Commands that the Popup has lit. */
  active: number
  /** The invocations run, oldest first, so ↑ can walk back into them. */
  history: readonly string[]
  /**
   * Where ↑/↓ are in History: `null` while editing the draft, or the index of
   * the entry being shown.
   */
  cursor: number | null
  /** The half-typed line ↑ set aside, restored when ↓ comes back past the newest entry. */
  draft: string
  /** Everything printed so far, in the order it was produced. */
  output: readonly Print[]
}

/** The keys the bar has an opinion about. Everything else is the browser's. */
export const INPUT_KEYS = [
  "ArrowUp",
  "ArrowDown",
  "Tab",
  "Escape",
  "Enter",
] as const

export type InputKey = (typeof INPUT_KEYS)[number]

/** Whether a raw `KeyboardEvent.key` is one the bar might take. */
export function isInputKey(key: string): key is InputKey {
  return (INPUT_KEYS as readonly string[]).includes(key)
}

export type InputAction =
  /** The field's value changed — a keystroke, a paste, a click on a row's accept. */
  | { type: "type"; value: string }
  /** One of the bar's keys went down. */
  | { type: "key"; key: InputKey }
  /** A Command was invoked directly, as the Popup's click and the page's seed do. */
  | { type: "run"; value: string }
  /** History was read back from a store at boot. */
  | { type: "hydrate"; history: readonly string[] }

/**
 * A fresh bar. `seed` is the opening print the Terminal has already run, so the
 * machine never has to know the registry to greet a visitor.
 */
export function initialState(seed: readonly Print[] = []): InputState {
  return {
    query: "",
    popupOpen: false,
    active: 0,
    history: [],
    cursor: null,
    draft: "",
    output: seed.slice(),
  }
}

/**
 * The Popup is up only while the first token is being typed: it must open with
 * the slash, and a space means arguments, which closes it. v1 Commands take no
 * arguments; whatever follows a Command's name is ignored at run time.
 */
export function listOpens(query: string): boolean {
  return query.startsWith("/") && !query.includes(" ")
}

/**
 * Prefix matching, and only prefix: the query minus its slash must start the
 * Command's name. A bare `/` (nothing after the slash) matches everything.
 */
function oneMatches(name: string, query: string): boolean {
  const command = name.slice(1).toLowerCase()
  const typed = query.slice(1).toLowerCase()
  return typed === "" || command.startsWith(typed)
}

/** The Commands the Popup is showing, in registry order. Closed means none. */
export function matches(
  state: InputState,
  config: InputConfig
): readonly Command[] {
  if (!state.popupOpen) return []
  return config.commands.filter((command) =>
    oneMatches(command.name, state.query)
  )
}

/** The Command the Popup has lit, clamped to the list in case it shrank under it. */
export function lit(
  state: InputState,
  config: InputConfig
): Command | undefined {
  const list = matches(state, config)
  return list[Math.min(state.active, Math.max(list.length - 1, 0))]
}

/**
 * Whether the bar takes this key. The page `preventDefault`s only when it does,
 * so the moment the bar has no use for a key — Tab with nothing lit, Esc on an
 * empty field, ↓ with no history — the browser keeps it. Tab is never trapped.
 */
export function consumes(
  state: InputState,
  config: InputConfig,
  key: InputKey
): boolean {
  const list = matches(state, config)
  if (key === "ArrowUp" || key === "ArrowDown") {
    if (state.popupOpen) return true
    // ↑ is only useful with somewhere to go: history, or a cursor already there.
    return key === "ArrowUp"
      ? state.history.length > 0 || state.cursor !== null
      : state.cursor !== null
  }
  if (key === "Tab") return state.popupOpen && list.length > 0
  if (key === "Escape") return state.popupOpen || state.query !== ""
  if (key === "Enter") return true
  return false
}

/** Put a Command into the field and close the Popup — accepting, not running. */
function accept(state: InputState, command: Command): InputState {
  return {
    ...state,
    query: command.name,
    popupOpen: false,
    active: 0,
    cursor: null,
  }
}

/**
 * Walking History: ↑ steps back, ↓ forward. Leaving the draft to enter History
 * puts it aside; coming past the newest entry hands it back untouched. At either
 * end the walk simply stops.
 */
function stepHistory(state: InputState, direction: -1 | 1): InputState {
  const { history, cursor, draft, query } = state
  if (direction === -1) {
    if (history.length === 0) return state
    if (cursor === null) {
      const at = history.length - 1
      return {
        ...state,
        draft: query,
        cursor: at,
        query: history[at],
        popupOpen: false,
      }
    }
    const at = Math.max(0, cursor - 1)
    return { ...state, cursor: at, query: history[at], popupOpen: false }
  }
  if (cursor === null) return state
  if (cursor < history.length - 1) {
    const at = cursor + 1
    return { ...state, cursor: at, query: history[at], popupOpen: false }
  }
  return { ...state, cursor: null, query: draft, popupOpen: false }
}

/** What an unknown invocation leaves: its echo and the not-found line. */
function notFound(query: string, name: string): Print {
  return { echo: query, rows: [], error: `command not found: ${name}` }
}

/**
 * Run a query, if there is one. An empty query is a no-op. The invocation goes
 * into History (consecutive duplicates collapse, the way a shell's `ignoredups`
 * does), the field and draft are cleared, and the output gains the Command's
 * Print — or `/clear` wipes it. `/clear` is keyed off the first token, so
 * anything typed after a Command's name is ignored for every Command alike.
 */
function runQuery(
  state: InputState,
  config: InputConfig,
  raw: string
): InputState {
  const query = raw.trim()
  if (query === "") return state
  const last = state.history[state.history.length - 1]
  const history = last === query ? state.history : [...state.history, query]
  const name = query.split(" ")[0]
  // Matching folds case, so the run must fold it too or `/WHOAMI` would match
  // in the Popup and then not be found on Enter.
  const command = config.commands.find(
    (entry) => entry.name.toLowerCase() === name.toLowerCase()
  )
  const output =
    command?.name === "/clear"
      ? []
      : [...state.output, command ? command.print() : notFound(query, name)]
  return {
    ...state,
    query: "",
    popupOpen: false,
    active: 0,
    cursor: null,
    draft: "",
    history,
    output,
  }
}

/** One step of the machine. Unhandled actions leave the state untouched. */
export function reduce(
  state: InputState,
  config: InputConfig,
  action: InputAction
): InputState {
  switch (action.type) {
    case "type": {
      const query = action.value
      return {
        ...state,
        query,
        popupOpen: listOpens(query),
        active: 0,
        cursor: null,
      }
    }
    case "key": {
      const list = matches(state, config)
      const { key } = action
      if (key === "ArrowUp" || key === "ArrowDown") {
        if (state.popupOpen && list.length > 0) {
          const at = Math.min(state.active, list.length - 1)
          const moved =
            key === "ArrowDown"
              ? (at + 1) % list.length
              : (at - 1 + list.length) % list.length
          return { ...state, active: moved }
        }
        if (state.popupOpen) return state
        return stepHistory(state, key === "ArrowUp" ? -1 : 1)
      }
      if (key === "Tab") {
        const command = lit(state, config)
        return state.popupOpen && command ? accept(state, command) : state
      }
      if (key === "Escape") {
        if (state.popupOpen) return { ...state, popupOpen: false }
        // Clearing the field never takes the draft the History walk set aside,
        // nor the History itself.
        if (state.query !== "") return { ...state, query: "", cursor: null }
        return state
      }
      if (key === "Enter") {
        const command = lit(state, config)
        // With a highlight, Enter accepts into the field — a second Enter, with
        // the Popup now closed, is what runs it.
        if (state.popupOpen && command) return accept(state, command)
        return runQuery(state, config, state.query)
      }
      return state
    }
    case "run":
      return runQuery(state, config, action.value)
    case "hydrate":
      return {
        ...state,
        history: action.history.slice(),
        cursor: null,
        draft: "",
      }
    default:
      return state
  }
}
