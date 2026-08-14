"use client"

import { useState } from "react"
import { getResumeData } from "@/lib/resume/locale-data"
import type { Locale } from "@/lib/resume/types"
import { LanguageToggle } from "./language-toggle"
import { ResumeA4Page } from "./resume-a4-page"

const RESUME_LOCALE_KEY = "resume:locale"

function readInitialLocale(): Locale {
  if (typeof window === "undefined") return "en"
  return window.localStorage.getItem(RESUME_LOCALE_KEY) === "zh" ? "zh" : "en"
}

export function ResumeView() {
  const [locale, setLocale] = useState<Locale>(readInitialLocale)
  const data = getResumeData(locale)

  const handleChange = (next: Locale) => {
    setLocale(next)
    window.localStorage.setItem(RESUME_LOCALE_KEY, next)
  }

  return (
    <div className="flex flex-col">
      <div className="mb-4 flex justify-end">
        <LanguageToggle locale={locale} onChange={handleChange} />
      </div>
      <ResumeA4Page data={data} />
    </div>
  )
}
