import type { WorkExperienceItem } from "@/lib/resume/types"
import { SectionTitle } from "./section-title"

export function WorkExperience({
  title,
  items,
}: {
  title: string
  items: WorkExperienceItem[]
}) {
  return (
    <div>
      <SectionTitle title={title} />
      <div className="flex flex-col gap-1">
        {items.map((experience, index) => (
          <div key={index}>
            <div className="flex justify-between">
              <h3 className="font-semibold">{experience.position}</h3>
              <h3>
                {experience.start} - {experience.end}
              </h3>
            </div>
            <h4 className="font-semibold text-muted-foreground">{experience.company}</h4>
            <ul className="list-[square] pl-5">
              {experience.bullets.map((detail, index) => (
                <li key={index}>{detail}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}
