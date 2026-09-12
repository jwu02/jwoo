"use client"

import { useSyncExternalStore } from "react"
import { Download, Info } from "lucide-react"

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { getResumeData } from "@/lib/resume/locale-data"
import { printResume } from "@/lib/resume/print-resume"
import type { Locale } from "@/lib/resume/types"
import { LanguageToggle } from "./language-toggle"
import { ResumeA4Page } from "./resume-a4-page"

const RESUME_LOCALE_KEY = "resume:locale"

// The print dialog is modal and covers the page, so this notice has to be
// readable *before* Download is clicked. Background graphics and zero margins
// are what keep the sheet's rules and fills intact in the printed PDF.
const PRINT_HELP_LABELS: Record<Locale, string> = {
  en: "Print settings help",
  zh: "打印设置帮助",
}

const PRINT_HELP: Record<Locale, { title: string; settings: string[] }> = {
  en: {
    title: "Chrome Print Dialog",
    settings: ["Margins → None", "Background graphics → Checked"],
  },
  zh: {
    title: "Chrome 打印对话框",
    settings: ["页边距 → 无", "背景图形 → 勾选"],
  },
}

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
  const help = PRINT_HELP[locale]

  return (
    <div className="flex flex-col px-4 md:px-0">
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
        <Tooltip>
          <TooltipTrigger
            render={
              <button
                type="button"
                aria-label={PRINT_HELP_LABELS[locale]}
                className="inline-flex cursor-pointer items-center justify-center rounded-full border p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <Info className="size-4" />
              </button>
            }
          />
          <TooltipContent className="flex-col items-start gap-1">
            <span className="font-medium">{help.title}</span>
            {help.settings.map((setting) => (
              <span key={setting}>- {setting}</span>
            ))}
          </TooltipContent>
        </Tooltip>
      </div>
      <ResumeA4Page data={data} />
    </div>
  )
}
