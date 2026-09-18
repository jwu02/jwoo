import { en, getResumeData, zh } from "@/lib/resume/locale-data"

// The structure of a document with every leaf collapsed to null: en and zh are
// the same resume written twice, so they must agree on keys and array lengths
// at every level. The strings themselves are translations and are free to
// differ. What this catches is a bullet, a skill group or an interest added to
// one locale and not the other, which the type system cannot see because both
// locales are annotated as ResumeData.
function structureOf(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(structureOf)
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, structureOf(entry)])
    )
  }
  return null
}

describe("resume locale data", () => {
  it("en and zh have the same structure at every level", () => {
    expect(structureOf(zh)).toEqual(structureOf(en))
  })

  // The guard above is only worth having if it can fail; a parity check that
  // passes whatever the data says is the bug being fixed here.
  it("would notice a bullet missing from one locale", () => {
    const shortened = {
      ...zh,
      workExperiences: [
        {
          ...zh.workExperiences[0],
          bullets: zh.workExperiences[0].bullets.slice(1),
        },
      ],
    }

    expect(structureOf(shortened)).not.toEqual(structureOf(en))
  })

  it("every section carries content in both locales", () => {
    for (const locale of [en, zh]) {
      expect(Object.values(locale.titles).every(Boolean)).toBe(true)
      expect(locale.education.length).toBeGreaterThan(0)
      expect(locale.languages.length).toBeGreaterThan(0)
      expect(locale.technicalSkills.length).toBeGreaterThan(0)
      expect(locale.interests.length).toBeGreaterThan(0)
      expect(locale.workExperiences.length).toBeGreaterThan(0)
      expect(locale.personalProjects.length).toBeGreaterThan(0)
      expect(locale.selfEvaluation.length).toBeGreaterThan(0)
    }
  })

  it("getResumeData returns the requested locale", () => {
    expect(getResumeData("en").header.name).toBe("Tony Wu")
    expect(getResumeData("zh").header.name).toBe("吴家聪")
  })

  it("languages are resolved to localized labels", () => {
    expect(en.languages[0]).toEqual({
      key: "english",
      label: "English",
      proficiencyLabel: "Native",
      value: 95,
    })
    expect(zh.languages[0]).toEqual({
      key: "english",
      label: "英语",
      proficiencyLabel: "母语",
      value: 95,
    })
  })
})
