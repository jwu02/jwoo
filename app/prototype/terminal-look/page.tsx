"use client"

/**
 * PROTOTYPE ROUTE — throwaway. jwoo issue #60, "The Terminal's look".
 *
 * Four looks were drawn and judged; the OS Pane won, so this file is the OS
 * Pane only — the terminal as just another application surface, wearing the
 * Shell's glass, two tones plus the site's one accent. The rejected three
 * (phosphor CRT, glass + ANSI, workbench) live in commit b7a9c62 on this
 * branch, not here.
 *
 * Nothing below ships: the fixture is a fixture, there is no registry, no data
 * fetching, no error handling, and the input does only what it takes to see
 * the look. Fold the answers into the real Terminal when the spec is built,
 * then let this route die.
 */

import { useState } from "react"

import { cn } from "@/lib/utils"

const PROFILE = {
  handle: "jwoo",
  host: "localhost",
  name: "Tony Wu",
  age: "24",
  company: "Kevala",
  role: "Software Engineer",
  /** Read server-side from Vercel's geo headers in the real app. */
  location: "Sydney, Australia",
}

const SOCIALS = [
  { label: "GitHub", value: "github.com/jwu02" },
  { label: "Email", value: "tony@jwu02.dev" },
  { label: "LinkedIn", value: "linkedin.com/in/jwu02" },
]

const COMMANDS = [
  { name: "/help", description: "List the commands" },
  { name: "/whoami", description: "Who you are, and who I am" },
  { name: "/socials", description: "Where to find me" },
  { name: "/clear", description: "Wipe the screen" },
]

const FACTS: [string, string][] = [
  ["Name", PROFILE.name],
  ["Age", PROFILE.age],
  ["Role", PROFILE.role],
  ["Company", PROFILE.company],
  ["You are in", PROFILE.location],
]

function Prompt() {
  return (
    <>
      <span className="text-muted-foreground">
        {PROFILE.handle}@{PROFILE.host}
      </span>{" "}
      <span className="text-muted-foreground">~</span>{" "}
      <span style={{ color: "var(--claude-orange)" }}>%</span>{" "}
    </>
  )
}

export default function TerminalLookPrototype() {
  // Which command the visitor has started, whether the `/` list is up, and
  // which row is lit. The popup's look is the prototype's question; its
  // behaviour is issue #61's, kept to the minimum needed to see the look.
  const [query, setQuery] = useState("")
  const [popupOpen, setPopupOpen] = useState(false)
  const [active, setActive] = useState(0)

  const matches = popupOpen
    ? COMMANDS.filter((c) => c.name.startsWith(query))
    : []
  const highlighted = Math.min(active, Math.max(matches.length - 1, 0))

  function accept(name: string) {
    setQuery(name)
    setPopupOpen(false)
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      // One Escape at a time: the list first, the query after it.
      event.preventDefault()
      if (popupOpen) setPopupOpen(false)
      else setQuery("")
      return
    }
    if (!popupOpen || matches.length === 0) return
    if (event.key === "ArrowDown") {
      event.preventDefault()
      setActive((highlighted + 1) % matches.length)
    } else if (event.key === "ArrowUp") {
      event.preventDefault()
      setActive((highlighted - 1 + matches.length) % matches.length)
    } else if (event.key === "Enter" || event.key === "Tab") {
      event.preventDefault()
      accept(matches[highlighted].name)
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col font-mono text-[13.5px] leading-relaxed">
      <div className="min-h-0 flex-1 overflow-auto px-5 py-5 md:px-8 md:py-7">
        <Prompt /> <span className="text-foreground">/whoami</span>
        <dl className="mt-3 grid grid-cols-[7rem_1fr] gap-x-4 gap-y-1.5 pl-0.5">
          {FACTS.map(([label, value]) => (
            <div key={label} className="contents">
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="text-foreground">{value}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-6">
          <Prompt /> <span className="text-foreground">/socials</span>
          <ul className="mt-3 space-y-1.5 pl-0.5">
            {SOCIALS.map((s) => (
              <li key={s.label}>
                <span className="text-muted-foreground">{s.label}</span>
                <span className="text-muted-foreground/60"> · </span>
                <span style={{ color: "var(--claude-orange)" }}>{s.value}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* An OS text field, not a terminal prompt: rounded, translucent,
          focus ring borrowed from the rest of the shell. Typing `/` opens the
          command list attached to its top edge. */}
      <div className="relative shrink-0 px-4 pb-4 md:px-6 md:pb-6">
        {popupOpen && (
          <div
            id="tp-command-list"
            role="listbox"
            aria-label="Commands"
            className="absolute inset-x-4 bottom-full mb-2 overflow-hidden rounded-xl border border-foreground/12 bg-popover/95 p-1 shadow-2xl backdrop-blur-md md:inset-x-6"
          >
            {matches.length === 0 ? (
              <p className="px-3 py-2 font-mono text-[13.5px] text-muted-foreground">
                No command matches {query}
              </p>
            ) : (
              matches.map((c, i) => (
                <button
                  key={c.name}
                  id={`tp-command-${c.name.slice(1)}`}
                  type="button"
                  role="option"
                  aria-selected={i === highlighted}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => accept(c.name)}
                  className={cn(
                    "flex w-full items-baseline gap-3 rounded-lg px-3 py-2 text-left font-mono text-[13.5px]",
                    i === highlighted && "bg-foreground/8"
                  )}
                >
                  <span className="text-foreground">{c.name}</span>
                  <span className="text-muted-foreground">{c.description}</span>
                </button>
              ))
            )}
          </div>
        )}
        <div className="flex items-center gap-2 rounded-xl border border-foreground/12 bg-foreground/5 px-3.5 py-2.5 font-mono text-[13.5px] text-foreground shadow-inner transition focus-within:border-foreground/25 focus-within:bg-foreground/8">
          <span className="text-muted-foreground">›</span>
          <input
            role="combobox"
            aria-expanded={popupOpen}
            aria-controls="tp-command-list"
            aria-autocomplete="list"
            aria-activedescendant={
              popupOpen && matches[highlighted]
                ? `tp-command-${matches[highlighted].name.slice(1)}`
                : undefined
            }
            value={query}
            onChange={(event) => {
              const next = event.target.value
              setQuery(next)
              setPopupOpen(next.startsWith("/"))
              setActive(0)
            }}
            onKeyDown={onKeyDown}
            className="w-full bg-transparent outline-none placeholder:text-muted-foreground/70"
            placeholder="Type / to see commands"
            aria-label="Terminal input"
          />
        </div>
      </div>
    </div>
  )
}
