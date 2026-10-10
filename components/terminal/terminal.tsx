"use client"

import { useEffect, useReducer, useRef } from "react"

import { useVisualViewport } from "@/hooks/use-visual-viewport"

import { COMMANDS, openingPrint } from "./commands"
import { loadHistory, saveHistory } from "./history-store"
import {
  consumes,
  initialState,
  isInputKey,
  lit,
  matches,
  reduce,
  type InputAction,
  type InputConfig,
  type InputState,
} from "./input-machine"
import { PrintList, Prompt } from "./print"

/** The registry the bar is fed. The machine imports no list of its own. */
const CONFIG: InputConfig = { commands: COMMANDS }

/** The one listbox the bar's combobox controls, and the id its options share. */
const LISTBOX_ID = "terminal-commands"

/** A Popup row's id, so `aria-activedescendant` can name the lit one. Command
 * names are unique and nothing else in the page uses this prefix. */
const optionId = (name: string) => `${LISTBOX_ID}-${name.slice(1)}`

const step = (state: InputState, action: InputAction) =>
  reduce(state, CONFIG, action)

/**
 * The Terminal application: the Shell's os-glass surface in the site's two
 * tones, the Print above the Input bar.
 *
 * The bar is the machine's only driver. Every keystroke the bar has an opinion
 * about goes into `reduce`; every Print on the screen came out of it; and the
 * only things this component knows that the machine does not are the browser's:
 * storage, focus and the scroll position.
 */
export function Terminal() {
  // A fresh Terminal has already run the identity Command — the registry's
  // print, computed at mount.
  const [state, dispatch] = useReducer(step, null, () =>
    initialState(openingPrint())
  )
  const field = useRef<HTMLInputElement>(null)
  const output = useRef<HTMLDivElement>(null)

  // The pane, and only the pane, follows the software keyboard — the Shell and
  // its Dock stay where they are, and the keyboard landing on top of the Dock
  // is the Dock doing nothing wrong. See `useVisualViewport`.
  useVisualViewport()

  // History survives the visit; the transcript does not.
  useEffect(() => {
    dispatch({ type: "hydrate", history: loadHistory() })
  }, [])

  useEffect(() => {
    // v1 has no way to empty History, so a non-empty list is the only thing
    // worth writing — and the mount-time `[]`, which is not yet hydrated,
    // cannot overwrite what the last visit left.
    if (state.history.length > 0) saveHistory(state.history)
  }, [state.history])

  // Output appends and the screen follows it down — and keeps following when
  // the software keyboard shrinks the pane under it, which takes the newest
  // lines below the fold without any output changing.
  useEffect(() => {
    const screen = output.current
    if (!screen) return
    const pin = () => {
      screen.scrollTop = screen.scrollHeight
    }
    pin()
    const viewport = window.visualViewport
    viewport?.addEventListener("resize", pin)
    return () => viewport?.removeEventListener("resize", pin)
  }, [state.output])

  const options = matches(state, CONFIG)
  const highlighted = lit(state, CONFIG)
  // An empty match has no list to expand, so the Popup shows nothing at all.
  const popupShowing = state.popupOpen && options.length > 0

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    // The browser's own shortcuts are the browser's: ⌘↑ is not History.
    if (event.metaKey || event.ctrlKey || event.altKey) return
    if (!isInputKey(event.key)) return
    // The bar takes a key only while it has a use for it, so Tab is the
    // browser's the moment there is nothing to accept.
    if (!consumes(state, CONFIG, event.key)) return
    event.preventDefault()
    dispatch({ type: "key", key: event.key })
  }

  /** A click anywhere in the Terminal puts the field under the visitor's hands,
   * the way a terminal does. On mouse-up rather than mouse-down: the press is
   * left to the browser, so dragging a selection in the output still works, and
   * a release that ends one is a selection rather than a click. The focus is
   * taken without scrolling, so the pane does not jump to reveal the field
   * while iOS has the keyboard over it. */
  function onMouseUp(event: React.MouseEvent<HTMLDivElement>) {
    if (event.button !== 0) return
    const target = event.target as HTMLElement
    if (target.closest("input, button, a")) return
    const selection = window.getSelection()
    if (selection && !selection.isCollapsed) return
    field.current?.focus({ preventScroll: true })
  }

  return (
    // The pane follows the software keyboard, and only the pane: on a coarse
    // pointer it takes the visual viewport's height, so the Input bar ends up
    // above the keyboard rather than under it. `100%` is the ceiling — with
    // the keyboard away the pane fills its surface as it always did.
    <div
      className="flex h-full min-h-0 flex-col pointer-coarse:h-[min(var(--vvh,100svh),100%)]"
      onMouseUp={onMouseUp}
    >
      {/* The output is the only part that moves: the window's titlebar above
          stays put and the Input bar stays pinned to the bottom edge. */}
      <div
        ref={output}
        role="log"
        aria-live="polite"
        aria-label="Output"
        className="min-h-0 flex-1 overflow-auto px-5 py-5 font-mono text-[13.5px] leading-snug md:px-8 md:py-7"
      >
        <PrintList prints={state.output} />
        {/* The line being typed at: the same prompt an Echo wears, standing
            empty at the end of the output. It is not a Print — nobody ran it
            and /clear wipes the Prints, not the line waiting for one. */}
        <p aria-hidden="true" className="text-muted-foreground">
          <Prompt />
        </p>
      </div>

      {/* An OS text field, not a terminal prompt: rounded, translucent, the
          focus ring borrowed from the rest of the Shell — with the Popup
          attached above it. */}
      <div className="relative shrink-0 px-4 pb-4 md:px-6 md:pb-6">
        {/* The bar's legend: the keys it has an opinion about. Chrome rather
            than Print — it is never appended to the output and never cleared. */}
        <p className="mb-2 flex flex-wrap items-center gap-1.5 px-1 font-mono text-[11px] text-muted-foreground">
          <span className="rounded-md bg-foreground/5 px-2 py-0.5">/ commands</span>
          <span className="rounded-md bg-foreground/5 px-2 py-0.5">Tab accept</span>
          <span className="rounded-md bg-foreground/5 px-2 py-0.5">↑ ↓ history</span>
          <span className="rounded-md bg-foreground/5 px-2 py-0.5">Esc close</span>
        </p>

        {popupShowing && (
          <div
            id={LISTBOX_ID}
            role="listbox"
            aria-label="Commands"
            className="absolute inset-x-4 bottom-full mb-2 overflow-hidden rounded-xl border border-foreground/12 bg-background/95 py-1 font-mono text-[13.5px] shadow-lg backdrop-blur md:inset-x-6"
          >
            {options.map((command) => (
              <button
                key={command.name}
                type="button"
                role="option"
                id={optionId(command.name)}
                aria-selected={command.name === highlighted?.name}
                // The field keeps focus through the click that picks a row.
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => dispatch({ type: "accept", name: command.name })}
                className="flex w-full items-baseline gap-3 px-3.5 py-1.5 text-left aria-selected:bg-foreground/8"
              >
                <span className="text-foreground">{command.name}</span>
                <span className="text-muted-foreground">
                  {command.description}
                </span>
              </button>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2 rounded-xl border border-foreground/12 bg-foreground/5 px-3.5 py-2.5 font-mono text-[13.5px] text-foreground shadow-inner transition focus-within:border-foreground/25 focus-within:bg-foreground/8">
          <span className="text-muted-foreground">›</span>
          <input
            ref={field}
            role="combobox"
            aria-label="Terminal input"
            aria-autocomplete="list"
            aria-expanded={popupShowing}
            aria-controls={popupShowing ? LISTBOX_ID : undefined}
            aria-activedescendant={
              popupShowing && highlighted
                ? optionId(highlighted.name)
                : undefined
            }
            placeholder="Type / to see commands"
            autoComplete="off"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="enter"
            value={state.query}
            onChange={(event) =>
              dispatch({ type: "type", value: event.target.value })
            }
            onKeyDown={onKeyDown}
            // Safari decides whether it must scroll to reveal a field on
            // `mousedown`, before focus — and with the keyboard up that scroll
            // moves the whole Shell. On a coarse pointer we take the focus
            // ourselves instead: the document is locked (see app/globals.css)
            // so there is nothing left to scroll, and `preventScroll` says so
            // explicitly. A mouse keeps its ordinary caret placement.
            onMouseDown={(event) => {
              if (!window.matchMedia?.("(pointer: coarse)").matches) return
              event.preventDefault()
              event.currentTarget.focus({ preventScroll: true })
            }}
            // iOS zooms the page when a field under 16px takes focus, so on a
            // coarse pointer the field renders at 16px even though the bar's
            // type is smaller on a mouse.
            className="w-full bg-transparent outline-none placeholder:text-muted-foreground/70 pointer-coarse:text-base"
          />
        </div>
      </div>
    </div>
  )
}
