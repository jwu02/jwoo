import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import type { LanguageItem } from "@/lib/resume/types"
import { SectionTitle } from "./section-title"

export function Languages({
  title,
  items,
}: {
  title: string
  items: LanguageItem[]
}) {
  return (
    <div>
      <SectionTitle title={title} />
      <div className="flex flex-col gap-1">
        {items.map((language) => (
          <div key={language.key} className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <span>{language.label}</span>
              <Badge className="px-2 py-0" variant="outline">
                {language.proficiencyLabel}
              </Badge>
            </div>
            <Progress value={language.value} />
          </div>
        ))}
      </div>
    </div>
  )
}
