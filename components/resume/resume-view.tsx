"use client"

import { useSyncExternalStore } from "react"
import { Download } from "lucide-react"

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { en, zh } from "@/lib/resume/locale-data"
import { printResume } from "@/lib/resume/print-resume"
import type { Locale } from "@/lib/resume/types"
import { LanguageToggle } from "./language-toggle"
import { ResumeA4Page } from "./resume-a4-page"

const RESUME_LOCALE_KEY = "resume:locale"

// The print dialog is modal and covers the page, so this notice has to be
// readable *before* Download is clicked. Background graphics and zero margins
// are what keep the sheet's rules and fills intact in the printed PDF.
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

  const data = locale === "zh" ? zh : en
  const help = PRINT_HELP[locale]

  return (
    // Tailwind's `md:` (48rem) is wider than the print layout viewport (~756px
    // for A4), so `md:px-0` never reaches print: the 16px gutter pushes the
    // 210mm sheet off the page, leaving a dark strip of shell background and
    // clipping the sheet's far edge. `print:px-0` is what actually drops it.
    <div className="flex flex-col px-4 md:px-0 print:px-0">
      <div className="mt-6 flex items-center justify-center gap-2 print:hidden">
        <LanguageToggle locale={locale} onChange={handleChange} />
        <Tooltip>
          <TooltipTrigger
            render={
              <button
                type="button"
                onClick={() => printResume()}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
              >
                <Download className="size-4" />
                Download Resume
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
