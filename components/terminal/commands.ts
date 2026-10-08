import { getContacts } from "@/lib/resume/contacts"
import type { ContactKey } from "@/lib/resume/types"

import type { Print } from "./print"
import { ageOn, PROFILE } from "./profile"

/**
 * One of the Terminal's built-in operations, named with a leading slash and
 * declared once in COMMANDS. In v1 every Command is print-only: it produces its
 * Print and does nothing else.
 */
export interface Command {
  /** The invocation, slash and all — what the Popup lists and the Input bar
   * matches its prefix against. */
  name: string
  /** One line, shown in the Popup and printed by `/help`. */
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

/**
 * The Command registry: the one place a Command is declared, and the one list
 * `/help` prints and the Popup matches against. Adding a Command is one entry
 * here; nothing else in the Terminal needs to know it exists.
 */
export const COMMANDS: readonly Command[] = [
  {
    name: "/help",
    description: "List the commands",
    // Read off this very list, so there is no second one to rot.
    print: () => ({
      echo: "/help",
      rows: COMMANDS.map(({ name, description }) => ({
        label: name,
        value: description,
      })),
    }),
  },
  {
    name: "/whoami",
    description: "Who you are, and who I am",
    print: () => ({
      echo: "/whoami",
      rows: [
        { label: "Name", value: PROFILE.name },
        { label: "Age", value: String(ageOn(PROFILE.birthdate, new Date())) },
        { label: "Role", value: PROFILE.role },
        { label: "Company", value: PROFILE.company },
        { label: "Location", value: PROFILE.location },
      ],
    }),
  },
  {
    name: "/socials",
    description: "Where to find me",
    // The contacts seam decides what is published: an unset key has no row.
    print: () => ({
      echo: "/socials",
      rows: getContacts().map(({ key, value }) => ({
        label: CONTACT_LABELS[key],
        value,
        tone: "accent" as const,
      })),
    }),
  },
  {
    name: "/clear",
    description: "Wipe the screen",
    // No rows: wiping is the machine's doing, not a row's.
    print: () => ({ echo: "/clear", rows: [] }),
  },
]

/**
 * The opening print: the identity Commands pre-run, so a fresh visit is never
 * empty and the visitor learns the owner before typing. Read off the registry
 * like any other run — the screen opens with what `/whoami` and `/socials`
 * print, not with a second copy of it. A name the registry does not hold is a
 * typo in the line below, so it throws the way the tests' own lookup does.
 */
export function openingPrint(): Print[] {
  return ["/whoami", "/socials"].map((name) => {
    const command = COMMANDS.find((entry) => entry.name === name)
    if (!command) throw new Error(`no Command named ${name}`)
    return command.print()
  })
}
