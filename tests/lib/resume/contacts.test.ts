import { getContacts } from "@/lib/resume/contacts"

const CONTACT_ENV_VARS = [
  "NEXT_PUBLIC_EMAIL",
  "NEXT_PUBLIC_PHONE",
  "NEXT_PUBLIC_GITHUB",
  "NEXT_PUBLIC_WECHAT",
] as const

describe("getContacts", () => {
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

  it("returns nothing when no contact is configured", () => {
    expect(getContacts()).toEqual([])
  })

  it("returns only the configured contacts, in display order", () => {
    process.env.NEXT_PUBLIC_GITHUB = "jwu02"
    process.env.NEXT_PUBLIC_EMAIL = "tony@example.com"

    expect(getContacts()).toEqual([
      { key: "email", value: "tony@example.com" },
      { key: "github", value: "jwu02" },
    ])
  })

  // An empty variable means "not published", not "render a blank row".
  it("treats an empty variable as unconfigured", () => {
    process.env.NEXT_PUBLIC_PHONE = ""

    expect(getContacts()).toEqual([])
  })
})
