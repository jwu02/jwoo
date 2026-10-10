import { APPS, TERMINAL } from "@/components/os/apps"
import { getContacts } from "@/lib/resume/contacts"
import type { ContactKey } from "@/lib/resume/types"

import type { Print } from "./print"
import { PORTRAIT } from "./portrait"
import { ageOn, PROFILE } from "./profile"

/**
 * One of the Terminal's built-in operations, named with a leading slash and
 * declared once in COMMANDS. Every Command prints: it produces its Print and
 * nothing else. A Command whose Print carries an `href` is a way out of the
 * Terminal — the page follows that route, and the Command still only printed.
 */
export interface Command {
  /** The invocation, slash and all — what the Popup lists and the Input bar
   * matches its prefix against. */
  name: string
  /** One line, shown in the Popup. */
  description: string
  /** What running it leaves on the screen. Takes no arguments — the Input bar
   * hands a Command nothing, so each reads only its own config. */
  print: () => Print
}

/** How a contact key reads in the Terminal: English copy, like the rest of the
 * OS chrome, and exhaustive, so a new key cannot arrive unlabelled. */
const CONTACT_LABELS: Record<ContactKey, string> = {
  email: "Email",
  phone: "Phone",
  github: "GitHub",
  wechat: "WeChat",
}

/** Which contacts each listing Command prints: socials are where I post,
 * contacts are how I'm reached. */
const SOCIAL_KEYS: readonly ContactKey[] = ["github"]
const CONTACT_KEYS: readonly ContactKey[] = ["email", "phone", "wechat"]

/** The one contact to use first: its row says so. */
const PREFERRED_KEYS: readonly ContactKey[] = ["wechat"]

// The contacts seam decides what is published: an unset key has no row in
// either listing, whatever Command asks for it.
function contactRows(keys: readonly ContactKey[]): Print["rows"] {
  const wanted = new Set(keys)
  const preferred = new Set(PREFERRED_KEYS)
  return getContacts()
    .filter(({ key }) => wanted.has(key))
    .map(({ key, value }) => ({
      label: CONTACT_LABELS[key],
      value: preferred.has(key) ? `${value} (preferred)` : value,
      tone: "accent" as const,
    }))
}

/**
 * The ways out of the Terminal: one Command per application, drawn from the
 * same registry the Dock navigates by, so a route the Terminal can reach is
 * never a second list to drift. The Terminal itself is the one it does not
 * offer — the visitor already stands there.
 *
 * A Command's name is its route's slug, which is what a terminal would type;
 * the Desktop's route has none, so it goes by the name the Dock gives it.
 */
const WAYS_OUT: readonly Command[] = APPS.filter(
  (app) => app.href !== TERMINAL
).map((app) => {
  const name = `/${app.href.split("/").filter(Boolean).pop() ?? "home"}`
  return {
    name,
    description: `Open ${app.label}`,
    // No rows: going there is the navigation's doing, not a row's.
    print: () => ({ echo: name, rows: [], href: app.href }),
  }
})

/**
 * The Command registry: the one place a Command is declared, and the one list
 * the Popup matches against. Adding a Command is one entry
 * here; nothing else in the Terminal needs to know it exists.
 */
export const COMMANDS: readonly Command[] = [
  {
    name: "/clear",
    description: "Wipe the screen",
    // No rows: wiping is the machine's doing, not a row's.
    print: () => ({ echo: "/clear", rows: [] }),
  },
  {
    name: "/contacts",
    description: "How to reach me",
    print: () => ({ echo: "/contacts", rows: contactRows(CONTACT_KEYS) }),
  },
  {
    name: "/neofetch",
    description: "About me",
    print: () => ({
      echo: "/neofetch",
      // The Portrait opens the identity Print, and takes no row of its own:
      // the picture is what the rows then put a name to.
      portrait: PORTRAIT,
      rows: [
        { label: "Name", value: PROFILE.name },
        { label: "Age", value: String(ageOn(PROFILE.birthdate, new Date())) },
        { label: "Role", value: PROFILE.role },
        { label: "Location", value: PROFILE.location },
        { label: "Languages", value: PROFILE.languages.join("\n") },
      ],
    }),
  },
  {
    name: "/socials",
    description: "Where to find me",
    print: () => ({ echo: "/socials", rows: contactRows(SOCIAL_KEYS) }),
  },
  ...WAYS_OUT,
]

/**
 * The opening print: the identity Command pre-run, so a fresh visit is never
 * empty and the visitor learns the owner before typing. Read off the registry
 * like any other run — the screen opens with what `/neofetch` prints, not with
 * a second copy of it. No Echo: nobody ran it. A name the registry does not
 * hold is a typo in the line below, so it throws the way the tests' own lookup
 * does.
 */
export function openingPrint(): Print[] {
  const identity = COMMANDS.find((entry) => entry.name === "/neofetch")
  if (!identity) throw new Error("no Command named /neofetch")
  return [{ ...identity.print(), echo: undefined }]
}
