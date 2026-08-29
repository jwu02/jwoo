"use client"

import { useSyncExternalStore } from "react"
import { Download } from "lucide-react"

import { getResumeData } from "@/lib/resume/locale-data"
import { printResume } from "@/lib/resume/print-resume"
import type { Locale } from "@/lib/resume/types"
import { LanguageToggle } from "./language-toggle"
import { ResumeA4Page } from "./resume-a4-page"

const RESUME_LOCALE_KEY = "resume:locale"

function subscribe(onStoreChange: () => void): () => void {
  window.addEventListener("storage", onStoreChange)
  return () => window.removeEventListener("storage", onStoreChange)
}

function getSnapshot(): Locale {
  return window.localStorage.getItem(RESUME_LOCALE_KEY) === "zh" ? "zh" : "en"
}

function getServerSnapshot(): Locale {
  return "en"
}

export function ResumeView() {
  const locale = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  const handleChange = (next: Locale) => {
    window.localStorage.setItem(RESUME_LOCALE_KEY, next)
    window.dispatchEvent(new Event("storage"))
  }

  const data = getResumeData(locale)

  return (
    <div className="flex flex-col">
      <div className="mt-6 flex items-center justify-center gap-2 print:hidden">
        <LanguageToggle locale={locale} onChange={handleChange} />
        <button
          type="button"
          onClick={() => printResume()}
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
        >
          <Download className="size-4" />
          Download Resume
        </button>
      </div>
      <ResumeA4Page data={data} />
    </div>
  )
}
