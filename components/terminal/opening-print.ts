import type { Print } from "./print"

/**
 * The Terminal's opening print: the identity Commands pre-run, so a fresh
 * visit is never empty and the visitor learns the owner before typing.
 *
 * Deliberate throwaway — #65 ships this fixture so the skeleton has something
 * to render. The values are the look prototype's placeholders (jwoo#60), not
 * this deployment's configured contacts: the registry ticket re-points the seed
 * at the real Commands, sources /socials from the contacts seam (adding
 * LinkedIn), and deletes this file. Nothing else should import it.
 */
export const OPENING_PRINT: readonly Print[] = [
  {
    echo: "/whoami",
    rows: [
      { label: "Name", value: "Tony Wu" },
      { label: "Age", value: "24" },
      { label: "Role", value: "Software Engineer" },
      { label: "Company", value: "Kevala" },
      { label: "Location", value: "Sydney, Australia" },
    ],
  },
  {
    echo: "/socials",
    rows: [
      { label: "GitHub", value: "github.com/jwu02", tone: "accent" },
      { label: "Email", value: "tony@jwu02.dev", tone: "accent" },
      { label: "LinkedIn", value: "linkedin.com/in/jwu02", tone: "accent" },
    ],
  },
]
