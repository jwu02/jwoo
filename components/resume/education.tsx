import type { ResumeData } from "@/lib/resume/types"
import { SectionTitle } from "./section-title"

export function Education({ data }: { data: ResumeData }) {
  return (
    <div>
      <SectionTitle title={data.titles.education} />
      <div className="flex flex-col gap-1">
        {data.education.map((item, index) => (
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
