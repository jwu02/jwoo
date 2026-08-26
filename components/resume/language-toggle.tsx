import type { Locale } from "@/lib/resume/types"
import { cn } from "@/lib/utils"

interface LanguageToggleProps {
  locale: Locale
  onChange: (locale: Locale) => void
}

const OPTIONS: { value: Locale; label: string }[] = [
  { value: "en", label: "EN" },
  { value: "zh", label: "中" },
]

export function LanguageToggle({ locale, onChange }: LanguageToggleProps) {
  return (
    <div className="flex items-center gap-1 rounded-full border p-1 print:hidden">
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={locale === option.value}
          className={cn(
            "cursor-pointer rounded-full px-3 py-1 text-sm font-medium",
            locale === option.value
              ? "bg-primary text-primary-foreground hover:bg-primary/90"
              : "text-muted-foreground hover:bg-accent"
          )}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
