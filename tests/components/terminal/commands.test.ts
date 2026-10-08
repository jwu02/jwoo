import { COMMANDS, openingPrint } from "@/components/terminal/commands"
import { PORTRAIT } from "@/components/terminal/portrait"
import { PROFILE, ageOn } from "@/components/terminal/profile"

/** The Command a name names. Throws rather than returning undefined, so a
 * missing Command reads as the failure it is. */
function command(name: string) {
  const found = COMMANDS.find((entry) => entry.name === name)
  if (!found) throw new Error(`no Command named ${name}`)
  return found
}

const CONTACT_ENV_VARS = [
  "NEXT_PUBLIC_EMAIL",
  "NEXT_PUBLIC_PHONE",
  "NEXT_PUBLIC_GITHUB",
  "NEXT_PUBLIC_WECHAT",
] as const

describe("the Command registry", () => {
  it("declares the v1 four, once each, in their order", () => {
    expect(COMMANDS.map((entry) => entry.name)).toEqual([
      "/clear",
      "/contacts",
      "/neofetch",
      "/socials",
    ])
    expect(new Set(COMMANDS.map((entry) => entry.name)).size).toBe(
      COMMANDS.length
    )
    for (const entry of COMMANDS) expect(entry.description).not.toBe("")
  })

  // Every Print names what produced it: the Echo is the Command's own name.
  it("echoes each Command's own name", () => {
    for (const entry of COMMANDS) expect(entry.print().echo).toBe(entry.name)
  })
})

describe("/neofetch", () => {
  // The owner's picture belongs to the identity Print, and to nothing else: the
  // Portrait is content, so it is the Command that carries it — never the
  // renderer's to guess at.
  it("carries the Portrait, and no other Command does", () => {
    expect(command("/neofetch").print().portrait).toBe(PORTRAIT)
    for (const entry of COMMANDS) {
      if (entry.name === "/neofetch") continue
      expect(entry.print().portrait).toBeUndefined()
    }
  })

  it("prints the four Profile rows", () => {
    expect(command("/neofetch").print().rows).toEqual([
      { label: "Name", value: PROFILE.name },
      { label: "Age", value: String(ageOn(PROFILE.birthdate, new Date())) },
      { label: "Role", value: PROFILE.role },
      { label: "Location", value: PROFILE.location },
    ])
  })
})

describe("the contact listings", () => {
  const original: Record<string, string | undefined> = {}

  beforeEach(() => {
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
  })

  describe("/socials", () => {
    it("prints only the social keys' rows, verbatim, in the seam's order", () => {
      process.env.NEXT_PUBLIC_GITHUB = "jwu02"
      process.env.NEXT_PUBLIC_EMAIL = "tony@example.com"

      expect(command("/socials").print().rows).toEqual([
        { label: "GitHub", value: "jwu02", tone: "accent" },
      ])
    })

    // An unset variable means "not published", so the row simply does not exist.
    it("prints nothing when no social is configured", () => {
      expect(command("/socials").print().rows).toEqual([])
    })
  })

  describe("/contacts", () => {
    it("prints only the contact keys' rows, verbatim, in the seam's order", () => {
      process.env.NEXT_PUBLIC_GITHUB = "jwu02"
      process.env.NEXT_PUBLIC_EMAIL = "tony@example.com"
      process.env.NEXT_PUBLIC_WECHAT = "tony-wu"

      expect(command("/contacts").print().rows).toEqual([
        { label: "Email", value: "tony@example.com", tone: "accent" },
        { label: "WeChat", value: "tony-wu (preferred)", tone: "accent" },
      ])
    })

    it("prints nothing when no contact is configured", () => {
      expect(command("/contacts").print().rows).toEqual([])
    })
  })
})

describe("/clear", () => {
  it("prints no rows: wiping is the machine's doing, not a row's", () => {
    expect(command("/clear").print().rows).toEqual([])
  })
})

describe("the opening print", () => {
  // A fresh visit greets with the Commands themselves run, not with a second
  // copy of their output: identity first, contacts under it.
  it("is the registry's /neofetch and /socials, in that order", () => {
    const opening = openingPrint()

    expect(opening).toEqual([
      command("/neofetch").print(),
      command("/socials").print(),
    ])
    expect(opening.map((print) => print.echo)).toEqual(["/neofetch", "/socials"])
  })
})

describe("age from a birthdate", () => {
  // Local calendar parts on both sides: `new Date("2002-03-14")` is UTC
  // midnight, so a UTC-parsed birthdate would age the owner a day early
  // anywhere west of Greenwich.
  it("counts the birthday as reached on the day itself", () => {
    expect(ageOn("2002-03-14", new Date(2026, 2, 14))).toBe(24)
  })

  it("has not aged the owner the day before", () => {
    expect(ageOn("2002-03-14", new Date(2026, 2, 13))).toBe(23)
  })

  it("has aged the owner the day after", () => {
    expect(ageOn("2002-03-14", new Date(2026, 2, 15))).toBe(24)
  })

  // A December birthdate under a January "today": a naive month subtraction
  // would call this 24.
  it("crosses the year boundary correctly", () => {
    expect(ageOn("2002-12-31", new Date(2026, 0, 1))).toBe(23)
  })
})
