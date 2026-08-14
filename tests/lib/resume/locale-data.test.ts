import { en, getResumeData, zh } from "@/lib/resume/locale-data"

describe("resume locale data", () => {
  it("en and zh expose the same top-level shape", () => {
    expect(Object.keys(zh).sort()).toEqual(Object.keys(en).sort())
    for (const key of [
      "education",
      "languages",
      "interests",
      "workExperiences",
      "personalProjects",
      "selfEvaluation",
    ] as const) {
      expect((en[key] as unknown[]).length).toBeGreaterThan(0)
      expect((zh[key] as unknown[]).length).toBeGreaterThan(0)
    }
    expect(en.technicalSkills.length).toBeGreaterThan(0)
    expect(zh.technicalSkills.length).toBeGreaterThan(0)
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
