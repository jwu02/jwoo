import type { EducationItem } from "@/lib/resume/types"
import { SectionTitle } from "./section-title"

export function Education({
  title,
  items,
}: {
  title: string
  items: EducationItem[]
}) {
  return (
    <div>
      <SectionTitle title={title} />
      <div className="flex flex-col gap-1">
        {items.map((item, index) => (
          <div key={index}>
            <div className="font-bold">{item.school}</div>
            <div className="text-muted-foreground">
              {item.place}, {item.start} - {item.end}
            </div>
            <div>{item.qualification}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
