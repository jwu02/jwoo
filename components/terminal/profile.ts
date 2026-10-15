/**
 * The owner's static self-description: what `/neofetch` prints about, held as the
 * Terminal's own config rather than derived from the resume — the resume's name
 * localizes and knows none of the rest. Copy is English-only, like the Shell's.
 */
export const PROFILE = {
  name: "Tony Wu",
  /** ISO. The one place the owner's age lives: the Age row is derived from it. */
  birthdate: "2002-03-14",
  role: "Professional Vibecoder",
  /** The owner's own location, not the visitor's. */
  location: "Guangdong, China",
  /** One language per entry: the Command joins them with newlines, so each
   * gets its own line. */
  languages: [
    "English (Native)",
    "Mandarin (Heritage)",
    "Cantonese (Heritage)",
    "Taishanese (Heritage)",
    "Japanese (Intermediate)",
    "French (Intermediate)",
  ],
}

/**
 * The owner's age on `today`, compared on the birthdate's own parts: parsing it
 * with `new Date("2002-03-14")` would read as UTC midnight, so asking that date
 * for its local calendar would turn the birthday a day early west of Greenwich.
 */
export function ageOn(birthdate: string, today: Date): number {
  const [year, month, day] = birthdate.split("-").map(Number)
  const hasHadBirthday =
    today.getMonth() + 1 > month ||
    (today.getMonth() + 1 === month && today.getDate() >= day)
  return today.getFullYear() - year - (hasHadBirthday ? 0 : 1)
}
