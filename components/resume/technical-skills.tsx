import type { TechnicalSkillItem } from "@/lib/resume/types"
import { SectionTitle } from "./section-title"

export function TechnicalSkills({
  title,
  items,
}: {
  title: string
  items: TechnicalSkillItem[]
}) {
  return (
    <div>
      <SectionTitle title={title} />
      <ul className="flex flex-col">
        {items.map((skill, index) => (
          <div key={index}>
            <b>{skill.group}:</b> {skill.data.join(", ")}
          </div>
        ))}
      </ul>
    </div>
  )
}
